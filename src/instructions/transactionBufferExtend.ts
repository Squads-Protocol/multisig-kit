import {
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
} from "@solana/kit";
import { type AddressOrSigner, toAddress, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getTransactionBufferExtendInstruction,
} from "../generated";
import { getTransactionBufferPda } from "../pda";

/** Append a slice of bytes to an existing transaction buffer. */
export async function transactionBufferExtend({
  multisigPda,
  creator,
  bufferIndex,
  buffer,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  creator: AddressOrSigner;
  bufferIndex: number;
  buffer: ReadonlyUint8Array;
  programId?: Address;
}): Promise<Instruction> {
  const [transactionBufferPda] = await getTransactionBufferPda({
    multisigPda,
    creator: toAddress(creator),
    bufferIndex,
    programId,
  });

  return getTransactionBufferExtendInstruction(
    {
      multisig: multisigPda,
      transactionBuffer: transactionBufferPda,
      creator: toSigner(creator),
      buffer,
    },
    { programAddress: programId },
  );
}
