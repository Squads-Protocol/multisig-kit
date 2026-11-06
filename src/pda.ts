/**
 * PDA derivations for the Squads Multisig v4 program.
 *
 * Same function names, same seeds, and same `[address, bump]` tuple shape as the original
 * `@sqds/multisig` SDK. Apart from Kit types (`Address` in place of `PublicKey`), the one API
 * difference: derivations are **async** because Kit's `getProgramDerivedAddress` is async (there is
 * no synchronous PDA helper in `@solana/kit`).
 *
 * Seeds verified against `programs/squads_multisig_program/src/state/seeds.rs` in the v4 repo.
 */
import {
  type Address,
  type ProgramDerivedAddress,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU32Encoder,
  getU64Encoder,
  getU8Encoder,
} from "@solana/kit";

import { SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS } from "./generated";

const SEED_PREFIX = "multisig";
const SEED_PROGRAM_CONFIG = "program_config";
const SEED_MULTISIG = "multisig";
const SEED_VAULT = "vault";
const SEED_TRANSACTION = "transaction";
const SEED_PROPOSAL = "proposal";
const SEED_BATCH_TRANSACTION = "batch_transaction";
const SEED_EPHEMERAL_SIGNER = "ephemeral_signer";
const SEED_SPENDING_LIMIT = "spending_limit";
const SEED_TRANSACTION_BUFFER = "transaction_buffer";

const addressEncoder = getAddressEncoder();
const u8Encoder = getU8Encoder();
const u32Encoder = getU32Encoder();
const u64Encoder = getU64Encoder();

const encodeAddress = (address: Address) => addressEncoder.encode(address);
const encodeU64 = (n: bigint) => u64Encoder.encode(n);

// Bounded integer seed encoders — reject non-integers / out-of-range values up front so callers get
// a clear error instead of a cryptic encoder throw or a silently wrong PDA.
const encodeU8 = (n: number, label: string) => {
  if (!Number.isInteger(n) || n < 0 || n > 0xff) {
    throw new Error(`Invalid ${label}`);
  }
  return u8Encoder.encode(n);
};
const encodeU32 = (n: number, label: string) => {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new Error(`Invalid ${label}`);
  }
  return u32Encoder.encode(n);
};

export function getProgramConfigPda({
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [SEED_PREFIX, SEED_PROGRAM_CONFIG],
  });
}

export function getMultisigPda({
  createKey,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  createKey: Address;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [SEED_PREFIX, SEED_MULTISIG, encodeAddress(createKey)],
  });
}

export function getVaultPda({
  multisigPda,
  /** Authority index. */
  index,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  index: number;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [SEED_PREFIX, encodeAddress(multisigPda), SEED_VAULT, encodeU8(index, "vault index")],
  });
}

export function getEphemeralSignerPda({
  transactionPda,
  ephemeralSignerIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  transactionPda: Address;
  ephemeralSignerIndex: number;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      SEED_PREFIX,
      encodeAddress(transactionPda),
      SEED_EPHEMERAL_SIGNER,
      encodeU8(ephemeralSignerIndex, "ephemeral signer index"),
    ],
  });
}

export function getTransactionPda({
  multisigPda,
  /** Transaction index. */
  index,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  index: bigint;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [SEED_PREFIX, encodeAddress(multisigPda), SEED_TRANSACTION, encodeU64(index)],
  });
}

export function getProposalPda({
  multisigPda,
  /** Transaction index. */
  transactionIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  transactionIndex: bigint;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      SEED_PREFIX,
      encodeAddress(multisigPda),
      SEED_TRANSACTION,
      encodeU64(transactionIndex),
      SEED_PROPOSAL,
    ],
  });
}

export function getBatchTransactionPda({
  multisigPda,
  batchIndex,
  transactionIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  batchIndex: bigint;
  transactionIndex: number;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      SEED_PREFIX,
      encodeAddress(multisigPda),
      SEED_TRANSACTION,
      encodeU64(batchIndex),
      SEED_BATCH_TRANSACTION,
      encodeU32(transactionIndex, "transaction index"),
    ],
  });
}

export function getSpendingLimitPda({
  multisigPda,
  createKey,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  createKey: Address;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [SEED_PREFIX, encodeAddress(multisigPda), SEED_SPENDING_LIMIT, encodeAddress(createKey)],
  });
}

/**
 * Transaction buffer PDA. The original SDK never exposed a wrapper for the buffer flow; seeds are taken
 * from `transaction_buffer_create.rs`:
 * `[SEED_PREFIX, multisig, SEED_TRANSACTION_BUFFER, creator, bufferIndex (u8 LE)]`.
 */
export function getTransactionBufferPda({
  multisigPda,
  creator,
  bufferIndex,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
}: {
  multisigPda: Address;
  creator: Address;
  bufferIndex: number;
  programId?: Address;
}): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      SEED_PREFIX,
      encodeAddress(multisigPda),
      SEED_TRANSACTION_BUFFER,
      encodeAddress(creator),
      encodeU8(bufferIndex, "buffer index"),
    ],
  });
}
