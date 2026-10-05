import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("Order717 calendar scroll ownership", () => {
  test("the date sheet overrides the legacy mobile sidebar hiding rule", () => {
    const css = readFileSync("frontend/yellow/src/workspaces/host-reservation-calendar.css", "utf8");
    expect(css).toMatch(/\.host-calendar \.host-calendar-selection\s*\{[^}]*display:block/);
    const rootRule = css.match(/\.host-calendar\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(rootRule).not.toMatch(/overflow(?:-y)?\s*:\s*(hidden|clip)/);
  });
  test("the room plan permits vertical gestures to reach the page", () => {
    const css = readFileSync("frontend/yellow/src/workspaces/reservation-room-calendar.css", "utf8");
    const rule = css.match(/\.reservation-calendar-scroll\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(rule).toContain("overscroll-behavior-y: auto");
    expect(rule).toContain("touch-action: pan-x pan-y");
    expect(rule).not.toMatch(/overscroll-behavior:\s*(?:contain|none)/);
    expect(rule).not.toMatch(/(?:height|max-height):\s*\d+(?:px|vh|dvh)/);
    const source = readFileSync("frontend/yellow/src/workspaces/ReservationRoomCalendar.tsx", "utf8");
    expect(source).not.toContain("preventDefault");
    expect(source).not.toContain("document.body.style");
  });
});
