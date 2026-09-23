// @aadukalam/sdk :: jupiter
// Jupiter swap and price client. Jupiter is MAINNET ONLY. Quotes and prices are
// free read-only calls. A swap is a real mainnet transaction the USER signs with
// their own wallet, never a server key. These client functions call OUR proxy
// `/api/jupiter`, which injects the optional key and hides the host choice.
// Baskets and Swipe use ExactIn (fixed input spend per leg); ExactOut has no
// routes for most xStock pairs.

/** Per-mint price from `/price/v3`. xStocks carry the extra fields. */
export interface JupiterPriceInfo {
  usdPrice: number;
  decimals: number;
  blockId?: number;
  priceChange24h?: number;
  liquidity?: number;
  /** underlying equity reference price, present for xStocks. */
  stockData?: {
    id: string;
    price: number;
    mcap?: number;
    updatedAt?: string;
  };
  /** Token-2022 Scaled UI Amount config, present for xStocks. */
  scaledUiConfig?: {
    multiplier: number;
    newMultiplier?: number;
    newMultiplierEffectiveAt?: string;
    usdPricePrescaled?: number;
  };
}

export type JupiterPriceMap = Record<string, JupiterPriceInfo>;

export interface JupiterRoutePlanStep {
  swapInfo: {
    ammKey: string;
    label?: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount?: string;
    feeMint?: string;
  };
  percent: number;
}

/** The whole quote object. Passed back verbatim into the swap build. */
export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: unknown | null;
  priceImpactPct: string;
  routePlan: JupiterRoutePlanStep[];
  contextSlot?: number;
  swapUsdValue?: string;
  transactionVersion?: number;
  [key: string]: unknown;
}

/** Response from the swap build. `swapTransaction` is a base64 v0 tx to sign. */
export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  dynamicSlippageReport?: unknown;
  simulationError?: unknown;
  [key: string]: unknown;
}

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  /** raw base units of the INPUT mint (ExactIn). */
  amount: number | string | bigint;
  slippageBps?: number;
}

export interface BuildSwapParams {
  quoteResponse: JupiterQuoteResponse;
  /** base58 wallet address that will sign and own the swap. */
  userPublicKey: string;
}

/** Jupiter aggregator program id, from a real swap instruction. */
export const JUPITER_PROGRAM_ID = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

/**
 * CLIENT function. USD prices for up to 50 mints via OUR proxy. Returns an empty
 * map on any upstream error so the caller can show "no live price".
 */
export async function getJupiterPrice(mints: string[], baseUrl = ""): Promise<JupiterPriceMap> {
  if (mints.length === 0) return {};
  const url = `${baseUrl}/api/jupiter?op=price&ids=${encodeURIComponent(mints.join(","))}`;
  const res = await fetch(url);
  if (!res.ok) return {};
  return (await res.json()) as JupiterPriceMap;
}

/**
 * CLIENT function. Quote a route (ExactIn) via OUR proxy. Throws on a non-200 so
 * a buy flow can surface the reason.
 */
export async function getQuote(params: QuoteParams, baseUrl = ""): Promise<JupiterQuoteResponse> {
  const q = new URLSearchParams({
    op: "quote",
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: String(params.amount),
    slippageBps: String(params.slippageBps ?? 50),
  });
  const res = await fetch(`${baseUrl}/api/jupiter?${q.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter quote ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as JupiterQuoteResponse;
}

/**
 * CLIENT function. Build the swap transaction for a quote via OUR proxy. Returns
 * the base64 v0 transaction the wallet deserializes and signs. Throws on a
 * non-200.
 */
export async function buildSwapTx(params: BuildSwapParams, baseUrl = ""): Promise<JupiterSwapResponse> {
  const res = await fetch(`${baseUrl}/api/jupiter`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter swap ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as JupiterSwapResponse;
}
