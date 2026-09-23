"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Sparkles, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";

import { XSTOCKS_REBASE } from "../_lib/constants";
import { formatUsdc, shortAddress } from "../_lib/format";
import {
  computeDividendUsdc,
  formatMultiplier,
  newMultiplierFromYield,
} from "../_lib/math";
import type { ActionResult, ConfigView, PositionView } from "../_lib/types";
import { Field } from "./Field";
import { TxResult } from "./TxResult";

// The keeper and admin surface. Initialize sets up the config and USDC vault and
// names the keeper. Record rebase is the devnet stand-in for the mainnet xStocks
// dividend rebase: the keeper posts the USDC value of a rebase to a holder.
export function KeeperPanel({
  connected,
  walletPubkey,
  config,
  walletIsKeeper,
  walletIsAdmin,
  disabled,
  position,
  usdcDecimals,
  busyInit,
  busyRebase,
  onInitialize,
  onRecordRebase,
  initResult,
  rebaseResult,
}: {
  connected: boolean;
  walletPubkey: string | null;
  config: ConfigView | null;
  walletIsKeeper: boolean;
  walletIsAdmin: boolean;
  disabled: boolean;
  position: PositionView | null;
  usdcDecimals: number;
  busyInit: boolean;
  busyRebase: boolean;
  onInitialize: (keeper: string, usdcMint: string) => void;
  onRecordRebase: (dividendUsdcBaseUnits: bigint, newMultiplierBps: number) => void;
  initResult: ActionResult | null;
  rebaseResult: ActionResult | null;
}) {
  const [keeperInput, setKeeperInput] = useState("");
  const [usdcMintInput, setUsdcMintInput] = useState("");
  const [yieldPct, setYieldPct] = useState("2.5");
  const [price, setPrice] = useState("180");

  const REBASE_LABEL = "devnet simulation of the mainnet xStocks rebase mechanism";

  const yieldNum = Number(yieldPct);
  const priceNum = Number(price);
  const hasPrincipal = position != null && position.principalBaseUnits > 0n;
  const projectionValid =
    hasPrincipal &&
    Number.isFinite(yieldNum) &&
    yieldNum > 0 &&
    Number.isFinite(priceNum) &&
    priceNum > 0;
  const currentBps = position?.lastMultiplierBps ?? 10000;
  const newBps = projectionValid
    ? newMultiplierFromYield(currentBps, yieldNum)
    : currentBps;
  const dividendUsdc =
    projectionValid && position
      ? computeDividendUsdc({
          principalBaseUnits: position.principalBaseUnits,
          stockDecimals: position.stockDecimals,
          oldMultiplierBps: currentBps,
          newMultiplierBps: newBps,
          pricePerShareUsd: priceNum,
          usdcDecimals,
        })
      : 0n;

  const canInitialize =
    connected &&
    !disabled &&
    !busyInit &&
    config == null &&
    usdcMintInput.trim().length > 0;
  const canRecord =
    connected &&
    !disabled &&
    !busyRebase &&
    config != null &&
    walletIsKeeper &&
    projectionValid &&
    dividendUsdc > 0n;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Admin setup</h2>
        </div>

        {config ? (
          <div className="mt-3 space-y-1 text-xs">
            <p className="text-muted-foreground">Config is live on devnet.</p>
            <p className="tabular-nums text-muted-foreground/80">
              admin {shortAddress(config.admin, 6, 6)}
              {walletIsAdmin ? " (you)" : ""}
            </p>
            <p className="tabular-nums text-muted-foreground/80">
              keeper {shortAddress(config.keeper, 6, 6)}
              {walletIsKeeper ? " (you)" : ""}
            </p>
            <p className="tabular-nums text-muted-foreground/80">
              USDC mint {shortAddress(config.usdcMint, 6, 6)}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              One-time setup. Creates the config and the program-owned USDC vault,
              and names the keeper allowed to record rebases.
            </p>
            <div className="mt-3 space-y-3">
              <Field
                label="Keeper pubkey"
                value={keeperInput}
                onChange={setKeeperInput}
                placeholder={walletPubkey ?? "Base58 pubkey"}
                hint="Blank uses your connected wallet as the keeper."
                mono
                disabled={busyInit}
              />
              <Field
                label="USDC mint"
                value={usdcMintInput}
                onChange={setUsdcMintInput}
                placeholder="Devnet USDC mint address"
                hint="The dividend mint the vault pays out. Read from config afterwards."
                mono
                disabled={busyInit}
              />
            </div>
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  onInitialize(
                    keeperInput.trim() || (walletPubkey ?? ""),
                    usdcMintInput.trim(),
                  )
                }
                disabled={!canInitialize}
              >
                {busyInit ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Wrench className="h-4 w-4" aria-hidden />
                )}
                Initialize
              </Button>
            </div>
            <TxResult result={initResult} />
          </>
        )}
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-card-foreground shadow">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Simulate a dividend rebase</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This is a {REBASE_LABEL}. On mainnet,{" "}
          <a
            href={XSTOCKS_REBASE.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {XSTOCKS_REBASE.label}
          </a>{" "}
          rebase the token supply on a dividend, so every balance grows. Here the
          keeper posts the USDC value of that rebase so it can be claimed as real
          cash instead.
        </p>

        {config && !walletIsKeeper ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              This wallet is not the configured keeper, so record_rebase would be
              rejected on-chain. Initialize with this wallet as keeper to record
              here.
            </p>
          </div>
        ) : null}

        {!config ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Initialize the config first.
          </p>
        ) : !hasPrincipal ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            The holder has no principal yet. Deposit a stock token first, then
            record a rebase against it.
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field
            label="Dividend yield %"
            value={yieldPct}
            onChange={setYieldPct}
            inputMode="decimal"
            disabled={busyRebase}
          />
          <Field
            label="Price per share (USD)"
            value={price}
            onChange={setPrice}
            inputMode="decimal"
            disabled={busyRebase}
          />
        </div>

        <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">New multiplier</span>
            <span className="tabular-nums">
              {formatMultiplier(currentBps)} to {formatMultiplier(newBps)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Dividend to credit</span>
            <span className="font-semibold tabular-nums text-primary">
              {formatUsdc(dividendUsdc)}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            The keeper computes this figure off chain, then record_rebase credits
            it to the holder.
          </p>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            onClick={() => onRecordRebase(dividendUsdc, newBps)}
            disabled={!canRecord}
          >
            {busyRebase ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            Record rebase
          </Button>
        </div>
        <TxResult result={rebaseResult} />
      </div>
    </div>
  );
}
