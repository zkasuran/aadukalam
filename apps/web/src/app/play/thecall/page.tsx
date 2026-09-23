// The Call route. A server shell with the module sidebar, wrapping the client
// app that talks to the devnet program and Pyth. Header and all interactivity
// live in TheCallApp.

import { ModuleSidebar } from "@/components/nav/ModuleSidebar";
import { TheCallApp } from "./_components/TheCallApp";

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[210px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <ModuleSidebar />
        </aside>
        <section>
          <TheCallApp />
        </section>
      </div>
    </div>
  );
}
