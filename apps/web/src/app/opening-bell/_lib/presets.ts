// Opening Bell equity-tuned launch presets over the Meteora DBC SDK.
// Each preset returns ConfigParameters from a buildCurve* helper plus a plain
// rationale for why an equity launch wants this shape, not a meme pump.
// Research: .hq/research/meteora-dbc.md (SDK 1.5.12, verified 2026-09-23).
// House style: no em dashes, no comma before "and" or "or".
import type { ConfigParameters } from "@meteora-ag/dynamic-bonding-curve-sdk";
import {
  buildCurveWithMarketCap,
  buildCurveWithLiquidityWeights,
  buildCurveWithTwoSegments,
  validateConfigParameters,
  ActivationType,
  TokenType,
  TokenDecimal,
  TokenAuthorityOption,
  CollectFeeMode,
  BaseFeeMode,
  MigrationOption,
  MigrationFeeOption,
  DammV2DynamicFeeMode,
  MigratedCollectFeeMode,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { PublicKey } from "@solana/web3.js";

export type PresetId = "blue-chip" | "order-book" | "circuit-breaker";
export type SupportedDecimal = 6 | 7 | 8 | 9;

/** Map a plain decimal count to the SDK TokenDecimal enum member. */
const DECIMAL: Record<SupportedDecimal, TokenDecimal> = {
  6: TokenDecimal.SIX,
  7: TokenDecimal.SEVEN,
  8: TokenDecimal.EIGHT,
  9: TokenDecimal.NINE,
};

export interface PresetBuildOptions {
  /** decimals of the quote (settlement) mint, e.g. SOL = 9, xStock = 8 */
  quoteDecimals: SupportedDecimal;
  /** decimals of the base (newly listed) token, default 6 */
  baseDecimals?: SupportedDecimal;
  /** total base supply minted for the launch, default 1,000,000,000 */
  totalSupply?: number;
}

export interface PresetStat {
  label: string;
  value: string;
}

export interface EquityPreset {
  id: PresetId;
  name: string;
  tagline: string;
  /** why an equity launch wants this curve, in plain copy */
  rationale: string;
  /** market cap band in quote units, used for display and the build */
  initialMarketCap: number;
  migrationMarketCap: number;
  /** graduated DAMM v2 fee tier, also the dammConfig index at migration */
  migrationFeeOption: MigrationFeeOption;
  stats: PresetStat[];
  build: (opts: PresetBuildOptions) => ConfigParameters;
}

const ZERO_VESTING = {
  totalLockedVestingAmount: 0,
  numberOfVestingPeriod: 0,
  cliffUnlockAmount: 0,
  totalVestingDuration: 0,
  cliffDurationFromMigrationTime: 0,
};

/** Shared token config. `leftover` is a small unsold buffer some curve shapes
 * need so the packed supply stays under the minted total. */
function token(opts: PresetBuildOptions, leftover: number) {
  return {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: DECIMAL[opts.baseDecimals ?? 6],
    tokenQuoteDecimal: DECIMAL[opts.quoteDecimals],
    // Immutable so there is no post-launch mint or update surface to rug.
    tokenAuthorityOption: TokenAuthorityOption.Immutable,
    totalTokenSupply: opts.totalSupply ?? 1_000_000_000,
    leftover,
  };
}

// Set A: blue-chip IPO. A flat single-segment curve inside a tight 3x band so
// price discovers a fair value slowly instead of running 100x. A high opening
// fee that decays deters a snipe-and-dump, dynamic fee taxes volatility and
// fees accrue in the quote asset. Most liquidity is permanently locked so the
// graduated venue is deep.
function buildBlueChip(opts: PresetBuildOptions): ConfigParameters {
  return buildCurveWithMarketCap({
    initialMarketCap: 100_000,
    migrationMarketCap: 300_000,
    token: token(opts, 0),
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 300,
          endingFeeBps: 80,
          numberOfPeriod: 60,
          totalDuration: 3600,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 50,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps30,
      migrationFee: { feePercentage: 2, creatorFeePercentage: 50 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Enabled,
        poolFeeBps: 30,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 40,
      partnerLiquidityPercentage: 10,
      creatorPermanentLockedLiquidityPercentage: 40,
      creatorLiquidityPercentage: 10,
    },
    lockedVesting: ZERO_VESTING,
    activationType: ActivationType.Timestamp,
  });
}

// 16 front-loaded liquidity weights. The buildCurveWithLiquidityWeights helper
// always builds MAX_CURVE_POINT (16) segments and reads one weight per segment,
// so the array must have exactly 16 entries. Heavy near the launch price then
// thinning out concentrates depth in a tight band, the closest curve analog to
// a limit-order book sitting on a reference price.
const ORDER_BOOK_WEIGHTS = [
  10, 8, 6.5, 5, 4, 3.2, 2.6, 2, 1.6, 1.3, 1, 0.8, 0.65, 0.5, 0.4, 0.3,
];

// Set B: multi-segment order-book. Shaped price discovery with depth stacked at
// the reference price so fills stay tight there, then thin as price leaves the
// band. Fast exponential fee decay. A high migration cap so graduation signals
// genuine demand, not a single large buy. A small leftover buffer is required
// because the packed 16-segment supply rounds just over the minted total.
function buildOrderBook(opts: PresetBuildOptions): ConfigParameters {
  return buildCurveWithLiquidityWeights({
    initialMarketCap: 80_000,
    migrationMarketCap: 400_000,
    liquidityWeights: ORDER_BOOK_WEIGHTS,
    token: token(opts, 10_000_000),
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
        feeSchedulerParam: {
          startingFeeBps: 500,
          endingFeeBps: 100,
          numberOfPeriod: 90,
          totalDuration: 2700,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 50,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 2, creatorFeePercentage: 50 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Enabled,
        poolFeeBps: 100,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 30,
      partnerLiquidityPercentage: 20,
      creatorPermanentLockedLiquidityPercentage: 30,
      creatorLiquidityPercentage: 20,
    },
    lockedVesting: ZERO_VESTING,
    activationType: ActivationType.Timestamp,
  });
}

// Set C: slow-drip circuit-breaker. A gentle first segment (cheap, tight) then
// a steeper second segment past a soft cap so runaway buying gets progressively
// more expensive, a soft breaker on a fast pump. Dynamic fee on to tax jumps.
// The issuer takes a modest, disclosed 30% cut like an underwriter, not a
// majority. A wide 60k to 500k cap band gives real room for discovery. A small
// leftover buffer is required because the two-segment packing rounds just over
// the minted total at some quote decimals.
function buildCircuitBreaker(opts: PresetBuildOptions): ConfigParameters {
  return buildCurveWithTwoSegments({
    initialMarketCap: 60_000,
    migrationMarketCap: 500_000,
    percentageSupplyOnMigration: 20,
    token: token(opts, 10_000_000),
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 250,
          endingFeeBps: 120,
          numberOfPeriod: 120,
          totalDuration: 7200,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 30,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps200,
      migrationFee: { feePercentage: 2, creatorFeePercentage: 30 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Enabled,
        poolFeeBps: 200,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 25,
      partnerLiquidityPercentage: 25,
      creatorPermanentLockedLiquidityPercentage: 25,
      creatorLiquidityPercentage: 25,
    },
    lockedVesting: ZERO_VESTING,
    activationType: ActivationType.Timestamp,
  });
}

export const PRESETS: EquityPreset[] = [
  {
    id: "blue-chip",
    name: "Blue-chip IPO",
    tagline: "Flat band, tight discovery, anti-snipe fee",
    rationale:
      "A large, well-known name should open near its fair value and move in a narrow band, not spike 100x on the first block. This is a single flat segment inside a 3x cap band so early buys barely move the price, a 3% opening fee that decays to 0.8% so a snipe-and-dump is unprofitable. 80% of liquidity is locked forever so the graduated pool stays deep and hard to drain.",
    initialMarketCap: 100_000,
    migrationMarketCap: 300_000,
    migrationFeeOption: MigrationFeeOption.FixedBps30,
    stats: [
      { label: "Curve", value: "Single flat segment (3x band)" },
      { label: "Opening fee", value: "3.0% decaying to 0.8%" },
      { label: "Locked liquidity", value: "80% permanent" },
      { label: "Graduated pool fee", value: "0.30%, dynamic on" },
    ],
    build: buildBlueChip,
  },
  {
    id: "order-book",
    name: "Order-book auction",
    tagline: "16 shaped segments, depth on the reference price",
    rationale:
      "A thinner name discovers price better when liquidity is stacked at a reference level, the way a real order book concentrates size near the last trade. This builds 16 segments with weights front-loaded near the launch price so fills stay tight there then thin as price leaves the band, an exponential fee that decays fast and a high migration cap so graduation means real demand, not one whale.",
    initialMarketCap: 80_000,
    migrationMarketCap: 400_000,
    migrationFeeOption: MigrationFeeOption.FixedBps100,
    stats: [
      { label: "Curve", value: "16 segments, front-loaded" },
      { label: "Opening fee", value: "5.0% exp decay to 1.0%" },
      { label: "Locked liquidity", value: "60% permanent" },
      { label: "Graduated pool fee", value: "1.00%, dynamic on" },
    ],
    build: buildOrderBook,
  },
  {
    id: "circuit-breaker",
    name: "Slow-drip circuit-breaker",
    tagline: "Two segments, volatility taxed hard",
    rationale:
      "A newly listed or volatile name needs a brake on a runaway pump. This is a gentle first segment then a steeper second segment past a soft cap so each further buy costs progressively more, a soft circuit breaker in the curve itself, with the dynamic fee on to tax fast jumps. The issuer earns a modest, disclosed 30% of trading fees like an underwriter, not a majority.",
    initialMarketCap: 60_000,
    migrationMarketCap: 500_000,
    migrationFeeOption: MigrationFeeOption.FixedBps200,
    stats: [
      { label: "Curve", value: "Two segments, steep tail" },
      { label: "Opening fee", value: "2.5% decaying to 1.2%" },
      { label: "Issuer fee share", value: "30% (disclosed)" },
      { label: "Graduated pool fee", value: "2.00%, dynamic on" },
    ],
    build: buildCircuitBreaker,
  },
];

export function getPreset(id: PresetId): EquityPreset {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown preset: ${id}`);
  return found;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Run the SDK config validation on a built preset. `validateConfigParameters`
 * reads `leftoverReceiver` and rejects the default (all-zero) pubkey, so a real
 * receiver has to be supplied. Returns a plain ok/error instead of throwing.
 */
export function validatePreset(
  config: ConfigParameters,
  leftoverReceiver: PublicKey
): ValidationResult {
  try {
    validateConfigParameters({ ...config, leftoverReceiver });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
