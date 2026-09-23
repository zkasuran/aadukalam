"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { AlertTriangle } from "lucide-react";

import { tokensByTheme } from "@aadukalam/data";
import { buildSwapTx, getJupiterPrice, getQuote } from "@aadukalam/sdk";

import { Card } from "@/components/ui/card";

import { getMainnetConnection } from "../_lib/connection";
import type { ExecState, QuoteState } from "../_lib/flow";
import { defaultThemeId, themeSummaries } from "../_lib/themes";
import {
  buildBasketPlan,
  dedupeByUnderlying,
  isTradable,
  toConstituent,
  USDC_MINT,
  type Constituent,
  type WeightRule,
} from "../_lib/weights";
import { BasketTable } from "./BasketTable";
import { BuyFlow } from "./BuyFlow";
import { ControlBar } from "./ControlBar";
import { RebalanceNote } from "./RebalanceNote";
import { ThemeGrid } from "./ThemeGrid";
import { WeightDonut } from "./WeightDonut";

const SLIPPAGE_BPS = 50;
// Keyless Jupiter is 0.5 RPS, so the legs are quoted and sent one at a time with
// a gap between them. A configured JUPITER_API_KEY on the proxy raises the limit.
const QUOTE_DELAY_MS = 1200;
const BUY_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ConvictionDashboard() {
  const themes = useMemo(() => themeSummaries(), []);
  const [theme, setTheme] = useState(() => defaultThemeId(themes));
  const [rule, setRule] = useState<WeightRule>("market-cap");
  const [budget, setBudget] = useState(100);
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [enrichError, setEnrichError] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  const [execs, setExecs] = useState<Record<string, ExecState>>({});
  const [previewing, setPreviewing] = useState(false);
  const [buying, setBuying] = useState(false);

  const { publicKey, sendTransaction, connected } = useWallet();

  // Load the deduped theme members, then enrich them with a live Jupiter price
  // pull (liquidity, market cap, 24h change). Registry numbers seed the view so
  // it renders instantly and survives a rate-limited price call.
  useEffect(() => {
    let alive = true;
    const seed = dedupeByUnderlying(tokensByTheme(theme)).map(toConstituent);
    setConstituents(seed);
    setQuotes({});
    setExecs({});
    setEnrichError(false);
    (async () => {
      const prices = await getJupiterPrice(seed.map((c) => c.mint));
      if (!alive) return;
      if (Object.keys(prices).length === 0) {
        setEnrichError(true);
        return;
      }
      setConstituents((prev) =>
        prev.map((c) => {
          const p = prices[c.mint];
          if (!p) return c;
          return {
            ...c,
            liquidityUsd: p.liquidity ?? c.liquidityUsd,
            marketCap: p.stockData?.mcap ?? null,
            momentum: p.priceChange24h ?? null,
            usdPrice: p.usdPrice ?? null,
          };
        }),
      );
    })();
    return () => {
      alive = false;
    };
  }, [theme]);

  // A new rule or budget invalidates any preview and any in-flight status.
  useEffect(() => {
    setQuotes({});
    setExecs({});
  }, [rule, budget]);

  const tradable = useMemo(
    () => constituents.filter((c) => isTradable(c)),
    [constituents],
  );
  const untradable = useMemo(
    () => constituents.filter((c) => !isTradable(c)),
    [constituents],
  );
  const plan = useMemo(
    () => buildBasketPlan(tradable, rule, budget),
    [tradable, rule, budget],
  );
  const totalPlanned = useMemo(
    () => plan.reduce((a, l) => a + l.usdAmount, 0),
    [plan],
  );
  const anyQuoted = useMemo(
    () => plan.some((l) => quotes[l.mint]?.status === "ok"),
    [plan, quotes],
  );

  const handlePreview = useCallback(async () => {
    const legs = plan.filter((l) => l.weight > 0 && l.baseUnitsIn !== "0");
    if (legs.length === 0) return;
    setPreviewing(true);
    for (const leg of legs) {
      setQuotes((q) => ({ ...q, [leg.mint]: { status: "loading" } }));
      try {
        const quote = await getQuote({
          inputMint: USDC_MINT,
          outputMint: leg.mint,
          amount: leg.baseUnitsIn,
          slippageBps: SLIPPAGE_BPS,
        });
        setQuotes((q) => ({ ...q, [leg.mint]: { status: "ok", quote } }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setQuotes((q) => ({ ...q, [leg.mint]: { status: "error", error: message } }));
      }
      await sleep(QUOTE_DELAY_MS);
    }
    setPreviewing(false);
  }, [plan]);

  const handleBuy = useCallback(async () => {
    if (!publicKey) return;
    const legs = plan.filter((l) => quotes[l.mint]?.status === "ok");
    if (legs.length === 0) return;
    setBuying(true);
    const connection = getMainnetConnection();
    for (const leg of legs) {
      const state = quotes[leg.mint];
      if (!state?.quote) continue;
      setExecs((e) => ({ ...e, [leg.mint]: { status: "building" } }));
      try {
        const built = await buildSwapTx({
          quoteResponse: state.quote,
          userPublicKey: publicKey.toBase58(),
        });
        const tx = VersionedTransaction.deserialize(
          Buffer.from(built.swapTransaction, "base64"),
        );
        setExecs((e) => ({ ...e, [leg.mint]: { status: "signing" } }));
        const signature = await sendTransaction(tx, connection);
        setExecs((e) => ({ ...e, [leg.mint]: { status: "sent", signature } }));
        await connection.confirmTransaction(
          {
            signature,
            blockhash: tx.message.recentBlockhash,
            lastValidBlockHeight: built.lastValidBlockHeight,
          },
          "confirmed",
        );
        setExecs((e) => ({ ...e, [leg.mint]: { status: "confirmed", signature } }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setExecs((e) => ({ ...e, [leg.mint]: { status: "failed", error: message } }));
      }
      await sleep(BUY_DELAY_MS);
    }
    setBuying(false);
  }, [plan, quotes, publicKey, sendTransaction]);

  return (
    <div className="mt-6 space-y-5">
      <ThemeGrid themes={themes} selected={theme} onSelect={setTheme} />
      <ControlBar rule={rule} onRule={setRule} budget={budget} onBudget={setBudget} />

      {enrichError ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Live prices are unavailable right now, so the weights use the registry
            liquidity figures. Quotes still route live when you preview.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <BasketTable
            legs={plan}
            untradable={untradable}
            quotes={quotes}
            execs={execs}
          />
          <BuyFlow
            connected={connected}
            tradableCount={plan.length}
            totalPlanned={totalPlanned}
            anyQuoted={anyQuoted}
            previewing={previewing}
            buying={buying}
            onPreview={handlePreview}
            onBuy={handleBuy}
          />
        </div>
        <div className="space-y-5">
          <Card className="p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Basket weights
            </p>
            <WeightDonut legs={plan} />
          </Card>
          <RebalanceNote rule={rule} />
        </div>
      </div>
    </div>
  );
}
