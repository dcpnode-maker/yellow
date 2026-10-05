import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const today = readFileSync("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx", "utf8");
const app = readFileSync("frontend/yellow/src/App.tsx", "utf8");
const css = readFileSync("frontend/yellow/src/styles.css", "utf8");

test("normal dashboard removes instructional demo clutter without adding write actions", () => {
  expect(today).not.toContain("COLLEAGUE DEMO PATH");
  expect(today).not.toContain("Review the implemented PMS flow in order");
  expect(today).not.toContain("demoSteps.map");
  expect(today).not.toContain("commitCheckIn(");
  expect(today).not.toContain("commitCheckout(");
  expect(today).not.toContain("postFolioCharge(");
});

test("operational workspaces remain accessible after demo cards are removed", () => {
  for (const expected of [
    "ReservationDetail",
    "MovementGrid",
    "billingDesk",
    "HousekeepingFloorWorkbench",
    "setAssistant(true)",
  ]) {
    expect(app).toContain(expected);
  }
  expect(app).toContain('onOpen: () => openOperationalTable("due_in")');
  expect(app).toContain("onBilling={billingDesk}");
});

test("replacement drawer is mobile-contained and motion-reducible", () => {
  expect(css).toContain(".today-reservation-drawer");
  expect(css).toContain("overflow-x: auto;");
  expect(css).toContain(".today-drawer-toggle:focus-visible");
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).toContain("@media (max-width: 560px)");
});
