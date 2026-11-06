import { type Address, type Instruction, fetchEncodedAccount } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  type VaultBatchTransaction,
  decodeBatch,
  decodeVaultBatchTransaction,
  getBatchExecuteTransactionInstruction,
} from "../generated";
import { getBatchTransactionPda, getProposalPda, getTransactionPda, getVaultPda } from "../pda";
import {
  type AccountFetcher,
  type AddressLookupTableAccount,
  accountsForTransactionExecute,
} from "../utils";

/**
 * Also returns the child it read, so a caller that inspects the stored message
 * (its ephemeral signers) needs no second read of the same account.
 */
export async function batchExecuteTransaction({
  rpc,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  rpc: AccountFetcher;
  multisigPda: Address;
  member: AddressOrSigner;
  batchIndex: bigint;
  transactionIndex: number;
  programId?: Address;
}): Promise<
  { instruction: Instruction; lookupTableAccounts: AddressLookupTableAccount[] } & Pick<
    VaultBatchTransaction,
    "ephemeralSignerBumps" | "message"
  >
> {
  const [proposalPda] = await getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId,
  });
  const [batchPda] = await getTransactionPda({ multisigPda, index: batchIndex, programId });
  const [batchTransactionPda] = await getBatchTransactionPda({
    multisigPda,
    batchIndex,
    transactionIndex,
    programId,
  });

  const batchEncoded = await fetchEncodedAccount(rpc, batchPda);
  if (!batchEncoded.exists) {
    throw new Error(`Batch account ${batchPda} not found`);
  }
  const batchAccount = decodeBatch(batchEncoded).data;

  const [vaultPda] = await getVaultPda({ multisigPda, index: batchAccount.vaultIndex, programId });

  const txEncoded = await fetchEncodedAccount(rpc, batchTransactionPda);
  if (!txEncoded.exists) {
    throw new Error(`VaultBatchTransaction account ${batchTransactionPda} not found`);
  }
  const batchTransactionAccount = decodeVaultBatchTransaction(txEncoded).data;

  const { accountMetas, lookupTableAccounts } = await accountsForTransactionExecute({
    rpc,
    message: batchTransactionAccount.message,
    ephemeralSignerBumps: batchTransactionAccount.ephemeralSignerBumps,
    vaultPda,
    transactionPda: batchPda,
    programId,
  });

  const base = getBatchExecuteTransactionInstruction(
    {
      multisig: multisigPda,
      member: toSigner(member),
      proposal: proposalPda,
      batch: batchPda,
      transaction: batchTransactionPda,
    },
    { programAddress: programId },
  );

  return {
    instruction: { ...base, accounts: [...(base.accounts ?? []), ...accountMetas] },
    lookupTableAccounts,
    ephemeralSignerBumps: batchTransactionAccount.ephemeralSignerBumps,
    message: batchTransactionAccount.message,
  };
}
