"use client";

// The Call: create-market form. Pick a registry ticker, read its live Pyth
// price and exponent, set a dollar target and a deadline and the form converts
// the target into the feed fixed point the program stores. The feed exponent is
// read live from Pyth, never assumed, so the target is correct whichever feed
// the ticker settles on. When no Pyth key is set the exponent falls back to an
// editable value with a clear warning.

import * as React from "react";
import { loadTokens, getToken, bestPythFeed, type TokenInfo } from "@aadukalam/data";

import { Button } from "@/components/ui/button";
import { usd } from "@/lib/format";
import { dollarsToTargetPrice, fixedToDollars } from "../_lib/math";
import { fetchLivePrice } from "../_lib/api";
import { usdcMintConfigured } from "../_lib/constants";
import type { LivePriceState } from "../_lib/types";

const PRESETS: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86_400 },
  { label: "3 days", seconds: 259_200 },
  { label: "1 week", seconds: 604_800 },
];

export interface CreateSubmit {
  feedIdHex: string;
  targetPrice: bigint;
  expo: number;
  deadline: number;
  ticker: string;
}

const FEEDED = loadTokens()
  .filter((t) => bestPythFeed(t))
  .sort((a, b) => a.ticker.localeCompare(b.ticker));

export function CreateMarketForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (s: CreateSubmit) => Promise<void>;
}) {
  const [ticker, setTicker] = React.useState<string>(FEEDED[0]?.ticker ?? "");
  const [targetInput, setTargetInput] = React.useState<string>("");
  const [expoInput, setExpoInput] = React.useState<number>(-5);
  const [deadlineSec, setDeadlineSec] = React.useState<number>(
    Math.floor(Date.now() / 1000) + 86_400,
  );
  const [live, setLive] = React.useState<LivePriceState | null>(null);

  const token: TokenInfo | undefined = ticker ? getToken(ticker) : undefined;
  const feed = token ? bestPythFeed(token) : null;
  const feedKind = token?.pythFeedId ? "24/7 xStock feed" : "regular equity feed";

  // Read the live price and exponent whenever the ticker changes.
  React.useEffect(() => {
    let cancelled = false;
    if (!feed) {
      setLive(null);
      return;
    }
    void fetchLivePrice(feed).then((state) => {
      if (cancelled) return;
      setLive(state);
      if (state.expo != null) setExpoInput(state.expo);
      if (state.priceUsd != null && targetInput === "") {
        setTargetInput(state.priceUsd.toFixed(2));
      }
    });
    return () => {
      cancelled = true;
    };
    // targetInput intentionally out of deps, we only seed it once per ticker
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed]);

  const dollars = Number(targetInput);
  const targetValid = Number.isFinite(dollars) && dollars > 0 && targetInput.trim() !== "";
  const targetPrice = targetValid ? dollarsToTargetPrice(dollars, expoInput) : null;
  const deadlineValid = deadlineSec > Math.floor(Date.now() / 1000);
  const mintReady = usdcMintConfigured();
  const canSubmit = !busy && targetValid && deadlineValid && !!feed && mintReady;

  const submit = async () => {
    if (!canSubmit || !feed || targetPrice == null) return;
    await onCreate({ feedIdHex: feed, targetPrice, expo: expoInput, deadline: deadlineSec, ticker });
    setTargetInput("");
  };

  const deadlineLocal = new Date(deadlineSec * 1000).toISOString().slice(0, 16);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">Open a market</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Will the price be at or above your target when the deadline hits. YES wins when the settled
        Pyth price is at or above the target, NO wins below it.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Ticker</span>
          <select
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value);
              setTargetInput("");
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          >
            {FEEDED.map((t) => (
              <option key={t.mint} value={t.ticker}>
                {t.ticker} · {t.name}
              </option>
            ))}
          </select>
          {feed && (
            <span className="mt-1 block text-xs text-muted-foreground">
              settles on the {feedKind}
            </span>
          )}
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Target price (USD)</span>
          <input
            inputMode="decimal"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="200.00"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {live?.priceUsd != null
              ? `live Pyth price ${usd(live.priceUsd)}`
              : live?.keyMissing
                ? "no Pyth key set, enter the target and confirm the exponent"
                : "no live price"}
          </span>
        </label>
      </div>

      <DeadlineRow
        deadlineLocal={deadlineLocal}
        onLocal={(v) => setDeadlineSec(Math.floor(new Date(v).getTime() / 1000))}
        onPreset={(s) => setDeadlineSec(Math.floor(Date.now() / 1000) + s)}
        valid={deadlineValid}
      />

      <ExponentRow
        expo={expoInput}
        confirmedLive={live?.expo != null}
        onChange={setExpoInput}
      />

      {targetPrice != null && (
        <p className="mt-4 rounded-md bg-muted/40 px-3 py-2 font-mono text-xs">
          target_price {targetPrice.toString()} at expo {expoInput} = {usd(fixedToDollars(targetPrice, expoInput))}
        </p>
      )}

      {!mintReady && (
        <p className="mt-4 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          Set NEXT_PUBLIC_THECALL_USDC_MINT to the devnet USDC test mint to open a market.
        </p>
      )}

      <Button className="mt-5" disabled={!canSubmit} onClick={submit}>
        {busy ? "Opening…" : "Open market"}
      </Button>
    </div>
  );
}

function DeadlineRow({
  deadlineLocal,
  onLocal,
  onPreset,
  valid,
}: {
  deadlineLocal: string;
  onLocal: (v: string) => void;
  onPreset: (seconds: number) => void;
  valid: boolean;
}) {
  return (
    <div className="mt-4 text-sm">
      <span className="mb-1 block font-medium">Deadline</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={deadlineLocal}
          onChange={(e) => onLocal(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2"
        />
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" onClick={() => onPreset(p.seconds)}>
            +{p.label}
          </Button>
        ))}
      </div>
      {!valid && <span className="mt-1 block text-xs text-destructive">Deadline must be in the future.</span>}
    </div>
  );
}

function ExponentRow({
  expo,
  confirmedLive,
  onChange,
}: {
  expo: number;
  confirmedLive: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mt-4 text-sm">
      <span className="mb-1 block font-medium">Feed exponent</span>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={expo}
          disabled={confirmedLive}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-24 rounded-md border border-input bg-background px-3 py-2 font-mono disabled:opacity-60"
        />
        <span className="text-xs text-muted-foreground">
          {confirmedLive
            ? "read live from Pyth, locked to the feed"
            : "not confirmed live, defaulting to -5, set it to match the feed"}
        </span>
      </div>
    </div>
  );
}
