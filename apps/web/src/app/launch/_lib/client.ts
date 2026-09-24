// Browser helpers for the /launch page. Thin fetch wrappers over the two
// /api/clawpump routes, an agentId generator and the funded-fire command builder.
// Nothing here moves funds: the fire command is text the operator runs from a
// funded Solana keypair, never executed by the app.

import type {
  PreflightInput,
  PreflightResult,
  PumpPairsResult,
} from "@/app/api/clawpump/_lib/clawpump";

export async function fetchPumpPairs(signal?: AbortSignal): Promise<PumpPairsResult> {
  const res = await fetch("/api/clawpump/pump-pairs", { cache: "no-store", signal });
  return (await res.json()) as PumpPairsResult;
}

export async function postPreflight(
  input: PreflightInput,
  signal?: AbortSignal,
): Promise<PreflightResult> {
  const res = await fetch("/api/clawpump/preflight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal,
  });
  return (await res.json()) as PreflightResult;
}

/** A stable, caller-owned agentId for one launch attempt. ClawPump enforces one
 * token per agentId, so a fresh id per attempt is correct. */
export function newAgentId(symbol: string): string {
  const slug = symbol.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "agent";
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `aadukalam-${slug}-${rand}`;
}

/**
 * The exact two-step command that FIRES the paid launch. Step 1 spends real
 * mainnet SOL from a funded keypair, step 2 completes the launch with that
 * signature. The launch body is byte-identical to the preflight body (the
 * preflightToken is bound to it) plus txSignature and preflightToken.
 */
export function buildFireCommand(result: PreflightResult): string | null {
  if (!result.ok || !result.payment || !result.launchBody || !result.preflightToken) {
    return null;
  }
  const { payTo, amountSol, amountLamports } = result.payment;
  const retryBody = {
    ...result.launchBody,
    txSignature: "<PASTE_SIGNATURE_FROM_STEP_1>",
    preflightToken: result.preflightToken,
  };
  const bodyJson = JSON.stringify(retryBody);
  return [
    "# HANDOFF: this FIRES the paid launch. It spends REAL mainnet SOL. Do not run",
    "# it unless you intend to pay. The preflight above moved nothing.",
    "#",
    `# STEP 1  Send exactly ${amountSol} SOL (${amountLamports} lamports) from your`,
    "#         funded Solana keypair to ClawPump. The token pays for itself.",
    `solana transfer ${payTo} ${amountSol} \\`,
    "  --from /path/to/your-funded-keypair.json \\",
    "  --url mainnet-beta --allow-unfunded-recipient --commitment confirmed",
    "",
    "# STEP 2  Complete the launch with the signature from step 1. ClawPump mints",
    "#         the token and opens the Meteora DBC pool against the stock quote.",
    "#         The preflightToken is valid for ~15 minutes, so run this promptly.",
    "export CLAWPUMP_API_KEY=cpk_...   # your ClawPump key, never commit it",
    "curl -sS -X POST https://clawpump.tech/api/v1/launch/self-funded \\",
    '  -H "Authorization: Bearer $CLAWPUMP_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '${bodyJson}'`,
  ].join("\n");
}
