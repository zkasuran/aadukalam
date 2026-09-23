use anchor_lang::prelude::*;

declare_id!("83f9z9RHjyvFSbcvWQixNq13vXiu35baFiDtqvG8q7LY");

/// The Call runs Pyth-settled prediction markets on earnings and price. This is
/// the foundation stub: it opens a market account so module agents have a
/// program to extend. Settlement and Pyth wiring land with the module build.
#[program]
pub mod thecall {
    use super::*;

    /// Open a market. `close_ts` is the unix time trading stops.
    pub fn initialize_market(ctx: Context<InitializeMarket>, close_ts: i64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.close_ts = close_ts;
        market.resolved = false;
        market.bump = ctx.bumps.market;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", authority.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}

/// A single prediction market.
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub close_ts: i64,
    pub resolved: bool,
    pub bump: u8,
}
