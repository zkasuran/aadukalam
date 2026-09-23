// Build the Swipe borrow transaction for the connected wallet to sign. We never
// sign and never move funds: the owner is a placeholder signer carrying only the
// wallet address, so the returned v0 transaction has an empty owner signature slot
// the wallet fills. Returns a base64 wire transaction plus the address lookup
// tables it references. Kamino is mainnet, so the wallet sends it to mainnet.
//
// mode "deposit-and-borrow" posts collateral and draws USDC in one transaction
// (new position). mode "borrow" draws USDC against an existing Kamino obligation.

import { NextResponse, type NextRequest } from "next/server";

import { XSTOCKS_MARKET, type BorrowMode, type BuildBorrowResponse } from "../_lib/kamino";
import {
  getRpc,
  loadXstocksMarket,
  findReserveByMint,
  getUsdcReserve,
  toBaseUnitsForReserve,
  buildBorrowTransaction,
} from "../_lib/market";
import { address, type Address } from "@solana/kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface BuildRequest {
  owner?: string;
  collateralMint?: string;
  collateralAmount?: number;
  spendUsdc?: number;
  mode?: BorrowMode;
}

export async function POST(req: NextRequest) {
  let body: BuildRequest;
  try {
    body = (await req.json()) as BuildRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  const collateralMint = body.collateralMint?.trim();
  const collateralAmount = Number(body.collateralAmount);
  const spendUsdc = Number(body.spendUsdc);
  const mode: BorrowMode = body.mode === "borrow" ? "borrow" : "deposit-and-borrow";

  if (!owner || !BASE58.test(owner)) {
    return NextResponse.json({ error: "owner must be a base58 wallet address" }, { status: 400 });
  }
  if (!Number.isFinite(spendUsdc) || spendUsdc <= 0) {
    return NextResponse.json({ error: "spendUsdc must be a positive number" }, { status: 400 });
  }
  if (mode === "deposit-and-borrow") {
    if (!collateralMint) {
      return NextResponse.json({ error: "deposit-and-borrow needs collateralMint" }, { status: 400 });
    }
    if (!Number.isFinite(collateralAmount) || collateralAmount <= 0) {
      return NextResponse.json(
        { error: "deposit-and-borrow needs a positive collateralAmount" },
        { status: 400 },
      );
    }
  }

  try {
    const { rpc, configured } = getRpc();
    const market = await loadXstocksMarket(rpc, configured ? "priv" : "pub");

    const usdcReserve = getUsdcReserve(market);
    const usdcBaseUnits = toBaseUnitsForReserve(usdcReserve, spendUsdc);

    let collateralReserveAddress: Address | undefined;
    let collateralBaseUnits: string | undefined;
    if (mode === "deposit-and-borrow") {
      const collateralReserve = findReserveByMint(market, collateralMint as string);
      if (!collateralReserve) {
        return NextResponse.json(
          { error: "collateral mint is not a reserve in the xStocks market" },
          { status: 400 },
        );
      }
      collateralReserveAddress = collateralReserve.address;
      collateralBaseUnits = toBaseUnitsForReserve(collateralReserve, collateralAmount);
    }

    const built = await buildBorrowTransaction({
      rpc,
      market,
      ownerAddress: owner,
      mode,
      usdcBaseUnits,
      usdcReserveAddress: address(usdcReserve.address),
      collateralReserveAddress,
      collateralBaseUnits,
    });

    const response: BuildBorrowResponse = {
      transaction: built.transaction,
      lookupTables: built.lookupTables,
      mode,
      market: XSTOCKS_MARKET,
      instructionLabels: built.instructionLabels,
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
