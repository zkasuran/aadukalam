// The four Paycheck writes, each built through the program's methods and sent by
// the connected wallet via the provider. Every call returns the transaction
// signature. Nothing here holds a key: .rpc() asks the wallet to sign.

import * as anchor from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";

import {
  deriveConfigPda,
  deriveOwnerAta,
  derivePositionPda,
  deriveVaultAta,
  deriveVaultAuthorityPda,
} from "./pdas";
import type { PaycheckProgram } from "./program";

const bn = (value: bigint): anchor.BN => new anchor.BN(value.toString());

/** One-time admin setup: create the config and the program-owned USDC vault. */
export async function initialize(
  program: PaycheckProgram,
  admin: PublicKey,
  keeper: PublicKey,
  usdcMint: PublicKey,
): Promise<string> {
  const [config] = deriveConfigPda(program.programId);
  const [vaultAuthority] = deriveVaultAuthorityPda(program.programId);
  const usdcVault = deriveVaultAta(vaultAuthority, usdcMint);

  return program.methods
    .initialize(keeper)
    .accountsPartial({
      admin,
      config,
      usdcMint,
      vaultAuthority,
      usdcVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

/** Deposit a rebasing stock token into the vault and record it as principal. */
export async function deposit(
  program: PaycheckProgram,
  owner: PublicKey,
  stockMint: PublicKey,
  amountBaseUnits: bigint,
): Promise<string> {
  const [config] = deriveConfigPda(program.programId);
  const [position] = derivePositionPda(program.programId, owner, stockMint);
  const [vaultAuthority] = deriveVaultAuthorityPda(program.programId);
  const ownerStockAta = deriveOwnerAta(owner, stockMint);
  const stockVault = deriveVaultAta(vaultAuthority, stockMint);

  return program.methods
    .deposit(bn(amountBaseUnits))
    .accountsPartial({
      owner,
      config,
      stockMint,
      position,
      vaultAuthority,
      ownerStockAta,
      stockVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

/**
 * Keeper only. Credit the USDC value of a rebase to a holder and record the new
 * multiplier. The keeper computes dividendUsdc off chain, the program guards the
 * arithmetic. The signer must equal config.keeper or the program rejects it.
 */
export async function recordRebase(
  program: PaycheckProgram,
  keeper: PublicKey,
  user: PublicKey,
  stockMint: PublicKey,
  dividendUsdcBaseUnits: bigint,
  newMultiplierBps: number,
): Promise<string> {
  const [config] = deriveConfigPda(program.programId);
  const [position] = derivePositionPda(program.programId, user, stockMint);

  return program.methods
    .recordRebase(user, bn(dividendUsdcBaseUnits), bn(BigInt(newMultiplierBps)))
    .accountsPartial({ keeper, config, position })
    .rpc();
}

/** Claim the full accrued USDC balance from the vault to the holder. */
export async function claim(
  program: PaycheckProgram,
  owner: PublicKey,
  usdcMint: PublicKey,
  stockMint: PublicKey,
): Promise<string> {
  const [config] = deriveConfigPda(program.programId);
  const [position] = derivePositionPda(program.programId, owner, stockMint);
  const [vaultAuthority] = deriveVaultAuthorityPda(program.programId);
  const usdcVault = deriveVaultAta(vaultAuthority, usdcMint);
  const ownerUsdcAta = deriveOwnerAta(owner, usdcMint);

  return program.methods
    .claim()
    .accountsPartial({
      owner,
      config,
      usdcMint,
      position,
      vaultAuthority,
      usdcVault,
      ownerUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}
