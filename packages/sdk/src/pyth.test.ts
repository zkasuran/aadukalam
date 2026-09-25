import { describe, it, expect } from "vitest";
import {
  normalizePythFeedId,
  sponsoredFeedAddress,
  parsePriceUpdateV2,
  pythHumanPrice,
  PYTH_PUSH_ORACLE_DEFAULT,
  type PythPrice,
} from "./pyth";

const AAPL = "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688";
const SOL = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

/** Build a synthetic PriceUpdateV2 account buffer for the parse test. */
function priceUpdateV2Buffer(
  feedHex: string,
  price: bigint,
  conf: bigint,
  expo: number,
  publishTime: bigint,
): Buffer {
  const head = Buffer.alloc(8 + 32 + 1); // discriminator + write_authority + verification_level(Full)
  head[40] = 1;
  const feed = Buffer.from(feedHex, "hex");
  const msg = Buffer.alloc(8 + 8 + 4 + 8 + 8 + 8 + 8 + 8); // price..posted_slot
  msg.writeBigInt64LE(price, 0);
  msg.writeBigUInt64LE(conf, 8);
  msg.writeInt32LE(expo, 16);
  msg.writeBigInt64LE(publishTime, 20);
  return Buffer.concat([head, feed, msg]);
}

describe("normalizePythFeedId", () => {
  it("strips a 0x prefix and lowercases", () => {
    expect(normalizePythFeedId("0x" + AAPL.toUpperCase())).toBe(AAPL);
    expect(normalizePythFeedId(AAPL)).toBe(AAPL);
  });
});

describe("sponsoredFeedAddress", () => {
  // Addresses checked live on Solana mainnet 2026-09-25 (the accounts that
  // returned fresh prices): the derivation must match Pyth's exactly.
  it("derives the known AAPL equity feed account on the default push-oracle, shard 1", () => {
    expect(sponsoredFeedAddress(AAPL, PYTH_PUSH_ORACLE_DEFAULT, 1).toBase58()).toBe(
      "D9uk39pqZMcnmtPP9WeC8cREUpKZmyXLga9mSQ79SphW",
    );
  });
  it("derives the known SOL/USD feed account on the default push-oracle, shard 0", () => {
    expect(sponsoredFeedAddress(SOL, PYTH_PUSH_ORACLE_DEFAULT, 0).toBase58()).toBe(
      "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
    );
  });
  it("gives different accounts for different shards", () => {
    const s0 = sponsoredFeedAddress(AAPL, PYTH_PUSH_ORACLE_DEFAULT, 0).toBase58();
    const s1 = sponsoredFeedAddress(AAPL, PYTH_PUSH_ORACLE_DEFAULT, 1).toBase58();
    expect(s0).not.toBe(s1);
  });
  it("rejects a feed id that is not 32 bytes", () => {
    expect(() => sponsoredFeedAddress("abcd", PYTH_PUSH_ORACLE_DEFAULT, 0)).toThrow();
  });
});

describe("parsePriceUpdateV2", () => {
  it("reads price, conf, exponent and publish time regardless of preceding fields", () => {
    const buf = priceUpdateV2Buffer(AAPL, 33559000n, 1000n, -5, 1790315000n);
    const p = parsePriceUpdateV2(AAPL, buf);
    expect(p).not.toBeNull();
    const price = p as PythPrice;
    expect(price.feedId).toBe(AAPL);
    expect(price.price).toBe(33559000);
    expect(price.conf).toBe(1000);
    expect(price.expo).toBe(-5);
    expect(price.publishTime).toBe(1790315000);
    expect(pythHumanPrice(price)).toBeCloseTo(335.59, 2);
  });

  it("returns null when the account does not carry this feed id", () => {
    const buf = priceUpdateV2Buffer(SOL, 11646000000n, 1000n, -8, 1790315000n);
    expect(parsePriceUpdateV2(AAPL, buf)).toBeNull();
  });

  it("returns null for a non-32-byte feed id", () => {
    const buf = priceUpdateV2Buffer(AAPL, 1n, 1n, -5, 1n);
    expect(parsePriceUpdateV2("dead", buf)).toBeNull();
  });

  it("returns null when the publish time is zero or negative", () => {
    const buf = priceUpdateV2Buffer(AAPL, 33559000n, 1000n, -5, 0n);
    expect(parsePriceUpdateV2(AAPL, buf)).toBeNull();
  });
});
