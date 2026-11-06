import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import { SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS, getBatchCreateInstruction } from "../generated";
import { getTransactionPda } from "../pda";

export async function batchCreate({
  multisigPda,
  creator,
  rentPayer,
  batchIndex,
  vaultIndex,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  /** Member of the multisig that is creating the batch. */
  creator: AddressOrSigner;
  /** Payer for the batch account rent. If not provided, `creator` is used. */
  rentPayer?: AddressOrSigner;
  batchIndex: bigint;
  vaultIndex: number;
  memo?: string;
  programId?: Address;
}): Promise<Instruction> {
  const [batchPda] = await getTransactionPda({ multisigPda, index: batchIndex, programId });

  return getBatchCreateInstruction(
    {
      multisig: multisigPda,
      creator: toSigner(creator),
      rentPayer: toSigner(rentPayer ?? creator),
      batch: batchPda,
      vaultIndex,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
