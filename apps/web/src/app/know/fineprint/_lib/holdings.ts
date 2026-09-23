// Fine Print holdings join. Takes the raw balances read off-chain and matches
// each mint to the registry. A recognized mint gets its full rights summary, an
// unrecognized mint is kept and marked "rights unknown" rather than dropped.
// Pure: the registry lookup is passed in, so this is testable without the RPC.
// House style: no em dashes, no comma before "and" or "or".

import type { HoldingBalance, HoldingView, TokenInfo } from "./types";
import { summarizeRights } from "./rights";

type Lookup = (mintOrTicker: string) => TokenInfo | undefined;

/** Join one balance to the registry. Unknown mints keep the balance, no rights. */
export function describeHolding(balance: HoldingBalance, lookup: Lookup): HoldingView {
  const token = lookup(balance.mint);
  if (!token) return { known: false, balance };
  return { known: true, balance, token, rights: summarizeRights(token) };
}

/**
 * Join and order a wallet's balances: recognized tokenized stocks first, then
 * unrecognized mints. Within each group the larger holdings sort first.
 */
export function describeHoldings(balances: HoldingBalance[], lookup: Lookup): HoldingView[] {
  return balances
    .map((b) => describeHolding(b, lookup))
    .sort((a, b) => {
      if (a.known !== b.known) return a.known ? -1 : 1;
      return b.balance.uiAmount - a.balance.uiAmount;
    });
}

/** Counts for the holdings summary strip. */
export interface HoldingsTally {
  total: number;
  recognized: number;
  unrecognized: number;
}

export function tallyHoldings(views: HoldingView[]): HoldingsTally {
  const recognized = views.filter((v) => v.known).length;
  return { total: views.length, recognized, unrecognized: views.length - recognized };
}
