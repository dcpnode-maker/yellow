import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("frontend/yellow/src/workspaces/FinanceWorkspace.tsx", "utf8");

// Founder deferred physical custody in721; isolated716 source/proof is retained.
test("guest cashiering is independent of deferred physical cash drawers", () => {
  for (const absent of ["CashDrawerWorkbench", "loadCashierSnapshot", "cashier-snapshot", "cashDrawerLease", "Cash custody readiness"]) {
    expect(source.includes(absent)).toBe(false);
  }
  expect(source.includes('return <CashierWorkbench initialReservationId={initialReservationId}')).toBe(true);
  expect(source.includes('queryFn: loadReservationBoard')).toBe(true);
});

test("shared financial leases still protect guest-folio actions", () => {
  expect(source).toContain('additionalWindowLease.current !== null || !acquireDepositMutationLease()');
  expect(source).toContain('depositMutationLease.current = true');
  expect(source).toContain('onLifecycleBusyChange?.(true)');
  expect(source).toContain('allocationLocked || depositLocked');
});
