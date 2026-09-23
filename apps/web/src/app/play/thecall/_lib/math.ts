// The Call: pure settlement math. No imports, no I/O, so this file is unit
// tested on its own. Every value that the on-chain program treats as an integer
// is a bigint here and every division floors the way u64 integer division does
// on chain, so the client estimate matches what the program will actually pay.

/** 0 = NO, 1 = YES. Matches the program's `side` and `winning_side`. */
export type Side = 0 | 1;

export const SIDE_NO: Side = 0;
export const SIDE_YES: Side = 1;

/** Human label for a side. */
export function sideLabel(side: number): "YES" | "NO" | "unknown" {
  if (side === SIDE_YES) return "YES";
  if (side === SIDE_NO) return "NO";
  return "unknown";
}

/**
 * Turn a human dollar target into the feed fixed-point integer the program
 * stores as `target_price`. The exponent is the FEED exponent, never assumed:
 * a $200.00 target on a feed with expo -5 is 20_000_000. Done with strings so a
 * large scale never loses precision to floating point.
 */
export function dollarsToTargetPrice(dollars: number, expo: number): bigint {
  if (!Number.isFinite(dollars)) throw new Error("dollars must be finite");
  if (!Number.isInteger(expo)) throw new Error("expo must be an integer");
  const negative = dollars < 0;
  const abs = Math.abs(dollars);

  if (expo <= 0) {
    // decimals of precision the feed carries, e.g. expo -5 -> 5 decimals.
    const decimals = -expo;
    const fixed = abs.toFixed(decimals); // e.g. "123.45000"
    const [whole, frac = ""] = fixed.split(".");
    const digits = `${whole}${frac}`.replace(/^0+(?=\d)/, "");
    const value = BigInt(digits === "" ? "0" : digits);
    return negative ? -value : value;
  }

  // expo > 0 is rare for equities: target = round(dollars / 10^expo).
  const scale = 10 ** expo;
  const value = BigInt(Math.round(abs / scale));
  return negative ? -value : value;
}

/** Inverse of dollarsToTargetPrice for display: fixed-point integer -> dollars. */
export function fixedToDollars(value: bigint | number, expo: number): number {
  const n = typeof value === "bigint" ? Number(value) : value;
  return n * 10 ** expo;
}

/**
 * The winning side the program sets on resolve. YES (1) when the settled price
 * is at or above the target, NO (0) otherwise. Both prices must be in the same
 * feed exponent, which they are because both come from that one feed.
 */
export function computeWinningSide(settledPrice: bigint, targetPrice: bigint): Side {
  return settledPrice >= targetPrice ? SIDE_YES : SIDE_NO;
}

/** BigInt floor division for non-negative numerator and positive denominator. */
function floorDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n;
  return numerator / denominator; // bigint division truncates toward zero
}

export interface PayoutParams {
  /** the bet's side */
  side: number;
  /** the bet stake in USDC base units */
  amount: bigint;
  /** market winning side, only meaningful once resolved */
  winningSide: number;
  /** total YES stake in base units */
  totalYes: bigint;
  /** total NO stake in base units */
  totalNo: bigint;
  /** whether the market is resolved */
  resolved: boolean;
}

/**
 * What a bet pays out. A winner gets its stake back plus a pro-rata share of the
 * losing pool, weighted by its share of the winning pool. A loser gets nothing,
 * and nothing is claimable before the market resolves. Integer floor division
 * mirrors the on-chain u64 math, so the share never rounds up past the pool.
 */
export function computePayout(p: PayoutParams): bigint {
  if (!p.resolved) return 0n;
  if (p.side !== p.winningSide) return 0n;

  const winningPool = p.winningSide === SIDE_YES ? p.totalYes : p.totalNo;
  const losingPool = p.winningSide === SIDE_YES ? p.totalNo : p.totalYes;
  if (winningPool <= 0n) return 0n; // no winning stake to pay from

  const share = floorDiv(p.amount * losingPool, winningPool);
  return p.amount + share;
}

/**
 * The payout a NEW bet would earn if its side wins, assuming no further bets.
 * The bet joins its side's pool, so the winning pool grows by the new stake
 * while the losing pool is the other side as it stands. Used by the bet slip.
 */
export function potentialPayout(params: {
  side: Side;
  betAmount: bigint;
  totalYes: bigint;
  totalNo: bigint;
}): bigint {
  const { side, betAmount, totalYes, totalNo } = params;
  if (betAmount <= 0n) return 0n;
  const sameSidePool = (side === SIDE_YES ? totalYes : totalNo) + betAmount;
  const otherSidePool = side === SIDE_YES ? totalNo : totalYes;
  const share = floorDiv(betAmount * otherSidePool, sameSidePool);
  return betAmount + share;
}

/**
 * Implied probability from the pool split: a side's share of the total staked.
 * Returns null probabilities when nothing is staked yet, so the UI shows "no
 * bets yet" instead of a fake 50/50.
 */
export function impliedProbability(totalYes: bigint, totalNo: bigint): {
  total: bigint;
  yesProb: number | null;
  noProb: number | null;
} {
  const total = totalYes + totalNo;
  if (total <= 0n) return { total, yesProb: null, noProb: null };
  const yesProb = Number(totalYes) / Number(total);
  return { total, yesProb, noProb: 1 - yesProb };
}

// ---- Market state machine -------------------------------------------------

export type MarketPhase = "betting" | "awaiting" | "resolved";

interface PhaseInput {
  resolved: boolean;
  /** unix seconds */
  deadline: number | bigint;
}

function deadlineSeconds(deadline: number | bigint): number {
  return typeof deadline === "bigint" ? Number(deadline) : deadline;
}

/**
 * Where a market sits right now. Betting until the deadline, then awaiting a
 * resolve, then resolved once someone posts the price and calls resolve.
 */
export function marketPhase(m: PhaseInput, nowSec: number): MarketPhase {
  if (m.resolved) return "resolved";
  if (nowSec >= deadlineSeconds(m.deadline)) return "awaiting";
  return "betting";
}

/** Betting is open only before the deadline and only while unresolved. */
export function canBet(m: PhaseInput, nowSec: number): boolean {
  return marketPhase(m, nowSec) === "betting";
}

/** Resolve is permissionless once the deadline has passed and it is unresolved. */
export function canResolve(m: PhaseInput, nowSec: number): boolean {
  return marketPhase(m, nowSec) === "awaiting";
}

/** A bet can claim once the market is resolved, it won and it has not claimed. */
export function canClaim(
  m: { resolved: boolean; winningSide: number },
  bet: { side: number; claimed: boolean },
  poolHasWinner = true,
): boolean {
  return m.resolved && !bet.claimed && bet.side === m.winningSide && poolHasWinner;
}

/** The resolved outcome as a label or null before resolve. */
export function winningSideLabel(m: { resolved: boolean; winningSide: number }): "YES" | "NO" | null {
  if (!m.resolved) return null;
  return m.winningSide === SIDE_YES ? "YES" : "NO";
}
