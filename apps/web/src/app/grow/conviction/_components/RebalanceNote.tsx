"use client";

import { CalendarClock, Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { nextRebalance, ruleMeta, type WeightRule } from "../_lib/weights";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** The rebalance rule and the next scheduled run. The keeper is simulated, not a
 * live on-chain cron yet. The label says so on screen. */
export function RebalanceNote({ rule }: { rule: WeightRule }) {
  const meta = ruleMeta(rule);
  const next = nextRebalance(rule);

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Rebalance rule</span>
        </div>
        <Badge
          variant="outline"
          className="border-amber-500/40 text-[10px] uppercase tracking-wide text-amber-300"
        >
          Simulated keeper
        </Badge>
      </div>

      <p className="mt-2 text-sm leading-snug text-muted-foreground">
        {meta.label}, rebalanced {meta.cadenceLabel}. The keeper re-reads the
        rule, recomputes the weights and rebuilds the swaps back toward target.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
            Next rebalance
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {DATE_FMT.format(next.date)}{" "}
            <span className="font-normal text-muted-foreground">
              (in {next.inDays} days)
            </span>
          </p>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-tight text-muted-foreground/70">
        Scheduled, not yet automated on chain. Today every rebalance is a set of
        swaps you sign yourself, the same as the first buy.
      </p>
    </div>
  );
}
