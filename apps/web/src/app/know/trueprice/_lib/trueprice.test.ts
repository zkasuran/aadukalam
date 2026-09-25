import { describe, it, expect } from "vitest";

import {
  premiumDiscount,
  classifyDrift,
  selectFairValue,
  impliedPrice24hAgo,
  buildRow,
  truePriceTokens,
  type JupInfo,
} from "./trueprice";
import { computeMarketState } from "./market";
import type { TokenInfo } from "@aadukalam/data";
import type { PythPrice } from "@aadukalam/sdk";

describe("premiumDiscount", () => {
  it("is zero when the DEX price equals fair value", () => {
    expect(premiumDiscount(100, 100)).toBe(0);
  });

  it("is positive for a premium and negative for a discount", () => {
    expect(premiumDiscount(110, 100)).toBeCloseTo(0.1, 12);
    expect(premiumDiscount(90, 100)).toBeCloseTo(-0.1, 12);
  });

  it("matches the live AAPLx capture (DEX 336.5656 vs underlying 336.995)", () => {
    // Real values pulled from Jupiter /price/v3 on 2026-09-23.
    const r = premiumDiscount(336.5655656051491, 336.995);
    expect(r).not.toBeNull();
    expect(r as number).toBeCloseTo(-0.001274, 5);
  });

  it("returns null on a non-positive or non-finite input", () => {
    expect(premiumDiscount(100, 0)).toBeNull();
    expect(premiumDiscount(100, -5)).toBeNull();
    expect(premiumDiscount(null, 100)).toBeNull();
    expect(premiumDiscount(100, undefined)).toBeNull();
    expect(premiumDiscount(NaN, 100)).toBeNull();
    expect(premiumDiscount(Infinity, 100)).toBeNull();
  });
});

describe("classifyDrift", () => {
  it("labels above/below the epsilon band", () => {
    expect(classifyDrift(0.02)).toBe("premium");
    expect(classifyDrift(-0.02)).toBe("discount");
  });

  it("treats tiny gaps inside the band as in line", () => {
    expect(classifyDrift(0.0005)).toBe("inline");
    expect(classifyDrift(-0.0005)).toBe("inline");
    expect(classifyDrift(0)).toBe("inline");
  });

  it("respects a custom epsilon", () => {
    expect(classifyDrift(0.005, 0.01)).toBe("inline");
    expect(classifyDrift(0.02, 0.01)).toBe("premium");
  });

  it("is inline for a null or NaN ratio", () => {
    expect(classifyDrift(null)).toBe("inline");
    expect(classifyDrift(NaN)).toBe("inline");
  });
});

describe("selectFairValue", () => {
  it("prefers Pyth when it resolves a price", () => {
    const fv = selectFairValue({ pyth: 200, underlying: 195 });
    expect(fv.source).toBe("pyth");
    expect(fv.value).toBe(200);
    expect(fv.label).toBe("Pyth");
  });

  it("falls back to the underlying reference when Pyth is missing", () => {
    const fv = selectFairValue({ pyth: null, underlying: 195 });
    expect(fv.source).toBe("underlying");
    expect(fv.value).toBe(195);
    expect(fv.label).toBe("Underlying ref");
  });

  it("is none when neither anchor is a usable price", () => {
    const fv = selectFairValue({ pyth: null, underlying: 0 });
    expect(fv.source).toBe("none");
    expect(fv.value).toBeNull();
  });
});

describe("impliedPrice24hAgo", () => {
  it("inverts a positive 24h change", () => {
    // up 10% today means it started at price / 1.1
    expect(impliedPrice24hAgo(110, 10)).toBeCloseTo(100, 9);
  });

  it("inverts a negative 24h change", () => {
    // AAPLx live: 336.5656 with -1.5266% implies ~341.78 yesterday
    const prev = impliedPrice24hAgo(336.5655656051491, -1.5265763877680452);
    expect(prev).not.toBeNull();
    expect(prev as number).toBeCloseTo(341.78, 1);
  });

  it("returns null when a factor would be non-positive or inputs are bad", () => {
    expect(impliedPrice24hAgo(100, -100)).toBeNull();
    expect(impliedPrice24hAgo(100, null)).toBeNull();
    expect(impliedPrice24hAgo(null, 5)).toBeNull();
    expect(impliedPrice24hAgo(100, NaN)).toBeNull();
  });
});

// AAPL has both a 24/7 xStock feed and the regular US-equity feed. bestPythFeed
// prefers the equity feed (the one Pyth keeps sponsored + fresh on-chain, keyless).
const AAPL_XSTOCK_FEED = "978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675";
const AAPL_EQUITY_FEED = "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688";

const AAPL: TokenInfo = {
  ticker: "AAPLx",
  name: "Apple xStock",
  mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  issuer: "Backed Assets (JE) Limited (xStocks)",
  network: "solana",
  tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  decimals: 8,
  rights: { voting: false, dividends: null, redemption: null, backing: "1:1 underlying" },
  themes: ["mag7"],
  pythFeedId: AAPL_XSTOCK_FEED,
  pythEquityFeedId: AAPL_EQUITY_FEED,
  pythOndoFeedId: null,
  liquidityUsd: 663258,
};

const jupInfo: JupInfo = {
  usdPrice: 336.5655656051491,
  decimals: 8,
  priceChange24h: -1.5265763877680452,
  liquidity: 665344.18,
  stockData: { id: "xstocks", price: 336.995 },
};

describe("buildRow", () => {
  it("uses the underlying reference when Pyth is absent", () => {
    const row = buildRow(AAPL, jupInfo, undefined);
    expect(row.dexPrice).toBeCloseTo(336.5656, 3);
    expect(row.pythFair).toBeNull();
    expect(row.underlying).toBe(336.995);
    expect(row.fair.source).toBe("underlying");
    expect(row.premium).not.toBeNull();
    expect(row.premium as number).toBeCloseTo(-0.001274, 5);
    expect(row.drift).toBe("discount"); // -0.127% is just beyond the 0.1% band
    expect(row.feed).toBe(AAPL_EQUITY_FEED);
    expect(row.change24h).toBeCloseTo(-1.5266, 3);
    expect(row.liquidity).toBeCloseTo(665344.18, 2);
  });

  it("uses Pyth as the anchor when a price is present", () => {
    const pyth: PythPrice = {
      feedId: AAPL_EQUITY_FEED,
      price: 34000000000, // 340.00 at expo -8
      conf: 5000000,
      expo: -8,
      publishTime: 1758645600,
    };
    const row = buildRow(AAPL, jupInfo, pyth);
    expect(row.pythFair).toBeCloseTo(340, 6);
    expect(row.fair.source).toBe("pyth");
    // DEX 336.57 vs Pyth 340 is a discount beyond the band
    expect(row.premium as number).toBeCloseTo((336.5655656051491 - 340) / 340, 9);
    expect(row.drift).toBe("discount");
  });

  it("degrades to nulls when Jupiter returned nothing", () => {
    const row = buildRow(AAPL, undefined, undefined);
    expect(row.dexPrice).toBeNull();
    expect(row.underlying).toBeNull();
    expect(row.fair.source).toBe("none");
    expect(row.premium).toBeNull();
    expect(row.liquidity).toBe(663258); // still falls back to the registry figure
  });
});

describe("truePriceTokens", () => {
  it("returns tokenized stocks sorted by liquidity, deepest first", () => {
    const list = truePriceTokens();
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].liquidityUsd ?? 0).toBeGreaterThanOrEqual(list[i].liquidityUsd ?? 0);
    }
    // every entry qualifies: a Pyth feed or real liquidity
    for (const t of list) {
      const hasFeed = !!(t.pythFeedId || t.pythEquityFeedId || t.pythOndoFeedId);
      expect(hasFeed || (t.liquidityUsd ?? 0) > 0).toBe(true);
    }
  });
});

describe("computeMarketState", () => {
  it("is regular during the RTH window on a weekday", () => {
    // 2026-09-23 is a Wednesday. 14:00 UTC is 10:00 ET (regular session).
    const info = computeMarketState(new Date("2026-09-23T14:00:00Z"));
    expect(info.state).toBe("regular");
    expect(info.isRegularOpen).toBe(true);
    expect(info.isOffHours).toBe(false);
  });

  it("is weekend on a Saturday", () => {
    const info = computeMarketState(new Date("2026-09-26T18:00:00Z"));
    expect(info.state).toBe("weekend");
    expect(info.isOffHours).toBe(true);
  });

  it("is after hours in the evening ET", () => {
    // 22:00 UTC on a weekday is 18:00 ET, inside the 16:00-20:00 after-hours band.
    const info = computeMarketState(new Date("2026-09-23T22:00:00Z"));
    expect(info.state).toBe("afterhours");
    expect(info.isOffHours).toBe(true);
  });
});
