"use client";

import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { compactNumber, pct, usd } from "@/lib/format";

import { explorerTx } from "../_lib/connection";
import type { ExecState, QuoteState } from "../_lib/flow";
import type { Constituent, WeightedLeg } from "../_lib/weights";
import { legColor } from "./WeightDonut";

function sharesOut(quote: QuoteState["quote"], decimals: number): number | null {
  if (!quote?.outAmount) return null;
  const raw = Number(quote.outAmount);
  if (!Number.isFinite(raw)) return null;
  return raw / 10 ** decimals;
}

function LegStatus({ exec }: { exec?: ExecState }) {
  if (!exec || exec.status === "idle") return null;
  if (exec.status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        confirmed
        {exec.signature ? (
          <a
            href={explorerTx(exec.signature)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline decoration-dotted hover:text-emerald-300"
          >
            tx <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </span>
    );
  }
  if (exec.status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 text-red-400"
        title={exec.error}
      >
        <XCircle className="h-3.5 w-3.5" aria-hidden />
        failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      {exec.status === "sent" ? "confirming" : exec.status}
    </span>
  );
}

function QuoteCell({ leg, quote }: { leg: WeightedLeg; quote?: QuoteState }) {
  if (!quote || quote.status === "idle") {
    return <span className="text-muted-foreground/50">not previewed</span>;
  }
  if (quote.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> quoting
      </span>
    );
  }
  if (quote.status === "error") {
    return (
      <span className="text-red-400" title={quote.error}>
        no route
      </span>
    );
  }
  const shares = sharesOut(quote.quote, leg.decimals);
  const impact = quote.quote?.priceImpactPct
    ? Number(quote.quote.priceImpactPct) * 100
    : null;
  return (
    <span className="tabular-nums text-foreground">
      {shares !== null ? `${shares.toFixed(6)} ${leg.ticker}` : "quoted"}
      {impact !== null ? (
        <span className="ml-1 text-[11px] text-muted-foreground">
          ({pct(impact, { fractionDigits: impact < 0.01 ? 4 : 2 })} impact)
        </span>
      ) : null}
    </span>
  );
}

export function BasketTable({
  legs,
  untradable,
  quotes,
  execs,
}: {
  legs: WeightedLeg[];
  untradable: Constituent[];
  quotes: Record<string, QuoteState>;
  execs: Record<string, ExecState>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground/80">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 text-right font-medium">Weight</th>
            <th className="px-3 py-2 text-right font-medium">Buy (USDC)</th>
            <th className="px-3 py-2 text-right font-medium">Est. out</th>
            <th className="px-3 py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {legs.map((leg, i) => (
            <tr key={leg.mint} className="hover:bg-card/40">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: legColor(i) }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{leg.ticker}</span>
                      {leg.usdPrice !== null ? (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {usd(leg.usdPrice)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {leg.name}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                {pct(leg.weight, { isRatio: true })}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {usd(leg.usdAmount)}
              </td>
              <td className="px-3 py-2.5 text-right text-xs">
                <QuoteCell leg={leg} quote={quotes[leg.mint]} />
              </td>
              <td className="px-3 py-2.5 text-right text-xs">
                <LegStatus exec={execs[leg.mint]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {untradable.length > 0 ? (
        <div className="border-t border-border bg-card/30 px-3 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-amber-400/90">
            In the theme, not routable today
          </p>
          <div className="flex flex-wrap gap-1.5">
            {untradable.map((c) => (
              <Badge
                key={c.mint}
                variant="outline"
                className="border-border/70 text-[11px] font-normal text-muted-foreground"
                title={`On-chain liquidity ${usd(c.liquidityUsd)}`}
              >
                {c.ticker}
                <span className="ml-1 text-muted-foreground/60">
                  ${compactNumber(c.liquidityUsd)}
                </span>
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-tight text-muted-foreground/70">
            These names have a verified mint but too little on-chain liquidity to
            route a clean fill, so the budget deploys into the routable legs above.
          </p>
        </div>
      ) : null}
    </div>
  );
}
