import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";

import {
  dollarsToTargetPrice,
  fixedToDollars,
  computeWinningSide,
  computePayout,
  potentialPayout,
  impliedProbability,
  marketPhase,
  canBet,
  canResolve,
  canClaim,
  winningSideLabel,
  sideLabel,
  SIDE_YES,
  SIDE_NO,
} from "./math";
import {
  deriveMarketPda,
  deriveEscrowPda,
  deriveBetPda,
  marketIdToLeBytes,
} from "./pdas";

const PROG = new PublicKey("83f9z9RHjyvFSbcvWQixNq13vXiu35baFiDtqvG8q7LY");
const CREATOR = new PublicKey("11111111111111111111111111111111");
const USER = new PublicKey("So11111111111111111111111111111111111111112");

describe("targetPrice fixed-point conversion", () => {
  it("matches the program author's AAPL example", () => {
    // $200.00 on a feed with expo -5 is 20_000_000.
    expect(dollarsToTargetPrice(200, -5)).toBe(20_000_000n);
  });

  it("scales to the feed exponent, never a fixed one", () => {
    expect(dollarsToTargetPrice(200, -8)).toBe(20_000_000_000n);
    expect(dollarsToTargetPrice(1, -5)).toBe(100_000n);
    expect(dollarsToTargetPrice(0, -5)).toBe(0n);
  });

  it("keeps sub-dollar precision without float drift", () => {
    expect(dollarsToTargetPrice(123.45, -5)).toBe(12_345_000n);
    expect(dollarsToTargetPrice(0.07, -8)).toBe(7_000_000n);
  });

  it("handles a positive exponent", () => {
    expect(dollarsToTargetPrice(20000, 2)).toBe(200n);
  });

  it("round-trips back to dollars for display", () => {
    expect(fixedToDollars(20_000_000n, -5)).toBeCloseTo(200, 6);
    expect(fixedToDollars(12_345_000n, -5)).toBeCloseTo(123.45, 6);
  });
});

describe("winning side", () => {
  it("is YES at or above the target, NO below", () => {
    expect(computeWinningSide(20_000_001n, 20_000_000n)).toBe(SIDE_YES);
    expect(computeWinningSide(20_000_000n, 20_000_000n)).toBe(SIDE_YES);
    expect(computeWinningSide(19_999_999n, 20_000_000n)).toBe(SIDE_NO);
  });
});

describe("payout math", () => {
  const base = { totalYes: 100n, totalNo: 50n, winningSide: SIDE_YES, resolved: true };

  it("pays stake plus a pro-rata share of the losing pool", () => {
    // 40 of the 100 YES pool wins, losing pool is 50, share = 40*50/100 = 20.
    expect(computePayout({ ...base, side: SIDE_YES, amount: 40n })).toBe(60n);
  });

  it("floors the share the way u64 integer division does", () => {
    // 33 of a 100 YES pool, losing 50: 33*50/100 = 16.5 -> 16, payout 49.
    expect(computePayout({ ...base, side: SIDE_YES, amount: 33n })).toBe(49n);
  });

  it("pays nothing to the losing side", () => {
    expect(computePayout({ ...base, side: SIDE_NO, amount: 50n })).toBe(0n);
  });

  it("pays nothing before the market resolves", () => {
    expect(computePayout({ ...base, resolved: false, side: SIDE_YES, amount: 40n })).toBe(0n);
  });

  it("returns just the stake when there is no losing pool", () => {
    expect(
      computePayout({ totalYes: 100n, totalNo: 0n, winningSide: SIDE_YES, resolved: true, side: SIDE_YES, amount: 40n }),
    ).toBe(40n);
  });

  it("returns zero when the winning pool is empty", () => {
    expect(
      computePayout({ totalYes: 0n, totalNo: 50n, winningSide: SIDE_YES, resolved: true, side: SIDE_YES, amount: 0n }),
    ).toBe(0n);
  });
});

describe("potential payout for a new bet", () => {
  it("adds the new stake to its own side's pool", () => {
    // Bet 50 YES: YES pool becomes 100, NO pool 50, share = 50*50/100 = 25.
    expect(potentialPayout({ side: SIDE_YES, betAmount: 50n, totalYes: 50n, totalNo: 50n })).toBe(75n);
  });

  it("is just the stake when the other side is empty", () => {
    expect(potentialPayout({ side: SIDE_NO, betAmount: 10n, totalYes: 0n, totalNo: 0n })).toBe(10n);
  });

  it("is zero for a non-positive bet", () => {
    expect(potentialPayout({ side: SIDE_YES, betAmount: 0n, totalYes: 10n, totalNo: 10n })).toBe(0n);
  });
});

describe("implied probability", () => {
  it("is the side's share of the pool", () => {
    const p = impliedProbability(75n, 25n);
    expect(p.yesProb).toBeCloseTo(0.75, 6);
    expect(p.noProb).toBeCloseTo(0.25, 6);
  });

  it("is null when nothing is staked yet", () => {
    const p = impliedProbability(0n, 0n);
    expect(p.yesProb).toBeNull();
    expect(p.noProb).toBeNull();
  });
});

describe("market state machine", () => {
  const deadline = 1_000_000;

  it("is betting before the deadline", () => {
    const m = { resolved: false, deadline };
    expect(marketPhase(m, deadline - 1)).toBe("betting");
    expect(canBet(m, deadline - 1)).toBe(true);
    expect(canResolve(m, deadline - 1)).toBe(false);
  });

  it("awaits resolution at and after the deadline", () => {
    const m = { resolved: false, deadline };
    expect(marketPhase(m, deadline)).toBe("awaiting");
    expect(canBet(m, deadline)).toBe(false);
    expect(canResolve(m, deadline)).toBe(true);
  });

  it("is resolved once resolved is set", () => {
    const m = { resolved: true, deadline };
    expect(marketPhase(m, deadline + 999)).toBe("resolved");
    expect(canResolve(m, deadline + 999)).toBe(false);
  });

  it("lets a winning unclaimed bet claim and blocks the rest", () => {
    const m = { resolved: true, winningSide: SIDE_YES };
    expect(canClaim(m, { side: SIDE_YES, claimed: false })).toBe(true);
    expect(canClaim(m, { side: SIDE_YES, claimed: true })).toBe(false);
    expect(canClaim(m, { side: SIDE_NO, claimed: false })).toBe(false);
    expect(canClaim({ resolved: false, winningSide: SIDE_YES }, { side: SIDE_YES, claimed: false })).toBe(false);
  });

  it("labels the resolved side", () => {
    expect(winningSideLabel({ resolved: true, winningSide: SIDE_YES })).toBe("YES");
    expect(winningSideLabel({ resolved: true, winningSide: SIDE_NO })).toBe("NO");
    expect(winningSideLabel({ resolved: false, winningSide: SIDE_YES })).toBeNull();
  });

  it("labels a side", () => {
    expect(sideLabel(SIDE_YES)).toBe("YES");
    expect(sideLabel(SIDE_NO)).toBe("NO");
    expect(sideLabel(9)).toBe("unknown");
  });
});

describe("PDA derivation", () => {
  it("encodes the market id as 8 little-endian bytes", () => {
    expect([...marketIdToLeBytes(1n)]).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect([...marketIdToLeBytes(256n)]).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
  });

  it("derives the documented golden addresses", () => {
    // Golden values computed independently from the raw seed layout.
    const market = deriveMarketPda(CREATOR, 42n, PROG);
    expect(market.address.toBase58()).toBe("7TeUK9gqZsXcJ1nFpRivxNHEFzi9JxCd6TNq8fk8PXSy");

    const escrow = deriveEscrowPda(market.address, PROG);
    expect(escrow.address.toBase58()).toBe("AacyRBjM9ozghFgsR9WNSXVQsYzez2dMPf2jKNBFAJ19");

    const bet = deriveBetPda(market.address, USER, PROG);
    expect(bet.address.toBase58()).toBe("C7NR1hf3gz792qCUx3FfcmrvDR1ovSdcoSZtaEVTY51e");
  });

  it("is deterministic and input sensitive", () => {
    const a = deriveMarketPda(CREATOR, 42n, PROG).address.toBase58();
    const b = deriveMarketPda(CREATOR, 43n, PROG).address.toBase58();
    expect(a).toBe(deriveMarketPda(CREATOR, 42n, PROG).address.toBase58());
    expect(a).not.toBe(b);
  });

  it("defaults to the program id when none is passed", () => {
    const withDefault = deriveMarketPda(CREATOR, 42n).address.toBase58();
    const withExplicit = deriveMarketPda(CREATOR, 42n, PROG).address.toBase58();
    expect(withDefault).toBe(withExplicit);
  });
});
