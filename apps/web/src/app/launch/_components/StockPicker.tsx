"use client";

// Pick the tokenized stock to pair the new token against. The list is the live
// ClawPump pump-pairs equities slice. The chosen mint becomes pumpQuoteMint, so
// ClawPump opens the Meteora DBC pool with that stock as the quote asset.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { AnnotatedAsset } from "@/app/api/clawpump/_lib/clawpump";

export function StockPicker({
  stocks,
  selectedMint,
  onSelect,
}: {
  stocks: AnnotatedAsset[];
  selectedMint: string;
  onSelect: (mint: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [stocks, query]);

  return (
    <div>
      <label className="relative block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 80+ tokenized stocks and ETFs"
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {filtered.map((s) => {
          const active = s.mint === selectedMint;
          return (
            <button
              key={s.mint}
              type="button"
              onClick={() => onSelect(s.mint)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-input hover:bg-accent"
              }`}
            >
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.imageUrl}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-full bg-muted" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{s.symbol}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {s.name}
                </span>
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
            No stock matches that search.
          </p>
        )}
      </div>
    </div>
  );
}
