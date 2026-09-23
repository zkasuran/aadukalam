// Conviction basket math. Pure functions, no network and no React, so the weight
// rules and the budget split are unit tested on their own. A basket owns a whole
// theme instead of thirty tickers: pick a rule, the rule sets the weights, the
// budget splits across the legs by weight, each leg is one ExactIn Jupiter swap.
// House style in comments: no em dashes, no comma before "and" or "or".

import { type TokenInfo } from "@aadukalam/data";
import { COMMON_MINTS, toBaseUnits } from "@aadukalam/sdk";

/** USDC is the quote asset for every leg. 6 decimals, from the shared registry. */
export const USDC_DECIMALS = COMMON_MINTS.USDC.decimals;
export const USDC_MINT = COMMON_MINTS.USDC.mint;

/** A leg below this on-chain liquidity will not route cleanly on Jupiter, so it
 * is shown as part of the theme but held out of the buy. Verified thin sets in
 * .hq/research/registry.md (the whole nuclear set, most AI-chip names). */
export const MIN_LIQUIDITY_USD = 5_000;

export type WeightRule = "equal" | "liquidity" | "market-cap" | "momentum";

export interface RuleMeta {
  id: WeightRule;
  label: string;
  blurb: string;
  /** cadence the simulated keeper would target, in days */
  cadenceDays: number;
  cadenceLabel: string;
}

/** The selectable rules. Each carries its own rebalance cadence. */
export const RULES: RuleMeta[] = [
  {
    id: "equal",
    label: "Equal weight",
    blurb: "Every name carries the same weight. Rebalanced to reset drift.",
    cadenceDays: 30,
    cadenceLabel: "monthly",
  },
  {
    id: "liquidity",
    label: "Liquidity weighted",
    blurb: "Weight follows on-chain depth, so the buy sits where it can actually fill.",
    cadenceDays: 7,
    cadenceLabel: "weekly",
  },
  {
    id: "market-cap",
    label: "Market-cap weighted",
    blurb:
      "Weight follows company size, cap-weighted like a broad index. Falls back to liquidity where no market cap is published.",
    cadenceDays: 30,
    cadenceLabel: "monthly",
  },
  {
    id: "momentum",
    label: "Momentum (placeholder)",
    blurb:
      "Tilts toward the stronger 24h movers. A placeholder signal, not a backtested factor.",
    cadenceDays: 7,
    cadenceLabel: "weekly",
  },
];

export function ruleMeta(rule: WeightRule): RuleMeta {
  return RULES.find((r) => r.id === rule) ?? RULES[0];
}

/** One theme member with the live-or-registry numbers the rules read. */
export interface Constituent {
  ticker: string;
  name: string;
  mint: string;
  decimals: number;
  issuer: string;
  /** best-known on-chain liquidity, live price v3 value or the registry figure */
  liquidityUsd: number;
  /** live market cap from Jupiter stockData, null when none is published */
  marketCap: number | null;
  /** live 24h percent change, drives the placeholder momentum rule, may be null */
  momentum: number | null;
  /** live USD price per token, for display only, may be null */
  usdPrice: number | null;
}

export interface WeightedLeg extends Constituent {
  /** 0..1, the legs in a plan sum to ~1 */
  weight: number;
  /** budget * weight, in USD */
  usdAmount: number;
  /** raw USDC base units for the ExactIn quote, as a string */
  baseUnitsIn: string;
}

/** The metric each rule ranks a constituent by, before normalizing. */
function metricFor(rule: WeightRule, c: Constituent): number {
  switch (rule) {
    case "equal":
      return 1;
    case "liquidity":
      return Math.max(0, c.liquidityUsd || 0);
    case "market-cap":
      // Company size when Jupiter publishes it, on-chain liquidity as the fallback.
      return Math.max(0, c.marketCap ?? c.liquidityUsd ?? 0);
    case "momentum":
      // Handled in computeWeights, which needs the whole set to shift returns positive.
      return c.momentum ?? 0;
  }
}

/**
 * Weights for a set of constituents under a rule. Aligned to the input order and
 * summing to 1 (an empty set returns []). Momentum shifts every 24h return above
 * zero so a laggard still gets a slice, then normalizes. Any degenerate metric
 * (all zero, all null) falls back to equal weight rather than dividing by zero.
 */
export function computeWeights(items: Constituent[], rule: WeightRule): number[] {
  const n = items.length;
  if (n === 0) return [];
  const equal = () => new Array(n).fill(1 / n);

  if (rule === "momentum") {
    const raw = items.map((c) => c.momentum ?? 0);
    const min = Math.min(...raw);
    // shift the weakest to zero, add a floor so every leg keeps some weight
    const FLOOR = 1;
    const metrics = raw.map((m) => m - min + FLOOR);
    const sum = metrics.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return equal();
    return metrics.map((m) => m / sum);
  }

  const metrics = items.map((c) => metricFor(rule, c));
  const sum = metrics.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return equal();
  return metrics.map((m) => m / sum);
}

/**
 * Split a USDC budget across the constituents by the rule's weights. Each leg is
 * one ExactIn buy: spend a fixed USDC amount, take whatever shares route. The
 * usdAmounts sum to the budget and baseUnitsIn is the raw amount for the quote.
 */
export function buildBasketPlan(
  items: Constituent[],
  rule: WeightRule,
  budgetUsd: number,
): WeightedLeg[] {
  const weights = computeWeights(items, rule);
  const budget = Number.isFinite(budgetUsd) && budgetUsd > 0 ? budgetUsd : 0;
  return items.map((c, i) => {
    const weight = weights[i] ?? 0;
    const usdAmount = budget * weight;
    return {
      ...c,
      weight,
      usdAmount,
      baseUnitsIn: toBaseUnits(usdAmount, USDC_DECIMALS),
    };
  });
}

/** True when a leg has enough on-chain depth to route on Jupiter today. */
export function isTradable(c: Constituent, min = MIN_LIQUIDITY_USD): boolean {
  return (c.liquidityUsd || 0) >= min;
}

/** Underlying symbol behind a wrapper ticker: strips the Ondo "on" or xStock "x". */
export function underlyingSymbol(ticker: string): string {
  if (/on$/i.test(ticker)) return ticker.slice(0, -2).toUpperCase();
  if (/x$/i.test(ticker)) return ticker.slice(0, -1).toUpperCase();
  return ticker.toUpperCase();
}

/**
 * One leg per company. A theme can list the same name as an xStock and an Ondo
 * wrapper (AAPLx and AAPLon), so group by the underlying symbol and keep the
 * deepest mint. Order is stable by the deepest-per-name liquidity, descending.
 */
export function dedupeByUnderlying(tokens: TokenInfo[]): TokenInfo[] {
  const best = new Map<string, TokenInfo>();
  for (const t of tokens) {
    if (!t.mint) continue; // only tickers with a verified mint
    const key = underlyingSymbol(t.ticker);
    const held = best.get(key);
    if (!held || (t.liquidityUsd ?? 0) > (held.liquidityUsd ?? 0)) {
      best.set(key, t);
    }
  }
  return [...best.values()].sort(
    (a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0),
  );
}

/** Turn a registry token into a Constituent seeded from the registry numbers. */
export function toConstituent(t: TokenInfo): Constituent {
  return {
    ticker: t.ticker,
    name: t.name,
    mint: t.mint,
    decimals: t.decimals,
    issuer: String(t.issuer),
    liquidityUsd: t.liquidityUsd ?? 0,
    marketCap: null,
    momentum: null,
    usdPrice: null,
  };
}

export interface NextRebalance {
  date: Date;
  cadenceLabel: string;
  /** days from `from` to the next run */
  inDays: number;
}

/**
 * The date the simulated keeper would next rebalance this basket. Scheduled and
 * labeled, not yet an on-chain cron. Deterministic given `from` for the tests.
 */
export function nextRebalance(rule: WeightRule, from: Date = new Date()): NextRebalance {
  const meta = ruleMeta(rule);
  const date = new Date(from.getTime() + meta.cadenceDays * 24 * 60 * 60 * 1000);
  return { date, cadenceLabel: meta.cadenceLabel, inDays: meta.cadenceDays };
}
