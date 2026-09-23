// Shared Receipt data model. Two providers stay strictly separable behind the
// `provider` discriminator. The bounty rule is hard: a PreStocks submission that
// integrates any non-PreStocks token is ineligible, so rows are never merged and
// never deduped by company name (KALSHI, OPENAI and SPACEX collide across both).

export type Provider = "tessera" | "prestocks";

/**
 * Backing proof a provider actually publishes. Tessera exposes a real one
 * (Chainlink Proof-of-Reserve, a Cayman SPC, Fireblocks custody, a published
 * audit). PreStocks exposes none, so that gap is the whole point of Receipt.
 */
export interface BackingProof {
  hasProof: boolean;
  kind: "chainlink-por" | "none";
  legalStructure: string | null; // e.g. "Cayman Islands SPC segregated portfolio"
  custodian: string | null; // e.g. "Fireblocks (MPC)"
  auditor: string | null; // e.g. "Accretion Labs"
  auditId: string | null; // e.g. "A25TES1"
  auditFindings: string | null; // e.g. "0 critical, 0 high, 9 medium"
  feedUrl: string | null; // Chainlink PoR stream page
  proofUrl: string | null; // audit report or attestation PDF
  note: string; // plain-English summary of what is and is not proven
}

/**
 * One normalized token row. Numbers a provider does not expose are `null`, never
 * faked. `price` is the tradeable token price where the provider gives one, else
 * the mark price (Tessera publishes no live DEX price in its API).
 */
export interface ReceiptRow {
  provider: Provider;
  company: string; // display only, collides across providers
  symbol: string;
  code: string | null; // provider ticker (e.g. tOpenAI)
  sector: string | null;
  mint: string; // Solana mint, unique per provider
  price: number; // tokenPrice for prestocks, markPrice for tessera
  markPrice: number;
  premiumPct: number | null; // price / markPrice - 1, null when no separate token price
  supply: number | null; // on-chain token supply
  holders: number | null;
  markValuation: number; // markPrice * companyShares (reference)
  impliedValuation: number | null; // tokenPrice * companyShares
  companyShares: number | null; // markValuation / markPrice
  onChainMktCap: number | null; // supply * price, the real money on chain
  metadataUri: string | null;
  externalUrl: string | null;
  // Latest daily volume the provider reports, where it exposes one. Raw units as
  // returned by the source, labeled as such in the UI. PreStocks /api/stats only.
  recentVolume?: number | null;
  recentVolumeDate?: string | null;
  backing: BackingProof;
}

/** Envelope every Receipt route returns. `stale` means served from the in-memory
 * cache after an upstream failure. `error` is set when we could not reach the
 * source and had nothing cached to serve. */
export interface ReceiptResponse {
  provider: Provider;
  rows: ReceiptRow[];
  fetchedAt: string; // ISO timestamp of the data being served
  stale: boolean;
  source: string; // upstream base URL(s)
  error?: string;
}
