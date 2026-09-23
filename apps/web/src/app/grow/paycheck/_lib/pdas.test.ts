import { describe, it, expect } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  deriveConfigPda,
  deriveOwnerAta,
  derivePositionPda,
  deriveVaultAta,
  deriveVaultAuthorityPda,
} from "./pdas";

const PROGRAM_ID = new PublicKey("9DAHUC1KQUsBMB9cQk8EdVZfKAhVukLhUsyuQYZBLgAy");
// Generated wallets are guaranteed on curve, mints are arbitrary pubkeys.
const OWNER_A = Keypair.generate().publicKey;
const OWNER_B = Keypair.generate().publicKey;
const STOCK_A = Keypair.generate().publicKey;
const STOCK_B = Keypair.generate().publicKey;

describe("deriveConfigPda", () => {
  it("is deterministic", () => {
    expect(deriveConfigPda(PROGRAM_ID)[0].toBase58()).toBe(
      deriveConfigPda(PROGRAM_ID)[0].toBase58(),
    );
  });

  it("uses the literal 'config' seed", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID,
    );
    expect(deriveConfigPda(PROGRAM_ID)[0].equals(expected)).toBe(true);
  });
});

describe("deriveVaultAuthorityPda", () => {
  it("uses the literal 'vault' seed", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      PROGRAM_ID,
    );
    expect(deriveVaultAuthorityPda(PROGRAM_ID)[0].equals(expected)).toBe(true);
  });

  it("is off curve, since a program owns it", () => {
    const [authority] = deriveVaultAuthorityPda(PROGRAM_ID);
    expect(PublicKey.isOnCurve(authority.toBytes())).toBe(false);
  });
});

describe("derivePositionPda", () => {
  it("uses the 'position' + owner + stock mint seeds", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), OWNER_A.toBuffer(), STOCK_A.toBuffer()],
      PROGRAM_ID,
    );
    expect(
      derivePositionPda(PROGRAM_ID, OWNER_A, STOCK_A)[0].equals(expected),
    ).toBe(true);
  });

  it("differs by owner", () => {
    const a = derivePositionPda(PROGRAM_ID, OWNER_A, STOCK_A)[0].toBase58();
    const b = derivePositionPda(PROGRAM_ID, OWNER_B, STOCK_A)[0].toBase58();
    expect(a).not.toBe(b);
  });

  it("differs by stock mint", () => {
    const a = derivePositionPda(PROGRAM_ID, OWNER_A, STOCK_A)[0].toBase58();
    const b = derivePositionPda(PROGRAM_ID, OWNER_A, STOCK_B)[0].toBase58();
    expect(a).not.toBe(b);
  });
});

describe("token vaults", () => {
  it("derives a vault ATA off the vault authority, allowing an off-curve owner", () => {
    const [authority] = deriveVaultAuthorityPda(PROGRAM_ID);
    const expected = getAssociatedTokenAddressSync(
      STOCK_A,
      authority,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    expect(deriveVaultAta(authority, STOCK_A).equals(expected)).toBe(true);
  });

  it("refuses an off-curve owner when off-curve owners are not allowed", () => {
    const [authority] = deriveVaultAuthorityPda(PROGRAM_ID);
    // deriveOwnerAta passes allowOwnerOffCurve = false, so a PDA owner throws.
    // This proves the vault helper has to pass true.
    expect(() => deriveOwnerAta(authority, STOCK_A)).toThrow();
  });

  it("derives an owner ATA for an on-curve wallet", () => {
    const expected = getAssociatedTokenAddressSync(
      STOCK_A,
      OWNER_A,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    expect(deriveOwnerAta(OWNER_A, STOCK_A).equals(expected)).toBe(true);
  });
});
