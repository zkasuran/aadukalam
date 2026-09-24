// The live devnet Meteora DBC pool this project actually created, plus the
// helpers the Opening Bell page uses to read it on-chain. The addresses here
// were written by scripts/seed-openingbell.mjs after a real create-config-and-pool
// transaction on devnet (see .hq/devnet-demo.json under openingBell).
// This is a test token on devnet, no real value.
// House style: no em dashes, no comma before "and" or "or".
import { Connection, PublicKey } from "@solana/web3.js";
// BN comes through anchor so it carries a resolvable type without @types/bn.js.
import { BN } from "@coral-xyz/anchor";

import { createDbcClient, priceFromSqrt, buildPreviewCurve, type CurvePoint } from "./dbc";
import { getPreset, type PresetId, type SupportedDecimal } from "./presets";

export interface LivePoolMeta {
  /** DBC virtual pool account */
  pool: string;
  /** pool config account created for this launch */
  config: string;
  /** the new base token mint (AOBD) minted by the launch */
  baseMint: string;
  /** settlement mint the pool trades against */
  quoteMint: string;
  quoteSymbol: string;
  quoteDecimals: SupportedDecimal;
  /** on-chain migration (graduation) threshold in raw quote units */
  migrationQuoteThreshold: string;
  baseSymbol: string;
  baseName: string;
  baseDecimals: SupportedDecimal;
  presetId: PresetId;
  cluster: "devnet";
  rpc: string;
  /** create-config-and-pool signature */
  signature: string;
  seededAt: string;
}

// Recorded by scripts/seed-openingbell.mjs on 2026-09-24. Stock-paired, no
// fallback: the quote is the devnet test stock mint, not WSOL.
export const LIVE_POOL: LivePoolMeta = {
  pool: "6A4U73FA4URnUFZMPANuknVhBaSYfxppHSmwhazb9H2a",
  config: "2FzYwV1W8U4UWqwKeNTY18FW98nRSSCixWgLvZfSS51M",
  baseMint: "Avz1Gf1haNhWnGNMVhh48wEdTzweELYtKB6muF8V2MPU",
  quoteMint: "9z4aUKCSirSorBCc81EvhWmnm5Y47L8tZR8ZNRE1k5u4",
  quoteSymbol: "AADU-DEMO-STOCK",
  quoteDecimals: 8,
  migrationQuoteThreshold: "10951122271423",
  baseSymbol: "AOBD",
  baseName: "Aadukalam Opening Bell Demo",
  baseDecimals: 6,
  presetId: "blue-chip",
  cluster: "devnet",
  rpc: "https://api.devnet.solana.com",
  signature:
    "jNXnunWNmzF9KwtagpB7nBN3z7SVVrW8u2W4e6m68MK6gPrnMj2BdY6jk5k2H1S2mRtHjCyvRn1BJhk5dxHQoMA",
  seededAt: "2026-09-24T02:10:26.598Z",
};

/** Solana explorer link for an address on the pool's cluster. */
export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${LIVE_POOL.cluster}`;
}

/** Solana explorer link for a transaction on the pool's cluster. */
export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${LIVE_POOL.cluster}`;
}

const TEN = new BN(10);

function toHuman(amount: BN, decimals: number): number {
  const base = TEN.pow(new BN(decimals));
  const whole = amount.div(base).toNumber();
  const frac = amount.mod(base).toNumber() / base.toNumber();
  return whole + frac;
}

export interface LivePoolSnapshot {
  /** auction progress 0..1 from getPoolQuoteTokenCurveProgress */
  progress: number;
  /** current spot price, quote per base, from the live sqrt price */
  price: number;
  /** quote raised so far, human units (live quote reserve) */
  quoteRaised: number;
  /** whether the pool has already graduated to DAMM v2 */
  isMigrated: boolean;
  fetchedAt: number;
}

// VirtualPool account byte layout (SDK 1.5.12), verified against the live pool:
//   0    8-byte account discriminator (d5e005d16245775c)
//   240  quoteReserve   u64 little-endian
//   280  sqrtPrice      u128 little-endian (Q64.64)
//   305  isMigrated     u8
// We decode the raw account ourselves instead of the SDK's Anchor account
// coder. The coder resolves to the app's pinned anchor when Next bundles it,
// and its discriminator check throws "Invalid account discriminator" in the
// browser even though the account is valid. Raw byte reads are version and
// bundler independent, so the same numbers land in Node and the browser.
const POOL_DISCRIMINATOR = "d5e005d16245775c";
const OFF_QUOTE_RESERVE = 240;
const OFF_SQRT_PRICE = 280;
const OFF_IS_MIGRATED = 305;

/** Read the live pool state from devnet. Fresh Connection so it never depends
 * on the app cluster: this pool only exists on devnet. */
export async function fetchLivePoolSnapshot(): Promise<LivePoolSnapshot> {
  const connection = new Connection(LIVE_POOL.rpc, "confirmed");
  const info = await connection.getAccountInfo(new PublicKey(LIVE_POOL.pool));
  if (!info) {
    throw new Error(`pool ${LIVE_POOL.pool} not found on devnet`);
  }
  const data = info.data;
  if (data.subarray(0, 8).toString("hex") !== POOL_DISCRIMINATOR) {
    throw new Error("unexpected pool account discriminator");
  }

  const quoteReserve = new BN(data.subarray(OFF_QUOTE_RESERVE, OFF_QUOTE_RESERVE + 8), "le");
  const sqrtPrice = new BN(data.subarray(OFF_SQRT_PRICE, OFF_SQRT_PRICE + 16), "le");
  const threshold = new BN(LIVE_POOL.migrationQuoteThreshold);

  const progress = threshold.isZero()
    ? 0
    : Number(quoteReserve.toString()) / Number(threshold.toString());

  return {
    progress: Math.max(0, Math.min(progress, 1)),
    price: priceFromSqrt(sqrtPrice, LIVE_POOL.baseDecimals, LIVE_POOL.quoteDecimals),
    quoteRaised: toHuman(quoteReserve, LIVE_POOL.quoteDecimals),
    isMigrated: data[OFF_IS_MIGRATED] !== 0,
    fetchedAt: Date.now(),
  };
}

/** The curve preview for the live pool's own preset, so the chart matches the
 * config that created it. Same SDK quote math as the pre-launch preview. */
export function livePoolCurve(connection: Connection): CurvePoint[] {
  const preset = getPreset(LIVE_POOL.presetId);
  const config = preset.build({
    quoteDecimals: LIVE_POOL.quoteDecimals,
    baseDecimals: LIVE_POOL.baseDecimals,
  });
  const client = createDbcClient(connection);
  return buildPreviewCurve(
    client,
    config,
    LIVE_POOL.baseDecimals,
    LIVE_POOL.quoteDecimals,
    40
  );
}
