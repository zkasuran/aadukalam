import { getToken } from "@aadukalam/data";

// The xStock tickers Kamino lists as collateral in its xStocks market
// (5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua). Mints are stable identifiers, so
// this list is a safe fallback for the picker when the live reserve read is
// unavailable. LTVs are always read live off the chain and never hardcoded.
// Source: .hq/research/kamino.md, verified 2026-09-23.
export const XSTOCKS_COLLATERAL_TICKERS = [
  "SPYx",
  "QQQx",
  "GOOGLx",
  "TSLAx",
  "NVDAx",
  "AAPLx",
  "METAx",
  "HOODx",
  "CRCLx",
  "MSTRx",
] as const;

export interface CollateralOption {
  ticker: string;
  name: string;
  mint: string;
  decimals: number;
}

/** Registry-backed catalog of the known xStocks-market collateral. Used only as a
 * fallback label when the live reserve list cannot be fetched. */
export function catalogCollateral(): CollateralOption[] {
  const out: CollateralOption[] = [];
  for (const ticker of XSTOCKS_COLLATERAL_TICKERS) {
    const token = getToken(ticker);
    if (token) {
      out.push({ ticker: token.ticker, name: token.name, mint: token.mint, decimals: token.decimals });
    }
  }
  return out;
}
