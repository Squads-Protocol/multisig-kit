/**
 * decompile-tx.ts — Kit-native base64 transaction decompile utility.
 *
 * Exposes `decompileBase64Transaction`, which turns a base64-encoded versioned transaction
 * (for example a swap built by an aggregator) into kit `Instruction[]` and the lookup table
 * address map, ready to wrap in a vault transaction.
 *
 * Pipeline:
 *   1. Decode base64 bytes → kit `Transaction` (messageBytes + signatures).
 *   2. Decode `messageBytes` → `CompiledTransactionMessage` (has `addressTableLookups`).
 *   3. Fetch the address lookup tables once and use the same map to decompile the message and
 *      return the tables to the caller.
 *
 * Invariants:
 *   - No IO beyond what kit provides through the supplied `rpc`.
 *   - No web3.js v1 import — pure `@solana/kit`.
 */

import {
  decompileTransactionMessage,
  fetchAddressesForLookupTables,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import type {
  AddressesByLookupTableAddress,
  GetMultipleAccountsApi,
  Instruction,
  Rpc,
} from "@solana/kit";

export type { AddressesByLookupTableAddress };

/**
 * Return value of `decompileBase64Transaction`.
 *
 * - `instructions`: kit `Instruction[]`; accounts loaded from a lookup table are `AccountLookupMeta`s that
 *   still carry their resolved `address`.
 * - `lookupTables`: mapping of ALT address → ordered `Address[]` for that table.
 */
export interface DecompiledTransaction {
  readonly instructions: readonly Instruction[];
  readonly lookupTables: AddressesByLookupTableAddress;
}

/**
 * Decompile a base64-encoded versioned Solana transaction into kit-native instructions
 * and a lookup table address map.
 *
 * @param base64Tx  Base64-encoded wire transaction bytes (e.g. a swap transaction from an aggregator).
 * @param rpc       A kit RPC client that supports `getMultipleAccounts` — used to resolve
 *                  address lookup table contents, e.g. `createSolanaRpc(rpcUrl)`.
 *
 * @throws On malformed base64, unsupported transaction format, or RPC failure.
 */
export const decompileBase64Transaction = async (
  base64Tx: string,
  rpc: Rpc<GetMultipleAccountsApi>,
): Promise<DecompiledTransaction> => {
  // 1. Decode wire bytes → Transaction { messageBytes, signatures }
  const txBytes = getBase64Encoder().encode(base64Tx);
  const tx = getTransactionDecoder().decode(txBytes);

  // 2. Decode message bytes → CompiledTransactionMessage
  //    For versioned (v0) transactions this includes `addressTableLookups`.
  const compiledMessage = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);

  // 3. Use one snapshot for both the decompiled instructions and the returned lookup tables.
  const altAddresses =
    "addressTableLookups" in compiledMessage && compiledMessage.addressTableLookups != null
      ? compiledMessage.addressTableLookups.map((alt) => alt.lookupTableAddress)
      : [];

  const lookupTables: AddressesByLookupTableAddress =
    altAddresses.length > 0 ? await fetchAddressesForLookupTables(altAddresses, rpc) : {};
  const decompiled = decompileTransactionMessage(compiledMessage, {
    addressesByLookupTableAddress: lookupTables,
  });

  return {
    instructions: decompiled.instructions ?? [],
    lookupTables,
  };
};
