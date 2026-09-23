// Server proxy for Pyth Hermes live prices. Holds PYTH_API_KEY and calls Hermes
// with the Bearer token so the key never reaches the browser. When no key is set
// it returns HTTP 200 { keyMissing: true, prices: [] } so the UI falls back to the
// Jupiter price cleanly. See .hq/research/pyth.md for the key gate.

import { NextResponse, type NextRequest } from "next/server";
import { hermesLatest, PythKeyMissingError } from "@aadukalam/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const apiKey = process.env.PYTH_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ keyMissing: true, prices: [] });
  }

  try {
    const prices = await hermesLatest(ids, apiKey);
    return NextResponse.json({ prices });
  } catch (err) {
    if (err instanceof PythKeyMissingError) {
      return NextResponse.json({ keyMissing: true, prices: [] });
    }
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ prices: [], error: message }, { status: 502 });
  }
}
