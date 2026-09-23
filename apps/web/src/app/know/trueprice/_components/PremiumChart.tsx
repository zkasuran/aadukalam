"use client";

// PremiumChart accumulates a REAL live-sampled series for one ticker and draws
// two panels: the premium/discount band (green above fair value, red below) and
// the raw on-chain price against the fair-value anchor. Samples are one live read
// every 8 seconds through our proxies, starting from the row already loaded, so
// the chart fills in as you watch. Nothing here is synthesized: with too few
// points it says so rather than inventing a history.

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

import { usd } from "@/lib/format";
import { sampleTicker } from "../_lib/data";
import { premiumDiscount, selectFairValue } from "../_lib/trueprice";

const SAMPLE_MS = 8000;
const MAX_POINTS = 60;

export interface ChartSeed {
  dex: number | null;
  fair: number | null;
  premiumPct: number | null;
}

interface ChartPoint {
  t: number;
  time: string;
  dex: number | null;
  fair: number | null;
  premiumPct: number | null;
}

function clockLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Where the zero line sits in the gradient, so green fills above and red below. */
function zeroOffset(points: ChartPoint[]): number {
  const vals = points.map((p) => p.premiumPct).filter((v): v is number => v != null);
  if (vals.length === 0) return 0.5;
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
} as const;
const tooltipLabel = { color: "hsl(var(--muted-foreground))" } as const;

export function PremiumChart({
  mint,
  feed,
  pythKeyMissing,
  seed,
  fairLabel,
}: {
  mint: string;
  feed: string | null;
  pythKeyMissing: boolean;
  seed: ChartSeed;
  fairLabel: string;
}) {
  const [points, setPoints] = React.useState<ChartPoint[]>(() => [
    { t: Date.now(), time: clockLabel(Date.now()), dex: seed.dex, fair: seed.fair, premiumPct: seed.premiumPct },
  ]);

  React.useEffect(() => {
    // Reset the series when the ticker changes.
    setPoints([
      { t: Date.now(), time: clockLabel(Date.now()), dex: seed.dex, fair: seed.fair, premiumPct: seed.premiumPct },
    ]);
    let cancelled = false;

    const tick = async () => {
      try {
        const s = await sampleTicker(mint, feed, pythKeyMissing);
        if (cancelled) return;
        const fv = selectFairValue({ pyth: s.pyth, underlying: s.underlying });
        const ratio = premiumDiscount(s.dex, fv.value);
        const now = Date.now();
        setPoints((prev) => {
          const next = [
            ...prev,
            {
              t: now,
              time: clockLabel(now),
              dex: s.dex,
              fair: fv.value,
              premiumPct: ratio != null ? ratio * 100 : null,
            },
          ];
          return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
        });
      } catch {
        // a dropped sample is not fatal, the next tick tries again
      }
    };

    const id = setInterval(tick, SAMPLE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint, feed, pythKeyMissing]);

  const off = zeroOffset(points);
  const hasSeries = points.some((p) => p.dex != null);

  if (!hasSeries) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
        No live on-chain price to chart right now.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Premium / discount band</h3>
          <span className="text-xs text-muted-foreground">vs {fairLabel}</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="tp-band-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={off} stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  <stop offset={off} stopColor="hsl(var(--destructive))" stopOpacity={0.45} />
                </linearGradient>
                <linearGradient id="tp-band-stroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={off} stopColor="hsl(var(--primary))" />
                  <stop offset={off} stopColor="hsl(var(--destructive))" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} minTickGap={40} />
              <YAxis
                width={54}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `${Number(v).toFixed(2)}%`}
                domain={["auto", "auto"]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                formatter={(v) => [`${Number(v).toFixed(3)}%`, "Premium/discount"]}
              />
              <Area
                type="monotone"
                dataKey="premiumPct"
                stroke="url(#tp-band-stroke)"
                fill="url(#tp-band-fill)"
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">On-chain price vs fair value</h3>
          <span className="text-xs text-muted-foreground">{points.length} live samples</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} minTickGap={40} />
              <YAxis
                width={64}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => usd(Number(v), { maxFractionDigits: 2 })}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                formatter={(v, name) => [usd(Number(v)), name === "dex" ? "On-chain" : "Fair value"]}
              />
              <Line
                type="monotone"
                dataKey="dex"
                name="dex"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="fair"
                name="fair"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Live samples, one every {SAMPLE_MS / 1000}s since you opened this view. Real reads from the
        Jupiter price API, plus Pyth when a key is set. The gap between the two lines is the premium
        or discount you see above.
      </p>
    </div>
  );
}

export default PremiumChart;
