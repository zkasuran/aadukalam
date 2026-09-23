"use client";

// Semicircular health gauge. The fill is the liquidation buffer as a fraction
// 0..1, colored by band. More fill is safer. A non finite or negative buffer
// reads as an empty red arc, which is the honest "at or past the line" state.
// House style: no em dashes, no comma before "and" or "or".

import * as React from "react";
import type { HealthBand } from "../_lib/health";
import { BAND_META } from "./bands";

export interface HealthGaugeProps {
  /** liquidation buffer as a fraction, e.g. 0.487. */
  buffer: number;
  band: HealthBand;
  /** optional caption under the number, e.g. "of collateral can drop". */
  caption?: string;
}

const R = 90;
const CX = 110;
const CY = 110;
const STROKE = 16;
const LENGTH = Math.PI * R; // length of the top semicircle

export function HealthGauge({ buffer, band, caption }: HealthGaugeProps) {
  const meta = BAND_META[band];
  const finite = Number.isFinite(buffer);
  const fraction = finite ? Math.min(1, Math.max(0, buffer)) : 0;
  const path = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const pctText = finite ? `${(buffer * 100).toFixed(1)}%` : "no data";

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 220 128"
        className="w-full max-w-[260px]"
        role="img"
        aria-label={`Liquidation buffer ${pctText}, ${meta.label}`}
      >
        <path
          d={path}
          fill="none"
          stroke="hsl(var(--border))"
          strokeOpacity={0.5}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={path}
          fill="none"
          stroke={meta.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${fraction * LENGTH} ${LENGTH}`}
        />
        <text
          x={CX}
          y={CY - 26}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 30, fontWeight: 700 }}
        >
          {pctText}
        </text>
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          fill={meta.color}
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}
        >
          {meta.label.toUpperCase()}
        </text>
      </svg>
      {caption && (
        <p className="mt-1 text-center text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}

export default HealthGauge;
