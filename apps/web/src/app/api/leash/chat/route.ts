// Leash chat route. A MiniMax tool-calling loop over three tools: getPrice,
// getQuote and proposeTrade. It is OpenAI-compatible, base https://api.minimax.io/v1,
// model MiniMax-M3, key read from process.env.MINIMAX_API_KEY and never hardcoded.
//
// The safety core is proposeTrade. It runs the pure enforce() gate FIRST, against
// the policy and session ledger the client sent (never anything the model made
// up) and only builds an unsigned swap transaction when the verdict is allowed.
// The user signs that transaction in their own wallet. The server never signs and
// never holds a key. If MINIMAX_API_KEY is unset the route says so plainly and the
// guardrail plus the manual trade flow on the page still work.

import { NextResponse, type NextRequest } from "next/server";

import { getToken } from "@aadukalam/data";
import { fetchPythPrices, getJupiterPrice } from "@aadukalam/sdk";

import { type GuardrailPolicy, type TradeSide } from "@/app/grow/leash/_lib/guardrail";
import { sanitizePolicy } from "@/app/grow/leash/_lib/policy";
import { buildQuote, proposeTrade } from "@/app/grow/leash/_lib/trade";
import type {
  LeashChatRequest,
  LeashChatResponse,
  ProposedTradeResult,
  SessionLedger,
  ToolEvent,
  UiMessage,
} from "@/app/grow/leash/_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STEPS = 6;

const MINIMAX_BASE = process.env.MINIMAX_API_BASE || "https://api.minimax.io/v1";
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M3";

interface WireToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: WireToolCall[];
  tool_call_id?: string;
  name?: string;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "getPrice",
      description:
        "Get the live USD price of a tokenized stock. Returns the Jupiter on-chain DEX price, the underlying equity reference price when present and the Pyth fair value when a Pyth key is configured.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "ticker such as AAPLx or NVDAx" },
        },
        required: ["ticker"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getQuote",
      description:
        "Get a Jupiter swap route for a trade of a given USD size, without building a transaction. Use this to show the user the estimated shares and price impact before proposing.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string" },
          usdAmount: { type: "number", description: "USD notional of the trade" },
          side: { type: "string", enum: ["buy", "sell"], description: "defaults to buy" },
        },
        required: ["ticker", "usdAmount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeTrade",
      description:
        "Propose a trade for the user to sign. This runs the hard guardrail gate first. If the guardrail refuses, no transaction is built and the reason is returned. If it allows, an unsigned swap transaction is returned for the user to sign in their own wallet. You never execute a trade, the user always signs.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string" },
          usdAmount: { type: "number", description: "USD notional of the trade" },
          side: { type: "string", enum: ["buy", "sell"], description: "defaults to buy" },
        },
        required: ["ticker", "usdAmount"],
      },
    },
  },
];

function systemPrompt(policy: GuardrailPolicy): string {
  const list = policy.allowlist.length ? policy.allowlist.join(", ") : "(empty, so every trade is refused)";
  return [
    "You are Leash, a guard-railed investing assistant for tokenized stocks (xStocks) on Solana.",
    "You help the user build positions in tokenized stocks by proposing trades they sign in their own wallet.",
    "",
    "Hard guardrails the user has set (enforced in code, you cannot override them):",
    `- allowlist: ${list}`,
    `- max position per ticker: $${policy.maxPositionUsd}`,
    `- daily budget: $${policy.dailyBudgetUsd}`,
    `- per-trade cap: $${policy.perTradeCapUsd}`,
    "",
    "How to work:",
    "- Use getPrice and getQuote to inform the user before you propose anything.",
    "- Call proposeTrade to create a trade. A pure code gate checks the allowlist and every cap before any transaction is built. If it refuses, explain the refusal plainly and suggest a trade that would pass.",
    "- Never claim you executed or bought anything. You only propose. The user signs.",
    "- Only ever work with tickers on the allowlist. If asked for something off it, say it is not allowlisted.",
    "- Keep replies short and concrete. No em dashes. No comma before and or or.",
  ].join("\n");
}

// MiniMax-M3 is a reasoning model that can emit <think>...</think> before its
// answer. Strip it so the chat shows the answer only.
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

async function callMiniMax(key: string, messages: WireMessage[]): Promise<{ message: WireMessage }> {
  const res = await fetch(`${MINIMAX_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
    cache: "no-store",
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MiniMax ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const message = json?.choices?.[0]?.message;
  if (!message) throw new Error("MiniMax returned no message");
  return { message: message as WireMessage };
}

// ---- tools --------------------------------------------------------------

async function toolGetPrice(origin: string, ticker: string) {
  const token = getToken(ticker);
  if (!token) return { error: `unknown ticker ${ticker}` };
  const map = await getJupiterPrice([token.mint], origin);
  const jup = map[token.mint];
  let pythFairValueUsd: number | null = null;
  if (token.pythFeedId) {
    const pyth = await fetchPythPrices([token.pythFeedId], origin);
    if (pyth.length > 0) pythFairValueUsd = pyth[0].price * 10 ** pyth[0].expo;
  }
  return {
    ticker: token.ticker,
    mint: token.mint,
    jupiterDexPriceUsd: jup?.usdPrice ?? null,
    underlyingReferenceUsd: jup?.stockData?.price ?? null,
    pythFairValueUsd,
    pythAvailable: pythFairValueUsd !== null,
    note: jup?.usdPrice == null ? "no live Jupiter price available" : undefined,
  };
}

async function toolGetQuote(origin: string, ticker: string, usdAmount: number, side: TradeSide) {
  const token = getToken(ticker);
  if (!token) return { error: `unknown ticker ${ticker}` };
  try {
    const { summary } = await buildQuote(origin, token, usdAmount, side);
    return { ticker: token.ticker, side, ...summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "quote failed" };
  }
}

// ---- the loop -----------------------------------------------------------

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  let body: LeashChatRequest;
  try {
    body = (await req.json()) as LeashChatRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const policy = sanitizePolicy(body.policy);
  const ledger: SessionLedger = {
    spentTodayUsd: Number(body.ledger?.spentTodayUsd) || 0,
    positionsUsd: body.ledger?.positionsUsd ?? {},
  };
  const history = Array.isArray(body.messages) ? body.messages : [];
  const userPublicKey = typeof body.userPublicKey === "string" ? body.userPublicKey : undefined;

  const key = process.env.MINIMAX_API_KEY;
  const toolEvents: ToolEvent[] = [];
  let proposedTrade: ProposedTradeResult | undefined;

  if (!key) {
    const res: LeashChatResponse = {
      llmConfigured: false,
      error: "LLM not configured",
      message:
        "MINIMAX_API_KEY is not set on the server, so the chat agent is offline. The guardrail and the manual trade flow on this page still work. Set MINIMAX_API_KEY to enable the chat.",
      toolEvents,
    };
    return NextResponse.json(res);
  }

  const wire: WireMessage[] = [
    { role: "system", content: systemPrompt(policy) },
    ...history.map(
      (m: UiMessage) => ({ role: m.role, content: String(m.content ?? "") }) as WireMessage,
    ),
  ];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const { message } = await callMiniMax(key, wire);
      wire.push({
        role: "assistant",
        content: message.content ?? "",
        tool_calls: message.tool_calls,
      });

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        const res: LeashChatResponse = {
          llmConfigured: true,
          reply: stripThink(message.content ?? ""),
          toolEvents,
          proposedTrade,
        };
        return NextResponse.json(res);
      }

      for (const call of calls) {
        const name = call.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch {
          args = {};
        }
        const ticker = String(args.ticker ?? "");
        const usdAmount = Number(args.usdAmount ?? 0);
        const side: TradeSide = args.side === "sell" ? "sell" : "buy";

        let result: unknown;
        if (name === "getPrice") {
          result = await toolGetPrice(origin, ticker);
        } else if (name === "getQuote") {
          result = await toolGetQuote(origin, ticker, usdAmount, side);
        } else if (name === "proposeTrade") {
          const r = await proposeTrade(origin, policy, ledger, { ticker, usdAmount, side }, userPublicKey);
          proposedTrade = r;
          result = r;
        } else {
          result = { error: `unknown tool ${name}` };
        }

        toolEvents.push({ tool: name ?? "unknown", args, result });
        wire.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(result) });
      }
    }

    const res: LeashChatResponse = {
      llmConfigured: true,
      reply: "I stopped after several tool steps without a final answer. Please rephrase and try again.",
      toolEvents,
      proposedTrade,
    };
    return NextResponse.json(res);
  } catch (e) {
    const res: LeashChatResponse = {
      llmConfigured: true,
      error: e instanceof Error ? e.message : "chat failed",
      message: "The chat agent call failed. The guardrail and the manual trade flow still work.",
      toolEvents,
      proposedTrade,
    };
    return NextResponse.json(res);
  }
}
