import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getBatchAddTransactionInstruction,
} from "../generated";
import { getBatchTransactionPda, getProposalPda, getTransactionPda } from "../pda";
import {
  type AddressLookupTableAccount,
  type TransactionMessage,
  transactionMessageToMultisigTransactionMessageBytes,
} from "../utils";

export async function batchAddTransaction({
  // Accepted for API parity with @sqds/multisig; the wrapped message already carries the vault as
  // its fee payer, so the index is not needed to serialize it.
  vaultIndex: _vaultIndex,
  multisigPda,
  member,
  rentPayer,
  batchIndex,
  transactionIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  vaultIndex: number;
  multisigPda: Address;
  /** Member of the multisig that is adding the transaction. */
  member: AddressOrSigner;
  /** Payer for the transaction account rent. If not provided, `member` is used. */
  rentPayer?: AddressOrSigner;
  batchIndex: bigint;
  transactionIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a batch transaction (fee payer = vault PDA). */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transactionMessage`. */
  addressLookupTableAccounts?: readonly AddressLookupTableAccount[];
  programId?: Address;
}): Promise<Instruction> {
  const [proposalPda] = await getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId,
  });
  const [batchPda] = await getTransactionPda({ multisigPda, index: batchIndex, programId });
  const [batchTransactionPda] = await getBatchTransactionPda({
    multisigPda,
    batchIndex,
    transactionIndex,
    programId,
  });

  const transactionMessageBytes = transactionMessageToMultisigTransactionMessageBytes({
    message: transactionMessage,
    addressLookupTableAccounts,
  });

  return getBatchAddTransactionInstruction(
    {
      multisig: multisigPda,
      member: toSigner(member),
      proposal: proposalPda,
      rentPayer: toSigner(rentPayer ?? member),
      batch: batchPda,
      transaction: batchTransactionPda,
      ephemeralSigners,
      transactionMessage: transactionMessageBytes,
    },
    { programAddress: programId },
  );
}
