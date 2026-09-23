// Unit tests for the Nightguard liquidation math. Known inputs, hand computed
// expected values. This is the core of the module, so the coverage is thorough:
// the buffer formula, the single collateral liquidation price, the price to
// buffer round trip, the band classifier and the off-hours drop projection.
//
// Run: node_modules/.bin/vitest run apps/web/src/app/use/nightguard/_lib/health.test.ts

import { describe, it, expect } from "vitest";
import {
  liquidationBuffer,
  liquidationPrice,
  bufferFromPrice,
  maxSafeDrop,
  healthBand,
  projectDrop,
  projectDrops,
} from "./health";

describe("liquidationBuffer", () => {
  it("is 1 - borrow / liquidationLimit", () => {
    expect(liquidationBuffer(50, 100)).toBeCloseTo(0.5, 12);
    expect(liquidationBuffer(90, 100)).toBeCloseTo(0.1, 12);
    expect(liquidationBuffer(25, 100)).toBeCloseTo(0.75, 12);
  });

  it("is 0 on the line and negative past it", () => {
    expect(liquidationBuffer(100, 100)).toBe(0);
    expect(liquidationBuffer(110, 100)).toBeCloseTo(-0.1, 12);
  });

  it("is fully buffered when there is no debt bearing limit", () => {
    expect(liquidationBuffer(0, 0)).toBe(1);
    expect(liquidationBuffer(0, 100)).toBe(1);
  });

  it("returns NaN on non finite inputs", () => {
    expect(liquidationBuffer(NaN, 100)).toBeNaN();
    expect(liquidationBuffer(50, NaN)).toBeNaN();
  });
});

describe("liquidationPrice (single collateral)", () => {
  it("is borrow / (collateralAmount * liqThreshold)", () => {
    // 500 / (10 * 0.5) = 100
    expect(liquidationPrice(500, 10, 0.5)).toBeCloseTo(100, 10);
    // 600 / (8 * 0.65) = 115.384615...
    expect(liquidationPrice(600, 8, 0.65)).toBeCloseTo(115.3846153846, 8);
  });

  it("is 0 when there is no debt", () => {
    expect(liquidationPrice(0, 10, 0.5)).toBe(0);
  });

  it("returns NaN when the collateral or threshold is zero", () => {
    expect(liquidationPrice(500, 0, 0.5)).toBeNaN();
    expect(liquidationPrice(500, 10, 0)).toBeNaN();
  });
});

describe("bufferFromPrice", () => {
  it("is 1 - pLiq / pNow", () => {
    expect(bufferFromPrice(100, 200)).toBeCloseTo(0.5, 12);
    expect(bufferFromPrice(100, 100)).toBe(0);
  });

  it("returns NaN when the current price is missing or zero", () => {
    expect(bufferFromPrice(100, 0)).toBeNaN();
    expect(bufferFromPrice(100, NaN)).toBeNaN();
  });
});

describe("buffer round trip (the two formulas agree for one collateral)", () => {
  it("liquidationBuffer equals bufferFromPrice built from the same position", () => {
    const collateralAmount = 8;
    const price = 225;
    const liqThreshold = 0.65;
    const borrow = 600;

    const collateralValueUsd = collateralAmount * price; // 1800
    const limit = collateralValueUsd * liqThreshold; // 1170

    const fromStats = liquidationBuffer(borrow, limit);
    const pLiq = liquidationPrice(borrow, collateralAmount, liqThreshold);
    const fromPrice = bufferFromPrice(pLiq, price);

    expect(fromStats).toBeCloseTo(0.4871794871, 8);
    expect(fromPrice).toBeCloseTo(fromStats, 10);
  });
});

describe("maxSafeDrop", () => {
  it("is the buffer clamped to 0..1", () => {
    expect(maxSafeDrop(0.5)).toBe(0.5);
    expect(maxSafeDrop(1.2)).toBe(1);
    expect(maxSafeDrop(-0.3)).toBe(0);
    expect(maxSafeDrop(NaN)).toBe(0);
  });
});

describe("healthBand", () => {
  it("classifies against the default thresholds", () => {
    expect(healthBand(0.5)).toBe("safe");
    expect(healthBand(0.26)).toBe("safe");
    expect(healthBand(0.25)).toBe("watch");
    expect(healthBand(0.2)).toBe("watch");
    expect(healthBand(0.1)).toBe("danger");
    expect(healthBand(0.05)).toBe("danger");
    expect(healthBand(0)).toBe("liquidatable");
    expect(healthBand(-0.1)).toBe("liquidatable");
  });

  it("treats a non finite buffer as liquidatable", () => {
    expect(healthBand(NaN)).toBe("liquidatable");
    expect(healthBand(Number.NEGATIVE_INFINITY)).toBe("liquidatable");
  });

  it("honours custom thresholds", () => {
    const bands = { danger: 0.2, watch: 0.4 };
    expect(healthBand(0.15, bands)).toBe("danger");
    expect(healthBand(0.3, bands)).toBe("watch");
    expect(healthBand(0.5, bands)).toBe("safe");
  });
});

describe("projectDrop (off-hours gap scenario)", () => {
  it("survives while the drop is below the buffer", () => {
    const p = projectDrop(0.2, 0.1, 200);
    expect(p.survives).toBe(true);
    expect(p.headroom).toBeCloseTo(0.1, 12);
    expect(p.projectedBuffer).toBeCloseTo(0.1111111111, 8);
    expect(p.projectedPrice).toBeCloseTo(180, 10);
  });

  it("is exactly on the line when the drop equals the buffer", () => {
    const p = projectDrop(0.2, 0.2, 200);
    expect(p.survives).toBe(false);
    expect(p.headroom).toBeCloseTo(0, 12);
    expect(p.projectedBuffer).toBeCloseTo(0, 12);
    expect(p.projectedPrice).toBeCloseTo(160, 10);
  });

  it("is liquidated when the drop is past the buffer", () => {
    const p = projectDrop(0.2, 0.25, 200);
    expect(p.survives).toBe(false);
    expect(p.headroom).toBeCloseTo(-0.05, 12);
    expect(p.projectedBuffer).toBeCloseTo(-0.0666666667, 8);
    expect(p.projectedPrice).toBeCloseTo(150, 10);
  });

  it("floors the price at zero on a total wipeout", () => {
    const p = projectDrop(0.2, 1, 200);
    expect(p.survives).toBe(false);
    expect(p.projectedBuffer).toBe(Number.NEGATIVE_INFINITY);
    expect(p.projectedPrice).toBe(0);
    const past = projectDrop(0.2, 1.5, 200);
    expect(past.projectedPrice).toBe(0);
  });

  it("returns a null price when none is supplied", () => {
    const p = projectDrop(0.2, 0.1);
    expect(p.projectedPrice).toBeNull();
  });
});

describe("projectDrops", () => {
  it("maps a weekend gap ladder onto projections", () => {
    const buffer = 0.4871794871; // the NVDAx example above
    const rows = projectDrops(buffer, [0.05, 0.1, 0.2, 0.5], 225);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.survives)).toEqual([true, true, true, false]);
    expect(rows[0].projectedPrice).toBeCloseTo(213.75, 6);
    expect(rows[3].projectedPrice).toBeCloseTo(112.5, 6);
  });
});
