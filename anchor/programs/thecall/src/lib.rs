use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("83f9z9RHjyvFSbcvWQixNq13vXiu35baFiDtqvG8q7LY");

/// The Call is a Pyth settled prediction market on stock outcomes.
///
/// A creator opens a market on a price feed with a target and a deadline. Users
/// bet YES or NO in USDC, which is escrowed by the program. After the deadline
/// anyone resolves the market by passing a Pyth price update, which the program
/// reads on chain with a staleness check and a feed id binding, then sets the
/// winning side by comparing the settled price to the target in fixed point.
/// Winners claim their stake plus a pro rata share of the losing pool.
///
/// Pyth is the settlement authority here, not a display. The comparison is
/// integer only, there are no floats on chain.
#[program]
pub mod thecall {
    use super::*;

    /// Open a market. `feed_id_hex` is the Pyth feed id (64 hex chars, optional
    /// 0x). `target_price` and `expo` express the strike in fixed point, so a
    /// $200.00 strike on a feed with exponent -5 is target_price 20_000_000,
    /// expo -5. `deadline` is the unix time betting closes and resolve opens.
    /// `market_id` lets one creator run many markets.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: u64,
        feed_id_hex: String,
        target_price: i64,
        expo: i32,
        deadline: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(deadline > now, TheCallError::DeadlineInPast);

        let feed_id = get_feed_id_from_hex(&feed_id_hex)?;

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.pyth_feed_id = feed_id;
        market.target_price = target_price;
        market.expo = expo;
        market.deadline = deadline;
        market.resolved = false;
        market.winning_side = SIDE_NO;
        market.total_yes = 0;
        market.total_no = 0;
        market.usdc_mint = ctx.accounts.usdc_mint.key();
        market.market_id = market_id;
        market.escrow_bump = ctx.bumps.escrow;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    /// Bet `amount` USDC on `side` (0 = NO, 1 = YES). The USDC moves into the
    /// market escrow. A user holds one bet per market, so a second bet must be on
    /// the same side and adds to the stake.
    pub fn bet(ctx: Context<Bet>, side: u8, amount: u64) -> Result<()> {
        require!(!ctx.accounts.market.resolved, TheCallError::AlreadyResolved);
        require!(amount > 0, TheCallError::ZeroAmount);
        require!(side == SIDE_YES || side == SIDE_NO, TheCallError::InvalidSide);

        let now = Clock::get()?.unix_timestamp;
        require!(now < ctx.accounts.market.deadline, TheCallError::BettingClosed);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.user_usdc_ata.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer_checked(cpi, amount, ctx.accounts.usdc_mint.decimals)?;

        let bet = &mut ctx.accounts.bet;
        if bet.market == Pubkey::default() {
            bet.market = ctx.accounts.market.key();
            bet.user = ctx.accounts.user.key();
            bet.side = side;
            bet.claimed = false;
            bet.bump = ctx.bumps.bet;
        } else {
            require!(bet.side == side, TheCallError::SideMismatch);
        }
        bet.amount = bet.amount.checked_add(amount).ok_or(TheCallError::MathOverflow)?;

        let market = &mut ctx.accounts.market;
        if side == SIDE_YES {
            market.total_yes = market.total_yes.checked_add(amount).ok_or(TheCallError::MathOverflow)?;
        } else {
            market.total_no = market.total_no.checked_add(amount).ok_or(TheCallError::MathOverflow)?;
        }
        Ok(())
    }

    /// Resolve the market after its deadline. Reads the Pyth price update account
    /// with a staleness cap and a feed id binding, then sets the winning side by
    /// comparing the settled price to the target in fixed point. Permissionless:
    /// anyone can resolve once a fresh price update is posted.
    pub fn resolve(ctx: Context<Resolve>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, TheCallError::AlreadyResolved);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= market.deadline,
            TheCallError::DeadlineNotReached
        );

        // get_price_no_older_than reverts on a stale update, a wrong feed id or
        // an under verified update, so the staleness and feed binding are enforced
        // by the SDK. The feed id was parsed from hex at create_market.
        let price = ctx.accounts.price_update.get_price_no_older_than(
            &clock,
            MAX_PRICE_AGE_SECONDS,
            &market.pyth_feed_id,
        )?;

        let yes_wins = price_ge_target(price.price, price.exponent, market.target_price, market.expo)?;
        market.winning_side = if yes_wins { SIDE_YES } else { SIDE_NO };
        market.resolved = true;
        Ok(())
    }

    /// Claim a winning bet. Pays the stake plus a pro rata share of the losing
    /// pool from escrow, then marks the bet claimed. Losers cannot claim.
    pub fn claim(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.resolved, TheCallError::NotResolved);

        let bet = &ctx.accounts.bet;
        require!(!bet.claimed, TheCallError::AlreadyClaimed);
        require!(bet.side == market.winning_side, TheCallError::NotAWinner);

        let total_pot = market.total_yes.checked_add(market.total_no).ok_or(TheCallError::MathOverflow)?;
        let winning_pool = if market.winning_side == SIDE_YES {
            market.total_yes
        } else {
            market.total_no
        };
        require!(winning_pool > 0, TheCallError::NoWinners);

        let payout_u128 = (bet.amount as u128)
            .checked_mul(total_pot as u128)
            .ok_or(TheCallError::MathOverflow)?
            .checked_div(winning_pool as u128)
            .ok_or(TheCallError::MathOverflow)?;
        let payout = u64::try_from(payout_u128).map_err(|_| TheCallError::MathOverflow)?;

        // Mark claimed before the transfer.
        ctx.accounts.bet.claimed = true;

        let creator = market.creator;
        let market_id_bytes = market.market_id.to_le_bytes();
        let bump = market.bump;
        let signer_seeds: &[&[&[u8]]] =
            &[&[MARKET_SEED, creator.as_ref(), market_id_bytes.as_ref(), &[bump]]];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.escrow.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.user_usdc_ata.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer_checked(cpi, payout, ctx.accounts.usdc_mint.decimals)?;
        Ok(())
    }
}

/// Market PDA seed, keyed by creator and market id.
pub const MARKET_SEED: &[u8] = b"market";
/// Per (market, user) bet PDA seed.
pub const BET_SEED: &[u8] = b"bet";
/// Per market USDC escrow token account PDA seed.
pub const ESCROW_SEED: &[u8] = b"escrow";

pub const SIDE_NO: u8 = 0;
pub const SIDE_YES: u8 = 1;

/// Staleness cap for the settlement price. 120 seconds is generous enough for a
/// freshly posted update to survive validator clock skew. A production market
/// settling on a volatile print should tighten this toward 10 to 30 seconds.
pub const MAX_PRICE_AGE_SECONDS: u64 = 120;

/// Compare a Pyth price to a target, both in fixed point, with no floats.
/// Aligns both to the more negative exponent so the two scale factors are >= 1,
/// then compares as i128. Returns true when price >= target (YES wins).
fn price_ge_target(price: i64, price_expo: i32, target: i64, target_expo: i32) -> Result<bool> {
    let common = price_expo.min(target_expo);
    let price_scaled = scale_to_expo(price, price_expo, common)?;
    let target_scaled = scale_to_expo(target, target_expo, common)?;
    Ok(price_scaled >= target_scaled)
}

/// Rescale `value` from `from_expo` down to `to_expo` (to_expo <= from_expo) in
/// i128. Multiplying by 10^(from_expo - to_expo) is exact for integers.
fn scale_to_expo(value: i64, from_expo: i32, to_expo: i32) -> Result<i128> {
    let diff = from_expo.checked_sub(to_expo).ok_or(TheCallError::MathOverflow)?;
    let steps = u32::try_from(diff).map_err(|_| TheCallError::MathOverflow)?;
    let factor = 10i128.checked_pow(steps).ok_or(TheCallError::MathOverflow)?;
    Ok((value as i128).checked_mul(factor).ok_or(TheCallError::MathOverflow)?)
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, creator.key().as_ref(), &market_id.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        seeds = [ESCROW_SEED, market.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = market
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Bet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        has_one = usdc_mint @ TheCallError::WrongUsdcMint
    )]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + BetAccount::INIT_SPACE,
        seeds = [BET_SEED, market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, BetAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut, token::mint = usdc_mint, token::authority = user)]
    pub user_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, market.key().as_ref()],
        bump = market.escrow_bump,
        token::mint = usdc_mint,
        token::authority = market
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    /// The Pyth price update account. Anchor verifies it is owned by the Pyth
    /// receiver program automatically and get_price_no_older_than binds it to
    /// this market's feed id.
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        has_one = usdc_mint @ TheCallError::WrongUsdcMint
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [BET_SEED, market.key().as_ref(), user.key().as_ref()],
        bump = bet.bump,
        has_one = user @ TheCallError::BetOwnerMismatch,
        constraint = bet.market == market.key() @ TheCallError::BetMarketMismatch
    )]
    pub bet: Account<'info, BetAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, market.key().as_ref()],
        bump = market.escrow_bump,
        token::mint = usdc_mint,
        token::authority = market
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = usdc_mint,
        associated_token::authority = user
    )]
    pub user_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// A single prediction market.
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub creator: Pubkey,
    pub pyth_feed_id: [u8; 32],
    pub target_price: i64,
    pub expo: i32,
    pub deadline: i64,
    pub resolved: bool,
    pub winning_side: u8,
    pub total_yes: u64,
    pub total_no: u64,
    pub usdc_mint: Pubkey,
    pub market_id: u64,
    pub escrow_bump: u8,
    pub bump: u8,
}

/// One user's bet in one market.
#[account]
#[derive(InitSpace)]
pub struct BetAccount {
    pub market: Pubkey,
    pub user: Pubkey,
    pub side: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[error_code]
pub enum TheCallError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Invalid side, use 0 for NO or 1 for YES")]
    InvalidSide,
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Betting is closed for this market")]
    BettingClosed,
    #[msg("Market is already resolved")]
    AlreadyResolved,
    #[msg("Market deadline has not passed yet")]
    DeadlineNotReached,
    #[msg("Market is not resolved yet")]
    NotResolved,
    #[msg("This bet is already claimed")]
    AlreadyClaimed,
    #[msg("This bet is not on the winning side")]
    NotAWinner,
    #[msg("A bet is already placed on the other side")]
    SideMismatch,
    #[msg("No winning stake to pay from")]
    NoWinners,
    #[msg("USDC mint does not match the market")]
    WrongUsdcMint,
    #[msg("Bet owner does not match the signer")]
    BetOwnerMismatch,
    #[msg("Bet does not belong to this market")]
    BetMarketMismatch,
}
