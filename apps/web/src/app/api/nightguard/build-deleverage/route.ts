// Nightguard armed deleverage. Builds an UNSIGNED transaction that repays debt
// or withdraws collateral on the user's Kamino obligation, then hands it back as
// base64 for the wallet to sign. We never sign for the user. The "arm" in the UI
// is a user authorized policy, not silent server signing. klend-sdk runs on
// @solana/kit (web3 v2) so it stays in this server route only.
//
// Repay reduces the debt so it raises the liquidation buffer, which is the
// de-risking action Nightguard arms. Withdraw is offered for parity with the SDK
// builders but it lowers collateral, so the UI labels it as risk increasing.
//
// House style: no em dashes, no comma before "and" or "or".

import { NextResponse, type NextRequest } from "next/server";
import {
  KaminoMarket,
  KaminoAction,
  PROGRAM_ID,
  DEFAULT_RECENT_SLOT_DURATION_MS,
  VanillaObligation,
  getCurrentLedgerInstant,
  type KaminoReserve,
} from "@kamino-finance/klend-sdk";
import {
  createSolanaRpc,
  address,
  createNoopSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compressTransactionMessageUsingAddressLookupTables,
  fetchAddressesForLookupTables,
  compileTransaction,
  getBase64EncodedWireTransaction,
} from "@solana/kit";

import type {
  DeleverageRequest,
  DeleverageResponse,
} from "@/app/use/nightguard/_lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XSTOCKS_MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";

function rpcUrl(): string {
  return (
    process.env.KAMINO_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ||
    "https://api.mainnet-beta.solana.com"
  );
}

// Resolve a reserve by its address or, failing that, by its ticker symbol.
function findReserve(market: KaminoMarket, ref: string): KaminoReserve | undefined {
  try {
    const r = market.getReserveByAddress(address(ref));
    if (r) return r;
  } catch {
    // ref was not a base58 address, fall through to a symbol match
  }
  const want = ref.toLowerCase();
  for (const r of market.reserves.values()) {
    if (r.symbol.toLowerCase() === want) return r;
  }
  return undefined;
}

export async function POST(req: NextRequest): Promise<NextResponse<DeleverageResponse>> {
  let body: Partial<DeleverageRequest>;
  try {
    body = (await req.json()) as Partial<DeleverageRequest>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const { owner: ownerParam, action, reserve: reserveRef, amount } = body;
  const marketParam =
    typeof req.nextUrl.searchParams.get("market") === "string"
      ? req.nextUrl.searchParams.get("market")!
      : XSTOCKS_MARKET;

  if (!ownerParam || (action !== "repay" && action !== "withdraw")) {
    return NextResponse.json(
      { ok: false, error: "owner and action (repay|withdraw) are required" },
      { status: 400 },
    );
  }
  if (!reserveRef) {
    return NextResponse.json({ ok: false, error: "reserve is required" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "amount must be a positive number" },
      { status: 400 },
    );
  }

  let ownerAddress;
  let marketAddress;
  try {
    ownerAddress = address(ownerParam);
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
      return NextResponse.json({ ok: false, error: "Kamino market not found" }, { status: 502 });
    }
    await market.loadReserves();

    const reserve = findReserve(market, reserveRef);
    if (!reserve) {
      return NextResponse.json(
        { ok: false, error: `reserve not found in this market: ${reserveRef}` },
        { status: 404 },
      );
    }

    // Repay and withdraw both act on an existing position, so the obligation
    // must already exist. We never open one here.
    const obligation = await market.getObligationByWallet(
      ownerAddress,
      new VanillaObligation(PROGRAM_ID),
    );
    if (!obligation) {
      return NextResponse.json(
        { ok: false, error: "no Kamino obligation for this wallet in this market" },
        { status: 404 },
      );
    }

    // Human amount to base units, using the reserve's own mint factor.
    const amountBase = reserve.getMintFactor().mul(amount).floor().toString();

    const ownerSigner = createNoopSigner(ownerAddress);
    const currentLedgerInstant = await getCurrentLedgerInstant(rpc);

    const common = {
      kaminoMarket: market,
      amount: amountBase,
      reserveAddress: reserve.address,
      owner: ownerSigner,
      obligation,
      useV2Ixs: true,
      scopeRefreshConfig: undefined,
      currentLedgerInstant,
    };

    const built =
      action === "repay"
        ? await KaminoAction.buildRepayTxns(common)
        : await KaminoAction.buildWithdrawTxns(common);

    const instructions = [
      ...built.computeBudgetIxs,
      ...built.setupIxs,
      ...built.inBetweenIxs,
      ...built.lendingIxs,
      ...built.postLendingIxs,
      ...built.cleanupIxs,
    ];
    const instructionLabels = [
      ...built.computeBudgetIxsLabels,
      ...built.setupIxsLabels,
      ...built.inBetweenIxsLabels,
      ...built.lendingIxsLabels,
      ...built.postLendingIxsLabels,
      ...built.cleanupIxsLabels,
    ];

    const { value: latest } = await rpc.getLatestBlockhash().send();

    const baseMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(ownerAddress, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    );

    // Kamino ships lookup tables so the transaction fits under the size limit.
    // Compress against them when present and fall back to the plain message if
    // the table fetch fails rather than failing the whole build.
    let lutMap: Awaited<ReturnType<typeof fetchAddressesForLookupTables>> | null = null;
    if (built.luts.length > 0) {
      try {
        lutMap = await fetchAddressesForLookupTables(built.luts, rpc);
      } catch {
        lutMap = null;
      }
    }
    const finalMessage = lutMap
      ? compressTransactionMessageUsingAddressLookupTables(baseMessage, lutMap)
      : baseMessage;

    const compiled = compileTransaction(finalMessage);
    const transactionBase64 = getBase64EncodedWireTransaction(compiled).toString();

    return NextResponse.json({
      ok: true,
      transactionBase64,
      action,
      reserveSymbol: reserve.symbol,
      amount,
      instructionLabels,
      blockhash: latest.blockhash.toString(),
      lastValidBlockHeight: Number(latest.lastValidBlockHeight),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `Could not build the transaction: ${message}` },
      { status: 502 },
    );
  }
}
