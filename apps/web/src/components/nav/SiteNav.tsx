import Link from "next/link";

import { WalletButton } from "@/components/solana/WalletButton";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-block h-3 w-3 rounded-full bg-primary shadow-[0_0_14px_2px] shadow-primary/50" />
          <span className="text-lg font-semibold tracking-tight">
            Aadukalam
          </span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            the arena that never closes
          </span>
        </Link>
        <WalletButton />
      </div>
    </header>
  );
}
