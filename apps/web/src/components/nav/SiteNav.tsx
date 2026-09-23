"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { PILLARS } from "@/lib/modules";
import { WalletButton } from "@/components/solana/WalletButton";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 glass hairline">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="relative inline-flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-md bg-primary/25 blur-[6px] animate-pulse-glow" />
            <span className="relative h-3 w-3 rounded-[3px] bg-primary shadow-glow" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Aadukalam</span>
          <span className="hidden text-sm text-muted-foreground md:inline">
            the arena that never closes
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {PILLARS.map((p) => (
            <Link
              key={p.key}
              href={p.modules[0].href}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <WalletButton />
          </div>
          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className={cn("border-t border-border/60 md:hidden", open ? "block" : "hidden")}>
        <div className="mx-auto grid max-w-[1320px] gap-1 px-4 py-3">
          {PILLARS.flatMap((p) => p.modules).map((m) => (
            <Link
              key={m.slug}
              href={m.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              {m.name}
            </Link>
          ))}
          <div className="pt-2 sm:hidden">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
