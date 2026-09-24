"use client";

// Tiny watchlist store for the Tessera ACTION layer. Persists a set of watched
// keys ("tessera:<mint>") to localStorage and keeps every card in sync through a
// module-level subscriber list plus the cross-tab storage event. No network, no
// account, no private data: it lives entirely in the browser and only drives
// attention back to the token. useSyncExternalStore keeps it SSR-safe.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "aadukalam.receipt.watchlist";

let current: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let hydrated = false;

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function persist(next: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Ignore quota or privacy-mode failures; the in-memory set still works.
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  current = read();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      current = read();
      for (const l of listeners) l();
    }
  });
}

/** Storage key for a provider row. Watchlist is Tessera-only in the UI, but the
 * key carries the provider so it can never collide with a same-company mint. */
export function watchKey(provider: string, mint: string): string {
  return `${provider}:${mint}`;
}

function subscribe(cb: () => void): () => void {
  ensureHydrated();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot(): ReadonlySet<string> {
  return current;
}

const SERVER_SNAPSHOT: ReadonlySet<string> = new Set();

export function toggleWatch(key: string) {
  ensureHydrated();
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  current = next;
  persist(next);
  for (const l of listeners) l();
}

/** The whole watched set, live across every card and tab. */
export function useWatchlist(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
}

/** Watched state plus a toggle for one row. */
export function useWatch(key: string): {
  watched: boolean;
  toggle: () => void;
} {
  const set = useWatchlist();
  const toggle = useCallback(() => toggleWatch(key), [key]);
  return { watched: set.has(key), toggle };
}
