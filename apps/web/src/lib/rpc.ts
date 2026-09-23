import { clusterApiUrl, Connection } from "@solana/web3.js";

export type AppCluster = "devnet" | "mainnet-beta";

/** Active cluster from env. Defaults to devnet where our programs live. */
export const CLUSTER: AppCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as AppCluster) ?? "devnet";

/**
 * Resolve the RPC endpoint from env, falling back to the public cluster URL.
 * Reads NEXT_PUBLIC_SOLANA_RPC_MAINNET or NEXT_PUBLIC_SOLANA_RPC_DEVNET.
 */
export function getRpcEndpoint(): string {
  const fromEnv =
    CLUSTER === "mainnet-beta"
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET
      : process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET;
  return fromEnv ?? clusterApiUrl(CLUSTER);
}

/** Build a web3.js Connection for the active cluster. */
export function getConnection(
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Connection {
  return new Connection(getRpcEndpoint(), commitment);
}
