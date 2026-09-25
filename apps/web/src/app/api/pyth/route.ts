// Server proxy for Pyth prices. Default path is KEYLESS: it reads Pyth's
// sponsored price-feed accounts straight off Solana mainnet over RPC, so no
// PYTH_API_KEY and no Pyth Pro plan is needed (the Hermes HTTP price service was
// paywalled in the 2026-08-26 Pyth Core upgrade). If PYTH_API_KEY is set we use
// the keyed Hermes HTTP path instead. Either way the browser only ever talks to
// this route. See .hq/research/pyth.md and .hq/verify-pyth-onchain.cjs.

import { NextResponse, type NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";
import { hermesLatest, readPythOnchainPrices } from "@aadukalam/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sponsored equity feeds stay fresh even off-hours, but allow a generous window
// so a weekend gap degrades to the Jupiter reference rather than a stale price.
const MAX_AGE_SEC = 6 * 60 * 60;

function mainnetRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_MAINNET ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ||
    "https://api.mainnet-beta.solana.com"
  );
}

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) return NextResponse.json({ prices: [], source: "onchain" });

  // Optional keyed Hermes fast path, only when a key is explicitly provisioned.
  const apiKey = process.env.PYTH_API_KEY;
  if (apiKey) {
    try {
      const prices = await hermesLatest(ids, apiKey);
      return NextResponse.json({ prices, source: "hermes" });
    } catch {
      // fall through to the keyless on-chain read
    }
  }

  try {
    const conn = new Connection(mainnetRpcUrl(), "confirmed");
    const prices = await readPythOnchainPrices(ids, conn, { maxAgeSec: MAX_AGE_SEC });
    return NextResponse.json({ prices, source: "onchain" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ prices: [], source: "onchain", error: message });
  }
}
