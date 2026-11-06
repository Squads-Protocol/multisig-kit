import { type Address, type TransactionSigner, createNoopSigner } from "@solana/kit";

/**
 * A signer account given either as a bare address or as a Kit `TransactionSigner`.
 *
 * Pass the signer you will sign with (a `KeyPairSigner`, a wallet signer) when you build the
 * transaction with Kit's `signTransactionMessageWithSigners`: Kit refuses two non-equivalent signers
 * for one address, so the no-op signer a bare address becomes would clash with, say, the same key
 * as a `KeyPairSigner` fee payer.
 * A bare address becomes a no-op signer, which suits flows that sign the compiled bytes elsewhere.
 */
export type AddressOrSigner<TAddress extends string = string> =
  | Address<TAddress>
  | TransactionSigner<TAddress>;

export function toSigner<TAddress extends string>(
  value: AddressOrSigner<TAddress>,
): TransactionSigner<TAddress> {
  return typeof value === "string" ? createNoopSigner(value) : value;
}

export function toAddress<TAddress extends string>(value: AddressOrSigner<TAddress>): Address<TAddress> {
  return typeof value === "string" ? value : value.address;
}
