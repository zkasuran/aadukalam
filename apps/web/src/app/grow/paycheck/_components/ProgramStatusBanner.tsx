"use client";

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { explorerAddress } from "../_lib/constants";
import { shortAddress } from "../_lib/format";
import type { DeployStatus } from "../_lib/types";

// The deployment gate. The dashboard fetches the program account on the active
// cluster and passes the result here. When the program is not deployed the app
// says so plainly instead of erroring on every read.
export function ProgramStatusBanner({
  status,
  programId,
  onRetry,
}: {
  status: DeployStatus;
  programId: string;
  onRetry: () => void;
}) {
  const idLink = (
    <a
      href={explorerAddress(programId)}
      target="_blank"
      rel="noreferrer"
      className="font-mono underline underline-offset-2"
    >
      {shortAddress(programId, 8, 8)}
    </a>
  );

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span>Checking whether Paycheck is deployed on devnet...</span>
      </div>
    );
  }

  if (status === "deployed") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/90">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Program live on devnet at {idLink}</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-200/90">
        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Could not reach the devnet RPC to check the program.</span>
        <button onClick={onRetry} className="underline underline-offset-2">
          retry
        </button>
      </div>
    );
  }

  // absent
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-xs text-amber-200/90">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Program not yet deployed to devnet.</p>
          <p className="mt-1 leading-relaxed text-amber-200/70">
            The Paycheck program at {idLink} is built and tested but not yet live
            on this cluster, a SOL-funding step for the deploy is pending. The flow
            below builds every transaction correctly, so it will work as soon as
            the program is deployed. Actions stay disabled until then.
          </p>
          <button onClick={onRetry} className="mt-2 underline underline-offset-2">
            check again
          </button>
        </div>
      </div>
    </div>
  );
}
