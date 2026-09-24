"use client";

import { Star, X } from "lucide-react";

import type { JupiterPriceMap } from "@aadukalam/sdk";

import type { ReceiptRow } from "../_lib/types";
import { fmtPrice } from "../_lib/format";
import { toggleWatch, useWatchlist, watchKey } from "../_lib/watchlist";

// Compact watchlist strip for the Tessera surface. Reads the shared watchlist
// store and shows the watched T-Tokens with their live price, so a user can keep
// an eye on the tokens they care about across reloads. Browser-only, no account.
export function WatchlistStrip({
  rows,
  livePrices,
}: {
  rows: ReceiptRow[];
  livePrices: JupiterPriceMap;
}) {
  const watched = useWatchlist();
  const items = rows.filter((r) => watched.has(watchKey(r.provider, r.mint)));
  if (items.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2.5">
      <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
        Watchlist ({items.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((r) => {
          const price = livePrices[r.mint]?.usdPrice ?? null;
          return (
            <span
              key={`${r.provider}:${r.mint}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs"
            >
              <span className="font-medium text-foreground">{r.symbol}</span>
              <span className="tabular-nums text-muted-foreground">
                {price != null ? fmtPrice(price) : "..."}
              </span>
              <button
                type="button"
                onClick={() => toggleWatch(watchKey(r.provider, r.mint))}
                aria-label={`Remove ${r.symbol} from watchlist`}
                className="text-muted-foreground/70 hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
