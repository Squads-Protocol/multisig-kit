import {
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
} from "@solana/kit";
import { type AddressOrSigner, toAddress, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getVaultTransactionCreateFromBufferInstruction,
} from "../generated";
import { getTransactionBufferPda, getTransactionPda } from "../pda";
import { SYSTEM_PROGRAM_ADDRESS } from "../utils";

/**
 * Materialize a VaultTransaction from a previously assembled transaction buffer. The transaction
 * message is read from the buffer on-chain; the program requires the instruction's own
 * `transactionMessage` to be exactly 6 zero bytes, which is the default.
 * The original `@sqds/multisig` SDK has no wrapper for this, only the raw generated builder.
 */
export async function vaultTransactionCreateFromBuffer({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  bufferIndex,
  vaultIndex,
  ephemeralSigners,
  transactionMessage = new Uint8Array(6),
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  transactionIndex: bigint;
  creator: AddressOrSigner;
  rentPayer?: AddressOrSigner;
  bufferIndex: number;
  vaultIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Leave unset: the program rejects anything but 6 zero bytes (the message comes from the buffer). */
  transactionMessage?: ReadonlyUint8Array;
  memo?: string;
  programId?: Address;
}): Promise<Instruction> {
  const [transactionPda] = await getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });
  const [transactionBufferPda] = await getTransactionBufferPda({
    multisigPda,
    creator: toAddress(creator),
    bufferIndex,
    programId,
  });
  const rentPayerAddress = rentPayer ?? creator;

  return getVaultTransactionCreateFromBufferInstruction(
    {
      vaultTransactionCreateMultisig: multisigPda,
      vaultTransactionCreateTransaction: transactionPda,
      vaultTransactionCreateCreator: toSigner(creator),
      vaultTransactionCreateRentPayer: toSigner(rentPayerAddress),
      vaultTransactionCreateSystemProgram: SYSTEM_PROGRAM_ADDRESS,
      transactionBuffer: transactionBufferPda,
      creator: toSigner(creator),
      args: { vaultIndex, ephemeralSigners, transactionMessage, memo: memo ?? null },
    },
    { programAddress: programId },
  );
}
