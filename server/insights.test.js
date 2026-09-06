import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "./store.js";
import { generateReport, registerInsights } from "./insights.js";
const fixture = {
  title: "A closer look at the sample",
  summary: "This is a partial period based on the imported records.",
  sections: [
    {
      heading: "Category mix",
      body: "The sample is concentrated in groceries.",
      visual: "categories",
    },
    {
      heading: "Merchant concentration",
      body: "One merchant appears in this sample.",
      visual: "merchants",
    },
    {
      heading: "Daily pattern",
      body: "Imported transactions occur on one day.",
      visual: "daily",
    },
  ],
};
const rows = [
  {
    id: "fixture",
    date: "2026-09-01",
    merchant: "test merchant",
    category: "Groceries",
    kind: "purchase",
    cents: 1234,
    version: 1,
  },
];
test("validated narrative uses app-calculated facts and refuses invented chart fields or unsupported comparisons", async () => {
  let sent;
  const report = await generateReport({
    rows,
    scope: { unit: "month", anchor: "2026-09-01" },
    threshold: 35000,
    model: "fixture-model",
    complete: async (messages) => {
      sent = JSON.parse(messages[1].content);
      return JSON.stringify(fixture);
    },
  });
  assert.equal(sent.netCents, 1234);
  assert.equal(report.facts.netCents, 1234);
  assert.equal(report.sections.length, 3);
  await assert.rejects(
    () =>
      generateReport({
        rows,
        scope: { unit: "month", anchor: "2026-09-01" },
        threshold: 35000,
        model: "fixture",
        complete: async () =>
          JSON.stringify({ ...fixture, chartData: [999999] }),
      }),
    /invalid report/,
  );
  await assert.rejects(
    () =>
      generateReport({
        rows,
        scope: { unit: "month", anchor: "2026-09-01" },
        threshold: 35000,
        model: "fixture",
        complete: async () =>
          JSON.stringify({
            ...fixture,
            sections: fixture.sections.map((s, i) =>
              i === 0 ? { ...s, visual: "comparison" } : s,
            ),
          }),
      }),
    /unsupported period comparison/,
  );
});
test("reports persist per period, detect edited data, and keep a successful report after provider failure", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "together-insights-")),
    store = openStore(path.join(dir, "reports.sqlite"));
  let current = rows,
    fail = false;
  const app = express();
  app.use(express.json());
  registerInsights(app, {
    db: store.db,
    getRows: () => current,
    settings: () => ({ threshold: 350, model: "fixture" }),
    complete: async () => {
      if (fail)
        throw Object.assign(new Error("Provider failed"), { status: 502 });
      return JSON.stringify(fixture);
    },
    limit: (req, res, next) => next(),
  });
  app.use((e, req, res, _next) =>
    res.status(e.status || 400).json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/insights`,
    scope = { unit: "month", anchor: "2026-09-01" };
  const post = () =>
      fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope),
      }),
    get = () =>
      fetch(base + "?unit=month&anchor=2026-09-01").then((r) => r.json());
  assert.equal((await get()).report, null);
  assert.equal((await post()).status, 200);
  assert.equal((await get()).report.facts.netCents, 1234);
  assert.equal((await get()).stale, false);
  const second = openStore(path.join(dir, "reports.sqlite"));
  assert.equal(
    second.db.prepare("SELECT count(*) as n FROM insight_reports").get().n,
    1,
  );
  second.db.close();
  current = [{ ...rows[0], cents: 2345, version: 2 }];
  assert.equal((await get()).stale, true);
  assert.equal((await get()).report.facts.netCents, 1234);
  fail = true;
  assert.equal((await post()).status, 502);
  assert.equal((await get()).report.facts.netCents, 1234);
  const another = await fetch(base + "?unit=week&anchor=2026-09-01").then((r) =>
    r.json(),
  );
  assert.equal(another.report, null);
});
