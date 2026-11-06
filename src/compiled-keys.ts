/**
 * Kit port of web3.js `CompiledKeys` + `compileToWrappedMessageV0`, adapted for the "wrapped"
 * VaultTransaction message. Mirrors the original `@sqds/multisig` `utils/compiled-keys.ts` +
 * `utils/compileToWrappedMessageV0.ts`.
 *
 * Key difference from stock web3.js (carried over from `@sqds/multisig`): instruction program IDs
 * are NOT marked as `isInvoked`, so they may be sourced from Address Lookup Tables. This compresses
 * the wrapped message and helps stay under the tx size limit during `vaultTransactionCreate`.
 */
import {
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
  isSignerRole,
  isWritableRole,
} from "@solana/kit";

export type AddressLookupTableAccount = {
  address: Address;
  addresses: readonly Address[];
};

type CompiledKeyMeta = {
  isSigner: boolean;
  isWritable: boolean;
  isInvoked: boolean;
};

type KeyMetaMap = Map<Address, CompiledKeyMeta>;

type MessageHeader = {
  numRequiredSignatures: number;
  numReadonlySignedAccounts: number;
  numReadonlyUnsignedAccounts: number;
};

type CompiledInstruction = {
  programIdIndex: number;
  accountKeyIndexes: number[];
  data: ReadonlyUint8Array;
};

type AddressTableLookup = {
  accountKey: Address;
  writableIndexes: number[];
  readonlyIndexes: number[];
};

export type CompiledWrappedMessage = {
  header: MessageHeader;
  staticAccountKeys: Address[];
  compiledInstructions: CompiledInstruction[];
  addressTableLookups: AddressTableLookup[];
};

class CompiledKeys {
  constructor(
    readonly payer: Address,
    readonly keyMetaMap: KeyMetaMap,
  ) {}

  static compile(instructions: readonly Instruction[], payer: Address): CompiledKeys {
    const keyMetaMap: KeyMetaMap = new Map();
    const getOrInsertDefault = (address: Address): CompiledKeyMeta => {
      let keyMeta = keyMetaMap.get(address);
      if (keyMeta === undefined) {
        keyMeta = { isSigner: false, isWritable: false, isInvoked: false };
        keyMetaMap.set(address, keyMeta);
      }
      return keyMeta;
    };

    const payerKeyMeta = getOrInsertDefault(payer);
    payerKeyMeta.isSigner = true;
    payerKeyMeta.isWritable = true;

    for (const ix of instructions) {
      // Unlike stock web3.js (which sets isInvoked = true here), program IDs are deliberately NOT
      // marked invoked, so they can be sourced from Address Lookup Tables. getOrInsertDefault
      // already initializes isInvoked = false, so this is an insert, not an assignment.
      getOrInsertDefault(ix.programAddress);
      for (const account of ix.accounts ?? []) {
        const keyMeta = getOrInsertDefault(account.address);
        keyMeta.isSigner ||= isSignerRole(account.role);
        keyMeta.isWritable ||= isWritableRole(account.role);
      }
    }

    return new CompiledKeys(payer, keyMetaMap);
  }

  getMessageComponents(): [MessageHeader, Address[]] {
    const mapEntries = [...this.keyMetaMap.entries()];
    if (mapEntries.length > 256) {
      throw new Error("Max static account keys length exceeded");
    }

    const writableSigners = mapEntries.filter(([, m]) => m.isSigner && m.isWritable);
    const readonlySigners = mapEntries.filter(([, m]) => m.isSigner && !m.isWritable);
    const writableNonSigners = mapEntries.filter(([, m]) => !m.isSigner && m.isWritable);
    const readonlyNonSigners = mapEntries.filter(([, m]) => !m.isSigner && !m.isWritable);

    const header: MessageHeader = {
      numRequiredSignatures: writableSigners.length + readonlySigners.length,
      numReadonlySignedAccounts: readonlySigners.length,
      numReadonlyUnsignedAccounts: readonlyNonSigners.length,
    };

    if (writableSigners.length === 0) {
      throw new Error("Expected at least one writable signer key");
    }
    if (writableSigners[0][0] !== this.payer) {
      throw new Error("Expected first writable signer key to be the fee payer");
    }

    const staticAccountKeys = [
      ...writableSigners.map(([address]) => address),
      ...readonlySigners.map(([address]) => address),
      ...writableNonSigners.map(([address]) => address),
      ...readonlyNonSigners.map(([address]) => address),
    ];

    return [header, staticAccountKeys];
  }

  extractTableLookup(
    lookupTable: AddressLookupTableAccount,
  ): [AddressTableLookup, { writable: Address[]; readonly: Address[] }] | undefined {
    const [writableIndexes, drainedWritableKeys] = this.drainKeysFoundInLookupTable(
      lookupTable.addresses,
      (m) => !m.isSigner && !m.isInvoked && m.isWritable,
    );
    const [readonlyIndexes, drainedReadonlyKeys] = this.drainKeysFoundInLookupTable(
      lookupTable.addresses,
      (m) => !m.isSigner && !m.isInvoked && !m.isWritable,
    );

    if (writableIndexes.length === 0 && readonlyIndexes.length === 0) {
      return undefined;
    }

    return [
      { accountKey: lookupTable.address, writableIndexes, readonlyIndexes },
      { writable: drainedWritableKeys, readonly: drainedReadonlyKeys },
    ];
  }

  private drainKeysFoundInLookupTable(
    lookupTableEntries: readonly Address[],
    keyMetaFilter: (keyMeta: CompiledKeyMeta) => boolean,
  ): [number[], Address[]] {
    const lookupTableIndexes: number[] = [];
    const drainedKeys: Address[] = [];

    // Deliberately deletes from `keyMetaMap` mid-iteration — spec-safe for a JS Map (a deleted entry
    // is simply skipped, already-visited entries are unaffected). Ported 1:1 from stock web3.js
    // `CompiledKeys.drainKeysFoundInLookupTable`.
    for (const [address, keyMeta] of this.keyMetaMap.entries()) {
      if (keyMetaFilter(keyMeta)) {
        const lookupTableIndex = lookupTableEntries.findIndex((entry) => entry === address);
        if (lookupTableIndex >= 0) {
          if (lookupTableIndex >= 256) {
            throw new Error("Max lookup table index exceeded");
          }
          lookupTableIndexes.push(lookupTableIndex);
          drainedKeys.push(address);
          this.keyMetaMap.delete(address);
        }
      }
    }

    return [lookupTableIndexes, drainedKeys];
  }
}

/**
 * Compile a set of instructions into the wrapped message components used by a VaultTransaction.
 * The fee payer is the vault PDA. `recentBlockhash` is intentionally absent — it is not part of the
 * serialized wrapped message.
 */
export function compileToWrappedMessage({
  payerKey,
  instructions,
  addressLookupTableAccounts = [],
}: {
  payerKey: Address;
  instructions: readonly Instruction[];
  addressLookupTableAccounts?: readonly AddressLookupTableAccount[];
}): CompiledWrappedMessage {
  const compiledKeys = CompiledKeys.compile(instructions, payerKey);

  const addressTableLookups: AddressTableLookup[] = [];
  const accountKeysFromLookups: { writable: Address[]; readonly: Address[] } = {
    writable: [],
    readonly: [],
  };
  for (const lookupTable of addressLookupTableAccounts) {
    const extractResult = compiledKeys.extractTableLookup(lookupTable);
    if (extractResult !== undefined) {
      const [addressTableLookup, { writable, readonly }] = extractResult;
      addressTableLookups.push(addressTableLookup);
      accountKeysFromLookups.writable.push(...writable);
      accountKeysFromLookups.readonly.push(...readonly);
    }
  }

  const [header, staticAccountKeys] = compiledKeys.getMessageComponents();

  // Ordered key list used to resolve instruction indexes: static keys, then lookup writable, then
  // lookup readonly (matches web3.js MessageAccountKeys.compileInstructions).
  const orderedKeys = [
    ...staticAccountKeys,
    ...accountKeysFromLookups.writable,
    ...accountKeysFromLookups.readonly,
  ];
  const keyIndexMap = new Map(orderedKeys.map((key, index) => [key, index]));
  const findKeyIndex = (key: Address): number => {
    const index = keyIndexMap.get(key);
    if (index === undefined) {
      throw new Error(`Encountered an unknown instruction account ${key}`);
    }
    return index;
  };

  const compiledInstructions: CompiledInstruction[] = instructions.map((ix) => ({
    programIdIndex: findKeyIndex(ix.programAddress),
    accountKeyIndexes: (ix.accounts ?? []).map((account) => findKeyIndex(account.address)),
    data: ix.data ?? new Uint8Array(),
  }));

  return { header, staticAccountKeys, compiledInstructions, addressTableLookups };
}
