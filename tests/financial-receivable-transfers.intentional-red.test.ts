import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

describe("Order 198 intentional red: governed receivable transfer", () => {
  test("bounded migration, domain, routes and direct-billing workbench exist", () => {
    const migration = resolve(ROOT, "migrations", "0025_governed_receivable_transfer.sql");
    const service = resolve(ROOT, "src", "contexts", "financials", "receivables.ts");
    expect(existsSync(migration)).toBe(true);
    expect(existsSync(service)).toBe(true);

    const app = readFileSync(resolve(ROOT, "src", "app.ts"), "utf8");
    const html = readFileSync(resolve(ROOT, "src", "http", "operator", "index.html"), "utf8");
    const client = readFileSync(resolve(ROOT, "src", "http", "operator", "operator.js"), "utf8");
    expect(app).toContain("receivable-transfers");
    expect(html).toContain('id="receivable-transfer-workbench"');
    expect(client).toContain("loadReceivableTransferPreview");
  });
});
