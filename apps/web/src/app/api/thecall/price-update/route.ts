// Server route for The Call resolve. Fetches a signed Pyth price update (the VAA
// blob) from Hermes with the server-held PYTH_API_KEY, so the key never reaches
// the browser. The client posts the returned blob on-chain through the Pyth pro
// receiver, then calls resolve in the same transaction set.
//
// Returns { keyMissing: true } with HTTP 200 when no key is set, so the resolve
// UI shows the honest "provision a Pyth key to resolve" state instead of failing.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HERMES_BASE = process.env.NEXT_PUBLIC_PYTH_HERMES ?? "https://hermes.pyth.network";

interface HermesParsed {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
}

export async function GET(req: NextRequest) {
  const feed = (req.nextUrl.searchParams.get("feed") ?? "").trim().replace(/^0x/i, "");
  if (!feed) {
    return NextResponse.json({ error: "missing feed" }, { status: 400 });
  }

  const apiKey = process.env.PYTH_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ keyMissing: true, vaa: [], parsed: [] });
  }

  const params = new URLSearchParams();
  params.append("ids[]", feed);
  params.append("encoding", "hex");
  params.append("parsed", "true");

  try {
    const res = await fetch(`${HERMES_BASE}/v2/updates/price/latest?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { vaa: [], parsed: [], error: `Hermes ${res.status}: ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      binary?: { data?: string[] };
      parsed?: HermesParsed[];
    };
    return NextResponse.json({
      vaa: json.binary?.data ?? [],
      parsed: json.parsed ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ vaa: [], parsed: [], error: message }, { status: 502 });
  }
}
