"use client";

import { useEffect, useState } from "react";
import { loadTokens } from "@aadukalam/data";

// The 20 most liquid tickers, resolved once from the registry.
const TICKERS = loadTokens()
  .filter((t) => (t.liquidityUsd ?? 0) > 0)
  .slice(0, 20);
const IDS = TICKERS.map((t) => t.mint).join(",");

type Quote = { price: number; change: number };

// A live price ticker. Client component, polls the Jupiter price proxy every 12s,
// shows the price and 24h change, and keeps scrolling via the CSS marquee.
export function TickerMarquee() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/jupiter?op=price&ids=${IDS}`);
        const d = await r.json();
        if (!alive) return;
        const next: Record<string, Quote> = {};
        for (const t of TICKERS) {
          const e = d?.[t.mint];
          if (e?.usdPrice)
            next[t.ticker] = { price: e.usdPrice, change: e.priceChange24h ?? 0 };
        }
        if (Object.keys(next).length) {
          setQuotes(next);
          setLive(true);
        }
      } catch {
        // keep the last good quotes on a transient error
      }
    }
    load();
    const id = setInterval(load, 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const row = TICKERS.map((t) => ({ ticker: t.ticker, q: quotes[t.ticker] }));
  const doubled = [...row, ...row];

  return (
    <div className="relative overflow-hidden border-y border-border/60 py-3 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 bg-background/85 pr-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span
          className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse-glow bg-primary" : "bg-muted-foreground/40"}`}
        />
        {live ? "Live" : "..."}
      </div>
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap pl-16">
        {doubled.map((t, i) => (
          <span key={i} className="flex items-center gap-2 font-mono text-sm">
            <span className="font-semibold text-foreground">{t.ticker}</span>
            {t.q ? (
              <>
                <span className="text-muted-foreground">${t.q.price.toFixed(2)}</span>
                <span className={t.q.change >= 0 ? "text-primary" : "text-red-400"}>
                  {t.q.change >= 0 ? "+" : ""}
                  {t.q.change.toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-muted-foreground/40">--</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
