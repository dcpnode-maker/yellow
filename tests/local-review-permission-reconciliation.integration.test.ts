import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { reconcileLocalReviewPermissions } from "../scripts/reconcile-local-review-permissions";

test("Order 399 reconciliation rejects non-local or incomplete authority before connecting", async () => {
  await expect(reconcileLocalReviewPermissions({
    databaseUrl: "postgresql://yellow_deploy:never-use@example.com/yellow",
    logger: () => undefined,
  })).rejects.toThrow("restricted to a loopback PostgreSQL host");
  await expect(reconcileLocalReviewPermissions({
    databaseUrl: "postgresql://yellow_deploy@127.0.0.1/yellow",
    logger: () => undefined,
  })).rejects.toThrow("requires deployment credentials");
});

test("Order 399 source admits only the exact maker/checker convergence surface", () => {
  const source = readFileSync(new URL("../scripts/reconcile-local-review-permissions.ts", import.meta.url), "utf8");
  expect(source).toContain('const LOCK_NAME = "yellow.local.review.permissions.v1"');
  expect(source).toContain('maximum: 68, count: 68');
  expect(source).toContain('"financials.trust:post"');
  expect(source).toContain('"financials.trust:approve-negative"');
  expect(source).toContain('"financials.business-days:read"');
  expect(source).toContain('"business_day.seal"');
  expect(source).toContain('"financials.business-days:seal"');
  expect(source).toContain('"financials.business-day:carry-discrepancy"');
  expect(source).toContain('"financials.business-day:approve-discrepancy-carry"');
  expect(source).not.toMatch(/DELETE\s+FROM/i);
  expect(source).not.toMatch(/UPDATE\s+(permission|role_permission|role|user_role|app_user)/i);
  expect(source).not.toContain("scripts/seed-review");
});

test("Order 399 checker exclusions are explicit and remain checked after insertion", () => {
  const source = readFileSync(new URL("../scripts/reconcile-local-review-permissions.ts", import.meta.url), "utf8");
  expect(source.match(/requireCheckerExclusions\(connection, approverRoleId\)/g)).toHaveLength(2);
});
