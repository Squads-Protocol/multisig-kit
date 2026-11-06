import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getProposalActivateInstruction,
} from "../generated";
import { getProposalPda } from "../pda";

export async function proposalActivate({
  multisigPda,
  transactionIndex,
  member,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  transactionIndex: bigint;
  member: AddressOrSigner;
  programId?: Address;
}): Promise<Instruction> {
  const [proposalPda] = await getProposalPda({ multisigPda, transactionIndex, programId });

  return getProposalActivateInstruction(
    { multisig: multisigPda, proposal: proposalPda, member: toSigner(member) },
    { programAddress: programId },
  );
}
