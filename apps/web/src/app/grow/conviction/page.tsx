import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

import { ConvictionDashboard } from "./_components/ConvictionDashboard";

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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Conviction
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            One tap owns a whole theme instead of thirty tickers. Pick Mag 7, AI
            chips or nuclear, pick how it weights and the budget splits across
            the names as a set of Jupiter swaps you sign. A rule holds the basket
            in shape as prices drift.
          </p>

          <ConvictionDashboard />
        </section>
      </div>
    </div>
  );
}
