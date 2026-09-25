// @aadukalam/data
// Verified tokenized-stock registry for Aadukalam. 58 mints confirmed on-chain
// (every entry is Token-2022), with issuer rights, themes and Pyth feed ids.
// Provenance is in .hq/research/registry.md. Never invent a mint here.

import tokens from "./tokens.json";

export type Issuer =
  | "Backed Assets (JE) Limited (xStocks)"
  | "Ondo Global Markets"
  | "Backpack Securities"
  | "PreStocks"
  | "Tessera"
  | string;

export interface TokenRights {
  /** shareholder voting, false or null for most wrappers */
  voting: boolean | null;
  /** dividend mechanism in prose, or null when there is none */
  dividends: string | null;
  /** redemption path in prose, or null */
  redemption: string | null;
  /** backing and legal-claim description */
  backing: string;
}

export interface TokenInfo {
  /** ticker as shown, e.g. AAPLx */
  ticker: string;
  /** underlying name, e.g. Apple xStock */
  name: string;
  /** SPL mint address (Token-2022) */
  mint: string;
  /** issuer name */
  issuer: Issuer;
  /** chain, always "solana" here */
  network: string;
  /** SPL token program id (Token-2022 for every entry) */
  tokenProgram: string;
  /** on-chain decimals */
  decimals: number;
  /** legal rights and backing */
  rights: TokenRights;
  /** theme tags for Conviction baskets */
  themes: string[];
  /** Pyth xStock (24/7) feed id, when one exists */
  pythFeedId?: string | null;
  /** Pyth regular-equity feed id */
  pythEquityFeedId?: string | null;
  /** Pyth Ondo feed id */
  pythOndoFeedId?: string | null;
  /** approx on-chain liquidity in USD, may be 0 */
  liquidityUsd?: number;
  /** approx holder count, may be 0 */
  holders?: number;
  /** verification provenance from research */
  verified?: Record<string, unknown>;
  /** free-form note */
  note?: string | null;
}

const REGISTRY = tokens as unknown as TokenInfo[];

// PLACEHOLDER_HELPERS
export const THEME_LABELS: Record<string, string> = {
  mag7: "Mag 7",
  "ai-chips": "AI Chips",
  "ai-infra": "AI Infrastructure",
  memory: "Memory and Storage",
  "semi-equip": "Semiconductor Equipment",
  nuclear: "Nuclear",
  "clean-energy": "Clean Energy",
  energy: "Energy",
  "oil-gas": "Oil and Gas",
  "index-etf": "Index ETFs",
  "leveraged-etf": "Leveraged ETFs",
  inverse: "Inverse ETFs",
  gold: "Gold",
  "safe-haven": "Safe Haven",
  "crypto-proxy": "Crypto Proxies",
  "bitcoin-treasury": "Bitcoin Treasuries",
  stablecoin: "Stablecoin Issuers",
  fintech: "Fintech",
  defense: "Defense",
  ev: "EV",
  space: "Space",
  streaming: "Streaming",
  consumer: "Consumer",
  "meme-retail": "Meme and Retail",
  "pre-ipo-graduated": "Recently Public",
};

export function loadTokens(): TokenInfo[] {
  return REGISTRY;
}

export function getToken(tickerOrMint: string): TokenInfo | undefined {
  const q = tickerOrMint.trim().toLowerCase();
  return REGISTRY.find(
    (t) => t.ticker.toLowerCase() === q || t.mint.toLowerCase() === q,
  );
}

export function allThemes(): string[] {
  const set = new Set<string>();
  for (const t of REGISTRY) for (const th of t.themes) set.add(th);
  return [...set].sort();
}

export function tokensByTheme(theme: string): TokenInfo[] {
  return REGISTRY.filter((t) => t.themes.includes(theme));
}

export function tokensByIssuer(issuer: string): TokenInfo[] {
  const q = issuer.toLowerCase();
  return REGISTRY.filter((t) => t.issuer.toLowerCase().includes(q));
}

/**
 * Prefer the regular US-equity feed, then the 24/7 xStock feed, then Ondo. The
 * equity feed is the one Pyth keeps live and sponsored on-chain (keyless), and it
 * is the real underlying-stock fair value that TruePrice compares the tokenized
 * DEX price against. The xStock/Ondo feeds are the fallback when a token has no
 * equity feed. See .hq/research/pyth.md for the keyless coverage map.
 */
export function bestPythFeed(t: TokenInfo): string | null {
  return t.pythEquityFeedId || t.pythFeedId || t.pythOndoFeedId || null;
}

