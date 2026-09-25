// PreStocks pre-IPO valuation desk: pure math over the PreStocks rows. No fetch,
// no React, so it is unit tested directly. PreStocks is the only provider that
// publishes BOTH a platform mark valuation and an on-chain implied valuation
// (tokenPrice * companyShares), so the gap between them is a real signal: how far
// the on-chain token market is repricing each pre-IPO name from its mark. Every
// number here is derived from fields PreStocks actually returns, never invented.

import type { ReceiptRow } from "./types";

export interface ValuationLeg {
  row: ReceiptRow;
  /** signed premium (+) or discount (-) of tokenPrice vs markPrice, as a fraction. */
  premium: number;
  /** implied minus mark valuation in USD, signed. */
  valuationGap: number;
}

export interface ValuationDesk {
  legs: ValuationLeg[]; // ranked, largest absolute premium first
  markTotal: number; // sum of mark valuations
  impliedTotal: number; // sum of implied valuations
  /** aggregate spread of implied vs mark across the book, as a fraction. */
  spread: number;
  /** the single most over-mark name, or null when the book is empty. */
  topPremium: ValuationLeg | null;
  /** the single most under-mark name, or null. */
  topDiscount: ValuationLeg | null;
  count: number;
}

function usable(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/**
 * Build the valuation desk from PreStocks rows. A row counts toward the totals
 * only when both its mark and implied valuations are usable, so a missing field
 * never silently reads as zero. Ranking is by absolute premium, biggest first.
 */
export function buildValuationDesk(rows: ReceiptRow[]): ValuationDesk {
  const legs: ValuationLeg[] = [];
  let markTotal = 0;
  let impliedTotal = 0;

  for (const row of rows) {
    if (!usable(row.markValuation) || !usable(row.impliedValuation)) continue;
    if (!usable(row.markPrice) || row.markPrice <= 0 || !usable(row.price)) continue;
    const premium = row.premiumPct != null ? row.premiumPct : row.price / row.markPrice - 1;
    if (!usable(premium)) continue;
    markTotal += row.markValuation;
    impliedTotal += row.impliedValuation;
    legs.push({ row, premium, valuationGap: row.impliedValuation - row.markValuation });
  }

  legs.sort((a, b) => Math.abs(b.premium) - Math.abs(a.premium));

  const premiums = legs.filter((l) => l.premium > 0).sort((a, b) => b.premium - a.premium);
  const discounts = legs.filter((l) => l.premium < 0).sort((a, b) => a.premium - b.premium);

  return {
    legs,
    markTotal,
    impliedTotal,
    spread: markTotal > 0 ? impliedTotal / markTotal - 1 : 0,
    topPremium: premiums[0] ?? null,
    topDiscount: discounts[0] ?? null,
    count: legs.length,
  };
}

/** Compact USD, e.g. $1.70T, $138.0B, $32.1M. Valuations here are large. */
export function compactUsd(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  if (v >= 1e12) return `${sign}$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${sign}$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(1)}K`;
  return `${sign}$${v.toFixed(0)}`;
}
