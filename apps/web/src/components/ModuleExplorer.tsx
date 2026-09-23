"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PILLARS } from "@/lib/modules";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ModuleExplorer() {
  return (
    <Tabs defaultValue="know" className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        {PILLARS.map((pillar) => (
          <TabsTrigger
            key={pillar.key}
            value={pillar.key}
            className="rounded-full border border-border bg-card px-4 py-2 data-[state=active]:border-primary/50 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            {pillar.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {PILLARS.map((pillar) => (
        <TabsContent key={pillar.key} value={pillar.key} className="mt-6">
          <p className="mb-4 text-sm text-muted-foreground">{pillar.tagline}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pillar.modules.map((mod) => (
              <Link key={mod.slug} href={mod.href} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{mod.name}</CardTitle>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <CardDescription>{mod.blurb}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
