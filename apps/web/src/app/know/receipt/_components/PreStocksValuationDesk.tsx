"use client";

// PreStocks pre-IPO valuation desk. PreStocks is the one provider that publishes
// both a platform mark valuation and an on-chain implied valuation, so this ranks
// its names by how far the on-chain token market has repriced each one from its
// mark. Every figure is read from the PreStocks API, computed in ./_lib/valuation,
// and labeled: with no proof of reserve this is a market-repricing read, never a
// backing claim.

import { TrendingUp, TrendingDown, Layers } from "lucide-react";

import type { ReceiptRow } from "../_lib/types";
import { buildValuationDesk, compactUsd } from "../_lib/valuation";

function pct(x: number): string {
  const s = x >= 0 ? "+" : "";
  return `${s}${(x * 100).toFixed(1)}%`;
}

function toneClass(x: number): string {
  if (x > 0.0005) return "text-emerald-400";
  if (x < -0.0005) return "text-rose-400";
  return "text-muted-foreground";
}

export function PreStocksValuationDesk({ rows }: { rows: ReceiptRow[] }) {
  const desk = buildValuationDesk(rows);
  if (desk.count === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold tracking-tight">Pre-IPO valuation desk</h3>
      </div>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        PreStocks publishes both a platform mark and the on-chain token price for each pre-IPO name,
        so the gap between the implied valuation and the mark is how far the token market has repriced
        it. With no proof of reserve this is a repricing read, not a backing claim. Both prices come
        from the PreStocks API.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Names priced</div>
          <div className="mt-1 font-mono text-lg tabular-nums">{desk.count}</div>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Implied vs mark</div>
          <div className="mt-1 font-mono text-lg tabular-nums">{compactUsd(desk.impliedTotal)}</div>
          <div className={`text-xs ${toneClass(desk.spread)}`}>{pct(desk.spread)} vs {compactUsd(desk.markTotal)}</div>
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3 w-3" aria-hidden /> Most over mark
          </div>
          <div className="mt-1 font-mono text-sm tabular-nums">{desk.topPremium?.row.company ?? "n/a"}</div>
          {desk.topPremium && <div className="text-xs text-emerald-400">{pct(desk.topPremium.premium)}</div>}
        </div>
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            <TrendingDown className="h-3 w-3" aria-hidden /> Most under mark
          </div>
          <div className="mt-1 font-mono text-sm tabular-nums">{desk.topDiscount?.row.company ?? "n/a"}</div>
          {desk.topDiscount && <div className="text-xs text-rose-400">{pct(desk.topDiscount.premium)}</div>}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Pre-IPO name</th>
              <th className="px-3 py-2 text-right font-medium">Token</th>
              <th className="px-3 py-2 text-right font-medium">Mark</th>
              <th className="px-3 py-2 text-right font-medium">Premium</th>
              <th className="px-3 py-2 text-right font-medium">Implied val</th>
              <th className="px-3 py-2 text-right font-medium">Mark val</th>
              <th className="px-3 py-2 text-right font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {desk.legs.map((leg) => (
              <tr key={leg.row.mint} className="border-t border-border/60">
                <td className="px-3 py-2">
                  <div className="font-medium">{leg.row.company}</div>
                  <div className="text-xs text-muted-foreground">{leg.row.sector ?? leg.row.symbol}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">${leg.row.price.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">${leg.row.markPrice.toFixed(2)}</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${toneClass(leg.premium)}`}>{pct(leg.premium)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{compactUsd(leg.row.impliedValuation ?? 0)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{compactUsd(leg.row.markValuation)}</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${toneClass(leg.valuationGap)}`}>{compactUsd(leg.valuationGap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
