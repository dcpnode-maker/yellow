import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order463 grants only alert insert columns and active update", () => {
  const sql = readFileSync(new URL("../migrations/0091_reservation_alert_authority.sql", import.meta.url), "utf8")
    .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
  expect(sql).toBe("GRANT INSERT (tenant_id, subject_type, subject_id, code, message, show_on, active) ON public.alert TO app_role; GRANT UPDATE (active) ON public.alert TO app_role;");
});
