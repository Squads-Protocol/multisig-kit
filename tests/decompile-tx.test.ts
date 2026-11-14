import { AccountRole, address, type GetMultipleAccountsApi, type Rpc } from "@solana/kit";
import {
  AddressLookupTableAccount,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import { decompileBase64Transaction } from "../src";

const payer = PublicKey.unique();
const recipient = PublicKey.unique();
const lookupTable = new AddressLookupTableAccount({
  key: PublicKey.unique(),
  state: {
    deactivationSlot: (1n << 64n) - 1n,
    lastExtendedSlot: 0,
    lastExtendedSlotStartIndex: 0,
    addresses: [recipient],
  },
});
const transfer = SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 500n });

function encodeTransfer(tables: AddressLookupTableAccount[]) {
  const message = new TransactionMessage({
    payerKey: payer,
    instructions: [transfer],
    recentBlockhash: PublicKey.unique().toBase58(),
  }).compileToV0Message(tables);
  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64");
}

function mockLookupRpc() {
  const send = vi
    .fn()
    .mockRejectedValue(new Error("HTTP 429: too many requests"))
    .mockResolvedValueOnce({
      value: [
        {
          data: {
            parsed: { info: { addresses: [recipient.toBase58()] }, type: "lookupTable" },
            program: "address-lookup-table",
          },
          executable: false,
          lamports: 1n,
          owner: "AddressLookupTab1e1111111111111111111111111",
          space: 88n,
        },
      ],
    });
  const getMultipleAccounts = vi.fn(() => ({ send }));
  return {
    rpc: { getMultipleAccounts } as unknown as Rpc<GetMultipleAccountsApi>,
    getMultipleAccounts,
  };
}

describe("decompileBase64Transaction", () => {
  it("uses one lookup-table request for both the transfer and the returned table map", async () => {
    const { rpc, getMultipleAccounts } = mockLookupRpc();

    const result = await decompileBase64Transaction(encodeTransfer([lookupTable]), rpc);

    expect(getMultipleAccounts).toHaveBeenCalledExactlyOnceWith([lookupTable.key.toBase58()], {
      encoding: "jsonParsed",
    });
    expect(result.lookupTables).toEqual({ [lookupTable.key.toBase58()]: [recipient.toBase58()] });
    expect(result.instructions).toEqual([
      {
        programAddress: address(SystemProgram.programId.toBase58()),
        accounts: [
          { address: address(payer.toBase58()), role: AccountRole.WRITABLE_SIGNER },
          {
            address: address(recipient.toBase58()),
            role: AccountRole.WRITABLE,
            lookupTableAddress: address(lookupTable.key.toBase58()),
            addressIndex: 0,
          },
        ],
        data: new Uint8Array(transfer.data),
      },
    ]);
  });

  it("decompiles a transfer with no lookup tables without an RPC request", async () => {
    const { rpc, getMultipleAccounts } = mockLookupRpc();

    const result = await decompileBase64Transaction(encodeTransfer([]), rpc);

    expect(getMultipleAccounts).not.toHaveBeenCalled();
    expect(result.lookupTables).toEqual({});
    expect(result.instructions[0].accounts?.[1]).toEqual({
      address: address(recipient.toBase58()),
      role: AccountRole.WRITABLE,
    });
  });
});
