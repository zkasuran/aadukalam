"use client";

import { ShieldCheck, AlertTriangle } from "lucide-react";

import { usd, pct } from "@/lib/format";
import type { QuoteBorrowResponse } from "@/app/api/kamino/_lib/kamino";

import { Tile } from "./Tile";

function Notice({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  const cls =
    tone === "error"
      ? "border-red-500/40 bg-red-500/5 text-red-300"
      : "border-amber-500/40 bg-amber-500/5 text-amber-300";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function BorrowTerms({ quote }: { quote: QuoteBorrowResponse }) {
  const p = quote.projection;
  const thinCushion = p.bufferPct < 0.15;
  const health = Number.isFinite(p.healthFactor) ? p.healthFactor.toFixed(2) : "n/a";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Borrow terms</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Borrowed, not sold
        </span>
      </div>

      {!p.borrowAllowed ? (
        <Notice tone="error">
          This borrow exceeds the collateral limit for {quote.collateral.symbol}. Lower the spend or
          post more collateral.
        </Notice>
      ) : null}
      {p.liquidatableNow ? (
        <Notice tone="error">
          The resulting position would be liquidatable right away. Post more collateral.
        </Notice>
      ) : thinCushion && p.borrowAllowed ? (
        <Notice tone="warn">
          Thin cushion. {quote.collateral.symbol} would only need to fall{" "}
          {pct(p.bufferPct, { isRatio: true })} before liquidation.
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Collateral value" value={usd(p.collateralValueUsd)} hint={`${quote.collateralAmount} ${quote.collateral.symbol} live`} />
        <Tile label="You spend" value={usd(quote.spendUsdc)} hint="borrowed USDC" />
        <Tile
          label="New liquidation price"
          value={usd(p.liquidationPrice)}
          hint={`${quote.collateral.symbol} now ${usd(quote.collateral.oraclePrice)}`}
          tone="warn"
        />
        <Tile label="Effective LTV" value={pct(p.ltvUsed, { isRatio: true })} hint={`max ${pct(p.maxLtv, { isRatio: true })}`} />
        <Tile label="Liquidation LTV" value={pct(p.liquidationLtv, { isRatio: true })} hint="single collateral" />
        <Tile label="Borrow APR" value={pct(quote.borrowApr, { isRatio: true })} hint="USDC reserve, live" />
        <Tile
          label="Health factor"
          value={health}
          hint="liq limit / debt"
          tone={p.healthFactor >= 1.5 ? "up" : p.healthFactor >= 1.15 ? "warn" : "down"}
        />
        <Tile
          label="Price cushion"
          value={pct(p.bufferPct, { isRatio: true })}
          hint="drop before liquidation"
          tone={thinCushion ? "warn" : "up"}
        />
        <Tile label="Borrowable max" value={usd(p.borrowableUsdc)} hint={`at ${pct(p.maxLtv, { isRatio: true })} LTV`} />
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        No share is sold, so there is no taxable disposal. You borrow USDC against the collateral and
        keep the upside. Liquidation price is the {quote.collateral.symbol} price at which the position
        would be liquidated, from live Kamino reserve reads on mainnet. LTV and threshold are the live
        governance values, not fixed numbers.
      </p>
    </div>
  );
}
