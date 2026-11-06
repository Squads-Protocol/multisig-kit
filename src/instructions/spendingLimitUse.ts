import { type Address, type Instruction } from "@solana/kit";
import { type AddressOrSigner, toSigner } from "../signers";

import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  getSpendingLimitUseInstruction,
} from "../generated";
import { getVaultPda } from "../pda";
import { SYSTEM_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS, getAssociatedTokenPda } from "../utils";

export async function spendingLimitUse({
  multisigPda,
  member,
  spendingLimit,
  mint,
  vaultIndex,
  amount,
  decimals,
  destination,
  tokenProgram = TOKEN_PROGRAM_ADDRESS,
  memo,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  member: AddressOrSigner;
  spendingLimit: Address;
  /** Provide if `spendingLimit` is for an SPL token, omit if it's for SOL. */
  mint?: Address;
  vaultIndex: number;
  amount: number | bigint;
  decimals: number;
  destination: Address;
  tokenProgram?: Address;
  memo?: string;
  programId?: Address;
}): Promise<Instruction> {
  const [vaultPda] = await getVaultPda({ multisigPda, index: vaultIndex, programId });

  const vaultTokenAccount = mint
    ? (await getAssociatedTokenPda({ owner: vaultPda, mint, tokenProgram }))[0]
    : undefined;
  const destinationTokenAccount = mint
    ? (await getAssociatedTokenPda({ owner: destination, mint, tokenProgram }))[0]
    : undefined;

  return getSpendingLimitUseInstruction(
    {
      multisig: multisigPda,
      member: toSigner(member),
      spendingLimit,
      vault: vaultPda,
      destination,
      // Optional in the IDL — required by the program.
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      mint,
      vaultTokenAccount,
      destinationTokenAccount,
      tokenProgram: mint ? tokenProgram : undefined,
      amount,
      decimals,
      memo: memo ?? null,
    },
    { programAddress: programId },
  );
}
