# @sqds/multisig-kit

TypeScript SDK for the [Squads Multisig v4](https://github.com/Squads-Protocol/v4) program
(`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`), built on [`@solana/kit`](https://github.com/anza-xyz/kit).

It is the Kit counterpart of [`@sqds/multisig`](https://www.npmjs.com/package/@sqds/multisig): same namespaces,
same function names, same PDA seeds, byte-identical instruction data. It has no web3.js v1, `bn.js`, `beet` or
`Buffer` dependency, and runs in Node and the browser (no `process` global needed).

```sh
npm install @sqds/multisig-kit @solana/kit
```

Requires `@solana/kit` 8.3 or later (peer dependency) and Node 20.18 or later.

## What's inside

| Export | Contents |
| --- | --- |
| `getMultisigPda`, `getVaultPda`, `getTransactionPda`, `getProposalPda`, ... | PDA derivations (async, return `[Address, bump]`) |
| `instructions.*` | One builder per program instruction, returning a Kit `Instruction` |
| `accounts.*` | `fetchMultisig`, `fetchProposal`, `fetchVaultTransaction`, `decodeMultisig`, decoders, ... |
| `errors.*` | Program error codes, `isSquadsMultisigProgramError`, `getSquadsMultisigProgramErrorMessage` |
| `types.*` | `Member`, `ConfigAction`, `Period`, `ProposalStatus`, ... |
| `Permission`, `Permissions` | Member permission bitmask helpers |
| `utils.*`, `codecs.*` | Vault message compilation, `accountsForTransactionExecute`, the compact message codec |
| `decompileBase64Transaction` | Turn a base64 versioned transaction (e.g. a swap) into Kit instructions to wrap |
| `generated.*` | The full Codama-generated client (raw builders for every instruction, incl. `programConfig*`) |
| `@sqds/multisig-kit/idl.json` | The program IDL, to generate your own client |

## Quick start: propose, approve, execute

```ts
import * as multisig from "@sqds/multisig-kit";
import {
  appendTransactionMessageInstructions, createSolanaRpc, createTransactionMessage, pipe,
  setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";

const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");

const [vaultPda] = await multisig.getVaultPda({ multisigPda, index: 0 });
const { data: ms } = await multisig.accounts.fetchMultisig(rpc, multisigPda);
const transactionIndex = ms.transactionIndex + 1n;

const ixs = [
  await multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex,
    creator: member,              // a Kit TransactionSigner (or a bare Address, see below)
    vaultIndex: 0,
    ephemeralSigners: 0,
    // The instructions the vault will run, with the vault as payer.
    transactionMessage: { payerKey: vaultPda, instructions: innerInstructions },
  }),
  await multisig.instructions.proposalCreate({ multisigPda, transactionIndex, creator: member }),
  await multisig.instructions.proposalApprove({ multisigPda, transactionIndex, member }),
];

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
const signed = await signTransactionMessageWithSigners(
  pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(member, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  ),
);
// send with sendAndConfirmTransactionFactory, or your own sender

// Once the threshold is met:
const { instruction, lookupTableAccounts } = await multisig.instructions.vaultTransactionExecute({
  rpc, multisigPda, transactionIndex, member,
});
// If the vault transaction used address lookup tables, compress the execute message with them,
// or it can exceed the account limit:
//   compressTransactionMessageUsingAddressLookupTables(message,
//     Object.fromEntries(lookupTableAccounts.map((t) => [t.address, [...t.addresses]])));
```

[`examples/propose-upgrade.ts`](examples/propose-upgrade.ts) is a complete example that proposes a program
upgrade (BPF Upgradeable Loader `Upgrade` signed by the vault) and sends it.
[`scripts/e2e-surfpool.mjs`](scripts/e2e-surfpool.mjs) runs create → propose → approve → execute against a local
mainnet fork.

### Signers or addresses

Signer params (`creator`, `member`, `rentPayer`, `configAuthority`, `createKey`) take either an `Address` or a Kit
`TransactionSigner`.

- Pass the **signer** when you sign with Kit's `signTransactionMessageWithSigners`. A bare address becomes a no-op
  signer, and Kit rejects a no-op signer and a real signer for the same address
  (`SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS`), e.g. when that key is also your fee payer signer.
- Pass an **address** when the transaction is signed elsewhere (a wallet adapter, a hardware wallet, a remote
  signer). It becomes a no-op signer that marks the account as a signer without signing.

## Migrating from `@sqds/multisig`

| `@sqds/multisig` (web3.js v1) | `@sqds/multisig-kit` |
| --- | --- |
| `PublicKey` | `Address` (`address("...")`) |
| `const [pda] = multisig.getVaultPda({...})` | `const [pda] = await multisig.getVaultPda({...})` (PDAs are async in Kit) |
| `accounts.Multisig.fromAccountAddress(connection, pda)` | `(await accounts.fetchMultisig(rpc, pda)).data` |
| `BigInt`/`bn.js` fields (`transactionIndex`, amounts) | `bigint` |
| `transactionMessage: new TransactionMessage({ payerKey, recentBlockhash, instructions })` | `transactionMessage: { payerKey, instructions }` (no blockhash) |
| `instructions.*` returns `TransactionInstruction` | returns Kit `Instruction` |
| `transactions.*` / `rpc.*` (build/send for you) | Compose with Kit's `pipe(createTransactionMessage(...))` and send with Kit |
| `Permissions.all()`, `Permission.Vote` | unchanged |
| `errors.translateAndThrowAnchorError` | `errors.isSquadsMultisigProgramError(e, msg, code)` |

### Mixing with web3.js v1 code during a migration

If the instructions you wrap in a vault transaction still come from web3.js v1, convert them:

```ts
import { AccountRole, address, type Instruction } from "@solana/kit";
import type { TransactionInstruction } from "@solana/web3.js";

function toKitInstruction(ix: TransactionInstruction): Instruction {
  return {
    programAddress: address(ix.programId.toBase58()),
    accounts: ix.keys.map((k) => ({
      address: address(k.pubkey.toBase58()),
      role: k.isSigner
        ? k.isWritable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER
        : k.isWritable ? AccountRole.WRITABLE : AccountRole.READONLY,
    })),
    data: new Uint8Array(ix.data),
  };
}
```

## Differences from `@sqds/multisig`

- No `transactions` or `rpc` namespaces: Kit composes and sends transactions itself.
- `programConfig*` admin instructions have no high-level wrapper; use `generated.getProgramConfig*Instruction`.
- `instructions.multisigCreate` (v1) throws: the v1 instruction is deprecated on-chain and takes no args, so the
  old wrapper produced a malformed instruction. Use `multisigCreateV2`.
- `batchAddTransaction` keeps an unused `vaultIndex` param for call-site compatibility.
- `batchExecuteTransaction` also returns the child's `ephemeralSignerBumps` and `message`.
- `utils.transactionMessageToMultisigTransactionMessageBytes` no longer takes `vaultPda` (the original
  ignored it), and `utils.accountsForTransactionExecute` takes a Kit `rpc` instead of a `Connection`.
  `utils.getAvailableMemoSize` is not ported.
- `decompileBase64Transaction` returns lookup tables as a map (`{ [tableAddress]: Address[] }`); to wrap the
  instructions, pass them to `vaultTransactionCreate` as
  `addressLookupTableAccounts: Object.entries(lookupTables).map(([table, addresses]) => ({ address: address(table), addresses }))`
  (`address` from `@solana/kit`).
- New: high-level wrappers for the transaction-buffer flow (`transactionBufferCreate`,
  `transactionBufferExtend`, `transactionBufferClose`, `vaultTransactionCreateFromBuffer`), for vault
  messages too large for one transaction. The original SDK only exposes the raw generated builders.

## Development

Node 22.12 or later (for the test runner; the published package needs only 20.18).

```sh
npm install
npm run typecheck
npm test            # parity tests against @sqds/multisig (a dev dependency only) + signer tests
npm run build       # ESM + CJS + .d.ts into dist/
npm run generate    # regenerate src/generated from idl/ with Codama (needs bun; never hand-edit src/generated)
```

`@sqds/multisig` and `@solana/web3.js` are dev dependencies used as test oracles; they are not shipped.

## License

MIT
