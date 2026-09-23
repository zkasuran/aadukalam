// Server-only Kamino access. This module imports @solana/kit (web3 v2) and
// @kamino-finance/klend-sdk (v12, built on kit). Together with the route handlers
// under api/kamino/* it is the ONLY place allowed to touch kit or klend-sdk. A
// client component must never import this file. The client calls the api/kamino/*
// routes and gets plain JSON or a base64 transaction back, which keeps the classic
// web3.js v1 wallet stack and the v2 kit stack in separate worlds.
//
// House style: no em dashes, no comma before "and" or "or".

import Decimal from "decimal.js";
import {
  createSolanaRpc,
  address,
  pipe,
  createNoopSigner,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compressTransactionMessageUsingAddressLookupTables,
  compileTransaction,
  getBase64EncodedWireTransaction,
  fetchAddressesForLookupTables,
  type Address,
} from "@solana/kit";
import {
  KaminoMarket,
  KaminoAction,
  VanillaObligation,
  PROGRAM_ID,
  DEFAULT_RECENT_SLOT_DURATION_MS,
  getCurrentLedgerInstant,
  type KaminoReserve,
  type LedgerInstant,
} from "@kamino-finance/klend-sdk";

import { XSTOCKS_MARKET, USDC_MINT, type BorrowMode, type ReserveInfo } from "./kamino";

export type KaminoRpc = ReturnType<typeof createSolanaRpc>;

/** Resolve the mainnet RPC. Kamino is mainnet only. A public endpoint serves the
 * reads Swipe needs (market load, reserves, a single obligation by PDA), so the
 * app works without a key in read mode. `configured` is false on the public
 * fallback so the UI can label the data source. */
export function getMainnetRpcUrl(): { url: string; configured: boolean } {
  const fromEnv =
    process.env.KAMINO_RPC_MAINNET ||
    process.env.SOLANA_RPC_MAINNET ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET;
  if (fromEnv && fromEnv.trim().length > 0) {
    return { url: fromEnv.trim(), configured: true };
  }
  return { url: "https://api.mainnet-beta.solana.com", configured: false };
}

export function getRpc(): { rpc: KaminoRpc; configured: boolean } {
  const { url, configured } = getMainnetRpcUrl();
  return { rpc: createSolanaRpc(url), configured };
}

// A short-lived cache of the loaded market so a quote and a build in the same
// window do not each pay the reserve reads. Prices refresh on the next reload
// after the TTL. Fine for a display quote; the signed transaction carries no
// numbers and the program refreshes reserves on chain at execution.
const MARKET_TTL_MS = 15_000;
let marketCache: { key: string; market: KaminoMarket; at: number } | null = null;

export async function loadXstocksMarket(rpc: KaminoRpc, key: string): Promise<KaminoMarket> {
  const now = Date.now();
  if (marketCache && marketCache.key === key && now - marketCache.at < MARKET_TTL_MS) {
    return marketCache.market;
  }
  const market = await KaminoMarket.load(
    rpc,
    address(XSTOCKS_MARKET),
    DEFAULT_RECENT_SLOT_DURATION_MS,
    PROGRAM_ID,
  );
  if (!market) throw new Error("xStocks market not found on chain");
  await market.loadReserves();
  marketCache = { key, market, at: now };
  return market;
}

/** Find a reserve in the market by its liquidity mint. One float-rate reserve per
 * mint in this market, so the mint is a stable key. */
export function findReserveByMint(market: KaminoMarket, mint: string): KaminoReserve | undefined {
  for (const reserve of market.getReserves()) {
    if (String(reserve.stats.mintAddress) === mint) return reserve;
  }
  return undefined;
}

export function getUsdcReserve(market: KaminoMarket): KaminoReserve {
  const reserve = findReserveByMint(market, USDC_MINT);
  if (!reserve) throw new Error("USDC reserve not found in the xStocks market");
  return reserve;
}

/** Read a reserve into the wire shape. LTV and threshold are the live governance
 * values, never hardcoded. `instant` places "now" on the ledger for the APR. */
export function toReserveInfo(reserve: KaminoReserve, instant: LedgerInstant): ReserveInfo {
  const maxLtv = reserve.stats.loanToValue;
  return {
    symbol: reserve.getTokenSymbol(),
    mint: String(reserve.stats.mintAddress),
    reserveAddress: String(reserve.address),
    decimals: reserve.stats.decimals,
    maxLtv,
    liquidationThreshold: reserve.stats.liquidationThreshold,
    borrowFactor: reserve.getBorrowFactor().toNumber(),
    oraclePrice: reserve.getOracleMarketPrice().toNumber(),
    borrowApr: reserve.calculateBorrowAPR(instant, 0),
    isCollateral: maxLtv > 0,
  };
}

/** Human amount to base-unit string using the reserve's own mint factor. Floors
 * to the mint's decimals so we never over-borrow by a rounding unit. */
export function toBaseUnitsForReserve(reserve: KaminoReserve, human: number): string {
  return new Decimal(human)
    .mul(reserve.getMintFactor())
    .toDecimalPlaces(0, Decimal.ROUND_DOWN)
    .toString();
}

export interface BuildBorrowParams {
  rpc: KaminoRpc;
  market: KaminoMarket;
  ownerAddress: string;
  mode: BorrowMode;
  /** USDC to borrow, in base units (6 decimals). */
  usdcBaseUnits: string;
  usdcReserveAddress: Address;
  /** collateral reserve, required for deposit-and-borrow. */
  collateralReserveAddress?: Address;
  /** collateral to post, base units, required for deposit-and-borrow. */
  collateralBaseUnits?: string;
}

export interface BuiltBorrow {
  transaction: string;
  lookupTables: string[];
  instructionLabels: string[];
  blockhash: string;
  lastValidBlockHeight: string;
}

/**
 * Build the borrow (or deposit-and-borrow) transaction the connected wallet signs.
 * We never sign: the owner is a kit noop signer that carries the address only, so
 * the compiled message has an empty owner signature slot the wallet fills. Returns
 * a base64 v0 wire transaction plus the lookup tables it references.
 */
export async function buildBorrowTransaction(p: BuildBorrowParams): Promise<BuiltBorrow> {
  const owner = createNoopSigner(address(p.ownerAddress));
  const instant = await getCurrentLedgerInstant(p.rpc);

  let action: KaminoAction;
  if (p.mode === "deposit-and-borrow") {
    if (!p.collateralReserveAddress || !p.collateralBaseUnits) {
      throw new Error("deposit-and-borrow needs a collateral reserve and amount");
    }
    action = await KaminoAction.buildDepositAndBorrowTxns({
      kaminoMarket: p.market,
      depositAmount: p.collateralBaseUnits,
      depositReserveAddress: p.collateralReserveAddress,
      borrowAmount: p.usdcBaseUnits,
      borrowReserveAddress: p.usdcReserveAddress,
      owner,
      obligation: new VanillaObligation(PROGRAM_ID),
      useV2Ixs: true,
      scopeRefreshConfig: undefined,
      includeAtaIxs: true,
      requestElevationGroup: false,
      currentLedgerInstant: instant,
    });
  } else {
    const existing = await p.market.getObligationByWallet(
      address(p.ownerAddress),
      new VanillaObligation(PROGRAM_ID),
    );
    action = await KaminoAction.buildBorrowTxns({
      kaminoMarket: p.market,
      amount: p.usdcBaseUnits,
      reserveAddress: p.usdcReserveAddress,
      owner,
      obligation: existing ?? new VanillaObligation(PROGRAM_ID),
      useV2Ixs: true,
      scopeRefreshConfig: undefined,
      includeAtaIxs: true,
      requestElevationGroup: false,
      currentLedgerInstant: instant,
    });
  }

  const ixs = [
    ...action.computeBudgetIxs,
    ...action.setupIxs,
    ...action.inBetweenIxs,
    ...action.lendingIxs,
    ...action.postLendingIxs,
    ...action.cleanupIxs,
  ];
  const instructionLabels = [
    ...action.computeBudgetIxsLabels,
    ...action.setupIxsLabels,
    ...action.inBetweenIxsLabels,
    ...action.lendingIxsLabels,
    ...action.postLendingIxsLabels,
    ...action.cleanupIxsLabels,
  ];

  const { value: latest } = await p.rpc.getLatestBlockhash().send();
  const lutMap =
    action.luts.length > 0 ? await fetchAddressesForLookupTables(action.luts, p.rpc) : {};

  const base = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(owner, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );
  const message =
    Object.keys(lutMap).length > 0
      ? compressTransactionMessageUsingAddressLookupTables(base, lutMap)
      : base;

  const compiled = compileTransaction(message);
  const transaction = getBase64EncodedWireTransaction(compiled);

  return {
    transaction,
    lookupTables: action.luts.map((l) => String(l)),
    instructionLabels,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight.toString(),
  };
}
