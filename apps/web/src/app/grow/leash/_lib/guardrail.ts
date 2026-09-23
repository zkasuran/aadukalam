// The safety core of Leash. A pure, deterministic gate that decides whether a
// proposed tokenized-stock trade is allowed under the guardrails the user set.
// It runs in code BEFORE any transaction is built (on the server inside the chat
// route's proposeTrade tool and again on the client for instant feedback), so
// the language model can never talk its way past a cap.
//
// No imports, no network, no clock, no randomness, no mutation. Same input, same
// verdict, every time. That is what makes it testable and trustworthy.

export type TradeSide = "buy" | "sell";

export interface GuardrailPolicy {
  /** tickers the agent may trade, e.g. ["AAPLx", "NVDAx"]. Matched case-insensitively. */
  allowlist: string[];
  /** ceiling on the USD value of any single position after a buy. */
  maxPositionUsd: number;
  /** ceiling on total USD bought in one day. */
  dailyBudgetUsd: number;
  /** ceiling on the USD notional of a single trade. */
  perTradeCapUsd: number;
}

export interface ProposedTrade {
  /** ticker as shown, e.g. "AAPLx". */
  ticker: string;
  /** buy or sell. Daily budget and max position apply to buys only. */
  side: TradeSide;
  /** USD notional of this trade. Must be a positive finite number. */
  usdAmount: number;
  /** current USD value already held in this ticker. Defaults to 0. */
  currentPositionUsd?: number;
  /** USD already bought today, counted against the daily budget. Defaults to 0. */
  spentTodayUsd?: number;
}

export type GuardrailCode =
  | "ok"
  | "not_allowlisted"
  | "invalid_amount"
  | "over_per_trade_cap"
  | "over_daily_budget"
  | "over_max_position";

export interface GuardrailCheck {
  code: GuardrailCode;
  label: string;
  passed: boolean;
  /** human detail, filled whether the check passed or failed. */
  detail: string;
  /** true when the check does not apply to this trade (e.g. budget on a sell). */
  skipped?: boolean;
}

export interface GuardrailVerdict {
  allowed: boolean;
  /** the detail of the first failing check, absent when allowed. */
  reason?: string;
  /** machine code of the verdict: "ok" when allowed, else the first failure. */
  code: GuardrailCode;
  /** every rule evaluated, in order, for the UI to render pass or fail. */
  checks: GuardrailCheck[];
}

// Small tolerance so a trade sized exactly at a limit is allowed and floating
// point noise never turns an on-the-line trade into a refusal.
const EPS = 1e-9;

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return USD.format(n);
}

function normalize(ticker: string): string {
  return ticker.trim().toLowerCase();
}

/**
 * The gate. Returns whether the proposed trade is allowed under the policy and,
 * when it is not, the reason and the machine code of the first failing rule. The
 * full `checks` array is always returned so the UI can show every rule.
 *
 * Rules, in evaluation order:
 *   1. the ticker is on the allowlist
 *   2. the amount is a positive finite number
 *   3. the trade is within the per-trade cap
 *   4. the trade plus what was spent today is within the daily budget (buys)
 *   5. the trade plus the current position is within the max position (buys)
 *
 * Selling returns cash and shrinks a position, so the daily budget and max
 * position checks are skipped for a sell. The allowlist and per-trade cap always
 * apply.
 */
export function enforce(policy: GuardrailPolicy, trade: ProposedTrade): GuardrailVerdict {
  const isBuy = trade.side === "buy";
  const amount = trade.usdAmount;
  const held = trade.currentPositionUsd ?? 0;
  const spent = trade.spentTodayUsd ?? 0;

  const checks: GuardrailCheck[] = [];

  // 1. allowlist
  const onList = policy.allowlist.some((t) => normalize(t) === normalize(trade.ticker));
  checks.push({
    code: "not_allowlisted",
    label: "Ticker allowlist",
    passed: onList,
    detail: onList
      ? `${trade.ticker} is on the allowlist`
      : `${trade.ticker} is not on the allowlist`,
  });

  // 2. amount is a positive finite number
  const amountValid = Number.isFinite(amount) && amount > 0;
  checks.push({
    code: "invalid_amount",
    label: "Trade amount",
    passed: amountValid,
    detail: amountValid
      ? `${money(amount)} is a valid trade amount`
      : "trade amount must be a positive number",
  });

  // 3. per-trade cap (buys and sells)
  const withinPerTrade = amountValid && amount <= policy.perTradeCapUsd + EPS;
  checks.push({
    code: "over_per_trade_cap",
    label: "Per-trade cap",
    passed: withinPerTrade,
    detail: withinPerTrade
      ? `${money(amount)} is within the ${money(policy.perTradeCapUsd)} per-trade cap`
      : `${money(amount)} is over the ${money(policy.perTradeCapUsd)} per-trade cap`,
  });

  // 4. daily budget (buys only)
  const wouldSpend = spent + amount;
  const withinBudget = !isBuy || (amountValid && wouldSpend <= policy.dailyBudgetUsd + EPS);
  checks.push({
    code: "over_daily_budget",
    label: "Daily budget",
    passed: withinBudget,
    skipped: !isBuy,
    detail: !isBuy
      ? "a sell does not draw on the daily budget"
      : withinBudget
        ? `${money(amount)} plus ${money(spent)} spent today stays within the ${money(policy.dailyBudgetUsd)} daily budget`
        : `${money(amount)} plus ${money(spent)} spent today would exceed the ${money(policy.dailyBudgetUsd)} daily budget`,
  });

  // 5. max position (buys only)
  const wouldHold = held + amount;
  const withinPosition = !isBuy || (amountValid && wouldHold <= policy.maxPositionUsd + EPS);
  checks.push({
    code: "over_max_position",
    label: "Max position",
    passed: withinPosition,
    skipped: !isBuy,
    detail: !isBuy
      ? "a sell reduces a position, so the max position does not apply"
      : withinPosition
        ? `${money(amount)} plus the ${money(held)} already held stays within the ${money(policy.maxPositionUsd)} max position`
        : `${money(amount)} plus the ${money(held)} already held would exceed the ${money(policy.maxPositionUsd)} max position`,
  });

  const firstFail = checks.find((c) => !c.passed);
  if (firstFail) {
    return { allowed: false, reason: firstFail.detail, code: firstFail.code, checks };
  }
  return { allowed: true, code: "ok", checks };
}
