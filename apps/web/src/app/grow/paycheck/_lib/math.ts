// Pure dividend and multiplier math for Paycheck. No web3 or React here, so it
// runs the same in the browser, the keeper and the unit tests.
//
// A rebasing stock token carries a cumulative multiplier in basis points, where
// 10000 bps is 1.0x. When an issuer pays a dividend the token rebases up, so the
// multiplier grows and each holder's balance grows with it. Paycheck reads that
// delta and pays its value out as USDC instead of leaving it as silent tokens.

import { BASELINE_BPS } from "./constants";

/** A bps multiplier as a plain factor. 10000 -> 1.0, 10250 -> 1.025. */
export function bpsToMultiplier(bps: number): number {
  return bps / BASELINE_BPS;
}

/** A bps multiplier rendered as a factor string, e.g. 10250 -> "1.0250x". */
export function formatMultiplier(bps: number): string {
  return `${bpsToMultiplier(bps).toFixed(4)}x`;
}

/** The rebase step in bps. Never negative: a flat or downward rebase pays zero. */
export function deltaBps(oldBps: number, newBps: number): number {
  return Math.max(0, newBps - oldBps);
}

/**
 * The dividend yield this rebase represents, as a percent of the old multiplier.
 * A move from 10000 to 10250 is a 2.5% dividend. Returns 0 when the old
 * multiplier is not positive so a bad input cannot divide by zero.
 */
export function rebaseYieldPct(oldBps: number, newBps: number): number {
  if (oldBps <= 0) return 0;
  return (deltaBps(oldBps, newBps) / oldBps) * 100;
}

/**
 * The new multiplier in bps after applying a dividend yield to the current one.
 * A 2.5% yield on 10000 gives 10250. Rounded to whole bps because the on-chain
 * multiplier is an integer.
 */
export function newMultiplierFromYield(currentBps: number, yieldPct: number): number {
  return Math.round(currentBps * (1 + yieldPct / 100));
}

export interface DividendInput {
  // Deposited principal in stock token base units.
  principalBaseUnits: bigint;
  // Decimals of the stock token.
  stockDecimals: number;
  // Multiplier before and after this rebase, in bps.
  oldMultiplierBps: number;
  newMultiplierBps: number;
  // Price of one whole share in USD.
  pricePerShareUsd: number;
  // Decimals of the payout USDC mint.
  usdcDecimals: number;
}

/**
 * The USDC a rebase owes a holder, in USDC base units. This is the figure the
 * keeper computes off chain and hands to record_rebase.
 *
 * new shares from the rebase = principal * (newBps - oldBps) / 10000
 * dividend USD               = new shares * price per whole share
 *
 * All of it is integer math scaled by the token decimals so there is no float
 * drift. The result floors to whole USDC base units. Any non-positive or
 * non-finite input yields zero rather than a NaN or a throw.
 */
export function computeDividendUsdc(input: DividendInput): bigint {
  const {
    principalBaseUnits,
    stockDecimals,
    oldMultiplierBps,
    newMultiplierBps,
    pricePerShareUsd,
    usdcDecimals,
  } = input;

  const step = deltaBps(oldMultiplierBps, newMultiplierBps);
  if (step <= 0) return 0n;
  if (principalBaseUnits <= 0n) return 0n;
  if (!Number.isFinite(pricePerShareUsd) || pricePerShareUsd <= 0) return 0n;

  // Price scaled to USDC base units per whole share, e.g. $180.50 at 6 decimals
  // is 180_500000. Rounded to the nearest base unit.
  const priceScaled = BigInt(Math.round(pricePerShareUsd * 10 ** usdcDecimals));

  const numerator = principalBaseUnits * BigInt(step) * priceScaled;
  const denominator = BigInt(BASELINE_BPS) * 10n ** BigInt(stockDecimals);
  return numerator / denominator;
}
