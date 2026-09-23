// Small number formatters for the Opening Bell UI.
// House style: no em dashes, no comma before "and" or "or".

/** Price in quote-per-base. Prices here are small, so keep significant digits. */
export function formatPrice(n: number): string {
  if (!isFinite(n) || n === 0) return "0";
  if (n < 0.001) return n.toExponential(3);
  if (n < 1) return n.toPrecision(4);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Compact human number, e.g. 12,300 -> 12.3K, 1,200,000 -> 1.2M. */
export function formatCompact(n: number): string {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Percentage from a 0..1 fraction. */
export function formatPercent(fraction: number, digits = 0): string {
  return (fraction * 100).toFixed(digits) + "%";
}
