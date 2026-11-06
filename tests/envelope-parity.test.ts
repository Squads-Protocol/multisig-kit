/**
 * Envelope parity for realistic vault transactions.
 *
 * instructions.test.ts proves each builder on its simplest input. Real
 * proposals are not simple: swaps and stake flows wrap several instructions
 * that share accounts, reach some of them through address lookup tables, and
 * need ephemeral signers. The inner message is stored on-chain and hashed for
 * the Ledger display, so the Kit builders must produce the same bytes as
 * @sqds/multisig for every one of those shapes.
 *
 * The lookup table deliberately holds the invoked program id: @sqds/multisig
 * never moves an invoked program into a lookup (its `isInvoked = false` fork),
 * and the Kit compiler must match that rather than Kit's own rule.
 */
import * as multisig from "@sqds/multisig";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  AddressLookupTableAccount as Web3LookupTable,
  TransactionMessage as Web3TransactionMessage,
} from "@solana/web3.js";
import { type Address, address } from "@solana/kit";
import { describe, expect, it } from "vitest";

import { getTransactionMessageDecoder } from "../src/codecs";
import {
  type ConfigActionArgs,
  Period,
  type VaultTransactionMessageArgs,
  getBatchEncoder,
  getVaultBatchTransactionEncoder,
  getVaultTransactionEncoder,
} from "../src/generated";
import * as ix from "../src/instructions";
import { Permissions } from "../src/permissions";
import * as utils from "../src/utils";
import { expectIxParity, toKitInstruction } from "./helpers";

const kit = (pk: PublicKey): Address => address(pk.toBase58());

const createKeyPk = PublicKey.unique();
const memberPk = PublicKey.unique();
const rentPayerPk = PublicKey.unique();
const [multisigPk] = multisig.getMultisigPda({ createKey: createKeyPk });
const vaultIndex = 1;
const [vaultPk] = multisig.getVaultPda({ multisigPda: multisigPk, index: vaultIndex });
const transactionIndex = 7n;
const [transactionPk] = multisig.getTransactionPda({
  multisigPda: multisigPk,
  index: transactionIndex,
});
const [ephemeralSignerPk] = multisig.getEphemeralSignerPda({
  transactionPda: transactionPk,
  ephemeralSignerIndex: 0,
});

const programInTablePk = PublicKey.unique();
const sharedWritablePk = PublicKey.unique();
const tableReadonlyPk = PublicKey.unique();
const tableWritablePk = PublicKey.unique();
const secondTableAccountPk = PublicKey.unique();
const firstTablePk = PublicKey.unique();
const secondTablePk = PublicKey.unique();

const web3Table = (key: PublicKey, addresses: PublicKey[]): Web3LookupTable =>
  new Web3LookupTable({
    key,
    state: {
      deactivationSlot: BigInt("18446744073709551615"),
      lastExtendedSlot: 0,
      lastExtendedSlotStartIndex: 0,
      addresses,
    },
  });

const web3Tables = [
  web3Table(firstTablePk, [programInTablePk, tableReadonlyPk, tableWritablePk, sharedWritablePk]),
  web3Table(secondTablePk, [secondTableAccountPk]),
];
const kitTables = web3Tables.map((table) => ({
  address: kit(table.key),
  addresses: table.state.addresses.map(kit),
}));

/**
 * A transfer plus a program call that reuses the transfer's destination,
 * reads and writes through both lookup tables, and is signed by the
 * transaction's first ephemeral signer.
 */
const innerInstructions = (): TransactionInstruction[] => [
  SystemProgram.transfer({ fromPubkey: vaultPk, toPubkey: sharedWritablePk, lamports: 5_000n }),
  new TransactionInstruction({
    programId: programInTablePk,
    keys: [
      { pubkey: vaultPk, isSigner: true, isWritable: true },
      { pubkey: ephemeralSignerPk, isSigner: true, isWritable: true },
      { pubkey: sharedWritablePk, isSigner: false, isWritable: true },
      { pubkey: tableWritablePk, isSigner: false, isWritable: true },
      { pubkey: tableReadonlyPk, isSigner: false, isWritable: false },
      { pubkey: secondTableAccountPk, isSigner: false, isWritable: false },
      { pubkey: tableReadonlyPk, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([9, 8, 7, 6]),
  }),
];

const web3Message = (): Web3TransactionMessage =>
  new Web3TransactionMessage({
    payerKey: vaultPk,
    recentBlockhash: PublicKey.unique().toBase58(),
    instructions: innerInstructions(),
  });

const kitMessage = () => ({
  payerKey: kit(vaultPk),
  instructions: innerInstructions().map(toKitInstruction),
});

describe("vault envelope parity: realistic shapes", () => {
  it("vaultTransactionCreate with lookup tables, an ephemeral signer, shared accounts and a memo", async () => {
    expectIxParity(
      await ix.vaultTransactionCreate({
        multisigPda: kit(multisigPk),
        transactionIndex,
        creator: kit(memberPk),
        rentPayer: kit(rentPayerPk),
        vaultIndex,
        ephemeralSigners: 1,
        transactionMessage: kitMessage(),
        addressLookupTableAccounts: kitTables,
        memo: "swap 1 SOL → USDC",
      }),
      multisig.instructions.vaultTransactionCreate({
        multisigPda: multisigPk,
        transactionIndex,
        creator: memberPk,
        rentPayer: rentPayerPk,
        vaultIndex,
        ephemeralSigners: 1,
        transactionMessage: web3Message(),
        addressLookupTableAccounts: web3Tables,
        memo: "swap 1 SOL → USDC",
      }),
    );
  });

  it("vaultTransactionCreate with the same message and no lookup tables", async () => {
    expectIxParity(
      await ix.vaultTransactionCreate({
        multisigPda: kit(multisigPk),
        transactionIndex,
        creator: kit(memberPk),
        vaultIndex,
        ephemeralSigners: 1,
        transactionMessage: kitMessage(),
      }),
      multisig.instructions.vaultTransactionCreate({
        multisigPda: multisigPk,
        transactionIndex,
        creator: memberPk,
        vaultIndex,
        ephemeralSigners: 1,
        transactionMessage: web3Message(),
      }),
    );
  });

  it("batchAddTransaction with lookup tables and an ephemeral signer", async () => {
    expectIxParity(
      await ix.batchAddTransaction({
        multisigPda: kit(multisigPk),
        member: kit(memberPk),
        rentPayer: kit(rentPayerPk),
        batchIndex: transactionIndex,
        transactionIndex: 3,
        vaultIndex,
        ephemeralSigners: 1,
        transactionMessage: kitMessage(),
        addressLookupTableAccounts: kitTables,
      }),
      multisig.instructions.batchAddTransaction({
        multisigPda: multisigPk,
        member: memberPk,
        rentPayer: rentPayerPk,
        batchIndex: transactionIndex,
        transactionIndex: 3,
        vaultIndex,
        ephemeralSigners: 1,
        transactionMessage: web3Message(),
        addressLookupTableAccounts: web3Tables,
      }),
    );
  });
});

describe("config envelope parity: every config action", () => {
  const otherPk = PublicKey.unique();
  const mintPk = PublicKey.unique();
  const spendingLimitPk = PublicKey.unique();

  const cases: ReadonlyArray<readonly [string, ConfigActionArgs, multisig.generated.ConfigAction]> =
    [
      [
        "AddMember",
        { __kind: "AddMember", newMember: { key: kit(otherPk), permissions: Permissions.all() } },
        {
          __kind: "AddMember",
          newMember: { key: otherPk, permissions: multisig.types.Permissions.all() },
        },
      ],
      [
        "RemoveMember",
        { __kind: "RemoveMember", oldMember: kit(otherPk) },
        { __kind: "RemoveMember", oldMember: otherPk },
      ],
      [
        "ChangeThreshold",
        { __kind: "ChangeThreshold", newThreshold: 3 },
        { __kind: "ChangeThreshold", newThreshold: 3 },
      ],
      [
        "SetTimeLock",
        { __kind: "SetTimeLock", newTimeLock: 86_400 },
        { __kind: "SetTimeLock", newTimeLock: 86_400 },
      ],
      [
        "AddSpendingLimit",
        {
          __kind: "AddSpendingLimit",
          createKey: kit(createKeyPk),
          vaultIndex,
          mint: kit(mintPk),
          amount: 1_000_000n,
          period: Period.Week,
          members: [kit(memberPk), kit(otherPk)],
          destinations: [kit(rentPayerPk)],
        },
        {
          __kind: "AddSpendingLimit",
          createKey: createKeyPk,
          vaultIndex,
          mint: mintPk,
          amount: 1_000_000,
          period: multisig.types.Period.Week,
          members: [memberPk, otherPk],
          destinations: [rentPayerPk],
        },
      ],
      [
        "RemoveSpendingLimit",
        { __kind: "RemoveSpendingLimit", spendingLimit: kit(spendingLimitPk) },
        { __kind: "RemoveSpendingLimit", spendingLimit: spendingLimitPk },
      ],
      [
        "SetRentCollector to an address",
        { __kind: "SetRentCollector", newRentCollector: kit(otherPk) },
        { __kind: "SetRentCollector", newRentCollector: otherPk },
      ],
      [
        "SetRentCollector to none",
        { __kind: "SetRentCollector", newRentCollector: null },
        { __kind: "SetRentCollector", newRentCollector: null },
      ],
    ];

  it.each(cases)("configTransactionCreate with %s", async (_name, kitAction, web3Action) => {
    expectIxParity(
      await ix.configTransactionCreate({
        multisigPda: kit(multisigPk),
        transactionIndex,
        creator: kit(memberPk),
        rentPayer: kit(rentPayerPk),
        actions: [kitAction],
        memo: "config",
      }),
      multisig.instructions.configTransactionCreate({
        multisigPda: multisigPk,
        transactionIndex,
        creator: memberPk,
        rentPayer: rentPayerPk,
        actions: [web3Action],
        memo: "config",
      }),
    );
  });

  it("configTransactionCreate with every action in one proposal", async () => {
    expectIxParity(
      await ix.configTransactionCreate({
        multisigPda: kit(multisigPk),
        transactionIndex,
        creator: kit(memberPk),
        actions: cases.map(([, kitAction]) => kitAction),
      }),
      multisig.instructions.configTransactionCreate({
        multisigPda: multisigPk,
        transactionIndex,
        creator: memberPk,
        actions: cases.map(([, , web3Action]) => web3Action),
      }),
    );
  });
});

/**
 * Execute parity. Both SDKs read the on-chain transaction and its lookup
 * tables, then expand the stored message into the execute instruction's
 * remaining accounts. Each side gets a fake RPC serving the same bytes: the
 * transaction account encoded once, and the lookup table contents.
 */
describe("execute parity: stored message with lookup tables and an ephemeral signer", () => {
  const PROGRAM = kit(multisig.PROGRAM_ID);

  const storedMessage = (): VaultTransactionMessageArgs => {
    const wire = getTransactionMessageDecoder().decode(
      utils.transactionMessageToMultisigTransactionMessageBytes({
        message: kitMessage(),
        addressLookupTableAccounts: kitTables,
      }),
    );
    return {
      ...wire,
      instructions: wire.instructions.map((instruction) => ({
        programIdIndex: instruction.programIdIndex,
        accountIndexes: new Uint8Array(instruction.accountIndexes),
        data: new Uint8Array(instruction.data),
      })),
      addressTableLookups: wire.addressTableLookups.map((lookup) => ({
        accountKey: lookup.accountKey,
        writableIndexes: new Uint8Array(lookup.writableIndexes),
        readonlyIndexes: new Uint8Array(lookup.readonlyIndexes),
      })),
    };
  };

  const ephemeralSignerBumps = (): Uint8Array => {
    const [, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        transactionPk.toBuffer(),
        Buffer.from("ephemeral_signer"),
        Buffer.from([0]),
      ],
      multisig.PROGRAM_ID,
    );
    return new Uint8Array([bump]);
  };

  type Accounts = ReadonlyMap<string, Uint8Array>;

  /** Address lookup table account: the 56-byte header (type 1, never deactivated), then addresses. */
  const lookupTableData = (table: Web3LookupTable): Uint8Array => {
    const header = Buffer.alloc(56);
    header.writeUInt32LE(1, 0);
    header.writeBigUInt64LE(BigInt("18446744073709551615"), 4);
    return new Uint8Array(
      Buffer.concat([header, ...table.state.addresses.map((a) => a.toBuffer())]),
    );
  };

  const withTables = (entries: ReadonlyArray<readonly [string, Uint8Array]>): Accounts =>
    new Map([
      ...entries,
      ...web3Tables.map((table) => [table.key.toBase58(), lookupTableData(table)] as const),
    ]);

  const kitRpc = (accounts: Accounts) =>
    ({
      getAccountInfo: (target: Address) => ({
        send: async () => {
          const data = accounts.get(target);
          return {
            context: { slot: 0n },
            value: data
              ? {
                  data: [Buffer.from(data).toString("base64"), "base64"],
                  executable: false,
                  lamports: 1n,
                  owner: PROGRAM,
                  space: BigInt(data.length),
                  rentEpoch: 0n,
                }
              : null,
          };
        },
      }),
    }) as unknown as utils.AccountFetcher;

  const web3Connection = (accounts: Accounts) =>
    ({
      getAccountInfo: async (target: PublicKey) => {
        const data = accounts.get(target.toBase58());
        return data
          ? { data: Buffer.from(data), executable: false, lamports: 1, owner: multisig.PROGRAM_ID }
          : null;
      },
      getAddressLookupTable: async (target: PublicKey) => ({
        context: { slot: 0 },
        value: web3Tables.find((table) => table.key.equals(target)) ?? null,
      }),
    }) as never;

  const expectLookupParity = (
    kitTablesUsed: readonly { address: Address; addresses: readonly Address[] }[],
    web3TablesUsed: readonly Web3LookupTable[],
  ) =>
    expect(kitTablesUsed.map((table) => [table.address, [...table.addresses]])).toEqual(
      web3TablesUsed.map((table) => [
        table.key.toBase58(),
        table.state.addresses.map((a) => a.toBase58()),
      ]),
    );

  it("vaultTransactionExecute", async () => {
    const [, vaultBump] = multisig.getVaultPda({ multisigPda: multisigPk, index: vaultIndex });
    const [, transactionBump] = multisig.getTransactionPda({
      multisigPda: multisigPk,
      index: transactionIndex,
    });
    const accounts = withTables([
      [
        transactionPk.toBase58(),
        new Uint8Array(
          getVaultTransactionEncoder().encode({
            multisig: kit(multisigPk),
            creator: kit(memberPk),
            index: transactionIndex,
            bump: transactionBump,
            vaultIndex,
            vaultBump,
            ephemeralSignerBumps: ephemeralSignerBumps(),
            message: storedMessage(),
          }),
        ),
      ],
    ]);

    const kitResult = await ix.vaultTransactionExecute({
      rpc: kitRpc(accounts),
      multisigPda: kit(multisigPk),
      transactionIndex,
      member: kit(memberPk),
    });
    const web3Result = await multisig.instructions.vaultTransactionExecute({
      connection: web3Connection(accounts),
      multisigPda: multisigPk,
      transactionIndex,
      member: memberPk,
    });

    expectIxParity(kitResult.instruction, web3Result.instruction);
    expectLookupParity(kitResult.lookupTableAccounts, web3Result.lookupTableAccounts);
  });

  it("batchExecuteTransaction", async () => {
    const batchIndex = transactionIndex;
    const childIndex = 1;
    const [batchPk, batchBump] = multisig.getTransactionPda({
      multisigPda: multisigPk,
      index: batchIndex,
    });
    const [, vaultBump] = multisig.getVaultPda({ multisigPda: multisigPk, index: vaultIndex });
    const [childPk, childBump] = multisig.getBatchTransactionPda({
      multisigPda: multisigPk,
      batchIndex,
      transactionIndex: childIndex,
    });
    const accounts = withTables([
      [
        batchPk.toBase58(),
        new Uint8Array(
          getBatchEncoder().encode({
            multisig: kit(multisigPk),
            creator: kit(memberPk),
            index: batchIndex,
            bump: batchBump,
            vaultIndex,
            vaultBump,
            size: 2,
            executedTransactionIndex: 0,
          }),
        ),
      ],
      [
        childPk.toBase58(),
        new Uint8Array(
          getVaultBatchTransactionEncoder().encode({
            bump: childBump,
            ephemeralSignerBumps: ephemeralSignerBumps(),
            message: storedMessage(),
          }),
        ),
      ],
    ]);

    const kitResult = await ix.batchExecuteTransaction({
      rpc: kitRpc(accounts),
      multisigPda: kit(multisigPk),
      member: kit(memberPk),
      batchIndex,
      transactionIndex: childIndex,
    });
    const web3Result = await multisig.instructions.batchExecuteTransaction({
      connection: web3Connection(accounts),
      multisigPda: multisigPk,
      member: memberPk,
      batchIndex,
      transactionIndex: childIndex,
    });

    expectIxParity(kitResult.instruction, web3Result.instruction);
    expectLookupParity(kitResult.lookupTableAccounts, web3Result.lookupTableAccounts);
    expect(
      [kitResult.ephemeralSignerBumps, kitResult.message],
      "the child it read, so a caller needs no second read",
    ).toEqual([ephemeralSignerBumps(), storedMessage()]);
  });
});
