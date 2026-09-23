"use client";

// Holdings panel: the result of a scan. Shows a summary strip and one rights
// card per balance, recognized first. House style: no em dashes, no comma
// before "and" or "or".

import { Loader2, SearchX, WalletCards } from "lucide-react";

import type { HoldingsTally } from "../_lib/holdings";
import type { HoldingView } from "../_lib/types";
import { RightsCard } from "./RightsCard";

export type ScanStatus = "idle" | "loading" | "error" | "done";

function Empty({ icon: Icon, title, body }: { icon: typeof WalletCards; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export function HoldingsPanel({
  status,
  error,
  views,
  tally,
}: {
  status: ScanStatus;
  error: string | null;
  views: HoldingView[];
  tally: HoldingsTally;
}) {
  if (status === "idle") {
    return (
      <Empty
        icon={WalletCards}
        title="Read what you actually own"
        body="Connect a wallet or paste an address. Every tokenized-stock balance is matched against the verified registry and read out in plain English."
      />
    );
  }

  if (status === "loading") {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-10 text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Reading balances on Solana mainnet.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        <p className="font-medium">Could not read this address.</p>
        <p className="mt-1 text-red-300/90">{error}</p>
      </div>
    );
  }

  if (tally.total === 0) {
    return (
      <Empty
        icon={SearchX}
        title="No token balances found"
        body="This address holds no SPL or Token-2022 balances right now. Try another address or one that holds a tokenized stock."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat value={tally.total} label="Holdings" />
        <Stat value={tally.recognized} label="Recognized" />
        <Stat value={tally.unrecognized} label="Rights unknown" />
      </div>
      <div className="space-y-3">
        {views.map((view) => (
          <RightsCard
            key={view.known ? view.token.mint : view.balance.mint}
            view={view}
          />
        ))}
      </div>
    </div>
  );
}
