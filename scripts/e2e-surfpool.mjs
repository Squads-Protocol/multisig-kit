// End-to-end against a local validator that has the Squads program (e.g. a mainnet fork):
//   surfpool start --network mainnet --port 18899 --ws-port 18900 --no-tui --ci
//   npm run build && npm run e2e        (RPC_URL overrides http://127.0.0.1:18899)
import * as multisig from "@sqds/multisig-kit";
import {
  AccountRole, appendTransactionMessageInstructions, createSolanaRpc, createTransactionMessage,
  generateKeyPairSigner, getBase64EncodedWireTransaction, getSignatureFromTransaction, getU32Encoder,
  getU64Encoder, lamports, pipe, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, address,
} from "@solana/kit";

const rpc = createSolanaRpc(process.env.RPC_URL ?? "http://127.0.0.1:18899");
const SYSTEM = address("11111111111111111111111111111111");

async function send(feePayer, ixs, label) {
  const { value: bh } = await rpc.getLatestBlockhash().send();
  const msg = pipe(createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) => appendTransactionMessageInstructions(ixs, m));
  const signed = await signTransactionMessageWithSigners(msg);
  const sig = getSignatureFromTransaction(signed);
  await rpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed" }).send();
  for (let i = 0; i < 60; i++) {
    const { value: [st] } = await rpc.getSignatureStatuses([sig]).send();
    if (st?.confirmationStatus) { if (st.err) throw new Error(`${label} failed: ${JSON.stringify(st.err, (_, v) => typeof v === "bigint" ? v.toString() : v)}`); console.log(`ok ${label} ${sig}`); return; }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${label} not confirmed`);
}

const member = await generateKeyPairSigner();
const createKey = await generateKeyPairSigner();
const recipient = await generateKeyPairSigner();
await rpc.requestAirdrop(member.address, lamports(10_000_000_000n)).send();
await new Promise((r) => setTimeout(r, 1000));

const [programConfigPda] = await multisig.getProgramConfigPda({});
const { data: programConfig } = await multisig.accounts.fetchProgramConfig(rpc, programConfigPda);
const [multisigPda] = await multisig.getMultisigPda({ createKey: createKey.address });
const [vaultPda] = await multisig.getVaultPda({ multisigPda, index: 0 });

// 1. Create a 1-of-1 multisig (member = creator = fee payer, a real KeyPairSigner everywhere).
await send(member, [await multisig.instructions.multisigCreateV2({
  treasury: programConfig.treasury, creator: member, multisigPda, configAuthority: null,
  threshold: 1, members: [{ key: member.address, permissions: multisig.Permissions.all() }],
  timeLock: 0, createKey, rentCollector: null,
})], "multisigCreateV2");

// Fund the vault.
const transfer = (from, to, amount) => ({
  programAddress: SYSTEM,
  accounts: [{ address: from, role: AccountRole.WRITABLE_SIGNER }, { address: to, role: AccountRole.WRITABLE }],
  data: new Uint8Array([...getU32Encoder().encode(2), ...getU64Encoder().encode(amount)]),
});
await send(member, [transfer(member.address, vaultPda, 2_000_000_000n)], "fund vault");

// 2. Propose + approve a vault transfer in one tx.
const ms = await multisig.accounts.fetchMultisig(rpc, multisigPda);
const transactionIndex = ms.data.transactionIndex + 1n;
await send(member, [
  await multisig.instructions.vaultTransactionCreate({ multisigPda, transactionIndex, creator: member, vaultIndex: 0,
    ephemeralSigners: 0, transactionMessage: { payerKey: vaultPda, instructions: [transfer(vaultPda, recipient.address, 1_000_000_000n)] } }),
  await multisig.instructions.proposalCreate({ multisigPda, transactionIndex, creator: member }),
  await multisig.instructions.proposalApprove({ multisigPda, transactionIndex, member }),
], "vaultTransactionCreate+proposalCreate+proposalApprove");

const [proposalPda] = await multisig.getProposalPda({ multisigPda, transactionIndex });
console.log("proposal status", (await multisig.accounts.fetchProposal(rpc, proposalPda)).data.status.__kind);

// 3. Execute.
const { instruction } = await multisig.instructions.vaultTransactionExecute({ rpc, multisigPda, transactionIndex, member });
await send(member, [instruction], "vaultTransactionExecute");
console.log("proposal status", (await multisig.accounts.fetchProposal(rpc, proposalPda)).data.status.__kind);
console.log("recipient lamports", (await rpc.getBalance(recipient.address).send()).value);
