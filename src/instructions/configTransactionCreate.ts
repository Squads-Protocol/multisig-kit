import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  type ConfigActionArgs,
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getConfigTransactionCreateInstruction,
} from "../generated";
import { getTransactionPda } from "../pda";

export async function configTransactionCreate({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  actions,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  /** Member of the multisig that is creating the transaction. */
  creator: AddressOrSigner;
  /** Payer for the transaction account rent. If not provided, `creator` is used. */
  rentPayer?: AddressOrSigner;
  transactionIndex: bigint;
  actions: ConfigActionArgs[];
  memo?: string;
  programId?: Address;
}): Promise<Instruction> {
  const [transactionPda] = await getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  return getConfigTransactionCreateInstruction(
    {
      multisig: multisigPda,
      transaction: transactionPda,
      creator: toSigner(creator),
      rentPayer: toSigner(rentPayer ?? creator),
      actions,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
