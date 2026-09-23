"use client";

// Danger-before-the-weekend projection. Shows how much liquidation buffer is
// left as the collateral gaps down in an off-hours or weekend wick. The x axis
// is the downward move, the y axis is the buffer remaining at that lower price.
// A red line marks the liquidation line at 0. A dashed marker sits on the exact
// drop that wipes the buffer out. All math comes from _lib/health.ts.
// House style: no em dashes, no comma before "and" or "or".

import * as React from "react";
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

import { projectDrop, maxSafeDrop } from "../_lib/health";
import { usd } from "@/lib/format";

interface Point {
  drop: number; // fraction
  buffer: number; // projected buffer fraction at that drop
  price: number | null;
}

export interface ProjectionChartProps {
  buffer: number;
  /** current collateral price, drives the projected price in the tooltip. */
  price?: number | null;
}

function buildPoints(buffer: number, price?: number | null): Point[] {
  const liqDrop = maxSafeDrop(buffer);
  // Show a window that comfortably contains the liquidation crossing.
  const maxDrop = Math.min(0.6, Math.max(0.15, liqDrop * 1.8));
  const steps = 60;
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = (maxDrop * i) / steps;
    const p = projectDrop(buffer, d, price);
    out.push({
      drop: d,
      buffer: Number.isFinite(p.projectedBuffer) ? p.projectedBuffer : -1,
      price: p.projectedPrice,
    });
  }
  return out;
}

function ProjTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  const liquidated = p.buffer <= 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">
        {(p.drop * 100).toFixed(1)}% off-hours drop
      </div>
      {p.price != null && (
        <div className="mt-1 text-muted-foreground">
          Price <span className="text-foreground">{usd(p.price)}</span>
        </div>
      )}
      <div className={liquidated ? "text-red-400" : "text-muted-foreground"}>
        {liquidated ? (
          "Liquidated"
        ) : (
          <>
            Buffer left{" "}
            <span className="text-foreground">{(p.buffer * 100).toFixed(1)}%</span>
          </>
        )}
      </div>
    </div>
  );
}

export function ProjectionChart({ buffer, price }: ProjectionChartProps) {
  const data = React.useMemo(() => buildPoints(buffer, price), [buffer, price]);
  const liqDrop = maxSafeDrop(buffer);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="bufferFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
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
            dataKey="drop"
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={(v: number) => `-${Math.round(v * 100)}%`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            tickLine={false}
            width={44}
          />
          <Tooltip content={<ProjTooltip />} />
          <Area
            type="monotone"
            dataKey="buffer"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#bufferFill)"
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceLine
            y={0}
            stroke="#f87171"
            strokeWidth={1.5}
            label={{
              value: "liquidation",
              position: "insideBottomRight",
              fill: "#f87171",
              fontSize: 11,
            }}
          />
          {liqDrop > 0 && liqDrop < 1 && (
            <ReferenceLine
              x={liqDrop}
              stroke="#fb923c"
              strokeDasharray="4 4"
              label={{
                value: `-${(liqDrop * 100).toFixed(0)}% wipes out`,
                position: "insideTopRight",
                fill: "#fb923c",
                fontSize: 11,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProjectionChart;
