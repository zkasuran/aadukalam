import Link from "next/link";

import { PILLARS, COMPANION } from "@/lib/modules";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-border/60">
      <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-[3px] bg-primary shadow-glow" />
              <span className="font-display text-lg font-bold tracking-tight">Aadukalam</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              The arena that never closes. One honest neobrokerage for tokenized stocks on Solana.
            </p>
          </div>
          {PILLARS.map((p) => (
            <div key={p.key}>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">
                {p.label}
              </p>
              <ul className="space-y-2">
                {p.modules.map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={m.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {m.name}
                    </Link>
                  </li>
                ))}
                {p.key === "play" && (
                  <li>
                    <Link
                      href={COMPANION.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {COMPANION.name}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span className="font-mono tracking-wide">
            Built on Solana. Programs run on devnet, no real funds move.
          </span>
          <span className="font-mono tracking-wide">
            Every third-party trade is a transaction you sign.
          </span>
        </div>
      </div>
    </footer>
  );
}
