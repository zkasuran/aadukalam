// @aadukalam/sdk :: pyth
// Two ways to read a Pyth price, both surfaced through our /api/pyth proxy.
//
// 1. KEYLESS, on-chain (the default). Pyth keeps sponsored price-feed accounts
//    live on Solana mainnet. We derive each feed's PDA under the push-oracle
//    program and read the PriceUpdateV2 account straight off the chain over RPC,
//    no API key. This is the "best resource available" path since the 2026-08-26
//    Pyth Core upgrade put the Hermes HTTP price service behind a paid key.
// 2. KEYED Hermes HTTP (optional fast path). `hermesLatest` still works if a
//    PYTH_API_KEY is provisioned, but nothing requires it.
//
// Real human price is `price * 10^expo`; the exponent is read per update, never
// hardcoded. Feed ids are the 32-byte hex Hermes/Pyth use, with or without 0x.

import { Connection, PublicKey } from "@solana/web3.js";

export interface PythPrice {
  /** 32-byte feed id, hex, as Hermes returns it (no 0x prefix). */
  feedId: string;
  /** raw integer price. Human value is `price * 10^expo`. */
  price: number;
  /** raw confidence band, same exponent as price. */
  conf: number;
  /** price exponent, e.g. -5 for AAPL equity. Never assume it. */
  expo: number;
  /** unix seconds of the publish time. */
  publishTime: number;
}

/** Shape our `/api/pyth` proxy returns. `source` names where the prices came from. */
export interface PythProxyResponse {
  /** legacy flag, only set on the optional keyed Hermes path when no key is set. */
  keyMissing?: boolean;
  /** "onchain" for the keyless Solana read, "hermes" for the keyed HTTP path. */
  source?: "onchain" | "hermes";
  prices: PythPrice[];
  error?: string;
}

export const HERMES_BASE_URL = "https://hermes.pyth.network";

/** Thrown by `hermesLatest` when no API key is supplied. */
export class PythKeyMissingError extends Error {
  constructor(message = "PYTH_API_KEY is not configured") {
    super(message);
    this.name = "PythKeyMissingError";
  }
}

/** Human USD price of a Pyth update: `price * 10^expo`. */
export function pythHumanPrice(p: PythPrice): number {
  return p.price * 10 ** p.expo;
}

/** Human confidence band of a Pyth update, same exponent as the price. */
export function pythHumanConf(p: PythPrice): number {
  return p.conf * 10 ** p.expo;
}

interface HermesParsedPrice {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
}

interface HermesParsedItem {
  id: string;
  price: HermesParsedPrice;
  ema_price?: HermesParsedPrice;
}

interface HermesLatestResponse {
  binary?: { encoding: string; data: string[] };
  parsed?: HermesParsedItem[];
}

/**
 * SERVER helper. Calls Hermes `/v2/updates/price/latest` with the Bearer key and
 * returns parsed prices. Throws PythKeyMissingError when no key is given. A
 * plain Error carries the status on any non-200 from Hermes (401 without a key).
 * Keep this on the backend, never ship the key to the client.
 */
export async function hermesLatest(
  feedIds: string[],
  apiKey: string,
  baseUrl: string = HERMES_BASE_URL,
): Promise<PythPrice[]> {
  if (!apiKey) throw new PythKeyMissingError();
  if (feedIds.length === 0) return [];

  const params = new URLSearchParams();
  for (const id of feedIds) params.append("ids[]", id);
  params.append("parsed", "true");
  params.append("ignore_invalid_price_ids", "true");

  const res = await fetch(`${baseUrl}/v2/updates/price/latest?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hermes ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as HermesLatestResponse;
  return (json.parsed ?? []).map((item) => ({
    feedId: item.id,
    price: Number(item.price.price),
    conf: Number(item.price.conf),
    expo: item.price.expo,
    publishTime: item.price.publish_time,
  }));
}

/**
 * CLIENT function. Calls OUR proxy `/api/pyth?ids=<comma>` and returns the parsed
 * prices. Returns an empty array when the proxy reports the key is missing or the
 * upstream failed, so a caller can fall back to the Jupiter price cleanly.
 * `baseUrl` defaults to a relative path for browser use.
 */
export async function fetchPythPrices(feedIds: string[], baseUrl = ""): Promise<PythPrice[]> {
  if (feedIds.length === 0) return [];
  const url = `${baseUrl}/api/pyth?ids=${encodeURIComponent(feedIds.join(","))}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as PythProxyResponse;
  return json.prices ?? [];
}

// ---------------------------------------------------------------------------
// Keyless on-chain reader
//
// Pyth sponsored price-feed accounts live at a PDA under the PUSH-ORACLE program,
// seeds [shard (u16 LE, 2 bytes), feed_id (32 bytes)]. The account is a
// PriceUpdateV2 owned by the matching receiver program. Verified live on Solana
// mainnet 2026-09-25: US equity feeds (Equity.US.<T>/USD) are fresh on the default
// push-oracle at shard 1, crypto anchors on shard 0/1, all keyless. Program ids
// match @pythnetwork/pyth-solana-receiver's DEFAULT_/PRO_COMPATIBLE_PUSH_ORACLE.
// ---------------------------------------------------------------------------

/** Default push-oracle program (accounts owned by receiver rec5EKMG…). */
export const PYTH_PUSH_ORACLE_DEFAULT = "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT";
/** Pro-compatible push-oracle program (accounts owned by receiver rec2HHDD…). */
export const PYTH_PUSH_ORACLE_PRO = "pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou";

/**
 * Where to look for a sponsored feed, most-likely-fresh first. Equities are live
 * on the default program at shard 1; crypto anchors on shard 0; the pro program
 * shard 0 carries some tokenized-equity (xStock) feeds.
 */
export const SPONSORED_FEED_PROBES: ReadonlyArray<{ program: string; shard: number }> = [
  { program: PYTH_PUSH_ORACLE_DEFAULT, shard: 1 },
  { program: PYTH_PUSH_ORACLE_DEFAULT, shard: 0 },
  { program: PYTH_PUSH_ORACLE_PRO, shard: 0 },
];

/** Strip an optional 0x and lowercase a 32-byte feed id. */
export function normalizePythFeedId(feedId: string): string {
  return (feedId.startsWith("0x") ? feedId.slice(2) : feedId).toLowerCase();
}

/** Derive the sponsored price-feed account PDA for a feed under a push-oracle program. */
export function sponsoredFeedAddress(feedId: string, program: string, shard: number): PublicKey {
  const shardBuf = Buffer.alloc(2);
  shardBuf.writeUInt16LE(shard, 0);
  const feedBuf = Buffer.from(normalizePythFeedId(feedId), "hex");
  if (feedBuf.length !== 32) throw new Error(`feed id must be 32 bytes, got ${feedBuf.length}`);
  return PublicKey.findProgramAddressSync([shardBuf, feedBuf], new PublicKey(program))[0];
}

/**
 * Parse a PriceUpdateV2 account. The account layout carries the 32-byte feed id
 * followed by the PriceFeedMessage (price i64, conf u64, exponent i32,
 * publish_time i64). We locate the feed id in the buffer so the enum-sized
 * verification_level field between the header and the message cannot throw the
 * offsets off. Returns null when the feed id is not present in this account.
 */
export function parsePriceUpdateV2(feedId: string, data: Buffer): PythPrice | null {
  const feedBuf = Buffer.from(normalizePythFeedId(feedId), "hex");
  if (feedBuf.length !== 32) return null;
  const i = data.indexOf(feedBuf);
  if (i < 0 || i + 60 > data.length) return null;
  const price = Number(data.readBigInt64LE(i + 32));
  const conf = Number(data.readBigUInt64LE(i + 40));
  const expo = data.readInt32LE(i + 48);
  const publishTime = Number(data.readBigInt64LE(i + 52));
  if (!Number.isFinite(price) || !Number.isFinite(publishTime) || publishTime <= 0) return null;
  return { feedId: normalizePythFeedId(feedId), price, conf, expo, publishTime };
}

export interface ReadOnchainOptions {
  /** Drop any feed whose freshest update is older than this many seconds. */
  maxAgeSec?: number;
  /** Unix seconds treated as "now" for the staleness check. Defaults to Date.now(). */
  nowSec?: number;
}

/**
 * SERVER helper. Reads Pyth prices straight off Solana mainnet with no API key.
 * For every feed it derives the sponsored-feed PDAs across the known
 * program/shard combos, fetches them in batched getMultipleAccountsInfo calls,
 * and keeps the freshest valid PriceUpdateV2 per feed. A feed whose newest update
 * is older than `maxAgeSec` (when set) is dropped, so a caller falls back to
 * another reference rather than showing a stale oracle price.
 */
export async function readPythOnchainPrices(
  feedIds: string[],
  connection: Connection,
  opts: ReadOnchainOptions = {},
): Promise<PythPrice[]> {
  const feeds = [...new Set(feedIds.map(normalizePythFeedId))].filter((f) => f.length === 64);
  if (feeds.length === 0) return [];

  // One (feed, probe) candidate per address, derived up front.
  const candidates: { feed: string; address: PublicKey }[] = [];
  for (const feed of feeds) {
    for (const probe of SPONSORED_FEED_PROBES) {
      candidates.push({ feed, address: sponsoredFeedAddress(feed, probe.program, probe.shard) });
    }
  }

  const CHUNK = 100; // getMultipleAccountsInfo caps at 100 accounts per call
  const freshest = new Map<string, PythPrice>();
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const infos = await connection.getMultipleAccountsInfo(slice.map((c) => c.address));
    infos.forEach((info, k) => {
      if (!info) return;
      const parsed = parsePriceUpdateV2(slice[k].feed, info.data);
      if (!parsed) return;
      const prev = freshest.get(parsed.feedId);
      if (!prev || parsed.publishTime > prev.publishTime) freshest.set(parsed.feedId, parsed);
    });
  }

  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const out: PythPrice[] = [];
  for (const price of freshest.values()) {
    if (opts.maxAgeSec != null && nowSec - price.publishTime > opts.maxAgeSec) continue;
    out.push(price);
  }
  return out;
}
