/**
 * Codama codegen: Anchor IDL (v4) -> Solana Kit-native client under `src/generated`.
 *
 * Run: `bun run generate`
 *
 * The IDL is a legacy (Anchor 0.29 / solita) format snapshot in `idl/`. Codama's
 * `rootNodeFromAnchor` consumes it, but the deprecated `multisigCreate` (v1) instruction has an
 * account literally named "null", which is not a valid identifier for the JS renderer — we rename
 * it to `placeholder` before handing the IDL to Codama.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rootNodeFromAnchor, type AnchorIdl } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { createFromRoot } from "codama";

const here = dirname(fileURLToPath(import.meta.url));
const idlPath = join(here, "..", "idl", "squads_multisig_program.json");
const outDir = join(here, "..", "src", "generated");

type AnyIdl = AnchorIdl & {
  instructions: { accounts: { name: string }[] }[];
};

const idl = JSON.parse(readFileSync(idlPath, "utf8")) as AnyIdl;

// Sanitize: an account named "null" is not a usable identifier downstream.
for (const ix of idl.instructions) {
  for (const account of ix.accounts) {
    if (account.name === "null") {
      account.name = "placeholder";
    }
  }
}

const codama = createFromRoot(rootNodeFromAnchor(idl));

codama.accept(renderVisitor(outDir));

console.log(`Generated Kit client at ${outDir}`);
