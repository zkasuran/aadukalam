"use client";

import { Banknote, ExternalLink } from "lucide-react";

import { explorerTx } from "../_lib/constants";
import { formatMultiplier } from "../_lib/math";
import { formatUsdc, shortAddress } from "../_lib/format";
import type { RebaseEntry } from "../_lib/types";

// Rebases recorded in this session. Each row is a real signed transaction on
// devnet with an explorer link. The list is session memory, not an on-chain
// query: the program stores the current position, so a production keeper would
// persist the full ledger or emit an event for a durable history.
export function RebaseHistory({ entries }: { entries: RebaseEntry[] }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Dividend history</h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          recorded this session
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No rebases recorded yet. Use the keeper panel to record one, then it
          shows here with its transaction and the USDC it credited.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.signature}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold tabular-nums text-primary">
                    {formatUsdc(entry.dividendUsdcBaseUnits)}
                  </p>
                  <p className="text-[10px] tabular-nums text-muted-foreground/70">
                    {formatMultiplier(entry.oldMultiplierBps)} to{" "}
                    {formatMultiplier(entry.newMultiplierBps)} for{" "}
                    {shortAddress(entry.user, 4, 4)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground/70">
                  {new Date(entry.recordedAt).toLocaleTimeString()}
                </p>
                <a
                  href={explorerTx(entry.signature)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] underline underline-offset-2"
                >
                  tx <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
