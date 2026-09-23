// Thin wrappers over the Meteora DynamicBondingCurveClient for Opening Bell.
// We never sign for the user. The create and migrate helpers return an unsigned
// Transaction plus the ephemeral keypairs that must co-sign, so the page can
// partial-sign those and hand the rest to the connected wallet.
// Research: .hq/research/meteora-dbc.md (SDK 1.5.12, verified 2026-09-23).
// House style: no em dashes, no comma before "and" or "or".
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
// BN comes through anchor so it carries a resolvable type without @types/bn.js.
import { BN } from "@coral-xyz/anchor";
import {
  DynamicBondingCurveClient,
  getPriceFromSqrtPrice,
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  DAMM_V2_PROGRAM_ID,
  TokenDecimal,
  MigrationFeeOption,
  type ConfigParameters,
  type SwapQuote2Result,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import type { SupportedDecimal } from "./presets";

/** Same program id on mainnet and devnet, surfaced for the integration note. */
export const PROGRAM_IDS = {
  dbc: DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  dammV2: DAMM_V2_PROGRAM_ID,
};

const DECIMAL: Record<SupportedDecimal, TokenDecimal> = {
  6: TokenDecimal.SIX,
  7: TokenDecimal.SEVEN,
  8: TokenDecimal.EIGHT,
  9: TokenDecimal.NINE,
};

export function createDbcClient(connection: Connection): DynamicBondingCurveClient {
  return DynamicBondingCurveClient.create(connection, "confirmed");
}

/** Spot price (quote per base) implied by a sqrt price, as a JS number. */
export function priceFromSqrt(
  sqrtPrice: BN,
  baseDecimals: SupportedDecimal,
  quoteDecimals: SupportedDecimal
): number {
  return getPriceFromSqrtPrice(
    sqrtPrice,
    DECIMAL[baseDecimals],
    DECIMAL[quoteDecimals]
  ).toNumber();
}

/**
 * Quote a buy (quote in, base out) off-chain, before any pool exists. The SDK
 * reconciles a buildCurve output directly, so no on-chain account is read.
 */
export function getBuyQuote(
  client: DynamicBondingCurveClient,
  config: ConfigParameters,
  amountIn: BN,
  currentPoint: BN
): SwapQuote2Result {
  return client.pool.getQuoteFromInputAmount({
    config: config as never,
    swapBaseForQuote: false,
    amountIn,
    slippageBps: 100,
    hasReferral: false,
    currentPoint,
  });
}

export interface CurvePoint {
  /** auction progress 0..1 (quote raised / migration threshold) */
  progress: number;
  /** cumulative quote raised at this point, in human units */
  quoteRaised: number;
  /** spot price after this much quote is raised, quote per base */
  price: number;
  /** cumulative base sold, in human units */
  baseSold: number;
}

const TEN = new BN(10);

function toHuman(amount: BN, decimals: number): number {
  // divide with a fractional remainder so small balances do not floor to zero
  const base = TEN.pow(new BN(decimals));
  const whole = amount.div(base).toNumber();
  const frac = amount.mod(base).toNumber() / base.toNumber();
  return whole + frac;
}

/**
 * Sweep the curve from zero to the migration threshold and quote each step, so
 * the UI can plot price against auction progress. This is the SDK quote math,
 * not a re-implementation of the bonding curve.
 */
export function buildPreviewCurve(
  client: DynamicBondingCurveClient,
  config: ConfigParameters,
  baseDecimals: SupportedDecimal,
  quoteDecimals: SupportedDecimal,
  points = 40
): CurvePoint[] {
  const currentPoint = new BN(Math.floor(Date.now() / 1000));
  const threshold = config.migrationQuoteThreshold as unknown as BN;
  const out: CurvePoint[] = [];

  // start of the auction: no quote raised, price is the launch price
  out.push({
    progress: 0,
    quoteRaised: 0,
    price: priceFromSqrt(
      config.sqrtStartPrice as unknown as BN,
      baseDecimals,
      quoteDecimals
    ),
    baseSold: 0,
  });

  for (let i = 1; i <= points; i++) {
    // stop just short of the threshold so the final segment does not run dry
    const frac = (i / points) * 0.995;
    const amountIn = threshold.muln(Math.round(frac * 1000)).divn(1000);
    if (amountIn.lten(0)) continue;
    try {
      // SwapQuote2Result comes from the IDL types, which do not surface these
      // fields cleanly under the app anchor version, so read the verified shape.
      const q = getBuyQuote(client, config, amountIn, currentPoint) as unknown as {
        outputAmount: BN;
        nextSqrtPrice: BN;
      };
      out.push({
        progress: Math.min(i / points, 1),
        quoteRaised: toHuman(amountIn, quoteDecimals),
        price: priceFromSqrt(q.nextSqrtPrice, baseDecimals, quoteDecimals),
        baseSold: toHuman(q.outputAmount, baseDecimals),
      });
    } catch {
      // a step past the last curve segment cannot be quoted, skip it
    }
  }
  return out;
}

/** Live auction progress 0..1 for an existing pool (post-launch). */
export function getAuctionProgress(
  client: DynamicBondingCurveClient,
  pool: PublicKey | string
): Promise<number> {
  return client.state.getPoolQuoteTokenCurveProgress(pool);
}

/** The migration (graduation) threshold in human quote units. */
export function migrationThresholdHuman(
  config: ConfigParameters,
  quoteDecimals: SupportedDecimal
): number {
  return toHuman(config.migrationQuoteThreshold as unknown as BN, quoteDecimals);
}

/** The launch (starting) price in quote per base. */
export function startPrice(
  config: ConfigParameters,
  baseDecimals: SupportedDecimal,
  quoteDecimals: SupportedDecimal
): number {
  return priceFromSqrt(
    config.sqrtStartPrice as unknown as BN,
    baseDecimals,
    quoteDecimals
  );
}

export interface LaunchTransaction {
  /** unsigned tx, needs the ephemeral signers below plus the wallet */
  transaction: Transaction;
  /** the config account address created by this launch */
  configKey: PublicKey;
  /** the new base token mint created by this launch */
  baseMint: PublicKey;
  /** ephemeral keypairs that must co-sign, none of them the user */
  signers: Keypair[];
}

export interface BuildLaunchParams {
  client: DynamicBondingCurveClient;
  config: ConfigParameters;
  /** settlement mint the pool trades against (e.g. WSOL on devnet) */
  quoteMint: PublicKey;
  /** connected wallet, the payer, fee claimer, leftover receiver and creator */
  wallet: PublicKey;
  name: string;
  symbol: string;
  uri: string;
}

/**
 * Build the create-config-and-pool transaction in one call. The wallet is the
 * payer, fee claimer, leftover receiver and pool creator. We partial-sign only
 * with the two ephemeral keypairs (config and base mint), never for the user.
 */
export async function buildLaunchTransaction(
  params: BuildLaunchParams
): Promise<LaunchTransaction> {
  const { client, config, quoteMint, wallet, name, symbol, uri } = params;
  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();

  const transaction = await client.partner.createConfigAndPool({
    ...config,
    config: configKeypair.publicKey,
    feeClaimer: wallet,
    leftoverReceiver: wallet,
    quoteMint,
    payer: wallet,
    preCreatePoolParam: {
      name,
      symbol,
      uri,
      poolCreator: wallet,
      baseMint: baseMintKeypair.publicKey,
    },
  });

  transaction.feePayer = wallet;
  // The ephemeral keypairs are returned as extra signers rather than signed
  // here, because the tx has no blockhash yet. The page passes them to
  // wallet.sendTransaction({ signers }), which sets the blockhash, co-signs
  // with these and then asks the wallet to sign as payer. We never hold or use
  // the user's key.
  return {
    transaction,
    configKey: configKeypair.publicKey,
    baseMint: baseMintKeypair.publicKey,
    signers: [configKeypair, baseMintKeypair],
  };
}

export interface MigrateTransaction {
  transaction: Transaction;
  /** two position-NFT keypairs the migration tx must co-sign */
  signers: Keypair[];
}

/**
 * Build the DAMM v2 graduation transaction. On devnet there is no auto-migrator
 * keeper, so the issuer sends this once the auction hits 100%. The dammConfig is
 * indexed by the preset's migration fee tier.
 */
export async function buildMigrateTransaction(
  client: DynamicBondingCurveClient,
  wallet: PublicKey,
  pool: PublicKey,
  migrationFeeOption: MigrationFeeOption
): Promise<MigrateTransaction> {
  const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } =
    await client.migration.migrateToDammV2({
      payer: wallet,
      pool,
      dammConfig: DAMM_V2_MIGRATION_FEE_ADDRESS[migrationFeeOption],
    });

  transaction.feePayer = wallet;
  // Same pattern as the launch tx: the two position-NFT keypairs are returned
  // as extra signers for wallet.sendTransaction({ signers }), not signed here.
  return {
    transaction,
    signers: [firstPositionNftKeypair, secondPositionNftKeypair],
  };
}
