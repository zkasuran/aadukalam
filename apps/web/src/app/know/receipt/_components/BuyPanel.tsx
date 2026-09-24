"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import { buildSwapTx, getQuote, type JupiterQuoteResponse } from "@aadukalam/sdk";

import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/solana/WalletButton";

import { explorerTx, getMainnetConnection, hasPrivateMainnetRpc } from "../_lib/connection";
import { fmtPrice } from "../_lib/format";
import {
  quoteEffectivePrice,
  quoteMinReceived,
  quotePriceImpactPct,
  quoteReceived,
  routeLabels,
  usdcBaseUnits,
  USDC_MINT,
} from "../_lib/trade";

const SLIPPAGE_BPS = 50;
const PRESETS = [10, 25, 100];

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; quote: JupiterQuoteResponse }
  | { status: "error"; error: string };

type ExecState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "signing" }
  | { status: "sent"; signature: string }
  | { status: "confirmed"; signature: string }
  | { status: "failed"; error: string };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function BuyPanel({
  mint,
  company,
  symbol,
  tokenDecimals,
}: {
  mint: string;
  company: string;
  symbol: string;
  tokenDecimals: number;
}) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const [amount, setAmount] = useState("25");
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [exec, setExec] = useState<ExecState>({ status: "idle" });

  const usdcAmount = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  // A changed amount invalidates any quote and any prior execution.
  useEffect(() => {
    setQuote({ status: "idle" });
    setExec({ status: "idle" });
  }, [amount, mint]);

  const onQuote = useCallback(async () => {
    if (usdcAmount <= 0) return;
    setQuote({ status: "loading" });
    setExec({ status: "idle" });
    try {
      const q = await getQuote({
        inputMint: USDC_MINT,
        outputMint: mint,
        amount: usdcBaseUnits(usdcAmount),
        slippageBps: SLIPPAGE_BPS,
      });
      setQuote({ status: "ok", quote: q });
    } catch (err) {
      setQuote({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [usdcAmount, mint]);

  const onBuy = useCallback(async () => {
    if (quote.status !== "ok" || !publicKey) return;
    setExec({ status: "building" });
    try {
      const built = await buildSwapTx({
        quoteResponse: quote.quote,
        userPublicKey: publicKey.toBase58(),
      });
      const tx = VersionedTransaction.deserialize(
        Buffer.from(built.swapTransaction, "base64")
      );
      setExec({ status: "signing" });
      const connection = getMainnetConnection();
      const signature = await sendTransaction(tx, connection);
      setExec({ status: "sent", signature });
      await connection.confirmTransaction(
        {
          signature,
          blockhash: tx.message.recentBlockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        "confirmed"
      );
      setExec({ status: "confirmed", signature });
    } catch (err) {
      setExec({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [quote, publicKey, sendTransaction]);

  const busy = exec.status === "building" || exec.status === "signing";
  const signature =
    exec.status === "sent" || exec.status === "confirmed" ? exec.signature : null;

  return (
    <div className="mt-3 rounded-lg border border-primary/25 bg-primary/[0.03] p-3">
      <p className="text-xs font-semibold text-foreground">
        Buy {company} <span className="text-muted-foreground">({symbol})</span>{" "}
        with USDC
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            inputMode="decimal"
            aria-label="USDC amount to spend"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="h-9 w-28 rounded-md border border-input bg-background pl-5 pr-2 text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(String(p))}
            className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            ${p}
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onQuote}
          disabled={usdcAmount <= 0 || quote.status === "loading" || busy}
        >
          {quote.status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          Quote
        </Button>
      </div>

      <QuoteReadout quote={quote} usdcAmount={usdcAmount} tokenDecimals={tokenDecimals} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <WalletButton />
        <Button
          type="button"
          size="sm"
          onClick={onBuy}
          disabled={quote.status !== "ok" || !connected || busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Wallet className="h-4 w-4" aria-hidden />
          )}
          {connected ? "Buy on Solana" : "Connect a wallet to buy"}
        </Button>
      </div>

      <ExecReadout exec={exec} signature={signature} />

      <div className="mt-3 flex items-start gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <p>
          Live Jupiter quote and swap on Solana mainnet, routed through the
          Meteora pools that hold the T-Token. Your own wallet signs and sends the
          transaction. Aadukalam never holds your funds or your keys.
          {hasPrivateMainnetRpc() ? "" : " A private mainnet RPC lands it more reliably."}
        </p>
      </div>
    </div>
  );
}

function QuoteReadout({
  quote,
  usdcAmount,
  tokenDecimals,
}: {
  quote: QuoteState;
  usdcAmount: number;
  tokenDecimals: number;
}) {
  if (quote.status === "idle") return null;
  if (quote.status === "loading") {
    return (
      <p className="mt-2 text-xs text-muted-foreground">Routing a live quote...</p>
    );
  }
  if (quote.status === "error") {
    return (
      <p className="mt-2 text-xs text-red-400">Quote failed: {quote.error}</p>
    );
  }

  const received = quoteReceived(quote.quote, tokenDecimals);
  const effective = quoteEffectivePrice(usdcAmount, received);
  const minOut = quoteMinReceived(quote.quote, tokenDecimals);
  const impact = quotePriceImpactPct(quote.quote);
  const labels = routeLabels(quote.quote);

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">
          {fmtPrice(usdcAmount)}
        </span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        <span className="font-semibold tabular-nums text-foreground">
          {received.toLocaleString("en-US", { maximumFractionDigits: 6 })} {" "}
          tokens
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Effective price" value={fmtPrice(effective)} />
        <Stat
          label="Min received"
          value={minOut.toLocaleString("en-US", { maximumFractionDigits: 6 })}
        />
        <Stat label="Price impact" value={`${(impact * 100).toFixed(2)}%`} />
        <Stat label="Route" value={labels[0] ?? "direct"} />
      </div>
    </div>
  );
}

function ExecReadout({
  exec,
  signature,
}: {
  exec: ExecState;
  signature: string | null;
}) {
  if (exec.status === "idle") return null;

  const line =
    exec.status === "building"
      ? "Building the swap transaction..."
      : exec.status === "signing"
        ? "Waiting for your wallet to sign..."
        : exec.status === "sent"
          ? "Sent, confirming on chain..."
          : exec.status === "confirmed"
            ? "Confirmed on Solana mainnet."
            : `Swap failed: ${exec.error}`;

  const tone =
    exec.status === "failed"
      ? "text-red-400"
      : exec.status === "confirmed"
        ? "text-emerald-400"
        : "text-muted-foreground";

  return (
    <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${tone}`}>
      <span>{line}</span>
      {signature ? (
        <a
          href={explorerTx(signature)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          View on Explorer <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}
