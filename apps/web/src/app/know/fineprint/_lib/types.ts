// Fine Print shared types. Pure data, no runtime deps, safe to import anywhere.
// House style: no em dashes, no comma before "and" or "or".

import type { TokenInfo, TokenRights } from "@aadukalam/data";

export type { TokenInfo, TokenRights };

/** Visual tone a component maps to a colour. Keeps colour out of the logic. */
export type Tone = "positive" | "neutral" | "caution" | "negative";

/** Is the holder holding a real share, a synthetic claim or something we could not verify. */
export type OwnershipKind = "real-shares" | "synthetic" | "unverified";

/** Shareholder voting. */
export type VotingKind = "yes" | "no" | "undisclosed";

/** How a dividend reaches the holder, if at all. */
export type DividendKind = "rebase" | "reinvested" | "cash" | "none";

/** What the holder can redeem into. */
export type RedemptionKind =
  | "to-real-shares"
  | "to-cash"
  | "mandatory-swap"
  | "none"
  | "undisclosed";

/** Quality of the backing behind the token. */
export type BackingKind = "real-share-custody" | "collateralized" | "unverified";

/** One classified rights field: a machine kind, a plain-English label, a tone and the source prose. */
export interface RightsField<K extends string> {
  kind: K;
  label: string;
  tone: Tone;
  detail: string;
}

/** A flagged caveat surfaced to the holder. */
export interface RightsFlag {
  tone: Tone;
  text: string;
}

/** The full plain-English reading of one tokenized-stock's rights. */
export interface RightsSummary {
  ticker: string;
  name: string;
  issuer: string;
  mint: string;
  headline: string;
  ownership: RightsField<OwnershipKind>;
  voting: RightsField<VotingKind>;
  dividends: RightsField<DividendKind>;
  redemption: RightsField<RedemptionKind>;
  backing: RightsField<BackingKind>;
  flags: RightsFlag[];
}

/** One token balance, matching the shape the SDK and the holdings route return. */
export interface HoldingBalance {
  mint: string;
  /** raw integer base units as a string */
  amount: string;
  decimals: number;
  /** UI amount, Token-2022 scaled UI already applied by the RPC */
  uiAmount: number;
  programId: string;
}

/** A balance joined to the registry. Unknown mints keep the balance but carry no rights. */
export type HoldingView =
  | { known: true; balance: HoldingBalance; token: TokenInfo; rights: RightsSummary }
  | { known: false; balance: HoldingBalance };
