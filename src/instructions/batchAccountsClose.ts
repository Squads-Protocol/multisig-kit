import { type Address, type Instruction } from "@solana/kit";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getBatchAccountsCloseInstruction,
} from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

/**
 * Closes Batch and the corresponding Proposal account for proposals in terminal states, or stale
 * non-approved proposals. Only allowed when all `VaultBatchTransaction` accounts are closed.
 */
export async function batchAccountsClose({
  multisigPda,
  rentCollector,
  batchIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  rentCollector: Address;
  batchIndex: bigint;
  programId?: Address;
}): Promise<Instruction> {
  const [proposalPda] = await getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId,
  });
  const [batchPda] = await getTransactionPda({ multisigPda, index: batchIndex, programId });

  return getBatchAccountsCloseInstruction(
    { multisig: multisigPda, rentCollector, proposal: proposalPda, batch: batchPda },
    { programAddress: programId },
  );
}
