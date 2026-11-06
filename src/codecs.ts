/**
 * Compact "small array" serialization for the wrapped `transaction_message` stored on a
 * VaultTransaction.
 *
 * The on-chain program decodes this message with Rust `SmallVec<u8, _>` / `SmallVec<u16, _>`
 * length prefixes (NOT the standard u32-prefixed Borsh vec). The Codama-generated
 * `VaultTransactionMessage` codec uses default u32-prefixed arrays, so it CANNOT be used here.
 * This module mirrors the OG `@sqds/multisig` `transactionMessageBeet` byte-for-byte, ported to
 * `@solana/kit` codecs.
 */
import {
  type Address,
  type Decoder,
  type Encoder,
  type ReadonlyUint8Array,
  getAddressDecoder,
  getAddressEncoder,
  getArrayDecoder,
  getArrayEncoder,
  getStructDecoder,
  getStructEncoder,
  getU16Decoder,
  getU16Encoder,
  getU8Decoder,
  getU8Encoder,
} from "@solana/kit";

// NOTE: arrays are intentionally mutable, not `readonly` — `@solana/kit`'s array encoders take a
// mutable `T[]` as input, so `readonly` fields produce a contravariance error at the encoder
// boundary. These types are used as both encode-input and decode-output, so they follow Kit.
export type CompiledMsInstruction = {
  programIdIndex: number;
  accountIndexes: number[];
  data: number[];
};

export type MessageAddressTableLookup = {
  /** Address lookup table account key. */
  accountKey: Address;
  /** List of indexes used to load writable account addresses. */
  writableIndexes: number[];
  /** List of indexes used to load readonly account addresses. */
  readonlyIndexes: number[];
};

export type TransactionMessage = {
  numSigners: number;
  numWritableSigners: number;
  numWritableNonSigners: number;
  accountKeys: Address[];
  instructions: CompiledMsInstruction[];
  addressTableLookups: MessageAddressTableLookup[];
};

// `accountIndexes` is a u8-length-prefixed array of u8 (OG: smallArray(u8, u8)).
const u8PrefixedU8ArrayEncoder = (): Encoder<number[]> =>
  getArrayEncoder(getU8Encoder(), { size: getU8Encoder() });
const u8PrefixedU8ArrayDecoder = (): Decoder<number[]> =>
  getArrayDecoder(getU8Decoder(), { size: getU8Decoder() });

const compiledMsInstructionEncoder: Encoder<CompiledMsInstruction> = getStructEncoder([
  ["programIdIndex", getU8Encoder()],
  ["accountIndexes", u8PrefixedU8ArrayEncoder()],
  // `data` is a u16-length-prefixed array of u8 (OG: smallArray(u16, u8)).
  ["data", getArrayEncoder(getU8Encoder(), { size: getU16Encoder() })],
]);
const compiledMsInstructionDecoder: Decoder<CompiledMsInstruction> = getStructDecoder([
  ["programIdIndex", getU8Decoder()],
  ["accountIndexes", u8PrefixedU8ArrayDecoder()],
  ["data", getArrayDecoder(getU8Decoder(), { size: getU16Decoder() })],
]);

const messageAddressTableLookupEncoder: Encoder<MessageAddressTableLookup> = getStructEncoder([
  ["accountKey", getAddressEncoder()],
  ["writableIndexes", u8PrefixedU8ArrayEncoder()],
  ["readonlyIndexes", u8PrefixedU8ArrayEncoder()],
]);
const messageAddressTableLookupDecoder: Decoder<MessageAddressTableLookup> = getStructDecoder([
  ["accountKey", getAddressDecoder()],
  ["writableIndexes", u8PrefixedU8ArrayDecoder()],
  ["readonlyIndexes", u8PrefixedU8ArrayDecoder()],
]);

export const getTransactionMessageEncoder = (): Encoder<TransactionMessage> =>
  getStructEncoder([
    ["numSigners", getU8Encoder()],
    ["numWritableSigners", getU8Encoder()],
    ["numWritableNonSigners", getU8Encoder()],
    ["accountKeys", getArrayEncoder(getAddressEncoder(), { size: getU8Encoder() })],
    ["instructions", getArrayEncoder(compiledMsInstructionEncoder, { size: getU8Encoder() })],
    [
      "addressTableLookups",
      getArrayEncoder(messageAddressTableLookupEncoder, { size: getU8Encoder() }),
    ],
  ]);

export const getTransactionMessageDecoder = (): Decoder<TransactionMessage> =>
  getStructDecoder([
    ["numSigners", getU8Decoder()],
    ["numWritableSigners", getU8Decoder()],
    ["numWritableNonSigners", getU8Decoder()],
    ["accountKeys", getArrayDecoder(getAddressDecoder(), { size: getU8Decoder() })],
    ["instructions", getArrayDecoder(compiledMsInstructionDecoder, { size: getU8Decoder() })],
    [
      "addressTableLookups",
      getArrayDecoder(messageAddressTableLookupDecoder, { size: getU8Decoder() }),
    ],
  ]);

/** Serialize a wrapped transaction message to its compact on-chain byte representation. */
export const serializeTransactionMessage = (message: TransactionMessage): ReadonlyUint8Array =>
  getTransactionMessageEncoder().encode(message);
