// Generate staged Pyth PriceUpdateV2 fixture accounts for the local validator.
//
// The Call resolves markets by reading a Pyth PriceUpdateV2 account on chain. On
// devnet that account is posted by the Pyth receiver program from a real Hermes
// update. Offline we cannot produce a Wormhole guardian signature, so this script
// writes a PriceUpdateV2 account owned by the receiver program with a chosen price.
// The program logic under test is real: the owner check on Account<PriceUpdateV2>,
// get_price_no_older_than (staleness plus feed id binding) and the fixed point
// comparison all run unchanged. Only the price bytes are staged and they are
// labeled as such wherever the app shows a settled market.
//
// Two fixtures are written: a fresh one (publish_time far in the future so the
// staleness gate stays green on any test run date) and a stale one (publish_time
// in the past so resolve reverts with PriceTooOld). Re-run with:
//   node tests/fixtures/gen_pyth_fixtures.cjs

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Keypair, PublicKey } = require("@solana/web3.js");

// With features = ["pro-compatible"] on pyth-solana-receiver-sdk 2.0.0 the crate's
// declare_id resolves to this Pyth Pro receiver, so Account<PriceUpdateV2> checks
// the price account owner against it. Verified from the crate source.
const PYTH_RECEIVER_PROGRAM_ID = "rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp";

// AAPL equity feed (Equity.US.AAPL/USD), exponent -5, from .hq/research/pyth.md.
const FEED_HEX = "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688";
const EXPO = -5;
const PRICE = 25_500_000n; // $255.00000 at expo -5
const CONF = 5_000n; // +/- $0.05 band

const PUBLISH_TIME_FRESH = 4102444800n; // 2100-01-01, keeps the staleness gate green
const PUBLISH_TIME_STALE = 946684800n; // 2000-01-01, forces PriceTooOld on resolve

function feedIdBytes() {
  return Buffer.from(FEED_HEX, "hex");
}

function priceUpdateData(publishTime) {
  const disc = crypto.createHash("sha256").update("account:PriceUpdateV2").digest().subarray(0, 8);
  const writeAuthority = Buffer.alloc(32, 0);
  const verificationLevel = Buffer.from([1]); // VerificationLevel::Full (variant index 1)

  const msg = Buffer.alloc(32 + 8 + 8 + 4 + 8 + 8 + 8 + 8);
  let o = 0;
  feedIdBytes().copy(msg, o); o += 32;
  msg.writeBigInt64LE(PRICE, o); o += 8;
  msg.writeBigUInt64LE(CONF, o); o += 8;
  msg.writeInt32LE(EXPO, o); o += 4;
  msg.writeBigInt64LE(publishTime, o); o += 8; // publish_time
  msg.writeBigInt64LE(publishTime - 1n, o); o += 8; // prev_publish_time
  msg.writeBigInt64LE(PRICE, o); o += 8; // ema_price
  msg.writeBigUInt64LE(CONF, o); o += 8; // ema_conf

  const postedSlot = Buffer.alloc(8, 0);
  return Buffer.concat([disc, writeAuthority, verificationLevel, msg, postedSlot]);
}

function keypairFromLabel(label) {
  const seed = crypto.createHash("sha256").update(label).digest().subarray(0, 32);
  return Keypair.fromSeed(seed);
}

function writeAccountFile(file, pubkey, data) {
  // Matches `solana account --output json` so the test validator can load it.
  const account = {
    pubkey,
    account: {
      lamports: 1_000_000_000,
      data: [data.toString("base64"), "base64"],
      owner: PYTH_RECEIVER_PROGRAM_ID,
      executable: false,
      rentEpoch: 0,
      space: data.length,
    },
  };
  fs.writeFileSync(file, JSON.stringify(account, null, 2));
}

function main() {
  const dir = __dirname;
  const fresh = keypairFromLabel("aadukalam-thecall-pyth-fresh");
  const stale = keypairFromLabel("aadukalam-thecall-pyth-stale");

  writeAccountFile(path.join(dir, "pyth_price_fresh.json"), fresh.publicKey.toBase58(), priceUpdateData(PUBLISH_TIME_FRESH));
  writeAccountFile(path.join(dir, "pyth_price_stale.json"), stale.publicKey.toBase58(), priceUpdateData(PUBLISH_TIME_STALE));

  const manifest = {
    note: "Staged Pyth PriceUpdateV2 fixtures for local resolve tests. Not real Hermes updates.",
    receiverProgramId: PYTH_RECEIVER_PROGRAM_ID,
    feedHex: FEED_HEX,
    expo: EXPO,
    price: PRICE.toString(),
    conf: CONF.toString(),
    freshPriceAccount: fresh.publicKey.toBase58(),
    stalePriceAccount: stale.publicKey.toBase58(),
    publishTimeFresh: PUBLISH_TIME_FRESH.toString(),
    publishTimeStale: PUBLISH_TIME_STALE.toString(),
  };
  fs.writeFileSync(path.join(dir, "fixtures.json"), JSON.stringify(manifest, null, 2));

  // Sanity check: PublicKey parses and data is the expected size. A Full
  // verification level is 1 byte, so the account is 133 bytes (the crate's LEN
  // constant of 134 is the max, sized for the 2 byte Partial variant).
  new PublicKey(PYTH_RECEIVER_PROGRAM_ID);
  const len = priceUpdateData(PUBLISH_TIME_FRESH).length;
  if (len !== 133) throw new Error(`unexpected data length ${len}`);

  console.log("wrote fixtures:", manifest);
}

main();
