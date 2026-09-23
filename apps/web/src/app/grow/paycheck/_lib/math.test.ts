import { describe, it, expect } from "vitest";

import {
  bpsToMultiplier,
  computeDividendUsdc,
  deltaBps,
  formatMultiplier,
  newMultiplierFromYield,
  rebaseYieldPct,
} from "./math";

describe("bpsToMultiplier", () => {
  it("reads 10000 bps as 1.0x", () => {
    expect(bpsToMultiplier(10000)).toBe(1);
  });
  it("reads 10250 bps as 1.025x", () => {
    expect(bpsToMultiplier(10250)).toBe(1.025);
  });
});

describe("formatMultiplier", () => {
  it("renders four fraction digits with an x", () => {
    expect(formatMultiplier(10000)).toBe("1.0000x");
    expect(formatMultiplier(10250)).toBe("1.0250x");
    expect(formatMultiplier(12345)).toBe("1.2345x");
  });
});

describe("deltaBps", () => {
  it("is the step up", () => {
    expect(deltaBps(10000, 10250)).toBe(250);
  });
  it("clamps a flat or downward rebase to zero", () => {
    expect(deltaBps(10250, 10250)).toBe(0);
    expect(deltaBps(10250, 10000)).toBe(0);
  });
});

describe("rebaseYieldPct", () => {
  it("reads a 2.5% dividend", () => {
    expect(rebaseYieldPct(10000, 10250)).toBe(2.5);
  });
  it("is zero for a non-positive base, never a divide by zero", () => {
    expect(rebaseYieldPct(0, 100)).toBe(0);
  });
});

describe("newMultiplierFromYield", () => {
  it("applies a yield to the current multiplier and rounds to whole bps", () => {
    expect(newMultiplierFromYield(10000, 2.5)).toBe(10250);
    expect(newMultiplierFromYield(10250, 2.5)).toBe(10506);
  });
});

describe("computeDividendUsdc", () => {
  it("prices a 2.5% rebase on 100 shares at $180", () => {
    // 100 shares grow 2.5% -> 2.5 new shares * $180 = $450.00.
    const usdc = computeDividendUsdc({
      principalBaseUnits: 100_000_000n, // 100 shares, 6 decimals
      stockDecimals: 6,
      oldMultiplierBps: 10000,
      newMultiplierBps: 10250,
      pricePerShareUsd: 180,
      usdcDecimals: 6,
    });
    expect(usdc).toBe(450_000_000n); // $450.000000
  });

  it("handles a nine-decimal stock token", () => {
    // 10 shares grow 5% -> 0.5 new shares * $10 = $5.00.
    const usdc = computeDividendUsdc({
      principalBaseUnits: 10_000_000_000n, // 10 shares, 9 decimals
      stockDecimals: 9,
      oldMultiplierBps: 10000,
      newMultiplierBps: 10500,
      pricePerShareUsd: 10,
      usdcDecimals: 6,
    });
    expect(usdc).toBe(5_000_000n); // $5.000000
  });

  it("floors a fractional micro-USDC result", () => {
    // 1 share grows 0.01% -> 0.0001 shares * $33.33 = $0.003333.
    const usdc = computeDividendUsdc({
      principalBaseUnits: 1_000_000n,
      stockDecimals: 6,
      oldMultiplierBps: 10000,
      newMultiplierBps: 10001,
      pricePerShareUsd: 33.33,
      usdcDecimals: 6,
    });
    expect(usdc).toBe(3333n); // $0.003333
  });

  it("pays zero on a flat or downward rebase", () => {
    const flat = computeDividendUsdc({
      principalBaseUnits: 100_000_000n,
      stockDecimals: 6,
      oldMultiplierBps: 10250,
      newMultiplierBps: 10250,
      pricePerShareUsd: 180,
      usdcDecimals: 6,
    });
    expect(flat).toBe(0n);
    const down = computeDividendUsdc({
      principalBaseUnits: 100_000_000n,
      stockDecimals: 6,
      oldMultiplierBps: 10250,
      newMultiplierBps: 10000,
      pricePerShareUsd: 180,
      usdcDecimals: 6,
    });
    expect(down).toBe(0n);
  });

  it("pays zero with no principal or a non-positive price", () => {
    expect(
      computeDividendUsdc({
        principalBaseUnits: 0n,
        stockDecimals: 6,
        oldMultiplierBps: 10000,
        newMultiplierBps: 10250,
        pricePerShareUsd: 180,
        usdcDecimals: 6,
      }),
    ).toBe(0n);
    expect(
      computeDividendUsdc({
        principalBaseUnits: 100_000_000n,
        stockDecimals: 6,
        oldMultiplierBps: 10000,
        newMultiplierBps: 10250,
        pricePerShareUsd: 0,
        usdcDecimals: 6,
      }),
    ).toBe(0n);
  });
});
