// Shared view types for the Paycheck client. Kept free of anchor and web3.js
// imports so the pure logic and its unit tests do not pull the whole SDK.

// Whether the program is live on the connected cluster. Checked by fetching the
// program account, never assumed.
export type DeployStatus = "checking" | "deployed" | "absent" | "error";

// The program config, read from the config PDA and flattened to strings for the
// UI. usdcDecimals is read from the USDC mint, not stored on the config account.
export interface ConfigView {
  admin: string;
  keeper: string;
  usdcMint: string;
  usdcDecimals: number;
}

// One holder's position in one deposited stock mint, read from the position PDA.
// Amounts are base units so the UI can format them against the token decimals.
export interface PositionView {
  owner: string;
  stockMint: string;
  principalBaseUnits: bigint;
  claimableUsdcBaseUnits: bigint;
  lastMultiplierBps: number;
  stockDecimals: number;
}

// A rebase the keeper recorded during this browser session. Every entry is a
// real signed transaction on devnet. The list is session memory: a production
// keeper persists the full ledger or the program emits an on-chain event.
export interface RebaseEntry {
  signature: string;
  recordedAt: number;
  user: string;
  oldMultiplierBps: number;
  newMultiplierBps: number;
  dividendUsdcBaseUnits: bigint;
}

// The outcome of one wallet-signed action, for the inline result banner.
export interface ActionResult {
  ok: boolean;
  signature?: string;
  error?: string;
}
