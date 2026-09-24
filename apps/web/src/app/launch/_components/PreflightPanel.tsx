"use client";

// Shows the result of the FREE preflight: the SOL cost, the resolved stock pair
// and the ClawPump + Meteora path. Nothing here moves funds. The funded step is
// gated separately in FundedHandoff.

import { CircleDollarSign, Route, Clock, Coins } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PreflightResult } from "@/app/api/clawpump/_lib/clawpump";

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function PreflightPanel({
  result,
  pairSymbol,
  agentId,
}: {
  result: PreflightResult;
  pairSymbol: string;
  agentId: string;
}) {
  if (result.keyMissing) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <p className="font-medium text-amber-400">Preflight offline: no server key</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">{result.message}</p>
      </div>
    );
  }
  if (!result.ok || !result.payment) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Preflight failed: {result.error ?? "unknown error"}
      </div>
    );
  }

  const p = result.payment;
  const creationFee = p.breakdown?.creationFeeSol ?? p.amountSol;
  const token = result.preflightToken ?? "";
  const shortToken = token ? `${token.slice(0, 10)}…${token.slice(-6)}` : "n/a";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
          Preflight priced live
        </Badge>
        <span className="text-xs text-muted-foreground">
          Nothing minted, nothing paid. This is a dry run.
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<CircleDollarSign className="h-3.5 w-3.5" aria-hidden />}
          label="Launch cost"
          value={`${p.amountSol} SOL`}
          sub={`${p.amountLamports.toLocaleString()} lamports`}
        />
        <Stat
          icon={<Coins className="h-3.5 w-3.5" aria-hidden />}
          label="Stock pair"
          value={pairSymbol || result.pair?.symbol || "SOL"}
          sub={result.pair?.kind === "stock" ? "xStock quote" : "SOL quote"}
        />
        <Stat
          icon={<Route className="h-3.5 w-3.5" aria-hidden />}
          label="Pool venue"
          value="Meteora DBC"
          sub="via ClawPump"
        />
        <Stat
          icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
          label="Quote valid"
          value={`${p.validForSeconds}s`}
          sub="then re-preflight"
        />
      </div>

      <dl className="mt-4 space-y-1.5 rounded-xl border border-border bg-card/40 p-4 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Creation fee</dt>
          <dd className="tabular-nums">{creationFee} SOL</dd>
        </div>
        {p.breakdown?.devBuySol ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Dev buy</dt>
            <dd className="tabular-nums">{p.breakdown.devBuySol} SOL</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Pay to</dt>
          <dd className="break-all text-right font-mono">{p.payTo}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Agent id</dt>
          <dd className="break-all text-right font-mono">{agentId}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Preflight token</dt>
          <dd className="break-all text-right font-mono">{shortToken}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
        ClawPump prices the launch, signs a token bound to this exact request and
        holds it for {p.validForSeconds} seconds. A pump.fun native curve only
        quotes in SOL, so a stock quote routes through a Meteora Dynamic Bonding
        Curve pool. The 75% creator-fee share on this token then accrues in the
        paired stock asset.
      </p>
    </div>
  );
}
