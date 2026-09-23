"use client";

import { useState } from "react";
import { ArrowDownToLine, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/solana/WalletButton";

import { formatUnits, tryParseUnits } from "../_lib/format";
import type { ActionResult } from "../_lib/types";
import { Field } from "./Field";
import { TxResult } from "./TxResult";

// Deposit a rebasing stock token into the vault. The stock mint is lifted to the
// dashboard so the position and claim panels read the same mint. Decimals come
// from the mint account on chain, so the amount parses to exact base units.
export function DepositCard({
  stockMint,
  onStockMintChange,
  stockDecimals,
  stockMintValid,
  connected,
  disabled,
  busy,
  onDeposit,
  result,
}: {
  stockMint: string;
  onStockMintChange: (value: string) => void;
  stockDecimals: number | null;
  stockMintValid: boolean;
  connected: boolean;
  disabled: boolean;
  busy: boolean;
  onDeposit: (amountBaseUnits: bigint) => void;
  result: ActionResult | null;
}) {
  const [amount, setAmount] = useState("");

  const decimalsKnown = stockDecimals != null;
  const parsed = decimalsKnown ? tryParseUnits(amount, stockDecimals) : null;
  const canDeposit =
    connected && !disabled && !busy && decimalsKnown && parsed != null && parsed > 0n;

  let mintHint = "The SPL mint of your rebasing stock token on devnet.";
  if (stockMintValid && !decimalsKnown) {
    mintHint = "Mint not found on devnet. Check the address or the cluster.";
  } else if (decimalsKnown) {
    mintHint = `Found on devnet, ${stockDecimals} decimals.`;
  }

  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow">
      <h2 className="text-sm font-semibold">Deposit a rebasing stock token</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Your tokens move into a program-owned vault and open a position at the 1.0x
        baseline. Later rebases accrue as claimable USDC.
      </p>

      <div className="mt-4 space-y-3">
        <Field
          label="Stock token mint"
          value={stockMint}
          onChange={onStockMintChange}
          placeholder="Base58 mint address"
          hint={mintHint}
          mono
          disabled={busy}
        />
        <div>
          <Field
            label="Amount"
            value={amount}
            onChange={setAmount}
            placeholder="0.0"
            inputMode="decimal"
            hint={
              decimalsKnown
                ? `Whole tokens, up to ${stockDecimals} decimals.`
                : "Enter a stock mint above to set the decimals."
            }
            disabled={busy || !decimalsKnown}
          />
          {parsed != null && parsed > 0n && decimalsKnown ? (
            <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">
              {formatUnits(parsed, stockDecimals)} tokens ({parsed.toString()} base
              units)
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {connected ? (
          <Button
            type="button"
            onClick={() => parsed != null && onDeposit(parsed)}
            disabled={!canDeposit}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowDownToLine className="h-4 w-4" aria-hidden />
            )}
            Deposit
          </Button>
        ) : (
          <WalletButton />
        )}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        You sign this deposit in your own wallet. Aadukalam never holds your funds
        or your keys.
      </p>

      <TxResult result={result} />
    </div>
  );
}
