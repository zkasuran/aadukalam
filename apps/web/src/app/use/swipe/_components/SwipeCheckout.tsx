"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { CreditCard, Loader2, ExternalLink, Store, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/solana/WalletButton";
import { usd, pct } from "@/lib/format";
import { explorerTxUrl } from "@aadukalam/sdk";
import {
  collateralForTargetLtv,
  SAFE_TARGET_LTV_FRACTION,
  type BorrowMode,
  type QuoteBorrowResponse,
  type ReserveInfo,
} from "@/app/api/kamino/_lib/kamino";

import { fetchReserves, fetchQuote, fetchBuild, getMainnetConnection, deserializeTx } from "../_lib/client";
import { catalogCollateral } from "../_lib/collateral";
import { BorrowTerms } from "./BorrowTerms";

interface Option {
  symbol: string;
  mint: string;
  decimals: number;
  maxLtv?: number;
  oraclePrice?: number;
}

type SendState =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "sending" }
  | { kind: "sent"; signature: string }
  | { kind: "error"; message: string };

// A borrow whose price context we have (live reserve read) lets the widget suggest
// a safe collateral amount. Without it the user types the amount and the quote
// still returns the real terms once collateral and spend are set.
export function SwipeCheckout() {
  const { publicKey, sendTransaction, connected } = useWallet();

  const [options, setOptions] = useState<Option[]>([]);
  const [reservesLive, setReservesLive] = useState(false);
  const [reservesNote, setReservesNote] = useState<string | null>(null);

  const [selectedMint, setSelectedMint] = useState<string>("");
  const [spend, setSpend] = useState("500");
  const [collateral, setCollateral] = useState("");
  const [mode, setMode] = useState<BorrowMode>("deposit-and-borrow");

  const [quote, setQuote] = useState<QuoteBorrowResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [send, setSend] = useState<SendState>({ kind: "idle" });

  // Load the live reserve list once. On failure fall back to the registry catalog
  // so the widget is still explorable, clearly labeled as catalog only.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchReserves(controller.signal);
        const collateralReserves = (res.reserves ?? [])
          .filter((r: ReserveInfo) => r.isCollateral && r.symbol !== "USDC" && r.symbol !== "USDG")
          .sort((a, b) => b.maxLtv - a.maxLtv);
        if (collateralReserves.length > 0 && !res.error) {
          setOptions(
            collateralReserves.map((r) => ({
              symbol: r.symbol,
              mint: r.mint,
              decimals: r.decimals,
              maxLtv: r.maxLtv,
              oraclePrice: r.oraclePrice,
            })),
          );
          setReservesLive(true);
          setSelectedMint((cur) => cur || collateralReserves[0].mint);
          setReservesNote(
            res.configured ? null : "Live reserve reads on the public mainnet endpoint.",
          );
          return;
        }
        throw new Error(res.error ?? "no collateral reserves returned");
      } catch (err) {
        if (controller.signal.aborted) return;
        const catalog = catalogCollateral();
        setOptions(catalog.map((c) => ({ symbol: c.ticker, mint: c.mint, decimals: c.decimals })));
        setReservesLive(false);
        setSelectedMint((cur) => cur || catalog[0]?.mint || "");
        const message = err instanceof Error ? err.message : String(err);
        setReservesNote(`Live reserve read unavailable (${message}). Showing the catalog. Set a mainnet RPC for live terms.`);
      }
    })();
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => options.find((o) => o.mint === selectedMint) ?? null,
    [options, selectedMint],
  );

  const spendNum = Number(spend);
  const collateralNum = Number(collateral);
  const inputsValid =
    !!selectedMint &&
    Number.isFinite(spendNum) &&
    spendNum > 0 &&
    Number.isFinite(collateralNum) &&
    collateralNum > 0;

  // Debounced quote whenever the inputs settle.
  useEffect(() => {
    if (!inputsValid) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const q = await fetchQuote(
          { collateralMint: selectedMint, collateralAmount: collateralNum, spendUsdc: spendNum, mode },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (q.error) {
          setQuote(null);
          setQuoteError(q.error);
        } else {
          setQuote(q);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setQuoteError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [selectedMint, spendNum, collateralNum, mode, inputsValid]);

  const canSuggest = reservesLive && !!selected?.oraclePrice && !!selected?.maxLtv && spendNum > 0;
  function useSafeAmount() {
    if (!canSuggest || !selected?.oraclePrice || !selected?.maxLtv) return;
    const targetLtv = SAFE_TARGET_LTV_FRACTION * selected.maxLtv;
    const shares = collateralForTargetLtv(spendNum, 1, 1, selected.oraclePrice, targetLtv);
    setCollateral(shares > 0 ? shares.toFixed(4) : "");
  }

  async function onBorrow() {
    if (!publicKey || !connected || !inputsValid) return;
    setSend({ kind: "building" });
    try {
      const built = await fetchBuild({
        owner: publicKey.toBase58(),
        collateralMint: selectedMint,
        collateralAmount: collateralNum,
        spendUsdc: spendNum,
        mode,
      });
      if (built.error) {
        setSend({ kind: "error", message: built.error });
        return;
      }
      const vtx = deserializeTx(built.transaction);
      setSend({ kind: "sending" });
      const signature = await sendTransaction(vtx, getMainnetConnection());
      setSend({ kind: "sent", signature });
    } catch (err) {
      setSend({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const busy = send.kind === "building" || send.kind === "sending";

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-primary" aria-hidden />
            Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">Amount to pay (USDC)</span>
            <input
              inputMode="decimal"
              value={spend}
              onChange={(e) => setSpend(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
              placeholder="500"
            />
          </label>

          <div className="text-sm">
            <span className="text-muted-foreground">Collateral</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {options.map((o) => (
                <button
                  key={o.mint}
                  type="button"
                  onClick={() => setSelectedMint(o.mint)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${
                    o.mint === selectedMint
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {o.symbol}
                  {o.maxLtv ? (
                    <span className="ml-1 text-[10px] font-normal opacity-70">
                      {pct(o.maxLtv, { isRatio: true, fractionDigits: 0 })}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="flex items-center justify-between text-muted-foreground">
              <span>Collateral to post ({selected?.symbol ?? "shares"})</span>
              {canSuggest ? (
                <button type="button" onClick={useSafeAmount} className="text-xs font-medium text-primary hover:underline">
                  use a safe amount
                </button>
              ) : null}
            </span>
            <input
              inputMode="decimal"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.0"
            />
          </label>

          <div className="flex gap-2 text-xs">
            {(["deposit-and-borrow", "borrow"] as BorrowMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md border px-2 py-1.5 font-medium ${
                  mode === m ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                {m === "deposit-and-borrow" ? "Post collateral + borrow" : "Borrow vs existing"}
              </button>
            ))}
          </div>

          {reservesNote ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">{reservesNote}</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" aria-hidden />
            Spend without selling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!inputsValid ? (
            <p className="text-sm text-muted-foreground">
              Enter an amount to pay and the collateral to post to see the borrow terms.
            </p>
          ) : quoteError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              {quoteError}
            </div>
          ) : quoteLoading && !quote ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Reading live Kamino reserves...
            </div>
          ) : quote ? (
            <BorrowTerms quote={quote} />
          ) : null}

          <div className="border-t border-border/60 pt-4">
            {!connected ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Connect a mainnet wallet to borrow and pay. Kamino settles on Solana mainnet.
                </p>
                <WalletButton />
              </div>
            ) : (
              <Button
                onClick={onBorrow}
                disabled={!inputsValid || !quote || !quote.projection.borrowAllowed || busy}
                className="w-full"
              >
                {send.kind === "building" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building transaction
                  </>
                ) : send.kind === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Waiting for wallet
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" aria-hidden /> Borrow{" "}
                    {inputsValid ? usd(spendNum) : ""} and pay
                  </>
                )}
              </Button>
            )}

            {send.kind === "sent" ? (
              <a
                href={explorerTxUrl(send.signature, "mainnet-beta")}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:underline"
              >
                Borrow sent, view on Explorer <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
            {send.kind === "error" ? (
              <p className="mt-3 text-sm text-red-300">Could not complete: {send.message}</p>
            ) : null}

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70">
              We build the transaction, your wallet signs and sends it. We never sign and never move
              your funds. The share stays in your position, so there is no sale and no taxable
              disposal at the moment of payment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


