import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigSetTimeLockInstruction,
} from "../generated";

export function multisigSetTimeLock({
  multisigPda,
  configAuthority,
  timeLock,
  rentPayer,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  configAuthority: AddressOrSigner;
  timeLock: number;
  rentPayer?: AddressOrSigner;
  memo?: string;
  programId?: Address;
}): Instruction {
  return getMultisigSetTimeLockInstruction(
    {
      multisig: multisigPda,
      configAuthority: toSigner(configAuthority),
      rentPayer: rentPayer ? toSigner(rentPayer) : undefined,
      timeLock,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
