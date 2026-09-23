// The Call: shared TypeScript types. The decoded shapes mirror the on-chain
// accounts, with pubkeys as base58 strings and u64/i64 as bigint so nothing
// loses precision on the way to the UI.

import type { MarketPhase, Side } from "./math";

/** A market account decoded for the UI. */
export interface MarketView {
  /** the market PDA address */
  address: string;
  creator: string;
  /** 64-char hex feed id (no 0x), as stored in the account */
  feedIdHex: string;
  /** strike in feed fixed point */
  targetPrice: bigint;
  /** feed exponent, e.g. -5 */
  expo: number;
  /** unix seconds betting closes and resolve opens */
  deadline: number;
  resolved: boolean;
  /** 1 = YES won, 0 = NO won, only meaningful when resolved */
  winningSide: number;
  totalYes: bigint;
  totalNo: bigint;
  usdcMint: string;
  marketId: bigint;
  /** derived on the client */
  phase: MarketPhase;
  /** target rendered as dollars, target * 10^expo */
  targetDollars: number;
  /** the registry ticker this feed maps to, when one is known */
  ticker?: string;
  tokenName?: string;
}

/** A user's bet account decoded for the UI. */
export interface BetView {
  address: string;
  market: string;
  user: string;
  side: Side;
  amount: bigint;
  claimed: boolean;
}

/** A live Pyth read paired with a market, for the price-vs-target row. */
export interface LivePriceState {
  /** human dollar price, null when no live price is available */
  priceUsd: number | null;
  /** confidence band in dollars, null otherwise */
  confUsd: number | null;
  /** feed exponent from the live update, null otherwise */
  expo: number | null;
  /** unix seconds of the publish time, null otherwise */
  publishTime: number | null;
  /** true when the proxy reported the key is missing, drives the honest label */
  keyMissing: boolean;
  source: "pyth" | "none";
}
