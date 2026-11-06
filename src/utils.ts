/**
 * Utilities ported from the original `@sqds/multisig` `utils.ts`, rebuilt on `@solana/kit`.
 */
import {
  type AccountMeta,
  AccountRole,
  type Address,
  type GetAccountInfoApi,
  type Instruction,
  type ProgramDerivedAddress,
  type ReadonlyUint8Array,
  type Rpc,
  address,
  fetchEncodedAccount,
  getAddressDecoder,
  getAddressEncoder,
  getArrayDecoder,
  getProgramDerivedAddress,
  getU32Encoder,
  getU64Encoder,
  getU8Encoder,
} from "@solana/kit";

import {
  type TransactionMessage as MultisigTransactionMessage,
  serializeTransactionMessage,
} from "./codecs";
import { type AddressLookupTableAccount, compileToWrappedMessage } from "./compiled-keys";
import { getEphemeralSignerPda } from "./pda";
import {
  SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  type VaultTransactionMessage,
} from "./generated/index";

export type { AddressLookupTableAccount } from "./compiled-keys";

/** Inner message to wrap into a VaultTransaction. The fee payer is the vault PDA. */
export type TransactionMessage = {
  payerKey: Address;
  instructions: readonly Instruction[];
};

export const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");
export const TOKEN_PROGRAM_ADDRESS = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/** Associated Token Account PDA derivation: seeds `[owner, tokenProgram, mint]`. */
export function getAssociatedTokenPda({
  owner,
  mint,
  tokenProgram = TOKEN_PROGRAM_ADDRESS,
}: {
  owner: Address;
  mint: Address;
  tokenProgram?: Address;
}): Promise<ProgramDerivedAddress> {
  const encode = getAddressEncoder();
  return getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [encode.encode(owner), encode.encode(tokenProgram), encode.encode(mint)],
  });
}

export function toUtfBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function toU8Bytes(num: number): ReadonlyUint8Array {
  return getU8Encoder().encode(num);
}

export function toU32Bytes(num: number): ReadonlyUint8Array {
  return getU32Encoder().encode(num);
}

export function toU64Bytes(num: bigint): ReadonlyUint8Array {
  return getU64Encoder().encode(num);
}

export function toBigInt(value: number | bigint): bigint {
  return BigInt(value);
}

export function isStaticWritableIndex(
  message: Pick<
    VaultTransactionMessage,
    "accountKeys" | "numSigners" | "numWritableSigners" | "numWritableNonSigners"
  >,
  index: number,
): boolean {
  const numAccountKeys = message.accountKeys.length;
  const { numSigners, numWritableSigners, numWritableNonSigners } = message;

  if (index >= numAccountKeys) {
    return false;
  }
  if (index < numWritableSigners) {
    return true;
  }
  if (index >= numSigners) {
    const indexIntoNonSigners = index - numSigners;
    return indexIntoNonSigners < numWritableNonSigners;
  }
  return false;
}

export function isSignerIndex(
  message: Pick<VaultTransactionMessage, "numSigners">,
  index: number,
): boolean {
  return index < message.numSigners;
}

/** Custom serialization for `transaction_message` that ensures the smallest possible byte size. */
export function transactionMessageToMultisigTransactionMessageBytes({
  message,
  addressLookupTableAccounts,
}: {
  message: TransactionMessage;
  addressLookupTableAccounts?: readonly AddressLookupTableAccount[];
}): ReadonlyUint8Array {
  const compiledMessage = compileToWrappedMessage({
    payerKey: message.payerKey,
    instructions: message.instructions,
    addressLookupTableAccounts,
  });

  const serializable: MultisigTransactionMessage = {
    numSigners: compiledMessage.header.numRequiredSignatures,
    numWritableSigners:
      compiledMessage.header.numRequiredSignatures -
      compiledMessage.header.numReadonlySignedAccounts,
    numWritableNonSigners:
      compiledMessage.staticAccountKeys.length -
      compiledMessage.header.numRequiredSignatures -
      compiledMessage.header.numReadonlyUnsignedAccounts,
    accountKeys: compiledMessage.staticAccountKeys,
    instructions: compiledMessage.compiledInstructions.map((ix) => ({
      programIdIndex: ix.programIdIndex,
      accountIndexes: ix.accountKeyIndexes,
      data: Array.from(ix.data),
    })),
    addressTableLookups: compiledMessage.addressTableLookups,
  };

  return serializeTransactionMessage(serializable);
}

// Byte offset where an Address Lookup Table's address list begins: the fixed-size meta is
// typeIndex(4) + deactivationSlot(8) + lastExtendedSlot(8) + lastExtendedSlotStartIndex(1) +
// authority Option<Pubkey>(1 + 32) + padding(2) = 56 bytes. Matches web3.js LOOKUP_TABLE_META_SIZE.
const ADDRESS_LOOKUP_TABLE_META_SIZE = 56;

/** Kit RPC surface needed to resolve address lookup tables / fetch accounts. */
export type AccountFetcher = Rpc<GetAccountInfoApi>;

async function fetchAddressLookupTable(
  rpc: AccountFetcher,
  lookupTableAddress: Address,
): Promise<AddressLookupTableAccount> {
  const account = await fetchEncodedAccount(rpc, lookupTableAddress);
  if (!account.exists) {
    throw new Error(`Address lookup table account ${lookupTableAddress} not found`);
  }
  const addressesBytes = account.data.slice(ADDRESS_LOOKUP_TABLE_META_SIZE);
  const addresses = getArrayDecoder(getAddressDecoder(), { size: "remainder" }).decode(
    addressesBytes,
  );
  return { address: lookupTableAddress, addresses };
}

function toRole(isSigner: boolean, isWritable: boolean): AccountRole {
  if (isSigner && isWritable) return AccountRole.WRITABLE_SIGNER;
  if (isSigner) return AccountRole.READONLY_SIGNER;
  if (isWritable) return AccountRole.WRITABLE;
  return AccountRole.READONLY;
}

/**
 * Populate the remaining accounts required to execute a VaultTransaction. Kit port of the original
 * `accountsForTransactionExecute`; takes a Kit RPC instead of a web3.js `Connection`.
 */
export async function accountsForTransactionExecute({
  rpc,
  transactionPda,
  vaultPda,
  message,
  ephemeralSignerBumps,
  programId = SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
  addressLookupTableAccounts: localAddressLookupTableAccounts,
}: {
  rpc: AccountFetcher;
  message: VaultTransactionMessage;
  ephemeralSignerBumps: number[] | Uint8Array | ReadonlyUint8Array;
  vaultPda: Address;
  transactionPda: Address;
  programId?: Address;
  addressLookupTableAccounts?: readonly AddressLookupTableAccount[];
}): Promise<{ accountMetas: AccountMeta[]; lookupTableAccounts: AddressLookupTableAccount[] }> {
  const ephemeralSignerPdas = await Promise.all(
    Array.from(ephemeralSignerBumps).map((_, ephemeralSignerIndex) =>
      getEphemeralSignerPda({ transactionPda, ephemeralSignerIndex, programId }).then(
        ([pda]) => pda,
      ),
    ),
  );

  const addressLookupTableKeys = message.addressTableLookups.map(({ accountKey }) => accountKey);
  const addressLookupTableAccounts = new Map(
    await Promise.all(
      addressLookupTableKeys.map(async (key) => {
        const local = localAddressLookupTableAccounts?.find((a) => a.address === key);
        if (local) {
          return [key, local] as const;
        }
        return [key, await fetchAddressLookupTable(rpc, key)] as const;
      }),
    ),
  );

  const accountMetas: AccountMeta[] = [];
  // Lookup table accounts themselves are needed for on-chain validation.
  for (const key of addressLookupTableKeys) {
    accountMetas.push({ address: key, role: AccountRole.READONLY });
  }
  // Static account keys.
  message.accountKeys.forEach((accountKey, accountIndex) => {
    const isSigner =
      isSignerIndex(message, accountIndex) &&
      accountKey !== vaultPda &&
      !ephemeralSignerPdas.includes(accountKey);
    accountMetas.push({
      address: accountKey,
      role: toRole(isSigner, isStaticWritableIndex(message, accountIndex)),
    });
  });
  // Accounts loaded from lookup tables.
  for (const lookup of message.addressTableLookups) {
    const lookupTableAccount = addressLookupTableAccounts.get(lookup.accountKey);
    if (!lookupTableAccount) {
      throw new Error(`Address lookup table account ${lookup.accountKey} not found`);
    }
    for (const accountIndex of lookup.writableIndexes) {
      const address = lookupTableAccount.addresses[accountIndex];
      if (!address) {
        throw new Error(
          `Address lookup table ${lookup.accountKey} has no address at index ${accountIndex}`,
        );
      }
      accountMetas.push({ address, role: AccountRole.WRITABLE });
    }
    for (const accountIndex of lookup.readonlyIndexes) {
      const address = lookupTableAccount.addresses[accountIndex];
      if (!address) {
        throw new Error(
          `Address lookup table ${lookup.accountKey} has no address at index ${accountIndex}`,
        );
      }
      accountMetas.push({ address, role: AccountRole.READONLY });
    }
  }

  return { accountMetas, lookupTableAccounts: [...addressLookupTableAccounts.values()] };
}
