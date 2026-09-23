// The Call: high-level client. Reads markets and bets, builds the create, bet
// and claim instructions the user signs and drives the Pyth resolve flow.
// Every action here returns instructions or signatures, the components own the
// wallet and the send. No funds move without a user signature.

import { BN, type Program } from "@coral-xyz/anchor";
import {
  type Connection,
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

import type { Thecall } from "./idl/thecall";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  PYTH_PRO_RECEIVER_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  USDC_TOKEN_PROGRAM_ID,
} from "./constants";
import { deriveBetPda, deriveEscrowPda, deriveMarketPda } from "./pdas";
import { decodeMarket, normalizeFeedHex, toBigInt, type SignerWallet } from "./program";
import type { BetView, MarketView } from "./types";
import type { Side } from "./math";

const SYSTEM_PROGRAM = new PublicKey(SYSTEM_PROGRAM_ID);
const ATA_PROGRAM = new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID);

// ---- Reads ----------------------------------------------------------------

/** Fetch every market, newest deadline first. */
export async function fetchMarkets(program: Program<Thecall>): Promise<MarketView[]> {
  const now = Math.floor(Date.now() / 1000);
  const raw = await program.account.market.all();
  return raw
    .map((r) => decodeMarket(r.publicKey, r.account as never, now))
    .sort((a, b) => b.deadline - a.deadline);
}

/** Fetch a single market by its PDA or null if it does not exist. */
export async function fetchMarket(
  program: Program<Thecall>,
  market: PublicKey,
): Promise<MarketView | null> {
  const acct = await program.account.market.fetchNullable(market);
  if (!acct) return null;
  return decodeMarket(market, acct as never);
}

/** Fetch the caller's bet on one market or null when they have not bet. */
export async function fetchUserBet(
  program: Program<Thecall>,
  market: PublicKey,
  user: PublicKey,
): Promise<BetView | null> {
  const bet = deriveBetPda(market, user).address;
  const acct = await program.account.betAccount.fetchNullable(bet);
  if (!acct) return null;
  return {
    address: bet.toBase58(),
    market: acct.market.toBase58(),
    user: acct.user.toBase58(),
    side: acct.side as Side,
    amount: toBigInt(acct.amount),
    claimed: acct.claimed,
  };
}

/** Fetch all of the caller's bets across markets. Memcmp on the user field. */
export async function fetchUserBets(
  program: Program<Thecall>,
  user: PublicKey,
): Promise<BetView[]> {
  // bet account layout: 8 discriminator + 32 market + 32 user, so user is at 40.
  const raw = await program.account.betAccount.all([
    { memcmp: { offset: 8 + 32, bytes: user.toBase58() } },
  ]);
  return raw.map((r) => ({
    address: r.publicKey.toBase58(),
    market: r.account.market.toBase58(),
    user: r.account.user.toBase58(),
    side: r.account.side as Side,
    amount: toBigInt(r.account.amount),
    claimed: r.account.claimed,
  }));
}

// ---- Instruction builders -------------------------------------------------

export interface CreateMarketArgs {
  program: Program<Thecall>;
  creator: PublicKey;
  marketId: bigint;
  feedIdHex: string;
  targetPrice: bigint;
  expo: number;
  deadline: number;
  usdcMint: PublicKey;
  tokenProgram?: PublicKey;
}

/** Build the create_market instruction and return it with the market PDA. */
export async function buildCreateMarketIx(
  args: CreateMarketArgs,
): Promise<{ ix: TransactionInstruction; market: PublicKey }> {
  const tokenProgram = args.tokenProgram ?? new PublicKey(USDC_TOKEN_PROGRAM_ID);
  const market = deriveMarketPda(args.creator, args.marketId, args.program.programId).address;
  const escrow = deriveEscrowPda(market, args.program.programId).address;

  const ix = await args.program.methods
    .createMarket(
      new BN(args.marketId.toString()),
      normalizeFeedHex(args.feedIdHex),
      new BN(args.targetPrice.toString()),
      args.expo,
      new BN(args.deadline.toString()),
    )
    .accountsStrict({
      creator: args.creator,
      market,
      usdcMint: args.usdcMint,
      escrow,
      tokenProgram,
      systemProgram: SYSTEM_PROGRAM,
    })
    .instruction();

  return { ix, market };
}

export interface BetArgs {
  program: Program<Thecall>;
  user: PublicKey;
  market: PublicKey;
  usdcMint: PublicKey;
  side: Side;
  amount: bigint;
  tokenProgram?: PublicKey;
}

/** Build the bet instruction. The user's USDC ATA must already exist. */
export async function buildBetIx(args: BetArgs): Promise<TransactionInstruction> {
  const tokenProgram = args.tokenProgram ?? new PublicKey(USDC_TOKEN_PROGRAM_ID);
  const bet = deriveBetPda(args.market, args.user, args.program.programId).address;
  const escrow = deriveEscrowPda(args.market, args.program.programId).address;
  const userUsdcAta = getAssociatedTokenAddressSync(
    args.usdcMint,
    args.user,
    false,
    tokenProgram,
  );

  return args.program.methods
    .bet(args.side, new BN(args.amount.toString()))
    .accountsStrict({
      user: args.user,
      market: args.market,
      bet,
      usdcMint: args.usdcMint,
      userUsdcAta,
      escrow,
      tokenProgram,
      systemProgram: SYSTEM_PROGRAM,
    })
    .instruction();
}

export interface ClaimArgs {
  program: Program<Thecall>;
  user: PublicKey;
  market: PublicKey;
  usdcMint: PublicKey;
  tokenProgram?: PublicKey;
}

/** Build the claim instruction. Claim can create the user's USDC ATA if needed. */
export async function buildClaimIx(args: ClaimArgs): Promise<TransactionInstruction> {
  const tokenProgram = args.tokenProgram ?? new PublicKey(USDC_TOKEN_PROGRAM_ID);
  const bet = deriveBetPda(args.market, args.user, args.program.programId).address;
  const escrow = deriveEscrowPda(args.market, args.program.programId).address;
  const userUsdcAta = getAssociatedTokenAddressSync(
    args.usdcMint,
    args.user,
    false,
    tokenProgram,
  );

  return args.program.methods
    .claim()
    .accountsStrict({
      user: args.user,
      market: args.market,
      bet,
      usdcMint: args.usdcMint,
      escrow,
      userUsdcAta,
      tokenProgram,
      associatedTokenProgram: ATA_PROGRAM,
      systemProgram: SYSTEM_PROGRAM,
    })
    .instruction();
}

/**
 * Return an instruction to create the user's USDC ATA when it does not exist or
 * null when it already does. Prepend this to a bet transaction, because the bet
 * instruction does not create the ATA itself.
 */
export async function ensureUserUsdcAtaIx(
  connection: Connection,
  usdcMint: PublicKey,
  user: PublicKey,
  tokenProgram?: PublicKey,
): Promise<TransactionInstruction | null> {
  const program = tokenProgram ?? new PublicKey(USDC_TOKEN_PROGRAM_ID);
  const ata = getAssociatedTokenAddressSync(usdcMint, user, false, program);
  const info = await connection.getAccountInfo(ata);
  if (info) return null;
  return createAssociatedTokenAccountInstruction(user, ata, user, usdcMint, program, ATA_PROGRAM);
}

// ---- Resolve via the Pyth pull oracle -------------------------------------

export interface ResolveArgs {
  connection: Connection;
  wallet: SignerWallet;
  program: Program<Thecall>;
  market: PublicKey;
  /** the market's 64-char feed hex, no 0x */
  feedIdHex: string;
  /** hex VAA blobs from Hermes binary.data, fetched through our keyed route */
  priceUpdateData: string[];
  computeUnitPriceMicroLamports?: number;
}

/**
 * Post the Pyth price update and resolve the market in the same set of signed
 * transactions. This posts through the PRO receiver, because the program was
 * built against it and binds the price update account to that owner. The pro
 * receiver program id is asserted against the SDK constant so a version bump
 * that changes it fails loudly rather than silently posting to the classic one.
 *
 * The program is not yet deployed to devnet, so this path is built and typed but
 * not exercised end to end. Confirm the pro receiver is live on devnet before a
 * real resolve, see the integration note.
 */
export async function resolveMarket(args: ResolveArgs): Promise<string[]> {
  const {
    PythSolanaReceiver,
    PRO_COMPATIBLE_RECEIVER_PROGRAM_ID,
    PRO_COMPATIBLE_WORMHOLE_PROGRAM_ID,
    PRO_COMPATIBLE_PUSH_ORACLE_PROGRAM_ID,
  } = await import(/* webpackIgnore: true */ "@pythnetwork/pyth-solana-receiver");

  if (PRO_COMPATIBLE_RECEIVER_PROGRAM_ID.toBase58() !== PYTH_PRO_RECEIVER_PROGRAM_ID) {
    throw new Error(
      `Pyth pro receiver id changed to ${PRO_COMPATIBLE_RECEIVER_PROGRAM_ID.toBase58()}, ` +
        `expected ${PYTH_PRO_RECEIVER_PROGRAM_ID}. Re-verify the resolve path before use.`,
    );
  }

  const receiver = new PythSolanaReceiver({
    connection: args.connection,
    // wallet-adapter AnchorWallet satisfies the anchor Wallet shape here
    wallet: args.wallet as never,
    receiverProgramId: PRO_COMPATIBLE_RECEIVER_PROGRAM_ID,
    wormholeProgramId: PRO_COMPATIBLE_WORMHOLE_PROGRAM_ID,
    pushOracleProgramId: PRO_COMPATIBLE_PUSH_ORACLE_PROGRAM_ID,
  });

  const feed = normalizeFeedHex(args.feedIdHex);
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPriceUpdates(args.priceUpdateData);

  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => [
    {
      instruction: await args.program.methods
        .resolve()
        .accountsStrict({
          market: args.market,
          priceUpdate: getPriceUpdateAccount(feed),
        })
        .instruction(),
      signers: [],
    },
  ]);

  const txs = await builder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: args.computeUnitPriceMicroLamports ?? 50_000,
    tightComputeBudget: true,
  });

  return receiver.provider.sendAll(txs, { skipPreflight: true });
}
