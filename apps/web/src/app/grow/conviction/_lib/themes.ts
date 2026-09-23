// Theme catalog for the picker. Reads the registry themes, dedupes each to one
// mint per company, then counts how many legs are actually routable on Jupiter
// today. Order puts the deepest, most tradable themes first so the demo lands on
// something that fills, while thin themes (nuclear) still show honestly.

import {
  allThemes,
  THEME_LABELS,
  tokensByTheme,
  type TokenInfo,
} from "@aadukalam/data";

import { dedupeByUnderlying, isTradable, toConstituent } from "./weights";

/** One-line reason each headline theme exists, in our own voice. */
const THEME_BLURBS: Record<string, string> = {
  mag7: "The seven mega-caps that carry the index. One tap, own the whole cohort.",
  "ai-chips": "The silicon behind the AI build-out, from the leader down the supply chain.",
  "ai-infra": "The compute and data layer the models run on.",
  nuclear: "The reactor and grid names riding the power demand from AI.",
  "clean-energy": "Grid and clean-power exposure in one basket.",
  energy: "Broad energy, generation through fuel.",
  "crypto-proxy": "The listed proxies for crypto: exchanges, issuers, treasuries.",
  "bitcoin-treasury": "Companies holding bitcoin on the balance sheet.",
  "index-etf": "Tokenized broad-market ETFs, the passive core.",
  gold: "Tokenized gold, the classic hedge.",
  "semi-equip": "The tool makers that every fab depends on.",
  fintech: "The rails and apps reshaping payments and brokerage.",
  consumer: "Household consumer names.",
  space: "The tokenized SpaceX wrappers and space exposure.",
};

export interface ThemeSummary {
  id: string;
  label: string;
  blurb: string;
  /** deduped members, one mint per company */
  count: number;
  /** members with enough depth to route today */
  tradableCount: number;
  /** total on-chain liquidity across the tradable members */
  tradableLiquidityUsd: number;
}

/** Build the ordered theme summaries. A theme needs at least two names to be a
 * basket, so single-name themes are dropped from the picker. */
export function themeSummaries(): ThemeSummary[] {
  const out: ThemeSummary[] = [];
  for (const id of allThemes()) {
    const members = dedupeByUnderlying(tokensByTheme(id));
    if (members.length < 2) continue;
    const tradable = members
      .map((t: TokenInfo) => toConstituent(t))
      .filter((c) => isTradable(c));
    out.push({
      id,
      label: THEME_LABELS[id] ?? id,
      blurb: THEME_BLURBS[id] ?? `Tokenized ${THEME_LABELS[id] ?? id} exposure.`,
      count: members.length,
      tradableCount: tradable.length,
      tradableLiquidityUsd: tradable.reduce((a, c) => a + (c.liquidityUsd || 0), 0),
    });
  }
  // Deepest and most tradable themes first, so the picker opens on real depth.
  return out.sort((a, b) => {
    if (b.tradableCount !== a.tradableCount) return b.tradableCount - a.tradableCount;
    return b.tradableLiquidityUsd - a.tradableLiquidityUsd;
  });
}

/** Default theme to open on: the deepest tradable one or the first available. */
export function defaultThemeId(summaries: ThemeSummary[]): string {
  return summaries[0]?.id ?? "mag7";
}
