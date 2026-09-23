// Maps a logic-layer Tone to Tailwind classes for a small pill and a dot. Colour
// lives here so the classifiers stay colour-free. House style: no em dashes,
// no comma before "and" or "or".

import type { Tone } from "../_lib/types";

const PILL: Record<Tone, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  neutral: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  caution: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  negative: "border-red-500/30 bg-red-500/10 text-red-300",
};

const DOT: Record<Tone, string> = {
  positive: "bg-emerald-400",
  neutral: "bg-sky-400",
  caution: "bg-amber-400",
  negative: "bg-red-400",
};

export function tonePill(tone: Tone): string {
  return PILL[tone];
}

export function toneDot(tone: Tone): string {
  return DOT[tone];
}
