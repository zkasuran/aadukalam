"use client";

import { AlertTriangle, Check, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usd } from "@/lib/format";

import type { GuardrailCheck } from "../_lib/guardrail";
import type { ProposedTradeResult } from "../_lib/types";

function CheckRow({ check }: { check: GuardrailCheck }) {
  const icon = check.skipped ? (
    <span className="mt-0.5 text-muted-foreground/60">–</span>
  ) : check.passed ? (
    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
  ) : (
    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
  );
  return (
    <li className="flex items-start gap-2">
      {icon}
      <span className="text-[11px] leading-snug">
        <span className="font-medium text-foreground">{check.label}.</span>{" "}
        <span className={check.passed || check.skipped ? "text-muted-foreground" : "text-red-300"}>
          {check.detail}
        </span>
      </span>
    </li>
  );
}

export function ProposedTradeCard({
  proposed,
  onSign,
  signing,
  signResult,
  walletConnected,
}: {
  proposed: ProposedTradeResult | null;
  onSign: () => void;
  signing: boolean;
  signResult: { sig?: string; error?: string } | null;
  walletConnected: boolean;
}) {
  if (!proposed) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-6 text-center text-sm text-muted-foreground">
        No trade proposed yet. Ask the agent to buy or use the manual form. Every
        proposal is checked against your guardrails before a transaction is built.
      </div>
    );
  }

  const { verdict, quote, tx, needsWallet, buildError } = proposed;
  const allowed = verdict.allowed;

  return (
    <div
      className={
        allowed
          ? "rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 shadow"
          : "rounded-xl border border-red-500/50 bg-red-500/5 p-4 shadow"
      }
    >
      <div className="flex items-center gap-2">
        {allowed ? (
          <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />
        ) : (
          <ShieldAlert className="h-5 w-5 text-red-400" aria-hidden />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {allowed ? "Trade allowed" : "Trade refused"}
          </p>
          <p className="text-xs text-muted-foreground">
            {proposed.side} {proposed.ticker} for {usd(proposed.usdAmount)}
          </p>
        </div>
      </div>

      {!allowed && verdict.reason ? (
        <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {verdict.reason}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1.5 rounded-lg border border-border/60 bg-background/40 p-3">
        {verdict.checks.map((c) => (
          <CheckRow key={c.code} check={c} />
        ))}
      </ul>

      {allowed && quote ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
            <p className="text-muted-foreground">Estimated out</p>
            <p className="tabular-nums text-foreground">
              {quote.estOut.toLocaleString("en-US", { maximumFractionDigits: 6 })} {quote.estOutLabel}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
            <p className="text-muted-foreground">Price impact</p>
            <p className="tabular-nums text-foreground">
              {quote.priceImpactPct == null ? "n/a" : `${quote.priceImpactPct.toFixed(3)}%`}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
            <p className="text-muted-foreground">Slippage</p>
            <p className="tabular-nums text-foreground">{(quote.slippageBps / 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
            <p className="text-muted-foreground">Route</p>
            <p className="truncate text-foreground">{quote.route ?? "n/a"}</p>
          </div>
        </div>
      ) : null}

      {allowed && buildError ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Could not build the transaction: {buildError}
        </p>
      ) : null}

      {allowed && needsWallet ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Connect a wallet to build the transaction to sign.
        </p>
      ) : null}

      {allowed && tx ? (
        <div className="mt-3">
          <p className="mb-2 flex items-start gap-2 text-[11px] text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            This is a real mainnet swap. You sign it in your own wallet. The server
            never signs and never holds your key.
          </p>
          <Button
            size="sm"
            onClick={onSign}
            disabled={signing || !walletConnected}
            className="w-full"
          >
            {signing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing
              </>
            ) : (
              "Sign and send in wallet"
            )}
          </Button>
          {!walletConnected ? (
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              connect a wallet to sign
            </p>
          ) : null}
        </div>
      ) : null}

      {signResult?.sig ? (
        <p className="mt-2 break-all text-[11px] text-emerald-300">
          Sent.{" "}
          <a
            href={`https://explorer.solana.com/tx/${signResult.sig}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            View on Solana Explorer
          </a>
        </p>
      ) : null}
      {signResult?.error ? (
        <p className="mt-2 break-all text-[11px] text-red-300">{signResult.error}</p>
      ) : null}
    </div>
  );
}
