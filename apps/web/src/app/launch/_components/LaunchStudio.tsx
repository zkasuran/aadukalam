"use client";

// Launch a stock-paired agent token. This is the Stocknized Agent flow: pick a
// tokenized stock to pair against, name the token, run a FREE ClawPump preflight
// that prices the launch and proves it opens a Meteora DBC pool against the
// stock, then hand off the funded launch as an explicit command. The app never
// fires the paid launch and never moves funds.
// House style: no em dashes, no comma before "and" or "or".

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Rocket, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isValidSolanaAddress } from "@aadukalam/sdk";
import type {
  AnnotatedAsset,
  PreflightResult,
  PumpPairsResult,
} from "@/app/api/clawpump/_lib/clawpump";

import { StockPicker } from "./StockPicker";
import { TokenForm, type TokenFormValues } from "./TokenForm";
import { PreflightPanel } from "./PreflightPanel";
import { FundedHandoff } from "./FundedHandoff";
import { fetchPumpPairs, postPreflight, newAgentId } from "../_lib/client";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: PreflightResult }
  | { kind: "error"; message: string };

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">
        {n}
      </span>
      <h2 className="font-semibold">{title}</h2>
    </div>
  );
}

export function LaunchStudio() {
  const [pairs, setPairs] = useState<PumpPairsResult | null>(null);
  const [pairsError, setPairsError] = useState<string | null>(null);
  const [selectedMint, setSelectedMint] = useState("");
  const [form, setForm] = useState<TokenFormValues>({
    name: "",
    symbol: "",
    description: "",
    walletAddress: "",
  });
  const [agentId, setAgentId] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Load the live pump-pairs list once. The public mirror needs no key, so this
  // always populates even when the server has no ClawPump key.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetchPumpPairs(controller.signal);
        if (controller.signal.aborted) return;
        setPairs(res);
        if (!res.ok) setPairsError(res.error ?? "could not load pairs");
        else if (res.stocks[0]) setSelectedMint((cur) => cur || res.stocks[0].mint);
      } catch (err) {
        if (!controller.signal.aborted) {
          setPairsError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => controller.abort();
  }, []);

  const stock = useMemo<AnnotatedAsset | undefined>(
    () => pairs?.stocks.find((s) => s.mint === selectedMint),
    [pairs, selectedMint],
  );

  // When the pair changes, seed the token identity and a fresh agent id without
  // clobbering edits the user already made, and drop any prior preflight.
  useEffect(() => {
    if (!stock) return;
    setAgentId(newAgentId(stock.symbol));
    setForm((f) => ({
      ...f,
      name: f.name || `Aadukalam ${stock.name} Agent`,
      symbol: f.symbol || `a${stock.symbol}`.toUpperCase().slice(0, 10),
      description:
        f.description ||
        `A stocknized agent token paired against the ${stock.name} tokenized stock, launched via ClawPump on a Meteora dynamic bonding curve.`,
    }));
    setPhase({ kind: "idle" });
  }, [stock]);

  const descLen = form.description.trim().length;
  const walletOk = isValidSolanaAddress(form.walletAddress);
  const canRun =
    !!stock &&
    form.name.trim().length > 0 &&
    form.symbol.trim().length > 0 &&
    descLen >= 20 &&
    descLen <= 500 &&
    walletOk;

  const onRun = useCallback(async () => {
    if (!stock || !canRun) return;
    setPhase({ kind: "loading" });
    try {
      const result = await postPreflight({
        name: form.name.trim(),
        symbol: form.symbol.trim(),
        description: form.description.trim(),
        imageUrl: stock.imageUrl ?? "",
        agentId,
        agentName: `${form.symbol.trim()} Launcher`,
        walletAddress: form.walletAddress.trim(),
        pumpQuoteMint: stock.mint,
      });
      setPhase({ kind: "done", result });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [stock, canRun, form, agentId]);

  const patchForm = useCallback(
    (p: Partial<TokenFormValues>) => setForm((f) => ({ ...f, ...p })),
    [],
  );

  const pairSymbol = stock?.symbol ?? "";

  return (
    <div className="mt-6 space-y-6">
      {/* Step 1: pick the stock to pair against */}
      <section className="rounded-xl border border-border bg-card p-4">
        <StepHead n={1} title="Pick a stock to pair against" />
        {pairs && pairs.ok ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              The token opens its pool quoted in this stock. Choosing it sets{" "}
              <code className="font-mono text-xs">pumpQuoteMint</code>, so ClawPump
              builds the Meteora curve against the stock rather than SOL.
            </p>
            <StockPicker
              stocks={pairs.stocks}
              selectedMint={selectedMint}
              onSelect={setSelectedMint}
            />
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <Store className="h-3 w-3" aria-hidden />
              {pairs.stocks.length} tokenized equities and ETFs, live from ClawPump
              pump-pairs.
            </p>
          </>
        ) : pairsError ? (
          <p className="text-sm text-destructive">
            Could not load the pump-pairs list: {pairsError}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading live
            stock pairs...
          </div>
        )}
      </section>

      {/* Step 2: name the token */}
      <section className="rounded-xl border border-border bg-card p-4">
        <StepHead n={2} title="Name the stock-paired token" />
        <TokenForm values={form} onChange={patchForm} pairSymbol={pairSymbol} />
      </section>

      {/* Step 3: free preflight */}
      <section className="rounded-xl border border-border bg-card p-4">
        <StepHead n={3} title="Preflight the launch (free, moves nothing)" />
        <p className="mb-3 text-sm text-muted-foreground">
          Prices the launch with ClawPump and returns the SOL cost, the pay-to
          address and a signed token. It mints nothing and pays nothing.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onRun} disabled={!canRun || phase.kind === "loading"}>
            {phase.kind === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Pricing
                preflight...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" aria-hidden /> Run free preflight
              </>
            )}
          </Button>
          {!canRun && stock ? (
            <span className="text-xs text-muted-foreground">
              {!walletOk
                ? "Enter a valid Solana payer wallet to preflight."
                : "Fill the name, symbol and a 20+ character description."}
            </span>
          ) : null}
        </div>

        {phase.kind === "done" ? (
          <div className="mt-4">
            <PreflightPanel result={phase.result} pairSymbol={pairSymbol} agentId={agentId} />
          </div>
        ) : null}
        {phase.kind === "error" ? (
          <p className="mt-4 text-sm text-destructive">Preflight failed: {phase.message}</p>
        ) : null}
      </section>

      {/* Step 4: funded handoff, gated */}
      {phase.kind === "done" && phase.result.ok ? (
        <section>
          <div className="flex items-center gap-2 px-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-destructive/40 text-xs font-semibold text-destructive">
              4
            </span>
            <h2 className="font-semibold">Fire the launch (funded, hand-off only)</h2>
            <Badge variant="outline" className="ml-1 border-destructive/40 text-destructive">
              real SOL
            </Badge>
          </div>
          <FundedHandoff result={phase.result} />
        </section>
      ) : null}
    </div>
  );
}
