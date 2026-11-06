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
 *   3. `decompileTransactionMessageFetchingLookupTables` resolves ALT accounts via RPC and
 *      returns a `CompilableTransactionMessage`; table-sourced accounts stay `AccountLookupMeta`s
 *      that carry their resolved `address`.
 *   4. Collect ALT addresses from the compiled message; call `fetchAddressesForLookupTables`
 *      to build the `AddressesByLookupTableAddress` map for the caller.
 *
 * Invariants:
 *   - No IO beyond what kit provides through the supplied `rpc`.
 *   - No web3.js v1 import — pure `@solana/kit`.
 */

import {
  decompileTransactionMessageFetchingLookupTables,
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

  // 3. Decompile: kit fetches ALT account data via RPC and resolves every ALT account
  //    reference to its concrete address (kept as an `AccountLookupMeta` with `lookupTableAddress`).
  const decompiled = await decompileTransactionMessageFetchingLookupTables(compiledMessage, rpc);

  // 4. Build the lookup table map from the compiled message's addressTableLookups.
  //    `fetchAddressesForLookupTables` returns Record<Address, Address[]>.
  const altAddresses =
    "addressTableLookups" in compiledMessage && compiledMessage.addressTableLookups != null
      ? compiledMessage.addressTableLookups.map((alt) => alt.lookupTableAddress)
      : [];

  const lookupTables: AddressesByLookupTableAddress =
    altAddresses.length > 0 ? await fetchAddressesForLookupTables(altAddresses, rpc) : {};

  return {
    instructions: decompiled.instructions ?? [],
    lookupTables,
  };
};
