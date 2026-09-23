"use client";

import { Layers } from "lucide-react";

import { compactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ThemeSummary } from "../_lib/themes";

/** The theme picker. One card per theme, selected card is highlighted. Each card
 * shows how many names are in the basket and how many route today. */
export function ThemeGrid({
  themes,
  selected,
  onSelect,
}: {
  themes: ThemeSummary[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {themes.map((t) => {
        const active = t.id === selected;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
              active
                ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                : "border-border bg-card/40 hover:border-primary/40 hover:bg-card/70",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-semibold">{t.label}</span>
              <Layers
                className={cn(
                  "h-3.5 w-3.5",
                  active ? "text-primary" : "text-muted-foreground/60",
                )}
                aria-hidden
              />
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
              {t.blurb}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
              <span>{t.count} names</span>
              <span aria-hidden>·</span>
              <span
                className={
                  t.tradableCount > 0 ? "text-emerald-400/90" : "text-amber-400/90"
                }
              >
                {t.tradableCount} routable
              </span>
              {t.tradableLiquidityUsd > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>${compactNumber(t.tradableLiquidityUsd)}</span>
                </>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
