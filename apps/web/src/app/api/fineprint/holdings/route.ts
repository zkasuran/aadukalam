// Fine Print holdings route. Reads a wallet's SPL and Token-2022 balances from
// Solana mainnet server-side, so the heavy parsed-account read never hits the
// browser's RPC CORS or rate limits. Read-only: it takes a public address and
// returns public on-chain balances, no key and no signing. House style: no em
// dashes, no comma before "and" or "or".

import { NextResponse } from "next/server";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import { getConnection, getTokenBalances, isValidSolanaAddress } from "@aadukalam/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tokenized stocks live on mainnet, so this always reads mainnet, not the app's default cluster. */
function mainnetRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ?? clusterApiUrl("mainnet-beta");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").trim();

  if (!address) {
    return NextResponse.json({ error: "missing address" }, { status: 400 });
  }
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ error: "not a valid Solana address" }, { status: 400 });
  }

  try {
    const connection = getConnection(mainnetRpcUrl());
    const balances = await getTokenBalances(connection, new PublicKey(address));
    return NextResponse.json({
      address,
      cluster: "mainnet-beta",
      count: balances.length,
      balances,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "RPC read failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
