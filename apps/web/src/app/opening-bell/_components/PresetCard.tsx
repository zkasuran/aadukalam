"use client";

// A selectable preset card. Shows the equity-tuned curve name, its one-line
// tagline and the headline stats. Selection is a ring in the brand accent.
// House style: no em dashes, no comma before "and" or "or".
import { cn } from "@/lib/utils";
import type { EquityPreset } from "../_lib/presets";

interface PresetCardProps {
  preset: EquityPreset;
  selected: boolean;
  onSelect: (id: EquityPreset["id"]) => void;
}

export function PresetCard({ preset, selected, onSelect }: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(preset.id)}
      aria-pressed={selected}
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-4 text-left transition-colors",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{preset.name}</span>
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            selected ? "bg-primary" : "bg-muted"
          )}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{preset.tagline}</p>
      <dl className="mt-3 space-y-1.5 text-xs">
        {preset.stats.map((s) => (
          <div key={s.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{s.label}</dt>
            <dd className="text-right font-medium text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}
