/**
 * PDA parity: every derivation must match the OG `@sqds/multisig` SDK byte-for-byte (address + bump)
 * — same seeds, same derivations.
 */
import * as multisig from "@sqds/multisig";
import { PublicKey } from "@solana/web3.js";
import { address } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  getBatchTransactionPda,
  getEphemeralSignerPda,
  getMultisigPda,
  getProgramConfigPda,
  getProposalPda,
  getSpendingLimitPda,
  getTransactionBufferPda,
  getTransactionPda,
  getVaultPda,
} from "../src/pda";

const createKeyPk = PublicKey.unique();
const multisigPk = PublicKey.unique();
const transactionPk = PublicKey.unique();
const createKey = address(createKeyPk.toBase58());
const multisigPda = address(multisigPk.toBase58());
const transactionPda = address(transactionPk.toBase58());

const expectMatch = async (
  og: [PublicKey, number],
  next: Promise<readonly [string, number]>,
) => {
  const [nextAddress, nextBump] = await next;
  expect(nextAddress).toBe(og[0].toBase58());
  expect(nextBump).toBe(og[1]);
};

describe("PDA parity with @sqds/multisig", () => {
  it("getProgramConfigPda", async () => {
    await expectMatch(multisig.getProgramConfigPda({}), getProgramConfigPda({}));
  });

  it("getMultisigPda", async () => {
    await expectMatch(
      multisig.getMultisigPda({ createKey: createKeyPk }),
      getMultisigPda({ createKey }),
    );
  });

  it("getVaultPda (index 0 and 5)", async () => {
    await expectMatch(
      multisig.getVaultPda({ multisigPda: multisigPk, index: 0 }),
      getVaultPda({ multisigPda, index: 0 }),
    );
    await expectMatch(
      multisig.getVaultPda({ multisigPda: multisigPk, index: 5 }),
      getVaultPda({ multisigPda, index: 5 }),
    );
  });

  it("getTransactionPda", async () => {
    await expectMatch(
      multisig.getTransactionPda({ multisigPda: multisigPk, index: 42n }),
      getTransactionPda({ multisigPda, index: 42n }),
    );
  });

  it("getProposalPda", async () => {
    await expectMatch(
      multisig.getProposalPda({ multisigPda: multisigPk, transactionIndex: 42n }),
      getProposalPda({ multisigPda, transactionIndex: 42n }),
    );
  });

  it("getEphemeralSignerPda", async () => {
    await expectMatch(
      multisig.getEphemeralSignerPda({ transactionPda: transactionPk, ephemeralSignerIndex: 1 }),
      getEphemeralSignerPda({ transactionPda, ephemeralSignerIndex: 1 }),
    );
  });

  it("getBatchTransactionPda", async () => {
    await expectMatch(
      multisig.getBatchTransactionPda({
        multisigPda: multisigPk,
        batchIndex: 3n,
        transactionIndex: 7,
      }),
      getBatchTransactionPda({ multisigPda, batchIndex: 3n, transactionIndex: 7 }),
    );
  });

  it("getSpendingLimitPda", async () => {
    await expectMatch(
      multisig.getSpendingLimitPda({ multisigPda: multisigPk, createKey: createKeyPk }),
      getSpendingLimitPda({ multisigPda, createKey }),
    );
  });

  // Bounded-integer seed guards (the derivation throws synchronously while building the seeds).
  it.each([256, -1, 1.5])("getVaultPda rejects invalid index %s", (index) => {
    expect(() => getVaultPda({ multisigPda, index })).toThrow(/vault index/);
  });

  it.each([256, -1, 1.5])("getTransactionBufferPda rejects invalid bufferIndex %s", (bufferIndex) => {
    expect(() => getTransactionBufferPda({ multisigPda, creator: createKey, bufferIndex })).toThrow(
      /buffer index/,
    );
  });

  // No OG wrapper exists for the buffer PDA, so derive the expected value independently with
  // web3.js's findProgramAddressSync using the seeds from transaction_buffer_create.rs.
  it("getTransactionBufferPda (vs independent web3.js derivation)", async () => {
    const bufferIndex = 0;
    const expected = PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPk.toBytes(),
        Buffer.from("transaction_buffer"),
        createKeyPk.toBytes(),
        Buffer.from([bufferIndex]),
      ],
      multisig.PROGRAM_ID,
    );
    await expectMatch(
      expected,
      getTransactionBufferPda({ multisigPda, creator: createKey, bufferIndex }),
    );
  });
});
