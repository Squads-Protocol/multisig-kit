import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigRemoveMemberInstruction,
} from "../generated";
import { SYSTEM_PROGRAM_ADDRESS } from "../utils";

export function multisigRemoveMember({
  multisigPda,
  configAuthority,
  oldMember,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  configAuthority: AddressOrSigner;
  oldMember: Address;
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigRemoveMemberInstruction(
    {
      multisig: multisigPda,
      configAuthority: toSigner(configAuthority),
      // See multisigAddMember: optional in the IDL, but required by the program (realloc).
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      oldMember,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
