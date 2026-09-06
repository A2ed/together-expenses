import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import { parseScotia } from "./domain.js";
export function openStore(
  filename = process.env.DB_PATH || "data/household.sqlite",
) {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT NOT NULL, merchant TEXT NOT NULL, detail TEXT NOT NULL, cents INTEGER NOT NULL, category TEXT NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL, merchant_key TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS rules (merchant_key TEXT PRIMARY KEY, category TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS imports (id INTEGER PRIMARY KEY, name TEXT NOT NULL, added INTEGER NOT NULL, skipped INTEGER NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  const getSetting = (key, fallback = "") =>
    db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value ??
    fallback;
  const setSetting = (key, value) =>
    db
      .prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, String(value));
  const getRows = () =>
    db.prepare("SELECT * FROM transactions ORDER BY date DESC, merchant").all();
  function importCsv(csv, name) {
    const { transactions, pending } = parseScotia(csv);
    const insert = db.prepare(
      "INSERT OR IGNORE INTO transactions (id,date,merchant,detail,cents,category,kind,source,merchant_key) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    let added = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const t of transactions) {
        const rule = db
          .prepare("SELECT category FROM rules WHERE merchant_key=?")
          .get(t.merchant_key);
        if (rule && t.kind !== "payment") {
          t.category = rule.category;
          t.source = "learned";
        }
        added += Number(
          insert.run(
            t.id,
            t.date,
            t.merchant,
            t.detail,
            t.cents,
            t.category,
            t.kind,
            t.source,
            t.merchant_key,
          ).changes,
        );
      }
      const skipped = transactions.length - added;
      db.prepare("INSERT INTO imports (name,added,skipped) VALUES (?,?,?)").run(
        name,
        added,
        skipped,
      );
      db.exec("COMMIT");
      return { added, skipped, pending };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return { db, getSetting, setSetting, getRows, importCsv };
}
