"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { explorerTx } from "../_lib/constants";
import { shortAddress } from "../_lib/format";
import type { ActionResult } from "../_lib/types";

// The inline outcome of a wallet-signed action: a confirmed signature with an
// explorer link. Otherwise the error the chain or the wallet returned.
export function TxResult({ result }: { result: ActionResult | null }) {
  if (!result) return null;

  if (result.ok && result.signature) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/90">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          Confirmed on devnet.{" "}
          <a
            href={explorerTx(result.signature)}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {shortAddress(result.signature, 8, 8)}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-200/90">
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <p className="break-words">{result.error ?? "Transaction failed."}</p>
    </div>
  );
}
