"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { availableTickers } from "../_lib/policy";
import type { TradeInput } from "../_lib/trade";

// A direct trade proposal that does not touch the language model. It runs the
// exact same guardrail gate and quote path, so it demos the safety core even
// when MINIMAX_API_KEY is unset. Pick any ticker to see the allowlist refusal.
export function ManualTrade({
  onPropose,
  busy,
}: {
  onPropose: (input: TradeInput) => void;
  busy: boolean;
}) {
  const tickers = useMemo(() => availableTickers(), []);
  const [ticker, setTicker] = useState<string>(tickers[0] ?? "");
  const [amount, setAmount] = useState<number>(100);
  const [side, setSide] = useState<"buy" | "sell">("buy");

  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
      <h2 className="text-sm font-semibold">Manual trade</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Propose directly, no agent needed. Same guardrail, same quote.
      </p>

      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1">
          <span className="text-[11px] text-muted-foreground">Ticker</span>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
          >
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-[11px] text-muted-foreground">USD</span>
          <div className="mt-1 flex items-center rounded-md border border-input bg-background px-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 bg-transparent px-1 py-1.5 text-sm tabular-nums outline-none"
            />
          </div>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex rounded-md border border-input p-0.5">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={
                side === s
                  ? "rounded px-3 py-1 text-xs font-medium capitalize text-primary-foreground bg-primary"
                  : "rounded px-3 py-1 text-xs capitalize text-muted-foreground hover:text-foreground"
              }
            >
              {s}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="flex-1"
          disabled={busy || !ticker || amount <= 0}
          onClick={() => onPropose({ ticker, usdAmount: amount, side })}
        >
          Propose trade
        </Button>
      </div>
    </div>
  );
}
