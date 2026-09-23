import Link from "next/link";
import { ArrowRight, Wallet, Coins, Clock, Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TickerMarquee } from "@/components/site/TickerMarquee";
import { PillarShowcase } from "@/components/site/PillarShowcase";

const HIGHLIGHTS = [
  { icon: Wallet, title: "Spend, never sell", body: "Borrow against your stocks at checkout, no taxable disposal.", href: "/use/swipe" },
  { icon: Coins, title: "Real cash dividends", body: "The silent rebase paid to your wallet as USDC.", href: "/grow/paycheck" },
  { icon: Clock, title: "A 24/7 true price", body: "Fair value even while the exchange is shut.", href: "/know/trueprice" },
  { icon: Bot, title: "An AI on a leash", body: "It trades inside hard limits you set, or it refuses.", href: "/grow/leash" },
];

const STATS = [
  { k: "Modules", v: "10" },
  { k: "Programs live", v: "2" },
  { k: "Tokenized stocks", v: "58" },
  { k: "Market hours", v: "24/7" },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-[1320px] px-4 pt-20 pb-14 sm:px-6 sm:pt-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary" />
            Built for Stocklana on Solana
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl">
            The arena that <span className="gradient-text">never closes</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            One honest neobrokerage for tokenized stocks. Spend, borrow, earn and bet on your
            holdings around the clock, on an app that tells you exactly what you own.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="font-semibold shadow-glow">
              <Link href="#modules">
                Explore the modules <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border/80">
              <Link href="/know/trueprice">Open TruePrice</Link>
            </Button>
          </div>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/40 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.k} className="bg-background/60 px-5 py-6">
              <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {s.k}
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TickerMarquee />

      <section className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <Link
              key={h.title}
              href={h.href}
              className="card-sheen group glass rounded-2xl p-5 transition-colors hover:border-primary/30"
            >
              <h.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{h.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{h.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <PillarShowcase />

      <section className="mx-auto max-w-[1320px] px-4 pb-8 sm:px-6">
        <div className="glow-ring relative overflow-hidden rounded-3xl glass p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:44px_44px] [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]" />
          <h2 className="relative font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Your stocks, working while the market sleeps.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">
            Connect a wallet and start with the truth about what you hold.
          </p>
          <div className="relative mt-7 flex justify-center gap-3">
            <Button asChild size="lg" className="font-semibold shadow-glow">
              <Link href="/know/fineprint">See what you own</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
