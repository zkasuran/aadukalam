// @aadukalam/sdk
// Shared client SDK. Placeholder surface for the foundation. Module agents
// replace the bodies with the real Pyth, Jupiter, Kamino and Anchor clients.

export type Cluster = "mainnet-beta" | "devnet";

export interface AadukalamConfig {
  cluster: Cluster;
  rpcUrl: string;
}

export const SDK_VERSION = "0.0.0";

/**
 * Build a config object from a cluster and an RPC url. Placeholder for now.
 */
export function createConfig(cluster: Cluster, rpcUrl: string): AadukalamConfig {
  return { cluster, rpcUrl };
}
