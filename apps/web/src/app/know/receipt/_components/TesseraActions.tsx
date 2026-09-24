"use client";

import { useState } from "react";
import {
  Activity,
  Check,
  ExternalLink,
  Share2,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import type { JupiterPriceInfo } from "@aadukalam/sdk";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import type { ReceiptRow } from "../_lib/types";
import { fmtPct, fmtPrice, fmtUsd } from "../_lib/format";
import {
  livePremiumPct,
  shareText,
  tesseraTokenUrl,
  TESSERA_TOKEN_DECIMALS,
} from "../_lib/trade";
import { useWatch, watchKey } from "../_lib/watchlist";
import { BuyPanel } from "./BuyPanel";

function LivePill({ pricedAt }: { pricedAt: number | null }) {
  const live = pricedAt !== null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        {live ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            live ? "bg-emerald-500" : "bg-muted-foreground/50"
          )}
        />
      </span>
      {live ? "Live" : "connecting"}
    </span>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the execCommand path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function TesseraActions({
  row,
  livePrice,
  pricedAt,
}: {
  row: ReceiptRow;
  livePrice: JupiterPriceInfo | null;
  pricedAt: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { watched, toggle } = useWatch(watchKey(row.provider, row.mint));

  const dexPrice = livePrice?.usdPrice ?? null;
  const change24h = livePrice?.priceChange24h ?? null;
  const liquidity = livePrice?.liquidity ?? null;
  const decimals = livePrice?.decimals ?? TESSERA_TOKEN_DECIMALS;
  const premium = livePremiumPct(dexPrice, row.markPrice);
  const url = tesseraTokenUrl(row.code);

  const onShare = async () => {
    const ok = await copyText(
      shareText({
        company: row.company,
        symbol: row.symbol,
        livePrice: dexPrice,
        premiumVsMark: premium,
        url,
      })
    );
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" aria-hidden />
          Live market
        </span>
        <LivePill pricedAt={pricedAt} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            DEX price
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {dexPrice != null ? fmtPrice(dexPrice) : "loading"}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            24h
          </p>
          <p
            className={cn(
              "mt-0.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums",
              change24h == null
                ? "text-foreground"
                : change24h >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
            )}
          >
            {change24h != null ? (
              change24h >= 0 ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )
            ) : null}
            {fmtPct(change24h)}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            Premium vs mark
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              premium == null
                ? "text-foreground"
                : Math.abs(premium) <= 0.05
                  ? "text-emerald-400"
                  : Math.abs(premium) <= 0.15
                    ? "text-amber-400"
                    : "text-red-400"
            )}
          >
            {fmtPct(premium)}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            Liquidity
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {liquidity != null ? fmtUsd(liquidity) : "n/a"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={open ? "secondary" : "default"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide trade" : "Trade"}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Trade on Tessera <ExternalLink className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" aria-hidden /> Copied
            </>
          ) : (
            <>
              <Share2 className="h-3 w-3" aria-hidden /> Share
            </>
          )}
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={watched}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs",
            watched
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Star
            className={cn("h-3 w-3", watched ? "fill-amber-400 text-amber-400" : "")}
            aria-hidden
          />
          {watched ? "Watching" : "Watch"}
        </button>
      </div>

      {open ? (
        <BuyPanel
          mint={row.mint}
          company={row.company}
          symbol={row.symbol}
          tokenDecimals={decimals}
        />
      ) : null}
    </div>
  );
}
