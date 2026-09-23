// Nightguard obligation read. Loads the xStocks Kamino market and one user's
// vanilla obligation on mainnet, then returns the raw health numbers the buffer
// math in _lib/health.ts needs. Read only, no funds move and nothing is signed
// here. klend-sdk runs on @solana/kit (web3 v2), so it lives ONLY in this server
// route, never in a client component.
//
// This is Nightguard's own health read so the page does not depend on Swipe's
// api/kamino routes existing at build time.
//
// House style: no em dashes, no comma before "and" or "or".

import { NextResponse, type NextRequest } from "next/server";
import {
  KaminoMarket,
  PROGRAM_ID,
  DEFAULT_RECENT_SLOT_DURATION_MS,
  VanillaObligation,
} from "@kamino-finance/klend-sdk";
import { createSolanaRpc, address } from "@solana/kit";
import { getToken, bestPythFeed } from "@aadukalam/data";

import type {
  CollateralLeg,
  DebtLeg,
  ObligationHealth,
  ObligationResponse,
} from "@/app/use/nightguard/_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The xStocks market, verified in .hq/research/kamino.md. This is the market
// where tokenized equities are collateral, which is where a Nightguard position
// lives. Overridable per request for a position in another Kamino market.
const XSTOCKS_MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";

function rpcUrl(): string {
  return (
    process.env.KAMINO_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ||
    "https://api.mainnet-beta.solana.com"
  );
}

function pythFeedFor(mint: string): string | null {
  const t = getToken(mint);
  return t ? bestPythFeed(t) : null;
}

export async function GET(req: NextRequest): Promise<NextResponse<ObligationResponse>> {
  const ownerParam = (req.nextUrl.searchParams.get("owner") ?? "").trim();
  const marketParam = (req.nextUrl.searchParams.get("market") ?? XSTOCKS_MARKET).trim();

  if (!ownerParam) {
    return NextResponse.json({ ok: false, error: "missing owner address" }, { status: 400 });
  }

  let owner;
  let marketAddress;
  try {
    owner = address(ownerParam);
    marketAddress = address(marketParam);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid address" }, { status: 400 });
  }

  try {
    const rpc = createSolanaRpc(rpcUrl());
    const market = await KaminoMarket.load(
      rpc,
      marketAddress,
      DEFAULT_RECENT_SLOT_DURATION_MS,
      PROGRAM_ID,
    );
    if (!market) {
      return NextResponse.json(
        { ok: false, error: "Kamino market not found" },
        { status: 502 },
      );
    }
    await market.loadReserves();
    const slot = Number(await rpc.getSlot().send());

    const obligation = await market.getObligationByWallet(
      owner,
      new VanillaObligation(PROGRAM_ID),
    );

    const base = {
      owner: ownerParam,
      market: marketParam,
      slot,
      fetchedAt: new Date().toISOString(),
      cluster: "mainnet-beta",
    };

    if (!obligation) {
      const empty: ObligationHealth = {
        ...base,
        found: false,
        obligation: null,
        userTotalDeposit: 0,
        userTotalBorrow: 0,
        userTotalBorrowBorrowFactorAdjusted: 0,
        borrowLimit: 0,
        borrowLiquidationLimit: 0,
        netAccountValue: 0,
        loanToValue: 0,
        liquidationLtv: 0,
        collateral: [],
        debt: [],
      };
      return NextResponse.json({ ok: true, health: empty });
    }

    const stats = obligation.refreshedStats;

    const collateral: CollateralLeg[] = [];
    for (const p of obligation.getDeposits()) {
      const reserve = market.getReserveByAddress(p.reserveAddress);
      if (!reserve) continue;
      const mint = reserve.stats.mintAddress.toString();
      collateral.push({
        reserve: p.reserveAddress.toString(),
        mint,
        symbol: reserve.symbol,
        amount: p.amount.div(p.mintFactor).toNumber(),
        decimals: reserve.stats.decimals,
        price: reserve.getOracleMarketPrice().toNumber(),
        valueUsd: p.marketValueRefreshed.toNumber(),
        liqThreshold: reserve.stats.liquidationThreshold,
        maxLtv: reserve.stats.loanToValue,
        validPrice: reserve.hasValidOraclePrice(),
        pythFeedId: pythFeedFor(mint),
      });
    }

    const debt: DebtLeg[] = [];
    for (const p of obligation.getBorrows()) {
      const reserve = market.getReserveByAddress(p.reserveAddress);
      if (!reserve) continue;
      debt.push({
        reserve: p.reserveAddress.toString(),
        mint: reserve.stats.mintAddress.toString(),
        symbol: reserve.symbol,
        amount: p.amount.div(p.mintFactor).toNumber(),
        decimals: reserve.stats.decimals,
        price: reserve.getOracleMarketPrice().toNumber(),
        valueUsd: p.marketValueRefreshed.toNumber(),
      });
    }

    const health: ObligationHealth = {
      ...base,
      found: true,
      obligation: obligation.obligationAddress.toString(),
      userTotalDeposit: stats.userTotalDeposit.toNumber(),
      userTotalBorrow: stats.userTotalBorrow.toNumber(),
      userTotalBorrowBorrowFactorAdjusted:
        stats.userTotalBorrowBorrowFactorAdjusted.toNumber(),
      borrowLimit: stats.borrowLimit.toNumber(),
      borrowLiquidationLimit: stats.borrowLiquidationLimit.toNumber(),
      netAccountValue: stats.netAccountValue.toNumber(),
      loanToValue: stats.loanToValue.toNumber(),
      liquidationLtv: stats.liquidationLtv.toNumber(),
      collateral,
      debt,
    };

    return NextResponse.json({ ok: true, health });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `Could not read the obligation: ${message}` },
      { status: 502 },
    );
  }
}
