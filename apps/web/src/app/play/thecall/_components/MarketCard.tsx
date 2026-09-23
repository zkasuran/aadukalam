"use client";

// The Call: one market card. Shows the live Pyth price against the target, the
// YES/NO pool split, the caller's position and the action for the phase the
// market is in: bet while open, resolve after the deadline, claim once settled.
// Pyth is the settlement authority here, the price is not decoration.

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usd, pct } from "@/lib/format";
import {
  impliedProbability,
  winningSideLabel,
  sideLabel,
  computePayout,
  type Side,
} from "../_lib/math";
import { THECALL_USDC_DECIMALS } from "../_lib/constants";
import type { BetView, LivePriceState, MarketView } from "../_lib/types";
import { BetSlip } from "./BetSlip";

function fmtUsdc(base: bigint): string {
  return usd(Number(base) / 10 ** THECALL_USDC_DECIMALS);
}

function countdown(deadline: number, nowSec: number): string {
  const d = deadline - nowSec;
  if (d <= 0) return "deadline passed";
  const days = Math.floor(d / 86_400);
  const hours = Math.floor((d % 86_400) / 3600);
  const mins = Math.floor((d % 3600) / 60);
  if (days > 0) return `closes in ${days}d ${hours}h`;
  if (hours > 0) return `closes in ${hours}h ${mins}m`;
  return `closes in ${mins}m`;
}

const PHASE_BADGE: Record<MarketView["phase"], { label: string; cls: string }> = {
  betting: { label: "Open", cls: "border-emerald-500/50 text-emerald-300" },
  awaiting: { label: "Awaiting resolve", cls: "border-yellow-500/50 text-yellow-300" },
  resolved: { label: "Resolved", cls: "border-muted-foreground/40 text-muted-foreground" },
};

export interface MarketCardProps {
  market: MarketView;
  live: LivePriceState | null;
  userBet: BetView | null;
  connected: boolean;
  busy: boolean;
  nowSec: number;
  onBet: (market: MarketView, side: Side, amountBase: bigint) => Promise<void>;
  onResolve: (market: MarketView) => Promise<void>;
  onClaim: (market: MarketView) => Promise<void>;
}

export function MarketCard(props: MarketCardProps) {
  const { market, live, userBet, nowSec } = props;
  const badge = PHASE_BADGE[market.phase];
  const title = market.ticker ?? "Unknown feed";
  const prob = impliedProbability(market.totalYes, market.totalNo);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Badge variant="outline" className={badge.cls}>
              {badge.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {market.tokenName ?? market.feedIdHex.slice(0, 16) + "…"}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-mono">{usd(market.targetDollars)}</div>
          <div className="text-xs text-muted-foreground">target</div>
        </div>
      </div>

      <PriceVsTarget market={market} live={live} />
      <PoolBar market={market} prob={prob} />

      <p className="mt-3 text-xs text-muted-foreground">
        {market.phase === "resolved"
          ? `settled ${winningSideLabel(market)} won`
          : countdown(market.deadline, nowSec)}
      </p>

      {userBet && <Position market={market} bet={userBet} />}

      <div className="mt-4">
        <ActionArea {...props} />
      </div>
    </div>
  );
}

function PriceVsTarget({ market, live }: { market: MarketView; live: LivePriceState | null }) {
  const price = live?.priceUsd ?? null;
  const distance = price != null && market.targetDollars > 0
    ? ((price - market.targetDollars) / market.targetDollars) * 100
    : null;
  const leaning = price != null ? (price >= market.targetDollars ? "YES" : "NO") : null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Live Pyth price</span>
        {live?.keyMissing ? (
          <span className="text-xs text-yellow-300">no Pyth key, price unavailable</span>
        ) : price == null ? (
          <span className="text-xs text-muted-foreground">no live price</span>
        ) : (
          <span className="text-xs text-primary">Pyth</span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-mono text-xl">{price == null ? "no price" : usd(price)}</span>
        {distance != null && (
          <span className={distance >= 0 ? "text-sm text-emerald-400" : "text-sm text-rose-400"}>
            {pct(distance, { signed: true })} vs target
          </span>
        )}
      </div>
      {leaning && market.phase !== "resolved" && (
        <p className="mt-1 text-xs text-muted-foreground">
          settling now would resolve {leaning}
        </p>
      )}
      {live?.confUsd != null && price != null && (
        <p className="mt-1 text-xs text-muted-foreground">confidence +/- {usd(live.confUsd)}</p>
      )}
    </div>
  );
}

function PoolBar({
  market,
  prob,
}: {
  market: MarketView;
  prob: ReturnType<typeof impliedProbability>;
}) {
  const yesPct = prob.yesProb != null ? prob.yesProb * 100 : 50;
  const staked = prob.total > 0n;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-emerald-400">
          YES {fmtUsdc(market.totalYes)}
          {staked && prob.yesProb != null ? ` · ${(prob.yesProb * 100).toFixed(0)}%` : ""}
        </span>
        <span className="font-medium text-rose-400">
          {staked && prob.noProb != null ? `${(prob.noProb * 100).toFixed(0)}% · ` : ""}
          NO {fmtUsdc(market.totalNo)}
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-rose-500/30">
        <div className="h-full bg-emerald-500" style={{ width: `${staked ? yesPct : 50}%` }} />
      </div>
      {!staked && <p className="mt-1 text-xs text-muted-foreground">no bets yet</p>}
    </div>
  );
}

function Position({ market, bet }: { market: MarketView; bet: BetView }) {
  const won = market.resolved && bet.side === market.winningSide;
  return (
    <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs">
      Your position: {fmtUsdc(bet.amount)} on {sideLabel(bet.side)}
      {market.resolved && (won ? " · won" : " · lost")}
      {bet.claimed && " · claimed"}
    </div>
  );
}

function ResolveNote() {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Resolve is permissionless once the deadline passes. It posts a fresh Pyth price update through
      the pro receiver, which this program requires, then reads it on chain to set the winner. The
      program is not yet deployed to devnet, so resolve is built and ready but not confirmed live.
    </p>
  );
}

function ActionArea(props: MarketCardProps) {
  const { market, userBet, connected, busy, onBet, onResolve, onClaim } = props;

  if (!connected) {
    return <p className="text-sm text-muted-foreground">Connect a wallet to bet.</p>;
  }

  if (market.phase === "betting") {
    return (
      <BetSlip
        market={market}
        userBet={userBet}
        decimals={THECALL_USDC_DECIMALS}
        busy={busy}
        onBet={(side, amountBase) => onBet(market, side, amountBase)}
      />
    );
  }

  if (market.phase === "awaiting") {
    return (
      <div>
        <Button variant="secondary" disabled={busy} onClick={() => onResolve(market)}>
          {busy ? "Resolving…" : "Resolve with Pyth"}
        </Button>
        <ResolveNote />
      </div>
    );
  }

  // resolved
  if (!userBet) {
    return (
      <p className="text-sm text-muted-foreground">
        Market resolved, {winningSideLabel(market)} won.
      </p>
    );
  }

  const won = userBet.side === market.winningSide;
  if (!won) {
    return <p className="text-sm text-rose-400">This position lost.</p>;
  }
  if (userBet.claimed) {
    return <p className="text-sm text-emerald-400">Winnings claimed.</p>;
  }

  const payout = computePayout({
    side: userBet.side,
    amount: userBet.amount,
    winningSide: market.winningSide,
    totalYes: market.totalYes,
    totalNo: market.totalNo,
    resolved: true,
  });

  return (
    <div>
      <Button disabled={busy} onClick={() => onClaim(market)}>
        {busy ? "Claiming…" : `Claim ${fmtUsdc(payout)}`}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        stake {fmtUsdc(userBet.amount)} plus a pro-rata share of the losing pool
      </p>
    </div>
  );
}
