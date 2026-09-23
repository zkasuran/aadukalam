"use client";

// One holding rendered as a plain-English rights card. Handles both a
// recognized tokenized stock and an unrecognized mint (rights unknown).
// House style: no em dashes, no comma before "and" or "or".

import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Coins,
  ExternalLink,
  HelpCircle,
  Vote,
} from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { explorerAddressUrl, shortenAddress } from "@aadukalam/sdk";

import type { HoldingView, RightsField, RightsSummary } from "../_lib/types";
import { tonePill } from "./tone";

function amount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function FieldRow({
  icon: Icon,
  title,
  field,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  field: RightsField<string>;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-background/40 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tonePill(field.tone)}`}>
            {field.label}
          </span>
        </div>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{field.detail}</p>
      </div>
    </div>
  );
}

function Rights({ rights }: { rights: RightsSummary }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <FieldRow icon={Vote} title="Voting" field={rights.voting} />
      <FieldRow icon={Coins} title="Dividends" field={rights.dividends} />
      <FieldRow icon={ArrowLeftRight} title="Redemption" field={rights.redemption} />
      <FieldRow icon={Building2} title="Backing" field={rights.backing} />
    </div>
  );
}

export function RightsCard({ view }: { view: HoldingView }) {
  if (!view.known) {
    const { balance } = view;
    return (
      <Card className="border-dashed p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-semibold">Unrecognized mint</p>
              <p className="text-sm text-muted-foreground">Rights unknown. Not in the verified registry.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm">{amount(balance.uiAmount)}</p>
            <a
              href={explorerAddressUrl(balance.mint, "mainnet-beta")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {shortenAddress(balance.mint, 5)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>
    );
  }

  const { token, rights, balance } = view;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{token.ticker}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tonePill(rights.ownership.tone)}`}>
              {rights.ownership.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{token.name}</p>
          <Badge variant="secondary" className="mt-2 font-normal">{token.issuer}</Badge>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
          <p className="font-mono text-lg font-semibold">{amount(balance.uiAmount)}</p>
          <a
            href={explorerAddressUrl(token.mint, "mainnet-beta")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {shortenAddress(token.mint, 5)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium">{rights.headline}</p>

      <div className="mt-4">
        <Rights rights={rights} />
      </div>

      {rights.flags.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rights.flags.map((flag, i) => (
            <li key={i} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${tonePill(flag.tone)}`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{flag.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
