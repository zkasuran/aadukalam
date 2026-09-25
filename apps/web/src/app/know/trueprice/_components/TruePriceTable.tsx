"use client";

// TruePriceTable is the signature list: every tokenized stock with its live
// on-chain price, the Pyth fair value (or an honest "unavailable"), the
// premium/discount against the best available anchor and the session state.
// Data is real, batched through our server proxies and auto-refreshes. A
// missing Pyth key is surfaced in a banner and the fair value falls back to the
// underlying equity reference, never a fabricated number.

import * as React from "react";

import { Button } from "@/components/ui/button";
import { usd, pct } from "@/lib/format";

import { cx } from "../_lib/cx";
import { MARKET_STATE_SHORT, type MarketInfo, type MarketState } from "../_lib/market";
import type { TruePriceRow } from "../_lib/trueprice";
import { loadSnapshot, type TruePriceSnapshot } from "../_lib/data";

// Auto-refresh cadence. Kept at 15s so the screen reads as live without
// hammering the keyless upstreams behind our proxies (never below 12s).
const REFRESH_MS = 15000;

// How long a row keeps its highlight after its on-chain price moves. Matches the
// tp-row-flash keyframe below so the class is dropped exactly as the pulse ends.
const FLASH_MS = 1400;

// One-shot row pulse in the module's primary accent, injected once so the effect
// stays inside this file and touches no shared stylesheet. prefers-reduced-motion
// is already neutralised globally in globals.css, so this respects it for free.
const FLASH_CSS = `
@keyframes tp-row-flash {
  0% { background-color: hsl(155 89% 51% / 0.16); }
  100% { background-color: hsl(155 89% 51% / 0); }
}
.tp-row-flash { animation: tp-row-flash 1.4s ease-out; }
`;

type SortKey = "liquidity" | "drift";

const DOT_CLASS: Record<MarketState, string> = {
  regular: "bg-primary",
  premarket: "bg-yellow-400",
  afterhours: "bg-orange-400",
  closed: "bg-muted-foreground",
  weekend: "bg-muted-foreground",
};

function driftTextClass(drift: TruePriceRow["drift"]): string {
  if (drift === "premium") return "text-primary";
  if (drift === "discount") return "text-destructive";
  return "text-muted-foreground";
}

function SessionChip({ market }: { market: MarketInfo }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cx("h-1.5 w-1.5 rounded-full", DOT_CLASS[market.state])} />
      {MARKET_STATE_SHORT[market.state]}
    </span>
  );
}

export function TruePriceTable({
  market,
  onSelect,
}: {
  market: MarketInfo;
  onSelect: (row: TruePriceRow, pythKeyMissing: boolean) => void;
}) {
  const [snap, setSnap] = React.useState<TruePriceSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("liquidity");
  const [now, setNow] = React.useState(() => Date.now());
  // Mints whose on-chain price moved on the latest poll, highlighted briefly.
  const [flashing, setFlashing] = React.useState<Set<string>>(new Set());
  // Last seen on-chain price per mint, used to diff between polls. A ref so the
  // stable refresh callback never goes stale on it.
  const prevPricesRef = React.useRef<Map<string, number>>(new Map());
  const flashTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const s = await loadSnapshot();
      setSnap(s);
      setError(
        s.jupiterOk ? null : "No live prices came back from Jupiter. Retrying on the next refresh.",
      );

      // Diff on-chain prices against the last poll. First load has no prior
      // prices, so nothing flashes until a real change lands.
      const prev = prevPricesRef.current;
      const next = new Map<string, number>();
      const changed = new Set<string>();
      for (const row of s.rows) {
        if (typeof row.dexPrice === "number" && Number.isFinite(row.dexPrice)) {
          next.set(row.mint, row.dexPrice);
          const before = prev.get(row.mint);
          if (before != null && before !== row.dexPrice) changed.add(row.mint);
        }
      }
      prevPricesRef.current = next;
      if (changed.size > 0) {
        setFlashing(changed);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashing(new Set()), FLASH_MS);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prices.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      clearInterval(clock);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [refresh]);

  const rows = React.useMemo(() => {
    const all = snap?.rows ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter((r) => r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      : all;
    const sorted = [...filtered];
    if (sortKey === "drift") {
      sorted.sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0));
    } else {
      sorted.sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0));
    }
    return sorted;
  }, [snap, query, sortKey]);

  const updatedAgo = snap ? Math.max(0, Math.round((now - snap.fetchedAt) / 1000)) : null;

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: FLASH_CSS }} />
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
          title="Prices auto-refresh every 15 seconds"
          aria-label="Live prices, auto-refreshing"
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
              aria-hidden="true"
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full bg-primary"
              aria-hidden="true"
            />
          </span>
          Live
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker or name"
          aria-label="Search ticker or name"
          className="h-9 w-52 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-1">
          <Button
            variant={sortKey === "liquidity" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSortKey("liquidity")}
          >
            Liquidity
          </Button>
          <Button
            variant={sortKey === "drift" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSortKey("drift")}
          >
            Biggest drift
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {updatedAgo != null ? <span>updated {updatedAgo}s ago</span> : null}
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </div>

      {snap?.pythKeyMissing ? (
        <div className="rounded-lg border border-border bg-card/60 p-3 text-sm">
          <span className="font-medium">Pyth fair value unavailable right now.</span>{" "}
          <span className="text-muted-foreground">
            The on-chain Pyth read did not return, so prices below are the live on-chain Jupiter
            price and premium or discount is measured against the underlying equity reference
            Jupiter returns for each xStock. Reload to retry the Pyth read.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Stock</th>
              <th className="px-4 py-2.5 text-right font-medium">On-chain</th>
              <th className="px-4 py-2.5 text-right font-medium">Pyth fair value</th>
              <th className="px-4 py-2.5 text-right font-medium">Premium / discount</th>
              <th className="px-4 py-2.5 text-right font-medium">Session</th>
            </tr>
          </thead>
          <tbody>
            {loading && !snap ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Loading live prices…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No stocks match your search.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.mint}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(r, !!snap?.pythKeyMissing)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(r, !!snap?.pythKeyMissing);
                    }
                  }}
                  className={cx(
                    "cursor-pointer border-t border-border transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
                    flashing.has(r.mint) && "tp-row-flash",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.ticker}</div>
                    <div className="text-xs text-muted-foreground">{r.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    <div>{usd(r.dexPrice)}</div>
                    <div
                      className={cx(
                        "text-xs",
                        r.change24h == null
                          ? "text-muted-foreground"
                          : r.change24h >= 0
                            ? "text-primary"
                            : "text-destructive",
                      )}
                    >
                      {r.change24h == null ? "" : pct(r.change24h, { signed: true })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {snap?.pythKeyMissing ? (
                      <>
                        <div className="text-muted-foreground">Unavailable</div>
                        {r.underlying != null ? (
                          <div className="text-xs text-muted-foreground">ref {usd(r.underlying)}</div>
                        ) : null}
                      </>
                    ) : r.pythFair != null ? (
                      usd(r.pythFair)
                    ) : (
                      <span className="text-muted-foreground">n/a</span>
                    )}
                  </td>
                  <td
                    className={cx(
                      "px-4 py-3 text-right font-mono tabular-nums",
                      driftTextClass(r.drift),
                    )}
                  >
                    <div>
                      {r.premium == null
                        ? "n/a"
                        : pct(r.premium, { isRatio: true, signed: true, fractionDigits: 3 })}
                    </div>
                    <div className="text-xs text-muted-foreground">vs {r.fair.label}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SessionChip market={market} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {snap ? `${rows.length} of ${snap.rows.length} tokenized stocks. ` : ""}
        On-chain price from the Jupiter price API, Pyth 24/7 fair value read on-chain from Solana
        mainnet (no API key), read-only. Click a row for the live chart and the off-hours story.
      </p>
    </div>
  );
}

export default TruePriceTable;
