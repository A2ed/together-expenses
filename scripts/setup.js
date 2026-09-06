import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const template = readFileSync(path.join(root, ".env.example"), "utf8");
try {
  writeFileSync(
    path.join(root, ".env"),
    template.replace(
      /^APP_PASSWORD=$/m,
      `APP_PASSWORD=${randomBytes(24).toString("base64url")}`,
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env with a unique shared password. Open .env locally to read it or set your own (12+ characters) before starting the app.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".env already exists. Your configuration was preserved.");
}
