import { Coins } from "lucide-react";

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

import { SwipeCheckout } from "./_components/SwipeCheckout";

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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Swipe</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Spend against your tokenized-stock portfolio without selling it. At the moment of payment
            Swipe borrows USDC on Kamino against your shares, so the position stays intact and there
            is no taxable disposal.
          </p>

          <div className="mt-5 flex max-w-2xl items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary/90">
            <Coins className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              Selling a share to pay for something realizes a gain and hands over the upside. A margin
              loan against it does neither. Swipe reads the live Kamino xStocks market, shows the LTV,
              the health and the exact liquidation price, then builds the borrow for your wallet to
              sign. Funds are borrowed, not sold.
            </p>
          </div>

          <SwipeCheckout />
        </section>
      </div>
    </div>
  );
}
