// Mainnet connection for broadcasting a user-signed Jupiter swap. Jupiter is
// mainnet only, while the app default points at devnet where our own programs
// live, so the Receipt trade flow builds its own mainnet Connection for the send
// and confirm step. No key is ever held here: the wallet signs, this only
// broadcasts and confirms. Local to the Receipt module so it stays self-contained.

import { clusterApiUrl, Connection } from "@solana/web3.js";

export function getMainnetConnection(): Connection {
  const url =
    process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || clusterApiUrl("mainnet-beta");
  return new Connection(url, "confirmed");
}

/** Solana Explorer link for a mainnet transaction signature. */
export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}`;
}

/** True when a real mainnet RPC is configured, false on the throttled public one. */
export function hasPrivateMainnetRpc(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET);
}
