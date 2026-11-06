import { type Address, type Instruction, fetchEncodedAccount } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  decodeVaultTransaction,
  getVaultTransactionExecuteInstruction,
} from "../generated";
import { getProposalPda, getTransactionPda, getVaultPda } from "../pda";
import {
  type AccountFetcher,
  type AddressLookupTableAccount,
  accountsForTransactionExecute,
} from "../utils";

export async function vaultTransactionExecute({
  rpc,
  multisigPda,
  transactionIndex,
  member,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  rpc: AccountFetcher;
  multisigPda: Address;
  transactionIndex: bigint;
  member: AddressOrSigner;
  programId?: Address;
}): Promise<{ instruction: Instruction; lookupTableAccounts: AddressLookupTableAccount[] }> {
  const [proposalPda] = await getProposalPda({ multisigPda, transactionIndex, programId });
  const [transactionPda] = await getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  const encoded = await fetchEncodedAccount(rpc, transactionPda);
  if (!encoded.exists) {
    throw new Error(`VaultTransaction account ${transactionPda} not found`);
  }
  const transactionAccount = decodeVaultTransaction(encoded).data;

  const [vaultPda] = await getVaultPda({
    multisigPda,
    index: transactionAccount.vaultIndex,
    programId,
  });

  const { accountMetas, lookupTableAccounts } = await accountsForTransactionExecute({
    rpc,
    message: transactionAccount.message,
    ephemeralSignerBumps: transactionAccount.ephemeralSignerBumps,
    vaultPda,
    transactionPda,
    programId,
  });

  const base = getVaultTransactionExecuteInstruction(
    {
      multisig: multisigPda,
      member: toSigner(member),
      proposal: proposalPda,
      transaction: transactionPda,
    },
    { programAddress: programId },
  );

  return {
    instruction: { ...base, accounts: [...(base.accounts ?? []), ...accountMetas] },
    lookupTableAccounts,
  };
}
