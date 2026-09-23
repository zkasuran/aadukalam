// Server proxy for Jupiter. Free keyless lite-api by default, upgrades to
// api.jup.ag with the x-api-key header when JUPITER_API_KEY is set. GET handles
// price (op=price) and quote (op=quote). POST builds the swap transaction from a
// quote. Jupiter is mainnet only and the swap tx is signed by the user's wallet
// on the client, never here. See .hq/research/jupiter.md.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JUP_BASE = process.env.JUPITER_API_KEY ? "https://api.jup.ag" : "https://lite-api.jup.ag";

function jupHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";
  const key = process.env.JUPITER_API_KEY;
  if (key) headers["x-api-key"] = key;
  return headers;
}

// Pass the upstream JSON body and status straight through so callers see the
// verbatim Jupiter response.
function passthrough(text: string, status: number): NextResponse {
  return new NextResponse(text, {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const op = sp.get("op") ?? "price";

  try {
    if (op === "price") {
      const ids = sp.get("ids");
      if (!ids) return NextResponse.json({ error: "missing ids" }, { status: 400 });
      const res = await fetch(`${JUP_BASE}/price/v3?ids=${encodeURIComponent(ids)}`, {
        headers: jupHeaders(),
        cache: "no-store",
      });
      return passthrough(await res.text(), res.status);
    }

    if (op === "quote") {
      const inputMint = sp.get("inputMint");
      const outputMint = sp.get("outputMint");
      const amount = sp.get("amount");
      if (!inputMint || !outputMint || !amount) {
        return NextResponse.json(
          { error: "missing inputMint, outputMint or amount" },
          { status: 400 },
        );
      }
      const slippageBps = sp.get("slippageBps") ?? "50";
      const q = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps,
        swapMode: "ExactIn",
      });
      const res = await fetch(`${JUP_BASE}/swap/v1/quote?${q.toString()}`, {
        headers: jupHeaders(),
        cache: "no-store",
      });
      return passthrough(await res.text(), res.status);
    }

    return NextResponse.json({ error: `unknown op: ${op}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const quoteResponse = body?.quoteResponse;
    const userPublicKey = body?.userPublicKey;
    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        { error: "missing quoteResponse or userPublicKey" },
        { status: 400 },
      );
    }

    const res = await fetch(`${JUP_BASE}/swap/v1/swap`, {
      method: "POST",
      headers: jupHeaders(true),
      cache: "no-store",
      body: JSON.stringify({
        userPublicKey,
        quoteResponse,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: { maxLamports: 1000000, priorityLevel: "veryHigh" },
        },
      }),
    });
    return passthrough(await res.text(), res.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
