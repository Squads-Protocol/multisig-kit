/**
 * Instruction builder parity: data bytes + account metas (address / signer / writable, in order)
 * must match the original `@sqds/multisig` builders. Plus coverage for the transaction-buffer
 * wrappers, which the original SDK lacks (asserted against generated discriminators + derived PDAs).
 */
import * as multisig from "@sqds/multisig";
import { PublicKey, SystemProgram, TransactionMessage as Web3TransactionMessage } from "@solana/web3.js";
import { address, isWritableRole } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  Period,
  TRANSACTION_BUFFER_CREATE_DISCRIMINATOR,
  VAULT_TRANSACTION_CREATE_FROM_BUFFER_DISCRIMINATOR,
  getVaultTransactionCreateFromBufferInstructionDataDecoder,
} from "../src/generated";
import { getTransactionBufferPda, getTransactionPda } from "../src/pda";
import * as ix from "../src/instructions";
import { Permissions } from "../src/permissions";
import { expectIxParity, toKitInstruction } from "./helpers";

const createKeyPk = PublicKey.unique();
const memberPk = PublicKey.unique();
const treasuryPk = PublicKey.unique();
const otherPk = PublicKey.unique();
const [multisigPk] = multisig.getMultisigPda({ createKey: createKeyPk });
const [vaultPk] = multisig.getVaultPda({ multisigPda: multisigPk, index: 0 });

const multisigPda = address(multisigPk.toBase58());
const createKey = address(createKeyPk.toBase58());
const member = address(memberPk.toBase58());
const treasury = address(treasuryPk.toBase58());
const other = address(otherPk.toBase58());

describe("proposal vote / lifecycle parity", () => {
  it("proposalCreate", async () => {
    expectIxParity(
      await ix.proposalCreate({ multisigPda, creator: member, transactionIndex: 1n }),
      multisig.instructions.proposalCreate({
        multisigPda: multisigPk,
        creator: memberPk,
        transactionIndex: 1n,
      }),
    );
  });

  it("proposalActivate", async () => {
    expectIxParity(
      await ix.proposalActivate({ multisigPda, transactionIndex: 1n, member }),
      multisig.instructions.proposalActivate({
        multisigPda: multisigPk,
        transactionIndex: 1n,
        member: memberPk,
      }),
    );
  });

  it.each(["proposalApprove", "proposalReject", "proposalCancel", "proposalCancelV2"] as const)(
    "%s",
    async (name) => {
      expectIxParity(
        await ix[name]({ multisigPda, transactionIndex: 1n, member, memo: "gm" }),
        multisig.instructions[name]({
          multisigPda: multisigPk,
          transactionIndex: 1n,
          member: memberPk,
          memo: "gm",
        }),
      );
    },
  );
});

describe("multisig config parity", () => {
  it("multisigCreateV2", async () => {
    const shared = { threshold: 1, timeLock: 0, configAuthority: null, rentCollector: null, memo: "c" };
    expectIxParity(
      await ix.multisigCreateV2({
        ...shared,
        treasury,
        creator: member,
        multisigPda,
        createKey,
        members: [{ key: member, permissions: Permissions.all() }],
      }),
      multisig.instructions.multisigCreateV2({
        ...shared,
        treasury: treasuryPk,
        creator: memberPk,
        multisigPda: multisigPk,
        createKey: createKeyPk,
        members: [{ key: memberPk, permissions: multisig.types.Permissions.all() }],
      }),
    );
  });

  it("multisigAddMember", async () => {
    expectIxParity(
      ix.multisigAddMember({
        multisigPda,
        configAuthority: member,
        rentPayer: member,
        newMember: { key: other, permissions: Permissions.all() },
        memo: "add",
      }),
      multisig.instructions.multisigAddMember({
        multisigPda: multisigPk,
        configAuthority: memberPk,
        rentPayer: memberPk,
        newMember: { key: otherPk, permissions: multisig.types.Permissions.all() },
        memo: "add",
      }),
    );
  });

  it("multisigRemoveMember", async () => {
    expectIxParity(
      ix.multisigRemoveMember({ multisigPda, configAuthority: member, oldMember: other, memo: "rm" }),
      multisig.instructions.multisigRemoveMember({
        multisigPda: multisigPk,
        configAuthority: memberPk,
        oldMember: otherPk,
        memo: "rm",
      }),
    );
  });

  it("multisigChangeThreshold", async () => {
    expectIxParity(
      ix.multisigChangeThreshold({
        multisigPda,
        configAuthority: member,
        rentPayer: member,
        newThreshold: 2,
      }),
      multisig.instructions.multisigChangeThreshold({
        multisigPda: multisigPk,
        configAuthority: memberPk,
        rentPayer: memberPk,
        newThreshold: 2,
      }),
    );
  });

  it("multisigSetTimeLock", async () => {
    expectIxParity(
      ix.multisigSetTimeLock({ multisigPda, configAuthority: member, timeLock: 60 }),
      multisig.instructions.multisigSetTimeLock({
        multisigPda: multisigPk,
        configAuthority: memberPk,
        timeLock: 60,
      }),
    );
  });

  it("multisigSetConfigAuthority", async () => {
    expectIxParity(
      ix.multisigSetConfigAuthority({
        multisigPda,
        configAuthority: member,
        newConfigAuthority: other,
      }),
      multisig.instructions.multisigSetConfigAuthority({
        multisigPda: multisigPk,
        configAuthority: memberPk,
        newConfigAuthority: otherPk,
      }),
    );
  });

  it("multisigSetRentCollector", async () => {
    expectIxParity(
      ix.multisigSetRentCollector({
        multisigPda,
        configAuthority: member,
        newRentCollector: other,
        rentPayer: member,
      }),
      multisig.instructions.multisigSetRentCollector({
        multisigPda: multisigPk,
        configAuthority: memberPk,
        newRentCollector: otherPk,
        rentPayer: memberPk,
      }),
    );
  });

  it("multisigAddSpendingLimit", async () => {
    const spendingLimitPk = PublicKey.unique();
    const mintPk = PublicKey.unique();
    const shared = { vaultIndex: 0, amount: 1_000n, memo: "sl" };
    expectIxParity(
      ix.multisigAddSpendingLimit({
        ...shared,
        multisigPda,
        configAuthority: member,
        spendingLimit: address(spendingLimitPk.toBase58()),
        rentPayer: member,
        createKey,
        mint: address(mintPk.toBase58()),
        period: Period.Day,
        members: [member],
        destinations: [other],
      }),
      multisig.instructions.multisigAddSpendingLimit({
        ...shared,
        multisigPda: multisigPk,
        configAuthority: memberPk,
        spendingLimit: spendingLimitPk,
        rentPayer: memberPk,
        createKey: createKeyPk,
        mint: mintPk,
        period: multisig.types.Period.Day,
        members: [memberPk],
        destinations: [otherPk],
      }),
    );
  });

  it("multisigRemoveSpendingLimit", async () => {
    const spendingLimitPk = PublicKey.unique();
    expectIxParity(
      ix.multisigRemoveSpendingLimit({
        multisigPda,
        configAuthority: member,
        spendingLimit: address(spendingLimitPk.toBase58()),
        rentCollector: member,
      }),
      multisig.instructions.multisigRemoveSpendingLimit({
        multisigPda: multisigPk,
        configAuthority: memberPk,
        spendingLimit: spendingLimitPk,
        rentCollector: memberPk,
      }),
    );
  });
});

describe("transaction / batch / close parity", () => {
  it("vaultTransactionCreate (wrapped transfer)", async () => {
    const transferIx = SystemProgram.transfer({
      fromPubkey: vaultPk,
      toPubkey: otherPk,
      lamports: 1_000n,
    });
    expectIxParity(
      await ix.vaultTransactionCreate({
        multisigPda,
        transactionIndex: 1n,
        creator: member,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: {
          payerKey: address(vaultPk.toBase58()),
          instructions: [toKitInstruction(transferIx)],
        },
        memo: "send",
      }),
      multisig.instructions.vaultTransactionCreate({
        multisigPda: multisigPk,
        transactionIndex: 1n,
        creator: memberPk,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: new Web3TransactionMessage({
          payerKey: vaultPk,
          recentBlockhash: PublicKey.unique().toBase58(),
          instructions: [transferIx],
        }),
        memo: "send",
      }),
    );
  });

  it("batchCreate", async () => {
    expectIxParity(
      await ix.batchCreate({ multisigPda, creator: member, batchIndex: 1n, vaultIndex: 0, memo: "b" }),
      multisig.instructions.batchCreate({
        multisigPda: multisigPk,
        creator: memberPk,
        batchIndex: 1n,
        vaultIndex: 0,
        memo: "b",
      }),
    );
  });

  it("batchAddTransaction (wrapped transfer)", async () => {
    const transferIx = SystemProgram.transfer({
      fromPubkey: vaultPk,
      toPubkey: otherPk,
      lamports: 1_000n,
    });
    expectIxParity(
      await ix.batchAddTransaction({
        multisigPda,
        member,
        batchIndex: 1n,
        transactionIndex: 1,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: {
          payerKey: address(vaultPk.toBase58()),
          instructions: [toKitInstruction(transferIx)],
        },
      }),
      multisig.instructions.batchAddTransaction({
        multisigPda: multisigPk,
        member: memberPk,
        batchIndex: 1n,
        transactionIndex: 1,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: new Web3TransactionMessage({
          payerKey: vaultPk,
          recentBlockhash: PublicKey.unique().toBase58(),
          instructions: [transferIx],
        }),
      }),
    );
  });

  it("configTransactionCreate (empty actions)", async () => {
    expectIxParity(
      await ix.configTransactionCreate({
        multisigPda,
        transactionIndex: 1n,
        creator: member,
        actions: [],
        memo: "cfg",
      }),
      multisig.instructions.configTransactionCreate({
        multisigPda: multisigPk,
        transactionIndex: 1n,
        creator: memberPk,
        actions: [],
        memo: "cfg",
      }),
    );
  });

  it("configTransactionExecute (with spending-limit remaining accounts)", async () => {
    const slPk = PublicKey.unique();
    expectIxParity(
      await ix.configTransactionExecute({
        multisigPda,
        transactionIndex: 1n,
        member,
        rentPayer: member,
        spendingLimits: [address(slPk.toBase58())],
      }),
      multisig.instructions.configTransactionExecute({
        multisigPda: multisigPk,
        transactionIndex: 1n,
        member: memberPk,
        rentPayer: memberPk,
        spendingLimits: [slPk],
      }),
    );
  });

  it("spendingLimitUse (SPL — exercises ATA derivation)", async () => {
    const spendingLimitPk = PublicKey.unique();
    const mintPk = PublicKey.unique();
    const shared = { vaultIndex: 0, amount: 1_000, decimals: 6, memo: "use" };
    expectIxParity(
      await ix.spendingLimitUse({
        ...shared,
        multisigPda,
        member,
        spendingLimit: address(spendingLimitPk.toBase58()),
        mint: address(mintPk.toBase58()),
        destination: other,
      }),
      multisig.instructions.spendingLimitUse({
        ...shared,
        multisigPda: multisigPk,
        member: memberPk,
        spendingLimit: spendingLimitPk,
        mint: mintPk,
        destination: otherPk,
      }),
    );
  });

  it.each(["vaultTransactionAccountsClose", "configTransactionAccountsClose"] as const)(
    "%s",
    async (name) => {
      expectIxParity(
        await ix[name]({ multisigPda, rentCollector: member, transactionIndex: 1n }),
        multisig.instructions[name]({
          multisigPda: multisigPk,
          rentCollector: memberPk,
          transactionIndex: 1n,
        }),
      );
    },
  );

  it("batchAccountsClose", async () => {
    expectIxParity(
      await ix.batchAccountsClose({ multisigPda, rentCollector: member, batchIndex: 1n }),
      multisig.instructions.batchAccountsClose({
        multisigPda: multisigPk,
        rentCollector: memberPk,
        batchIndex: 1n,
      }),
    );
  });

  it("vaultBatchTransactionAccountClose", async () => {
    expectIxParity(
      await ix.vaultBatchTransactionAccountClose({
        multisigPda,
        rentCollector: member,
        batchIndex: 1n,
        transactionIndex: 1,
      }),
      multisig.instructions.vaultBatchTransactionAccountClose({
        multisigPda: multisigPk,
        rentCollector: memberPk,
        batchIndex: 1n,
        transactionIndex: 1,
      }),
    );
  });
});

describe("transaction buffer flow (new in this SDK)", () => {
  it("transactionBufferCreate uses the right discriminator + derived buffer PDA", async () => {
    const [bufferPda] = await getTransactionBufferPda({ multisigPda, creator: member, bufferIndex: 0 });
    const instruction = await ix.transactionBufferCreate({
      multisigPda,
      creator: member,
      bufferIndex: 0,
      vaultIndex: 0,
      finalBufferHash: new Uint8Array(32),
      finalBufferSize: 4,
      buffer: new Uint8Array([1, 2, 3, 4]),
    });

    expect(Array.from((instruction.data ?? new Uint8Array()).slice(0, 8))).toEqual(
      Array.from(TRANSACTION_BUFFER_CREATE_DISCRIMINATOR),
    );
    const bufferAccount = instruction.accounts?.find((a) => a.address === bufferPda);
    expect(bufferAccount).toBeDefined();
    expect(isWritableRole(bufferAccount!.role)).toBe(true);
  });

  it("transactionBufferCreate rejects a non-32-byte finalBufferHash", async () => {
    await expect(
      ix.transactionBufferCreate({
        multisigPda,
        creator: member,
        bufferIndex: 0,
        vaultIndex: 0,
        finalBufferHash: new Uint8Array(31),
        finalBufferSize: 4,
        buffer: new Uint8Array([1, 2, 3, 4]),
      }),
    ).rejects.toThrow(/32 bytes/);
  });

  it("vaultTransactionCreateFromBuffer references the transaction + buffer PDAs", async () => {
    const [transactionPda] = await getTransactionPda({ multisigPda, index: 1n });
    const [bufferPda] = await getTransactionBufferPda({ multisigPda, creator: member, bufferIndex: 0 });

    const instruction = await ix.vaultTransactionCreateFromBuffer({
      multisigPda,
      transactionIndex: 1n,
      creator: member,
      bufferIndex: 0,
      vaultIndex: 0,
      ephemeralSigners: 0,
    });

    expect(Array.from((instruction.data ?? new Uint8Array()).slice(0, 8))).toEqual(
      Array.from(VAULT_TRANSACTION_CREATE_FROM_BUFFER_DISCRIMINATOR),
    );
    const addresses = (instruction.accounts ?? []).map((a) => a.address);
    expect(addresses).toContain(transactionPda);
    expect(addresses).toContain(bufferPda);
  });

  it("vaultTransactionCreateFromBuffer sends the 6 zero bytes the program requires as the message", async () => {
    // vault_transaction_create_from_buffer.rs validate(): args.transaction_message == vec![0; 6],
    // else InvalidInstructionArgs. The real message is read from the buffer on-chain.
    const instruction = await ix.vaultTransactionCreateFromBuffer({
      multisigPda,
      transactionIndex: 1n,
      creator: member,
      bufferIndex: 0,
      vaultIndex: 0,
      ephemeralSigners: 0,
    });
    const { args } = getVaultTransactionCreateFromBufferInstructionDataDecoder().decode(
      instruction.data ?? new Uint8Array(),
    );
    expect(Array.from(args.transactionMessage)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("deprecated v1", () => {
  it("multisigCreate throws (unsupported, points to V2)", () => {
    expect(() =>
      ix.multisigCreate({
        creator: member,
        multisigPda,
        configAuthority: null,
        threshold: 1,
        members: [],
        timeLock: 0,
        createKey,
      }),
    ).toThrow(/multisigCreateV2/);
  });
});
