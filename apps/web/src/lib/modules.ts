// Single source of truth for the module map. The landing page and the sidebar
// both read this so the routes and the nav can never drift apart.

export type PillarKey = "know" | "grow" | "use" | "play";

export interface ModuleDef {
  slug: string;
  href: string;
  name: string;
  blurb: string;
}

export interface Pillar {
  key: PillarKey;
  label: string;
  tagline: string;
  modules: ModuleDef[];
}

export const PILLARS: Pillar[] = [
  {
    key: "know",
    label: "KNOW",
    tagline: "See exactly what you own.",
    modules: [
      {
        slug: "fineprint",
        href: "/know/fineprint",
        name: "Fine Print",
        blurb: "What you actually own behind a tokenized stock.",
      },
      {
        slug: "receipt",
        href: "/know/receipt",
        name: "Receipt",
        blurb: "Pre-IPO backing proof, straight from the issuer.",
      },
      {
        slug: "trueprice",
        href: "/know/trueprice",
        name: "TruePrice",
        blurb: "A 24/7 fair value from Pyth, even when the market is shut.",
      },
    ],
  },
  {
    key: "grow",
    label: "GROW",
    tagline: "Put the portfolio to work.",
    modules: [
      {
        slug: "conviction",
        href: "/grow/conviction",
        name: "Conviction",
        blurb: "Self-rebalancing thematic baskets.",
      },
      {
        slug: "leash",
        href: "/grow/leash",
        name: "Leash",
        blurb: "A guard-railed AI investing agent that stays on its leash.",
      },
      {
        slug: "paycheck",
        href: "/grow/paycheck",
        name: "Paycheck",
        blurb: "Rebase dividends paid to you as real USDC.",
      },
    ],
  },
  {
    key: "use",
    label: "USE",
    tagline: "Spend without selling.",
    modules: [
      {
        slug: "swipe",
        href: "/use/swipe",
        name: "Swipe",
        blurb: "Spend against the portfolio, never sell it.",
      },
      {
        slug: "nightguard",
        href: "/use/nightguard",
        name: "Nightguard",
        blurb: "An off-hours liquidation shield for leveraged positions.",
      },
    ],
  },
  {
    key: "play",
    label: "PLAY",
    tagline: "Take a position on the story.",
    modules: [
      {
        slug: "thecall",
        href: "/play/thecall",
        name: "The Call",
        blurb: "Pyth-settled earnings and price prediction markets.",
      },
    ],
  },
];

export const COMPANIONS: ModuleDef[] = [
  {
    slug: "opening-bell",
    href: "/opening-bell",
    name: "Opening Bell",
    blurb: "A Meteora DBC equity launchpad, live on devnet.",
  },
  {
    slug: "launch",
    href: "/launch",
    name: "Agent Launch",
    blurb: "Launch a stock-paired agent token with Clawpump and Meteora.",
  },
];

/** Kept for existing single-companion references. */
export const COMPANION: ModuleDef = COMPANIONS[0];

/** Flat lookup of every module by href, companions included. */
export function findModule(href: string): ModuleDef | undefined {
  const comp = COMPANIONS.find((c) => c.href === href);
  if (comp) return comp;
  for (const pillar of PILLARS) {
    const hit = pillar.modules.find((m) => m.href === href);
    if (hit) return hit;
  }
  return undefined;
}
