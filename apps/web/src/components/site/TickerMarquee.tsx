import { loadTokens } from "@aadukalam/data";

// A seamless scrolling row of real tokenized-stock tickers from the registry.
// Server component, pure CSS motion, the list is duplicated for a loop.
export function TickerMarquee() {
  const tickers = loadTokens()
    .filter((t) => (t.liquidityUsd ?? 0) > 0)
    .slice(0, 22)
    .map((t) => t.ticker);
  const row = tickers.length ? tickers : loadTokens().slice(0, 22).map((t) => t.ticker);
  const doubled = [...row, ...row];
  return (
    <div className="relative overflow-hidden border-y border-border/60 py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
        {doubled.map((t, i) => (
          <span key={i} className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
