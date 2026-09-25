// Pure normalization for the PreStocks provider. Kept out of the route file
// because a Next.js route module may only export HTTP handlers, and kept pure so
// it is unit tested directly against adversarial payloads. Turns the raw
// /prestocks response into safe ReceiptRow[]: every numeric field passes through
// `num`, one malformed token never throws, and a non-array payload yields [].
// Every row it returns is provider "prestocks"; no other provider enters here.

import type { BackingProof, ReceiptRow } from "./types";

export interface VolumeContext {
  date: string | null;
  bySymbol: Record<string, number>;
}

// PreStocks publishes no proof of reserve of any kind. This is a constant, not a
// missing fetch: ~20 proof-related paths were probed and every one 404s.
export const PRESTOCKS_BACKING: BackingProof = {
  hasProof: false,
  kind: "none",
  legalStructure: null,
  custodian: null,
  auditor: null,
  auditId: null,
  auditFindings: null,
  feedUrl: null,
  proofUrl: null,
  note:
    "PreStocks publishes no proof of reserve, no attestation, no audit and no SPV holdings count. The only on-chain handle is the mint, so the 1:1 SPV backing claim cannot be checked against any public source. In May 2026 Anthropic and OpenAI warned that share transfers to these SPVs are void.",
};

/** A finite number, or null. PreStocks fields are trusted only after this. */
export function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/**
 * Normalize one raw PreStocks product into a ReceiptRow, or null when it lacks
 * the identity or the core price and valuation that make a row meaningful.
 */
function buildRow(raw: unknown, vol: VolumeContext): ReceiptRow | null {
  const p = (raw ?? {}) as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name : null;
  const symbol = typeof p.symbol === "string" ? p.symbol : null;
  const mint = typeof p.contract_address === "string" ? p.contract_address : null;
  const markPrice = num(p.markPrice);
  const tokenPrice = num(p.tokenPrice);
  const markValuation = num(p.markValuation);
  if (!symbol || !mint || markPrice === null || tokenPrice === null || markValuation === null) {
    return null;
  }
  const company = (name ?? symbol).replace(/ PreStocks$/i, "").trim() || symbol;
  const supply = num(p.supply);
  const recentVolume = num(vol.bySymbol[symbol]);
  return {
    provider: "prestocks",
    company,
    symbol,
    code: null,
    sector: null,
    mint,
    price: tokenPrice,
    markPrice,
    premiumPct: markPrice > 0 ? tokenPrice / markPrice - 1 : null,
    supply,
    holders: null,
    markValuation,
    impliedValuation: num(p.impliedValuation),
    companyShares: markPrice > 0 ? markValuation / markPrice : null,
    onChainMktCap: supply !== null ? supply * tokenPrice : null,
    metadataUri: null,
    externalUrl: typeof p.external_url === "string" ? p.external_url : "https://prestocks.com",
    recentVolume,
    recentVolumeDate: recentVolume !== null ? vol.date : null,
    backing: PRESTOCKS_BACKING,
  };
}

/**
 * Turn the raw /prestocks payload into safe rows. Guards a non-array response,
 * skips any entry that cannot be normalized and never throws on a bad token, so
 * the PreStocks surface degrades gracefully instead of going dark on one glitch.
 */
export function normalizePreStocks(products: unknown, vol: VolumeContext): ReceiptRow[] {
  if (!Array.isArray(products)) return [];
  const rows: ReceiptRow[] = [];
  for (const raw of products) {
    try {
      const row = buildRow(raw, vol);
      if (row) rows.push(row);
    } catch {
      // a single malformed token is skipped, never allowed to kill the batch
    }
  }
  return rows;
}
