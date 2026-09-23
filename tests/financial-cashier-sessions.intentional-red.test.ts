import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

describe("Order 197 intentional red: governed cashier custody", () => {
  test("normalized schema, domain, route and operator workbench exist", () => {
    const migration = resolve(ROOT, "migrations", "0024_governed_cashier_sessions.sql");
    const service = resolve(ROOT, "src", "contexts", "financials", "cashiers.ts");
    expect(existsSync(migration)).toBe(true);
    expect(existsSync(service)).toBe(true);

    const app = readFileSync(resolve(ROOT, "src", "app.ts"), "utf8");
    const html = readFileSync(resolve(ROOT, "src", "http", "operator", "index.html"), "utf8");
    const client = readFileSync(resolve(ROOT, "src", "http", "operator", "operator.js"), "utf8");
    expect(app).toContain("cashier-sessions");
    expect(html).toContain('id="cashier-workbench"');
    expect(client).toContain("loadCashierSession");
  });
});
