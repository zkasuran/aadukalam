import Link from "next/link";
import { Eye, TrendingUp, CreditCard, Swords, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PILLARS, type PillarKey } from "@/lib/modules";

const ICONS: Record<PillarKey, LucideIcon> = {
  know: Eye,
  grow: TrendingUp,
  use: CreditCard,
  play: Swords,
};

export function PillarShowcase() {
  return (
    <section id="modules" className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6">
      <div className="mb-10 max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">The suite</p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Four pillars, ten modules, one wallet session
        </h2>
        <p className="mt-3 text-muted-foreground">
          Know what you own, grow it on your terms, spend it without selling, then take a position on the story.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {PILLARS.map((pillar) => {
          const Icon = ICONS[pillar.key];
          return (
            <div
              key={pillar.key}
              className="card-sheen glass rounded-2xl p-6 transition-colors hover:border-primary/30"
            >
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold tracking-tight">{pillar.label}</h3>
                  <p className="text-sm text-muted-foreground">{pillar.tagline}</p>
                </div>
              </div>
              <div className="grid gap-2">
                {pillar.modules.map((m) => (
                  <Link
                    key={m.slug}
                    href={m.href}
                    className="group flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-4 py-3 transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{m.blurb}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
