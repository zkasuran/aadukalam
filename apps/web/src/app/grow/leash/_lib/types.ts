// Shared types for the Leash chat protocol and the proposed-trade card. These
// cross the client and server boundary: the page posts a LeashChatRequest to
// api/leash/chat and renders the LeashChatResponse. The wire message shape for
// MiniMax stays inside the route.

import type { GuardrailPolicy, GuardrailVerdict, TradeSide } from "./guardrail";

/** One turn shown in the chat panel and replayed to the model. */
export interface UiMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Session ledger the client keeps and sends with every request. These are not
 * on-chain reads, they are what Leash has proposed and the user has approved in
 * this session, so the daily budget and max position checks have real numbers to
 * work against in a demo. The UI labels them as a session ledger.
 */
export interface SessionLedger {
  /** USD bought so far today, against the daily budget. */
  spentTodayUsd: number;
  /** USD held per ticker (lower-cased ticker key), against the max position. */
  positionsUsd: Record<string, number>;
}

export interface LeashChatRequest {
  messages: UiMessage[];
  policy: GuardrailPolicy;
  ledger: SessionLedger;
  /** connected wallet, needed only to build the swap tx the user signs. */
  userPublicKey?: string;
}

/** One tool the model called, with its arguments and the result, for the trace. */
export interface ToolEvent {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

/** A route summary of a Jupiter quote, human units. */
export interface QuoteSummary {
  inputMint: string;
  outputMint: string;
  /** USD spent (buy) or received target (sell). */
  usd: number;
  /** estimated output in human units (shares for a buy, USDC for a sell). */
  estOut: number;
  estOutLabel: string;
  priceImpactPct: number | null;
  slippageBps: number;
  route: string | null;
}

/** The proposed-trade card payload. The heart of it is the guardrail verdict. */
export interface ProposedTradeResult {
  ticker: string;
  mint: string;
  side: TradeSide;
  usdAmount: number;
  /** the guardrail decision. When allowed is false, no tx was built. */
  verdict: GuardrailVerdict;
  quote?: QuoteSummary;
  /** base64 v0 transaction for the user to sign. Never signed on the server. */
  tx?: { swapTransaction: string; lastValidBlockHeight: number };
  /** allowed but no wallet was connected to build the tx. */
  needsWallet?: boolean;
  /** allowed but the quote or build failed. */
  buildError?: string;
}

export interface LeashChatResponse {
  /** false when MINIMAX_API_KEY is unset. The tools and guardrail still demo. */
  llmConfigured: boolean;
  reply?: string;
  /** set when llmConfigured is false or the upstream call failed. */
  error?: string;
  message?: string;
  toolEvents: ToolEvent[];
  proposedTrade?: ProposedTradeResult;
}

export type { GuardrailPolicy, GuardrailVerdict, TradeSide };
