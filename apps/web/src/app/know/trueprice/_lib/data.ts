// Client-side data orchestration for TruePrice. Batches the live Jupiter price
// reads under the 50-mint cap, probes our keyed Pyth proxy once to learn whether
// a key is configured and only spends the Pyth batch calls when it is. Every
// call goes through OUR server proxies (/api/jupiter, /api/pyth), never straight
// to an upstream, so no key touches the browser. Falls back cleanly: a missing
// Pyth key leaves pythFair null and the UI labels it unavailable.

import {
  fetchPythPrices,
  getJupiterPrice,
  pythHumanPrice,
  type JupiterPriceMap,
  type PythPrice,
} from "@aadukalam/sdk";
import { bestPythFeed } from "@aadukalam/data";

import { buildRow, truePriceTokens, type TruePriceRow } from "./trueprice";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TruePriceSnapshot {
  rows: TruePriceRow[];
  /** true when /api/pyth reports no key, so Pyth fair value is unavailable. */
  pythKeyMissing: boolean;
  /** true when at least one Jupiter price came back. */
  jupiterOk: boolean;
  fetchedAt: number;
}

/**
 * Ask the Pyth proxy whether a key is configured. Sends empty ids so it costs no
 * upstream call. Any proxy failure is treated as "no live Pyth" so the UI errs
 * toward the honest fallback rather than a promise of data it cannot show.
 */
export async function probePythKey(baseUrl = ""): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/pyth?ids=`, { cache: "no-store" });
    if (!res.ok) return true;
    const json = (await res.json()) as { keyMissing?: boolean };
    return json?.keyMissing === true;
  } catch {
    return true;
  }
}

/** Load one full snapshot: every qualifying token priced from the live APIs. */
export async function loadSnapshot(baseUrl = ""): Promise<TruePriceSnapshot> {
  const tokens = truePriceTokens();
  const mints = tokens.map((t) => t.mint);

  const jupMap: JupiterPriceMap = {};
  let jupiterOk = false;
  const jupChunks = chunk(mints, 45);
  for (let i = 0; i < jupChunks.length; i++) {
    if (i > 0) await sleep(1500); // keyless Jupiter is 0.5 RPS, space the batches
    const m = await getJupiterPrice(jupChunks[i], baseUrl);
    if (Object.keys(m).length > 0) jupiterOk = true;
    Object.assign(jupMap, m);
  }

  const pythKeyMissing = await probePythKey(baseUrl);
  const pythByFeed = new Map<string, PythPrice>();
  if (!pythKeyMissing) {
    const feeds = [...new Set(tokens.map((t) => bestPythFeed(t)).filter((f): f is string => !!f))];
    const feedChunks = chunk(feeds, 45);
    for (let i = 0; i < feedChunks.length; i++) {
      if (i > 0) await sleep(1000);
      const prices = await fetchPythPrices(feedChunks[i], baseUrl);
      for (const p of prices) pythByFeed.set(p.feedId, p);
    }
  }

  const rows = tokens.map((t) => {
    const feed = bestPythFeed(t);
    const pyth = feed ? pythByFeed.get(feed) : undefined;
    return buildRow(t, jupMap[t.mint], pyth);
  });

  return { rows, pythKeyMissing, jupiterOk, fetchedAt: Date.now() };
}

export interface TickerSample {
  dex: number | null;
  underlying: number | null;
  pyth: number | null;
  change24h: number | null;
}

/**
 * One live read for a single ticker, used by the detail chart to accumulate a
 * real sampled series. Skips the Pyth call when the key is missing.
 */
export async function sampleTicker(
  mint: string,
  feed: string | null,
  pythKeyMissing: boolean,
  baseUrl = "",
): Promise<TickerSample> {
  const map = await getJupiterPrice([mint], baseUrl);
  const info = map[mint];
  const dex = info && Number.isFinite(info.usdPrice) ? info.usdPrice : null;
  const underlying =
    info?.stockData && Number.isFinite(info.stockData.price) ? info.stockData.price : null;
  const change24h =
    info && info.priceChange24h != null && Number.isFinite(info.priceChange24h)
      ? info.priceChange24h
      : null;

  let pyth: number | null = null;
  if (!pythKeyMissing && feed) {
    const prices = await fetchPythPrices([feed], baseUrl);
    if (prices[0]) {
      const human = pythHumanPrice(prices[0]);
      pyth = Number.isFinite(human) ? human : null;
    }
  }

  return { dex, underlying, pyth, change24h };
}
