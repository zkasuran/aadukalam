// UI state shapes for the buy flow, kept out of the pure math module. A quote is
// the live Jupiter preview for one leg. An exec tracks that leg through build,
// sign, send and confirm. Both are keyed by mint in the dashboard.

import type { JupiterQuoteResponse } from "@aadukalam/sdk";

export type QuoteStatus = "idle" | "loading" | "ok" | "error";

export interface QuoteState {
  status: QuoteStatus;
  quote?: JupiterQuoteResponse;
  error?: string;
}

export type ExecStatus =
  | "idle"
  | "building"
  | "signing"
  | "sent"
  | "confirmed"
  | "failed";

export interface ExecState {
  status: ExecStatus;
  signature?: string;
  error?: string;
}
