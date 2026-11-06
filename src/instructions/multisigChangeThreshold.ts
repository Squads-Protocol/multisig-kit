import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigChangeThresholdInstruction,
} from "../generated";

export function multisigChangeThreshold({
  multisigPda,
  configAuthority,
  rentPayer,
  newThreshold,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  configAuthority: AddressOrSigner;
  rentPayer: AddressOrSigner;
  newThreshold: number;
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigChangeThresholdInstruction(
    {
      multisig: multisigPda,
      configAuthority: toSigner(configAuthority),
      rentPayer: toSigner(rentPayer),
      newThreshold,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
