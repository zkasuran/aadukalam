import { NextResponse } from "next/server";

import type { ReceiptResponse } from "@/app/know/receipt/_lib/types";
import {
  normalizePreStocks,
  type VolumeContext,
} from "@/app/know/receipt/_lib/prestocksNormalize";

// PreStocks provider route. Reads /api/prestocks for the product list and
// /api/stats for daily volume then returns normalized ReceiptRow[] tagged
// provider "prestocks". PreStocks exposes price and valuation but NO backing
// proof: no proof of reserve, no attestation, no audit, no SPV holdings count.
// That absence is the product, so we render it as a hard "unverified" state and
// never invent a proof field.
//
// Kept strictly separate from the Tessera route: this file never touches a
// Tessera endpoint or mint, so the PreStocks bounty surface reads PreStocks only.
// KALSHI, OPENAI and SPACEX names collide with Tessera, so rows are never merged
// or deduped by company.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://prestocks.com/api";

interface PreStocksStats {
  volume: Array<Record<string, number | string>>;
}

let cache: ReceiptResponse | null = null;

async function getJSON<T>(path: string, tries = 3): Promise<T> {
  let last = "no attempt";
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      const res = await fetch(`${BASE}${path}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return (await res.json()) as T;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw new Error(`prestocks ${path} failed: ${last}`);
}

// Latest daily volume per symbol from /api/stats. Raw units as PreStocks reports
// them, surfaced as context and labeled, never asserted as dollar liquidity.
function latestVolume(stats: PreStocksStats | null): VolumeContext {
  if (!stats || !Array.isArray(stats.volume) || stats.volume.length === 0) {
    return { date: null, bySymbol: {} };
  }
  const row = stats.volume[stats.volume.length - 1];
  const bySymbol: Record<string, number> = {};
  let date: string | null = null;
  for (const [key, value] of Object.entries(row)) {
    if (key === "date") {
      date = typeof value === "string" ? value : null;
    } else if (typeof value === "number") {
      bySymbol[key] = value;
    }
  }
  return { date, bySymbol };
}

export async function GET() {
  try {
    const [products, stats] = await Promise.all([
      getJSON<unknown>("/prestocks"),
      getJSON<PreStocksStats>("/stats").catch(() => null),
    ]);

    const vol = latestVolume(stats);
    const rows = normalizePreStocks(products, vol);

    cache = {
      provider: "prestocks",
      rows,
      fetchedAt: new Date().toISOString(),
      stale: false,
      source: BASE,
    };
    return NextResponse.json(cache);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (cache) {
      return NextResponse.json({ ...cache, stale: true });
    }
    const body: ReceiptResponse = {
      provider: "prestocks",
      rows: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      source: BASE,
      error: `Could not reach PreStocks: ${message}`,
    };
    return NextResponse.json(body, { status: 200 });
  }
}
