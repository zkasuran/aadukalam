// Pure trade helpers for the Tessera ACTION layer. The trust scorecard reads the
// Tessera REST API only; this layer adds live market data and a buy flow on top,
// driving real volume to the T-Token Meteora pools without ever touching a
// PreStocks endpoint or a server key. Every number here is derived from a live
// Jupiter quote or price, never faked.
//
// Verified live 2026-09-24: all three Tessera mints route on Jupiter via Meteora
// DLMM (10 USDC -> T-OpenAI/T-Kalshi/T-SpaceX all returned real quotes). price/v3
// returns a live usdPrice, 24h change and liquidity per mint.

import {
  COMMON_MINTS,
  fromBaseUnits,
  toBaseUnits,
  type JupiterQuoteResponse,
} from "@aadukalam/sdk";

export const USDC_MINT = COMMON_MINTS.USDC.mint;
export const USDC_DECIMALS = COMMON_MINTS.USDC.decimals;

// Tessera T-Tokens are SPL Token-2022 with 9 decimals (verified on the three live
// mints via price/v3). Fall back to this when a live decimals field is missing.
export const TESSERA_TOKEN_DECIMALS = 9;

/** USDC base units for a human USDC amount, as the string Jupiter's quote wants. */
export function usdcBaseUnits(usdcAmount: number): string {
  return toBaseUnits(usdcAmount, USDC_DECIMALS);
}

/**
 * Live premium or discount of the traded DEX price against Tessera's reference
 * mark: liveDexPrice / markPrice - 1. Null when there is no live price to compare.
 * This is the market's own read, kept separate from the backing-driven grade.
 */
export function livePremiumPct(
  liveDexPrice: number | null | undefined,
  markPrice: number | null | undefined
): number | null {
  if (
    liveDexPrice == null ||
    markPrice == null ||
    !Number.isFinite(liveDexPrice) ||
    !Number.isFinite(markPrice) ||
    markPrice === 0
  ) {
    return null;
  }
  return liveDexPrice / markPrice - 1;
}

/** Human token amount a quote outputs (quote.outAmount is raw base units). */
export function quoteReceived(
  quote: JupiterQuoteResponse,
  tokenDecimals = TESSERA_TOKEN_DECIMALS
): number {
  return fromBaseUnits(quote.outAmount, tokenDecimals);
}

/** Worst-case token amount at the quote's slippage (otherAmountThreshold). */
export function quoteMinReceived(
  quote: JupiterQuoteResponse,
  tokenDecimals = TESSERA_TOKEN_DECIMALS
): number {
  return fromBaseUnits(quote.otherAmountThreshold, tokenDecimals);
}

/** Effective USDC-per-token price implied by a quote. Null when nothing filled. */
export function quoteEffectivePrice(
  usdcIn: number,
  received: number
): number | null {
  if (!Number.isFinite(usdcIn) || !Number.isFinite(received) || received <= 0) {
    return null;
  }
  return usdcIn / received;
}

/** Price impact as a fraction (0.004 = 0.4%). Jupiter returns it as a string. */
export function quotePriceImpactPct(quote: JupiterQuoteResponse): number {
  const n = Number(quote.priceImpactPct);
  return Number.isFinite(n) ? n : 0;
}

/** AMM labels along the route, e.g. ["Meteora DLMM"]. Empty when none present. */
export function routeLabels(quote: JupiterQuoteResponse): string[] {
  if (!Array.isArray(quote.routePlan)) return [];
  return quote.routePlan
    .map((step) => step.swapInfo?.label)
    .filter((label): label is string => Boolean(label));
}

/** Tessera app link for a token, the "view and trade on Tessera" destination. */
export function tesseraTokenUrl(code: string | null): string {
  const base = "https://app.tessera.pe";
  return code ? `${base}/token/${code}` : base;
}

/** One-line shareable summary of a token's live state. No private data. */
export function shareText(args: {
  company: string;
  symbol: string;
  livePrice: number | null;
  premiumVsMark: number | null;
  url: string;
}): string {
  const price =
    args.livePrice != null && Number.isFinite(args.livePrice)
      ? `$${args.livePrice.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "n/a";
  const prem =
    args.premiumVsMark != null && Number.isFinite(args.premiumVsMark)
      ? ` (${args.premiumVsMark >= 0 ? "+" : ""}${(args.premiumVsMark * 100).toFixed(1)}% vs mark)`
      : "";
  return `${args.company} ${args.symbol} is live at ${price}${prem} on Solana. Backing checked on Aadukalam Receipt. Trade it: ${args.url}`;
}
