"use client";

// Compare panel: the "same ticker, very different fine print" view. Groups every
// wrapper of one underlying (SpaceX has five) and lines their rights up side by
// side, straight from the verified registry. House style: no em dashes, no comma
// before "and" or "or".

import { CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";

import { multiWrapperGroups, type UnderlyingGroup } from "../_lib/grouping";
import { summarizeRights } from "../_lib/rights";
import type { RightsField, RightsSummary, TokenInfo } from "../_lib/types";
import { tonePill } from "./tone";

const ROWS: { title: string; pick: (s: RightsSummary) => RightsField<string> }[] = [
  { title: "What you own", pick: (s) => s.ownership },
  { title: "Voting", pick: (s) => s.voting },
  { title: "Dividends", pick: (s) => s.dividends },
  { title: "Redemption", pick: (s) => s.redemption },
  { title: "Backing", pick: (s) => s.backing },
];

function Cell({ field }: { field: RightsField<string> }) {
  return (
    <td className="min-w-[220px] border-t border-border p-3 align-top">
      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${tonePill(field.tone)}`}>
        {field.label}
      </span>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{field.detail}</p>
    </td>
  );
}

function GroupTable({ group, heldMints }: { group: UnderlyingGroup; heldMints: Set<string> }) {
  const summaries = group.tokens.map((t) => ({ token: t, rights: summarizeRights(t) }));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-border p-4">
        <h3 className="text-lg font-semibold">{group.label}</h3>
        <span className="text-sm text-muted-foreground">
          {group.tokens.length} wrappers, one underlying, different fine print
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[130px] bg-card p-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                Rights
              </th>
              {summaries.map(({ token }) => (
                <th key={token.mint} className="min-w-[220px] p-3 text-left align-bottom">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{token.ticker}</span>
                    {heldMints.has(token.mint) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        You hold this
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">{token.issuer}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.title}>
                <th className="sticky left-0 z-10 bg-card p-3 text-left align-top text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {row.title}
                </th>
                {summaries.map(({ token, rights }) => (
                  <Cell key={token.mint} field={row.pick(rights)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ComparePanel({
  tokens,
  heldMints,
}: {
  tokens: TokenInfo[];
  heldMints: Set<string>;
}) {
  const groups = multiWrapperGroups(tokens);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The same company, wrapped by different issuers, is not the same asset. SpaceX trades on Solana
        under five wrappers. One is a real share you can pull into a brokerage. The rest are price
        exposure with the claim running against an issuer or an SPV.
      </p>
      {groups.map((group) => (
        <GroupTable key={group.key} group={group} heldMints={heldMints} />
      ))}
    </div>
  );
}
