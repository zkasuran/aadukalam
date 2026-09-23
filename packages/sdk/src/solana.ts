// @aadukalam/sdk :: solana
// Shared Solana primitives every module leans on: cluster config, common mints,
// base-unit math and explorer links. Base web3 stack is @solana/web3.js 1.x, the
// version wallet-adapter and the Anchor TS client speak. No funds move here.

import { Connection, PublicKey } from "@solana/web3.js";
import type { ParsedAccountData } from "@solana/web3.js";

export type Cluster = "mainnet-beta" | "devnet";

export interface AadukalamConfig {
  cluster: Cluster;
  rpcUrl: string;
}

export const SDK_VERSION = "0.0.0";

/** Build a config object from a cluster and an RPC url. */
export function createConfig(cluster: Cluster, rpcUrl: string): AadukalamConfig {
  return { cluster, rpcUrl };
}

/** Lamports per SOL. */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Common quote mints, verified live in .hq/research/jupiter.md. Decimals are the
 * on-chain decimals, needed to turn a human amount into raw base units for a quote.
 */
export const COMMON_MINTS = {
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  WSOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
} as const;

/**
 * Turn a human amount into raw integer base units for a given decimals, returned
 * as a string so a large value never loses precision. Jupiter always wants raw
 * base units for the `amount` param. Rounds to the mint's decimals.
 */
export function toBaseUnits(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "0";
  const fixed = amount.toFixed(decimals);
  const [whole, frac = ""] = fixed.split(".");
  const raw = `${whole}${frac}`.replace(/^0+(?=\d)/, "");
  return raw === "" ? "0" : raw;
}

/** Turn raw base units back into a human number for display. */
export function fromBaseUnits(raw: string | number | bigint, decimals: number): number {
  const asNumber = typeof raw === "bigint" ? Number(raw) : Number(raw);
  if (!Number.isFinite(asNumber)) return 0;
  return asNumber / 10 ** decimals;
}

/** Lamports to SOL. */
export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/** SOL to whole lamports. */
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/** Short "abcd…wxyz" form of an address for compact display. */
export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

function clusterQuery(cluster: Cluster): string {
  return cluster === "devnet" ? "?cluster=devnet" : "";
}

/** Solana Explorer link for a transaction signature. */
export function explorerTxUrl(signature: string, cluster: Cluster = "mainnet-beta"): string {
  return `https://explorer.solana.com/tx/${signature}${clusterQuery(cluster)}`;
}

/** Solana Explorer link for an address. */
export function explorerAddressUrl(address: string, cluster: Cluster = "mainnet-beta"): string {
  return `https://explorer.solana.com/address/${address}${clusterQuery(cluster)}`;
}

/** True when the string parses as a valid base58 Solana public key. */
export function isValidSolanaAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/** SPL Token and Token-2022 program ids. Every tokenized stock in the registry is Token-2022. */
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/** Make a Connection with a sensible commitment. */
export function getConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, "confirmed");
}

/** One parsed token balance held by an owner. */
export interface TokenBalance {
  mint: string;
  /** raw integer base units as a string */
  amount: string;
  decimals: number;
  /** UI amount as the RPC reports it, Token-2022 scaled UI already applied */
  uiAmount: number;
  programId: string;
}

/** Read a wallet's SPL and Token-2022 balances with one parsed RPC call each. Skips zero balances. */
export async function getTokenBalances(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenBalance[]> {
  const programs = [
    new PublicKey(TOKEN_PROGRAM_ID),
    new PublicKey(TOKEN_2022_PROGRAM_ID),
  ];
  const out: TokenBalance[] = [];
  for (const programId of programs) {
    const res = await connection.getParsedTokenAccountsByOwner(owner, { programId });
    for (const { account } of res.value) {
      const info = (account.data as ParsedAccountData).parsed?.info;
      const ta = info?.tokenAmount;
      if (!ta || ta.amount === "0") continue;
      out.push({
        mint: info.mint,
        amount: ta.amount,
        decimals: ta.decimals,
        uiAmount: ta.uiAmount ?? 0,
        programId: programId.toBase58(),
      });
    }
  }
  return out;
}
