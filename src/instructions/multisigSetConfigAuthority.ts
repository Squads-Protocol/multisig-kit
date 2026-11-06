import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigSetConfigAuthorityInstruction,
} from "../generated";

export function multisigSetConfigAuthority({
  multisigPda,
  configAuthority,
  newConfigAuthority,
  rentPayer,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  configAuthority: AddressOrSigner;
  newConfigAuthority: Address;
  rentPayer?: AddressOrSigner;
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigSetConfigAuthorityInstruction(
    {
      multisig: multisigPda,
      configAuthority: toSigner(configAuthority),
      rentPayer: rentPayer ? toSigner(rentPayer) : undefined,
      // The generated arg was renamed to avoid the account/arg name collision.
      configAuthorityArg: newConfigAuthority,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
