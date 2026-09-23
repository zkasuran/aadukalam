import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

import { PaycheckDashboard } from "./_components/PaycheckDashboard";

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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Paycheck</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tokenized stocks pay dividends by rebasing: your balance quietly grows
            and no cash ever lands. Paycheck reads that rebase and pays its value
            out as real USDC. Deposit a rebasing stock token, the keeper records
            each rebase against your position, then you claim the accrued USDC to
            your own wallet.
          </p>

          <PaycheckDashboard />
        </section>
      </div>
    </div>
  );
}
