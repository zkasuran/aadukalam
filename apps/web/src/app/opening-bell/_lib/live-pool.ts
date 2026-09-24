// The live devnet Meteora DBC pool this project actually created, plus the
// helpers the Opening Bell page uses to read it on-chain. The addresses here
// were written by scripts/seed-openingbell.mjs after a real create-config-and-pool
// transaction on devnet (see .hq/devnet-demo.json under openingBell).
// This is a test token on devnet, no real value.
// House style: no em dashes, no comma before "and" or "or".
import { Connection } from "@solana/web3.js";
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

// The pool account is decoded by the SDK under a poolState wrapper. Read the
// verified runtime shape rather than the IDL account type.
interface RawPoolState {
  poolState: {
    sqrtPrice: BN;
    quoteReserve: BN;
    baseReserve: BN;
    isMigrated: number | boolean;
  };
}

/** Read the live pool state from devnet. Fresh Connection so it never depends
 * on the app cluster: this pool only exists on devnet. */
export async function fetchLivePoolSnapshot(): Promise<LivePoolSnapshot> {
  const connection = new Connection(LIVE_POOL.rpc, "confirmed");
  const client = createDbcClient(connection);

  const progress = await client.state.getPoolQuoteTokenCurveProgress(LIVE_POOL.pool);
  const virtualPool = (await client.state.getPool(LIVE_POOL.pool)) as unknown as
    | RawPoolState
    | null;
  if (!virtualPool) {
    throw new Error(`pool ${LIVE_POOL.pool} not found on devnet`);
  }
  const ps = virtualPool.poolState;
  return {
    progress: Math.max(0, Math.min(progress, 1)),
    price: priceFromSqrt(ps.sqrtPrice, LIVE_POOL.baseDecimals, LIVE_POOL.quoteDecimals),
    quoteRaised: toHuman(ps.quoteReserve, LIVE_POOL.quoteDecimals),
    isMigrated: Boolean(ps.isMigrated),
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
