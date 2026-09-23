// The Call: program-derived address helpers. Pure and synchronous, so they are
// unit tested against golden addresses. Seeds are verbatim from the program:
//   market = ["market", creator, market_id u64 little-endian]
//   escrow = ["escrow", market]
//   bet    = ["bet", market, user]

import { PublicKey } from "@solana/web3.js";
import { BET_SEED, ESCROW_SEED, MARKET_SEED, THECALL_PROGRAM_ID } from "./constants";

/** Encode a u64 market id as 8 little-endian bytes, the layout the program uses. */
export function marketIdToLeBytes(marketId: bigint): Buffer {
  if (marketId < 0n || marketId > 0xffffffffffffffffn) {
    throw new Error("marketId must fit in a u64");
  }
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(marketId);
  return buf;
}

function programId(id?: PublicKey): PublicKey {
  return id ?? new PublicKey(THECALL_PROGRAM_ID);
}

export interface DerivedPda {
  address: PublicKey;
  bump: number;
}

/** market = ["market", creator, market_id LE]. */
export function deriveMarketPda(
  creator: PublicKey,
  marketId: bigint,
  id?: PublicKey,
): DerivedPda {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(MARKET_SEED), creator.toBuffer(), marketIdToLeBytes(marketId)],
    programId(id),
  );
  return { address, bump };
}

/** escrow = ["escrow", market]. */
export function deriveEscrowPda(market: PublicKey, id?: PublicKey): DerivedPda {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED), market.toBuffer()],
    programId(id),
  );
  return { address, bump };
}

/** bet = ["bet", market, user]. One bet PDA per (market, user). */
export function deriveBetPda(market: PublicKey, user: PublicKey, id?: PublicKey): DerivedPda {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(BET_SEED), market.toBuffer(), user.toBuffer()],
    programId(id),
  );
  return { address, bump };
}
