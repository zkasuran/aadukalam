// Display formatting for Receipt. Kept pure so the same helpers run on the server
// route and in the client scorecards.

/** Compact USD: $556.4K, $4.84M, $950.0B, $1.71T. */
export function fmtUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** Plain price with two decimals and thousands separators. */
export function fmtPrice(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Signed percent from a fraction: 0.275 becomes "+27.5%". */
export function fmtPct(fraction: number | null, digits = 1): string {
  if (fraction === null || !Number.isFinite(fraction)) return "n/a";
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** Integer with thousands separators. */
export function fmtInt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return Math.round(n).toLocaleString("en-US");
}

/** Large count as a compact figure: 1.17B shares, 33.8M shares. */
export function fmtCount(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** How many times bigger a is than b, as "300,000x" or "1,700x". */
export function fmtMultiple(a: number | null, b: number | null): string {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
    return "n/a";
  }
  const m = a / b;
  if (m >= 1000) return `${Math.round(m).toLocaleString("en-US")}x`;
  if (m >= 10) return `${m.toFixed(0)}x`;
  return `${m.toFixed(1)}x`;
}

/** Shorten a Solana mint for display: first 4 and last 4. */
export function shortMint(mint: string): string {
  if (mint.length <= 10) return mint;
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}
