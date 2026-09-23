// Static references and defaults for the Paycheck module. No secrets and no
// mint address asserted as fact: the USDC mint and the stock mint are set by the
// admin at initialize, then read back from the on-chain config and the mints.

// PDA seeds, verbatim from the program.
export const CONFIG_SEED = "config";
export const VAULT_SEED = "vault";
export const POSITION_SEED = "position";

// A fresh position opens at a 1.0x baseline multiplier, so 10000 bps.
export const BASELINE_BPS = 10000;

// USDC carries 6 decimals on Solana. Used as the display default until the real
// mint is read from chain.
export const USDC_DECIMALS = 6;

// The mainnet mechanism this devnet program stands in for. xStocks (Backed
// Finance) reflect an issuer dividend by rebasing the token supply upward rather
// than paying cash, so a holder's balance grows and no USDC ever arrives.
// Paycheck turns that rebase delta into a real USDC stream. On devnet we drive
// the same mechanism with a test multiplier we control.
export const XSTOCKS_REBASE = {
  label: "xStocks by Backed Finance",
  url: "https://xstocks.com",
};

// Solana Explorer links, pinned to devnet where our program lives.
export function explorerTx(signature: string, cluster = "devnet"): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function explorerAddress(address: string, cluster = "devnet"): string {
  return `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
}
