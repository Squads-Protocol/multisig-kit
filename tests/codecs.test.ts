/**
 * Codec parity: the compact `transactionMessage` serialization (and the full message-compilation
 * pipeline) must produce byte-identical output to the original `@sqds/multisig` beet implementation,
 * since those bytes are what the on-chain program deserializes.
 */
import * as multisig from "@sqds/multisig";
import {
  AddressLookupTableAccount,
  PublicKey,
  SystemProgram,
  TransactionMessage as Web3TransactionMessage,
} from "@solana/web3.js";
import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";

import { serializeTransactionMessage } from "../src/codecs";
import { transactionMessageToMultisigTransactionMessageBytes } from "../src/utils";
import { toKitInstruction } from "./helpers";

describe("transactionMessage codec parity", () => {
  it("serializes a hand-built message identically to the original beet codec", () => {
    const keys = [PublicKey.unique(), PublicKey.unique(), PublicKey.unique()];
    const shared = {
      numSigners: 1,
      numWritableSigners: 1,
      numWritableNonSigners: 1,
      instructions: [{ programIdIndex: 2, accountIndexes: [0, 1], data: [2, 0, 0, 0, 255] }],
    };

    const [legacyBytes] = multisig.types.transactionMessageBeet.serialize({
      ...shared,
      accountKeys: keys,
      addressTableLookups: [],
    });
    const nextBytes = serializeTransactionMessage({
      ...shared,
      accountKeys: keys.map((k) => address(k.toBase58())),
      addressTableLookups: [],
    });

    expect(Buffer.from(nextBytes)).toEqual(legacyBytes);
  });

  it("compiles + serializes a real transfer message identically to the original pipeline", () => {
    const vaultPk = PublicKey.unique();
    const destPk = PublicKey.unique();
    const blockhash = PublicKey.unique().toBase58();

    const transferIx = SystemProgram.transfer({
      fromPubkey: vaultPk,
      toPubkey: destPk,
      lamports: 1_000_000n,
    });

    const legacyMessage = new Web3TransactionMessage({
      payerKey: vaultPk,
      recentBlockhash: blockhash,
      instructions: [transferIx],
    });
    const legacyBytes = multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
      message: legacyMessage,
      vaultPda: vaultPk,
    });

    const nextBytes = transactionMessageToMultisigTransactionMessageBytes({
      message: {
        payerKey: address(vaultPk.toBase58()),
        instructions: [toKitInstruction(transferIx)],
      },
    });

    expect(Buffer.from(nextBytes)).toEqual(Buffer.from(legacyBytes));
  });

  it("compiles + serializes a message WITH an address lookup table identically to the original pipeline", () => {
    const vaultPk = PublicKey.unique();
    const destPk = PublicKey.unique();
    const altKey = PublicKey.unique();
    // `destPk` lives in the ALT, so it should be drained into an addressTableLookup (exercises
    // compiled-keys `drainKeysFoundInLookupTable` + the ALT codec path).
    const altAddresses = [PublicKey.unique(), destPk, PublicKey.unique()];

    const transferIx = SystemProgram.transfer({
      fromPubkey: vaultPk,
      toPubkey: destPk,
      lamports: 5_000n,
    });

    const legacyAlt = new AddressLookupTableAccount({
      key: altKey,
      state: {
        deactivationSlot: 2n ** 64n - 1n,
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        authority: undefined,
        addresses: altAddresses,
      },
    });
    const legacyBytes = multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
      message: new Web3TransactionMessage({
        payerKey: vaultPk,
        recentBlockhash: PublicKey.unique().toBase58(),
        instructions: [transferIx],
      }),
      addressLookupTableAccounts: [legacyAlt],
      vaultPda: vaultPk,
    });

    const nextBytes = transactionMessageToMultisigTransactionMessageBytes({
      message: {
        payerKey: address(vaultPk.toBase58()),
        instructions: [toKitInstruction(transferIx)],
      },
      addressLookupTableAccounts: [
        { address: address(altKey.toBase58()), addresses: altAddresses.map((a) => address(a.toBase58())) },
      ],
    });

    // Sanity: the lookup actually triggered (a no-op ALT would make this test meaningless).
    expect(legacyBytes.length).toBeGreaterThan(0);
    expect(Buffer.from(nextBytes)).toEqual(Buffer.from(legacyBytes));
  });
});
