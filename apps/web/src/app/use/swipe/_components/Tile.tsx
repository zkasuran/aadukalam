"use client";

import { cn } from "@/lib/utils";

/** One labeled figure in the borrow terms panel. `hint` is a small note under the
 * value, used to mark a number as a live read or a projection. */
export function Tile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "up" | "down" | "warn";
}) {
  const toneClass =
    tone === "up"
      ? "text-emerald-400"
      : tone === "down"
        ? "text-red-400"
        : tone === "warn"
          ? "text-amber-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", toneClass)}>{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground/70">{hint}</p>
      ) : null}
    </div>
  );
}
