import { NextResponse } from "next/server";

import type {
  BackingProof,
  ReceiptResponse,
  ReceiptRow,
} from "@/app/know/receipt/_lib/types";

// Tessera provider route. Reads the two live public REST endpoints, merges them
// by mint and returns normalized ReceiptRow[] tagged provider "tessera". The
// token-details endpoint is UA-gated and flaky (200, then 500 on retries, then
// 200 with a browser UA), so we send a browser User-Agent, retry with backoff
// and keep the last good payload in memory to serve if the source drops.
//
// Kept strictly separate from the PreStocks route: this file never touches a
// PreStocks endpoint or mint, so the Tessera bounty surface reads Tessera only.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://rest-api.tessera.pe/v1/public";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface TesseraDetail {
  id: string;
  name: string;
  symbol: string;
  code: string;
  sector: string;
  mint: string;
  markPrice: number;
  holders: number;
  markValuation: number;
}

interface TesseraSupply {
  token: string; // mint
  latest_supply: string;
  name: string;
  symbol: string;
  uri: string;
}

// Chainlink PoR stream pages, keyed by Tessera code. These are the public
// verification handles Receipt cites. The on-chain feed account IDs are not in
// Tessera's docs, so we link the stream page rather than assert a live ratio.
const POR_FEEDS: Record<string, string> = {
  tSpaceX: "https://data.chain.link/streams/tspacex-usd-smartdata-datalink",
  tKalshi: "https://data.chain.link/streams/tkalshi-usd-smartdata-datalink",
  tOpenAI: "https://data.chain.link/streams/topenai--nav-streams",
};

// Provider-level backing facts, verified from Tessera docs 2026-09-23. Static
// because the REST API exposes none of this: it lives in the docs and the
// on-chain programs, not in a JSON field.
const TESSERA_BACKING: Omit<BackingProof, "feedUrl"> = {
  hasProof: true,
  kind: "chainlink-por",
  legalStructure: "Cayman Islands SPC segregated portfolio",
  custodian: "Fireblocks (MPC)",
  auditor: "Accretion Labs",
  auditId: "A25TES1",
  auditFindings: "0 critical, 0 high, 9 medium, 11 low",
  proofUrl:
    "https://cdn.tesseralab.co/tessera/2025-accretion-tessera-token-and-referral-audit-A25TES1.pdf",
  note:
    "T-Tokens are loan participation rights, not equity, so no voting, dividend or cap-table claim. Supply is held 1:1 against verified units of underlying exposure inside a Cayman SPC, with a Chainlink Proof-of-Reserve refreshed monthly. The loan to the issuer is unsecured, so the proof covers unit counts rather than a secured claim on the shares.",
};

// Last good payload, kept in the module scope so it survives across requests in
// one server process.
let cache: ReceiptResponse | null = null;

async function getJSON<T>(path: string, tries = 4): Promise<T> {
  let last = "no attempt";
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      const res = await fetch(`${BASE}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return (await res.json()) as T;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    // Backoff grows with each try: 400ms, 800ms, 1200ms.
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw new Error(`tessera ${path} failed: ${last}`);
}

function buildRow(
  d: TesseraDetail,
  supply: number | null,
  uri: string | null
): ReceiptRow {
  const company = d.name.replace(/^T-/, "");
  const companyShares = d.markPrice ? d.markValuation / d.markPrice : null;
  const onChainMktCap = supply !== null ? supply * d.markPrice : null;
  return {
    provider: "tessera",
    company,
    symbol: d.symbol,
    code: d.code ?? null,
    sector: d.sector ?? null,
    mint: d.mint,
    // Tessera publishes no live DEX price in this API, so mark is the only price.
    price: d.markPrice,
    markPrice: d.markPrice,
    premiumPct: null,
    supply,
    holders: Number.isFinite(d.holders) ? d.holders : null,
    markValuation: d.markValuation,
    // Implied valuation needs a traded price Tessera does not expose here.
    impliedValuation: null,
    companyShares,
    onChainMktCap,
    metadataUri: uri,
    externalUrl: "https://app.tessera.pe",
    backing: { ...TESSERA_BACKING, feedUrl: POR_FEEDS[d.code] ?? null },
  };
}

export async function GET() {
  try {
    // token-details is the flaky one and carries the core fields, tokens is
    // reliable and carries supply and the metadata uri. Fetch both.
    const [details, supplies] = await Promise.all([
      getJSON<TesseraDetail[]>("/token-details"),
      getJSON<TesseraSupply[]>("/tokens").catch(() => [] as TesseraSupply[]),
    ]);

    const byMint = new Map<string, TesseraSupply>();
    for (const s of supplies) byMint.set(s.token, s);

    const rows = details.map((d) => {
      const s = byMint.get(d.mint);
      const supply = s ? Number(s.latest_supply) : null;
      return buildRow(d, Number.isFinite(supply) ? supply : null, s?.uri ?? null);
    });

    cache = {
      provider: "tessera",
      rows,
      fetchedAt: new Date().toISOString(),
      stale: false,
      source: BASE,
    };
    return NextResponse.json(cache);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (cache) {
      // Serve the last good data rather than a fake or an empty screen.
      return NextResponse.json({ ...cache, stale: true });
    }
    const body: ReceiptResponse = {
      provider: "tessera",
      rows: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      source: BASE,
      error: `Could not reach Tessera: ${message}`,
    };
    return NextResponse.json(body, { status: 200 });
  }
}
