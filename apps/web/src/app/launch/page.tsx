import { Rocket } from "lucide-react";

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

import { LaunchStudio } from "./_components/LaunchStudio";

export const metadata = {
  title: "Launch a stock-paired agent token | Aadukalam",
  description:
    "Launch an agent token whose liquidity pool is quoted in a tokenized stock, using ClawPump and Meteora. Free preflight, funded launch handed off.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <Badge variant="outline" className="border-primary/40 text-primary">
            Stocknized Agent
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Launch a stock-paired agent token
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Give an agent a token whose liquidity pool is quoted in a real
            tokenized stock, not SOL. Pick the stock, name the token, then preflight
            the launch. ClawPump prices it and opens the pool on a Meteora Dynamic
            Bonding Curve with the stock as the quote asset, so one launch uses
            ClawPump and Meteora together.
          </p>

          <div className="mt-5 flex max-w-2xl items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="leading-relaxed">
              The preflight is free and moves nothing. The real launch spends
              mainnet SOL from a funded Solana keypair, so this app never fires it.
              It surfaces the exact command and the SOL amount for you to run from
              your own wallet. We never sign and never hold your key.
            </p>
          </div>

          <LaunchStudio />
        </section>
      </div>
    </div>
  );
}
