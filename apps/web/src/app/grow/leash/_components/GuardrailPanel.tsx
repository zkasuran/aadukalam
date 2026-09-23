"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { usd } from "@/lib/format";

import { availableTickers } from "../_lib/policy";
import type { GuardrailPolicy, SessionLedger } from "../_lib/types";

// The guardrail config panel. Editing here changes the policy the pure enforce()
// gate runs against, on the server for the chat agent and on the client for the
// manual form. The session ledger is editable too, so the daily budget and max
// position refusals can be demonstrated without spending anything on-chain.

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center rounded-md border border-input bg-background px-2">
        <span className="text-sm text-muted-foreground">$</span>
        <input
          type="number"
          min={0}
          step="any"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full bg-transparent px-1 py-1.5 text-sm tabular-nums outline-none"
        />
      </div>
      {hint ? <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{hint}</span> : null}
    </label>
  );
}

export function GuardrailPanel({
  policy,
  onChange,
  ledger,
  onLedgerChange,
}: {
  policy: GuardrailPolicy;
  onChange: (p: GuardrailPolicy) => void;
  ledger: SessionLedger;
  onLedgerChange: (l: SessionLedger) => void;
}) {
  const tickers = useMemo(() => availableTickers(), []);
  const [posTicker, setPosTicker] = useState<string>(policy.allowlist[0] ?? tickers[0] ?? "");
  const [posUsd, setPosUsd] = useState<number>(0);

  const selected = new Set(policy.allowlist.map((t) => t.toLowerCase()));

  function toggleTicker(t: string) {
    const next = selected.has(t.toLowerCase())
      ? policy.allowlist.filter((x) => x.toLowerCase() !== t.toLowerCase())
      : [...policy.allowlist, t];
    onChange({ ...policy, allowlist: next });
  }

  const positions = Object.entries(ledger.positionsUsd).filter(([, v]) => v > 0);

  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Guardrails</h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          enforced in code
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Hard limits the agent cannot cross. Every proposed trade is checked against
        these before any transaction is built.
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Ticker allowlist ({policy.allowlist.length})
          </span>
          {policy.allowlist.length > 0 ? (
            <button
              onClick={() => onChange({ ...policy, allowlist: [] })}
              className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
            >
              clear
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-2">
          {tickers.map((t) => {
            const on = selected.has(t.toLowerCase());
            return (
              <button
                key={t}
                onClick={() => toggleTicker(t)}
                className={
                  on
                    ? "rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary"
                    : "rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <NumberField
          label="Max position per ticker"
          value={policy.maxPositionUsd}
          onChange={(n) => onChange({ ...policy, maxPositionUsd: n })}
          hint="total USD allowed in any one name"
        />
        <NumberField
          label="Daily budget"
          value={policy.dailyBudgetUsd}
          onChange={(n) => onChange({ ...policy, dailyBudgetUsd: n })}
          hint="total USD the agent may buy in a day"
        />
        <NumberField
          label="Per-trade cap"
          value={policy.perTradeCapUsd}
          onChange={(n) => onChange({ ...policy, perTradeCapUsd: n })}
          hint="largest single trade"
        />
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Session ledger</span>
          <button
            onClick={() => onLedgerChange({ spentTodayUsd: 0, positionsUsd: {} })}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            reset
          </button>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
          Tracked in this session, not read on-chain. Edit to model your exposure.
        </p>

        <label className="mt-2 block">
          <span className="text-[11px] text-muted-foreground">Spent today</span>
          <div className="mt-1 flex items-center rounded-md border border-input bg-background px-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              step="any"
              value={ledger.spentTodayUsd}
              onChange={(e) =>
                onLedgerChange({ ...ledger, spentTodayUsd: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-full bg-transparent px-1 py-1 text-sm tabular-nums outline-none"
            />
          </div>
        </label>

        {positions.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {positions.map(([t, v]) => (
              <li key={t} className="flex items-center justify-between text-[11px]">
                <span className="uppercase text-muted-foreground">{t}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-foreground">{usd(v)}</span>
                  <button
                    onClick={() => {
                      const next = { ...ledger.positionsUsd };
                      delete next[t];
                      onLedgerChange({ ...ledger, positionsUsd: next });
                    }}
                    className="text-muted-foreground hover:text-red-400"
                    aria-label={`remove ${t} position`}
                  >
                    x
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2 flex items-end gap-2">
          <label className="flex-1">
            <span className="text-[11px] text-muted-foreground">Set position</span>
            <select
              value={posTicker}
              onChange={(e) => setPosTicker(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none"
            >
              {tickers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center rounded-md border border-input bg-background px-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min={0}
              step="any"
              value={posUsd}
              onChange={(e) => setPosUsd(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 bg-transparent px-1 py-1 text-sm tabular-nums outline-none"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (!posTicker) return;
              onLedgerChange({
                ...ledger,
                positionsUsd: { ...ledger.positionsUsd, [posTicker.toLowerCase()]: posUsd },
              });
            }}
          >
            set
          </Button>
        </div>
      </div>
    </div>
  );
}
