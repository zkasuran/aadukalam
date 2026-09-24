"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { COMPANIONS, PILLARS } from "@/lib/modules";
import { cn } from "@/lib/utils";

function itemClass(active: boolean) {
  return cn(
    "block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    active && "bg-muted font-medium text-primary"
  );
}

export function ModuleSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Modules" className="text-sm">
      {PILLARS.map((pillar) => (
        <div key={pillar.key} className="mb-5">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            {pillar.label}
          </p>
          <ul className="space-y-0.5">
            {pillar.modules.map((mod) => (
              <li key={mod.slug}>
                <Link href={mod.href} className={itemClass(pathname === mod.href)}>
                  {mod.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
          Companions
        </p>
        <ul className="space-y-0.5">
          {COMPANIONS.map((c) => (
            <li key={c.slug}>
              <Link href={c.href} className={itemClass(pathname === c.href)}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
