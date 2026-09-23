// Mainnet connection for signing Jupiter swaps. Jupiter is mainnet only, while
// the app's default connection points at devnet where our own programs live, so
// Conviction builds its own mainnet Connection for the send and confirm step.
// No key is ever held here: the wallet signs, this only broadcasts.

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
