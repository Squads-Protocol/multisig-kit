/**
 * Signer params accept a Kit `TransactionSigner`, so a caller who signs with Kit's
 * `signTransactionMessageWithSigners` can use one key as both fee payer and creator/member.
 * With a bare address the builder emits a no-op signer, and Kit refuses two different signer
 * objects for one address.
 */
import {
  type Blockhash,
  type Instruction,
  type KeyPairSigner,
  SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  isSolanaError,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { describe, expect, it } from "vitest";

import { type AddressOrSigner, getMultisigPda, getVaultPda, instructions } from "../src";
import { Period } from "../src/generated";

const lifetime = {
  blockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k" as Blockhash,
  lastValidBlockHeight: 100n,
};

async function proposeTransfer(creatorFor: (signer: KeyPairSigner) => AddressOrSigner) {
  const signer = await generateKeyPairSigner();
  const createKey = await generateKeyPairSigner();
  const [multisigPda] = await getMultisigPda({ createKey: createKey.address });
  const [vaultPda] = await getVaultPda({ multisigPda, index: 0 });
  const creator = creatorFor(signer);

  const ixs = [
    await instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: { payerKey: vaultPda, instructions: [] },
    }),
    await instructions.proposalCreate({ multisigPda, transactionIndex: 1n, creator }),
    await instructions.proposalApprove({ multisigPda, transactionIndex: 1n, member: creator }),
  ];

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );
  return { signer, signed: await signTransactionMessageWithSigners(message) };
}

describe("signer params", () => {
  it("signs when the fee payer signer is also passed as creator and member", async () => {
    const { signer, signed } = await proposeTransfer((s) => s);
    expect(signed.signatures[signer.address]).toBeInstanceOf(Uint8Array);
    expect(getSignatureFromTransaction(signed)).toBeTypeOf("string");
  });

  it("a bare address for the fee payer's key clashes in Kit (why signers are accepted)", async () => {
    const error = await proposeTransfer((s) => s.address).catch((e: unknown) => e);
    expect(isSolanaError(error, SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS)).toBe(true);
  });
});

describe("every signer-taking builder", async () => {
  const signer = await generateKeyPairSigner();
  const other = (await generateKeyPairSigner()).address;
  const multisigPda = (await generateKeyPairSigner()).address;
  const [vaultPda] = await getVaultPda({ multisigPda, index: 0 });
  const transactionMessage = { payerKey: vaultPda, instructions: [] };
  const base = { multisigPda, transactionIndex: 1n };
  const bytes = new Uint8Array(32);

  // `s` stands for every signer param of the builder; rpc-driven builders
  // (vaultTransactionExecute, batchExecuteTransaction) are covered by scripts/e2e-surfpool.mjs.
  const builders: Record<string, (s: AddressOrSigner) => Instruction | Promise<Instruction>> = {
    batchCreate: (s) => instructions.batchCreate({ multisigPda, creator: s, rentPayer: s, batchIndex: 1n, vaultIndex: 0 }),
    batchAddTransaction: (s) => instructions.batchAddTransaction({ multisigPda, member: s, rentPayer: s, batchIndex: 1n, vaultIndex: 0, transactionIndex: 1, ephemeralSigners: 0, transactionMessage }),
    configTransactionCreate: (s) => instructions.configTransactionCreate({ ...base, creator: s, rentPayer: s, actions: [] }),
    configTransactionExecute: (s) => instructions.configTransactionExecute({ ...base, member: s, rentPayer: s }),
    multisigAddMember: (s) => instructions.multisigAddMember({ multisigPda, configAuthority: s, rentPayer: s, newMember: { key: other, permissions: { mask: 7 } } }),
    multisigChangeThreshold: (s) => instructions.multisigChangeThreshold({ multisigPda, configAuthority: s, rentPayer: s, newThreshold: 1 }),
    multisigAddSpendingLimit: (s) => instructions.multisigAddSpendingLimit({ multisigPda, spendingLimit: other, configAuthority: s, rentPayer: s, createKey: other, vaultIndex: 0, mint: other, amount: 1n, period: Period.Day, members: [], destinations: [] }),
    multisigCreateV2: (s) => instructions.multisigCreateV2({ treasury: other, creator: s, multisigPda, configAuthority: null, threshold: 1, members: [], timeLock: 0, createKey: s, rentCollector: null }),
    multisigRemoveSpendingLimit: (s) => instructions.multisigRemoveSpendingLimit({ multisigPda, spendingLimit: other, configAuthority: s, rentCollector: other }),
    multisigRemoveMember: (s) => instructions.multisigRemoveMember({ multisigPda, configAuthority: s, oldMember: other }),
    multisigSetConfigAuthority: (s) => instructions.multisigSetConfigAuthority({ multisigPda, configAuthority: s, newConfigAuthority: other, rentPayer: s }),
    multisigSetTimeLock: (s) => instructions.multisigSetTimeLock({ multisigPda, configAuthority: s, timeLock: 0, rentPayer: s }),
    multisigSetRentCollector: (s) => instructions.multisigSetRentCollector({ multisigPda, configAuthority: s, newRentCollector: null, rentPayer: s }),
    proposalCreate: (s) => instructions.proposalCreate({ ...base, creator: s, rentPayer: s }),
    proposalActivate: (s) => instructions.proposalActivate({ ...base, member: s }),
    proposalApprove: (s) => instructions.proposalApprove({ ...base, member: s }),
    proposalReject: (s) => instructions.proposalReject({ ...base, member: s }),
    proposalCancel: (s) => instructions.proposalCancel({ ...base, member: s }),
    proposalCancelV2: (s) => instructions.proposalCancelV2({ ...base, member: s }),
    spendingLimitUse: (s) => instructions.spendingLimitUse({ multisigPda, member: s, spendingLimit: other, vaultIndex: 0, amount: 1n, decimals: 9, destination: other }),
    transactionBufferCreate: (s) => instructions.transactionBufferCreate({ multisigPda, creator: s, rentPayer: s, bufferIndex: 0, vaultIndex: 0, finalBufferHash: bytes, finalBufferSize: 32, buffer: bytes }),
    transactionBufferExtend: (s) => instructions.transactionBufferExtend({ multisigPda, creator: s, bufferIndex: 0, buffer: bytes }),
    transactionBufferClose: (s) => instructions.transactionBufferClose({ multisigPda, creator: s, bufferIndex: 0 }),
    vaultTransactionCreate: (s) => instructions.vaultTransactionCreate({ ...base, creator: s, rentPayer: s, vaultIndex: 0, ephemeralSigners: 0, transactionMessage }),
    vaultTransactionCreateFromBuffer: (s) => instructions.vaultTransactionCreateFromBuffer({ ...base, creator: s, rentPayer: s, bufferIndex: 0, vaultIndex: 0, ephemeralSigners: 0 }),
  };

  const metas = (ix: Instruction) => (ix.accounts ?? []).map((a) => ({ address: a.address, role: a.role }));

  it.each(Object.keys(builders))("%s: a signer builds the same instruction as its address and is carried through", async (name) => {
    const withSigner = await builders[name](signer);
    const withAddress = await builders[name](signer.address);
    expect(withSigner.data).toEqual(withAddress.data);
    expect(metas(withSigner)).toEqual(metas(withAddress));
    const carried = (withSigner.accounts ?? []).filter((a) => a.address === signer.address && "signer" in a);
    expect(carried.length).toBeGreaterThan(0);
    for (const a of carried) expect((a as unknown as { signer: unknown }).signer).toBe(signer);
  });
});
