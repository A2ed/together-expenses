import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

test("authenticated import, shared edits, version conflicts, settings, CSRF and AI setup", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "together-api-"));
  const child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      DB_PATH: path.join(dir, "test.sqlite"),
      PORT: "0",
      APP_PASSWORD: "test-only-password",
      OPENROUTER_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    const ended = once(child, "exit");
    child.kill();
    await ended;
    rmSync(dir, { recursive: true, force: true });
  });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Server did not start")),
      5000,
    );
    child.stdout.on("data", (b) => {
      const m = String(b).match(/0\.0\.0\.0:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve("http://127.0.0.1:" + m[1]);
      }
    });
    child.once("error", reject);
  });
  async function request(route, method = "GET", body, cookie = "", origin) {
    const r = await fetch(base + "/api" + route, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  assert.equal((await request("/data")).status, 401);
  assert.equal(
    (await request("/insights?unit=month&anchor=2026-09-01")).status,
    401,
  );
  assert.equal(
    (await request("/login", "POST", { password: "wrong" })).status,
    401,
  );
  const a = await request("/login", "POST", { password: "test-only-password" });
  assert.equal(a.status, 200);
  const b = await request("/login", "POST", { password: "test-only-password" });
  assert.ok(a.cookie !== b.cookie);
  const csv =
    "Filter,Date,Description,Sub-description,Status,Type of Transaction,Amount\n,2026-09-01,thrifty foods #123,Victoria,posted,Debit,12.34\n,2026-09-02,thrifty foods #123,Victoria,posted,Debit,14.00\n";
  assert.deepEqual(
    (await request("/import", "POST", { name: "test.csv", csv }, a.cookie))
      .body,
    { added: 2, skipped: 0, pending: 0 },
  );
  assert.equal(
    (await request("/import", "POST", { name: "test.csv", csv }, b.cookie)).body
      .skipped,
    2,
  );
  const row = (await request("/data", "GET", undefined, b.cookie)).body
    .transactions[0];
  const edit = {
    ...row,
    cents: 1500,
    category: "Shopping",
    note: "test note",
    remember: true,
  };
  assert.equal(
    (await request("/transactions/" + row.id, "PATCH", edit, a.cookie)).body
      .learned,
    1,
  );
  const shared = (await request("/data", "GET", undefined, b.cookie)).body
    .transactions;
  assert.equal(shared.find((r) => r.id === row.id).cents, 1500);
  assert.ok(shared.every((r) => r.category === "Shopping"));
  assert.equal(
    (await request("/transactions/" + row.id, "PATCH", edit, b.cookie)).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/settings",
        "PATCH",
        { threshold: 500, model: "openai/gpt-4.1-mini" },
        a.cookie,
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/settings",
        "PATCH",
        { threshold: 500, model: "openai/gpt-4.1-mini" },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/data", "GET", undefined, b.cookie)).body.settings
      .threshold,
    500,
  );
  assert.equal(
    (
      await request(
        "/chat",
        "POST",
        { month: "all", messages: [{ role: "user", content: "Total?" }] },
        a.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/import",
        "POST",
        { name: "bad.csv", csv: "wrong,columns\n1,2" },
        a.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/data", "GET", undefined, b.cookie)).body.transactions
      .length,
    2,
  );
  assert.equal(
    (
      await request(
        "/insights",
        "POST",
        { unit: "month", anchor: "2026-09-01" },
        a.cookie,
      )
    ).status,
    400,
  );
  await request(
    "/settings",
    "PATCH",
    {
      threshold: 350,
      model: "openai/gpt-4.1-mini",
      apiKey: "test-secret-not-real",
    },
    a.cookie,
  );
  assert.ok(
    !JSON.stringify(
      (await request("/data", "GET", undefined, b.cookie)).body,
    ).includes("test-secret-not-real"),
  );
  await request("/logout", "POST", {}, a.cookie);
  assert.equal(
    (await request("/data", "GET", undefined, a.cookie)).status,
    401,
  );
  assert.equal(
    (await request("/data", "GET", undefined, b.cookie)).status,
    200,
  );
});
