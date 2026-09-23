// Fine Print client-side fetch to the holdings route. Keeps the network shape in
// one typed place. House style: no em dashes, no comma before "and" or "or".

import type { HoldingBalance } from "./types";

export interface HoldingsResponse {
  address: string;
  cluster: string;
  count: number;
  balances: HoldingBalance[];
}

/** Ask the server route for a wallet's on-chain balances. Throws on a non-200. */
export async function fetchHoldings(address: string, signal?: AbortSignal): Promise<HoldingsResponse> {
  const res = await fetch(`/api/fineprint/holdings?address=${encodeURIComponent(address)}`, {
    signal,
    cache: "no-store",
  });
  const body = (await res.json()) as HoldingsResponse | { error: string };
  if (!res.ok || "error" in body) {
    const message = "error" in body ? body.error : `request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}
