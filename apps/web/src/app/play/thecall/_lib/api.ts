// The Call: browser-side fetchers for the two Pyth reads the module needs. The
// live price for the price-vs-target display and the signed price update blob
// for the on-chain resolve. Both go through our server routes so the Pyth key
// stays on the backend and both degrade to an honest "no live price" state
// when no key is configured.

import type { PythProxyResponse } from "@aadukalam/sdk";
import { pythHumanPrice, pythHumanConf } from "@aadukalam/sdk";

import { normalizeFeedHex } from "./program";
import type { LivePriceState } from "./types";

/** Fetch one feed's live price through the keyed proxy, as a UI state. */
export async function fetchLivePrice(feedHex: string): Promise<LivePriceState> {
  const feed = normalizeFeedHex(feedHex);
  const empty: LivePriceState = {
    priceUsd: null,
    confUsd: null,
    expo: null,
    publishTime: null,
    keyMissing: false,
    source: "none",
  };
  try {
    const res = await fetch(`/api/pyth?ids=${encodeURIComponent(feed)}`);
    if (!res.ok) return empty;
    const json = (await res.json()) as PythProxyResponse;
    if (json.keyMissing) return { ...empty, keyMissing: true };
    const p = json.prices?.[0];
    if (!p) return empty;
    return {
      priceUsd: pythHumanPrice(p),
      confUsd: pythHumanConf(p),
      expo: p.expo,
      publishTime: p.publishTime,
      keyMissing: false,
      source: "pyth",
    };
  } catch {
    return empty;
  }
}

export interface PriceUpdateData {
  keyMissing: boolean;
  /** hex VAA blobs to post on-chain */
  vaa: string[];
  /** parsed price for a settle-value preview */
  parsed: { id: string; price: { price: string; expo: number; publish_time: number } }[];
  error?: string;
}

/** Fetch the signed price update blob for a feed, for the resolve transaction. */
export async function fetchPriceUpdateData(feedHex: string): Promise<PriceUpdateData> {
  const feed = normalizeFeedHex(feedHex);
  const res = await fetch(`/api/thecall/price-update?feed=${encodeURIComponent(feed)}`);
  const json = (await res.json()) as Partial<PriceUpdateData> & { keyMissing?: boolean };
  return {
    keyMissing: Boolean(json.keyMissing),
    vaa: json.vaa ?? [],
    parsed: json.parsed ?? [],
    error: json.error,
  };
}
