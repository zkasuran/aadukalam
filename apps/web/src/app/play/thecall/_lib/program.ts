// The Call: Anchor program wiring. Builds a typed Program from the copied IDL on
// a devnet connection, with a read-only provider when no wallet is connected so
// market reads work before sign-in. Decode helpers turn the on-chain account
// shapes into the plain UI view models in types.ts.

import { AnchorProvider, BN, Program, type Wallet } from "@coral-xyz/anchor";
import { type Connection, PublicKey } from "@solana/web3.js";
import { getToken, loadTokens, type TokenInfo } from "@aadukalam/data";

import idlJson from "./idl/thecall.json";
import type { Thecall } from "./idl/thecall";
import { SYSTEM_PROGRAM_ID } from "./constants";
import { marketPhase } from "./math";
import type { MarketView } from "./types";

/** Minimal wallet shape a connected browser wallet satisfies. */
export interface SignerWallet {
  publicKey: PublicKey;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
}

const DUMMY_KEY = new PublicKey(SYSTEM_PROGRAM_ID);

/** A provider wallet that cannot sign, used only for public account reads. */
function readonlyWallet(): SignerWallet {
  const reject = async (): Promise<never> => {
    throw new Error("read-only wallet cannot sign, connect a wallet first");
  };
  return { publicKey: DUMMY_KEY, signTransaction: reject, signAllTransactions: reject };
}

/**
 * Build the typed Program. Pass the connected wallet to sign or omit it for a
 * read-only client that can still fetch markets and build instructions.
 */
export function getProgram(connection: Connection, wallet?: SignerWallet): Program<Thecall> {
  const provider = new AnchorProvider(
    connection,
    (wallet ?? readonlyWallet()) as unknown as Wallet,
    { commitment: "confirmed" },
  );
  return new Program(idlJson as unknown as Thecall, provider);
}

/** BN or bigint to bigint, tolerant of the anchor BN return type. */
export function toBigInt(v: BN | bigint | number | string): bigint {
  if (typeof v === "bigint") return v;
  if (v instanceof BN) return BigInt(v.toString());
  return BigInt(v);
}

/** 32 raw bytes to a 64-char lowercase hex string, no 0x. */
export function bytesToHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Strip an optional 0x and lowercase a feed id for matching and passing on. */
export function normalizeFeedHex(hex: string): string {
  return hex.trim().replace(/^0x/i, "").toLowerCase();
}

let feedIndex: Map<string, TokenInfo> | null = null;

/** Match a feed id to the registry token that carries it, across all three feeds. */
export function tokenByFeed(feedHex: string): TokenInfo | undefined {
  if (!feedIndex) {
    feedIndex = new Map();
    for (const t of loadTokens()) {
      for (const f of [t.pythFeedId, t.pythEquityFeedId, t.pythOndoFeedId]) {
        if (f) feedIndex.set(normalizeFeedHex(f), t);
      }
    }
  }
  return feedIndex.get(normalizeFeedHex(feedHex));
}

/** Decode a raw market account plus its address into a UI view model. */
export function decodeMarket(
  address: PublicKey,
  // the anchor-decoded account, typed loosely because the IDL account type is verbose
  acct: {
    creator: PublicKey;
    pythFeedId: number[] | Uint8Array;
    targetPrice: BN;
    expo: number;
    deadline: BN;
    resolved: boolean;
    winningSide: number;
    totalYes: BN;
    totalNo: BN;
    usdcMint: PublicKey;
    marketId: BN;
  },
  nowSec: number = Math.floor(Date.now() / 1000),
): MarketView {
  const feedIdHex = bytesToHex(acct.pythFeedId);
  const targetPrice = toBigInt(acct.targetPrice);
  const expo = acct.expo;
  const deadline = Number(toBigInt(acct.deadline));
  const token = tokenByFeed(feedIdHex);
  const resolved = acct.resolved;
  return {
    address: address.toBase58(),
    creator: acct.creator.toBase58(),
    feedIdHex,
    targetPrice,
    expo,
    deadline,
    resolved,
    winningSide: acct.winningSide,
    totalYes: toBigInt(acct.totalYes),
    totalNo: toBigInt(acct.totalNo),
    usdcMint: acct.usdcMint.toBase58(),
    marketId: toBigInt(acct.marketId),
    phase: marketPhase({ resolved, deadline }, nowSec),
    targetDollars: Number(targetPrice) * 10 ** expo,
    ticker: token?.ticker,
    tokenName: token?.name,
  };
}

/** Look up a token by ticker for market creation, re-exported for the form. */
export { getToken };
