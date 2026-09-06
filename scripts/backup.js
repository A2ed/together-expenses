import "dotenv/config";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
const directory = "data/backups";
mkdirSync(directory, { recursive: true, mode: 0o700 });
const filename = `${directory}/together-${new Date().toISOString().replaceAll(":", "-")}.sqlite`;
const db = new DatabaseSync(process.env.DB_PATH || "data/household.sqlite");
try {
  await backup(db, filename);
  chmodSync(filename, 0o600);
  console.log(`Backup saved: ${filename}`);
} finally {
  db.close();
}
