import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const today = readFileSync(resolve(root, "frontend/yellow/src/workspaces/TodayGlassDashboard.tsx"), "utf8");
const css = readFileSync(resolve(root, "frontend/yellow/src/styles.css"), "utf8");

test("Today first screen exposes useful PMS stats before dense drilldowns", () => {
  expect(today).toContain("PMS command centre");
  expect(today).toContain("Front desk, cashier and rooms in one live view");
  for (const label of ["Occupancy", "Room nights", "Available", "Revenue", "ADR", "RevPAR"]) {
    expect(today).toContain(label);
  }
  expect(today).toContain("Business mix by market segment group, market segment and source");
  expect(today).toContain("MSG → MS · source · channel");
  expect(today).toContain("No write action runs from this screen.");
  expect(today).toContain("onOpenPerformance");
});

test("Today first screen keeps movement navigation connected to exact operational tables", () => {
  expect(today).toContain("Open today's complete guest movement tables");
  expect(today).toContain("movement.onOpen");
  expect(today).toContain("setMovementIndex(index)");
  expect(today).not.toContain("window.location.assign(\"#");
});

test("Today glass dashboard has contained mobile and accessible focus styling", () => {
  for (const selector of [
    ".today-glass-command",
    ".today-glass-stat-grid",
    ".today-glass-stat-grid button:focus-visible",
    "@media (max-width: 560px)",
    "@media (max-width: 320px)",
    "@media (prefers-reduced-transparency: reduce)",
  ]) expect(css).toContain(selector);
  expect(css).toContain("grid-template-columns: repeat(2, minmax(0,1fr));");
  expect(css).toContain("grid-template-columns: minmax(0,1fr);");
  expect(css).toContain("overflow-wrap: anywhere");
});
