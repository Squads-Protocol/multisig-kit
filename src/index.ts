/**
 * @sqds/multisig-kit: Solana Kit SDK for the Squads Multisig v4 program.
 *
 * Mirrors the public surface of `@sqds/multisig` (namespaced exports plus PDA helpers at the top
 * level), built on `@solana/kit` instead of web3.js v1. Instructions are returned as Kit
 * `Instruction`s; composing, signing and sending the transaction is left to Kit.
 */
import { SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS } from "./generated";

/** Codama-generated low-level client (raw instruction builders, account/type codecs, errors). */
export * as generated from "./generated";
/** Program accounts: `fetchMultisig`, `fetchProposal`, `decodeVaultTransaction`, ... */
export * as accounts from "./generated/accounts";
/** Program errors: `isSquadsMultisigProgramError`, `getSquadsMultisigProgramErrorMessage`, codes. */
export * as errors from "./generated/errors";
/** Program types: `Member`, `ConfigAction`, `Period`, `ProposalStatus`, ... */
export * as types from "./generated/types";
/** PDA derivations (async). */
export * from "./pda";
/** High-level instruction builders (return Kit `Instruction`). */
export * as instructions from "./instructions";
/** Compact `transactionMessage` codecs and types. */
export * as codecs from "./codecs";
/** Message compilation, execution-account and byte/ATA helpers. */
export * as utils from "./utils";
/** Permission / Permissions bitmask helpers. */
export * from "./permissions";
/** Signer-or-address params accepted by the instruction builders. */
export { type AddressOrSigner, toAddress, toSigner } from "./signers";

/** Program address (Kit `Address`). */
export const PROGRAM_ADDRESS = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS;
/** Alias kept for parity with `@sqds/multisig` (`PROGRAM_ID`). */
export const PROGRAM_ID = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS;

/** Decompile a base64 versioned transaction into Kit instructions plus its lookup-table map. */
export { decompileBase64Transaction } from "./decompile-tx";
export type { DecompiledTransaction, AddressesByLookupTableAddress } from "./decompile-tx";
