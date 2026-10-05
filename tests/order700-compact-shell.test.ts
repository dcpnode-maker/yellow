import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
const dashboardModule: string = "../frontend/yellow/src/workspaces/TodayGlassDashboard";
const { TodayGlassDashboard } = await import(dashboardModule);

const movement = (label: string) => ({ label, value: 2, loading: false, unavailable: false, glyph: "", onOpen() {} });
const base = {
  greeting: "Good morning", propertyName: "Test hotel", localTime: "09:00",
  occupancyPercent: 75, roomNights: 9, roomsAvailable: 12,
  roomRevenue: "AED900", adr: "AED100", revpar: "AED75",
  performanceLoading: false, performanceUnavailable: false,
  movements: [movement("Arrivals"), movement("Departures"), movement("In house")] as const,
  businessMix: [], demoSteps: [], onOpenPerformance() {},
};

describe("Order700 compact performance and navigation", () => {
  test("one summary retains every metric without the duplicated six-stat ribbon", () => {
    const html = renderToStaticMarkup(createElement(TodayGlassDashboard, base));
    expect(html.match(/aria-label="Open operating performance\./g)).toHaveLength(2);
    for (const metric of ["75%", "9", "12", "AED900", "AED100", "AED75", "ADR", "RevPAR"]) expect(html).toContain(metric);
    expect(html).not.toContain("Useful operating stats");
    expect(html).not.toContain("today-glass-stat-grid");
    expect(html).toContain("today-glass-pulse");
  });
  test("does not replace loading or unavailable metrics with fake zero", () => {
    for (const [overrides, label] of [[{ performanceLoading: true }, "Loading"], [{ performanceUnavailable: true }, "Unavailable"]] as const) {
      const html = renderToStaticMarkup(createElement(TodayGlassDashboard, { ...base, ...overrides }));
      expect(html).toContain(`Occupancy ${label}`);
      expect(html).not.toContain("AED900");
      expect(html).not.toContain("75%");
    }
  });
  test("groups create beside family ribbon and retains guarded draft behavior", () => {
    const css = readFileSync("frontend/yellow/src/workspaces/reservation-journey.css", "utf8");
    const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
    expect(css).toMatch(/\.reservation-journey-family\s*\{[^}]*justify-content: flex-start/);
    expect(css).not.toMatch(/\.reservation-journey-family\s*\{[^}]*space-between/);
    expect(source).toContain('disabled={createBusy || creating}');
    expect(source).toContain('aria-label="Individual reservation phases"');
    expect(source).toContain('aria-label="Individual reservation draft"');
  });
  test("centers collapsed dock with touch targets, current indicator and limited motion", () => {
    const css = readFileSync("frontend/yellow/src/ui/workspace-dock.css", "utf8");
    const header = readFileSync("frontend/yellow/src/ui/OperatorHeader.tsx", "utf8");
    const dock = readFileSync("frontend/yellow/src/ui/WorkspaceDock.tsx", "utf8");
    expect(css).toContain('.operator-workspace-dock[data-placement="bottom"]');
    expect(css).toContain("left: 50%");
    expect(css).toContain("translateX(-50%)");
    expect(css).toContain('.operator-quick-dock > button[aria-current="page"]::after');
    expect(css).toContain("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    expect(css).toContain("flex: 0 0 44px");
    expect(css).toContain(".operator-dock-tooltip");
    expect(header).toContain('(!open || mobile) && (!mobile || !mobileOpen)');
    expect(header).toContain('if (locked) return;');
    expect(header).toContain('id: "settings", label: "Property setup"');
    expect(dock).toContain("onPointerDown={interaction.onPointerDown}");
    expect(readFileSync("frontend/yellow/src/ui/workspace-dock.ts", "utf8")).toContain("setPointerCapture?.(event.pointerId)");
  });
});
