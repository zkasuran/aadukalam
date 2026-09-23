import { describe, it, expect } from "vitest";

import { enforce, type GuardrailPolicy, type ProposedTrade } from "./guardrail";

// A representative policy. Caps chosen so each limit is a round number and the
// "exactly at the limit" cases are easy to read.
const POLICY: GuardrailPolicy = {
  allowlist: ["AAPLx", "NVDAx", "SPYx"],
  maxPositionUsd: 1000,
  dailyBudgetUsd: 2000,
  perTradeCapUsd: 500,
};

function buy(partial: Partial<ProposedTrade> = {}): ProposedTrade {
  return {
    ticker: "AAPLx",
    side: "buy",
    usdAmount: 100,
    currentPositionUsd: 0,
    spentTodayUsd: 0,
    ...partial,
  };
}

describe("enforce: allowlist", () => {
  it("allows a ticker that is on the allowlist", () => {
    const v = enforce(POLICY, buy({ ticker: "NVDAx", usdAmount: 100 }));
    expect(v.allowed).toBe(true);
    expect(v.code).toBe("ok");
    expect(v.reason).toBeUndefined();
  });

  it("refuses a ticker that is not on the allowlist", () => {
    const v = enforce(POLICY, buy({ ticker: "TSLAx", usdAmount: 100 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("not_allowlisted");
    expect(v.reason).toContain("TSLAx");
    expect(v.reason).toContain("not on the allowlist");
  });

  it("matches the allowlist case-insensitively and trims whitespace", () => {
    expect(enforce(POLICY, buy({ ticker: "aaplx" })).allowed).toBe(true);
    expect(enforce(POLICY, buy({ ticker: "  SPYx  " })).allowed).toBe(true);
  });

  it("refuses when the allowlist is empty", () => {
    const v = enforce({ ...POLICY, allowlist: [] }, buy());
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("not_allowlisted");
  });
});

describe("enforce: per-trade cap", () => {
  it("allows a trade under the per-trade cap", () => {
    expect(enforce(POLICY, buy({ usdAmount: 499 })).allowed).toBe(true);
  });

  it("allows a trade exactly at the per-trade cap", () => {
    const v = enforce(POLICY, buy({ usdAmount: 500 }));
    expect(v.allowed).toBe(true);
    expect(v.code).toBe("ok");
  });

  it("refuses a trade over the per-trade cap", () => {
    const v = enforce(POLICY, buy({ usdAmount: 500.01 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("over_per_trade_cap");
    expect(v.reason).toContain("per-trade cap");
  });

  it("the per-trade cap applies to sells as well", () => {
    const v = enforce(POLICY, buy({ side: "sell", usdAmount: 800 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("over_per_trade_cap");
  });
});

describe("enforce: daily budget", () => {
  it("allows a buy that keeps spend under the daily budget", () => {
    const v = enforce(POLICY, buy({ usdAmount: 400, spentTodayUsd: 1000 }));
    expect(v.allowed).toBe(true);
  });

  it("allows a buy that lands spend exactly at the daily budget", () => {
    // 500 spent + 1500 already = 2000, exactly the budget.
    const v = enforce(POLICY, buy({ usdAmount: 500, spentTodayUsd: 1500 }));
    expect(v.allowed).toBe(true);
    expect(v.code).toBe("ok");
  });

  it("refuses a buy that pushes spend over the daily budget", () => {
    const v = enforce(POLICY, buy({ usdAmount: 400, spentTodayUsd: 1700 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("over_daily_budget");
    expect(v.reason).toContain("daily budget");
  });

  it("does not draw a sell against the daily budget", () => {
    // A sell of 400 with 1900 already spent would blow the budget as a buy, but
    // a sell returns cash so the budget check is skipped.
    const v = enforce(POLICY, buy({ side: "sell", usdAmount: 400, spentTodayUsd: 1900 }));
    expect(v.allowed).toBe(true);
    const budget = v.checks.find((c) => c.code === "over_daily_budget");
    expect(budget?.skipped).toBe(true);
  });
});

describe("enforce: max position", () => {
  it("allows a buy that keeps the position under the max", () => {
    const v = enforce(POLICY, buy({ usdAmount: 400, currentPositionUsd: 500 }));
    expect(v.allowed).toBe(true);
  });

  it("allows a buy that lands the position exactly at the max", () => {
    // 500 buy + 500 held = 1000, exactly the max position.
    const v = enforce(POLICY, buy({ usdAmount: 500, currentPositionUsd: 500 }));
    expect(v.allowed).toBe(true);
    expect(v.code).toBe("ok");
  });

  it("refuses a buy that pushes the position over the max", () => {
    const v = enforce(POLICY, buy({ usdAmount: 300, currentPositionUsd: 800 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("over_max_position");
    expect(v.reason).toContain("max position");
  });

  it("does not apply the max position to a sell", () => {
    const v = enforce(POLICY, buy({ side: "sell", usdAmount: 300, currentPositionUsd: 900 }));
    expect(v.allowed).toBe(true);
    const pos = v.checks.find((c) => c.code === "over_max_position");
    expect(pos?.skipped).toBe(true);
  });
});

describe("enforce: invalid amounts", () => {
  it("refuses a zero amount", () => {
    const v = enforce(POLICY, buy({ usdAmount: 0 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("invalid_amount");
  });

  it("refuses a negative amount", () => {
    const v = enforce(POLICY, buy({ usdAmount: -50 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("invalid_amount");
  });

  it("refuses a NaN amount", () => {
    const v = enforce(POLICY, buy({ usdAmount: Number.NaN }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("invalid_amount");
  });
});

describe("enforce: precedence and shape", () => {
  it("reports the allowlist failure first when several rules fail", () => {
    // Not allowlisted AND over every cap. Allowlist is checked first.
    const v = enforce(POLICY, buy({ ticker: "GMEx", usdAmount: 5000, currentPositionUsd: 5000, spentTodayUsd: 5000 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("not_allowlisted");
  });

  it("reports the per-trade cap before the daily budget", () => {
    // On the allowlist, over the per-trade cap and over the budget. Per-trade is earlier.
    const v = enforce(POLICY, buy({ usdAmount: 3000, spentTodayUsd: 1900 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe("over_per_trade_cap");
  });

  it("always returns the full ordered checks array", () => {
    const v = enforce(POLICY, buy());
    expect(v.checks.map((c) => c.code)).toEqual([
      "not_allowlisted",
      "invalid_amount",
      "over_per_trade_cap",
      "over_daily_budget",
      "over_max_position",
    ]);
    expect(v.checks.every((c) => c.passed)).toBe(true);
  });

  it("treats missing position and spend context as zero", () => {
    const v = enforce(POLICY, { ticker: "AAPLx", side: "buy", usdAmount: 100 });
    expect(v.allowed).toBe(true);
  });

  it("is pure: the same input yields the same verdict", () => {
    const trade = buy({ usdAmount: 250 });
    expect(enforce(POLICY, trade)).toEqual(enforce(POLICY, trade));
  });
});
