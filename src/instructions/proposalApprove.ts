import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getProposalApproveInstruction,
} from "../generated";
import { getProposalPda } from "../pda";

export async function proposalApprove({
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  transactionIndex: bigint;
  member: AddressOrSigner;
  memo?: string;
  programId?: Address;
}): Promise<Instruction> {
  const [proposalPda] = await getProposalPda({ multisigPda, transactionIndex, programId });

  return getProposalApproveInstruction(
    {
      multisig: multisigPda,
      proposal: proposalPda,
      member: toSigner(member),
      args: { memo: memo ?? null },
    },
    { programAddress: programId },
  );
}
