"use client";

import {
  Check,
  ExternalLink,
  Minus,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import type { JupiterPriceInfo } from "@aadukalam/sdk";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { ReceiptRow } from "../_lib/types";
import { gradeRow, type GradeSignal } from "../_lib/grade";
import {
  fmtCount,
  fmtInt,
  fmtMultiple,
  fmtPrice,
  fmtUsd,
  shortMint,
} from "../_lib/format";
import { PremiumBar } from "./PremiumBar";
import { StatTile } from "./StatTile";
import { TesseraActions } from "./TesseraActions";
import { TrustBadge } from "./TrustBadge";

function SignalIcon({ state }: { state: GradeSignal["state"] }) {
  if (state === "pass")
    return <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />;
  if (state === "fail")
    return <X className="h-4 w-4 shrink-0 text-red-400" aria-hidden />;
  return (
    <Minus className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
  );
}

function SignalRow({ signal }: { signal: GradeSignal }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="mt-0.5">
        <SignalIcon state={signal.state} />
      </span>
      <span className="flex-1 leading-snug">
        <span className="text-foreground">{signal.label}:</span>{" "}
        <span className="text-muted-foreground">{signal.detail}</span>
      </span>
    </li>
  );
}

function DetailLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="flex-1 text-foreground">{v}</dd>
    </div>
  );
}

function ProofLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function BackingBlock({ row }: { row: ReceiptRow }) {
  const b = row.backing;
  if (!b.hasProof) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3">
        <div className="flex items-center gap-2 text-red-400">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <span className="text-sm font-semibold">
            No backing proof published
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {b.note}
        </p>
      </div>
    );
  }

  const auditValue = `${b.auditor ?? ""}${b.auditId ? ` (${b.auditId})` : ""}${
    b.auditFindings ? `, ${b.auditFindings}` : ""
  }`;

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-center gap-2 text-emerald-400">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        <span className="text-sm font-semibold">Backing proof published</span>
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        {b.custodian ? <DetailLine k="Custody" v={b.custodian} /> : null}
        {b.legalStructure ? (
          <DetailLine k="Legal isolation" v={b.legalStructure} />
        ) : null}
        {b.auditor ? <DetailLine k="Audit" v={auditValue} /> : null}
      </dl>
      <div className="mt-2 flex flex-wrap gap-2">
        {b.feedUrl ? (
          <ProofLink href={b.feedUrl} label="Chainlink PoR feed" />
        ) : null}
        {b.proofUrl ? <ProofLink href={b.proofUrl} label="Audit report" /> : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {b.note}
      </p>
    </div>
  );
}

export function ScoreCard({
  row,
  livePrice = null,
  pricedAt = null,
}: {
  row: ReceiptRow;
  livePrice?: JupiterPriceInfo | null;
  pricedAt?: number | null;
}) {
  const grade = gradeRow(row);
  const headlineVal = row.impliedValuation ?? row.markValuation;
  const gapMultiple = fmtMultiple(headlineVal, row.onChainMktCap);

  const supplyNote = [
    `Supply ${fmtCount(row.supply)} tokens`,
    row.companyShares !== null
      ? `implies ${fmtCount(row.companyShares)} company shares`
      : null,
    row.recentVolume != null
      ? `latest daily volume ${fmtCount(row.recentVolume)}${
          row.recentVolumeDate ? ` on ${row.recentVolumeDate}` : ""
        }`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold">{row.company}</h3>
            <Badge variant="secondary" className="shrink-0">
              {row.symbol}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.sector ? `${row.sector} · ` : ""}mint {shortMint(row.mint)}
          </p>
        </div>
        <TrustBadge grade={grade} />
      </div>

      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <p className="text-sm leading-snug text-muted-foreground">
          {grade.verdict}
        </p>

        <ul className="space-y-1.5">
          {grade.signals.map((s) => (
            <SignalRow key={s.key} signal={s} />
          ))}
        </ul>

        {row.premiumPct !== null ? (
          <PremiumBar premiumPct={row.premiumPct} />
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatTile label="Token price" value={fmtPrice(row.price)} />
          <StatTile label="Mark price" value={fmtPrice(row.markPrice)} />
          {row.holders !== null ? (
            <StatTile label="Holders" value={fmtInt(row.holders)} />
          ) : null}
          <StatTile
            label={
              row.impliedValuation !== null
                ? "Implied valuation"
                : "Mark valuation"
            }
            value={fmtUsd(headlineVal)}
            hint={
              row.impliedValuation === null
                ? "reference, not a live oracle"
                : undefined
            }
          />
          <StatTile
            label="Value on chain"
            value={fmtUsd(row.onChainMktCap)}
            hint="supply x price"
          />
          <StatTile
            label="Reality gap"
            value={gapMultiple}
            tone="warn"
            hint="implied vs on chain"
          />
        </div>

        <p className="text-[11px] leading-tight text-muted-foreground/70">
          {supplyNote}.
        </p>

        <BackingBlock row={row} />

        {row.provider === "tessera" ? (
          <TesseraActions row={row} livePrice={livePrice} pricedAt={pricedAt} />
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-1 text-xs">
          <a
            href={`https://solscan.io/token/${row.mint}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            View mint <ExternalLink className="h-3 w-3" />
          </a>
          {row.externalUrl ? (
            <a
              href={row.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Issuer page <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
