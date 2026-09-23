// The Paycheck on-chain client. Builds a typed anchor Program from a wallet and a
// devnet connection, checks the program is actually deployed, then reads the
// config and position accounts. Every write goes through the connected wallet in
// the components: nothing here signs or holds a key.

import * as anchor from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getMint } from "@solana/spl-token";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

import { USDC_DECIMALS } from "./constants";
import idl from "./idl/paycheck.json";
import type { Paycheck } from "./idl/paycheck";
import { deriveConfigPda, derivePositionPda } from "./pdas";
import type { ConfigView, PositionView } from "./types";

// The program id lives in the IDL, as the author specified.
export const PAYCHECK_PROGRAM_ID = new PublicKey(
  (idl as { address: string }).address,
);

export type PaycheckProgram = anchor.Program<Paycheck>;

/**
 * A devnet connection, where our programs live. Reads NEXT_PUBLIC_SOLANA_RPC_DEVNET
 * and falls back to the public devnet RPC. Pinned to devnet regardless of the
 * app's active cluster, so Paycheck always talks to the right chain.
 */
export function getDevnetConnection(): Connection {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET || clusterApiUrl("devnet");
  return new Connection(url, "confirmed");
}

// A read-only wallet for account fetches and the deployment check when no wallet
// is connected. It never signs and never sends: a read only needs a provider
// shell around the connection.
const READONLY_WALLET: AnchorWallet = {
  publicKey: PublicKey.default,
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
};

function buildProgram(
  connection: Connection,
  wallet: AnchorWallet,
): PaycheckProgram {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new anchor.Program<Paycheck>(idl, provider);
}

/** A program bound to the connected wallet, for signing deposits, rebases and claims. */
export function getPaycheckProgram(
  connection: Connection,
  wallet: AnchorWallet,
): PaycheckProgram {
  return buildProgram(connection, wallet);
}

/** A read-only program for account fetches and the deployment check. */
export function getReadonlyProgram(connection: Connection): PaycheckProgram {
  return buildProgram(connection, READONLY_WALLET);
}

/** True when the program account exists on this cluster and is executable. */
export async function isProgramDeployed(connection: Connection): Promise<boolean> {
  const info = await connection.getAccountInfo(PAYCHECK_PROGRAM_ID);
  return info !== null && info.executable;
}

/** Read the config PDA. Null when the program is not initialized yet. */
export async function fetchConfig(
  program: PaycheckProgram,
): Promise<ConfigView | null> {
  const [configPda] = deriveConfigPda(program.programId);
  try {
    const config = await program.account.config.fetch(configPda);
    let usdcDecimals = USDC_DECIMALS;
    try {
      const mint = await getMint(program.provider.connection, config.usdcMint);
      usdcDecimals = mint.decimals;
    } catch {
      // Fall back to the 6-decimal USDC default if the mint read fails.
    }
    return {
      admin: config.admin.toBase58(),
      keeper: config.keeper.toBase58(),
      usdcMint: config.usdcMint.toBase58(),
      usdcDecimals,
    };
  } catch {
    return null;
  }
}

/** Read a holder's position. Null when they have not deposited this mint. */
export async function fetchPosition(
  program: PaycheckProgram,
  owner: PublicKey,
  stockMint: PublicKey,
): Promise<PositionView | null> {
  const [positionPda] = derivePositionPda(program.programId, owner, stockMint);
  try {
    const position = await program.account.userPosition.fetch(positionPda);
    let stockDecimals = 0;
    try {
      const mint = await getMint(program.provider.connection, stockMint);
      stockDecimals = mint.decimals;
    } catch {
      // Unknown decimals: keep 0 so the UI shows raw base units rather than a guess.
    }
    return {
      owner: position.owner.toBase58(),
      stockMint: position.depositedStockMint.toBase58(),
      principalBaseUnits: BigInt(position.principal.toString()),
      claimableUsdcBaseUnits: BigInt(position.claimableUsdc.toString()),
      lastMultiplierBps: Number(position.lastMultiplierBps.toString()),
      stockDecimals,
    };
  } catch {
    return null;
  }
}

/** Read a mint's decimals. Null if the mint account is missing on this cluster. */
export async function fetchMintDecimals(
  connection: Connection,
  mint: PublicKey,
): Promise<number | null> {
  try {
    const info = await getMint(connection, mint);
    return info.decimals;
  } catch {
    return null;
  }
}

/** A human-readable message from an anchor, web3 or plain error. */
export function describeError(err: unknown): string {
  if (err instanceof anchor.AnchorError) {
    return err.error.errorMessage || err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Parse a base58 string into a PublicKey. Null if it is not one. */
export function toPublicKey(value: string): PublicKey | null {
  try {
    return new PublicKey(value.trim());
  } catch {
    return null;
  }
}
