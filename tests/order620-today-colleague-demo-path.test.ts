import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const today = readFileSync("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx", "utf8");
const app = readFileSync("frontend/yellow/src/App.tsx", "utf8");
const css = readFileSync("frontend/yellow/src/styles.css", "utf8");

test("today command centre exposes a colleague demo path without write actions", () => {
  expect(today).toContain("COLLEAGUE DEMO PATH");
  expect(today).toContain("Review the implemented PMS flow in order");
  expect(today).toContain("Dashboard cards navigate only.");
  expect(today).toContain("demoSteps.map");
  expect(today).not.toContain("commitCheckIn(");
  expect(today).not.toContain("commitCheckout(");
  expect(today).not.toContain("postFolioCharge(");
});

test("demo path covers the complete public PMS review sequence", () => {
  for (const expected of [
    "Operating pulse",
    "Board & stay detail",
    "Guided check-in",
    "Folio & posting desk",
    "Guided checkout",
    "Housekeeping & operations",
    "Multilingual AI assistant",
  ]) {
    expect(app).toContain(expected);
  }
  expect(app).toContain('onOpen: () => openOperationalTable("due_in")');
  expect(app).toContain("onOpen: billingDesk");
  expect(app).toContain('onOpen: () => setAssistantOpen(true)');
});

test("demo path is mobile-contained and preserves neon focus affordance", () => {
  expect(css).toContain(".today-demo-path-grid {");
  expect(css).toContain("overflow-x: auto;");
  expect(css).toContain("scroll-snap-type: x proximity;");
  expect(css).toContain("border-color: rgba(117,255,0,.62)");
  expect(css).toContain("@media (max-width: 560px)");
  expect(css).toContain("grid-template-columns: repeat(7, minmax(142px, 76vw));");
});
