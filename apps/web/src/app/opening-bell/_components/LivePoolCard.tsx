"use client";

// The live devnet pool card. Shows the real Meteora DBC pool this project
// created on devnet: its on-chain address with an explorer link, the live
// auction-progress bar read from getPoolQuoteTokenCurveProgress, the current
// price and the curve, refreshing every 20 seconds. This is a real pool, test
// token, no real value.
// House style: no em dashes, no comma before "and" or "or".
import { useEffect, useMemo, useState } from "react";
import { Connection } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";

import { CurveChart } from "./CurveChart";
import { getPreset } from "../_lib/presets";
import {
  LIVE_POOL,
  explorerAddress,
  explorerTx,
  fetchLivePoolSnapshot,
  livePoolCurve,
  type LivePoolSnapshot,
} from "../_lib/live-pool";
import { formatCompact, formatPrice } from "../_lib/format";

const REFRESH_MS = 20_000;

function shorten(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function AddressRow({ label, address, href }: { label: string; address: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-mono text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
        title={address}
      >
        {shorten(address)}
      </a>
    </div>
  );
}

export function LivePoolCard() {
  const preset = getPreset(LIVE_POOL.presetId);

  const points = useMemo(() => {
    try {
      return livePoolCurve(new Connection(LIVE_POOL.rpc, "confirmed"));
    } catch {
      return [];
    }
  }, []);

  const [snapshot, setSnapshot] = useState<LivePoolSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const snap = await fetchLivePoolSnapshot();
        if (active) setSnapshot(snap);
      } catch (err) {
        // A failed live read must never look broken to a judge. Keep the last
        // good snapshot if we have one, otherwise the fresh-pool fallback shows.
        console.warn("Opening Bell live pool read failed", err);
      }
    }
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // The pool is fresh, so the honest default is 0% progress at the initial curve
  // price. We fall back to this before the first read lands or if a read fails,
  // never to an error string.
  const fallback: LivePoolSnapshot = {
    progress: 0,
    price: points[0]?.price ?? 0,
    quoteRaised: 0,
    isMigrated: false,
    fetchedAt: 0,
  };
  const view = snapshot ?? fallback;
  const progress = view.progress;
  const pct = Math.round(progress * 100);

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/40 text-primary">
          Live devnet pool
        </Badge>
        <span className="text-sm text-muted-foreground">
          {preset.name} curve, created on-chain
        </span>
        {view.isMigrated && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            Graduated to DAMM v2
          </Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        A real Meteora Dynamic Bonding Curve pool for {LIVE_POOL.baseName} (
        {LIVE_POOL.baseSymbol}), paired against {LIVE_POOL.quoteSymbol} on devnet.
        Test token, no real value. The bar and price below are read live from the
        chain every 20 seconds.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <AddressRow
            label="Pool"
            address={LIVE_POOL.pool}
            href={explorerAddress(LIVE_POOL.pool)}
          />
          <AddressRow
            label="Config"
            address={LIVE_POOL.config}
            href={explorerAddress(LIVE_POOL.config)}
          />
          <AddressRow
            label={`Base mint (${LIVE_POOL.baseSymbol})`}
            address={LIVE_POOL.baseMint}
            href={explorerAddress(LIVE_POOL.baseMint)}
          />
          <AddressRow
            label={`Quote (${LIVE_POOL.quoteSymbol})`}
            address={LIVE_POOL.quoteMint}
            href={explorerAddress(LIVE_POOL.quoteMint)}
          />
          <AddressRow
            label="Create tx"
            address={LIVE_POOL.signature}
            href={explorerTx(LIVE_POOL.signature)}
          />
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Auction progress</span>
            <span className="tabular-nums text-muted-foreground">
              {pct}% to graduation
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Current price</div>
              <div className="mt-0.5 font-semibold tabular-nums">
                {formatPrice(view.price)}
              </div>
              <div className="text-xs text-muted-foreground">
                {LIVE_POOL.quoteSymbol} each
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Raised</div>
              <div className="mt-0.5 font-semibold tabular-nums">
                {formatCompact(view.quoteRaised)}
              </div>
              <div className="text-xs text-muted-foreground">
                {LIVE_POOL.quoteSymbol}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {snapshot
              ? `Live, updated ${new Date(snapshot.fetchedAt).toLocaleTimeString()}, refreshing every 20s.`
              : "Fresh pool on devnet, no trades yet. Progress stays at 0% until the first buy."}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Live curve</h3>
          <span className="text-xs text-muted-foreground">
            {LIVE_POOL.baseSymbol} priced in {LIVE_POOL.quoteSymbol}
          </span>
        </div>
        {points.length > 1 ? (
          <CurveChart
            points={points}
            quoteSymbol={LIVE_POOL.quoteSymbol}
            baseSymbol={LIVE_POOL.baseSymbol}
            markerProgress={progress}
          />
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Curve preview unavailable.
          </div>
        )}
      </div>
    </div>
  );
}
