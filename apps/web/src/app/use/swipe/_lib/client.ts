// Swipe client helpers. Everything here is browser-safe classic web3.js v1: the
// wallet stack speaks v1. The Kamino v2 (kit) work lives entirely behind the
// api/kamino/* routes, which this file only calls over fetch. The single shared
// import is the pure kamino.ts (types and math, no SDK), safe in the client bundle.

import { Connection, VersionedTransaction, clusterApiUrl } from "@solana/web3.js";

import type {
  BorrowMode,
  BuildBorrowResponse,
  QuoteBorrowResponse,
  ReservesResponse,
} from "@/app/api/kamino/_lib/kamino";

/** Mainnet connection for sending the borrow transaction. Kamino is mainnet only,
 * so this ignores the app cluster (which defaults to devnet for our own programs)
 * and reads the mainnet RPC from env with a public fallback. */
export function getMainnetConnection(): Connection {
  const url =
    process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET && process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET.length > 0
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET
      : clusterApiUrl("mainnet-beta");
  return new Connection(url, "confirmed");
}

export async function fetchReserves(signal?: AbortSignal): Promise<ReservesResponse> {
  const res = await fetch("/api/kamino/reserves", { cache: "no-store", signal });
  return (await res.json()) as ReservesResponse;
}

export interface QuoteArgs {
  collateralMint: string;
  collateralAmount: number;
  spendUsdc: number;
  mode: BorrowMode;
}

export async function fetchQuote(args: QuoteArgs, signal?: AbortSignal): Promise<QuoteBorrowResponse> {
  const res = await fetch("/api/kamino/quote-borrow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal,
  });
  return (await res.json()) as QuoteBorrowResponse;
}

export interface BuildArgs extends QuoteArgs {
  owner: string;
}

export async function fetchBuild(args: BuildArgs): Promise<BuildBorrowResponse> {
  const res = await fetch("/api/kamino/build-borrow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  return (await res.json()) as BuildBorrowResponse;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Deserialize the base64 v0 transaction the route built into a web3.js v1
 * VersionedTransaction. The wallet signs it. */
export function deserializeTx(base64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(base64ToBytes(base64));
}
