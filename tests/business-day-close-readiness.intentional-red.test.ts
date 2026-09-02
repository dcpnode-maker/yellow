import { describe, expect, test } from "bun:test";

const service = new URL("../src/contexts/financials/business-day-close-readiness.ts", import.meta.url);

describe("Order 349 intentional red: audited business-day close readiness", () => {
  test("requires the absent immutable read model and public export", async () => {
    const source = (await Bun.file(service).exists()) ? await Bun.file(service).text() : "";
    const exports = await Bun.file(new URL("../src/contexts/financials/index.ts", import.meta.url)).text();

    expect(source).toContain("export class BusinessDayCloseReadinessService");
    expect(source).toContain("transaction_timestamp()");
    expect(source).not.toContain("->>");
    expect(exports).toContain('from "./business-day-close-readiness"');
  });
});
