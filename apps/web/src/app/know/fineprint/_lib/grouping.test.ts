import { describe, expect, it } from "vitest";

import { loadTokens } from "@aadukalam/data";
import type { TokenInfo } from "./types";
import {
  deriveUnderlyingKey,
  deriveUnderlyingLabel,
  groupByUnderlying,
  multiWrapperGroups,
} from "./grouping";

function mk(ticker: string, issuer: string, name: string): TokenInfo {
  return {
    ticker,
    name,
    mint: "mint-" + ticker,
    issuer,
    network: "solana",
    tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    decimals: 8,
    rights: { voting: null, dividends: null, redemption: null, backing: "n/a" },
    themes: [],
  };
}

const spaceX = [
  mk("SPCXx", "Backed Assets (JE) Limited (xStocks)", "SpaceX xStock"),
  mk("SPCXon", "Ondo Global Markets (BVI) Limited", "SpaceX (Ondo Tokenized)"),
  mk("SPCX", "Backpack Securities (with Sunrise)", "SpaceX (Backpack Securities)"),
  mk("SPACEX", "PreStocks", "SpaceX (PreStocks)"),
  mk("tSpaceX", "Tessera", "SpaceX (Tessera)"),
];

describe("deriveUnderlyingKey", () => {
  it("folds all five SpaceX wrappers onto one key", () => {
    for (const t of spaceX) expect(deriveUnderlyingKey(t)).toBe("SPCX");
  });

  it("strips the xStock and Ondo affixes to a shared symbol", () => {
    expect(deriveUnderlyingKey(mk("AAPLx", "Backed Assets (JE) Limited (xStocks)", "Apple xStock"))).toBe("AAPL");
    expect(deriveUnderlyingKey(mk("AAPLon", "Ondo Global Markets (BVI) Limited", "Apple (Ondo Tokenized)"))).toBe("AAPL");
    expect(deriveUnderlyingKey(mk("SPYx", "Backed Assets (JE) Limited (xStocks)", "SP500 xStock"))).toBe("SPY");
    expect(deriveUnderlyingKey(mk("SPYon", "Ondo Global Markets (BVI) Limited", "SPDR S&P 500 ETF (Ondo Tokenized)"))).toBe("SPY");
  });

  it("does not over-strip a leveraged Ondo ticker into a pair it is not", () => {
    expect(deriveUnderlyingKey(mk("TQQQon", "Ondo Global Markets (BVI) Limited", "ProShares UltraPro QQQ (Ondo Tokenized)"))).toBe("TQQQ");
    expect(deriveUnderlyingKey(mk("QQQon", "Ondo Global Markets (BVI) Limited", "Invesco QQQ (Ondo Tokenized)"))).toBe("QQQ");
  });
});

describe("deriveUnderlyingLabel", () => {
  it("drops the issuer descriptor", () => {
    expect(deriveUnderlyingLabel({ name: "SpaceX xStock" })).toBe("SpaceX");
    expect(deriveUnderlyingLabel({ name: "Apple (Ondo Tokenized)" })).toBe("Apple");
  });
});

describe("groupByUnderlying", () => {
  const sample = [
    ...spaceX,
    mk("AAPLx", "Backed Assets (JE) Limited (xStocks)", "Apple xStock"),
    mk("AAPLon", "Ondo Global Markets (BVI) Limited", "Apple (Ondo Tokenized)"),
    mk("GMEx", "Backed Assets (JE) Limited (xStocks)", "Gamestop xStock"),
  ];

  it("puts every wrapper of one underlying in one group", () => {
    const groups = groupByUnderlying(sample);
    const spcx = groups.find((g) => g.key === "SPCX");
    expect(spcx?.tokens).toHaveLength(5);
    expect(groups.find((g) => g.key === "AAPL")?.tokens).toHaveLength(2);
    expect(groups.find((g) => g.key === "GME")?.tokens).toHaveLength(1);
  });

  it("multiWrapperGroups drops singletons and pins SpaceX first", () => {
    const groups = multiWrapperGroups(sample);
    expect(groups.map((g) => g.key)).not.toContain("GME");
    expect(groups[0].key).toBe("SPCX");
  });
});

// One check against the live registry, so grouping is proven on real data, not
// only fixtures. Resolves @aadukalam/data through the workspace symlink.
describe("live registry", () => {
  it("groups the real SpaceX wrappers together", () => {
    const groups = multiWrapperGroups(loadTokens());
    const spcx = groups.find((g) => g.key === "SPCX");
    expect(spcx).toBeDefined();
    const tickers = spcx!.tokens.map((t) => t.ticker);
    for (const t of ["SPCXx", "SPCXon", "SPCX", "SPACEX", "tSpaceX"]) {
      expect(tickers).toContain(t);
    }
  });
});
