import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { openStore } from "../server/store.js";
const filename = process.argv[2];
if (!filename) throw new Error("Usage: npm run import -- /path/to/scotia.csv");
const store = openStore();
console.log(
  store.importCsv(readFileSync(filename, "utf8"), path.basename(filename)),
);
store.db.close();
