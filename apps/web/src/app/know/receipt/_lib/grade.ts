// Trust grade for a Receipt row. Pure function of the normalized data, driven by
// real signals: is there a published proof of reserve, an independent audit, a
// named custodian, legal isolation and how far the traded price has drifted from
// mark. Backing transparency dominates the score, because that is the thing that
// went missing in the May 2026 pre-IPO token collapse.

import type { ReceiptRow } from "./types";

export type Letter = "A" | "B" | "C" | "D" | "F";

export interface GradeSignal {
  key: string;
  label: string;
  state: "pass" | "fail" | "unknown";
  detail: string;
}

export interface Grade {
  score: number; // 0..100
  letter: Letter;
  signals: GradeSignal[];
  verdict: string; // one plain-English line
}

// Points per signal. Backing proof, audit, custody and legal isolation are the
// four that separate a real receipt from a claim. Price drift is a smaller risk
// flag on top.
const W_PROOF = 35;
const W_AUDIT = 25;
const W_CUSTODY = 15;
const W_LEGAL = 10;
const W_PRICE = 15;

// Price drift hits zero once the token trades 25% or more away from mark.
const DRIFT_ZERO = 0.25;

function letterFor(score: number): Letter {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function priceComponent(premiumPct: number | null): number {
  if (premiumPct === null) return 0; // no traded price to check drift against
  const drift = Math.min(Math.abs(premiumPct), DRIFT_ZERO);
  return W_PRICE * (1 - drift / DRIFT_ZERO);
}

export function gradeRow(row: ReceiptRow): Grade {
  const b = row.backing;

  let score = 0;
  if (b.hasProof) score += W_PROOF;
  if (b.auditor) score += W_AUDIT;
  if (b.custodian) score += W_CUSTODY;
  if (b.legalStructure) score += W_LEGAL;
  score += priceComponent(row.premiumPct);
  score = Math.round(score);

  const signals: GradeSignal[] = [
    {
      key: "proof",
      label: "Proof of reserve",
      state: b.hasProof ? "pass" : "fail",
      detail: b.hasProof
        ? `${b.kind === "chainlink-por" ? "Chainlink PoR" : "published"}, refreshed monthly`
        : "none published",
    },
    {
      key: "audit",
      label: "Independent audit",
      state: b.auditor ? "pass" : "fail",
      detail: b.auditor
        ? `${b.auditor}${b.auditId ? ` (${b.auditId})` : ""}`
        : "none published",
    },
    {
      key: "custody",
      label: "Named custodian",
      state: b.custodian ? "pass" : "fail",
      detail: b.custodian ?? "not disclosed",
    },
    {
      key: "legal",
      label: "Legal isolation",
      state: b.legalStructure ? "pass" : "fail",
      detail: b.legalStructure ?? "not disclosed",
    },
    {
      key: "price",
      label: "Price vs mark",
      state:
        row.premiumPct === null
          ? "unknown"
          : Math.abs(row.premiumPct) <= 0.1
            ? "pass"
            : "fail",
      detail:
        row.premiumPct === null
          ? "no live token price in API"
          : `${row.premiumPct >= 0 ? "+" : ""}${(row.premiumPct * 100).toFixed(1)}% vs mark`,
    },
  ];

  const letter = letterFor(score);
  const verdict = verdictFor(letter, b.hasProof, row.premiumPct);

  return { score, letter, signals, verdict };
}

function verdictFor(
  letter: Letter,
  hasProof: boolean,
  premiumPct: number | null
): string {
  if (!hasProof) {
    return "No backing proof is published, so the 1:1 claim cannot be checked from any public source.";
  }
  const drift =
    premiumPct !== null && Math.abs(premiumPct) > 0.1
      ? " The token is trading well away from mark, so watch the premium."
      : "";
  if (letter === "A") {
    return `Backing is provable: proof of reserve, an independent audit, named custody and legal isolation all check out.${drift}`;
  }
  return `Some backing proof exists but not the full set.${drift}`;
}
