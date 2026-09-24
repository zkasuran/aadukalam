"use client";

// Nightguard dashboard. Reads a Kamino obligation for a wallet (connected or
// pasted), runs the pure buffer math from _lib/health.ts over the raw numbers,
// and shows the health gauge, the liquidation price against the market clock, a
// danger-before-the-weekend projection and the arm or deleverage action.
//
// klend-sdk and @solana/kit never enter this client bundle. The only server
// touch is fetch("/api/nightguard/...") which returns plain JSON or a base64
// transaction. Signing happens in the wallet on a mainnet connection, never on
// the server.
// House style: no em dashes, no comma before "and" or "or".

import * as React from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { AlertTriangle, Moon } from "lucide-react";

import { WalletButton } from "@/components/solana/WalletButton";
import { MarketClock } from "@/components/market/MarketClock";
import { Button } from "@/components/ui/button";
import { usd, pct } from "@/lib/format";
import { fetchPythPrices, pythHumanPrice } from "@aadukalam/sdk";

import {
  liquidationBuffer,
  liquidationPrice,
  healthBand,
  maxSafeDrop,
} from "../_lib/health";
import type { ObligationHealth, ObligationResponse } from "../_lib/types";
import { BAND_META } from "./bands";
import { HealthGauge } from "./HealthGauge";
import { ProjectionChart } from "./ProjectionChart";
import { DeleveragePanel } from "./DeleveragePanel";

const XSTOCKS_MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || "https://api.mainnet-beta.solana.com";
const SAFE_TARGET = 0.3; // buffer we suggest repaying back up to

// An illustrative single collateral position, clearly labeled, so the module can
// be demonstrated without a live Kamino position. Real mints, reserves and a
// real Pyth feed id, but the amounts are made up. NVDAx collateral, USDC debt.
const EXAMPLE: ObligationHealth = {
  found: true,
  owner: "Example (not a live wallet)",
  market: XSTOCKS_MARKET,
  obligation: null,
  userTotalDeposit: 1125,
  userTotalBorrow: 660,
  userTotalBorrowBorrowFactorAdjusted: 660,
  borrowLimit: 618.75,
  borrowLiquidationLimit: 731.25,
  netAccountValue: 465,
  loanToValue: 0.5867,
  liquidationLtv: 0.65,
  collateral: [
    {
      reserve: "7B66Az3tJhAo4bLkX8PzTixQ9ZGyHkkjxfVLhF26sP5q",
      mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
      symbol: "NVDAx",
      amount: 5,
      decimals: 8,
      price: 225,
      valueUsd: 1125,
      liqThreshold: 0.65,
      maxLtv: 0.55,
      validPrice: true,
      pythFeedId:
        "4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
    },
  ],
  debt: [
    {
      reserve: "97zoywd8mPZsGTg8q1wdD2Wgkdrs2tqusp1Qqcxbyj7E",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      symbol: "USDC",
      amount: 660,
      decimals: 6,
      price: 1,
      valueUsd: 660,
    },
  ],
  slot: 0,
  fetchedAt: new Date(0).toISOString(),
  cluster: "mainnet-beta",
};

interface Loaded {
  loading: boolean;
  health: ObligationHealth | null;
  error: string | null;
  isExample: boolean;
}

// Small pulsing marker that the readout is polling live and refreshing.
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  );
}

export function NightguardDashboard() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const connected = publicKey?.toBase58() ?? null;

  const [addressInput, setAddressInput] = React.useState("");
  const [state, setState] = React.useState<Loaded>({
    loading: false,
    health: null,
    error: null,
    isExample: false,
  });

  // Keep the input in step with a freshly connected wallet, without clobbering a
  // pasted address the user typed on purpose.
  React.useEffect(() => {
    if (connected && addressInput === "") setAddressInput(connected);
  }, [connected, addressInput]);

  const load = React.useCallback(async (owner: string, opts?: { background?: boolean }) => {
    const q = owner.trim();
    if (!q) return;
    const background = opts?.background ?? false;
    if (!background) {
      setState((s) => ({ ...s, loading: true, error: null, isExample: false }));
    }
    try {
      const res = await fetch(
        `/api/nightguard/obligation?owner=${encodeURIComponent(q)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as ObligationResponse;
      if (!json.ok || !json.health) {
        // A background poll keeps the last good read rather than dropping it on
        // a transient RPC hiccup. A foreground read surfaces the error.
        if (background) return;
        setState({ loading: false, health: null, error: json.error ?? "read failed", isExample: false });
        return;
      }
      setState({ loading: false, health: json.health, error: null, isExample: false });
    } catch (err) {
      if (background) return;
      setState({
        loading: false,
        health: null,
        error: err instanceof Error ? err.message : String(err),
        isExample: false,
      });
    }
  }, []);

  const showExample = React.useCallback(() => {
    setState({ loading: false, health: EXAMPLE, error: null, isExample: true });
  }, []);

  // Once a real position is read, keep it current on a 15s background poll so the
  // health gauge, buffer and liquidation price track mainnet. The example
  // position is static illustrative data, so it is never polled.
  const liveOwner =
    state.health?.found && !state.isExample ? state.health.owner : null;
  React.useEffect(() => {
    if (!liveOwner) return;
    const timer = setInterval(() => {
      void load(liveOwner, { background: true });
    }, 15_000);
    return () => clearInterval(timer);
  }, [liveOwner, load]);

  const canSign =
    !state.isExample &&
    !!connected &&
    !!state.health?.found &&
    connected === state.health?.owner;

  const signAndSend = React.useMemo(() => {
    if (!canSign) return null;
    return async (base64: string): Promise<string> => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(bytes);
      // The obligation is on mainnet, so send on a mainnet connection rather
      // than the app's default devnet one.
      const mainnet =
        connection.rpcEndpoint.includes("devnet")
          ? new Connection(MAINNET_RPC, "confirmed")
          : connection;
      return sendTransaction(tx, mainnet);
    };
  }, [canSign, connection, sendTransaction]);

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="font-medium">Wallet to guard</span>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Paste a Solana address or connect a wallet"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="flex gap-2">
            <Button onClick={() => load(addressInput)} disabled={state.loading || !addressInput.trim()}>
              {state.loading ? "Reading…" : "Read position"}
            </Button>
            <WalletButton />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <MarketClock />
          <span>
            Reads the live xStocks Kamino market on mainnet. No funds move, nothing
            is signed on the server.
          </span>
          <button className="underline hover:text-foreground" onClick={showExample}>
            Or load an example position
          </button>
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {state.health && !state.health.found && (
        <p className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
          No Kamino obligation found for this address in the xStocks market. Borrow
          against a tokenized stock in Swipe first, then Nightguard has something to
          watch.
        </p>
      )}

      {state.health && state.health.found && (
        <Readout
          health={state.health}
          isExample={state.isExample}
          canSign={canSign}
          signAndSend={signAndSend}
        />
      )}
    </div>
  );
}

interface ReadoutProps {
  health: ObligationHealth;
  isExample: boolean;
  canSign: boolean;
  signAndSend: ((base64: string) => Promise<string>) | null;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Readout({ health: h, isExample, canSign, signAndSend }: ReadoutProps) {
  const hasDebt = h.userTotalBorrow > 0;
  const buffer = liquidationBuffer(
    h.userTotalBorrowBorrowFactorAdjusted,
    h.borrowLiquidationLimit,
  );
  const band = hasDebt ? healthBand(buffer) : "safe";
  const meta = BAND_META[band];

  const collat = h.collateral.filter((c) => c.valueUsd > 0 && c.liqThreshold > 0);
  const single = collat.length === 1 ? collat[0] : null;
  const pNow = single ? single.price : null;
  const pLiq =
    single && hasDebt
      ? liquidationPrice(
          h.userTotalBorrowBorrowFactorAdjusted,
          single.amount,
          single.liqThreshold,
        )
      : null;

  const suggestedRepay = hasDebt
    ? Math.max(
        0,
        h.userTotalBorrowBorrowFactorAdjusted - h.borrowLiquidationLimit * (1 - SAFE_TARGET),
      )
    : 0;

  // Pyth 24/7 fair value for the single collateral, through our keyed proxy.
  // Falls back to nothing when the key is missing or the feed does not resolve.
  // Polled every 15s so the off-hours price line tracks the live feed.
  const [pyth, setPyth] = React.useState<number | null>(null);
  const feedId = single?.pythFeedId ?? null;
  React.useEffect(() => {
    let alive = true;
    setPyth(null);
    if (!feedId) return;
    const readPyth = async () => {
      try {
        const prices = await fetchPythPrices([feedId]);
        const p = prices[0];
        if (p && alive) {
          const human = pythHumanPrice(p);
          if (Number.isFinite(human)) setPyth(human);
        }
      } catch {
        // no live Pyth price, the gauge still uses the Kamino oracle price
      }
    };
    void readPyth();
    const timer = setInterval(readPyth, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [feedId]);

  return (
    <div className="space-y-6">
      {isExample && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Example position, illustrative only. The mints, reserves and Pyth feed
            are real, the balances are made up. It is not a live on-chain
            obligation, so it cannot be signed.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(240px,300px)_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-5">
          {!isExample && (
            <div className="mb-1 flex w-full justify-end">
              <LiveBadge />
            </div>
          )}
          <HealthGauge
            buffer={buffer}
            band={band}
            caption="of collateral value can fall before liquidation"
          />
          <span
            className={`mt-3 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${meta.chip}`}
          >
            {meta.label}
          </span>
          <p className="mt-2 text-center text-xs text-muted-foreground">{meta.blurb}</p>
        </div>

        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Stat
            label="Liquidation price"
            value={pLiq != null ? usd(pLiq) : hasDebt ? "basket" : "n/a"}
            sub={single ? `${single.symbol} oracle` : hasDebt ? "multi-collateral, see projection" : "no debt"}
          />
          <Stat
            label="Current price"
            value={pNow != null ? usd(pNow) : "n/a"}
            sub={single ? single.symbol : "Kamino oracle"}
          />
          <Stat
            label="Buffer to liquidation"
            value={hasDebt ? pct(buffer, { isRatio: true }) : "100%"}
            sub={hasDebt ? `${pct(maxSafeDrop(buffer), { isRatio: true })} uniform drop` : "no borrow"}
            tone={hasDebt ? meta.chip.split(" ").find((c) => c.startsWith("text-")) : undefined}
          />
          <Stat label="Net value" value={usd(h.netAccountValue)} />
          <Stat label="Borrowed" value={usd(h.userTotalBorrow)} sub={`limit ${usd(h.borrowLimit)}`} />
          <Stat label="Collateral" value={usd(h.userTotalDeposit)} />
        </div>
      </div>
      {/* off-hours risk */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-lg font-semibold">Off-hours and weekend risk</h3>
          <MarketClock className="ml-auto" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          The US equity session gates the real stock feed, but the xStock oracle
          Kamino liquidates against trades 24/7. So a thin weekend or overnight
          wick still moves this buffer and can liquidate the position while you
          sleep, with no chance to react.{" "}
          {hasDebt && maxSafeDrop(buffer) < 1 && (
            <span className="text-foreground">
              A {pct(maxSafeDrop(buffer), { isRatio: true })} gap wipes the buffer
              out.
            </span>
          )}
        </p>
        {single && (
          <p className="mt-2 text-xs text-muted-foreground">
            Pyth 24/7 fair value for {single.symbol}:{" "}
            <span className="text-foreground">
              {pyth != null ? usd(pyth) : "no live Pyth price"}
            </span>
            {pyth != null && (
              <> vs Kamino oracle {usd(pNow)}. The buffer math uses the oracle.</>
            )}
          </p>
        )}
      </div>

      {hasDebt && (
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <h3 className="text-lg font-semibold">If the collateral gaps down</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Buffer remaining as the collateral falls in an off-hours move. The debt
            is a stable, so only the collateral leg shrinks.
          </p>
          <div className="mt-3">
            <ProjectionChart buffer={buffer} price={pNow} />
          </div>
        </div>
      )}

      {hasDebt && (
        <DeleveragePanel
          owner={h.owner}
          debt={h.debt}
          suggestedRepay={suggestedRepay}
          canSign={canSign}
          signAndSend={signAndSend}
          isExample={isExample}
        />
      )}
    </div>
  );
}
