"use client";

// Live Jupiter price poll for the Tessera ACTION layer. One poll for all Tessera
// mints (never per card), through the SDK client which hits our /api/jupiter
// proxy. This is the cheap read-only op=price call, never a swap build, so it
// stays well clear of the keyless rate limit. Keeps the last good map on a
// transient miss so the price never blanks out mid-session.

import { useEffect, useState } from "react";

import { getJupiterPrice, type JupiterPriceMap } from "@aadukalam/sdk";

const POLL_MS = 15_000;

export interface LivePrices {
  map: JupiterPriceMap;
  pricedAt: number | null;
}

export function useJupiterPrices(mints: string[]): LivePrices {
  const [state, setState] = useState<LivePrices>({ map: {}, pricedAt: null });
  // Stable key so the effect only re-subscribes when the mint set really changes.
  const key = mints.slice().sort().join(",");

  useEffect(() => {
    if (mints.length === 0) return;
    let alive = true;

    const poll = async () => {
      const prices = await getJupiterPrice(mints);
      if (!alive) return;
      if (Object.keys(prices).length === 0) return; // keep last good on a miss
      setState({ map: prices, pricedAt: Date.now() });
    };

    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
