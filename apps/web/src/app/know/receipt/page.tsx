import { AlertTriangle } from "lucide-react";

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

import { ReceiptDashboard } from "./_components/ReceiptDashboard";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <Badge variant="outline" className="border-primary/40 text-primary">
            KNOW
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Receipt</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A trust score for pre-IPO tokens. Is the share really backed, is
            there a real audit, how far the price sits from mark and whether the
            implied valuation holds up. For Tessera T-Tokens it goes one step
            further, pricing each one live on Jupiter and letting you trade it
            with a wallet-signed swap.
          </p>

          <div className="mt-5 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              In May 2026 PreStocks tokens for Anthropic and OpenAI fell 34 to 40
              percent in a week after both companies warned their SPV share
              transfers were void and the attestation reports promised at launch
              never appeared. Receipt exists so that gap shows up before you buy,
              not after.
            </p>
          </div>

          <ReceiptDashboard />
        </section>
      </div>
    </div>
  );
}
