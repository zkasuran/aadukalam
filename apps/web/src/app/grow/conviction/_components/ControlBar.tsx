"use client";

import { cn } from "@/lib/utils";

import { RULES, type WeightRule } from "../_lib/weights";

/** Rule selector and the USDC budget input. The rule sets the weights, the budget
 * is what splits across the legs. Slippage is fixed at a sensible default and
 * noted rather than exposed as a knob. */
export function ControlBar({
  rule,
  onRule,
  budget,
  onBudget,
}: {
  rule: WeightRule;
  onRule: (r: WeightRule) => void;
  budget: number;
  onBudget: (n: number) => void;
}) {
  const active = RULES.find((r) => r.id === rule) ?? RULES[0];

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
            Weighting rule
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RULES.map((r) => {
              const on = r.id === rule;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onRule(r.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    on
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0">
          <label
            htmlFor="conviction-budget"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground/80"
          >
            Budget (USDC)
          </label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              id="conviction-budget"
              type="number"
              min={1}
              step={1}
              inputMode="decimal"
              value={Number.isFinite(budget) ? budget : ""}
              onChange={(e) => onBudget(Number(e.target.value))}
              className="w-28 bg-transparent text-right text-sm font-semibold tabular-nums outline-none"
            />
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-snug text-muted-foreground">
        {active.blurb} Each leg routes ExactIn at 50 bps slippage. Jupiter picks
        the route.
      </p>
    </div>
  );
}
