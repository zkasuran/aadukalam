"use client";

// Address bar: connect a wallet or paste any Solana address, then scan. The
// scan reads real mainnet holdings through the server route.
// House style: no em dashes, no comma before "and" or "or".

import { useWallet } from "@solana/wallet-adapter-react";
import { Search, Wallet } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/solana/WalletButton";
import { isValidSolanaAddress } from "@aadukalam/sdk";

export function AddressBar({
  address,
  setAddress,
  onScan,
  busy,
}: {
  address: string;
  setAddress: (v: string) => void;
  onScan: (address: string) => void;
  busy: boolean;
}) {
  const { publicKey } = useWallet();
  const connected = publicKey?.toBase58() ?? null;

  // When a wallet connects and the box is empty, prefill it with the pubkey.
  useEffect(() => {
    if (connected && address.trim() === "") setAddress(connected);
  }, [connected, address, setAddress]);

  const trimmed = address.trim();
  const valid = trimmed !== "" && isValidSolanaAddress(trimmed);

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <WalletButton />
        <div className="flex flex-1 gap-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid && !busy) onScan(trimmed);
            }}
            placeholder="Paste a Solana wallet address"
            spellCheck={false}
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={() => onScan(trimmed)} disabled={!valid || busy}>
            <Search className="h-4 w-4" />
            {busy ? "Reading" : "Scan"}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {connected && (
          <button
            type="button"
            onClick={() => setAddress(connected)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Wallet className="h-3 w-3" />
            Use connected wallet
          </button>
        )}
        {trimmed !== "" && !valid && (
          <span className="text-red-300">That is not a valid Solana address.</span>
        )}
        <span className="ml-auto">Reads real SPL and Token-2022 balances on Solana mainnet.</span>
      </div>
    </div>
  );
}
