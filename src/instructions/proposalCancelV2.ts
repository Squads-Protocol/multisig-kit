import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getProposalCancelV2Instruction,
} from "../generated";
import { getProposalPda } from "../pda";

export async function proposalCancelV2({
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

  return getProposalCancelV2Instruction(
    {
      multisig: multisigPda,
      proposal: proposalPda,
      member: toSigner(member),
      args: { memo: memo ?? null },
    },
    { programAddress: programId },
  );
}
