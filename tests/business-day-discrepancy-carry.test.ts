import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Order 351 governed business-day discrepancy carry", () => {
  test("ships the forward migration and financials service", () => {
    expect(existsSync(resolve(import.meta.dir, "../migrations/0063_governed_business_day_discrepancy_carry.sql"))).toBe(true);
    expect(existsSync(resolve(import.meta.dir, "../src/contexts/financials/business-day-discrepancy-carry.ts"))).toBe(true);
  });
  test("binds the exact four-eyes, current-day and immutable evidence contract", () => {
    const migration=readFileSync(resolve(import.meta.dir,"../migrations/0063_governed_business_day_discrepancy_carry.sql"),"utf8");
    expect(migration).toContain("financials.business-day:carry-discrepancy");
    expect(migration).toContain("financials.business-day:approve-discrepancy-carry");
    expect(migration).toContain("transaction_timestamp()>=a.created_at+interval '30 minutes'");
    expect(migration).toContain("a.decided_by=p_actor");
    expect(migration).toContain("resolution='carried_forward'");
    expect(migration).toContain("ALTER TABLE public.business_day_discrepancy_carry FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.business_day_discrepancy_carry FROM PUBLIC,app_role,yellow_runtime");
    expect(migration).not.toMatch(/INSERT INTO public\.(journal|posting_line|payment|document|folio|account)\b/);
  });
});
