import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Order 356 audited business-day seal", () => {
  test("P0: the audited service and database capability exist", async () => {
    expect(existsSync(resolve(import.meta.dir, "../src/contexts/financials/business-day-seal.ts"))).toBe(true);
    expect(existsSync(resolve(import.meta.dir, "../migrations/0064_audited_business_day_seal.sql"))).toBe(true);

    const financials = await import("../src/contexts/financials");
    expect(financials).toHaveProperty("BusinessDaySealService");
  });
});
