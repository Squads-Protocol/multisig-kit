import { AccountRole, type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getConfigTransactionExecuteInstruction,
} from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";
import { SYSTEM_PROGRAM_ADDRESS } from "../utils";

export async function configTransactionExecute({
  multisigPda,
  transactionIndex,
  member,
  rentPayer,
  spendingLimits,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  transactionIndex: bigint;
  member: AddressOrSigner;
  rentPayer?: AddressOrSigner;
  /** In case the transaction adds or removes SpendingLimits, pass their addresses here. */
  spendingLimits?: Address[];
  programId?: Address;
}): Promise<Instruction> {
  const [proposalPda] = await getProposalPda({ multisigPda, transactionIndex, programId });
  const [transactionPda] = await getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  const base = getConfigTransactionExecuteInstruction(
    {
      multisig: multisigPda,
      member: toSigner(member),
      proposal: proposalPda,
      transaction: transactionPda,
      rentPayer: rentPayer ? toSigner(rentPayer) : undefined,
      // Optional in the IDL — required by the program (may realloc on spending-limit changes).
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
    },
    { programAddress: programId },
  );

  if (!spendingLimits || spendingLimits.length === 0) {
    return base;
  }

  return {
    ...base,
    accounts: [
      ...(base.accounts ?? []),
      ...spendingLimits.map((address) => ({ address, role: AccountRole.WRITABLE })),
    ],
  };
}
