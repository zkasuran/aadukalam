// The Call: fixed addresses, env-driven config and the Pyth receiver caveat.
// Program id, receiver ids and USDC config live here so the client and the UI
// copy read one source. The devnet USDC mint and the exact resolve receiver are
// integration-time facts, flagged where they are used.

/** The Call program id on devnet. Also the `address` field inside the IDL. */
export const THECALL_PROGRAM_ID = "83f9z9RHjyvFSbcvWQixNq13vXiu35baFiDtqvG8q7LY";

// PDA seeds, verbatim from the program.
export const MARKET_SEED = "market";
export const ESCROW_SEED = "escrow";
export const BET_SEED = "bet";

/**
 * CRITICAL: this program was built against the Pyth PRO receiver, so `resolve`
 * requires the PriceUpdateV2 account to be owned by the pro receiver below, not
 * the classic receiver. `@pythnetwork/pyth-solana-receiver` exports both program
 * ids as PRO_COMPATIBLE_* and DEFAULT_*; the resolve flow posts through the pro
 * ones. These string copies are for UI copy and for a runtime assertion that the
 * SDK constant still matches. Confirm the pro receiver is live on devnet before
 * relying on a real resolve (see the integration note).
 */
export const PYTH_PRO_RECEIVER_PROGRAM_ID = "rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp";
export const PYTH_DEFAULT_RECEIVER_PROGRAM_ID = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";

/**
 * Devnet USDC test mint the markets escrow against. There is no canonical devnet
 * USDC, so this is set per deployment through the env. Bet and claim read the
 * mint stored on the market account, so only market creation needs this.
 */
export const THECALL_USDC_MINT = process.env.NEXT_PUBLIC_THECALL_USDC_MINT ?? "";

/** Decimals of the devnet USDC test mint. USDC is 6 by convention. */
export const THECALL_USDC_DECIMALS = (() => {
  const raw = process.env.NEXT_PUBLIC_THECALL_USDC_DECIMALS;
  const n = raw ? Number(raw) : 6;
  return Number.isFinite(n) && n >= 0 ? n : 6;
})();

/**
 * SPL token program for the USDC mint. Classic SPL Token by default because the
 * devnet USDC test mint is a classic mint. If the deployment uses a Token-2022
 * USDC, switch this to the Token-2022 program id.
 */
export const USDC_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

/** Whether a devnet USDC mint is configured. The create form gates on this. */
export function usdcMintConfigured(): boolean {
  return THECALL_USDC_MINT.trim().length > 0;
}
