// Formatting helpers shared across modules. Plain functions, safe on server and
// client. Non-finite or null inputs return "n/a" rather than "NaN" or a crash.

const PLACEHOLDER = "n/a";

/** USD currency, 2 decimals by default. */
export function usd(
  value: number | null | undefined,
  opts?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  const min = opts?.minFractionDigits ?? 2;
  const max = opts?.maxFractionDigits ?? Math.max(min, 2);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(value);
}

/**
 * Percent string. By default `value` is already a percentage number (e.g. -1.72
 * renders "-1.72%"), which matches Jupiter's priceChange24h. Pass isRatio to
 * treat it as a fraction (0.025 renders "2.50%"). Pass signed for a leading "+".
 */
export function pct(
  value: number | null | undefined,
  opts?: { isRatio?: boolean; signed?: boolean; fractionDigits?: number },
): string {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  const v = opts?.isRatio ? value * 100 : value;
  const digits = opts?.fractionDigits ?? 2;
  const sign = opts?.signed && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

/** Compact number, e.g. 4.96B for a market cap or 1.2M for liquidity. */
export function compactNumber(
  value: number | null | undefined,
  opts?: { fractionDigits?: number },
): string {
  if (value == null || !Number.isFinite(value)) return PLACEHOLDER;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: opts?.fractionDigits ?? 2,
  }).format(value);
}
