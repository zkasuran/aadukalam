"use client";

import { useEffect, useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ReceiptResponse } from "../_lib/types";
import { useJupiterPrices } from "../_lib/useJupiterPrices";
import { ProviderPanel } from "./ProviderPanel";
import { WatchlistStrip } from "./WatchlistStrip";

interface Slice {
  loading: boolean;
  data: ReceiptResponse | null;
  error: string | null;
}

const INITIAL: Slice = { loading: true, data: null, error: null };

// Two isolated fetches, two isolated state slices. The providers are never merged
// into one array, so the PreStocks and Tessera bounty surfaces each read one
// source only. KALSHI, OPENAI and SPACEX collide by name across the two, so the
// mint plus the provider tag is the only key.
function useProvider(path: string): Slice {
  const [slice, setSlice] = useState<Slice>(INITIAL);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        const json = (await res.json()) as ReceiptResponse;
        if (alive) setSlice({ loading: false, data: json, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (alive) setSlice({ loading: false, data: null, error: message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [path]);
  return slice;
}

const GRADE_CHIPS: Array<{ letter: string; cls: string }> = [
  { letter: "A", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  { letter: "B", cls: "border-lime-500/40 bg-lime-500/10 text-lime-400" },
  { letter: "C", cls: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  { letter: "D", cls: "border-orange-500/40 bg-orange-500/10 text-orange-400" },
  { letter: "F", cls: "border-red-500/50 bg-red-500/10 text-red-400" },
];

function GradeLegend() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card/30 px-4 py-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        {GRADE_CHIPS.map((c) => (
          <span
            key={c.letter}
            className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold ${c.cls}`}
          >
            {c.letter}
          </span>
        ))}
      </span>
      <span>
        Grade weights: proof of reserve 35, independent audit 25, custody 15,
        legal isolation 10, price vs mark 15. Backing you can check is most of
        the score.
      </span>
    </div>
  );
}

export function ReceiptDashboard() {
  const tessera = useProvider("/api/receipt/tessera");
  const prestocks = useProvider("/api/receipt/prestocks");

  // Live Jupiter prices for the Tessera mints only. This drives the ACTION layer
  // (live price, premium vs mark, the trade CTA) and never touches PreStocks, so
  // the Tessera bounty surface stays a pure Tessera + Jupiter integration.
  const tesseraMints = useMemo(
    () => tessera.data?.rows.map((r) => r.mint) ?? [],
    [tessera.data]
  );
  const livePrices = useJupiterPrices(tesseraMints);
  const tesseraRows = tessera.data?.rows ?? [];

  return (
    <div className="mt-6">
      <GradeLegend />
      <Tabs defaultValue="tessera" className="w-full">
        <TabsList>
          <TabsTrigger value="tessera">Tessera</TabsTrigger>
          <TabsTrigger value="prestocks">PreStocks</TabsTrigger>
        </TabsList>

        <TabsContent value="tessera" className="mt-4">
          <WatchlistStrip rows={tesseraRows} livePrices={livePrices.map} />
          <ProviderPanel
            loading={tessera.loading}
            data={tessera.data}
            fetchError={tessera.error}
            livePrices={livePrices.map}
            pricedAt={livePrices.pricedAt}
            summary={
              <>
                <span className="font-medium text-foreground">Tessera</span>{" "}
                T-Tokens are loan participation rights held inside a Cayman SPC,
                with a Chainlink Proof-of-Reserve, Fireblocks custody and a
                published Accretion Labs audit. Receipt reads the three live
                tokens from the Tessera public API, prices them live on Jupiter
                and lets you trade each one with a wallet-signed swap.
              </>
            }
          />
        </TabsContent>

        <TabsContent value="prestocks" className="mt-4">
          <ProviderPanel
            loading={prestocks.loading}
            data={prestocks.data}
            fetchError={prestocks.error}
            summary={
              <>
                <span className="font-medium text-foreground">PreStocks</span>{" "}
                lists pre-IPO tokens with a price and a valuation but no proof of
                reserve, no attestation and no audit anywhere in its API. Receipt
                shows the price and valuation it does publish next to the backing
                it does not.
              </>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
