import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  type MemberArgs,
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigAddMemberInstruction,
} from "../generated";
import { SYSTEM_PROGRAM_ADDRESS } from "../utils";

export function multisigAddMember({
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  configAuthority: AddressOrSigner;
  rentPayer: AddressOrSigner;
  newMember: MemberArgs;
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigAddMemberInstruction(
    {
      multisig: multisigPda,
      configAuthority: toSigner(configAuthority),
      rentPayer: toSigner(rentPayer),
      // Optional in the IDL — Codama would otherwise leave it as the program-id sentinel, which the
      // program rejects. The instruction reallocs to add a member, so it needs the System Program.
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      newMember,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
