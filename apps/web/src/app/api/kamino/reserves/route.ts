// List the reserves in the Kamino xStocks market: symbol, mint, reserve address,
// live max LTV, liquidation threshold, borrow factor, oracle price and current
// borrow APR. This powers the Swipe collateral picker and is the read-only smoke
// test that proves the klend-sdk path works. Nightguard can reuse it.
//
// Reads work on the public mainnet endpoint, so no key is required. The response
// carries `configured` so the UI can say whether it is on a dedicated RPC.

import { NextResponse } from "next/server";
import { getCurrentLedgerInstant } from "@kamino-finance/klend-sdk";

import { XSTOCKS_MARKET, type ReservesResponse } from "../_lib/kamino";
import { getRpc, loadXstocksMarket, toReserveInfo } from "../_lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rpc, configured } = getRpc();
    const market = await loadXstocksMarket(rpc, configured ? "priv" : "pub");
    const instant = await getCurrentLedgerInstant(rpc);

    const reserves = market
      .getReserves()
      .map((r) => toReserveInfo(r, instant))
      .sort((a, b) => b.maxLtv - a.maxLtv);

    const body: ReservesResponse = {
      market: XSTOCKS_MARKET,
      configured,
      reserves,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const body: ReservesResponse = {
      market: XSTOCKS_MARKET,
      configured: false,
      reserves: [],
      fetchedAt: new Date().toISOString(),
      error: message,
    };
    return NextResponse.json(body, { status: 502 });
  }
}
