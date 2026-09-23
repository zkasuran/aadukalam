// Quote a Swipe borrow. Given a collateral mint, the collateral to post and the
// USDC to spend, load the xStocks market live, read the collateral and USDC
// reserves, then return the effective LTV, the projected health, the borrow APR
// and the single-collateral liquidation price. Pure display math, no signing.
//
// The projection is the fresh single-collateral case (post this collateral, draw
// this USDC), which is exactly what the checkout demonstrates and what build-borrow
// then assembles. Numbers are for display: the signed transaction carries none of
// them and the program recomputes on chain.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentLedgerInstant } from "@kamino-finance/klend-sdk";

import {
  XSTOCKS_MARKET,
  projectBorrow,
  type BorrowMode,
  type QuoteBorrowResponse,
} from "../_lib/kamino";
import { getRpc, loadXstocksMarket, findReserveByMint, getUsdcReserve, toReserveInfo } from "../_lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QuoteRequest {
  collateralMint?: string;
  collateralAmount?: number;
  spendUsdc?: number;
  mode?: BorrowMode;
}

export async function POST(req: NextRequest) {
  let body: QuoteRequest;
  try {
    body = (await req.json()) as QuoteRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const collateralMint = body.collateralMint?.trim();
  const collateralAmount = Number(body.collateralAmount);
  const spendUsdc = Number(body.spendUsdc);
  const mode: BorrowMode = body.mode === "borrow" ? "borrow" : "deposit-and-borrow";

  if (!collateralMint) {
    return NextResponse.json({ error: "missing collateralMint" }, { status: 400 });
  }
  if (!Number.isFinite(spendUsdc) || spendUsdc <= 0) {
    return NextResponse.json({ error: "spendUsdc must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(collateralAmount) || collateralAmount <= 0) {
    return NextResponse.json({ error: "collateralAmount must be a positive number" }, { status: 400 });
  }

  try {
    const { rpc, configured } = getRpc();
    const market = await loadXstocksMarket(rpc, configured ? "priv" : "pub");
    const instant = await getCurrentLedgerInstant(rpc);

    const collateralReserve = findReserveByMint(market, collateralMint);
    if (!collateralReserve) {
      return NextResponse.json(
        { error: "collateral mint is not a reserve in the xStocks market" },
        { status: 400 },
      );
    }
    const collateral = toReserveInfo(collateralReserve, instant);
    if (!collateral.isCollateral) {
      return NextResponse.json(
        { error: `${collateral.symbol} cannot be used as collateral (maxLTV is 0)` },
        { status: 400 },
      );
    }

    const usdc = toReserveInfo(getUsdcReserve(market), instant);

    const projection = projectBorrow({
      collateralAmount,
      collateralPrice: collateral.oraclePrice,
      collateralMaxLtv: collateral.maxLtv,
      collateralLiquidationThreshold: collateral.liquidationThreshold,
      borrowUsdc: spendUsdc,
      usdcPrice: usdc.oraclePrice,
      usdcBorrowFactor: usdc.borrowFactor,
    });

    const response: QuoteBorrowResponse = {
      market: XSTOCKS_MARKET,
      configured,
      mode,
      collateral,
      usdc: {
        symbol: usdc.symbol,
        mint: usdc.mint,
        reserveAddress: usdc.reserveAddress,
        decimals: usdc.decimals,
        borrowApr: usdc.borrowApr,
        borrowFactor: usdc.borrowFactor,
        oraclePrice: usdc.oraclePrice,
      },
      collateralAmount,
      spendUsdc,
      borrowApr: usdc.borrowApr,
      projection,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
