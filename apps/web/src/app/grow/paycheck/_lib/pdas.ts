// PDA and associated-token-account derivation for Paycheck. These mirror the
// program's seeds exactly. Pure functions over web3 and spl-token, so the tests
// derive real addresses without a network.
//
// Seeds, verbatim from the program:
//   config          = ["config"]
//   vault authority = ["vault"]
//   position        = ["position", owner, stock_mint]
//   usdc/stock vault = ATA(vault authority, mint, allowOwnerOffCurve = true)

import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { CONFIG_SEED, POSITION_SEED, VAULT_SEED } from "./constants";

/** The config PDA and its bump. */
export function deriveConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId,
  );
}

/** The vault authority PDA and its bump. It owns both token vaults. */
export function deriveVaultAuthorityPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from(VAULT_SEED)], programId);
}

/** A holder's position PDA for one deposited stock mint, plus its bump. */
export function derivePositionPda(
  programId: PublicKey,
  owner: PublicKey,
  stockMint: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(POSITION_SEED), owner.toBuffer(), stockMint.toBuffer()],
    programId,
  );
}

/**
 * A vault's associated token account. The vault authority is a PDA and so off
 * curve, so allowOwnerOffCurve is true here. Passing false would throw.
 */
export function deriveVaultAta(
  vaultAuthority: PublicKey,
  mint: PublicKey,
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    vaultAuthority,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/** A wallet's own associated token account. The owner is on curve here. */
export function deriveOwnerAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}
