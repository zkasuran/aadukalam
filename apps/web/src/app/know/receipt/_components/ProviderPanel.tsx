"use client";

import type { ReactNode } from "react";

import { AlertTriangle, RefreshCw } from "lucide-react";

import type { ReceiptResponse } from "../_lib/types";
import { ScoreCard } from "./ScoreCard";

function SkeletonCard() {
  return (
    <div className="h-[420px] animate-pulse rounded-xl border border-border bg-card/50" />
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-500/40 bg-red-500/5 text-red-300"
      : "border-amber-500/40 bg-amber-500/5 text-amber-300";
  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function ProviderPanel({
  loading,
  data,
  fetchError,
  summary,
}: {
  loading: boolean;
  data: ReceiptResponse | null;
  fetchError: string | null;
  summary: ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        {summary}
      </div>

      {fetchError ? (
        <Notice tone="error">
          Could not load this provider from the app API: {fetchError}
        </Notice>
      ) : null}

      {data?.error ? (
        <Notice tone="error">{data.error}</Notice>
      ) : null}

      {data?.stale ? (
        <Notice tone="warn">
          Live source is unreachable right now, showing the last good response
          cached at {new Date(data.fetchedAt).toLocaleString()}.
        </Notice>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data && data.rows.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {data.rows.map((row) => (
              <ScoreCard key={`${row.provider}:${row.mint}`} row={row} />
            ))}
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <RefreshCw className="h-3 w-3" aria-hidden />
            {data.rows.length} token{data.rows.length === 1 ? "" : "s"} from{" "}
            {data.source}, fetched{" "}
            {new Date(data.fetchedAt).toLocaleTimeString()}.
          </p>
        </>
      ) : !fetchError && !data?.error ? (
        <p className="text-sm text-muted-foreground">
          No tokens returned by this provider.
        </p>
      ) : null}
    </div>
  );
}
