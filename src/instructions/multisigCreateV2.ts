import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  type MemberArgs,
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getMultisigCreateV2Instruction,
} from "../generated";
import { getProgramConfigPda } from "../pda";

export async function multisigCreateV2({
  treasury,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  createKey,
  rentCollector,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  treasury: Address;
  creator: AddressOrSigner;
  multisigPda: Address;
  configAuthority: Address | null;
  threshold: number;
  members: MemberArgs[];
  timeLock: number;
  createKey: AddressOrSigner;
  rentCollector: Address | null;
  memo?: string;
  programId?: Address;
}): Promise<Instruction> {
  const [programConfigPda] = await getProgramConfigPda({ programId });

  return getMultisigCreateV2Instruction(
    {
      programConfig: programConfigPda,
      treasury,
      creator: toSigner(creator),
      createKey: toSigner(createKey),
      multisig: multisigPda,
      configAuthority,
      threshold,
      members,
      timeLock,
      rentCollector,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
