"use client";

// Fine Print: connect a wallet or paste an address, read the tokenized-stock
// holdings and see in plain English what the holder actually owns, plus the
// "same ticker, very different fine print" comparison. Real chain data only,
// no simulation. House style: no em dashes, no comma before "and" or "or".

import { useCallback, useMemo, useState } from "react";

import { getToken, loadTokens } from "@aadukalam/data";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleSidebar } from "@/components/nav/ModuleSidebar";

import { AddressBar } from "./_components/AddressBar";
import { ComparePanel } from "./_components/ComparePanel";
import { HoldingsPanel, type ScanStatus } from "./_components/HoldingsPanel";
import { fetchHoldings } from "./_lib/api";
import { describeHoldings, tallyHoldings } from "./_lib/holdings";
import type { HoldingView } from "./_lib/types";

export default function FinePrintPage() {
  const registry = useMemo(() => loadTokens(), []);

  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState<HoldingView[]>([]);

  const tally = useMemo(() => tallyHoldings(views), [views]);
  const heldMints = useMemo(
    () => new Set(views.filter((v) => v.known).map((v) => v.token.mint)),
    [views],
  );

  const scan = useCallback(async (addr: string) => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetchHoldings(addr);
      setViews(describeHoldings(res.balances, getToken));
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "read failed");
      setViews([]);
      setStatus("error");
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <Badge variant="outline" className="border-primary/40 text-primary">
            KNOW
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Fine Print</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A tokenized stock is not the share. Read what you actually own: real shares or synthetic
            exposure, voting, how a dividend reaches you, whether you can redeem and who is really on
            the hook for the backing.
          </p>

          <div className="mt-6">
            <AddressBar
              address={address}
              setAddress={setAddress}
              onScan={scan}
              busy={status === "loading"}
            />
          </div>

          <Tabs defaultValue="holdings" className="mt-6">
            <TabsList>
              <TabsTrigger value="holdings">Your holdings</TabsTrigger>
              <TabsTrigger value="compare">Same ticker, different fine print</TabsTrigger>
            </TabsList>

            <TabsContent value="holdings" className="mt-4">
              <HoldingsPanel status={status} error={error} views={views} tally={tally} />
            </TabsContent>

            <TabsContent value="compare" className="mt-4">
              <ComparePanel tokens={registry} heldMints={heldMints} />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
