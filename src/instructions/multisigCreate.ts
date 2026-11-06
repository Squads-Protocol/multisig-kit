import type { Address } from "@solana/kit";

/**
 * @deprecated v1 multisig creation is deprecated on-chain. The v1 instruction takes **no serialized
 * args** (its `DataArgs` type is `{}`), so `threshold`, `members`, `configAuthority`, `timeLock`, and
 * `memo` cannot be set through it — the OG `@sqds/multisig` wrapper accepted them but silently
 * discarded them, producing a malformed instruction. This wrapper refuses instead of trapping callers.
 *
 * Use {@link multisigCreateV2}. If you genuinely need the raw v1 instruction, call
 * `generated.getMultisigCreateInstruction` directly.
 */
export function multisigCreate(_args: {
  creator: Address;
  multisigPda: Address;
  configAuthority: Address | null;
  threshold: number;
  members: unknown[];
  timeLock: number;
  createKey: Address;
  memo?: string;
  programId?: Address;
}): never {
  throw new Error(
    "multisigCreate (v1) is deprecated and unsupported — use multisigCreateV2. " +
      "For the raw v1 instruction, use generated.getMultisigCreateInstruction.",
  );
}
