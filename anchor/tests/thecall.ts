import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Thecall } from "../target/types/thecall";
import thecallIdl from "../target/idl/thecall.json";
import fixtures from "./fixtures/fixtures.json";

const SIDE_NO = 0;
const SIDE_YES = 1;

// The Call: create a Pyth settled market, bet YES and NO, resolve against a
// preloaded PriceUpdateV2 account, claim the winner pro rata. The price account
// is a staged fixture owned by the Pyth receiver, so the on chain read, the
// staleness gate and the fixed point comparison are all exercised for real.
describe("thecall", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const program = new anchor.Program<Thecall>(thecallIdl as unknown as Thecall, provider);

  const payer = Keypair.generate(); // creator, mint authority, spl helper payer
  const userA = Keypair.generate();
  const userB = Keypair.generate();

  const freshPrice = new PublicKey(fixtures.freshPriceAccount);
  const stalePrice = new PublicKey(fixtures.stalePriceAccount);
  const FEED_HEX = fixtures.feedHex;

  const USDC_DECIMALS = 6;
  const one = (n: number) => new anchor.BN(n).mul(new anchor.BN(10 ** USDC_DECIMALS)); // USDC amount
  // A strike expressed in the feed's fixed point. The AAPL feed exponent is -5,
  // so $200.00 is 20_000_000. This is not the same scale as USDC amounts.
  const strike = (dollars: number) => new anchor.BN(dollars).mul(new anchor.BN(10 ** -fixtures.expo));

  let usdcMint: PublicKey;
  let ataA: PublicKey;
  let ataB: PublicKey;

  const airdrop = async (pk: PublicKey, sol: number) => {
    const sig = await connection.requestAirdrop(pk, sol * LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const chainTime = async () => (await connection.getBlockTime(await connection.getSlot())) as number;
  const waitPast = async (deadline: number) => {
    for (let i = 0; i < 60; i++) {
      if ((await chainTime()) >= deadline) return;
      await sleep(500);
    }
    throw new Error("chain clock did not pass the deadline in time");
  };

  const marketPda = (creator: PublicKey, id: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("market"), creator.toBuffer(), new anchor.BN(id).toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];
  const escrowPda = (market: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("escrow"), market.toBuffer()], program.programId)[0];
  const betPda = (market: PublicKey, user: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), market.toBuffer(), user.toBuffer()],
      program.programId
    )[0];

  before(async () => {
    await airdrop(provider.wallet.publicKey, 100);
    await airdrop(payer.publicKey, 100);
    await airdrop(userA.publicKey, 10);
    await airdrop(userB.publicKey, 10);

    usdcMint = await createMint(connection, payer, payer.publicKey, null, USDC_DECIMALS);
    ataA = (await getOrCreateAssociatedTokenAccount(connection, payer, usdcMint, userA.publicKey)).address;
    ataB = (await getOrCreateAssociatedTokenAccount(connection, payer, usdcMint, userB.publicKey)).address;
    await mintTo(connection, payer, usdcMint, ataA, payer, BigInt(one(100).toString()));
    await mintTo(connection, payer, usdcMint, ataB, payer, BigInt(one(100).toString()));
  });

  const createMarket = async (id: number, target: anchor.BN, windowSecs: number) => {
    const market = marketPda(payer.publicKey, id);
    const deadline = new anchor.BN((await chainTime()) + windowSecs);
    await program.methods
      .createMarket(new anchor.BN(id), FEED_HEX, target, fixtures.expo, deadline)
      .accountsStrict({
        creator: payer.publicKey,
        market,
        usdcMint,
        escrow: escrowPda(market),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    return { market, deadline: deadline.toNumber() };
  };

  const placeBet = async (market: PublicKey, user: Keypair, ata: PublicKey, side: number, amount: anchor.BN) =>
    program.methods
      .bet(side, amount)
      .accountsStrict({
        user: user.publicKey,
        market,
        bet: betPda(market, user.publicKey),
        usdcMint,
        userUsdcAta: ata,
        escrow: escrowPda(market),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

  const resolve = async (market: PublicKey, priceAccount: PublicKey) =>
    program.methods
      .resolve()
      .accountsStrict({ market, priceUpdate: priceAccount })
      .rpc();

  const claim = async (market: PublicKey, user: Keypair, ata: PublicKey) =>
    program.methods
      .claim()
      .accountsStrict({
        user: user.publicKey,
        market,
        bet: betPda(market, user.publicKey),
        usdcMint,
        escrow: escrowPda(market),
        userUsdcAta: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

  const bal = async (ata: PublicKey) => (await getAccount(connection, ata)).amount;

  const errText = (e: any) => `${e}\n${((e && e.logs) || []).join("\n")}`;

  it("YES market: create, bet both sides, resolve YES, winner claims pro rata", async () => {
    const { market, deadline } = await createMarket(1, strike(200), 3);

    await placeBet(market, userA, ataA, SIDE_YES, one(10));
    await placeBet(market, userB, ataB, SIDE_NO, one(5));

    let m = await program.account.market.fetch(market);
    assert.equal(m.totalYes.toString(), one(10).toString());
    assert.equal(m.totalNo.toString(), one(5).toString());
    assert.equal((await bal(escrowPda(market))).toString(), one(15).toString());

    await waitPast(deadline);
    await resolve(market, freshPrice);

    m = await program.account.market.fetch(market);
    assert.isTrue(m.resolved);
    assert.equal(m.winningSide, SIDE_YES);

    // Loser cannot claim.
    let rejected = false;
    try {
      await claim(market, userB, ataB);
    } catch (e) {
      rejected = true;
      assert.include(String(e), "NotAWinner");
    }
    assert.isTrue(rejected, "loser must not claim");

    // Winner takes the whole 15 USDC pot (10 stake + 5 from the losing pool).
    await claim(market, userA, ataA);
    assert.equal((await bal(ataA)).toString(), one(105).toString()); // 100 - 10 + 15
    assert.equal((await bal(escrowPda(market))).toString(), "0");

    const betA = await program.account.betAccount.fetch(betPda(market, userA.publicKey));
    assert.isTrue(betA.claimed);

    // Betting is closed once resolved.
    rejected = false;
    try {
      await placeBet(market, userA, ataA, SIDE_YES, one(1));
    } catch (e) {
      rejected = true;
      assert.include(String(e), "AlreadyResolved");
    }
    assert.isTrue(rejected, "cannot bet after resolve");
  });

  it("NO market: resolve NO when the price is below the target", async () => {
    const { market, deadline } = await createMarket(2, strike(300), 3);

    await placeBet(market, userA, ataA, SIDE_YES, one(4));
    await placeBet(market, userB, ataB, SIDE_NO, one(6));

    await waitPast(deadline);
    await resolve(market, freshPrice);

    const m = await program.account.market.fetch(market);
    assert.isTrue(m.resolved);
    assert.equal(m.winningSide, SIDE_NO);

    const before = await bal(ataB);
    await claim(market, userB, ataB); // 6 stake + 4 from losers = 10 USDC
    assert.equal((await bal(ataB)) - before, BigInt(one(10).toString()));
    assert.equal((await bal(escrowPda(market))).toString(), "0");

    let rejected = false;
    try {
      await claim(market, userA, ataA);
    } catch (e) {
      rejected = true;
      assert.include(String(e), "NotAWinner");
    }
    assert.isTrue(rejected, "YES loser must not claim on a NO market");
  });

  it("resolve before the deadline is rejected", async () => {
    const { market } = await createMarket(3, strike(200), 300);
    let rejected = false;
    try {
      await resolve(market, freshPrice);
    } catch (e) {
      rejected = true;
      assert.include(String(e), "DeadlineNotReached");
    }
    assert.isTrue(rejected, "resolve must wait for the deadline");
  });

  it("resolve with a stale price update reverts and leaves the market open", async () => {
    const { market, deadline } = await createMarket(4, strike(200), 2);
    await placeBet(market, userA, ataA, SIDE_YES, one(1));
    await waitPast(deadline);

    let rejected = false;
    try {
      await resolve(market, stalePrice);
    } catch (e) {
      rejected = true;
      assert.match(errText(e), /PriceTooOld|age exceeds|10000/);
    }
    assert.isTrue(rejected, "a stale price must not settle the market");

    const m = await program.account.market.fetch(market);
    assert.isFalse(m.resolved);
  });
});

