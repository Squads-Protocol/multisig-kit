import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigRemoveSpendingLimitInstruction,
} from "../generated";

export function multisigRemoveSpendingLimit({
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  spendingLimit: Address;
  configAuthority: AddressOrSigner;
  rentCollector: Address;
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigRemoveSpendingLimitInstruction(
    {
      multisig: multisigPda,
      spendingLimit,
      configAuthority: toSigner(configAuthority),
      rentCollector,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
