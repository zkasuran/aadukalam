"use client";

// Opening Bell: an equity-tuned launchpad on Meteora Dynamic Bonding Curve.
// Pick the equity to list and the asset it settles against, choose one of three
// equity-tuned curve presets, preview the price-discovery auction from the SDK
// quote math, then build the create-config-and-pool tx for the wallet to sign.
// We never sign for the user. Devnet by default.
// House style: no em dashes, no comma before "and" or "or".
import { useCallback, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { WalletButton } from "@/components/solana/WalletButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLUSTER } from "@/lib/rpc";
import { loadTokens, getToken, type TokenInfo } from "@aadukalam/data";

import { CurveChart } from "./_components/CurveChart";
import { PresetCard } from "./_components/PresetCard";
import { AuctionSimulator } from "./_components/AuctionSimulator";
import {
  PRESETS,
  getPreset,
  validatePreset,
  type EquityPreset,
  type PresetId,
  type ValidationResult,
} from "./_lib/presets";
import {
  createDbcClient,
  buildLaunchTransaction,
  buildPreviewCurve,
  migrationThresholdHuman,
  startPrice,
  PROGRAM_IDS,
  type CurvePoint,
} from "./_lib/dbc";
import { quoteAssets, SOL_QUOTE, type QuoteAsset } from "./_lib/quote-assets";
import { formatCompact, formatPrice } from "./_lib/format";

const BASE_DECIMALS = 6;

type LaunchStatus =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "sent"; signature: string; baseMint: string }
  | { kind: "error"; message: string };

export default function OpeningBellPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const tokens = useMemo(() => loadTokens(), []);
  const quotes = useMemo(() => quoteAssets(), []);

  const [baseTicker, setBaseTicker] = useState(tokens[0]?.ticker ?? "");
  const [quoteKey, setQuoteKey] = useState(SOL_QUOTE.key);
  const [presetId, setPresetId] = useState<PresetId>("blue-chip");
  const [progress, setProgress] = useState(0.35);
  const [status, setStatus] = useState<LaunchStatus>({ kind: "idle" });

  const baseToken = getToken(baseTicker) ?? tokens[0];
  const quote = quotes.find((q) => q.key === quoteKey) ?? SOL_QUOTE;
  const preset = getPreset(presetId);

  const config = useMemo(
    () => preset.build({ quoteDecimals: quote.decimals, baseDecimals: BASE_DECIMALS }),
    [preset, quote.decimals]
  );

  const points = useMemo(() => {
    try {
      const client = createDbcClient(connection);
      return buildPreviewCurve(client, config, BASE_DECIMALS, quote.decimals, 40);
    } catch {
      return [];
    }
  }, [connection, config, quote.decimals]);

  const threshold = useMemo(
    () => migrationThresholdHuman(config, quote.decimals),
    [config, quote.decimals]
  );
  const launchPrice = useMemo(
    () => startPrice(config, BASE_DECIMALS, quote.decimals),
    [config, quote.decimals]
  );

  // validateConfigParameters rejects the all-zero pubkey, so fall back to the
  // quote mint (a real key) as the leftover receiver when no wallet is connected.
  const validation = useMemo(
    () => validatePreset(config, publicKey ?? quote.mint),
    [config, publicKey, quote.mint]
  );

  const launchSymbol = baseToken?.ticker ?? "TOKEN";
  const launchName = baseToken?.name ?? "Tokenized equity";

  const onLaunch = useCallback(async () => {
    if (!publicKey) {
      setStatus({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    setStatus({ kind: "building" });
    try {
      const client = createDbcClient(connection);
      const { transaction, baseMint, signers } = await buildLaunchTransaction({
        client,
        config,
        quoteMint: quote.mint,
        wallet: publicKey,
        name: launchName,
        symbol: launchSymbol,
        uri: `https://aadukalam.app/opening-bell/${launchSymbol}`,
      });
      const signature = await sendTransaction(transaction, connection, {
        signers,
      });
      setStatus({ kind: "sent", signature, baseMint: baseMint.toBase58() });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [
    publicKey,
    connection,
    config,
    quote.mint,
    launchName,
    launchSymbol,
    sendTransaction,
  ]);

  return (
    <PageBody
      preset={preset}
      presetId={presetId}
      setPresetId={setPresetId}
      tokens={tokens}
      quotes={quotes}
      baseTicker={baseTicker}
      setBaseTicker={setBaseTicker}
      quoteKey={quoteKey}
      setQuoteKey={setQuoteKey}
      quote={quote}
      launchSymbol={launchSymbol}
      points={points}
      progress={progress}
      setProgress={setProgress}
      threshold={threshold}
      launchPrice={launchPrice}
      validation={validation}
      status={status}
      onLaunch={onLaunch}
      walletConnected={!!publicKey}
    />
  );
}

interface PageBodyProps {
  preset: EquityPreset;
  presetId: PresetId;
  setPresetId: (id: PresetId) => void;
  tokens: TokenInfo[];
  quotes: QuoteAsset[];
  baseTicker: string;
  setBaseTicker: (t: string) => void;
  quoteKey: string;
  setQuoteKey: (k: string) => void;
  quote: QuoteAsset;
  launchSymbol: string;
  points: CurvePoint[];
  progress: number;
  setProgress: (p: number) => void;
  threshold: number;
  launchPrice: number;
  validation: ValidationResult;
  status: LaunchStatus;
  onLaunch: () => void;
  walletConnected: boolean;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const selectClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PageBody(props: PageBodyProps) {
  const {
    preset,
    presetId,
    setPresetId,
    tokens,
    quotes,
    baseTicker,
    setBaseTicker,
    quoteKey,
    setQuoteKey,
    quote,
    launchSymbol,
    points,
    progress,
    setProgress,
    threshold,
    launchPrice,
    validation,
    status,
    onLaunch,
    walletConnected,
  } = props;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <Badge variant="outline" className="border-primary/40 text-primary">
            Companion
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Opening Bell
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            An equity-tuned launchpad on Meteora Dynamic Bonding Curve. Give a
            newly tokenized stock a real price-discovery auction, then graduate
            it into a DAMM v2 pool.
          </p>
          {/* CHUNK_B */}
          <div className="mt-6 rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Why an equity curve, not a meme curve
            </p>
            <p className="mt-1">
              A meme launch wants a near-vertical curve so a tiny buy 100x&apos;es
              the price. An equity wants the opposite. Open near a fair value,
              discover price slowly in a tight band, tax the opening-bell snipers
              with a high fee that decays and lock most of the liquidity so the
              graduated venue stays deep. Every preset below is tuned for that.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Equity to list</span>
              <select
                className={selectClass}
                value={baseTicker}
                onChange={(e) => setBaseTicker(e.target.value)}
              >
                {tokens.map((t) => (
                  <option key={t.mint} value={t.ticker}>
                    {t.ticker} ({t.name})
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted-foreground">
                Launches a new devnet mint carrying this equity&apos;s identity.
              </span>
            </label>

            <label className="block text-sm">
              <span className="font-medium">Settlement asset</span>
              <select
                className={selectClass}
                value={quoteKey}
                onChange={(e) => setQuoteKey(e.target.value)}
              >
                {quotes.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.symbol} ({q.name}){q.devnetReady ? "" : " (mainnet)"}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted-foreground">
                {quote.note}
              </span>
            </label>
          </div>
          {/* CHUNK_C */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                selected={p.id === presetId}
                onSelect={setPresetId}
              />
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{preset.rationale}</p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="font-semibold">Price discovery</h2>
                <span className="text-xs text-muted-foreground">
                  {launchSymbol} priced in {quote.symbol}
                </span>
              </div>
              {points.length > 1 ? (
                <CurveChart
                  points={points}
                  quoteSymbol={quote.symbol}
                  baseSymbol={launchSymbol}
                  markerProgress={progress}
                />
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  Curve preview unavailable for this configuration.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <AuctionSimulator
                points={points}
                progress={progress}
                onProgressChange={setProgress}
                quoteSymbol={quote.symbol}
                baseSymbol={launchSymbol}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Launch price"
              value={formatPrice(launchPrice)}
              sub={`${quote.symbol} each`}
            />
            <Stat
              label="Graduation raise"
              value={formatCompact(threshold)}
              sub={quote.symbol}
            />
            <Stat
              label="Market cap band"
              value={`${formatCompact(preset.initialMarketCap)} to ${formatCompact(preset.migrationMarketCap)}`}
              sub="quote units"
            />
            <Stat
              label="Graduated pool"
              value={preset.stats[3]?.value ?? "DAMM v2"}
              sub="DAMM v2"
            />
          </div>
          {/* CHUNK_D */}
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Launch on {CLUSTER}</h2>
              {validation.ok ? (
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Config validated
                </Badge>
              ) : (
                <Badge variant="destructive">Config invalid</Badge>
              )}
            </div>

            {!validation.ok && validation.error && (
              <p className="mt-2 text-xs text-destructive">{validation.error}</p>
            )}

            {!quote.devnetReady && (
              <p className="mt-2 text-xs text-muted-foreground">
                {quote.symbol} settles against a mainnet mint, so this exact pair
                is a mainnet action. Switch the settlement asset to SOL for a
                devnet launch or supply a devnet quote mint.
              </p>
            )}

            <p className="mt-2 text-sm text-muted-foreground">
              Builds the create-config-and-pool transaction and hands it to your
              wallet to sign. We never sign for you. The config and base-mint
              keypairs co-sign as accounts we create, never your key.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <WalletButton />
              <Button
                onClick={onLaunch}
                disabled={
                  !walletConnected ||
                  !validation.ok ||
                  status.kind === "building"
                }
              >
                {status.kind === "building"
                  ? "Building transaction..."
                  : "Launch on devnet"}
              </Button>
            </div>

            {status.kind === "sent" && (
              <div className="mt-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
                <p className="font-medium text-primary">Transaction sent</p>
                <p className="mt-1 break-all text-muted-foreground">
                  Signature {status.signature}
                </p>
                <p className="mt-1 break-all text-muted-foreground">
                  New base mint {status.baseMint}
                </p>
              </div>
            )}

            {status.kind === "error" && (
              <p className="mt-3 break-all text-xs text-destructive">
                {status.message}
              </p>
            )}

            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              <p>
                DBC program {PROGRAM_IDS.dbc.toBase58()} (same on mainnet and
                devnet). Graduates to DAMM v2 {PROGRAM_IDS.dammV2.toBase58()}.
              </p>
              <p className="mt-1">
                On devnet there is no auto-migrator, so the issuer sends the
                migration tx once the auction hits 100%. Mainnet auto-migrates.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
