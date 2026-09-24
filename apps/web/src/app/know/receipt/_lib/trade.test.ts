import { describe, it, expect } from "vitest";

import type { JupiterQuoteResponse } from "@aadukalam/sdk";

import {
  livePremiumPct,
  quoteEffectivePrice,
  quoteMinReceived,
  quotePriceImpactPct,
  quoteReceived,
  routeLabels,
  shareText,
  tesseraTokenUrl,
  usdcBaseUnits,
  TESSERA_TOKEN_DECIMALS,
} from "./trade";

// A real Jupiter quote captured live 2026-09-24: 10 USDC -> T-OpenAI on Meteora
// DLMM. Kept verbatim so the derivations are checked against a true response.
const OPENAI_QUOTE: JupiterQuoteResponse = {
  inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  inAmount: "10000000",
  outputMint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
  outAmount: "9513140",
  otherAmountThreshold: "9465575",
  swapMode: "ExactIn",
  slippageBps: 50,
  platformFee: null,
  priceImpactPct: "0.0041983331197438380649388075",
  routePlan: [
    {
      swapInfo: {
        ammKey: "2ZWxT3niYjyudmDMDVar9ajNE42RkwYdzZBh6TiMuKQY",
        label: "Meteora DLMM",
        inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        outputMint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
        inAmount: "10000000",
        outAmount: "9513140",
      },
      percent: 100,
    },
  ],
};

describe("livePremiumPct", () => {
  it("is positive when the DEX price is above mark", () => {
    // T-OpenAI: live 1046.62 vs mark 812.79 is a real premium.
    const p = livePremiumPct(1046.62, 812.79);
    expect(p).not.toBeNull();
    expect(p!).toBeCloseTo(0.2877, 3);
  });

  it("is negative when the DEX price is below mark", () => {
    const p = livePremiumPct(400, 500);
    expect(p!).toBeCloseTo(-0.2, 6);
  });

  it("returns null when either input is missing or mark is zero", () => {
    expect(livePremiumPct(null, 100)).toBeNull();
    expect(livePremiumPct(100, null)).toBeNull();
    expect(livePremiumPct(100, 0)).toBeNull();
    expect(livePremiumPct(undefined, undefined)).toBeNull();
  });
});

describe("quote derivations", () => {
  it("turns raw outAmount into a human token amount at 9 decimals", () => {
    expect(quoteReceived(OPENAI_QUOTE)).toBeCloseTo(0.00951314, 8);
    expect(TESSERA_TOKEN_DECIMALS).toBe(9);
  });

  it("reads the slippage floor from otherAmountThreshold", () => {
    expect(quoteMinReceived(OPENAI_QUOTE)).toBeCloseTo(0.009465575, 9);
    expect(quoteMinReceived(OPENAI_QUOTE)).toBeLessThan(quoteReceived(OPENAI_QUOTE));
  });

  it("derives an effective USDC-per-token price", () => {
    const received = quoteReceived(OPENAI_QUOTE);
    const price = quoteEffectivePrice(10, received);
    expect(price).not.toBeNull();
    expect(price!).toBeCloseTo(1051.17, 1);
  });

  it("returns null effective price when nothing filled", () => {
    expect(quoteEffectivePrice(10, 0)).toBeNull();
    expect(quoteEffectivePrice(Number.NaN, 1)).toBeNull();
  });

  it("parses price impact as a fraction", () => {
    expect(quotePriceImpactPct(OPENAI_QUOTE)).toBeCloseTo(0.0041983, 6);
  });

  it("lists the AMM labels along the route", () => {
    expect(routeLabels(OPENAI_QUOTE)).toEqual(["Meteora DLMM"]);
  });
});

describe("usdcBaseUnits", () => {
  it("scales USDC to 6 decimals as a string", () => {
    expect(usdcBaseUnits(10)).toBe("10000000");
    expect(usdcBaseUnits(25.5)).toBe("25500000");
  });

  it("clamps a bad amount to zero", () => {
    expect(usdcBaseUnits(-1)).toBe("0");
  });
});

describe("tesseraTokenUrl", () => {
  it("points at the token page when a code is known", () => {
    expect(tesseraTokenUrl("tOpenAI")).toBe("https://app.tessera.pe/token/tOpenAI");
  });

  it("falls back to the app root without a code", () => {
    expect(tesseraTokenUrl(null)).toBe("https://app.tessera.pe");
  });
});

describe("shareText", () => {
  it("summarizes price and premium with the trade link", () => {
    const text = shareText({
      company: "OpenAI",
      symbol: "T-OpenAI",
      livePrice: 1046.62,
      premiumVsMark: 0.2877,
      url: "https://app.tessera.pe/token/tOpenAI",
    });
    expect(text).toContain("OpenAI T-OpenAI");
    expect(text).toContain("$1,046.62");
    expect(text).toContain("+28.8% vs mark");
    expect(text).toContain("https://app.tessera.pe/token/tOpenAI");
  });

  it("handles a missing price without throwing", () => {
    const text = shareText({
      company: "OpenAI",
      symbol: "T-OpenAI",
      livePrice: null,
      premiumVsMark: null,
      url: "https://app.tessera.pe",
    });
    expect(text).toContain("n/a");
  });
});
