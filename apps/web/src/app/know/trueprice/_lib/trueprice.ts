// Pure fair-value and premium/discount math for TruePrice. No React, no fetch,
// no side effects, so it is unit tested directly. The premium/discount is the
// signed gap between the on-chain DEX price and a fair-value anchor. The anchor
// is the Pyth fair value when a key resolves one, otherwise the underlying
// equity reference the Jupiter price API returns for xStocks (stockData.price).
// A value that cannot be sourced is null, never a fabricated number.

import { pythHumanPrice, type JupiterPriceMap, type PythPrice } from "@aadukalam/sdk";
import { bestPythFeed, loadTokens, type TokenInfo } from "@aadukalam/data";

/** Per-mint shape the Jupiter price API returns, taken from the allowed map type. */
export type JupInfo = JupiterPriceMap[string];

export type FairValueSource = "pyth" | "underlying" | "none";

export interface FairValue {
  value: number | null;
  source: FairValueSource;
  /** short human label for the anchor, e.g. "Pyth" or "Underlying ref". */
  label: string;
}

const FAIR_LABEL: Record<FairValueSource, string> = {
  pyth: "Pyth",
  underlying: "Underlying ref",
  none: "no reference",
};

/** A usable positive, finite price. Guards every math input. */
function isPrice(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0;
}

/**
 * Signed premium (positive) or discount (negative) of the DEX price against a
 * fair-value anchor, as a fraction: (dex - fair) / fair. Returns null when
 * either input is not a usable price, so the UI shows "n/a" not "NaN".
 */
export function premiumDiscount(
  dexPrice: number | null | undefined,
  fairValue: number | null | undefined,
): number | null {
  if (!isPrice(dexPrice) || !isPrice(fairValue)) return null;
  return (dexPrice - fairValue) / fairValue;
}

export type DriftKind = "premium" | "discount" | "inline";

/**
 * Classify a premium/discount fraction. Anything inside +/- epsilon (default 10
 * basis points) reads as trading in line with fair value, so tiny noise does not
 * flip the label every tick.
 */
export function classifyDrift(ratio: number | null | undefined, epsilon = 0.001): DriftKind {
  if (ratio == null || !Number.isFinite(ratio)) return "inline";
  if (ratio > epsilon) return "premium";
  if (ratio < -epsilon) return "discount";
  return "inline";
}

/**
 * Pick the fair-value anchor. Pyth first when a key resolved a price, then the
 * underlying equity reference from the Jupiter price API, then none. Per
 * .hq/ARCHITECTURE.md a value we could not fetch is never faked.
 */
export function selectFairValue(input: {
  pyth?: number | null;
  underlying?: number | null;
}): FairValue {
  if (isPrice(input.pyth)) return { value: input.pyth, source: "pyth", label: FAIR_LABEL.pyth };
  if (isPrice(input.underlying)) {
    return { value: input.underlying, source: "underlying", label: FAIR_LABEL.underlying };
  }
  return { value: null, source: "none", label: FAIR_LABEL.none };
}

/**
 * The price implied 24 hours ago from a live price and its 24h percent change,
 * exactly as the Jupiter price API reports the change: prev = price / (1 +
 * change/100). Returns null when the inputs cannot imply a positive price. This
 * is a derivation from real reported fields, labeled as such in the UI, never a
 * synthesized history.
 */
export function impliedPrice24hAgo(
  price: number | null | undefined,
  change24hPct: number | null | undefined,
): number | null {
  if (!isPrice(price)) return null;
  if (change24hPct == null || !Number.isFinite(change24hPct)) return null;
  const factor = 1 + change24hPct / 100;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const prev = price / factor;
  return isPrice(prev) ? prev : null;
}

export interface TruePriceRow {
  token: TokenInfo;
  ticker: string;
  name: string;
  mint: string;
  /** Pyth feed id used for the fair value or null when the token has none. */
  feed: string | null;
  /** on-chain DEX price from Jupiter /price/v3 or null. */
  dexPrice: number | null;
  /** Pyth fair value (human USD) or null when key is missing or no feed. */
  pythFair: number | null;
  /** underlying equity reference from Jupiter stockData.price or null. */
  underlying: number | null;
  /** the anchor chosen for the premium/discount calc. */
  fair: FairValue;
  /** signed premium/discount fraction against `fair` or null. */
  premium: number | null;
  /** classification of `premium`. */
  drift: DriftKind;
  /** 24h percent change from Jupiter or null. */
  change24h: number | null;
  /** liquidity in USD, from Jupiter if present else the registry or null. */
  liquidity: number | null;
}

function numOrNull(x: number | null | undefined): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/** Assemble a display row from a registry token, a Jupiter price and a Pyth price. */
export function buildRow(
  token: TokenInfo,
  jup: JupInfo | undefined,
  pyth: PythPrice | undefined,
): TruePriceRow {
  const dexPrice = numOrNull(jup?.usdPrice);
  const underlying = numOrNull(jup?.stockData?.price);
  const pythFair = pyth ? numOrNull(pythHumanPrice(pyth)) : null;
  const fair = selectFairValue({ pyth: pythFair, underlying });
  const premium = premiumDiscount(dexPrice, fair.value);
  return {
    token,
    ticker: token.ticker,
    name: token.name,
    mint: token.mint,
    feed: bestPythFeed(token),
    dexPrice,
    pythFair,
    underlying,
    fair,
    premium,
    drift: classifyDrift(premium),
    change24h: numOrNull(jup?.priceChange24h),
    liquidity: numOrNull(jup?.liquidity) ?? numOrNull(token.liquidityUsd),
  };
}

/**
 * Registry entries that belong on TruePrice: a tokenized stock with a Pyth feed
 * or real on-chain liquidity. Sorted by liquidity, deepest first.
 */
export function truePriceTokens(): TokenInfo[] {
  return loadTokens()
    .filter((t) => bestPythFeed(t) != null || (t.liquidityUsd ?? 0) > 0)
    .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
}
