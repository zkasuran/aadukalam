"use client";

// The funded step, gated. The paid launch spends REAL mainnet SOL from a real
// Solana keypair, so the app never fires it. This surfaces the exact two-step
// command and the SOL amount as a handoff, behind an explicit reveal so a click
// can never move funds.

import { useState } from "react";
import { AlertTriangle, Copy, Check, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PreflightResult } from "@/app/api/clawpump/_lib/clawpump";
import { buildFireCommand } from "../_lib/client";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older/insecure contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy command"}
    </Button>
  );
}

export function FundedHandoff({ result }: { result: PreflightResult }) {
  const [revealed, setRevealed] = useState(false);
  const command = buildFireCommand(result);

  if (!command || !result.payment) return null;
  const { amountSol } = result.payment;

  return (
    <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-destructive">
            Funded step: this spends {amountSol} SOL of real mainnet funds
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            The preflight above is free and moved nothing. The real launch pays{" "}
            {amountSol} SOL from a funded Solana keypair, so it is a hand-off, not
            a button. Reveal the exact command, run it from your own funded wallet
            when you mean to pay. This app never signs and never holds your key.
          </p>
        </div>
      </div>

      {!revealed ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setRevealed(true)}
        >
          <Terminal className="h-3.5 w-3.5" aria-hidden />
          Reveal the funded-launch command
        </Button>
      ) : (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Two-step funded launch
            </span>
            <CopyButton text={command} />
          </div>
          <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] leading-relaxed">
            <code>{command}</code>
          </pre>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
            The launch body is byte-identical to the preflight, because the
            preflight token is signed over it. Paste the step-1 signature into
            step 2 within the validity window. On success ClawPump returns the new
            mint address, the pump URL and the Meteora pool.
          </p>
        </div>
      )}
    </div>
  );
}
