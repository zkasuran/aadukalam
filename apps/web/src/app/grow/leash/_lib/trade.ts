// The trade path shared by the chat agent (server) and the manual form (client).
// One implementation so a trade proposed by the model and a trade proposed by
// hand go through the exact same guardrail gate, quote and build. The only
// difference is the baseUrl the SDK client functions hit: the server passes its
// own origin, the browser passes "" for a relative path.
//
// The gate is enforce(). A refused trade never reaches buildQuote or buildSwapTx,
// so no transaction is ever built for a trade the guardrail rejected. The server
// never signs. buildSwapTx returns an unsigned transaction the user signs.

import { getToken } from "@aadukalam/data";
import { buildSwapTx, getJupiterPrice, getQuote, toBaseUnits } from "@aadukalam/sdk";

import { enforce, type GuardrailPolicy, type ProposedTrade, type TradeSide } from "./guardrail";
import type { ProposedTradeResult, QuoteSummary, SessionLedger } from "./types";

export const USDC = { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 };
export const SLIPPAGE_BPS = 50;

export interface TokenLite {
  ticker: string;
  mint: string;
  decimals: number;
}

export interface TradeInput {
  ticker: string;
  usdAmount: number;
  side: TradeSide;
}

async function priceUsd(baseUrl: string, mint: string): Promise<number | null> {
  const map = await getJupiterPrice([mint], baseUrl);
  const v = map[mint]?.usdPrice;
  return typeof v === "number" ? v : null;
}

// Build a Jupiter quote for a USD-sized trade. A buy spends USDC into the stock,
// a sell sizes the stock amount from the live price and returns USDC. ExactIn on
// both legs, because ExactOut has no routes for most xStock pairs.
export async function buildQuote(
  baseUrl: string,
  token: TokenLite,
  usdAmount: number,
  side: TradeSide,
): Promise<{ quote: Awaited<ReturnType<typeof getQuote>>; summary: QuoteSummary }> {
  let inputMint: string;
  let outputMint: string;
  let amount: string;
  let outDecimals: number;
  let estOutLabel: string;

  if (side === "sell") {
    const px = await priceUsd(baseUrl, token.mint);
    if (!px) throw new Error("no live price to size the sell");
    inputMint = token.mint;
    outputMint = USDC.mint;
    amount = toBaseUnits(usdAmount / px, token.decimals);
    outDecimals = USDC.decimals;
    estOutLabel = "USDC";
  } else {
    inputMint = USDC.mint;
    outputMint = token.mint;
    amount = toBaseUnits(usdAmount, USDC.decimals);
    outDecimals = token.decimals;
    estOutLabel = `${token.ticker} shares`;
  }

  const quote = await getQuote({ inputMint, outputMint, amount, slippageBps: SLIPPAGE_BPS }, baseUrl);
  const estOut = Number(quote.outAmount) / 10 ** outDecimals;
  const pip = Number(quote.priceImpactPct);
  const route =
    (quote.routePlan ?? [])
      .map((r) => r.swapInfo?.label)
      .filter(Boolean)
      .join(" + ") || null;

  const summary: QuoteSummary = {
    inputMint,
    outputMint,
    usd: usdAmount,
    estOut,
    estOutLabel,
    priceImpactPct: Number.isFinite(pip) ? pip * 100 : null,
    slippageBps: quote.slippageBps ?? SLIPPAGE_BPS,
    route,
  };
  return { quote, summary };
}

/**
 * The safety-critical path. enforce() runs FIRST against the policy and the
 * session ledger. Only an allowed trade goes on to a quote and an unsigned tx.
 * A refused trade returns the verdict alone, with no transaction.
 */
export async function proposeTrade(
  baseUrl: string,
  policy: GuardrailPolicy,
  ledger: SessionLedger,
  input: TradeInput,
  userPublicKey?: string,
): Promise<ProposedTradeResult> {
  const token = getToken(input.ticker);
  const shownTicker = token?.ticker ?? input.ticker;
  const key = shownTicker.toLowerCase();

  const trade: ProposedTrade = {
    ticker: shownTicker,
    side: input.side,
    usdAmount: input.usdAmount,
    currentPositionUsd: ledger.positionsUsd?.[key] ?? 0,
    spentTodayUsd: ledger.spentTodayUsd ?? 0,
  };
  const verdict = enforce(policy, trade);
  const result: ProposedTradeResult = {
    ticker: shownTicker,
    mint: token?.mint ?? "",
    side: input.side,
    usdAmount: input.usdAmount,
    verdict,
  };
  if (!verdict.allowed) return result;
  if (!token) {
    result.buildError = `unknown ticker ${input.ticker}`;
    return result;
  }

  try {
    const { quote, summary } = await buildQuote(baseUrl, token, input.usdAmount, input.side);
    result.quote = summary;
    if (!userPublicKey) {
      result.needsWallet = true;
      return result;
    }
    const swap = await buildSwapTx({ quoteResponse: quote, userPublicKey }, baseUrl);
    result.tx = {
      swapTransaction: swap.swapTransaction,
      lastValidBlockHeight: swap.lastValidBlockHeight,
    };
  } catch (e) {
    result.buildError = e instanceof Error ? e.message : "build failed";
  }
  return result;
}
