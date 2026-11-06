import { type Address, type Instruction } from "@solana/kit";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getVaultBatchTransactionAccountCloseInstruction,
} from "../generated";
import { getBatchTransactionPda, getProposalPda, getTransactionPda } from "../pda";

/**
 * Closes a VaultBatchTransaction belonging to the Batch and Proposal defined by `batchIndex`.
 */
export async function vaultBatchTransactionAccountClose({
  multisigPda,
  rentCollector,
  batchIndex,
  transactionIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  rentCollector: Address;
  batchIndex: bigint;
  transactionIndex: number;
  programId?: Address;
}): Promise<Instruction> {
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

  return getVaultBatchTransactionAccountCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      batch: batchPda,
      transaction: batchTransactionPda,
    },
    { programAddress: programId },
  );
}
