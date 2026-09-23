import { ShieldCheck } from "lucide-react";

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

import { LeashConsole } from "./_components/LeashConsole";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <Badge variant="outline" className="border-primary/40 text-primary">
            GROW
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Leash</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            An AI agent that invests in tokenized stocks for you, inside hard
            guardrails you set. You give it an allowlist, a max position, a daily
            budget and a per-trade cap. It can talk, price and quote, but every
            trade it proposes is checked in code before any transaction is built,
            and refusals are shown.
          </p>

          <div className="mt-5 flex max-w-2xl items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="leading-relaxed">
              The guardrail is a pure function that runs before the agent can build
              a transaction, so the model can never talk its way past a cap. You
              always sign the trade in your own wallet. The server never signs and
              never holds your key.
            </p>
          </div>

          <LeashConsole />
        </section>
      </div>
    </div>
  );
}
