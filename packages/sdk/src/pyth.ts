// @aadukalam/sdk :: pyth
// Pyth Hermes price client. Since the 2026-08-26 Pyth Core upgrade, Hermes live
// price reads need an API key sent as `Authorization: Bearer $PYTH_API_KEY`
// (feed metadata stays key-free). The key lives server-side only. The browser
// calls OUR proxy `/api/pyth`, the proxy calls Hermes with the key. Real human
// price is `price * 10^expo` and the exponent is read per update, never hardcoded.

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

/** Shape our `/api/pyth` proxy returns. `keyMissing` drives the UI fallback. */
export interface PythProxyResponse {
  keyMissing?: boolean;
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
