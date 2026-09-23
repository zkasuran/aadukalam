"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { pct } from "@/lib/format";

import type { WeightedLeg } from "../_lib/weights";

// A categorical palette that stays legible on the dark card. Distinct hues,
// similar lightness, so no single slice reads as "more important" by brightness.
const PALETTE = [
  "#5b8def",
  "#37c8a8",
  "#e0a63b",
  "#c86bd8",
  "#e0725c",
  "#4cc2e0",
  "#8bc34a",
  "#e05c8a",
  "#9b8cf0",
  "#d0b74a",
  "#5cd0a0",
  "#e0894a",
];

interface Slice {
  ticker: string;
  weight: number;
  usdAmount: number;
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: unknown }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const p = payload[0] as { payload: Slice };
  const s = p.payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow">
      <span className="font-semibold text-foreground">{s.ticker}</span>
      <span className="ml-2 tabular-nums text-muted-foreground">
        {pct(s.weight, { isRatio: true })} · ${s.usdAmount.toFixed(2)}
      </span>
    </div>
  );
}

/** Donut of the basket weights. One slice per tradable leg, color stable to the
 * leg's position in the table. */
export function WeightDonut({ legs }: { legs: WeightedLeg[] }) {
  const data: Slice[] = legs
    .filter((l) => l.weight > 0)
    .map((l) => ({ ticker: l.ticker, weight: l.weight, usdAmount: l.usdAmount }));

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-center text-xs text-muted-foreground">
        No routable legs to weight.
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="weight"
            nameKey="ticker"
            innerRadius={52}
            outerRadius={82}
            paddingAngle={1.5}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={d.ticker} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The color a leg gets in the donut, so the table swatches can match. */
export function legColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
