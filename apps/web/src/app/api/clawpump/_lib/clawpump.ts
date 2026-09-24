// ClawPump server client and the wire types the /launch page and the two
// /api/clawpump routes share. Verified live 2026-09-23/24 against
// https://clawpump.tech (see .hq/research/clawpump.md).
//
// The one call that satisfies the bounty is POST /api/v1/launch/self-funded with
// pumpQuoteMint set to a tokenized-stock (xStock) mint. ClawPump builds the pool
// on the Meteora Dynamic Bonding Curve with that stock as the quote asset, so a
// single launch uses ClawPump AND Meteora. This module runs only the FREE
// preflight (preflight: true), which returns the SOL cost, the payTo address and
// a signed preflightToken while minting nothing and owing nothing. The paid
// launch spends real mainnet SOL from a real Solana keypair and is never run
// here: it is surfaced as a handoff command.
//
// The key is read from process.env.CLAWPUMP_API_KEY, server-side only, and is
// never returned to the browser. When it is unset the routes report keyMissing
// cleanly so the page still shows the flow and the public pump-pairs list.
//
// Only global fetch and process.env are used here, so the page may type-import
// from this file without pulling server code into the client bundle.

export const CLAWPUMP_API_BASE =
  process.env.CLAWPUMP_API_BASE || "https://clawpump.tech/api/v1";
// The public pump-pairs mirror needs no key and returns the same asset list.
export const CLAWPUMP_PUBLIC_PAIRS =
  process.env.CLAWPUMP_PUBLIC_PAIRS || "https://clawpump.tech/api/pump-pairs";

/** True when a server-side ClawPump key is configured. */
export function hasClawpumpKey(): boolean {
  return !!process.env.CLAWPUMP_API_KEY;
}

// ---- pump-pairs -----------------------------------------------------------

/** One asset from the ClawPump pump-pairs list. */
export interface PumpPairAsset {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  imageUrl?: string;
}

/** A pump-pair asset annotated with whether it is a real equity/ETF quote and
 * whether our own registry carries richer metadata for it. */
export interface AnnotatedAsset extends PumpPairAsset {
  isEquity: boolean;
  inRegistry: boolean;
}

export interface PumpPairsResult {
  ok: boolean;
  /** every asset ClawPump returns, annotated */
  assets: AnnotatedAsset[];
  /** equities and ETFs only, the "stocknized" quotes */
  stocks: AnnotatedAsset[];
  /** ClawPump default creator fee in bps for custom pairs (100 = 1%) */
  creatorFeeBps: number | null;
  source: string;
  fetchedAt: string;
  error?: string;
}

// Image hosts and path markers that identify a Backed/Backpack tokenized equity
// rather than a crypto or a memecoin. Verified against the live list: this keeps
// every xStock and Backpack stock and drops SOL, USDC, BTC, ETH and the memes.
function looksLikeEquity(a: PumpPairAsset, registryMints: Set<string>): boolean {
  const img = a.imageUrl || "";
  return (
    img.includes("stock-logo") ||
    img.includes("xstocks-metadata.backed.fi") ||
    img.includes("symbol-logo.tradingview") ||
    a.mint.startsWith("Xs") ||
    registryMints.has(a.mint)
  );
}

/** Fetch the public pump-pairs list (no key) and annotate each asset. */
export async function fetchPumpPairs(
  registryMints: Set<string>,
): Promise<PumpPairsResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(CLAWPUMP_PUBLIC_PAIRS, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      assets?: PumpPairAsset[];
      creatorFeeBps?: number | { default?: number };
    };
    const raw = Array.isArray(json.assets) ? json.assets : [];
    const assets: AnnotatedAsset[] = raw.map((a) => ({
      mint: a.mint,
      symbol: a.symbol,
      name: a.name,
      decimals: a.decimals,
      imageUrl: a.imageUrl,
      isEquity: looksLikeEquity(a, registryMints),
      inRegistry: registryMints.has(a.mint),
    }));
    const feeRaw = json.creatorFeeBps;
    const creatorFeeBps =
      typeof feeRaw === "number"
        ? feeRaw
        : typeof feeRaw?.default === "number"
          ? feeRaw.default
          : null;
    return {
      ok: true,
      assets,
      stocks: assets.filter((a) => a.isEquity),
      creatorFeeBps,
      source: CLAWPUMP_PUBLIC_PAIRS,
      fetchedAt,
    };
  } catch (err) {
    return {
      ok: false,
      assets: [],
      stocks: [],
      creatorFeeBps: null,
      source: CLAWPUMP_PUBLIC_PAIRS,
      fetchedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---- self-funded launch (preflight only) ----------------------------------

/** The launch fields. agentId is a caller-chosen unique string (ClawPump enforces
 * one token per agentId), not a pre-created server object. */
export interface LaunchFields {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  agentId: string;
  agentName: string;
  /** Solana base58 wallet that pays the fee and receives the 75% creator share. */
  walletAddress: string;
  /** xStock mint to pair against. Omit for a plain SOL pair. */
  pumpQuoteMint?: string;
  /** custom-pair creator fee, 100-300 bps. SOL pairs cannot set it. */
  pumpCreatorFeeBps?: number;
  /** initial dev buy in SOL, default 0. */
  devBuySol?: number;
}

/** What the browser posts to /api/clawpump/preflight. */
export interface PreflightInput extends LaunchFields {}

/** The SOL cost block ClawPump returns for a preflight. */
export interface PreflightPayment {
  method: string;
  amountLamports: number;
  amountSol: number;
  payTo: string;
  payFrom?: string;
  validForSeconds: number;
  breakdown?: { creationFeeSol?: number; devBuySol?: number };
}

/** Our route response for a preflight. */
export interface PreflightResult {
  ok: boolean;
  /** true when CLAWPUMP_API_KEY is unset on the server. */
  keyMissing?: boolean;
  /** the SOL amount, payTo and validity window, present on a good preflight. */
  payment?: PreflightPayment;
  /** the signed token the paid retry must carry. Launch-scoped, not a secret. */
  preflightToken?: string;
  /** the exact launch body to re-POST with txSignature + preflightToken. */
  launchBody?: LaunchFields;
  /** the resolved stock pair, echoed for the UI. */
  pair?: { mint: string; symbol: string; kind: "stock" | "sol" };
  message?: string;
  error?: string;
  fetchedAt: string;
}

/** Run the FREE preflight (preflight: true). Never sends payment, never mints. */
export async function preflightLaunch(
  fields: LaunchFields,
): Promise<PreflightResult> {
  const fetchedAt = new Date().toISOString();
  const key = process.env.CLAWPUMP_API_KEY;
  if (!key) {
    return {
      ok: false,
      keyMissing: true,
      message:
        "CLAWPUMP_API_KEY is not set on the server, so the live preflight is offline. The pump-pairs list and the full launch flow still render. Set CLAWPUMP_API_KEY (a free cpk_ key from clawpump.tech/developers) to price a real preflight.",
      fetchedAt,
    };
  }

  try {
    const res = await fetch(`${CLAWPUMP_API_BASE}/launch/self-funded`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...fields, preflight: true }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      payment?: PreflightPayment;
      retryWith?: { preflightToken?: string };
      error?: string;
    };
    if (!res.ok || !json.payment) {
      return {
        ok: false,
        error:
          json.error || `ClawPump preflight failed (HTTP ${res.status})`,
        fetchedAt,
      };
    }
    return {
      ok: true,
      payment: json.payment,
      preflightToken: json.retryWith?.preflightToken,
      launchBody: fields,
      pair: fields.pumpQuoteMint
        ? { mint: fields.pumpQuoteMint, symbol: "", kind: "stock" }
        : { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", kind: "sol" },
      fetchedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      fetchedAt,
    };
  }
}
