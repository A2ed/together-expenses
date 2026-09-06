import test from "node:test";
import assert from "node:assert/strict";
import {
  cumulativeSpending,
  makePeriod,
  previousPeriod,
  insightFacts,
} from "../shared/analytics.ts";
const row = (date, cents, category = "Groceries", kind = "purchase") => ({
  date,
  cents,
  category,
  kind,
  merchant: "Fixture shop",
});
const marker = (date) => row(date, -100, "Other", "payment");
test("cumulative amounts include refunds, exclude payments, stop at imported cutoff, and align elapsed days", () => {
  const rows = [
    marker("2026-08-01"),
    marker("2026-08-31"),
    row("2026-08-01", 10000),
    row("2026-08-04", 20000),
    row("2026-09-01", 30000),
    row("2026-09-04", -5000, "Groceries", "refund"),
  ];
  const d = cumulativeSpending(
    rows,
    "month",
    "2026-09-01",
    "all",
    "2026-09-06",
  );
  assert.equal(d.current.totalCents, 25000);
  assert.equal(d.points[4].currentCents, 25000);
  assert.equal(d.points[5].currentCents, null);
  assert.equal(d.points[0].currentCents, 0);
  assert.deepEqual(d.comparison, {
    available: true,
    days: 4,
    currentCents: 25000,
    previousCents: 30000,
    deltaCents: -5000,
    percent: (-5000 / 30000) * 100,
  });
});
test("partial prior coverage is never filled with invented zeroes or used for a full-period comparison", () => {
  const d = cumulativeSpending(
    [row("2026-08-20", 1000), marker("2026-08-31"), row("2026-09-04", 3000)],
    "month",
    "2026-09-01",
    "all",
    "2026-09-06",
  );
  assert.equal(d.previous.coverage.missingStart, true);
  assert.equal(d.points[19].previousCents, null);
  assert.equal(d.points[20].previousCents, 1000);
  assert.equal(d.comparison.available, false);
  assert.equal(d.comparison.deltaCents, null);
});
test("leap years and unequal month lengths stay on their true ordinal days", () => {
  assert.equal(makePeriod("month", "2024-02-02").end, "2024-02-29");
  assert.equal(
    previousPeriod(makePeriod("month", "2024-01-01")).start,
    "2023-12-01",
  );
  const d = cumulativeSpending(
    [
      marker("2024-01-01"),
      row("2024-01-29", 200),
      row("2024-01-31", 900),
      row("2024-02-29", 400),
    ],
    "month",
    "2024-02-01",
    "all",
    "2024-03-01",
  );
  assert.equal(d.points[29].currentCents, 400);
  assert.equal(d.points[30].currentCents, null);
  assert.equal(d.points[31].previousCents, 1100);
  assert.equal(d.comparison.days, 29);
  assert.equal(d.comparison.previousCents, 200);
});
test("weekly alignment crosses year boundaries with Monday as day one", () => {
  const p = makePeriod("week", "2026-01-01");
  assert.equal(p.start, "2025-12-29");
  assert.equal(p.end, "2026-01-04");
  assert.equal(previousPeriod(p).start, "2025-12-22");
});
test("category filters use the whole card coverage, and future dates are not flattened", () => {
  const rows = [
    marker("2026-08-01"),
    row("2026-09-01", 1000, "Shopping"),
    marker("2026-09-02"),
    row("2026-09-04", 500),
  ];
  const d = cumulativeSpending(
    rows,
    "month",
    "2026-09-01",
    "Groceries",
    "2026-09-02",
  );
  assert.equal(d.current.totalCents, 0);
  assert.equal(d.points[2].currentCents, 0);
  assert.equal(d.points[3].currentCents, null);
});
test("report figures reconcile with daily and category aggregates", () => {
  const rows = [
    marker("2026-08-01"),
    row("2026-09-01", 25000),
    row("2026-09-02", -1000, "Groceries", "refund"),
    row("2026-09-02", 7000, "Shopping"),
  ];
  const f = insightFacts(rows, "month", "2026-09-01", 20000, "2026-09-06");
  assert.equal(f.netCents, 31000);
  assert.equal(f.refundCents, -1000);
  assert.equal(f.count, 3);
  assert.equal(f.large.length, 1);
  assert.equal(f.daily.at(-1).cumulativeCents, 31000);
  assert.equal(
    f.categories.reduce((s, c) => s + c.cents, 0),
    31000,
  );
});
