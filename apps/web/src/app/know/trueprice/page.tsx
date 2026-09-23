"use client";

// TruePrice: the 24/7 fair-value screen. Lists every tokenized stock with its
// live on-chain price, the Pyth fair value (or an honest fallback when no key is
// set), the premium/discount and the market-open clock. Click a row for the
// live chart and the off-hours drift story. The page owns the shared market
// clock and the selected-ticker state, the table and detail own their data.

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { MarketClock } from "@/components/market/MarketClock";
import { ModuleSidebar } from "@/components/nav/ModuleSidebar";

import { computeMarketState, type MarketInfo } from "./_lib/market";
import type { TruePriceRow } from "./_lib/trueprice";
import { TruePriceTable } from "./_components/TruePriceTable";
import { TickerDetail } from "./_components/TickerDetail";

interface Selection {
  row: TruePriceRow;
  pythKeyMissing: boolean;
}

export default function Page() {
  const [selected, setSelected] = React.useState<Selection | null>(null);
  const [market, setMarket] = React.useState<MarketInfo>(() => computeMarketState(new Date()));

  React.useEffect(() => {
    const tick = () => setMarket(computeMarketState(new Date()));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="outline" className="border-primary/40 text-primary">
                KNOW
              </Badge>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">TruePrice</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                A 24/7 fair value for tokenized stocks. See the live on-chain price next to a fair
                value, the premium or discount between them and the market-open clock, so you can
                tell when an off-hours price has drifted from the shares behind it.
              </p>
            </div>
            <MarketClock />
          </div>

          <div className="mt-8">
            {selected ? (
              <TickerDetail
                row={selected.row}
                market={market}
                pythKeyMissing={selected.pythKeyMissing}
                onBack={() => setSelected(null)}
              />
            ) : (
              <TruePriceTable
                market={market}
                onSelect={(row, pythKeyMissing) => setSelected({ row, pythKeyMissing })}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
