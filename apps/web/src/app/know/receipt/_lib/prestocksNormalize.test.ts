import { describe, it, expect } from "vitest";
import { normalizePreStocks } from "./prestocksNormalize";

const vol = { date: "2026-09-25", bySymbol: { OPENAI: 1200, NEURALINK: 34 } };

const good = {
  name: "OpenAI PreStocks",
  symbol: "OPENAI",
  contract_address: "oPENAImint1111111111111111111111111111111",
  markPrice: 1023.77,
  tokenPrice: 1345.8,
  markValuation: 1.27e12,
  impliedValuation: 1.67e12,
  supply: 1.24e9,
  external_url: "https://prestocks.com/openai",
};

describe("normalizePreStocks: adversarial inputs", () => {
  it("returns [] for a non-array payload", () => {
    expect(normalizePreStocks(null, vol)).toEqual([]);
    expect(normalizePreStocks(undefined, vol)).toEqual([]);
    expect(normalizePreStocks({ error: "nope" }, vol)).toEqual([]);
    expect(normalizePreStocks("<html>", vol)).toEqual([]);
    expect(normalizePreStocks(42, vol)).toEqual([]);
  });

  it("returns [] for an empty array", () => {
    expect(normalizePreStocks([], vol)).toEqual([]);
  });

  it("normalizes a good token and tags it prestocks", () => {
    const rows = normalizePreStocks([good], vol);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.provider).toBe("prestocks");
    expect(r.company).toBe("OpenAI");
    expect(r.symbol).toBe("OPENAI");
    expect(r.mint).toBe(good.contract_address);
    expect(r.price).toBe(1345.8);
    expect(r.markPrice).toBe(1023.77);
    expect(r.premiumPct).toBeCloseTo(1345.8 / 1023.77 - 1, 6);
    expect(r.impliedValuation).toBe(1.67e12);
    expect(r.recentVolume).toBe(1200);
    expect(r.backing.hasProof).toBe(false);
  });

  it("skips a token missing its symbol or mint", () => {
    expect(normalizePreStocks([{ ...good, symbol: undefined }], vol)).toHaveLength(0);
    expect(normalizePreStocks([{ ...good, contract_address: null }], vol)).toHaveLength(0);
  });

  it("skips a token whose core price or valuation is not a finite number", () => {
    for (const bad of [null, undefined, "1023", NaN, Infinity]) {
      expect(normalizePreStocks([{ ...good, markPrice: bad }], vol)).toHaveLength(0);
      expect(normalizePreStocks([{ ...good, tokenPrice: bad }], vol)).toHaveLength(0);
      expect(normalizePreStocks([{ ...good, markValuation: bad }], vol)).toHaveLength(0);
    }
  });

  it("nulls optional fields rather than emitting NaN", () => {
    const r = normalizePreStocks([{ ...good, supply: "lots", impliedValuation: null }], vol)[0];
    expect(r.supply).toBeNull();
    expect(r.onChainMktCap).toBeNull();
    expect(r.impliedValuation).toBeNull();
  });

  it("one malformed token never kills the rest of the batch", () => {
    const explosive = {
      get name() {
        throw new Error("boom");
      },
      symbol: "X",
      contract_address: "x",
      markPrice: 1,
      tokenPrice: 1,
      markValuation: 1,
    };
    const rows = normalizePreStocks([good, explosive, { garbage: true }, good], vol);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.provider === "prestocks")).toBe(true);
  });

  it("keeps a zero mark price but leaves premium and shares null", () => {
    const r = normalizePreStocks([{ ...good, markPrice: 0 }], vol)[0];
    expect(r).toBeDefined();
    expect(r.premiumPct).toBeNull();
    expect(r.companyShares).toBeNull();
  });
});
