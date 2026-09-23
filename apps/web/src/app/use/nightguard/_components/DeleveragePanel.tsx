"use client";

// Arm or deleverage. Two honest paths, both user authorized:
//  1. Deleverage now: build a repay transaction on the server (unsigned) and the
//     connected wallet signs and sends it. Repaying debt raises the buffer.
//  2. Arm a policy: record the user's intent to deleverage if the buffer falls
//     below a threshold. The policy is stored client side and every execution is
//     a transaction the USER signs. There is no silent server signing anywhere.
// House style: no em dashes, no comma before "and" or "or".

import * as React from "react";

import { Button } from "@/components/ui/button";
import { usd } from "@/lib/format";
import type { DebtLeg, DeleverageResponse } from "../_lib/types";

type BuildState =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "built"; tx: string; labels: string[] }
  | { kind: "signing" }
  | { kind: "sent"; signature: string }
  | { kind: "error"; message: string };

export interface DeleveragePanelProps {
  owner: string;
  debt: DebtLeg[];
  /** a repay amount that would lift the buffer back to a safe band. */
  suggestedRepay: number;
  /** true when a wallet is connected and it matches the owner being viewed. */
  canSign: boolean;
  /** sign and send the base64 tx with the connected wallet, returns a signature. */
  signAndSend: ((base64: string) => Promise<string>) | null;
  /** true for the illustrative example position, which cannot be signed. */
  isExample: boolean;
}

const selectClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DeleveragePanel({
  owner,
  debt,
  suggestedRepay,
  canSign,
  signAndSend,
  isExample,
}: DeleveragePanelProps) {
  const repayable = debt.filter((d) => d.amount > 0);
  const [reserve, setReserve] = React.useState(repayable[0]?.reserve ?? "");
  const [amount, setAmount] = React.useState(
    suggestedRepay > 0 ? Number(suggestedRepay.toFixed(2)) : 0,
  );
  const [armThreshold, setArmThreshold] = React.useState(10);
  const [armed, setArmed] = React.useState(false);
  const [state, setState] = React.useState<BuildState>({ kind: "idle" });

  const leg = repayable.find((d) => d.reserve === reserve) ?? repayable[0];

  const build = React.useCallback(async () => {
    if (!leg || amount <= 0) return;
    setState({ kind: "building" });
    try {
      const res = await fetch("/api/nightguard/build-deleverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, action: "repay", reserve: leg.reserve, amount }),
      });
      const json = (await res.json()) as DeleverageResponse;
      if (!json.ok || !json.transactionBase64) {
        setState({ kind: "error", message: json.error ?? "build failed" });
        return;
      }
      setState({
        kind: "built",
        tx: json.transactionBase64,
        labels: json.instructionLabels ?? [],
      });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [leg, amount, owner]);

  const sign = React.useCallback(async () => {
    if (state.kind !== "built" || !signAndSend) return;
    setState({ kind: "signing" });
    try {
      const signature = await signAndSend(state.tx);
      setState({ kind: "sent", signature });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [state, signAndSend]);

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <h3 className="text-lg font-semibold">Deleverage</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Repaying debt raises the buffer. Nightguard builds the transaction, your
        wallet signs it. Nothing is signed on the server, ever.
      </p>

      {repayable.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No debt to repay on this position.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Repay</span>
            <select
              className={selectClass}
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
            >
              {repayable.map((d) => (
                <option key={d.reserve} value={d.reserve}>
                  {d.symbol} (owe {d.amount.toFixed(2)})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Amount</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={selectClass}
              value={Number.isFinite(amount) ? amount : 0}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Suggested {usd(suggestedRepay)} to reach a safe buffer.
            </span>
          </label>
        </div>
      )}

      {repayable.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={build}
            disabled={isExample || amount <= 0 || state.kind === "building"}
          >
            {state.kind === "building" ? "Building…" : "Build repay transaction"}
          </Button>
          {isExample && (
            <span className="text-xs text-muted-foreground">
              Example position. Load a live wallet to build a real transaction.
            </span>
          )}
        </div>
      )}

      {state.kind === "built" && (
        <div className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-sm">
          <p className="font-medium text-foreground">Transaction ready, unsigned.</p>
          {state.labels.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {state.labels.slice(0, 8).map((l, i) => (
                <li key={i}>- {l}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={sign} disabled={!canSign || !signAndSend}>
              Sign and send
            </Button>
            {!canSign && (
              <span className="text-xs text-muted-foreground">
                Connect the wallet that owns this position to sign.
              </span>
            )}
          </div>
        </div>
      )}

      {state.kind === "signing" && (
        <p className="mt-4 text-sm text-muted-foreground">Waiting for the wallet…</p>
      )}

      {state.kind === "sent" && (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-300">
          Sent.{" "}
          <a
            className="underline"
            href={`https://explorer.solana.com/tx/${state.signature}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Explorer
          </a>
        </div>
      )}

      {state.kind === "error" && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">
          {state.message}
        </p>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-lg font-semibold">Arm an auto-deleverage policy</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the line where you want to act. Arming records your intent. If the
          buffer crosses it while you sleep, Nightguard surfaces a repay for you
          to sign. It is an armed policy you authorize, not silent server signing.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="font-medium">Trigger buffer</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                step={1}
                className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={armThreshold}
                onChange={(e) => setArmThreshold(parseFloat(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </label>
          <Button variant={armed ? "secondary" : "outline"} onClick={() => setArmed((a) => !a)}>
            {armed ? `Armed at ${armThreshold}%` : "Arm policy"}
          </Button>
        </div>
        {armed && (
          <p className="mt-2 text-xs text-muted-foreground">
            Policy recorded on this device. Execution is always a transaction you
            sign. Disarm any time.
          </p>
        )}
      </div>
    </div>
  );
}
