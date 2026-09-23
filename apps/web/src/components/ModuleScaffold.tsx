import type { ReactNode } from "react";

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { Badge } from "@/components/ui/badge";

interface ModuleScaffoldProps {
  pillar: string;
  title: string;
  blurb: string;
  children?: ReactNode;
}

export function ModuleScaffold({
  pillar,
  title,
  blurb,
  children,
}: ModuleScaffoldProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>

        <section>
          <Badge variant="outline" className="border-primary/40 text-primary">
            {pillar}
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{blurb}</p>

          <div className="mt-8 rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
            </div>
            <p className="text-lg font-medium">Coming online</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              This module is wired into the app shell. The interactive
              experience lands with its module build.
            </p>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
