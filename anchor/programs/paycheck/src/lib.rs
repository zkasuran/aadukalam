use anchor_lang::prelude::*;

declare_id!("9DAHUC1KQUsBMB9cQk8EdVZfKAhVukLhUsyuQYZBLgAy");

/// Paycheck pays rebase dividends to holders as real USDC. This is the
/// foundation stub: it stands up the admin config PDA so module agents have a
/// program to extend. It moves no funds.
#[program]
pub mod paycheck {
    use super::*;

    /// Create the config PDA and record the admin authority.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.bump = ctx.bumps.config;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

/// Program config. Holds the admin who can later open distributions.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub bump: u8,
}
