"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, VersionedTransaction, clusterApiUrl } from "@solana/web3.js";

import { WalletButton } from "@/components/solana/WalletButton";

import { DEFAULT_POLICY } from "../_lib/policy";
import { proposeTrade, type TradeInput } from "../_lib/trade";
import type {
  GuardrailPolicy,
  LeashChatResponse,
  ProposedTradeResult,
  SessionLedger,
  UiMessage,
} from "../_lib/types";
import { ChatPanel } from "./ChatPanel";
import { GuardrailPanel } from "./GuardrailPanel";
import { ManualTrade } from "./ManualTrade";
import { ProposedTradeCard } from "./ProposedTradeCard";

// Jupiter swaps are mainnet only, so the signed transaction goes to a mainnet
// RPC even though our own Anchor programs live on devnet.
function mainnetConnection(): Connection {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || clusterApiUrl("mainnet-beta");
  return new Connection(url, "confirmed");
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const EMPTY_LEDGER: SessionLedger = { spentTodayUsd: 0, positionsUsd: {} };

export function LeashConsole() {
  const { publicKey, sendTransaction } = useWallet();
  const [policy, setPolicy] = useState<GuardrailPolicy>(DEFAULT_POLICY);
  const [ledger, setLedger] = useState<SessionLedger>(EMPTY_LEDGER);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [proposed, setProposed] = useState<ProposedTradeResult | null>(null);
  const [llmOffline, setLlmOffline] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signResult, setSignResult] = useState<{ sig?: string; error?: string } | null>(null);

  const sendChat = useCallback(
    async (text: string) => {
      const next: UiMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setBusy(true);
      setSignResult(null);
      try {
        const res = await fetch("/api/leash/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: next,
            policy,
            ledger,
            userPublicKey: publicKey?.toBase58(),
          }),
        });
        const data = (await res.json()) as LeashChatResponse;
        setLlmOffline(data.llmConfigured ? null : (data.message ?? "LLM not configured"));
        const reply = data.reply ?? data.message ?? data.error ?? "No response.";
        setMessages([...next, { role: "assistant", content: reply }]);
        if (data.proposedTrade) setProposed(data.proposedTrade);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "request failed";
        setMessages([...next, { role: "assistant", content: `Request failed: ${msg}` }]);
      } finally {
        setBusy(false);
      }
    },
    [messages, policy, ledger, publicKey],
  );

  const proposeManual = useCallback(
    async (input: TradeInput) => {
      setBusy(true);
      setSignResult(null);
      try {
        const result = await proposeTrade("", policy, ledger, input, publicKey?.toBase58());
        setProposed(result);
      } finally {
        setBusy(false);
      }
    },
    [policy, ledger, publicKey],
  );

  const signAndSend = useCallback(async () => {
    if (!proposed?.tx || !publicKey) return;
    setSigning(true);
    setSignResult(null);
    try {
      const tx = VersionedTransaction.deserialize(b64ToBytes(proposed.tx.swapTransaction));
      const conn = mainnetConnection();
      const sig = await sendTransaction(tx, conn);
      setSignResult({ sig });
      const key = proposed.ticker.toLowerCase();
      setLedger((prev) => {
        const held = prev.positionsUsd[key] ?? 0;
        if (proposed.side === "buy") {
          return {
            spentTodayUsd: prev.spentTodayUsd + proposed.usdAmount,
            positionsUsd: { ...prev.positionsUsd, [key]: held + proposed.usdAmount },
          };
        }
        return {
          ...prev,
          positionsUsd: { ...prev.positionsUsd, [key]: Math.max(0, held - proposed.usdAmount) },
        };
      });
    } catch (e) {
      setSignResult({ error: e instanceof Error ? e.message : "sign failed" });
    } finally {
      setSigning(false);
    }
  }, [proposed, publicKey, sendTransaction]);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <GuardrailPanel
          policy={policy}
          onChange={setPolicy}
          ledger={ledger}
          onLedgerChange={setLedger}
        />
      </div>

      <div className="space-y-4">
        <div className="flex justify-end">
          <WalletButton />
        </div>
        <ChatPanel messages={messages} onSend={sendChat} busy={busy} llmOffline={llmOffline} />
        <div className="grid gap-4 md:grid-cols-2">
          <ManualTrade onPropose={proposeManual} busy={busy} />
          <ProposedTradeCard
            proposed={proposed}
            onSign={signAndSend}
            signing={signing}
            signResult={signResult}
            walletConnected={!!publicKey}
          />
        </div>
      </div>
    </div>
  );
}
