// Fine Print wrapper grouping. Different issuers wrap the same underlying stock
// under different tickers (SPCXx, SPCXon, SPCX, SPACEX, tSpaceX all track
// SpaceX). This derives one underlying key per token so the "same ticker,
// different fine print" comparison can line the wrappers up side by side.
// Pure functions, driven by ticker plus issuer. House style: no em dashes,
// no comma before "and" or "or".

import type { TokenInfo } from "./types";

/**
 * Known cross-issuer aliases. Most pairs collapse cleanly by stripping the
 * issuer affix, but SpaceX ships under two naming families (SPCX and SPACEX),
 * so both fold onto one key. This is a display grouping choice, not a claim
 * about the assets.
 */
const KEY_ALIASES: Record<string, string> = {
  SPACEX: "SPCX",
  SPACE: "SPCX",
};

/**
 * The underlying symbol a wrapper tracks. Strips the issuer affix:
 * xStocks add a trailing "x", Ondo adds a trailing "on", Tessera adds a
 * leading "t". Backpack and PreStocks carry the bare name.
 */
export function deriveUnderlyingKey(token: Pick<TokenInfo, "ticker" | "issuer">): string {
  const issuer = token.issuer.toLowerCase();
  let base = token.ticker.trim();

  if (issuer.includes("xstocks") || issuer.includes("backed assets")) {
    if (/[xX]$/.test(base) && base.length > 1) base = base.slice(0, -1);
  } else if (issuer.includes("ondo")) {
    if (/on$/i.test(base) && base.length > 2) base = base.slice(0, -2);
  } else if (issuer.includes("tessera")) {
    if (/^t[A-Z]/.test(base)) base = base.slice(1);
  }

  base = base.toUpperCase();
  return KEY_ALIASES[base] ?? base;
}

/** A readable company label, with the issuer descriptor stripped off the name. */
export function deriveUnderlyingLabel(token: Pick<TokenInfo, "name">): string {
  let s = token.name;
  s = s.replace(/\s+xStock$/i, "");
  s = s.replace(/\s*\([^)]*\)\s*$/, "");
  return s.trim();
}

/** One underlying and every wrapper of it found in the input. */
export interface UnderlyingGroup {
  key: string;
  label: string;
  tokens: TokenInfo[];
}

/** Pick the shortest clean label so a group shows a tidy company name. */
function pickLabel(tokens: TokenInfo[]): string {
  const labels = tokens.map(deriveUnderlyingLabel);
  return labels.reduce((best, cur) => {
    if (cur.length < best.length) return cur;
    if (cur.length === best.length && cur < best) return cur;
    return best;
  }, labels[0]);
}

/** Group every token by the underlying it tracks. */
export function groupByUnderlying(tokens: TokenInfo[]): UnderlyingGroup[] {
  const byKey = new Map<string, TokenInfo[]>();
  for (const token of tokens) {
    const key = deriveUnderlyingKey(token);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(token);
    else byKey.set(key, [token]);
  }
  const groups: UnderlyingGroup[] = [];
  for (const [key, members] of byKey) {
    groups.push({ key, label: pickLabel(members), tokens: members });
  }
  return groups.sort(compareGroups);
}

/** Only underlyings with more than one wrapper, the ones worth comparing. */
export function multiWrapperGroups(tokens: TokenInfo[]): UnderlyingGroup[] {
  return groupByUnderlying(tokens).filter((g) => g.tokens.length > 1);
}

/** SpaceX pinned first (the flagship story), then most wrappers, then label. */
function compareGroups(a: UnderlyingGroup, b: UnderlyingGroup): number {
  if (a.key === "SPCX") return -1;
  if (b.key === "SPCX") return 1;
  if (a.tokens.length !== b.tokens.length) return b.tokens.length - a.tokens.length;
  return a.label.localeCompare(b.label);
}
