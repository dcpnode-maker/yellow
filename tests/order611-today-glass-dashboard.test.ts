import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const dashboardModule: string = "../frontend/yellow/src/workspaces/TodayGlassDashboard";
const { TodayGlassDashboard } = await import(dashboardModule);

const root = resolve(import.meta.dir, "..");
const today = readFileSync(resolve(root, "frontend/yellow/src/workspaces/TodayGlassDashboard.tsx"), "utf8");
const css = readFileSync(resolve(root, "frontend/yellow/src/styles.css"), "utf8");

test("Today first screen exposes one PMS performance summary before dense drilldowns", () => {
  expect(today).toContain("PMS command centre");
  expect(today).toContain("Front desk, cashier and rooms in one live view");
  for (const label of ["Occupancy", "rooms sold", "capacity", "Room revenue", "ADR", "RevPAR"]) {
    expect(today.includes(label)).toBe(true);
  }
  expect(today).toContain("Business mix by market segment group, market segment and source");
  expect(today).toContain("MSG → MS · source · channel");
  expect(today).toContain("No write action runs from this screen.");
  expect(today).toContain("onOpenPerformance");
  expect(today).toContain("today-glass-pulse");
  expect(today).not.toContain("today-glass-stat-grid");
  expect(today).not.toContain('helper: "rooms left"');
});

test("Today first screen keeps movement navigation connected to exact operational tables", () => {
  expect(today).toContain("Open today's complete guest movement tables");
  expect(today).toContain("movement.onOpen");
  expect(today).not.toContain("window.location.assign(\"#");

  const movement = (label: string, icon: "arrival" | "departure" | "in-house") => ({
    label, value: 2, loading: false, unavailable: false, icon, onOpen() {},
  });
  const html = renderToStaticMarkup(createElement(TodayGlassDashboard, {
    greeting: "Good morning", propertyName: "Test hotel", localTime: "09:00",
    occupancyPercent: 75, roomNights: 9, roomsAvailable: 12,
    roomRevenue: "AED900", adr: "AED100", revpar: "AED75",
    performanceLoading: false, performanceUnavailable: false,
    movements: [movement("Arrivals", "arrival"), movement("Departures", "departure"), movement("In house", "in-house")],
    businessMix: [], demoSteps: [], onOpenPerformance() {},
  }));
  for (const label of ["Open arrivals table. 2", "Open departures table. 2", "Open in house table. 2"]) {
    expect(html).toContain(`aria-label="${label}"`);
  }
  for (const icon of ["arrival", "departure", "in-house"]) expect(html).toContain(`data-hospitality-icon="${icon}"`);
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
