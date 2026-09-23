import { describe, it, expect } from "vitest";

import {
  formatUnits,
  formatUsdc,
  parseUnits,
  shortAddress,
  tryParseUnits,
} from "./format";

describe("formatUnits", () => {
  it("drops trailing zeros and groups the whole part", () => {
    expect(formatUnits(1_500_000n, 6)).toBe("1.5");
    expect(formatUnits(2_000_000_000n, 6)).toBe("2,000");
    expect(formatUnits(1_234_567_890n, 6)).toBe("1,234.56789");
  });

  it("caps the fraction at maxFractionDigits", () => {
    expect(formatUnits(1_234_567n, 6, 2)).toBe("1.23");
  });

  it("handles zero decimals and negatives", () => {
    expect(formatUnits(42n, 0)).toBe("42");
    expect(formatUnits(-1_500_000n, 6)).toBe("-1.5");
  });
});

describe("formatUsdc", () => {
  it("always shows at least cents", () => {
    expect(formatUsdc(1_500_000n)).toBe("$1.50");
    expect(formatUsdc(0n)).toBe("$0.00");
    expect(formatUsdc(450_000_000n)).toBe("$450.00");
    expect(formatUsdc(1_000_000_000n)).toBe("$1,000.00");
  });

  it("keeps sub-cent precision for a tiny dividend", () => {
    expect(formatUsdc(1_523_456n)).toBe("$1.523456");
    expect(formatUsdc(3333n)).toBe("$0.003333");
  });

  it("carries a sign", () => {
    expect(formatUsdc(-1_500_000n)).toBe("-$1.50");
  });
});

describe("parseUnits", () => {
  it("parses a decimal against the token decimals", () => {
    expect(parseUnits("1.5", 6)).toBe(1_500_000n);
    expect(parseUnits("2000", 6)).toBe(2_000_000_000n);
    expect(parseUnits("0.003333", 6)).toBe(3333n);
    expect(parseUnits("100", 0)).toBe(100n);
  });

  it("trims surrounding whitespace", () => {
    expect(parseUnits(" 1.5 ", 6)).toBe(1_500_000n);
  });

  it("rejects too many decimals", () => {
    expect(() => parseUnits("1.2345678", 6)).toThrow();
  });

  it("rejects non-numeric and negative input", () => {
    expect(() => parseUnits("abc", 6)).toThrow();
    expect(() => parseUnits("-1", 6)).toThrow();
  });

  it("round-trips through formatUnits", () => {
    const units = parseUnits("1234.56789", 6);
    expect(formatUnits(units, 6)).toBe("1,234.56789");
  });
});

describe("tryParseUnits", () => {
  it("returns null instead of throwing", () => {
    expect(tryParseUnits("abc", 6)).toBeNull();
    expect(tryParseUnits("1.5", 6)).toBe(1_500_000n);
  });
});

describe("shortAddress", () => {
  it("keeps the head and tail of a long address", () => {
    expect(shortAddress("9DAHUC1KQUsBMB9cQk8EdVZfKAhVukLhUsyuQYZBLgAy")).toBe(
      "9DAHUC...BLgAy",
    );
  });

  it("leaves a short string alone", () => {
    expect(shortAddress("abc")).toBe("abc");
  });
});
