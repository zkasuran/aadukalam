// Wire types shared between the Nightguard API routes and the client. Pure types
// only, no klend-sdk or @solana/kit imports, so a client component can import
// this file without pulling the web3 v2 world into the browser bundle. The
// obligation route returns the raw Kamino numbers, the client runs the pure math
// in health.ts over them.
//
// House style: no em dashes, no comma before "and" or "or".

/** One collateral position in the obligation, priced from the reserve oracle. */
export interface CollateralLeg {
  reserve: string;
  mint: string;
  symbol: string;
  /** human token amount, base units divided by the mint factor. */
  amount: number;
  decimals: number;
  /** reserve oracle price in USD. */
  price: number;
  /** amount * price, the leg value the SDK refreshed. */
  valueUsd: number;
  /** liquidation threshold as a fraction, e.g. 0.65. Read live off the reserve. */
  liqThreshold: number;
  /** max loan to value as a fraction, e.g. 0.55. */
  maxLtv: number;
  /** false when the oracle feed is zeroed, so the price cannot be trusted. */
  validPrice: boolean;
  /** best Pyth feed id for this mint from the registry, for the off-hours clock. */
  pythFeedId: string | null;
}

/** One debt position. For xStocks these are the stable assets USDC or USDG. */
export interface DebtLeg {
  reserve: string;
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  price: number;
  /** raw borrow value in USD. */
  valueUsd: number;
}

/**
 * The obligation health snapshot the buffer math needs. All USD unless the field
 * says otherwise. `found` is false when the address has no obligation in this
 * market, in which case the totals are all zero and the legs are empty.
 */
export interface ObligationHealth {
  found: boolean;
  owner: string;
  market: string;
  obligation: string | null;
  userTotalDeposit: number;
  userTotalBorrow: number;
  /** borrow value after per reserve borrow factor. The liquidation numerator. */
  userTotalBorrowBorrowFactorAdjusted: number;
  /** sum(depositValue * maxLtv). Borrowing is blocked above this. */
  borrowLimit: number;
  /** sum(depositValue * liqThreshold). Liquidation triggers at this. */
  borrowLiquidationLimit: number;
  netAccountValue: number;
  /** display LTV as a fraction. */
  loanToValue: number;
  /** display liquidation LTV as a fraction. */
  liquidationLtv: number;
  collateral: CollateralLeg[];
  debt: DebtLeg[];
  slot: number;
  fetchedAt: string;
  cluster: string;
}

/** Envelope for the obligation route. */
export interface ObligationResponse {
  ok: boolean;
  health?: ObligationHealth;
  error?: string;
}

/** The de-risking action a user can arm. Repay reduces debt, withdraw reduces
 * collateral. Only repay raises the buffer, withdraw is offered for parity with
 * the SDK builders and is labeled as risk increasing in the UI. */
export type DeleverageAction = "repay" | "withdraw";

/** POST body for the build-deleverage route. */
export interface DeleverageRequest {
  owner: string;
  action: DeleverageAction;
  /** reserve address or symbol of the leg to act on. */
  reserve: string;
  /** human token amount to repay or withdraw. */
  amount: number;
}

/** Envelope for the build-deleverage route. Carries an unsigned base64 v0
 * transaction the wallet signs. We never sign for the user. */
export interface DeleverageResponse {
  ok: boolean;
  /** base64 encoded unsigned VersionedTransaction, ready for the wallet. */
  transactionBase64?: string;
  action?: DeleverageAction;
  reserveSymbol?: string;
  amount?: number;
  /** the human readable Kamino instruction labels in this transaction. */
  instructionLabels?: string[];
  blockhash?: string;
  lastValidBlockHeight?: number;
  error?: string;
}
