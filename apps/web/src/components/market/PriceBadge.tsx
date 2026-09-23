"use client";

// PriceBadge renders a live price with a small source label. Two modes:
//  - pass `price` (human USD) plus `source` to render a value you already have.
//  - pass `ticker` (or mint) and it fetches: Pyth fair value first through our
//    keyed proxy, then the Jupiter on-chain price as a fallback, then "no live
//    price" when neither resolves. Every value carries an honest source label.

import * as React from "react";
import { getToken, bestPythFeed } from "@aadukalam/data";
import { fetchPythPrices, pythHumanPrice, getJupiterPrice } from "@aadukalam/sdk";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/format";

type PriceSource = "pyth" | "jupiter" | "none";

export interface PriceBadgeProps {
  /** ticker or mint understood by @aadukalam/data. When set, the badge fetches. */
  ticker?: string;
  /** a pre-resolved human USD price to render directly. */
  price?: number;
  /** source label for a pre-resolved price. */
  source?: PriceSource;
  className?: string;
}

const SOURCE_LABEL: Record<PriceSource, string> = {
  pyth: "Pyth",
  jupiter: "Jupiter",
  none: "no live price",
};

export function PriceBadge({ ticker, price, source = "pyth", className }: PriceBadgeProps) {
  const [value, setValue] = React.useState<number | null>(price ?? null);
  const [resolved, setResolved] = React.useState<PriceSource>(price != null ? source : "none");
  const [loading, setLoading] = React.useState<boolean>(price == null && !!ticker);

  React.useEffect(() => {
    // Direct-price mode: just mirror the props.
    if (price != null) {
      setValue(price);
      setResolved(source);
      setLoading(false);
      return;
    }
    if (!ticker) {
      setValue(null);
      setResolved("none");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      const token = getToken(ticker);

      // Pyth fair value first, through the keyed server proxy.
      const feed = token ? bestPythFeed(token) : null;
      if (feed) {
        try {
          const prices = await fetchPythPrices([feed]);
          const p = prices[0];
          if (p) {
            const human = pythHumanPrice(p);
            if (Number.isFinite(human)) {
              if (!cancelled) {
                setValue(human);
                setResolved("pyth");
                setLoading(false);
              }
              return;
            }
          }
        } catch {
          // fall through to Jupiter
        }
      }

      // On-chain DEX price from Jupiter as the fallback.
      if (token?.mint) {
        try {
          const map = await getJupiterPrice([token.mint]);
          const usdPrice = map[token.mint]?.usdPrice;
          if (typeof usdPrice === "number" && Number.isFinite(usdPrice)) {
            if (!cancelled) {
              setValue(usdPrice);
              setResolved("jupiter");
              setLoading(false);
            }
            return;
          }
        } catch {
          // no live price
        }
      }

      if (!cancelled) {
        setValue(null);
        setResolved("none");
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [ticker, price, source]);

  const label = SOURCE_LABEL[value == null ? "none" : resolved];

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-sm",
        className,
      )}
    >
      <span className="tabular-nums">
        {loading ? "…" : value == null ? "no price" : usd(value)}
      </span>
      <span
        className={cn(
          "text-[10px] uppercase tracking-wide",
          value == null ? "text-muted-foreground" : "text-primary",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export default PriceBadge;
