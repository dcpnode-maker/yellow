import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const probe = readFileSync("tools/probe-colleague-demo-readiness.ts", "utf8");

test("colleague demo readiness probe covers the public PMS review path", () => {
  for (const expected of [
    "operating-performance",
    "reservation-board",
    "check-in/readiness",
    "checkout-readiness",
    "housekeeping/conditions",
    "cashier-sessions",
    "folios/",
    "jarvis:ask",
  ]) {
    expect(probe).toContain(expected);
  }
});

test("colleague demo readiness probe remains read-only after synthetic login", () => {
  const afterLogin = probe.slice(probe.indexOf("async function lane"));
  expect(probe).toContain('/api/v1/auth/demo:enter", { method: "POST"');
  expect(afterLogin).not.toMatch(/commitCheckIn|commitCheckout|postFolioCharge|transitionHousekeepingTask|reservations:commit/);
  expect(afterLogin).not.toMatch(/method:\s*"(?:PUT|PATCH|DELETE)"/);
  expect(afterLogin).not.toContain("/charges");
  expect(afterLogin).not.toContain("/transition");
});

test("colleague demo readiness probe verifies Overwatch confirmation gating", () => {
  expect(probe).toContain("Overwatch confirmation-gated assistant");
  expect(probe).toContain('overwatch.navigation === "today"');
  expect(probe).toContain('overwatch.focus === "due_in"');
  expect(probe).toContain("overwatch.requiresConfirmation === true");
});

test("colleague demo readiness probe follows server-owned readiness and folio shapes", () => {
  expect(probe).toContain("arrivalReadiness.canCheckIn");
  expect(probe).toContain("firstOpenFolioId");
  expect(probe).toContain('item.status === "open"');
  expect(probe).toContain("statement.rows");
  expect(probe).toContain("statement.chargeOptions");
  expect(probe).toContain("chargeAvailability.allowed === true");
  expect(probe).not.toContain("primaryFolioId = inHouseReservation.primaryFolioId");
});
