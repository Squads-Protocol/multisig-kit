import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getProposalCreateInstruction,
} from "../generated";
import { getProposalPda } from "../pda";

export async function proposalCreate({
  multisigPda,
  creator,
  rentPayer,
  transactionIndex,
  isDraft = false,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  /** Member of the multisig that is creating the proposal. */
  creator: AddressOrSigner;
  /** Payer for the proposal account rent. If not provided, `creator` is used. */
  rentPayer?: AddressOrSigner;
  transactionIndex: bigint;
  isDraft?: boolean;
  programId?: Address;
}): Promise<Instruction> {
  if (transactionIndex > Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `transactionIndex ${transactionIndex} exceeds Number.MAX_SAFE_INTEGER — cannot safely downcast to the number the instruction expects`,
    );
  }

  const [proposalPda] = await getProposalPda({ multisigPda, transactionIndex, programId });

  return getProposalCreateInstruction(
    {
      creator: toSigner(creator),
      rentPayer: toSigner(rentPayer ?? creator),
      multisig: multisigPda,
      proposal: proposalPda,
      transactionIndex: Number(transactionIndex),
      draft: isDraft,
    },
    { programAddress: programId },
  );
}
