import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toAddress, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getTransactionBufferCloseInstruction,
} from "../generated";
import { getTransactionBufferPda } from "../pda";

/** Close a transaction buffer and reclaim its rent. */
export async function transactionBufferClose({
  multisigPda,
  creator,
  bufferIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  creator: AddressOrSigner;
  bufferIndex: number;
  programId?: Address;
}): Promise<Instruction> {
  const [transactionBufferPda] = await getTransactionBufferPda({
    multisigPda,
    creator: toAddress(creator),
    bufferIndex,
    programId,
  });

  return getTransactionBufferCloseInstruction(
    {
      multisig: multisigPda,
      transactionBuffer: transactionBufferPda,
      creator: toSigner(creator),
    },
    { programAddress: programId },
  );
}
