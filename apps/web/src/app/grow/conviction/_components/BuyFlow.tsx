"use client";

import { Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/solana/WalletButton";
import { usd } from "@/lib/format";

/** The action bar: totals, the connect button, preview and buy. Carries the
 * honest mainnet label because a buy here signs a real swap with the user's own
 * funds, never a server key. */
export function BuyFlow({
  connected,
  tradableCount,
  totalPlanned,
  anyQuoted,
  previewing,
  buying,
  onPreview,
  onBuy,
}: {
  connected: boolean;
  tradableCount: number;
  totalPlanned: number;
  anyQuoted: boolean;
  previewing: boolean;
  buying: boolean;
  onPreview: () => void;
  onBuy: () => void;
}) {
  const canPreview = tradableCount > 0 && !previewing && !buying;
  const canBuy = connected && anyQuoted && !buying && !previewing;

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Deploying </span>
          <span className="font-semibold tabular-nums">{usd(totalPlanned)}</span>
          <span className="text-muted-foreground">
            {" "}
            across {tradableCount} {tradableCount === 1 ? "leg" : "legs"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <WalletButton />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onPreview}
          disabled={!canPreview}
        >
          {previewing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          Preview quotes
        </Button>
        <Button type="button" onClick={onBuy} disabled={!canBuy}>
          {buying ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Wallet className="h-4 w-4" aria-hidden />
          )}
          {connected ? "Buy basket" : "Connect a wallet to buy"}
        </Button>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <p>
          Live Jupiter quotes and swaps on Solana mainnet. Each leg is one ExactIn
          swap your own wallet signs and sends. Aadukalam never holds your funds
          or your keys. A private mainnet RPC gives the most reliable landing.
        </p>
      </div>
    </div>
  );
}
