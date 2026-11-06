/** Shared test helpers for diffing the Kit SDK against the OG web3.js-based `@sqds/multisig`. */
import type { TransactionInstruction } from "@solana/web3.js";
import { AccountRole, address, type Instruction } from "@solana/kit";
import { expect } from "vitest";

export function web3KeyToRole(isSigner: boolean, isWritable: boolean): AccountRole {
  if (isSigner && isWritable) return AccountRole.WRITABLE_SIGNER;
  if (isSigner) return AccountRole.READONLY_SIGNER;
  if (isWritable) return AccountRole.WRITABLE;
  return AccountRole.READONLY;
}

/** Convert a web3.js v1 instruction into the equivalent Kit `Instruction`. */
export function toKitInstruction(ix: TransactionInstruction): Instruction {
  return {
    programAddress: address(ix.programId.toBase58()),
    accounts: ix.keys.map((k) => ({
      address: address(k.pubkey.toBase58()),
      role: web3KeyToRole(k.isSigner, k.isWritable),
    })),
    data: new Uint8Array(ix.data),
  };
}

/** Assert a Kit instruction matches an OG web3.js instruction: program, data, and account metas in order. */
export function expectIxParity(kit: Instruction, og: TransactionInstruction): void {
  expect(kit.programAddress).toBe(og.programId.toBase58());
  expect(Buffer.from(kit.data ?? new Uint8Array())).toEqual(og.data);

  const kitAccounts = (kit.accounts ?? []).map((a) => ({
    address: a.address as string,
    role: a.role,
  }));
  const ogAccounts = og.keys.map((k) => ({
    address: k.pubkey.toBase58(),
    role: web3KeyToRole(k.isSigner, k.isWritable),
  }));
  expect(kitAccounts).toEqual(ogAccounts);
}
