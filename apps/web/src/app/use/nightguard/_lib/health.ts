// Nightguard liquidation math. Pure functions, no imports, safe on server and
// client. Every formula is the one verified in .hq/research/kamino.md against the
// klend-sdk v12 obligation stats. Numbers in, numbers out, no side effects, so
// the whole file is unit tested in health.test.ts.
//
// The liquidation line on Kamino is:
//   userTotalBorrowBorrowFactorAdjusted >= borrowLiquidationLimit
// where borrowLiquidationLimit = sum(collateralValueUsd_i * liqThreshold_i).
// Only the collateral leg moves with the equity price, the USDC/USDG debt is a
// stable, so the buffer is the fraction the weighted collateral basket can fall
// before that line is crossed.
//
// House style: no em dashes, no comma before "and" or "or".

export type HealthBand = "safe" | "watch" | "danger" | "liquidatable";

export interface HealthBandThresholds {
  /** buffer at or below this reads as danger. Default 0.10. */
  danger: number;
  /** buffer at or below this reads as watch. Default 0.25. */
  watch: number;
}

export const DEFAULT_BANDS: HealthBandThresholds = { danger: 0.1, watch: 0.25 };

/**
 * Liquidation buffer, the fraction the weighted collateral can drop before the
 * position is liquidatable. This is `1 - userTotalBorrowBorrowFactorAdjusted /
 * borrowLiquidationLimit`. Above 0 is healthy, 0 sits exactly on the line, below
 * 0 is already liquidatable. When there is no liquidation limit there is no debt
 * bearing collateral, so the position is fully buffered and this returns 1.
 */
export function liquidationBuffer(
  borrowBfAdjusted: number,
  borrowLiquidationLimit: number,
): number {
  if (!Number.isFinite(borrowBfAdjusted) || !Number.isFinite(borrowLiquidationLimit)) {
    return NaN;
  }
  if (borrowLiquidationLimit <= 0) return 1;
  return 1 - borrowBfAdjusted / borrowLiquidationLimit;
}

/**
 * Single collateral liquidation price. The collateral oracle price at which the
 * position hits the liquidation line, `borrowBfAdjusted / (collateralAmount *
 * liqThreshold)`. Valid only when the obligation has exactly one collateral. No
 * debt means no liquidation price so this returns 0. A missing or zero
 * collateral or threshold cannot be priced and returns NaN.
 */
export function liquidationPrice(
  borrowBfAdjusted: number,
  collateralAmount: number,
  liqThreshold: number,
): number {
  if (!Number.isFinite(borrowBfAdjusted) || borrowBfAdjusted <= 0) return 0;
  const denom = collateralAmount * liqThreshold;
  if (!Number.isFinite(denom) || denom <= 0) return NaN;
  return borrowBfAdjusted / denom;
}

/**
 * Buffer expressed against a live price, `1 - pLiq / pNow`. For a single
 * collateral position this equals liquidationBuffer, which health.test.ts pins
 * with a round trip. Returns NaN when the current price is missing or zero.
 */
export function bufferFromPrice(pLiq: number, pNow: number): number {
  if (!Number.isFinite(pLiq) || !Number.isFinite(pNow) || pNow <= 0) return NaN;
  return 1 - pLiq / pNow;
}

/**
 * The largest uniform downward move the basket survives, clamped to 0..1. This
 * is just the buffer read as a percentage headroom, named for the UI.
 */
export function maxSafeDrop(buffer: number): number {
  if (!Number.isFinite(buffer)) return 0;
  return Math.min(1, Math.max(0, buffer));
}

/**
 * Classify a buffer into a band. A non finite or non positive buffer reads as
 * liquidatable, which is the safe default for a shield when the number cannot be
 * trusted. Callers that want a distinct "no data" state should check the buffer
 * before calling this.
 */
export function healthBand(
  buffer: number,
  bands: HealthBandThresholds = DEFAULT_BANDS,
): HealthBand {
  if (!Number.isFinite(buffer) || buffer <= 0) return "liquidatable";
  if (buffer <= bands.danger) return "danger";
  if (buffer <= bands.watch) return "watch";
  return "safe";
}

/** One "what if the collateral gaps down by X" scenario. */
export interface DropProjection {
  /** the assumed downward move as a fraction, 0.05 is a 5 percent drop. */
  dropPct: number;
  /** true when the position is still above the liquidation line after the drop. */
  survives: boolean;
  /** buffer minus the drop. Negative means the drop crosses the line. */
  headroom: number;
  /** buffer remaining after the drop, measured at the new lower price. */
  projectedBuffer: number;
  /** the collateral price after the drop, null when no live price was given. */
  projectedPrice: number | null;
}

/**
 * Project the position after a uniform downward price move of `dropPct` (a
 * fraction). The debt is a stable so only the collateral value scales by
 * (1 - dropPct). Liquidation triggers when the drop reaches the buffer, so the
 * position survives strictly while `dropPct < buffer`. The new buffer at the
 * lower price is `1 - (1 - buffer) / (1 - dropPct)`. A total wipeout (dropPct at
 * or above 1) leaves the collateral worthless, so the projected buffer is
 * negative infinity and the price floors at 0.
 */
export function projectDrop(
  buffer: number,
  dropPct: number,
  pNow?: number | null,
): DropProjection {
  const headroom = buffer - dropPct;
  const survives = Number.isFinite(buffer) && dropPct < buffer;
  let projectedBuffer: number;
  if (!Number.isFinite(buffer) || !Number.isFinite(dropPct)) {
    projectedBuffer = NaN;
  } else if (dropPct >= 1) {
    projectedBuffer = Number.NEGATIVE_INFINITY;
  } else {
    projectedBuffer = 1 - (1 - buffer) / (1 - dropPct);
  }
  const projectedPrice =
    pNow != null && Number.isFinite(pNow)
      ? pNow * Math.max(0, 1 - dropPct)
      : null;
  return { dropPct, survives, headroom, projectedBuffer, projectedPrice };
}

/** Project a set of drop scenarios at once, e.g. a weekend gap ladder. */
export function projectDrops(
  buffer: number,
  drops: number[],
  pNow?: number | null,
): DropProjection[] {
  return drops.map((d) => projectDrop(buffer, d, pNow));
}
