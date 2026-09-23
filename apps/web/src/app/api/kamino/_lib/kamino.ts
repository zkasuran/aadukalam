// Shared Swipe/Kamino math and response types.
//
// This file has NO SDK imports on purpose. It is pure TypeScript over numbers and
// strings, so it is safe to import from a client component AND from a server route.
// Every @solana/kit and @kamino-finance/klend-sdk call lives in market.ts and the
// route handlers, never here and never in a client component. That is the v1/v2
// isolation rule the architecture requires.
//
// House style: no em dashes, no comma before "and" or "or".

/** The Kamino xStocks lending market (tokenized equities as collateral). */
export const XSTOCKS_MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";
/** klend program id, same on mainnet. */
export const KLEND_PROGRAM_ID = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
/** USDC mint, the debt asset Swipe borrows. */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;

/** Recommended default target: keep the borrow at half of the collateral's max
 * LTV so there is a wide cushion to the liquidation line. Not a protocol value,
 * a house default for the checkout widget. */
export const SAFE_TARGET_LTV_FRACTION = 0.5;

export type BorrowMode = "deposit-and-borrow" | "borrow";

/** One reserve in the market, read live off the chain. LTVs are governance knobs
 * so they are always the live value, never hardcoded. */
export interface ReserveInfo {
  symbol: string;
  mint: string;
  reserveAddress: string;
  decimals: number;
  /** max LTV as a fraction, e.g. 0.73. Zero means the asset is debt only. */
  maxLtv: number;
  /** liquidation threshold as a fraction, e.g. 0.75. */
  liquidationThreshold: number;
  /** borrow factor as a fraction, >= 1. Applied to debt value on the risk side. */
  borrowFactor: number;
  /** oracle price in USD. */
  oraclePrice: number;
  /** current borrow APR as a fraction, e.g. 0.019. */
  borrowApr: number;
  /** true when maxLtv > 0, i.e. the asset can back a loan. */
  isCollateral: boolean;
}

/** Envelope the reserves route returns. */
export interface ReservesResponse {
  market: string;
  /** false when no dedicated mainnet RPC is configured, so the caller can label
   * the data source. Reads still work on the public endpoint. */
  configured: boolean;
  reserves: ReserveInfo[];
  fetchedAt: string;
  error?: string;
}

/** The projected position after the borrow, all USD unless the field says shares. */
export interface BorrowProjection {
  collateralValueUsd: number;
  borrowValueUsd: number;
  /** effective LTV the protocol compares: borrow-factor-adjusted debt / collateral value. */
  ltvUsed: number;
  /** collateral max LTV, the ceiling for new borrows. */
  maxLtv: number;
  /** collateral liquidation threshold, the LTV where liquidation begins. */
  liquidationLtv: number;
  /** max USDC drawable against the posted collateral. */
  borrowableUsdc: number;
  /** health factor = liquidation limit / adjusted debt. >= 1 is healthy. */
  healthFactor: number;
  /** fraction the collateral price can fall before liquidation, 0..1. */
  bufferPct: number;
  /** single-collateral liquidation price of the posted asset, in USD. */
  liquidationPrice: number;
  /** true when the requested borrow stays within the collateral's borrow limit. */
  borrowAllowed: boolean;
  /** true when the resulting position would already be liquidatable. */
  liquidatableNow: boolean;
}

export interface QuoteBorrowResponse {
  market: string;
  configured: boolean;
  mode: BorrowMode;
  collateral: ReserveInfo;
  usdc: Pick<ReserveInfo, "symbol" | "mint" | "reserveAddress" | "decimals" | "borrowApr" | "borrowFactor" | "oraclePrice">;
  /** shares of collateral the projection assumes are posted. */
  collateralAmount: number;
  /** USDC to borrow (the amount to spend at checkout). */
  spendUsdc: number;
  borrowApr: number;
  projection: BorrowProjection;
  fetchedAt: string;
  error?: string;
}

export interface BuildBorrowResponse {
  /** base64-encoded v0 transaction for the connected wallet to sign and send. */
  transaction: string;
  /** address-lookup-table addresses referenced by the compiled message. */
  lookupTables: string[];
  mode: BorrowMode;
  market: string;
  /** the labels of the instructions in order, for display and debugging. */
  instructionLabels: string[];
  /** the recent blockhash the message was built against. */
  blockhash: string;
  lastValidBlockHeight: string;
  error?: string;
}

/** Inputs to the pure borrow projection. Existing-position fields default to zero,
 * which is the fresh single-collateral case the checkout demonstrates. */
export interface ProjectBorrowInput {
  collateralAmount: number;
  collateralPrice: number;
  collateralMaxLtv: number;
  collateralLiquidationThreshold: number;
  borrowUsdc: number;
  usdcPrice: number;
  usdcBorrowFactor: number;
  existingBorrowBfAdjUsd?: number;
  existingCollateralValueUsd?: number;
  existingBorrowLimitUsd?: number;
  existingLiquidationLimitUsd?: number;
}

/**
 * Pure borrow projection. Given the collateral posted and the USDC drawn, returns
 * the effective LTV, the borrow ceiling, the health factor, the price cushion and
 * the single-collateral liquidation price. No chain access, no floating surprises
 * beyond IEEE double, which is fine for a display quote (the signed transaction
 * carries no numbers, the program recomputes on chain).
 *
 * Liquidation triggers when borrow-factor-adjusted debt >= sum(collateralValue_i *
 * liqThreshold_i). For one collateral versus USDC this reduces to a clean per-price
 * bound, which is the liquidation price the widget shows.
 */
export function projectBorrow(input: ProjectBorrowInput): BorrowProjection {
  const existingBorrowBfAdj = input.existingBorrowBfAdjUsd ?? 0;
  const existingCollateralValue = input.existingCollateralValueUsd ?? 0;
  const existingBorrowLimit = input.existingBorrowLimitUsd ?? 0;
  const existingLiqLimit = input.existingLiquidationLimitUsd ?? 0;

  const newCollateralValue = input.collateralAmount * input.collateralPrice;
  const totalCollateralValue = existingCollateralValue + newCollateralValue;

  const newBorrowValue = input.borrowUsdc * input.usdcPrice;
  const newBorrowBfAdj = newBorrowValue * input.usdcBorrowFactor;
  const totalBorrowBfAdj = existingBorrowBfAdj + newBorrowBfAdj;

  const newBorrowLimit = newCollateralValue * input.collateralMaxLtv;
  const totalBorrowLimit = existingBorrowLimit + newBorrowLimit;

  const newLiqLimit = newCollateralValue * input.collateralLiquidationThreshold;
  const totalLiqLimit = existingLiqLimit + newLiqLimit;

  const ltvUsed = totalCollateralValue > 0 ? totalBorrowBfAdj / totalCollateralValue : 0;
  const borrowableUsdc = input.usdcPrice > 0 ? totalBorrowLimit / input.usdcPrice : 0;
  const healthFactor = totalBorrowBfAdj > 0 ? totalLiqLimit / totalBorrowBfAdj : Infinity;
  const bufferPct = totalLiqLimit > 0 ? 1 - totalBorrowBfAdj / totalLiqLimit : 1;

  const liqDenominator = input.collateralAmount * input.collateralLiquidationThreshold;
  const liquidationPrice =
    liqDenominator > 0 ? Math.max(0, (totalBorrowBfAdj - existingLiqLimit) / liqDenominator) : 0;

  return {
    collateralValueUsd: totalCollateralValue,
    borrowValueUsd: newBorrowValue,
    ltvUsed,
    maxLtv: input.collateralMaxLtv,
    liquidationLtv: input.collateralLiquidationThreshold,
    borrowableUsdc,
    healthFactor,
    bufferPct,
    liquidationPrice,
    borrowAllowed: totalBorrowBfAdj <= totalBorrowLimit,
    liquidatableNow: totalLiqLimit > 0 && totalBorrowBfAdj >= totalLiqLimit,
  };
}

/** Collateral shares needed to draw `borrowUsdc` at a target effective LTV. Used by
 * the widget's "use a safe amount" helper. Returns 0 for degenerate inputs. */
export function collateralForTargetLtv(
  borrowUsdc: number,
  usdcPrice: number,
  usdcBorrowFactor: number,
  collateralPrice: number,
  targetLtv: number,
): number {
  if (collateralPrice <= 0 || targetLtv <= 0) return 0;
  const borrowBfAdj = borrowUsdc * usdcPrice * usdcBorrowFactor;
  const requiredCollateralValue = borrowBfAdj / targetLtv;
  return requiredCollateralValue / collateralPrice;
}
