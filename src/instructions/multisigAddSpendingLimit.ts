import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  type Period,
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigAddSpendingLimitInstruction,
} from "../generated";

export function multisigAddSpendingLimit({
  multisigPda,
  configAuthority,
  spendingLimit,
  rentPayer,
  createKey,
  vaultIndex,
  mint,
  amount,
  period,
  members,
  destinations,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  spendingLimit: Address;
  configAuthority: AddressOrSigner;
  rentPayer: AddressOrSigner;
  createKey: Address;
  vaultIndex: number;
  mint: Address;
  amount: bigint;
  period: Period;
  members: Address[];
  destinations: Address[];
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigAddSpendingLimitInstruction(
    {
      multisig: multisigPda,
      spendingLimit,
      configAuthority: toSigner(configAuthority),
      rentPayer: toSigner(rentPayer),
      createKey,
      vaultIndex,
      mint,
      amount,
      period,
      members,
      destinations,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
