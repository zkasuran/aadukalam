import { describe, expect, it } from "vitest";

import type { TokenInfo } from "./types";
import {
  classifyBacking,
  classifyDividends,
  classifyRedemption,
  classifyVoting,
  deriveFlags,
  summarizeRights,
} from "./rights";
import { describeHolding } from "./holdings";

// Fixtures copied from the verified registry (.hq/research/tokens.json), so the
// classifiers are tested against the real prose they run on in production.
function mk(partial: Partial<TokenInfo> & Pick<TokenInfo, "ticker" | "issuer" | "rights">): TokenInfo {
  return {
    name: partial.name ?? partial.ticker,
    mint: partial.mint ?? "mint-" + partial.ticker,
    network: "solana",
    tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    decimals: partial.decimals ?? 8,
    themes: partial.themes ?? [],
    ...partial,
  };
}

const backpack = mk({
  ticker: "SPCX",
  name: "SpaceX (Backpack Securities)",
  issuer: "Backpack Securities (with Sunrise)",
  rights: {
    voting: null,
    dividends: "real entitlement; dividends automatically reinvested into additional tokenized shares",
    redemption:
      "redeemable 1:1 for the real underlying share (NY UCC Article 8 security entitlement) via Backpack Securities; after redemption transferable to a traditional broker (Schwab/Fidelity) over ACATS/DTCC; KYC/eligibility required",
    backing:
      "1:1 real share bought and held in custody by Backpack Securities, a regulated US broker-dealer (program with Sunrise); on-chain token is a claim on the SPV holding the underlying, redeemable into the brokerage security entitlement",
  },
});

const xstock = mk({
  ticker: "SPCXx",
  name: "SpaceX xStock",
  issuer: "Backed Assets (JE) Limited (xStocks)",
  rights: {
    voting: false,
    dividends:
      "economic only, no cash; passed via on-chain rebase (Token-2022 scaledUiAmount multiplier), multiplier updated ~8:00 PM EST the day before ex-date",
    redemption:
      "no share/brokerage redemption; issuer mint+redeem 24/5 to eligible non-US clients; self-custody withdrawal to Solana/Ethereum/TON/Ink; cannot transfer to a traditional brokerage",
    backing:
      "1:1 underlying equity in regulated custody (Alpaca Securities LLC primary, InCore Bank secondary), weekly on-chain Proof of Reserves; holder is an unsecured creditor of Backed Assets (JE) Limited (MiFII II tracker certificate / bearer debt instrument), no shareholder status",
  },
});

const ondo = mk({
  ticker: "SPCXon",
  name: "SpaceX (Ondo Tokenized)",
  issuer: "Ondo Global Markets (BVI) Limited",
  rights: {
    voting: false,
    dividends: "economic only; dividends auto-reinvested net of applicable withholding tax, nothing to claim",
    redemption:
      "redeem to stablecoin cash for onboarded eligible non-US tokenholders only; 24/5 all assets; may pause around corporate actions",
    backing:
      "fully backed by underlying US stocks/ETFs plus cash at US broker-dealers; independent Verification Agent publishes daily backing report; holders have no right to hold or receive the underlying",
  },
});

const prestocks = mk({
  ticker: "SPACEX",
  name: "SpaceX (PreStocks)",
  issuer: "PreStocks",
  rights: {
    voting: null,
    dividends: null,
    redemption:
      "originally a pre-IPO exposure product; post-listing it converts to a tokenized public-stock-equivalent; holders must complete a mandatory swap by midnight UTC 2027-03-12 or the tokens expire worthless",
    backing: "PreStocks pre-IPO/SPV exposure product now converting to the listed SpaceX equivalent; not verified as 1:1 custody of shares",
  },
});

const tessera = mk({
  ticker: "tSpaceX",
  name: "SpaceX (Tessera)",
  issuer: "Tessera",
  rights: {
    voting: null,
    dividends: null,
    redemption: null,
    backing: "Tessera tokenized SpaceX (tSpaceX); no on-chain rebase extension present; issuer-specific rights not verified in this pass",
  },
});

describe("classifiers", () => {
  it("reads ownership from the redemption path", () => {
    expect(summarizeRights(backpack).ownership.kind).toBe("real-shares");
    expect(summarizeRights(xstock).ownership.kind).toBe("synthetic");
    expect(summarizeRights(ondo).ownership.kind).toBe("synthetic");
    expect(summarizeRights(prestocks).ownership.kind).toBe("synthetic");
    expect(summarizeRights(tessera).ownership.kind).toBe("unverified");
  });

  it("classifies voting", () => {
    expect(classifyVoting(true)).toBe("yes");
    expect(classifyVoting(false)).toBe("no");
    expect(classifyVoting(null)).toBe("undisclosed");
  });

  it("classifies the dividend mechanism", () => {
    expect(classifyDividends(xstock.rights.dividends)).toBe("rebase");
    expect(classifyDividends(ondo.rights.dividends)).toBe("reinvested");
    expect(classifyDividends(backpack.rights.dividends)).toBe("reinvested");
    expect(classifyDividends(null)).toBe("none");
  });

  it("classifies the redemption path", () => {
    expect(classifyRedemption(backpack.rights.redemption)).toBe("to-real-shares");
    expect(classifyRedemption(xstock.rights.redemption)).toBe("none");
    expect(classifyRedemption(ondo.rights.redemption)).toBe("to-cash");
    expect(classifyRedemption(prestocks.rights.redemption)).toBe("mandatory-swap");
    expect(classifyRedemption(null)).toBe("undisclosed");
  });

  it("classifies backing quality", () => {
    expect(classifyBacking(backpack.rights.backing)).toBe("real-share-custody");
    expect(classifyBacking(xstock.rights.backing)).toBe("collateralized");
    expect(classifyBacking(ondo.rights.backing)).toBe("collateralized");
    expect(classifyBacking(prestocks.rights.backing)).toBe("unverified");
    expect(classifyBacking(tessera.rights.backing)).toBe("unverified");
  });
});

describe("summarizeRights", () => {
  it("gives real shares a positive, brokerage-redeemable headline", () => {
    const s = summarizeRights(backpack);
    expect(s.ownership.tone).toBe("positive");
    expect(s.redemption.kind).toBe("to-real-shares");
    expect(s.headline).toMatch(/real share/i);
  });

  it("flags xStock issuer control and unsecured-creditor status", () => {
    const flags = deriveFlags(xstock).map((f) => f.text.toLowerCase());
    expect(flags.some((t) => t.includes("freeze"))).toBe(true);
    expect(flags.some((t) => t.includes("unsecured creditor"))).toBe(true);
    expect(summarizeRights(xstock).voting.kind).toBe("no");
  });

  it("flags the PreStocks forced-conversion deadline", () => {
    const s = summarizeRights(prestocks);
    expect(s.redemption.kind).toBe("mandatory-swap");
    expect(s.flags.some((f) => f.text.toLowerCase().includes("expire worthless"))).toBe(true);
  });

  it("treats an unverified wrapper as rights unknown", () => {
    const s = summarizeRights(tessera);
    expect(s.ownership.kind).toBe("unverified");
    expect(s.headline).toMatch(/not verified|unknown/i);
  });
});

describe("describeHolding", () => {
  const balance = { mint: "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb", amount: "1000000", decimals: 6, uiAmount: 1, programId: "p" };

  it("joins a known mint to its rights", () => {
    const view = describeHolding(balance, () => backpack);
    expect(view.known).toBe(true);
    if (view.known) expect(view.rights.ownership.kind).toBe("real-shares");
  });

  it("marks an unknown mint rights-unknown without dropping it", () => {
    const view = describeHolding(balance, () => undefined);
    expect(view.known).toBe(false);
    expect(view.balance.mint).toBe(balance.mint);
  });
});
