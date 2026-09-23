"use client";

import { useState } from "react";
import { Coins, HandCoins, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  computeDividendUsdc,
  formatMultiplier,
  newMultiplierFromYield,
} from "../_lib/math";
import { formatUnits, formatUsdc, shortAddress } from "../_lib/format";
import type { ActionResult, PositionView } from "../_lib/types";
import { Field } from "./Field";
import { TxResult } from "./TxResult";

// The holder's live position, read from the position PDA, plus a projected next
// payout and the claim action. Every number here is on-chain state except the
// projection, which is clearly labeled an estimate.
export function PositionPanel({
  position,
  usdcDecimals,
  connected,
  disabled,
  busy,
  onClaim,
  onRefresh,
  refreshing,
  result,
}: {
  position: PositionView | null;
  usdcDecimals: number;
  connected: boolean;
  disabled: boolean;
  busy: boolean;
  onClaim: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  result: ActionResult | null;
}) {
  const [yieldPct, setYieldPct] = useState("2.5");
  const [price, setPrice] = useState("180");

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold">Your position</h2>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
      >
        <RefreshCw
          className={refreshing ? "h-3 w-3 animate-spin" : "h-3 w-3"}
          aria-hidden
        />
        refresh
      </button>
    </div>
  );

  if (!connected) {
    return (
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
        {header}
        <p className="mt-3 text-xs text-muted-foreground">
          Connect a wallet to read your on-chain position.
        </p>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
        {header}
        <p className="mt-3 text-xs text-muted-foreground">
          No position for this wallet and stock mint yet. Deposit above to open
          one at the 1.0x baseline.
        </p>
      </div>
    );
  }

  const claimable = position.claimableUsdcBaseUnits;
  const canClaim = !disabled && !busy && claimable > 0n;

  const yieldNum = Number(yieldPct);
  const priceNum = Number(price);
  const projectionValid = Number.isFinite(yieldNum) && yieldNum > 0 && Number.isFinite(priceNum) && priceNum > 0;
  const projectedBps = projectionValid
    ? newMultiplierFromYield(position.lastMultiplierBps, yieldNum)
    : position.lastMultiplierBps;
  const projectedUsdc = projectionValid
    ? computeDividendUsdc({
        principalBaseUnits: position.principalBaseUnits,
        stockDecimals: position.stockDecimals,
        oldMultiplierBps: position.lastMultiplierBps,
        newMultiplierBps: projectedBps,
        pricePerShareUsd: priceNum,
        usdcDecimals,
      })
    : 0n;

  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
      {header}

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Principal deposited
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums">
            {formatUnits(position.principalBaseUnits, position.stockDecimals)}
          </dd>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Current multiplier
          </dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums">
            {formatMultiplier(position.lastMultiplierBps)}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <dt className="text-[10px] uppercase tracking-wide text-primary/80">
            Claimable USDC
          </dt>
          <dd className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums text-primary">
            <Coins className="h-4 w-4" aria-hidden />
            {formatUsdc(claimable)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[10px] text-muted-foreground/60">
        Position PDA holder {shortAddress(position.owner, 6, 6)}, stock mint{" "}
        {shortAddress(position.stockMint, 6, 6)}.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onClaim} disabled={!canClaim}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <HandCoins className="h-4 w-4" aria-hidden />
          )}
          Claim USDC
        </Button>
        {claimable === 0n ? (
          <span className="text-[11px] text-muted-foreground">
            Nothing to claim yet. A recorded rebase credits this balance.
          </span>
        ) : null}
      </div>

      <TxResult result={result} />

      <div className="mt-5 rounded-lg border border-border/60 bg-background/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Next expected payout (estimate)
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
          What a rebase of this size would pay on your principal. The real
          dividend is set by the keeper from the actual rebase, this is a preview.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field
            label="Dividend yield %"
            value={yieldPct}
            onChange={setYieldPct}
            inputMode="decimal"
          />
          <Field
            label="Price per share (USD)"
            value={price}
            onChange={setPrice}
            inputMode="decimal"
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatMultiplier(position.lastMultiplierBps)} to{" "}
            {formatMultiplier(projectedBps)}
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatUsdc(projectedUsdc)}
          </span>
        </div>
      </div>
    </div>
  );
}
