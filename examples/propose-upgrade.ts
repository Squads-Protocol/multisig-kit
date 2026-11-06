/**
 * Propose a program upgrade from a Squads vault: wrap a BPF Upgradeable Loader `Upgrade`
 * instruction (signed by the vault, the program's upgrade authority) in a vault transaction,
 * open its proposal and cast the first approval, all in one Kit transaction.
 *
 * Typechecked with the package (`npm run typecheck`); not run in tests.
 */
import {
  AccountRole,
  type Address,
  type Instruction,
  type TransactionSigner,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getProgramDerivedAddress,
  getAddressEncoder,
  address,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  assertIsTransactionWithBlockhashLifetime,
} from "@solana/kit";

import * as multisig from "../src";

const BPF_LOADER_UPGRADEABLE = address("BPFLoaderUpgradeab1e11111111111111111111111");
const SYSVAR_RENT = address("SysvarRent111111111111111111111111111111111");
const SYSVAR_CLOCK = address("SysvarC1ock11111111111111111111111111111111");

async function upgradeInstruction({
  programId,
  buffer,
  spill,
  authority,
}: {
  programId: Address;
  buffer: Address;
  spill: Address;
  authority: Address;
}): Promise<Instruction> {
  const [programData] = await getProgramDerivedAddress({
    programAddress: BPF_LOADER_UPGRADEABLE,
    seeds: [getAddressEncoder().encode(programId)],
  });
  return {
    programAddress: BPF_LOADER_UPGRADEABLE,
    accounts: [
      { address: programData, role: AccountRole.WRITABLE },
      { address: programId, role: AccountRole.WRITABLE },
      { address: buffer, role: AccountRole.WRITABLE },
      { address: spill, role: AccountRole.WRITABLE },
      { address: SYSVAR_RENT, role: AccountRole.READONLY },
      { address: SYSVAR_CLOCK, role: AccountRole.READONLY },
      { address: authority, role: AccountRole.READONLY_SIGNER },
    ],
    data: new Uint8Array([3, 0, 0, 0]), // UpgradeableLoaderInstruction::Upgrade
  };
}

export async function proposeUpgrade({
  rpcUrl,
  wsUrl,
  member,
  multisigPda,
  programId,
  buffer,
}: {
  rpcUrl: string;
  wsUrl: string;
  /** A multisig member with Initiate + Vote permissions; also pays the fees. */
  member: TransactionSigner;
  multisigPda: Address;
  programId: Address;
  buffer: Address;
}) {
  const rpc = createSolanaRpc(rpcUrl);
  const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

  const [vaultPda] = await multisig.getVaultPda({ multisigPda, index: 0 });
  const { data: ms } = await multisig.accounts.fetchMultisig(rpc, multisigPda);
  const transactionIndex = ms.transactionIndex + 1n;

  const upgrade = await upgradeInstruction({
    programId,
    buffer,
    spill: member.address,
    authority: vaultPda,
  });

  const instructions = [
    await multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex,
      creator: member,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: { payerKey: vaultPda, instructions: [upgrade] },
      memo: "Upgrade program",
    }),
    await multisig.instructions.proposalCreate({ multisigPda, transactionIndex, creator: member }),
    await multisig.instructions.proposalApprove({ multisigPda, transactionIndex, member }),
  ];

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(member, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );

  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(signed);
  await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signed, {
    commitment: "confirmed",
  });
  return { signature: getSignatureFromTransaction(signed), transactionIndex };
}
