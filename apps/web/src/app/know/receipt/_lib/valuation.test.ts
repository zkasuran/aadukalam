import { describe, it, expect } from "vitest";
import { buildValuationDesk, compactUsd } from "./valuation";
import type { ReceiptRow } from "./types";

function row(p: Partial<ReceiptRow>): ReceiptRow {
  return {
    provider: "prestocks",
    company: p.company ?? "X",
    symbol: p.symbol ?? "X",
    code: null,
    sector: null,
    mint: p.mint ?? "m" + (p.symbol ?? "X"),
    price: p.price ?? 100,
    markPrice: p.markPrice ?? 100,
    premiumPct: p.premiumPct ?? null,
    supply: p.supply ?? 1000,
    holders: null,
    markValuation: p.markValuation ?? 0,
    impliedValuation: p.impliedValuation ?? 0,
    companyShares: p.companyShares ?? null,
    onChainMktCap: null,
    metadataUri: null,
    externalUrl: null,
    backing: { hasProof: false, kind: "none", legalStructure: null, custodian: null, auditor: null, auditId: null, auditFindings: null, feedUrl: null, proofUrl: null, note: "" },
    ...p,
  } as ReceiptRow;
}

describe("buildValuationDesk", () => {
  const rows = [
    row({ symbol: "OPENAI", markPrice: 1023.73, price: 1376.09, markValuation: 1.268e12, impliedValuation: 1.705e12 }),
    row({ symbol: "NEURALINK", markPrice: 336.77, price: 439.49, markValuation: 64.2e9, impliedValuation: 83.7e9 }),
    row({ symbol: "ANTHROPIC", markPrice: 1052.55, price: 1051.1, markValuation: 1.724e12, impliedValuation: 1.722e12 }),
  ];

  it("ranks by absolute premium, biggest first", () => {
    const d = buildValuationDesk(rows);
    expect(d.count).toBe(3);
    expect(d.legs[0].row.symbol).toBe("OPENAI"); // +34.4% is the largest
    expect(d.legs[d.legs.length - 1].row.symbol).toBe("ANTHROPIC"); // ~-0.14% smallest
  });

  it("signs the valuation gap and premium", () => {
    const d = buildValuationDesk(rows);
    const openai = d.legs.find((l) => l.row.symbol === "OPENAI")!;
    expect(openai.premium).toBeGreaterThan(0.3);
    expect(openai.valuationGap).toBeGreaterThan(0);
    const anthropic = d.legs.find((l) => l.row.symbol === "ANTHROPIC")!;
    expect(anthropic.premium).toBeLessThan(0);
    expect(anthropic.valuationGap).toBeLessThan(0);
  });

  it("aggregates mark and implied totals and the spread", () => {
    const d = buildValuationDesk(rows);
    expect(d.markTotal).toBeCloseTo(1.268e12 + 64.2e9 + 1.724e12, -8);
    expect(d.impliedTotal).toBeGreaterThan(d.markTotal); // book is net over mark
    expect(d.spread).toBeGreaterThan(0);
    expect(d.topPremium?.row.symbol).toBe("OPENAI");
    expect(d.topDiscount?.row.symbol).toBe("ANTHROPIC");
  });

  it("skips rows with a missing valuation instead of counting it as zero", () => {
    const d = buildValuationDesk([...rows, row({ symbol: "NOVAL", markValuation: 0, impliedValuation: 0, markPrice: 0 })]);
    expect(d.count).toBe(3);
  });

  it("returns an empty desk safely", () => {
    const d = buildValuationDesk([]);
    expect(d.count).toBe(0);
    expect(d.spread).toBe(0);
    expect(d.topPremium).toBeNull();
  });
});

describe("compactUsd", () => {
  it("formats trillions, billions, millions", () => {
    expect(compactUsd(1.7e12)).toBe("$1.70T");
    expect(compactUsd(138.02e9)).toBe("$138.0B");
    expect(compactUsd(32.1e6)).toBe("$32.1M");
    expect(compactUsd(-64.2e9)).toBe("-$64.2B");
  });

  it("handles boundaries, zero, thousands and non-finite input", () => {
    expect(compactUsd(0)).toBe("$0");
    expect(compactUsd(999)).toBe("$999");
    expect(compactUsd(1e3)).toBe("$1.0K");
    expect(compactUsd(1e6)).toBe("$1.0M");
    expect(compactUsd(1e9)).toBe("$1.0B");
    expect(compactUsd(1e12)).toBe("$1.00T");
    expect(compactUsd(NaN)).toBe("n/a");
    expect(compactUsd(Infinity)).toBe("n/a");
  });
});

describe("buildValuationDesk: adversarial rows", () => {
  it("excludes a zero or negative mark price from the desk", () => {
    const d = buildValuationDesk([
      row({ symbol: "OK", markPrice: 100, price: 110, markValuation: 1e9, impliedValuation: 1.1e9 }),
      row({ symbol: "ZERO", markPrice: 0, price: 5, markValuation: 1e9, impliedValuation: 1e9 }),
      row({ symbol: "NEG", markPrice: -100, price: 5, markValuation: 1e9, impliedValuation: 1e9 }),
    ]);
    expect(d.count).toBe(1);
    expect(d.legs[0].row.symbol).toBe("OK");
  });

  it("excludes a row whose premiumPct is NaN", () => {
    const d = buildValuationDesk([
      row({ symbol: "OK", markPrice: 100, price: 110, premiumPct: 0.1, markValuation: 1e9, impliedValuation: 1.1e9 }),
      row({ symbol: "NAN", markPrice: 100, price: 110, premiumPct: NaN, markValuation: 1e9, impliedValuation: 1.1e9 }),
    ]);
    expect(d.count).toBe(1);
    expect(d.legs[0].row.symbol).toBe("OK");
  });

  it("a single premium name leaves topDiscount null", () => {
    const d = buildValuationDesk([
      row({ symbol: "UP", markPrice: 100, price: 130, markValuation: 1e9, impliedValuation: 1.3e9 }),
    ]);
    expect(d.count).toBe(1);
    expect(d.topPremium?.row.symbol).toBe("UP");
    expect(d.topDiscount).toBeNull();
  });

  it("an all-discount book leaves topPremium null and a negative spread", () => {
    const d = buildValuationDesk([
      row({ symbol: "D1", markPrice: 100, price: 80, markValuation: 1e9, impliedValuation: 0.8e9 }),
      row({ symbol: "D2", markPrice: 100, price: 90, markValuation: 2e9, impliedValuation: 1.8e9 }),
    ]);
    expect(d.topPremium).toBeNull();
    expect(d.topDiscount?.row.symbol).toBe("D1");
    expect(d.spread).toBeLessThan(0);
  });

  it("does not divide by zero on an empty or all-invalid book", () => {
    expect(buildValuationDesk([row({ symbol: "BAD", markPrice: 0, markValuation: 0, impliedValuation: 0 })]).spread).toBe(0);
  });
});
