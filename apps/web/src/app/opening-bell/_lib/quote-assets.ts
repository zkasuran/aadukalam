// Settlement (quote) assets an Opening Bell launch can be paired against.
// SOL is the default because Wrapped SOL exists on devnet and needs no token
// badge, so the built transaction is devnet-ready. Tokenized stocks from the
// registry are offered too, for an equity-vs-equity pair, but their mints live
// on mainnet so that pairing is a mainnet action.
// House style: no em dashes, no comma before "and" or "or".
import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { loadTokens } from "@aadukalam/data";
import type { SupportedDecimal } from "./presets";

export interface QuoteAsset {
  key: string;
  symbol: string;
  name: string;
  mint: PublicKey;
  decimals: SupportedDecimal;
  /** true when the mint exists on devnet, so the launch tx can send there */
  devnetReady: boolean;
  note?: string;
}

const VALID_DECIMALS = new Set([6, 7, 8, 9]);

function asSupportedDecimal(n: number): SupportedDecimal {
  return (VALID_DECIMALS.has(n) ? n : 6) as SupportedDecimal;
}

export const SOL_QUOTE: QuoteAsset = {
  key: "SOL",
  symbol: "SOL",
  name: "Wrapped SOL",
  mint: NATIVE_MINT,
  decimals: 9,
  devnetReady: true,
  note: "Native settlement, works on devnet with no token badge.",
};

/** SOL first, then a few tokenized stocks as equity-vs-equity quote options. */
export function quoteAssets(): QuoteAsset[] {
  const stocks = loadTokens()
    .filter((t) => VALID_DECIMALS.has(t.decimals))
    .slice(0, 6)
    .map((t) => ({
      key: t.mint,
      symbol: t.ticker,
      name: t.name,
      mint: new PublicKey(t.mint),
      decimals: asSupportedDecimal(t.decimals),
      devnetReady: false,
      note: "Mainnet Token-2022 mint. Pair on mainnet or supply a devnet mint.",
    }));
  return [SOL_QUOTE, ...stocks];
}
