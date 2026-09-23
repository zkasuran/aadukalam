// Guardrail policy defaults, sanitising and the ticker universe. The sanitiser
// only ever tightens: a negative or non-finite cap becomes 0, which refuses
// everything, so a malformed policy is never a loose policy.

import { loadTokens } from "@aadukalam/data";

import type { GuardrailPolicy } from "./guardrail";

/** A conservative starting policy: three liquid names, small caps. */
export const DEFAULT_POLICY: GuardrailPolicy = {
  allowlist: ["AAPLx", "NVDAx", "SPYx"],
  maxPositionUsd: 500,
  dailyBudgetUsd: 1000,
  perTradeCapUsd: 250,
};

function nonNegative(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Coerce untrusted input into a well-formed, never-looser policy. */
export function sanitizePolicy(input: Partial<GuardrailPolicy> | undefined): GuardrailPolicy {
  const allowlist = Array.isArray(input?.allowlist)
    ? [...new Set(input!.allowlist.map((t) => String(t).trim()).filter(Boolean))]
    : [];
  return {
    allowlist,
    maxPositionUsd: nonNegative(input?.maxPositionUsd),
    dailyBudgetUsd: nonNegative(input?.dailyBudgetUsd),
    perTradeCapUsd: nonNegative(input?.perTradeCapUsd),
  };
}

/** Every ticker in the registry, sorted, for the allowlist editor. */
export function availableTickers(): string[] {
  return loadTokens()
    .map((t) => t.ticker)
    .sort((a, b) => a.localeCompare(b));
}
