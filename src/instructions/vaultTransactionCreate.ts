import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getVaultTransactionCreateInstruction,
} from "../generated";
import { getTransactionPda } from "../pda";
import {
  type AddressLookupTableAccount,
  type TransactionMessage,
  transactionMessageToMultisigTransactionMessageBytes,
} from "../utils";

export async function vaultTransactionCreate({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  vaultIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  transactionIndex: bigint;
  creator: AddressOrSigner;
  rentPayer?: AddressOrSigner;
  vaultIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a multisig transaction (fee payer = vault PDA). */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transactionMessage`. */
  addressLookupTableAccounts?: readonly AddressLookupTableAccount[];
  memo?: string;
  programId?: Address;
}): Promise<Instruction> {
  const [transactionPda] = await getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  const transactionMessageBytes = transactionMessageToMultisigTransactionMessageBytes({
    message: transactionMessage,
    addressLookupTableAccounts,
  });

  return getVaultTransactionCreateInstruction(
    {
      multisig: multisigPda,
      transaction: transactionPda,
      creator: toSigner(creator),
      rentPayer: toSigner(rentPayer ?? creator),
      args: {
        vaultIndex,
        ephemeralSigners,
        transactionMessage: transactionMessageBytes,
        memo: memo ?? null,
      },
    },
    { programAddress: programId },
  );
}
