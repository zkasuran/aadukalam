"use client";

// Price-vs-progress auction curve, drawn from the SDK quote math. One series, so
// no legend, the title names it. Thin 2px line in the brand accent, recessive
// grid and axes, a crosshair tooltip and a dashed graduation marker at 100%.
// House style: no em dashes, no comma before "and" or "or".
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CurvePoint } from "../_lib/dbc";
import { formatCompact, formatPrice } from "../_lib/format";

interface CurveChartProps {
  points: CurvePoint[];
  quoteSymbol: string;
  baseSymbol: string;
  /** current simulated auction progress 0..1, drawn as a vertical marker */
  markerProgress?: number;
}

interface TooltipPayloadItem {
  payload: CurvePoint;
}

function CurveTooltip({
  active,
  payload,
  quoteSymbol,
  baseSymbol,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  quoteSymbol: string;
  baseSymbol: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">
        {(p.progress * 100).toFixed(0)}% of auction
      </div>
      <div className="mt-1 text-muted-foreground">
        Price{" "}
        <span className="text-foreground">
          {formatPrice(p.price)} {quoteSymbol}
        </span>
      </div>
      <div className="text-muted-foreground">
        Raised{" "}
        <span className="text-foreground">
          {formatCompact(p.quoteRaised)} {quoteSymbol}
        </span>
      </div>
      <div className="text-muted-foreground">
        Sold{" "}
        <span className="text-foreground">
          {formatCompact(p.baseSold)} {baseSymbol}
        </span>
      </div>
    </div>
  );
}

export function CurveChart({
  points,
  quoteSymbol,
  baseSymbol,
  markerProgress,
}: CurveChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
        >
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="progress"
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            tickLine={false}
          />
          <YAxis
            dataKey="price"
            tickFormatter={(v: number) => formatPrice(v)}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            tickLine={false}
            width={64}
          />
          <Tooltip
            content={
              <CurveTooltip
                quoteSymbol={quoteSymbol}
                baseSymbol={baseSymbol}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#curveFill)"
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            isAnimationActive={false}
          />
          <ReferenceLine
            x={1}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            label={{
              value: "Graduation",
              position: "insideTopRight",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11,
            }}
          />
          {typeof markerProgress === "number" && (
            <ReferenceLine
              x={markerProgress}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeOpacity={0.7}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
