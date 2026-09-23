use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("9DAHUC1KQUsBMB9cQk8EdVZfKAhVukLhUsyuQYZBLgAy");

/// Paycheck turns a tokenized-stock rebase into a claimable USDC dividend.
///
/// Flow. A holder deposits a rebasing stock token into a program vault and the
/// program records the principal. A keeper watches the rebase off chain, works
/// out the USDC value of each rebase delta from the multiplier and the price, then
/// calls record_rebase to credit the holder. The holder later claims the accrued
/// USDC from the vault. Every transfer uses checked math and no handler unwraps.
///
/// On devnet this stands in for the mainnet xStocks rebase, which is issuer
/// driven. The mechanism is the same, the numbers are labeled as a devnet
/// simulation in the app.
#[program]
pub mod paycheck {
    use super::*;

    /// One time setup. Create the config PDA and the program owned USDC vault.
    /// The signer becomes the admin. `keeper` is the only authority allowed to
    /// post rebase credits. `usdc_mint` is the dividend mint the vault pays out.
    pub fn initialize(ctx: Context<Initialize>, keeper: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.keeper = keeper;
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Deposit `amount` of a stock token into the vault and record it as
    /// principal. The first deposit for a (holder, mint) pair opens the position
    /// at a 1.0x baseline multiplier. Later deposits add to the principal.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, PaycheckError::ZeroAmount);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_stock_ata.to_account_info(),
                mint: ctx.accounts.stock_mint.to_account_info(),
                to: ctx.accounts.stock_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer_checked(cpi, amount, ctx.accounts.stock_mint.decimals)?;

        let position = &mut ctx.accounts.position;
        if position.owner == Pubkey::default() {
            position.owner = ctx.accounts.owner.key();
            position.deposited_stock_mint = ctx.accounts.stock_mint.key();
            position.last_multiplier_bps = BPS_ONE;
            position.bump = ctx.bumps.position;
        }
        position.principal = position
            .principal
            .checked_add(amount)
            .ok_or(PaycheckError::MathOverflow)?;
        Ok(())
    }

    /// Keeper only. Credit `dividend_usdc` to a holder's claimable balance and
    /// record the multiplier that produced it. The keeper computes the USDC
    /// figure off chain from the rebase multiplier delta and the price. The
    /// program trusts the keeper for that figure and only guards the arithmetic.
    pub fn record_rebase(
        ctx: Context<RecordRebase>,
        user: Pubkey,
        dividend_usdc: u64,
        new_multiplier_bps: u64,
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require_keys_eq!(position.owner, user, PaycheckError::PositionOwnerMismatch);
        position.claimable_usdc = position
            .claimable_usdc
            .checked_add(dividend_usdc)
            .ok_or(PaycheckError::MathOverflow)?;
        position.last_multiplier_bps = new_multiplier_bps;
        Ok(())
    }

    /// Claim the full accrued USDC balance from the vault to the holder, then
    /// zero it. Signed by the vault authority PDA.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let amount = ctx.accounts.position.claimable_usdc;
        require!(amount > 0, PaycheckError::NothingToClaim);

        let bump = ctx.bumps.vault_authority;
        let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, &[bump]]];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.usdc_vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.owner_usdc_ata.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer_checked(cpi, amount, ctx.accounts.usdc_mint.decimals)?;

        ctx.accounts.position.claimable_usdc = 0;
        Ok(())
    }
}

/// Config PDA seed. Single per program.
pub const CONFIG_SEED: &[u8] = b"config";
/// Vault authority PDA seed. Owns the USDC vault and every stock vault ATA.
pub const VAULT_SEED: &[u8] = b"vault";
/// Per (holder, stock mint) position PDA seed.
pub const POSITION_SEED: &[u8] = b"position";

/// 10_000 basis points is a 1.0x rebase multiplier.
pub const BPS_ONE: u64 = 10_000;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: PDA that owns the vault token accounts. Used only as a signing
    /// authority so it carries no data and is validated by its seeds.
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    pub stock_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserPosition::INIT_SPACE,
        seeds = [POSITION_SEED, owner.key().as_ref(), stock_mint.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,

    /// CHECK: vault authority PDA, signing authority only.
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut, token::mint = stock_mint, token::authority = owner)]
    pub owner_stock_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = stock_mint,
        associated_token::authority = vault_authority
    )]
    pub stock_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct RecordRebase<'info> {
    pub keeper: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = keeper @ PaycheckError::UnauthorizedKeeper
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [POSITION_SEED, position.owner.as_ref(), position.deposited_stock_mint.as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, UserPosition>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = usdc_mint @ PaycheckError::WrongUsdcMint
    )]
    pub config: Account<'info, Config>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [POSITION_SEED, owner.key().as_ref(), position.deposited_stock_mint.as_ref()],
        bump = position.bump,
        has_one = owner @ PaycheckError::PositionOwnerMismatch
    )]
    pub position: Account<'info, UserPosition>,

    /// CHECK: vault authority PDA, signing authority only.
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = owner
    )]
    pub owner_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Program config. Holds the admin, the keeper allowed to post rebase credits,
/// and the USDC mint the vault pays out.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub keeper: Pubkey,
    pub usdc_mint: Pubkey,
    pub bump: u8,
}

/// One holder's position in one deposited stock mint.
#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    pub owner: Pubkey,
    pub deposited_stock_mint: Pubkey,
    pub principal: u64,
    pub claimable_usdc: u64,
    pub last_multiplier_bps: u64,
    pub bump: u8,
}

#[error_code]
pub enum PaycheckError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Signer is not the configured keeper")]
    UnauthorizedKeeper,
    #[msg("Position owner does not match the given user")]
    PositionOwnerMismatch,
    #[msg("USDC mint does not match the config")]
    WrongUsdcMint,
    #[msg("Nothing to claim")]
    NothingToClaim,
}
