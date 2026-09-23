"use client";

import type { Grade, Letter } from "../_lib/grade";
import { cn } from "@/lib/utils";

// Grade color tiers. A and B lean on the app green, C amber, D orange, F red, so
// a backed token reads green and an unproven one reads red without any legend.
const TIER: Record<Letter, { ring: string; text: string; bar: string }> = {
  A: {
    ring: "border-emerald-500/40 bg-emerald-500/10",
    text: "text-emerald-400",
    bar: "bg-emerald-500",
  },
  B: {
    ring: "border-lime-500/40 bg-lime-500/10",
    text: "text-lime-400",
    bar: "bg-lime-500",
  },
  C: {
    ring: "border-amber-500/40 bg-amber-500/10",
    text: "text-amber-400",
    bar: "bg-amber-500",
  },
  D: {
    ring: "border-orange-500/40 bg-orange-500/10",
    text: "text-orange-400",
    bar: "bg-orange-500",
  },
  F: {
    ring: "border-red-500/50 bg-red-500/10",
    text: "text-red-400",
    bar: "bg-red-500",
  },
};

export function tierFor(letter: Letter) {
  return TIER[letter];
}

export function TrustBadge({ grade }: { grade: Grade }) {
  const tier = TIER[grade.letter];
  return (
    <div
      className={cn(
        "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border",
        tier.ring
      )}
      title={`Trust grade ${grade.letter}, score ${grade.score} of 100`}
    >
      <span className={cn("text-2xl font-bold leading-none", tier.text)}>
        {grade.letter}
      </span>
      <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
        {grade.score}/100
      </span>
    </div>
  );
}
