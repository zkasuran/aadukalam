"use client";

// TickerDetail is the per-ticker view: the live on-chain price, the Pyth fair
// value (or an honest "unavailable" when no key is set), the underlying equity
// reference, the premium/discount against the chosen anchor and the live chart.
// The copy explains the off-hours drift in plain terms and changes with the
// session.

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usd, pct, compactNumber } from "@/lib/format";

import { cx } from "../_lib/cx";
import type { MarketInfo } from "../_lib/market";
import { impliedPrice24hAgo, type TruePriceRow } from "../_lib/trueprice";
import { PremiumChart } from "./PremiumChart";

function driftTextClass(drift: TruePriceRow["drift"]): string {
  if (drift === "premium") return "text-primary";
  if (drift === "discount") return "text-destructive";
  return "text-muted-foreground";
}

function StatTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cx("mt-1 font-mono text-xl tabular-nums", valueClass)}>{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

export function TickerDetail({
  row,
  market,
  pythKeyMissing,
  onBack,
}: {
  row: TruePriceRow;
  market: MarketInfo;
  pythKeyMissing: boolean;
  onBack: () => void;
}) {
  const implied = impliedPrice24hAgo(row.dexPrice, row.change24h);
  const premiumText =
    row.premium == null ? "n/a" : pct(row.premium, { isRatio: true, signed: true, fractionDigits: 3 });
  const changeText =
    row.change24h == null ? "n/a" : pct(row.change24h, { signed: true, fractionDigits: 2 });
  const changeClass =
    row.change24h == null
      ? "text-muted-foreground"
      : row.change24h > 0
        ? "text-primary"
        : row.change24h < 0
          ? "text-destructive"
          : "text-muted-foreground";

  const pythValue = pythKeyMissing
    ? "Unavailable"
    : row.pythFair != null
      ? usd(row.pythFair)
      : "No feed price";
  const pythSub = pythKeyMissing
    ? "on-chain Pyth read did not return"
    : row.feed
      ? `feed ${row.feed.slice(0, 8)}…`
      : "no Pyth feed for this token";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← All stocks
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{row.ticker}</h2>
              <Badge variant="outline" className="border-primary/40 text-primary">
                {row.token.issuer.includes("xStocks") ? "xStock" : row.token.issuer}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{row.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="On-chain price"
          value={usd(row.dexPrice)}
          sub="Jupiter DEX, trades 24/7"
        />
        <StatTile
          label="Pyth fair value"
          value={pythValue}
          sub={pythSub}
          valueClass={pythKeyMissing || row.pythFair == null ? "text-muted-foreground" : undefined}
        />
        <StatTile
          label="Underlying reference"
          value={usd(row.underlying)}
          sub="last equity mark, from Jupiter"
        />
        <StatTile
          label="Premium / discount"
          value={premiumText}
          sub={`vs ${row.fair.label}`}
          valueClass={driftTextClass(row.drift)}
        />
        <StatTile label="24h change" value={changeText} sub="on-chain, Jupiter" valueClass={changeClass} />
        <StatTile
          label="Implied 24h ago"
          value={usd(implied)}
          sub="from Jupiter 24h change"
        />
      </div>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm leading-relaxed">
          <p className="font-medium">Why the two prices differ</p>
          {market.isRegularOpen ? (
            <p className="text-muted-foreground">
              The US market is open, so {row.ticker} and its underlying shares move together. The
              premium or discount here is small and mostly reflects on-chain liquidity and swap fees
              rather than a real gap in value.
            </p>
          ) : (
            <p className="text-muted-foreground">
              The US market is {market.label.toLowerCase()}. The underlying shares are not trading
              right now, but {row.ticker} keeps trading around the clock on Solana. The gap you see is
              off-hours drift: the on-chain price has moved while the official equity mark sits frozen.
              A positive number means you are paying a premium over the last fair value, a negative one
              means the token is trading at a discount.
            </p>
          )}
          <p className="text-muted-foreground">
            {row.fair.source === "pyth"
              ? "Fair value here is the Pyth oracle price, read on-chain from the sponsored feed account on Solana mainnet through our server proxy, no API key."
              : row.fair.source === "underlying"
                ? "The on-chain Pyth read did not return for this token, so fair value falls back to the underlying equity reference the Jupiter price API returns for this xStock. Premium and discount are measured against that number. The Pyth column stays honestly blank."
                : "No fair-value reference resolved for this token, so premium and discount cannot be shown."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <PremiumChart
            mint={row.mint}
            feed={row.feed}
            pythKeyMissing={pythKeyMissing}
            seed={{
              dex: row.dexPrice,
              fair: row.fair.value,
              premiumPct: row.premium != null ? row.premium * 100 : null,
            }}
            fairLabel={row.fair.label}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Liquidity {compactNumber(row.liquidity)} on Solana. Prices are read-only from public APIs.
        Aadukalam never moves funds, a trade is a transaction you sign yourself.
      </p>
    </div>
  );
}

export default TickerDetail;
