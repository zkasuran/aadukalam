"use client";

// A pre-launch auction simulator. Drag to see where price, quote raised and base
// sold land at any point of the discovery auction, all off the SDK quote math.
// It reports progress up so the curve chart can mark the same spot.
// House style: no em dashes, no comma before "and" or "or".
import type { CurvePoint } from "../_lib/dbc";
import { formatCompact, formatPrice } from "../_lib/format";

interface AuctionSimulatorProps {
  points: CurvePoint[];
  progress: number;
  onProgressChange: (p: number) => void;
  quoteSymbol: string;
  baseSymbol: string;
}

function nearest(points: CurvePoint[], progress: number): CurvePoint | undefined {
  if (points.length === 0) return undefined;
  let best = points[0];
  let bestGap = Math.abs(best.progress - progress);
  for (const p of points) {
    const gap = Math.abs(p.progress - progress);
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}

export function AuctionSimulator({
  points,
  progress,
  onProgressChange,
  quoteSymbol,
  baseSymbol,
}: AuctionSimulatorProps) {
  const point = nearest(points, progress);
  const graduated = progress >= 0.999;
  const pct = Math.round(progress * 100);

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Auction progress</span>
        <span className="tabular-nums text-muted-foreground">
          {pct}% to graduation
        </span>
      </div>

      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={progress}
        onChange={(e) => onProgressChange(parseFloat(e.target.value))}
        aria-label="Simulated auction progress"
        className="mt-3 w-full accent-primary"
      />

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Price</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {point ? formatPrice(point.price) : "0"}
          </div>
          <div className="text-xs text-muted-foreground">{quoteSymbol} each</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Raised</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {point ? formatCompact(point.quoteRaised) : "0"}
          </div>
          <div className="text-xs text-muted-foreground">{quoteSymbol}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Sold</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {point ? formatCompact(point.baseSold) : "0"}
          </div>
          <div className="text-xs text-muted-foreground">{baseSymbol}</div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {graduated
          ? "Threshold reached. On devnet the issuer sends the migration tx to open the DAMM v2 pool. Mainnet auto-migrates."
          : "Simulated from the SDK quote math. No pool exists yet, so this is a preview of how the live auction would fill."}
      </p>
    </div>
  );
}
