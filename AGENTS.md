# @sqds/multisig-kit

Public npm SDK for the Squads Multisig v4 program on `@solana/kit`, the Kit counterpart of `@sqds/multisig`.

## Layout

```
idl/squads_multisig_program.json   Snapshot of the v4 Anchor IDL, the codegen source; shipped as ./idl.json.
scripts/generate.ts                Codama codegen into src/generated (`npm run generate`, needs bun).
scripts/e2e-surfpool.mjs           Create/propose/approve/execute against a local mainnet fork (`npm run e2e`).
src/generated/                     Generated. Never hand-edit; wrap it from the hand-written layer instead.
src/instructions/                  One high-level wrapper per instruction, plus the buffer flow.
src/signers.ts                     `AddressOrSigner`, `toSigner`, `toAddress`.
src/pda.ts, codecs.ts, utils.ts    PDAs (async), compact message codec, message compilation.
examples/                          Typechecked usage examples (not run).
tests/                             Parity tests against @sqds/multisig (devDependency) + signer tests.
```

## Invariants

- Same names, seeds and derivations as `@sqds/multisig`; a new wrapper gets a parity test.
- Signer params are `AddressOrSigner`; never call `createNoopSigner` directly in a wrapper (use `toSigner`), and use
  `toAddress` when the param also feeds a PDA seed.
- `@solana/kit` is a peer dependency only, never a dependency (one copy of Kit's branded types). Floor tested: 8.3.0.
- No Node-only APIs in `src/` (no `Buffer`): the package must run in browsers.
- Scope is instructions, accounts, codecs and PDAs. No send layer.

## Gate

`npm run typecheck && npm test && npm run build`, then `npm pack` and import the tarball from ESM and CJS.
