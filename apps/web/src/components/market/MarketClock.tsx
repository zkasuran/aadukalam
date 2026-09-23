"use client";

// MarketClock shows the US equity session state as a small pill. The state is a
// wall-clock calc in America/New_York (Intl time zone), not the Pyth metadata
// feed, so it distinguishes pre-market and after-hours which a single is_open
// flag cannot. It is not holiday aware and the pill says so on hover. Regular
// session 09:30 to 16:00 ET, pre-market from 04:00, after hours to 20:00, Mon-Fri.

import * as React from "react";
import { cn } from "@/lib/utils";

type MarketState = "regular" | "premarket" | "afterhours" | "closed" | "weekend";

interface ClockInfo {
  state: MarketState;
  label: string;
  etTime: string;
}

const STATE_LABEL: Record<MarketState, string> = {
  regular: "Market open",
  premarket: "Pre-market",
  afterhours: "After hours",
  closed: "Market closed",
  weekend: "Weekend",
};

const DOT_CLASS: Record<MarketState, string> = {
  regular: "bg-primary",
  premarket: "bg-yellow-400",
  afterhours: "bg-orange-400",
  closed: "bg-muted-foreground",
  weekend: "bg-muted-foreground",
};

function computeMarketState(now: Date): ClockInfo {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some runtimes emit 24 at midnight
  const minute = parseInt(get("minute"), 10);
  const mins = hour * 60 + minute;
  const etTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;

  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const preOpen = 4 * 60;
  const postClose = 20 * 60;

  let state: MarketState;
  if (isWeekend) state = "weekend";
  else if (mins >= open && mins < close) state = "regular";
  else if (mins >= preOpen && mins < open) state = "premarket";
  else if (mins >= close && mins < postClose) state = "afterhours";
  else state = "closed";

  return { state, label: STATE_LABEL[state], etTime };
}

export interface MarketClockProps {
  className?: string;
  showTime?: boolean;
}

export function MarketClock({ className, showTime = true }: MarketClockProps) {
  // Null until mounted so the server render and first client render agree, then
  // the effect fills it in and a timer keeps it live.
  const [info, setInfo] = React.useState<ClockInfo | null>(null);

  React.useEffect(() => {
    const tick = () => setInfo(computeMarketState(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!info) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs",
          className,
        )}
      >
        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="text-muted-foreground">US market</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium",
        className,
      )}
      title="US equity hours, wall-clock calc in America/New_York, not holiday aware"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          DOT_CLASS[info.state],
          info.state === "regular" && "animate-pulse",
        )}
      />
      <span>{info.label}</span>
      {showTime && <span className="tabular-nums text-muted-foreground">{info.etTime}</span>}
    </span>
  );
}

export default MarketClock;
