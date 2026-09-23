"use client";

import { cn } from "@/lib/utils";
import { fmtPct } from "../_lib/format";

// Diverging bar for the token price premium or discount versus mark. Centered at
// zero: a bar to the right is a premium, to the left a discount. Small drift reads
// green, moderate amber, large red, because a token trading far from mark is the
// exact signal that went unheeded in the May 2026 collapse.
const CLAMP = 0.3; // widths saturate at +/-30%

export function PremiumBar({ premiumPct }: { premiumPct: number }) {
  const magnitude = Math.min(Math.abs(premiumPct), CLAMP);
  const halfWidth = (magnitude / CLAMP) * 50; // percent of the full track
  const positive = premiumPct >= 0;

  const abs = Math.abs(premiumPct);
  const color =
    abs <= 0.05 ? "bg-emerald-500" : abs <= 0.15 ? "bg-amber-500" : "bg-red-500";
  const textColor =
    abs <= 0.05
      ? "text-emerald-400"
      : abs <= 0.15
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground/80">
        <span>Premium / discount vs mark</span>
        <span className={cn("font-semibold tabular-nums", textColor)}>
          {fmtPct(premiumPct)}
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-muted">
        {/* center line at zero */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
        <div
          className={cn("absolute top-0 h-full rounded-full", color)}
          style={
            positive
              ? { left: "50%", width: `${halfWidth}%` }
              : { right: "50%", width: `${halfWidth}%` }
          }
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
        <span>-30%</span>
        <span>mark</span>
        <span>+30%</span>
      </div>
    </div>
  );
}
