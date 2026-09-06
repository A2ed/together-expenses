import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseScotia, summarize, weekStart } from "./domain.js";
import { openStore } from "./store.js";
const header =
  "\uFEFFFilter,Date,Description,Sub-description,Status,Type of Transaction,Amount\n";
const row = (
  merchant = "thrifty foods #123",
  amount = "12.34",
  type = "Debit",
  date = "2026-09-01",
  status = "posted",
) => `"",${date},"${merchant}","Victoria BC",${status},${type},${amount}\n`;
test("Scotia signs, payments, refunds, and category totals", () => {
  const { transactions } = parseScotia(
    header +
      row() +
      row("amzn mktp ca", "-3.22", "Credit") +
      row("royal bank of canada", "-5000", "Credit"),
  );
  assert.deepEqual(
    transactions.map((t) => [t.cents, t.kind, t.category]),
    [
      [1234, "purchase", "Groceries"],
      [-322, "refund", "Shopping"],
      [-500000, "payment", "Other"],
    ],
  );
  assert.equal(summarize(transactions).netCents, 912);
  assert.equal(summarize(transactions).count, 2);
});
test("overlapping files preserve identical legitimate purchases, edits, and rules", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "together-"));
  const store = openStore(path.join(dir, "test.sqlite"));
  try {
    assert.equal(store.importCsv(header + row() + row(), "a.csv").added, 2);
    assert.equal(store.importCsv(header + row() + row(), "a.csv").skipped, 2);
    const t = store.getRows()[0];
    store.db
      .prepare(
        "UPDATE transactions SET cents=999,category='Shopping',source='manual' WHERE id=?",
      )
      .run(t.id);
    assert.equal(store.importCsv(header + row() + row(), "b.csv").added, 0);
    assert.equal(store.getRows().find((r) => r.id === t.id).cents, 999);
    store.db
      .prepare("INSERT INTO rules VALUES (?,?)")
      .run("thrifty foods", "Bills");
    store.importCsv(
      header + row("thrifty foods #123", "40.22", "Debit", "2026-09-02"),
      "c.csv",
    );
    assert.equal(
      store.getRows().find((r) => r.date === "2026-09-02").category,
      "Bills",
    );
  } finally {
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("invalid import is atomic and pending transactions are skipped", () => {
  assert.throws(
    () => parseScotia(header + row() + row("merchant", "oops")),
    /row 3/,
  );
  assert.throws(
    () => parseScotia(header + row("merchant", "12.00", "Debit", "2026-02-30")),
    /Invalid/,
  );
  assert.throws(
    () => parseScotia("Name,Value\nCoffee,3"),
    /original Scotiabank/,
  );
  assert.equal(
    parseScotia(header + row("merchant", "5", "Debit", "2026-09-01", "pending"))
      .pending,
    1,
  );
});
test("Monday weeks and strictly greater threshold", () => {
  assert.equal(weekStart("2026-09-06"), "2026-08-31");
  assert.equal(weekStart("2026-08-31"), "2026-08-31");
  const rows = parseScotia(
    header + row("merchant", "350.00") + row("merchant", "350.01"),
  ).transactions;
  assert.equal(summarize(rows).large.length, 1);
  assert.equal(summarize(rows, 40000).large.length, 0);
});

test("numbered merchant names cannot collapse to an empty shared rule", async () => {
  const { merchantKey } = await import("./domain.js");
  assert.equal(merchantKey("#5120 sport chek"), "sport chek");
  assert.equal(merchantKey("sq *49 below ice cream"), "49 below ice cream");
  assert.equal(merchantKey("7 eleven store #26408"), "7 eleven store");
  assert.equal(merchantKey("starbucks 04786"), "starbucks");
});
