// Base-unit aware formatting and parsing for Paycheck. Pure and exact: all of it
// works on bigint base units and strings so a large balance never loses digits
// to floating point. No web3 or React imports, so the unit tests run it directly.

import { USDC_DECIMALS } from "./constants";

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Render base units as a decimal string against a token's decimals. Trailing
 * zeros in the fraction are dropped and the whole part is grouped with commas.
 * 1_500_000 at 6 decimals -> "1.5", 2_000_000_000 at 6 -> "2,000".
 */
export function formatUnits(
  baseUnits: bigint,
  decimals: number,
  maxFractionDigits = decimals,
): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;

  let fracStr = decimals > 0 ? frac.toString().padStart(decimals, "0") : "";
  if (maxFractionDigits < fracStr.length) {
    fracStr = fracStr.slice(0, maxFractionDigits);
  }
  fracStr = fracStr.replace(/0+$/, "");

  const sign = negative ? "-" : "";
  const wholeStr = groupThousands(whole.toString());
  return fracStr.length > 0 ? `${sign}${wholeStr}.${fracStr}` : `${sign}${wholeStr}`;
}

/**
 * Parse a positive decimal amount into base units against a token's decimals.
 * Throws on anything that is not a plain decimal or that carries more fraction
 * digits than the token can hold, so a bad input never silently truncates funds.
 */
export function parseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`not a valid amount: "${amount}"`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`too many decimals: ${decimals} allowed`);
  }
  const base = 10n ** BigInt(decimals);
  const wholePart = BigInt(whole) * base;
  const fracPart = decimals > 0 ? BigInt(frac.padEnd(decimals, "0")) : 0n;
  return wholePart + fracPart;
}

/** parseUnits that returns null instead of throwing, for live input fields. */
export function tryParseUnits(amount: string, decimals: number): bigint | null {
  try {
    return parseUnits(amount, decimals);
  } catch {
    return null;
  }
}

/**
 * Render USDC base units (6 decimals) as a dollar string. Always shows at least
 * two fraction digits and up to six for a tiny dividend so sub-cent amounts are
 * not rounded to zero. 1_500_000 -> "$1.50", 1_523_456 -> "$1.523456".
 */
export function formatUsdc(baseUnits: bigint): string {
  const base = 10n ** BigInt(USDC_DECIMALS);
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(USDC_DECIMALS, "0");

  let shown = frac.slice(0, 2);
  const rest = frac.slice(2).replace(/0+$/, "");
  if (rest) shown += rest;

  const sign = negative ? "-" : "";
  return `${sign}$${groupThousands(whole.toString())}.${shown}`;
}

/** Shorten a base58 address for display, e.g. "9DAHUC...BLgAy". */
export function shortAddress(address: string, lead = 6, tail = 5): string {
  if (address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}
