import { describe, it, expect } from "vitest";

import {
  buildBasketPlan,
  computeWeights,
  dedupeByUnderlying,
  isTradable,
  nextRebalance,
  toConstituent,
  underlyingSymbol,
  USDC_DECIMALS,
  type Constituent,
} from "./weights";

// Small fixtures. Numbers are chosen so the expected weights are easy to check
// by hand rather than pulled from any live feed.
function c(
  ticker: string,
  liquidityUsd: number,
  marketCap: number | null = null,
  momentum: number | null = null,
): Constituent {
  return {
    ticker,
    name: `${ticker} test`,
    mint: `mint-${ticker}`,
    decimals: 8,
    issuer: "test",
    liquidityUsd,
    marketCap,
    momentum,
    usdPrice: null,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("computeWeights", () => {
  it("equal weight gives every leg 1/N and sums to 1", () => {
    const items = [c("A", 100), c("B", 900), c("C", 5)];
    const w = computeWeights(items, "equal");
    expect(w).toHaveLength(3);
    for (const x of w) expect(x).toBeCloseTo(1 / 3, 12);
    expect(sum(w)).toBeCloseTo(1, 12);
  });

  it("liquidity weight is proportional to liquidityUsd", () => {
    const items = [c("A", 100), c("B", 300)]; // 1:3
    const w = computeWeights(items, "liquidity");
    expect(w[0]).toBeCloseTo(0.25, 12);
    expect(w[1]).toBeCloseTo(0.75, 12);
    expect(sum(w)).toBeCloseTo(1, 12);
    // the deeper name carries the larger weight
    expect(w[1]).toBeGreaterThan(w[0]);
  });

  it("market-cap weight uses marketCap and falls back to liquidity when null", () => {
    // B has no published cap, so it should fall back to its liquidity (200)
    const items = [c("A", 50, 800), c("B", 200, null)]; // metrics 800 : 200
    const w = computeWeights(items, "market-cap");
    expect(w[0]).toBeCloseTo(0.8, 12);
    expect(w[1]).toBeCloseTo(0.2, 12);
    expect(sum(w)).toBeCloseTo(1, 12);
  });

  it("momentum tilts toward the stronger mover and stays positive for laggards", () => {
    const items = [c("A", 100, null, 2), c("B", 100, null, -2)];
    const w = computeWeights(items, "momentum");
    expect(sum(w)).toBeCloseTo(1, 12);
    // winner outweighs the laggard, laggard still keeps a slice
    expect(w[0]).toBeGreaterThan(w[1]);
    expect(w[1]).toBeGreaterThan(0);
  });

  it("all-null momentum degrades to equal weight", () => {
    const items = [c("A", 100), c("B", 100), c("C", 100)];
    const w = computeWeights(items, "momentum");
    for (const x of w) expect(x).toBeCloseTo(1 / 3, 12);
  });

  it("all-zero metric degrades to equal weight rather than dividing by zero", () => {
    const items = [c("A", 0), c("B", 0)];
    const w = computeWeights(items, "liquidity");
    expect(w[0]).toBeCloseTo(0.5, 12);
    expect(w[1]).toBeCloseTo(0.5, 12);
  });

  it("returns [] for an empty set", () => {
    expect(computeWeights([], "equal")).toEqual([]);
  });
});

describe("buildBasketPlan budget split", () => {
  it("splits the budget across legs so the leg amounts sum to the budget", () => {
    const items = [c("A", 100), c("B", 300)]; // liquidity 1:3
    const plan = buildBasketPlan(items, "liquidity", 100);
    expect(plan[0].usdAmount).toBeCloseTo(25, 9);
    expect(plan[1].usdAmount).toBeCloseTo(75, 9);
    expect(sum(plan.map((l) => l.usdAmount))).toBeCloseTo(100, 9);
    // weights carried through
    expect(sum(plan.map((l) => l.weight))).toBeCloseTo(1, 12);
  });

  it("converts each leg to raw USDC base units for an ExactIn quote", () => {
    const items = [c("A", 100), c("B", 100)]; // equal-ish
    const plan = buildBasketPlan(items, "equal", 10); // $5 each
    expect(USDC_DECIMALS).toBe(6);
    expect(plan[0].baseUnitsIn).toBe("5000000"); // 5 USDC in 6-decimal base units
    expect(plan[1].baseUnitsIn).toBe("5000000");
  });

  it("a zero or invalid budget yields zero-amount legs, never NaN", () => {
    const items = [c("A", 100), c("B", 100)];
    const plan = buildBasketPlan(items, "equal", 0);
    for (const l of plan) {
      expect(l.usdAmount).toBe(0);
      expect(l.baseUnitsIn).toBe("0");
    }
  });
});

describe("isTradable liquidity gate", () => {
  it("passes deep names and holds out thin ones", () => {
    expect(isTradable(c("NVDAx", 2_876_132))).toBe(true);
    expect(isTradable(c("OKLOx", 0))).toBe(false);
    expect(isTradable(c("TSMx", 2_667))).toBe(false); // below the 5k floor
  });
});

describe("underlyingSymbol and dedupeByUnderlying", () => {
  it("strips the Ondo and xStock suffixes to the underlying", () => {
    expect(underlyingSymbol("AAPLx")).toBe("AAPL");
    expect(underlyingSymbol("AAPLon")).toBe("AAPL");
    expect(underlyingSymbol("NVDAx")).toBe("NVDA");
    expect(underlyingSymbol("SPYon")).toBe("SPY");
  });

  it("keeps one mint per company, the deepest one", () => {
    const tokens = [
      { ticker: "AAPLx", mint: "x", liquidityUsd: 663_258 },
      { ticker: "AAPLon", mint: "on", liquidityUsd: 991 },
      { ticker: "NVDAx", mint: "nx", liquidityUsd: 2_876_132 },
    ] as unknown as Parameters<typeof dedupeByUnderlying>[0];
    const out = dedupeByUnderlying(tokens);
    expect(out).toHaveLength(2);
    const apple = out.find((t) => underlyingSymbol(t.ticker) === "AAPL");
    expect(apple?.mint).toBe("x"); // the deeper AAPLx, not AAPLon
    // sorted deepest first
    expect(underlyingSymbol(out[0].ticker)).toBe("NVDA");
  });

  it("drops entries with no mint", () => {
    const tokens = [
      { ticker: "AAPLx", mint: "x", liquidityUsd: 10 },
      { ticker: "GHOSTx", mint: "", liquidityUsd: 999 },
    ] as unknown as Parameters<typeof dedupeByUnderlying>[0];
    const out = dedupeByUnderlying(tokens);
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("AAPLx");
  });
});

describe("toConstituent", () => {
  it("seeds a constituent from the registry token with live fields null", () => {
    const t = {
      ticker: "NVDAx",
      name: "NVIDIA xStock",
      mint: "Xsc9",
      decimals: 8,
      issuer: "Backed",
      liquidityUsd: 2_876_132,
      themes: ["mag7"],
    } as unknown as Parameters<typeof toConstituent>[0];
    const out = toConstituent(t);
    expect(out.ticker).toBe("NVDAx");
    expect(out.liquidityUsd).toBe(2_876_132);
    expect(out.marketCap).toBeNull();
    expect(out.momentum).toBeNull();
  });
});

describe("nextRebalance", () => {
  it("schedules the next run at the rule's cadence from a fixed date", () => {
    const from = new Date("2026-09-23T00:00:00Z");
    const weekly = nextRebalance("momentum", from);
    expect(weekly.inDays).toBe(7);
    expect(weekly.cadenceLabel).toBe("weekly");
    expect(weekly.date.toISOString()).toBe("2026-09-30T00:00:00.000Z");

    const monthly = nextRebalance("market-cap", from);
    expect(monthly.inDays).toBe(30);
    expect(monthly.date.toISOString()).toBe("2026-10-23T00:00:00.000Z");
  });
});
