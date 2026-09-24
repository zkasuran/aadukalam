// GET /api/clawpump/pump-pairs
// Proxies the public ClawPump pump-pairs list (no key needed) and annotates each
// asset with whether it is a tokenized equity/ETF and whether our registry holds
// richer metadata. The page uses the "stocks" slice to pick a pair to launch
// against. See _lib/clawpump.ts and .hq/research/clawpump.md.

import { NextResponse } from "next/server";

import { loadTokens } from "@aadukalam/data";

import { fetchPumpPairs } from "../_lib/clawpump";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const registryMints = new Set(loadTokens().map((t) => t.mint));
  const result = await fetchPumpPairs(registryMints);
  // Always 200: an upstream miss returns ok:false with an error the UI shows,
  // never a broken screen.
  return NextResponse.json(result);
}
