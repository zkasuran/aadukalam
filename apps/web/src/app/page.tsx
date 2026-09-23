import Link from "next/link";

import { COMPANION, PILLARS } from "@/lib/modules";
import { ModuleExplorer } from "@/components/ModuleExplorer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* hero */}
      <section className="py-16 sm:py-24">
        <Badge
          variant="outline"
          className="mb-5 border-primary/40 text-primary"
        >
          Tokenized stocks on Solana
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          The arena that never{" "}
          <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
            closes
          </span>
          .
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Aadukalam is one honest neobrokerage for tokenized equities. Know what
          you own, grow it on your terms, spend it without selling, and take a
          position on the story. Open around the clock.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/know/trueprice">Explore the modules</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={COMPANION.href}>See Opening Bell</Link>
          </Button>
        </div>

        <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { k: "Pillars", v: "4" },
            { k: "Modules", v: "9" },
            { k: "Market hours", v: "24/7" },
            { k: "Network", v: "Solana" },
          ].map((stat) => (
            <div key={stat.k}>
              <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                {stat.k}
              </dt>
              <dd className="mt-1 text-2xl font-semibold">{stat.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* modules */}
      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Four pillars, nine modules
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              KNOW what you own, GROW it, USE it, PLAY the story.
            </p>
          </div>
        </div>
        <ModuleExplorer />
      </section>

      {/* companion */}
      <section className="mt-16">
        <div className="rounded-2xl border border-border bg-card/40 p-8 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Companion
            </p>
            <h3 className="mt-1 text-xl font-semibold">{COMPANION.name}</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {COMPANION.blurb}
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button asChild variant="secondary">
              <Link href={COMPANION.href}>Open the launchpad</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* footer note */}
      <p className="mt-16 text-xs text-muted-foreground">
        {PILLARS.reduce((n, p) => n + p.modules.length, 0)} modules wired into
        the shell. Our programs run on devnet and move no real funds.
      </p>
    </div>
  );
}
