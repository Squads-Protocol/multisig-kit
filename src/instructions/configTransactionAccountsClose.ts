import { type Address, type Instruction } from "@solana/kit";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getConfigTransactionAccountsCloseInstruction,
} from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

export async function configTransactionAccountsClose({
  multisigPda,
  rentCollector,
  transactionIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  rentCollector: Address;
  transactionIndex: bigint;
  programId?: Address;
}): Promise<Instruction> {
  const [proposalPda] = await getProposalPda({ multisigPda, transactionIndex, programId });
  const [transactionPda] = await getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  return getConfigTransactionAccountsCloseInstruction(
    { multisig: multisigPda, rentCollector, proposal: proposalPda, transaction: transactionPda },
    { programAddress: programId },
  );
}
