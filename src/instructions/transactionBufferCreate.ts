import {
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
} from "@solana/kit";
import { type AddressOrSigner, toAddress, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getTransactionBufferCreateInstruction,
} from "../generated";
import { getTransactionBufferPda } from "../pda";

/**
 * Create a transaction buffer. The buffer lets large transaction messages be uploaded in chunks
 * (create + repeated extend) before materializing a VaultTransaction via
 * `vaultTransactionCreateFromBuffer`. Not present in the OG `@sqds/multisig` SDK.
 *
 * `finalBufferHash` is the SHA-256 of the fully assembled message; `finalBufferSize` is its total
 * byte length; `buffer` is the initial slice to upload.
 */
export async function transactionBufferCreate({
  multisigPda,
  creator,
  rentPayer,
  bufferIndex,
  vaultIndex,
  finalBufferHash,
  finalBufferSize,
  buffer,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  /** Member of the multisig creating the buffer (also the buffer PDA seed). */
  creator: AddressOrSigner;
  /** Payer for the buffer account rent. If not provided, `creator` is used. */
  rentPayer?: AddressOrSigner;
  bufferIndex: number;
  vaultIndex: number;
  finalBufferHash: ReadonlyUint8Array;
  finalBufferSize: number;
  buffer: ReadonlyUint8Array;
  programId?: Address;
}): Promise<Instruction> {
  if (finalBufferHash.length !== 32) {
    throw new Error("finalBufferHash must be 32 bytes (SHA-256 of the assembled message)");
  }

  const [transactionBufferPda] = await getTransactionBufferPda({
    multisigPda,
    creator: toAddress(creator),
    bufferIndex,
    programId,
  });

  return getTransactionBufferCreateInstruction(
    {
      multisig: multisigPda,
      transactionBuffer: transactionBufferPda,
      creator: toSigner(creator),
      rentPayer: toSigner(rentPayer ?? creator),
      bufferIndex,
      vaultIndex,
      finalBufferHash,
      finalBufferSize,
      buffer,
    },
    { programAddress: programId },
  );
}
