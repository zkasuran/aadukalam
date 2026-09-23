"use client";

// The Call: the module surface. Loads every market from the devnet program,
// shows the live Pyth price against each target and drives create, bet, resolve
// and claim as user-signed transactions. Reads work without a wallet, actions
// need one. Pyth is the settlement authority, so resolve posts a real price
// update on chain rather than reading a display value.

import * as React from "react";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WalletButton } from "@/components/solana/WalletButton";
import { MarketClock } from "@/components/market/MarketClock";
import { explorerAddressUrl } from "@aadukalam/sdk";

import { getProgram, type SignerWallet } from "../_lib/program";
import {
  fetchMarkets,
  fetchUserBets,
  buildCreateMarketIx,
  buildBetIx,
  buildClaimIx,
  ensureUserUsdcAtaIx,
  resolveMarket,
} from "../_lib/client";
import { fetchLivePrice, fetchPriceUpdateData } from "../_lib/api";
import {
  THECALL_PROGRAM_ID,
  THECALL_USDC_MINT,
  PYTH_PRO_RECEIVER_PROGRAM_ID,
} from "../_lib/constants";
import type { BetView, LivePriceState, MarketView } from "../_lib/types";
import type { Side } from "../_lib/math";
import { MarketCard } from "./MarketCard";
import { CreateMarketForm, type CreateSubmit } from "./CreateMarketForm";

type Status = { kind: "ok" | "error" | "info"; text: string } | null;

export function TheCallApp() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();

  const program = React.useMemo(
    () => getProgram(connection, anchorWallet ? (anchorWallet as unknown as SignerWallet) : undefined),
    [connection, anchorWallet],
  );

  const [markets, setMarkets] = React.useState<MarketView[]>([]);
  const [bets, setBets] = React.useState<Map<string, BetView>>(new Map());
  const [prices, setPrices] = React.useState<Map<string, LivePriceState>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<Status>(null);
  const [nowSec, setNowSec] = React.useState(() => Math.floor(Date.now() / 1000));

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const ms = await fetchMarkets(program);
      setMarkets(ms);
      if (publicKey) {
        const mine = await fetchUserBets(program, publicKey);
        setBets(new Map(mine.map((b) => [b.market, b])));
      } else {
        setBets(new Map());
      }
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "failed to load markets" });
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live Pyth prices for the feeds on screen, refreshed on a gentle interval.
  React.useEffect(() => {
    let cancelled = false;
    const feeds = Array.from(new Set(markets.map((m) => m.feedIdHex)));
    if (feeds.length === 0) return;
    const load = async () => {
      const entries = await Promise.all(
        feeds.map(async (f) => [f, await fetchLivePrice(f)] as const),
      );
      if (!cancelled) setPrices(new Map(entries));
    };
    void load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [markets]);

  React.useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);

  const [tab, setTab] = React.useState<"open" | "resolved" | "create">("open");

  const sendIxs = React.useCallback(
    async (ixs: TransactionInstruction[]): Promise<string> => {
      const tx = new Transaction();
      ixs.forEach((ix) => tx.add(ix));
      const sig = await sendTransaction(tx, connection);
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      return sig;
    },
    [sendTransaction, connection],
  );

  const run = React.useCallback(
    async (okText: string, fn: () => Promise<string>) => {
      setBusy(true);
      setStatus({ kind: "info", text: "sending transaction…" });
      try {
        const sig = await fn();
        setStatus({ kind: "ok", text: sig ? `${okText}. tx ${sig.slice(0, 8)}…` : okText });
        await refresh();
      } catch (err) {
        setStatus({ kind: "error", text: err instanceof Error ? err.message : "transaction failed" });
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const onCreate = async (s: CreateSubmit) => {
    if (!publicKey) return;
    await run("Market opened", async () => {
      const { ix } = await buildCreateMarketIx({
        program,
        creator: publicKey,
        marketId: BigInt(Date.now()),
        feedIdHex: s.feedIdHex,
        targetPrice: s.targetPrice,
        expo: s.expo,
        deadline: s.deadline,
        usdcMint: new PublicKey(THECALL_USDC_MINT),
      });
      return sendIxs([ix]);
    });
    setTab("open");
  };

  const onBet = async (market: MarketView, side: Side, amountBase: bigint) => {
    if (!publicKey) return;
    await run("Bet placed", async () => {
      const usdcMint = new PublicKey(market.usdcMint);
      const ataIx = await ensureUserUsdcAtaIx(connection, usdcMint, publicKey);
      const betIx = await buildBetIx({
        program,
        user: publicKey,
        market: new PublicKey(market.address),
        usdcMint,
        side,
        amount: amountBase,
      });
      return sendIxs(ataIx ? [ataIx, betIx] : [betIx]);
    });
  };

  const onClaim = async (market: MarketView) => {
    if (!publicKey) return;
    await run("Winnings claimed", async () => {
      const claimIx = await buildClaimIx({
        program,
        user: publicKey,
        market: new PublicKey(market.address),
        usdcMint: new PublicKey(market.usdcMint),
      });
      return sendIxs([claimIx]);
    });
  };

  const onResolve = async (market: MarketView) => {
    if (!publicKey || !anchorWallet) return;
    await run("Market resolved", async () => {
      const pu = await fetchPriceUpdateData(market.feedIdHex);
      if (pu.keyMissing) throw new Error("no Pyth key set, provision PYTH_API_KEY to resolve");
      if (pu.vaa.length === 0) throw new Error(pu.error ?? "no price update available from Pyth");
      const sigs = await resolveMarket({
        connection,
        wallet: anchorWallet as unknown as SignerWallet,
        program,
        market: new PublicKey(market.address),
        feedIdHex: market.feedIdHex,
        priceUpdateData: pu.vaa,
      });
      return sigs[sigs.length - 1] ?? "";
    });
  };

  const openMarkets = markets.filter((m) => m.phase !== "resolved");
  const resolvedMarkets = markets.filter((m) => m.phase === "resolved");

  const grid = (list: MarketView[], emptyText: string) =>
    list.length === 0 ? (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
        {loading ? "Loading markets…" : emptyText}
      </div>
    ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((m) => (
          <MarketCard
            key={m.address}
            market={m}
            live={prices.get(m.feedIdHex) ?? null}
            userBet={bets.get(m.address) ?? null}
            connected={!!publicKey}
            busy={busy}
            nowSec={nowSec}
            onBet={onBet}
            onResolve={onResolve}
            onClaim={onClaim}
          />
        ))}
      </div>
    );

  const statusCls =
    status?.kind === "error"
      ? "border-destructive/50 text-destructive"
      : status?.kind === "ok"
        ? "border-emerald-500/50 text-emerald-300"
        : "border-border text-muted-foreground";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="outline" className="border-primary/40 text-primary">
            PLAY
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">The Call</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A prediction market on stock outcomes, settled on chain by Pyth. Bet YES or NO on whether
            a price clears a target by a deadline, then anyone resolves it with a fresh Pyth price and
            winners claim their stake plus a share of the losing pool.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <WalletButton />
          <MarketClock />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
        Devnet. Program{" "}
        <a
          href={explorerAddressUrl(THECALL_PROGRAM_ID, "devnet")}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-primary underline-offset-2 hover:underline"
        >
          {THECALL_PROGRAM_ID.slice(0, 6)}…{THECALL_PROGRAM_ID.slice(-4)}
        </a>
        . Pyth settles resolve and this program requires the pro receiver{" "}
        <span className="font-mono">{PYTH_PRO_RECEIVER_PROGRAM_ID.slice(0, 6)}…</span>, not the
        classic one. The program is pending its devnet deploy, so create, bet and claim are wired end
        to end and resolve is built with the pro receiver, awaiting a live confirmation.
      </div>

      {status && (
        <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${statusCls}`}>{status.text}</div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="open">Open ({openMarkets.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedMarkets.length})</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          {grid(openMarkets, "No open markets yet. Open one from the Create tab.")}
        </TabsContent>
        <TabsContent value="resolved">
          {grid(resolvedMarkets, "No resolved markets yet.")}
        </TabsContent>
        <TabsContent value="create">
          <CreateMarketForm busy={busy} onCreate={onCreate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

