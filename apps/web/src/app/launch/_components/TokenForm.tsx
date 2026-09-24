"use client";

// The token identity form: name, symbol, description and the funded payer wallet.
// Pure controlled inputs, no funds, no network. The parent runs the preflight.

import { useWallet } from "@solana/wallet-adapter-react";

import { WalletButton } from "@/components/solana/WalletButton";

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export interface TokenFormValues {
  name: string;
  symbol: string;
  description: string;
  walletAddress: string;
}

export function TokenForm({
  values,
  onChange,
  pairSymbol,
}: {
  values: TokenFormValues;
  onChange: (patch: Partial<TokenFormValues>) => void;
  pairSymbol: string;
}) {
  const { publicKey } = useWallet();
  const descLen = values.description.trim().length;
  const descOk = descLen >= 20 && descLen <= 500;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Token name</span>
          <input
            className={inputClass}
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Aadukalam Tesla Agent"
            maxLength={64}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Token symbol</span>
          <input
            className={`${inputClass} font-mono uppercase`}
            value={values.symbol}
            onChange={(e) => onChange({ symbol: e.target.value.toUpperCase().slice(0, 10) })}
            placeholder="aTSLA"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="flex items-center justify-between font-medium">
          <span>Description</span>
          <span className={`text-xs font-normal ${descOk ? "text-muted-foreground" : "text-amber-400"}`}>
            {descLen}/500 (min 20)
          </span>
        </span>
        <textarea
          className={`${inputClass} resize-none`}
          rows={3}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value.slice(0, 500) })}
          placeholder={`A stocknized agent token paired against ${pairSymbol || "a tokenized stock"}, launched via ClawPump on a Meteora dynamic bonding curve.`}
        />
      </label>

      <label className="block text-sm">
        <span className="flex items-center justify-between font-medium">
          <span>Funded payer wallet (Solana)</span>
          {publicKey ? (
            <button
              type="button"
              className="text-xs font-normal text-primary hover:underline"
              onClick={() => onChange({ walletAddress: publicKey.toBase58() })}
            >
              use connected wallet
            </button>
          ) : null}
        </span>
        <input
          className={`${inputClass} font-mono`}
          value={values.walletAddress}
          onChange={(e) => onChange({ walletAddress: e.target.value.trim() })}
          placeholder="Solana base58 address that pays the fee and earns creator fees"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          This wallet pays the SOL launch fee and receives the token&apos;s 75%
          creator-fee share, paid in the paired stock. The preflight only reads
          it, it signs nothing.
        </span>
      </label>

      {!publicKey ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Optional:</span>
          <WalletButton />
          <span>to fill the payer from your wallet.</span>
        </div>
      ) : null}
    </div>
  );
}
