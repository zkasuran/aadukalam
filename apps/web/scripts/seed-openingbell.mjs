// Seed a real Meteora Dynamic Bonding Curve pool on Solana devnet for Opening Bell.
// Builds a config from the blue-chip IPO equity preset, creates a DBC pool for a
// new demo token (Aadukalam Opening Bell Demo, AOBD) paired against a stock-like
// quote, verifies the pool on-chain, quotes a few points on the curve and records
// the result in .hq/devnet-demo.json under an openingBell key.
//
// Devnet only. No real funds. Signed with the deployer keypair.
// Run from apps/web so the Meteora SDK in node_modules resolves:
//   node scripts/seed-openingbell.mjs
// House style: no em dashes, no comma before "and" or "or".
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";
import {
  DynamicBondingCurveClient,
  getPriceFromSqrtPrice,
  deriveDbcPoolAddress,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { getPreset, validatePreset } from "../src/app/opening-bell/_lib/presets.ts";

const RPC = "https://api.devnet.solana.com";
const KEYPAIR_PATH = fileURLToPath(
  new URL("../../../.devnet-keypair.json", import.meta.url)
);
const DEMO_JSON_PATH = fileURLToPath(
  new URL("../../../.hq/devnet-demo.json", import.meta.url)
);

// The devnet test stock mint from .hq/devnet-demo.json, 8 decimals, plain SPL.
const STOCK_MINT = "9z4aUKCSirSorBCc81EvhWmnm5Y47L8tZR8ZNRE1k5u4";
const STOCK_DECIMALS = 8;

const PRESET_ID = "blue-chip";
const BASE_DECIMALS = 6;
const TOKEN_NAME = "Aadukalam Opening Bell Demo";
const TOKEN_SYMBOL = "AOBD";
const TOKEN_URI = "https://aadukalam.app/opening-bell/AOBD.json";

const s = (v) => (v == null ? v : typeof v.toString === "function" ? v.toString() : v);

function loadDeployer() {
  const secret = JSON.parse(readFileSync(KEYPAIR_PATH, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

/** Quote a handful of buys off the live on-chain pool so we prove the curve works. */
function quoteCurve(client, virtualPool, poolConfig, quoteDecimals, baseDecimals, threshold) {
  const currentPoint = new BN(Math.floor(Date.now() / 1000));
  const fractions = [0.01, 0.05, 0.1, 0.25];
  const points = [];
  for (const f of fractions) {
    const amountIn = threshold.muln(Math.round(f * 1000)).divn(1000);
    if (amountIn.lten(0)) continue;
    try {
      const q = client.pool.swapQuote({
        virtualPool,
        config: poolConfig,
        swapBaseForQuote: false,
        amountIn,
        slippageBps: 100,
        hasReferral: false,
        eligibleForFirstSwapWithMinFee: false,
        currentPoint,
      });
      const baseOut = q.amountOut ?? q.outputAmount ?? q.outAmount;
      const nextSqrt = q.nextSqrtPrice;
      const priceAfter = nextSqrt
        ? getPriceFromSqrtPrice(nextSqrt, baseDecimals, quoteDecimals).toNumber()
        : null;
      points.push({
        fractionOfThreshold: f,
        quoteIn: amountIn.toString(),
        baseOut: baseOut != null ? baseOut.toString() : null,
        priceAfter,
      });
    } catch (err) {
      points.push({
        fractionOfThreshold: f,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return points;
}

async function attempt({ connection, client, deployer, quoteMint, quoteDecimals, quoteSymbol, quoteLabel }) {
  const preset = getPreset(PRESET_ID);
  const config = preset.build({ quoteDecimals, baseDecimals: BASE_DECIMALS });

  const validation = validatePreset(config, deployer.publicKey);
  if (!validation.ok) {
    throw new Error(`config invalid for ${quoteLabel}: ${validation.error}`);
  }

  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();
  const quoteMintKey = new PublicKey(quoteMint);

  console.log(`\n[${quoteLabel}] building create-config-and-pool tx`);
  console.log(`  quote mint   ${quoteMintKey.toBase58()} (${quoteSymbol}, ${quoteDecimals} dp)`);
  console.log(`  config key   ${configKeypair.publicKey.toBase58()}`);
  console.log(`  base mint    ${baseMintKeypair.publicKey.toBase58()}`);

  const tx = await client.partner.createConfigAndPool({
    ...config,
    config: configKeypair.publicKey,
    feeClaimer: deployer.publicKey,
    leftoverReceiver: deployer.publicKey,
    quoteMint: quoteMintKey,
    payer: deployer.publicKey,
    preCreatePoolParam: {
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      uri: TOKEN_URI,
      poolCreator: deployer.publicKey,
      baseMint: baseMintKeypair.publicKey,
    },
  });

  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [deployer, configKeypair, baseMintKeypair],
    { commitment: "confirmed" }
  );
  console.log(`  sent, sig    ${signature}`);

  const poolAddress = deriveDbcPoolAddress(
    quoteMintKey,
    baseMintKeypair.publicKey,
    configKeypair.publicKey
  );

  // Verify the pool exists on-chain by fetching it back.
  const virtualPool = await client.state.getPool(poolAddress);
  if (!virtualPool) {
    throw new Error(`pool ${poolAddress.toBase58()} not found on-chain after send`);
  }
  const poolConfig = await client.state.getPoolConfig(configKeypair.publicKey);
  if (!poolConfig) {
    throw new Error(`config ${configKeypair.publicKey.toBase58()} not found on-chain`);
  }

  const progress = await client.state.getPoolQuoteTokenCurveProgress(poolAddress);
  const threshold = config.migrationQuoteThreshold;
  const quotes = quoteCurve(
    client,
    virtualPool,
    poolConfig,
    quoteDecimals,
    BASE_DECIMALS,
    threshold
  );

  console.log(`  pool         ${poolAddress.toBase58()}`);
  console.log(`  progress     ${(progress * 100).toFixed(2)}%`);
  console.log(`  quotes       ${quotes.filter((q) => !q.error).length}/${quotes.length} priced`);

  return {
    quoteLabel,
    quoteSymbol,
    quoteMint: quoteMintKey.toBase58(),
    quoteDecimals,
    signature,
    config: configKeypair.publicKey.toBase58(),
    baseMint: baseMintKeypair.publicKey.toBase58(),
    pool: poolAddress.toBase58(),
    progress,
    migrationQuoteThreshold: s(threshold),
    quotes,
  };
}

async function main() {
  const deployer = loadDeployer();
  const connection = new Connection(RPC, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");

  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`deployer ${deployer.publicKey.toBase58()} balance ${(balance / 1e9).toFixed(4)} SOL`);
  console.log(`DBC program ${DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58()} (devnet)`);

  const candidates = [
    {
      quoteMint: STOCK_MINT,
      quoteDecimals: STOCK_DECIMALS,
      quoteSymbol: "AADU-DEMO-STOCK",
      quoteLabel: "stock-paired",
    },
    {
      quoteMint: NATIVE_MINT.toBase58(),
      quoteDecimals: 9,
      quoteSymbol: "SOL",
      quoteLabel: "WSOL fallback",
    },
  ];

  let result = null;
  const failures = [];
  for (const c of candidates) {
    try {
      result = await attempt({ connection, client, deployer, ...c });
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ quoteLabel: c.quoteLabel, message });
      const logs = err?.logs ?? err?.transactionLogs;
      console.error(`\n[${c.quoteLabel}] FAILED: ${message}`);
      if (logs) console.error(logs.join("\n"));
      if (c.quoteLabel !== "WSOL fallback") {
        console.error("Falling back to WSOL as the quote mint.");
      }
    }
  }

  if (!result) {
    console.error("\nAll quote candidates failed. Not writing devnet-demo.json.");
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  }

  const openingBell = {
    note: "Live Meteora DBC pool on devnet. Test token, no real value.",
    seededAt: new Date().toISOString(),
    cluster: "devnet",
    rpc: RPC,
    dbcProgram: DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58(),
    preset: PRESET_ID,
    tokenName: TOKEN_NAME,
    tokenSymbol: TOKEN_SYMBOL,
    baseDecimals: BASE_DECIMALS,
    creator: deployer.publicKey.toBase58(),
    leftoverReceiver: deployer.publicKey.toBase58(),
    usedFallback: result.quoteLabel === "WSOL fallback",
    ...result,
  };
  if (failures.length) openingBell.priorAttempts = failures;

  const demo = JSON.parse(readFileSync(DEMO_JSON_PATH, "utf8"));
  demo.openingBell = openingBell;
  writeFileSync(DEMO_JSON_PATH, JSON.stringify(demo, null, 2) + "\n");

  console.log("\nRecorded openingBell in .hq/devnet-demo.json:");
  console.log(JSON.stringify(openingBell, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
