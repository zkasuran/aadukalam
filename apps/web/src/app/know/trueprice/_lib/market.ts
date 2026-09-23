// Pure US-equity session-clock logic for TruePrice. It mirrors the shared
// MarketClock component's wall-clock calc in America/New_York so the table and
// the detail view can reason about the session without spinning a second timer
// per row. Regular session 09:30 to 16:00 ET, pre-market from 04:00, after
// hours to 20:00, Monday to Friday. It is a wall-clock calc, not holiday aware.

export type MarketState = "regular" | "premarket" | "afterhours" | "closed" | "weekend";

export interface MarketInfo {
  state: MarketState;
  label: string;
  etTime: string;
  /** true only during the regular 09:30 to 16:00 ET session. */
  isRegularOpen: boolean;
  /** true whenever the US exchange is shut: pre-market, after hours, closed or weekend. */
  isOffHours: boolean;
}

export const MARKET_STATE_LABEL: Record<MarketState, string> = {
  regular: "Market open",
  premarket: "Pre-market",
  afterhours: "After hours",
  closed: "Market closed",
  weekend: "Weekend",
};

/** Short one-word tag for a compact per-row chip. */
export const MARKET_STATE_SHORT: Record<MarketState, string> = {
  regular: "Open",
  premarket: "Pre",
  afterhours: "After",
  closed: "Closed",
  weekend: "Weekend",
};

export function computeMarketState(now: Date): MarketInfo {
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

  return {
    state,
    label: MARKET_STATE_LABEL[state],
    etTime,
    isRegularOpen: state === "regular",
    isOffHours: state !== "regular",
  };
}
