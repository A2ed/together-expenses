export type PeriodUnit = "week" | "month" | "all";
export type ExpenseRow = {
  id?: string;
  date: string;
  merchant: string;
  merchant_key?: string;
  cents: number;
  category: string;
  kind: string;
  version?: number;
};
export type Period = {
  unit: PeriodUnit;
  start: string;
  end: string;
  key: string;
  label: string;
  days: number;
};
export const categoryNames = [
  "Groceries",
  "Eating out",
  "Shopping",
  "Bills",
  "Other",
];
const dayMs = 86400000;
export function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function addDays(date: string, n: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + n * dayMs)
    .toISOString()
    .slice(0, 10);
}
export function dayDistance(a: string, b: string) {
  return Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / dayMs,
  );
}
function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function observedCoverage(rows: ExpenseRow[], today = todayLocal()) {
  const dates = rows
    .map((r) => r.date)
    .filter((d) => d <= today)
    .sort();
  return dates.length ? { from: dates[0], to: dates.at(-1)! } : null;
}
export function makePeriod(
  unit: PeriodUnit,
  anchor: string,
  rows: ExpenseRow[] = [],
): Period {
  let start: string, end: string, label: string;
  if (unit === "all") {
    const range = observedCoverage(rows);
    start = range?.from || anchor;
    end = range?.to || anchor;
    label = "All history";
  } else if (unit === "week") {
    const day = new Date(anchor + "T12:00:00Z").getUTCDay();
    start = addDays(anchor, -((day + 6) % 7));
    end = addDays(start, 6);
    label = `${shortDate(start)} – ${shortDate(end)}, ${end.slice(0, 4)}`;
  } else {
    start = anchor.slice(0, 7) + "-01";
    const d = new Date(start + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    end = addDays(d.toISOString().slice(0, 10), -1);
    label = new Date(start + "T12:00:00Z").toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return {
    unit,
    start,
    end,
    key: unit === "all" ? "all" : `${unit}:${start}`,
    label,
    days: dayDistance(start, end) + 1,
  };
}
export function previousPeriod(period: Period) {
  return makePeriod(period.unit, addDays(period.start, -1));
}
export function listPeriods(
  rows: ExpenseRow[],
  unit: "month" | "week",
  today = todayLocal(),
): Period[] {
  const range = observedCoverage(rows, today);
  if (!range) return [];
  const result: Period[] = [];
  let p = makePeriod(unit, range.to);
  while (p.end >= range.from && result.length < (unit === "week" ? 520 : 120)) {
    result.push(p);
    p = previousPeriod(p);
  }
  return result;
}
export function periodCoverage(
  rows: ExpenseRow[],
  period: Period,
  today = todayLocal(),
) {
  const observed = observedCoverage(rows, today);
  const from = observed
    ? observed.from > period.start
      ? observed.from
      : period.start
    : null;
  const to = observed ? [observed.to, period.end, today].sort()[0] : null;
  const hasData = !!(from && to && from <= to);
  return {
    from: hasData ? from : null,
    to: hasData ? to : null,
    hasData,
    missingStart: !hasData || from !== period.start,
    missingEnd: !hasData || to !== period.end,
    observedOnly: true as const,
  };
}
function periodCurve(
  rows: ExpenseRow[],
  period: Period,
  category: string,
  today: string,
) {
  const coverage = periodCoverage(rows, period, today),
    daily = new Map<string, number>();
  for (const r of rows)
    if (
      r.kind !== "payment" &&
      (category === "all" || r.category === category) &&
      r.date >= period.start &&
      r.date <= period.end &&
      r.date <= today
    )
      daily.set(r.date, (daily.get(r.date) || 0) + r.cents);
  let sum = 0;
  const points = Array.from({ length: period.days }, (_, i) => {
    const date = addDays(period.start, i);
    sum += daily.get(date) || 0;
    const available =
      coverage.from &&
      coverage.to &&
      date >= coverage.from &&
      date <= coverage.to;
    return {
      date,
      day: i + 1,
      cents: available ? sum : null,
      dailyCents: available ? daily.get(date) || 0 : null,
    };
  });
  return { period, coverage, points, totalCents: sum };
}
export function cumulativeSpending(
  rows: ExpenseRow[],
  unit: "month" | "week",
  anchor: string,
  category = "all",
  today = todayLocal(),
) {
  const period = makePeriod(unit, anchor),
    previous = previousPeriod(period);
  const current = periodCurve(rows, period, category, today),
    prior = periodCurve(rows, previous, category, today);
  const lastCurrent = current.points.filter((p) => p.cents !== null).at(-1);
  const elapsed = lastCurrent?.day ?? 0;
  const priorElapsed = elapsed
    ? prior.points[Math.min(elapsed, previous.days) - 1]
    : null;
  const comparable = !!(
    elapsed &&
    !current.coverage.missingStart &&
    !prior.coverage.missingStart &&
    priorElapsed?.cents !== null &&
    priorElapsed?.cents !== undefined
  );
  // Unequal month lengths are compared through the same ordinal day, never stretched.
  const matchedDays = Math.min(elapsed, previous.days);
  const currentMatched = matchedDays
    ? current.points[matchedDays - 1]?.cents
    : null;
  const previousMatched = matchedDays
    ? prior.points[matchedDays - 1]?.cents
    : null;
  const delta =
    comparable && currentMatched !== null && previousMatched !== null
      ? currentMatched! - previousMatched!
      : null;
  const comparison = {
    available: comparable,
    days: matchedDays,
    currentCents: comparable ? currentMatched : null,
    previousCents: comparable ? previousMatched : null,
    deltaCents: delta,
    percent:
      delta !== null && previousMatched! > 0
        ? (delta / previousMatched!) * 100
        : null,
  };
  const points = Array.from(
    { length: Math.max(period.days, previous.days) },
    (_, i) => ({
      day: i + 1,
      currentDate: current.points[i]?.date ?? null,
      previousDate: prior.points[i]?.date ?? null,
      currentCents: current.points[i]?.cents ?? null,
      previousCents: prior.points[i]?.cents ?? null,
    }),
  );
  points.unshift({
    day: 0,
    currentDate: period.start,
    previousDate: previous.start,
    currentCents: current.coverage.missingStart ? null : 0,
    previousCents: prior.coverage.missingStart ? null : 0,
  });
  return { unit, category, current, previous: prior, points, comparison };
}
export type CumulativeData = ReturnType<typeof cumulativeSpending>;
export function insightFacts(
  rows: ExpenseRow[],
  unit: PeriodUnit,
  anchor: string,
  thresholdCents: number,
  today = todayLocal(),
) {
  const period = makePeriod(unit, anchor, rows),
    coverage = periodCoverage(rows, period, today);
  const spend = rows.filter(
    (r) =>
      r.kind !== "payment" &&
      r.date >= period.start &&
      r.date <= period.end &&
      r.date <= today,
  );
  const categories = categoryNames.map((category) => {
    const items = spend.filter((r) => r.category === category);
    return {
      category,
      cents: items.reduce((s, r) => s + r.cents, 0),
      count: items.length,
    };
  });
  const merchants = new Map<
      string,
      { merchant: string; cents: number; count: number }
    >(),
    daily = new Map<string, number>();
  for (const r of spend) {
    const key = r.merchant_key || r.merchant.toLowerCase();
    const entry = merchants.get(key) || { merchant: key, cents: 0, count: 0 };
    entry.cents += r.cents;
    entry.count++;
    merchants.set(key, entry);
    daily.set(r.date, (daily.get(r.date) || 0) + r.cents);
  }
  const dates =
    unit === "all"
      ? [...daily.keys()].sort()
      : Array.from({ length: period.days }, (_, i) =>
          addDays(period.start, i),
        ).filter(
          (d) =>
            coverage.from &&
            coverage.to &&
            d >= coverage.from &&
            d <= coverage.to,
        );
  let cumulative = 0;
  const dailySeries = dates.map((date) => {
    const cents = daily.get(date) || 0;
    cumulative += cents;
    return { date, cents, cumulativeCents: cumulative };
  });
  const cumulativeData =
    unit === "all"
      ? null
      : cumulativeSpending(rows, unit, anchor, "all", today);
  return {
    currency: "CAD",
    period,
    coverage,
    netCents: spend.reduce((s, r) => s + r.cents, 0),
    purchaseCents: spend
      .filter((r) => r.kind === "purchase")
      .reduce((s, r) => s + r.cents, 0),
    refundCents: spend
      .filter((r) => r.kind === "refund")
      .reduce((s, r) => s + r.cents, 0),
    count: spend.length,
    categories,
    merchants: [...merchants.values()]
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 10),
    daily: dailySeries,
    cumulative: cumulativeData,
    large: spend
      .filter((r) => r.cents > thresholdCents)
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 10)
      .map((r) => ({
        date: r.date,
        merchant: r.merchant,
        cents: r.cents,
        category: r.category,
      })),
    thresholdCents,
    coverageNote:
      "Observed transaction dates only; a CSV may omit other transactions. No spending is inferred outside imported dates.",
  };
}
export type InsightFacts = ReturnType<typeof insightFacts>;
