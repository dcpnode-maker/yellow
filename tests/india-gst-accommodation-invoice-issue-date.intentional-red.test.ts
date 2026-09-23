import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

describe("Order 292 intentional red: exact India GST accommodation invoice issue date", () => {
  test("P0: the snapshot, resolver module and bounded-context export are absent before implementation", async () => {
    expect(existsSync(resolve(root, "migrations/0058_india_gst_accommodation_invoice_issue_date.sql"))).toBeTrue();
    expect(existsSync(resolve(root, "src/contexts/tax-fiscal/india-gst-accommodation-invoice-issue-date.ts"))).toBeTrue();
    const boundary = await Bun.file(resolve(root, "src/contexts/tax-fiscal/index.ts")).text();
    expect(boundary).toContain("india-gst-accommodation-invoice-issue-date");
  });
});
