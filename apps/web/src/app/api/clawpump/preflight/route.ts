// POST /api/clawpump/preflight
// Runs the FREE ClawPump self-funded preflight (preflight: true) for a
// stock-paired token launch. Returns the SOL cost, the payTo address and the
// signed preflightToken. It mints nothing, moves no funds and owes nothing. The
// paid launch spends real mainnet SOL and is never run here: the page turns this
// result into a handoff command the operator fires from a funded Solana keypair.
//
// Note: this endpoint is unauthenticated like the app's other public proxies
// (pyth, jupiter, kamino). A preflight is free and side-effect-light, but it does
// draw on the server key's monthly free-tier allowance, so a public deployment
// may want a rate limit in front of it. See _lib/clawpump.ts.

import { NextResponse, type NextRequest } from "next/server";

import { getToken } from "@aadukalam/data";
import { isValidSolanaAddress } from "@aadukalam/sdk";

import {
  preflightLaunch,
  type LaunchFields,
  type PreflightInput,
  type PreflightResult,
} from "../_lib/clawpump";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(error: string): NextResponse {
  const body: PreflightResult = { ok: false, error, fetchedAt: new Date().toISOString() };
  return NextResponse.json(body, { status: 400 });
}

export async function POST(req: NextRequest) {
  let input: Partial<PreflightInput>;
  try {
    input = (await req.json()) as Partial<PreflightInput>;
  } catch {
    return bad("invalid JSON body");
  }

  const name = String(input.name ?? "").trim();
  const symbol = String(input.symbol ?? "").trim();
  const description = String(input.description ?? "").trim();
  const walletAddress = String(input.walletAddress ?? "").trim();
  const pumpQuoteMint = input.pumpQuoteMint ? String(input.pumpQuoteMint).trim() : undefined;

  if (!name) return bad("name is required");
  if (!symbol) return bad("symbol is required");
  if (description.length < 20 || description.length > 500) {
    return bad("description must be 20 to 500 characters");
  }
  if (!isValidSolanaAddress(walletAddress)) {
    return bad("walletAddress must be a valid Solana address (the funded payer)");
  }

  // agentId is a caller-chosen unique string. ClawPump enforces one token per
  // agentId, so a fresh id per launch attempt is correct. Generate one when the
  // client did not send its own.
  const agentId = String(input.agentId ?? "").trim() || `aadukalam-${crypto.randomUUID()}`;
  const agentName = String(input.agentName ?? "").trim() || `${symbol} Launcher`;

  // A default token image from the paired xStock logo when the client omitted one.
  const paired = pumpQuoteMint ? getToken(pumpQuoteMint) : undefined;
  const imageUrl =
    String(input.imageUrl ?? "").trim() ||
    (paired ? `https://xstocks-metadata.backed.fi/logos/tokens/${paired.ticker}.png` : "");
  if (!imageUrl) return bad("imageUrl is required");

  const fields: LaunchFields = {
    name,
    symbol,
    description,
    imageUrl,
    agentId,
    agentName,
    walletAddress,
    pumpQuoteMint,
  };
  if (pumpQuoteMint && typeof input.pumpCreatorFeeBps === "number") {
    const bps = Math.round(input.pumpCreatorFeeBps);
    if (bps >= 100 && bps <= 300) fields.pumpCreatorFeeBps = bps;
  }
  if (typeof input.devBuySol === "number" && input.devBuySol > 0) {
    fields.devBuySol = input.devBuySol;
  }

  const result = await preflightLaunch(fields);

  // Fill the paired symbol for the UI from our registry when we have it.
  if (result.pair?.kind === "stock" && paired) {
    result.pair.symbol = paired.ticker;
  }
  return NextResponse.json(result);
}
