"use client";

// The Call: bet slip. Choose a side, enter a USDC stake and see the pro-rata
// payout if that side wins. One bet per market per user, so if the user already
// has a position the side is locked to it and a further stake adds to it, which
// is exactly what the program enforces.

import * as React from "react";

import { Button } from "@/components/ui/button";
import { toBaseUnits, fromBaseUnits } from "@aadukalam/sdk";
import { usd } from "@/lib/format";
import { potentialPayout, sideLabel, SIDE_NO, SIDE_YES, type Side } from "../_lib/math";
import type { BetView, MarketView } from "../_lib/types";

export function BetSlip({
  market,
  userBet,
  decimals,
  busy,
  onBet,
}: {
  market: MarketView;
  userBet: BetView | null;
  decimals: number;
  busy: boolean;
  onBet: (side: Side, amountBase: bigint) => Promise<void>;
}) {
  const locked = userBet ? (userBet.side as Side) : null;
  const [side, setSide] = React.useState<Side>(locked ?? SIDE_YES);
  const [amountStr, setAmountStr] = React.useState<string>("");

  React.useEffect(() => {
    if (locked != null) setSide(locked);
  }, [locked]);

  const dollars = Number(amountStr);
  const valid = Number.isFinite(dollars) && dollars > 0 && amountStr.trim() !== "";
  const amountBase = valid ? BigInt(toBaseUnits(dollars, decimals)) : 0n;

  const payout = potentialPayout({
    side,
    betAmount: amountBase,
    totalYes: market.totalYes,
    totalNo: market.totalNo,
  });
  const payoutDollars = fromBaseUnits(payout.toString(), decimals);
  const multiple = valid && amountBase > 0n ? Number(payout) / Number(amountBase) : 0;

  const place = async () => {
    if (!valid || busy) return;
    await onBet(side, amountBase);
    setAmountStr("");
  };

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="flex gap-2">
        {[SIDE_YES, SIDE_NO].map((s) => (
          <button
            key={s}
            disabled={locked != null && locked !== s}
            onClick={() => setSide(s as Side)}
            className={[
              "flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
              side === s
                ? s === SIDE_YES
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-rose-500 bg-rose-500/15 text-rose-300"
                : "border-input text-muted-foreground hover:bg-accent",
              locked != null && locked !== s ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
          >
            {sideLabel(s)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="USDC amount"
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
        />
        <Button disabled={!valid || busy} onClick={place}>
          {busy ? "…" : `Bet ${sideLabel(side)}`}
        </Button>
      </div>

      {valid && (
        <p className="mt-2 text-xs text-muted-foreground">
          if {sideLabel(side)} wins you receive about {usd(payoutDollars)} ({multiple.toFixed(2)}x),
          stake plus a pro-rata share of the losing pool. Estimate at the current pool.
        </p>
      )}
      {locked != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          you already hold a {sideLabel(locked)} position, a further bet adds to it
        </p>
      )}
    </div>
  );
}
