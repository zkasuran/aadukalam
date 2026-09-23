"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { UiMessage } from "../_lib/types";

const SUGGESTIONS = [
  "What is NVDAx trading at?",
  "Put $100 into AAPLx",
  "Buy $400 of SPYx",
  "Invest $50 in Tesla",
];

export function ChatPanel({
  messages,
  onSend,
  busy,
  llmOffline,
}: {
  messages: UiMessage[];
  onSend: (text: string) => void;
  busy: boolean;
  llmOffline: string | null;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setDraft("");
  }

  return (
    <div className="flex h-[26rem] flex-col rounded-xl border bg-card text-card-foreground shadow">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Chat with Leash</h2>
        <p className="text-[11px] text-muted-foreground">
          Ask in plain language. Leash checks your guardrails before it proposes a trade.
        </p>
      </div>

      {llmOffline ? (
        <div className="mx-4 mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
          {llmOffline} The manual form below still proposes trades through the same guardrail.
        </div>
      ) : null}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Try one of these</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={busy}
                  className="rounded-full border border-border/60 px-3 py-1 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "max-w-[85%] whitespace-pre-wrap rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground"
                }
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> thinking
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="flex items-center gap-2 border-t px-3 py-2.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message Leash"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="send">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
