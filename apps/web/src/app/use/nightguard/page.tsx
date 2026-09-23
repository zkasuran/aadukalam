import { ShieldAlert } from "lucide-react";

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

import { NightguardDashboard } from "./_components/NightguardDashboard";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <Badge variant="outline" className="border-primary/40 text-primary">
            USE
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nightguard</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            An off-hours liquidation shield for tokenized-stock borrow positions.
            It reads your Kamino health, shows the exact price a liquidation hits,
            and warns or arms a deleverage before a weekend or a thin off-hours
            wick can liquidate you while you sleep.
          </p>

          <div className="mt-5 flex max-w-2xl items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="leading-relaxed">
              A tokenized stock keeps trading 24/7 on Solana while the real
              exchange is shut, so its liquidation price never sleeps. Nightguard
              watches that gap. The auto-deleverage is an armed policy you
              authorize and a transaction you sign, never silent server signing.
            </p>
          </div>

          <NightguardDashboard />
        </section>
      </div>
    </div>
  );
}
