import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
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
import { Paycheck } from "../target/types/paycheck";
import paycheckIdl from "../target/idl/paycheck.json";

// Paycheck: deposit a stock token, a keeper records a rebase dividend in USDC,
// the holder claims it from the vault. Runs against a local validator.
describe("paycheck", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const program = new anchor.Program<Paycheck>(paycheckIdl as unknown as Paycheck, provider);

  const payer = Keypair.generate(); // mint authority and fee payer for spl helpers
  const keeper = Keypair.generate();
  const user = Keypair.generate();

  let usdcMint: PublicKey;
  let stockMint: PublicKey;

  const configPda = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0];
  const vaultAuthPda = PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId)[0];

  const STOCK_DECIMALS = 8;
  const USDC_DECIMALS = 6;
  const DEPOSIT = new anchor.BN(10).mul(new anchor.BN(10 ** STOCK_DECIMALS)); // 10 stock
  const DIVIDEND = new anchor.BN(5_000_000); // 5 USDC
  const VAULT_FUNDING = new anchor.BN(100_000_000); // 100 USDC

  const airdrop = async (pk: PublicKey, sol: number) => {
    const sig = await connection.requestAirdrop(pk, sol * LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  };

  before(async () => {
    await airdrop(provider.wallet.publicKey, 100);
    await airdrop(payer.publicKey, 100);
    await airdrop(keeper.publicKey, 10);
    await airdrop(user.publicKey, 10);

    usdcMint = await createMint(connection, payer, payer.publicKey, null, USDC_DECIMALS);
    stockMint = await createMint(connection, payer, payer.publicKey, null, STOCK_DECIMALS);
  });

  const positionPda = (owner: PublicKey, mint: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("position"), owner.toBuffer(), mint.toBuffer()],
      program.programId
    )[0];

  it("initialize sets the config and creates the USDC vault", async () => {
    const usdcVault = getAssociatedTokenAddressSync(usdcMint, vaultAuthPda, true);

    await program.methods
      .initialize(keeper.publicKey)
      .accountsStrict({
        admin: payer.publicKey,
        config: configPda,
        usdcMint,
        vaultAuthority: vaultAuthPda,
        usdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    const config = await program.account.config.fetch(configPda);
    assert.ok(config.admin.equals(payer.publicKey));
    assert.ok(config.keeper.equals(keeper.publicKey));
    assert.ok(config.usdcMint.equals(usdcMint));

    // Fund the vault so it can pay dividends later.
    await mintTo(connection, payer, usdcMint, usdcVault, payer, BigInt(VAULT_FUNDING.toString()));
    const vault = await getAccount(connection, usdcVault);
    assert.equal(vault.amount.toString(), VAULT_FUNDING.toString());
  });

  it("deposit records principal and moves the stock into the vault", async () => {
    const ownerStockAta = (
      await getOrCreateAssociatedTokenAccount(connection, payer, stockMint, user.publicKey)
    ).address;
    await mintTo(connection, payer, stockMint, ownerStockAta, payer, BigInt(DEPOSIT.toString()));

    const position = positionPda(user.publicKey, stockMint);
    const stockVault = getAssociatedTokenAddressSync(stockMint, vaultAuthPda, true);

    await program.methods
      .deposit(DEPOSIT)
      .accountsStrict({
        owner: user.publicKey,
        config: configPda,
        stockMint,
        position,
        vaultAuthority: vaultAuthPda,
        ownerStockAta,
        stockVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const pos = await program.account.userPosition.fetch(position);
    assert.ok(pos.owner.equals(user.publicKey));
    assert.ok(pos.depositedStockMint.equals(stockMint));
    assert.equal(pos.principal.toString(), DEPOSIT.toString());
    assert.equal(pos.claimableUsdc.toString(), "0");
    assert.equal(pos.lastMultiplierBps.toString(), "10000");

    const vault = await getAccount(connection, stockVault);
    assert.equal(vault.amount.toString(), DEPOSIT.toString());
  });

  it("record_rebase credits USDC and updates the multiplier (keeper only)", async () => {
    const position = positionPda(user.publicKey, stockMint);

    // A non keeper signer must be rejected.
    const stranger = Keypair.generate();
    await airdrop(stranger.publicKey, 1);
    let rejected = false;
    try {
      await program.methods
        .recordRebase(user.publicKey, DIVIDEND, new anchor.BN(11000))
        .accountsStrict({ keeper: stranger.publicKey, config: configPda, position })
        .signers([stranger])
        .rpc();
    } catch (e) {
      rejected = true;
      assert.include(String(e), "UnauthorizedKeeper");
    }
    assert.isTrue(rejected, "stranger should not be able to record a rebase");

    await program.methods
      .recordRebase(user.publicKey, DIVIDEND, new anchor.BN(11000))
      .accountsStrict({ keeper: keeper.publicKey, config: configPda, position })
      .signers([keeper])
      .rpc();

    const pos = await program.account.userPosition.fetch(position);
    assert.equal(pos.claimableUsdc.toString(), DIVIDEND.toString());
    assert.equal(pos.lastMultiplierBps.toString(), "11000");
  });

  it("claim pays the accrued USDC and zeroes the balance", async () => {
    const position = positionPda(user.publicKey, stockMint);
    const usdcVault = getAssociatedTokenAddressSync(usdcMint, vaultAuthPda, true);
    const ownerUsdcAta = getAssociatedTokenAddressSync(usdcMint, user.publicKey);

    const vaultBefore = (await getAccount(connection, usdcVault)).amount;

    await program.methods
      .claim()
      .accountsStrict({
        owner: user.publicKey,
        config: configPda,
        usdcMint,
        position,
        vaultAuthority: vaultAuthPda,
        usdcVault,
        ownerUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const paid = await getAccount(connection, ownerUsdcAta);
    assert.equal(paid.amount.toString(), DIVIDEND.toString());

    const vaultAfter = (await getAccount(connection, usdcVault)).amount;
    assert.equal((vaultBefore - vaultAfter).toString(), DIVIDEND.toString());

    const pos = await program.account.userPosition.fetch(position);
    assert.equal(pos.claimableUsdc.toString(), "0");

    // A second claim with nothing accrued must fail.
    let rejected = false;
    try {
      await program.methods
        .claim()
        .accountsStrict({
          owner: user.publicKey,
          config: configPda,
          usdcMint,
          position,
          vaultAuthority: vaultAuthPda,
          usdcVault,
          ownerUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
    } catch (e) {
      rejected = true;
      assert.include(String(e), "NothingToClaim");
    }
    assert.isTrue(rejected, "claiming twice should fail");
  });
});

