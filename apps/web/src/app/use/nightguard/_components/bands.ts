// Band metadata shared by the Nightguard components. Pure, client safe. Colors
// follow the app's status palette already used across the modules: emerald for
// safe, amber for watch, orange for danger, red for liquidatable.
// House style: no em dashes, no comma before "and" or "or".

import type { HealthBand } from "../_lib/health";

export interface BandMeta {
  label: string;
  /** hsl/hex color for the gauge stroke and chart marks. */
  color: string;
  /** tailwind classes for a chip. */
  chip: string;
  /** one line describing what this band means. */
  blurb: string;
}

export const BAND_META: Record<HealthBand, BandMeta> = {
  safe: {
    label: "Safe",
    color: "#34d399",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    blurb: "Plenty of headroom. A normal off-hours move will not liquidate this.",
  },
  watch: {
    label: "Watch",
    color: "#fbbf24",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    blurb: "Getting tight. A sharp weekend gap could eat most of the buffer.",
  },
  danger: {
    label: "Danger",
    color: "#fb923c",
    chip: "border-orange-500/50 bg-orange-500/10 text-orange-400",
    blurb: "A small off-hours wick can liquidate this. Deleverage before the close.",
  },
  liquidatable: {
    label: "Liquidatable",
    color: "#f87171",
    chip: "border-red-500/50 bg-red-500/10 text-red-400",
    blurb: "The position is at or past the liquidation line right now.",
  },
};
