import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigSetRentCollectorInstruction,
} from "../generated";
import { SYSTEM_PROGRAM_ADDRESS } from "../utils";

export function multisigSetRentCollector({
  multisigPda,
  configAuthority,
  newRentCollector,
  rentPayer,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  configAuthority: AddressOrSigner;
  newRentCollector: Address | null;
  rentPayer: AddressOrSigner;
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigSetRentCollectorInstruction(
    {
      multisig: multisigPda,
      configAuthority: toSigner(configAuthority),
      rentPayer: toSigner(rentPayer),
      // See multisigAddMember: optional in the IDL, but required by the program.
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      rentCollector: newRentCollector,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
