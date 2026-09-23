// Fine Print rights renderer. Turns the registry's rights record into plain
// English a holder can read: what they own, voting, dividends, redemption and
// backing, plus flagged caveats. Every classifier is a pure function driven by
// signals in the verified registry text, so the output is testable and never
// invented. House style: no em dashes, no comma before "and" or "or".

import type {
  BackingKind,
  DividendKind,
  OwnershipKind,
  RedemptionKind,
  RightsField,
  RightsFlag,
  RightsSummary,
  TokenInfo,
  TokenRights,
  VotingKind,
} from "./types";

function lc(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

/** All three holder-facing rights fields absent means we have nothing verified. */
function rightsAllNull(r: TokenRights): boolean {
  return r.voting == null && r.dividends == null && r.redemption == null;
}

export function classifyOwnership(r: TokenRights): OwnershipKind {
  if (rightsAllNull(r)) return "unverified";
  const red = lc(r.redemption);
  if (
    red.includes("real underlying share") ||
    red.includes("security entitlement") ||
    red.includes("acats")
  ) {
    return "real-shares";
  }
  return "synthetic";
}

export function classifyVoting(voting: boolean | null): VotingKind {
  if (voting === true) return "yes";
  if (voting === false) return "no";
  return "undisclosed";
}

export function classifyDividends(dividends: string | null): DividendKind {
  if (dividends == null) return "none";
  const s = dividends.toLowerCase();
  if (s.includes("rebase")) return "rebase";
  if (s.includes("reinvest")) return "reinvested";
  if (s.includes("cash")) return "cash";
  return "none";
}

export function classifyRedemption(redemption: string | null): RedemptionKind {
  if (redemption == null) return "undisclosed";
  const s = redemption.toLowerCase();
  if (s.includes("expire worthless") || s.includes("mandatory swap")) return "mandatory-swap";
  if (
    s.includes("real underlying share") ||
    s.includes("acats") ||
    s.includes("security entitlement")
  ) {
    return "to-real-shares";
  }
  if (s.includes("no share") || s.includes("cannot transfer to a traditional brokerage")) {
    return "none";
  }
  if (s.includes("cash")) return "to-cash";
  return "undisclosed";
}

export function classifyBacking(backing: string | null): BackingKind {
  const s = lc(backing);
  if (!s || s.includes("not verified")) return "unverified";
  if (s.includes("real share") && (s.includes("broker-dealer") || s.includes("custody"))) {
    return "real-share-custody";
  }
  return "collateralized";
}

const OWNERSHIP_LABEL: Record<OwnershipKind, { label: string; tone: RightsField<OwnershipKind>["tone"] }> = {
  "real-shares": { label: "Real share", tone: "positive" },
  synthetic: { label: "Synthetic exposure", tone: "caution" },
  unverified: { label: "Rights unknown", tone: "negative" },
};

const VOTING_LABEL: Record<VotingKind, { label: string; tone: RightsField<VotingKind>["tone"] }> = {
  yes: { label: "Yes", tone: "positive" },
  no: { label: "No", tone: "negative" },
  undisclosed: { label: "Not disclosed", tone: "caution" },
};

const DIVIDEND_LABEL: Record<DividendKind, { label: string; tone: RightsField<DividendKind>["tone"] }> = {
  rebase: { label: "On-chain rebase, balance grows", tone: "neutral" },
  reinvested: { label: "Auto-reinvested, no cash", tone: "neutral" },
  cash: { label: "Paid as cash", tone: "positive" },
  none: { label: "None disclosed", tone: "caution" },
};

const REDEMPTION_LABEL: Record<RedemptionKind, { label: string; tone: RightsField<RedemptionKind>["tone"] }> = {
  "to-real-shares": { label: "Into a real share", tone: "positive" },
  "to-cash": { label: "Into cash only", tone: "neutral" },
  "mandatory-swap": { label: "Forced conversion or expiry", tone: "negative" },
  none: { label: "No path to a real share", tone: "negative" },
  undisclosed: { label: "Not disclosed", tone: "caution" },
};

const BACKING_LABEL: Record<BackingKind, { label: string; tone: RightsField<BackingKind>["tone"] }> = {
  "real-share-custody": { label: "Real share in broker-dealer custody", tone: "positive" },
  collateralized: { label: "Collateralized claim, not the share", tone: "caution" },
  unverified: { label: "Backing not verified", tone: "negative" },
};

function field<K extends string>(
  kind: K,
  map: Record<K, { label: string; tone: RightsField<K>["tone"] }>,
  detail: string | null,
  fallbackDetail: string,
): RightsField<K> {
  const { label, tone } = map[kind];
  return { kind, label, tone, detail: detail ?? fallbackDetail };
}

/** One-line reading, keyed on what actually distinguishes the wrapper. */
export function headlineFor(
  ownership: OwnershipKind,
  redemption: RedemptionKind,
): string {
  if (ownership === "unverified") {
    return "Rights not verified. Treat as unknown until the issuer terms are confirmed.";
  }
  if (ownership === "real-shares") {
    return "A real share you can redeem and move to a brokerage.";
  }
  if (redemption === "mandatory-swap") {
    return "Price exposure with a hard conversion deadline, not a share.";
  }
  if (redemption === "to-cash") {
    return "Price exposure only. You can redeem for cash, never for the share.";
  }
  return "Price exposure only. Your claim runs against the issuer, not the company.";
}

/** Caveats worth surfacing. Driven by issuer plus verified text, ordered by severity. */
export function deriveFlags(token: TokenInfo): RightsFlag[] {
  const flags: RightsFlag[] = [];
  const issuer = token.issuer.toLowerCase();
  const backing = lc(token.rights.backing);
  const redemption = lc(token.rights.redemption);

  if (issuer.includes("xstocks") || issuer.includes("backed assets")) {
    flags.push({
      tone: "negative",
      text: "Issuer-controlled token. Every xStock mint carries a permanent delegate, a pause switch and a default-frozen state, so the issuer can freeze your balance, claw it back or halt transfers.",
    });
  }
  if (redemption.includes("expire worthless") || redemption.includes("mandatory swap")) {
    flags.push({
      tone: "negative",
      text: "Mandatory conversion deadline. The tokens expire worthless if the swap is not completed in time.",
    });
  }
  if (backing.includes("unsecured creditor")) {
    flags.push({
      tone: "caution",
      text: "You are an unsecured creditor of the issuer, not a shareholder of the company.",
    });
  }
  if (!backing || backing.includes("not verified")) {
    flags.push({
      tone: "caution",
      text: "Backing is not independently verified in our registry.",
    });
  }
  if (redemption.includes("non-us") || redemption.includes("eligible non-us")) {
    flags.push({
      tone: "neutral",
      text: "Redemption is limited to eligible non-US clients who complete onboarding.",
    });
  }
  return flags;
}

/** The full plain-English reading of a known tokenized-stock. */
export function summarizeRights(token: TokenInfo): RightsSummary {
  const r = token.rights;
  const ownership = classifyOwnership(r);
  const voting = classifyVoting(r.voting);
  const dividends = classifyDividends(r.dividends);
  const redemption = classifyRedemption(r.redemption);
  const backing = classifyBacking(r.backing);

  return {
    ticker: token.ticker,
    name: token.name,
    issuer: token.issuer,
    mint: token.mint,
    headline: headlineFor(ownership, redemption),
    ownership: field(ownership, OWNERSHIP_LABEL, null, ownershipDetail(ownership)),
    voting: field(voting, VOTING_LABEL, null, votingDetail(voting)),
    dividends: field(dividends, DIVIDEND_LABEL, r.dividends, "No dividend mechanism disclosed."),
    redemption: field(redemption, REDEMPTION_LABEL, r.redemption, "No redemption path disclosed."),
    backing: field(backing, BACKING_LABEL, r.backing, "Backing not described."),
    flags: deriveFlags(token),
  };
}

function ownershipDetail(kind: OwnershipKind): string {
  if (kind === "real-shares") return "The token redeems into a real share you can hold at a brokerage.";
  if (kind === "synthetic") return "The token tracks the price. You hold a claim on the issuer, not the share.";
  return "The issuer terms were not verified, so what you own is unknown.";
}

function votingDetail(kind: VotingKind): string {
  if (kind === "yes") return "The wrapper passes shareholder voting through to the holder.";
  if (kind === "no") return "No shareholder voting. A tokenized stock is not the underlying share.";
  return "The issuer terms do not state whether voting passes through.";
}
