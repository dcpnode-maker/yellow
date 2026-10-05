import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
const componentPath: string = "../frontend/yellow/src/ui/SegmentedRibbon";
const { SegmentedRibbon, ribbonPreviewKey } = await import(componentPath);
const items = [{ key: "arrival", label: "Arrivals", count: 3 }, { key: "in_house", label: "In house", count: 8 }, { key: "departure", label: "Departures", count: 2 }];

test("hover/focus feedback is transient and never rewrites committed value or items", () => {
  const original = JSON.stringify(items);
  expect(ribbonPreviewKey(items, "arrival", "departure", null)).toBe("departure");
  expect(ribbonPreviewKey(items, "arrival", null, null)).toBe("arrival");
  expect(ribbonPreviewKey(items, "arrival", null, "in_house")).toBe("in_house");
  expect(ribbonPreviewKey(items, "arrival", "departure", "in_house")).toBe("departure");
  expect(ribbonPreviewKey(items.slice(0, 2), "arrival", "departure", null)).toBe("arrival");
  expect(ribbonPreviewKey(items, "arrival", "unknown", "missing")).toBe("arrival");
  expect(JSON.stringify(items)).toBe(original);
});

test("server render preserves committed accessible selection and counts", () => {
  let changes = 0;
  const html = renderToStaticMarkup(createElement(SegmentedRibbon, { label: "Guest movement", items, value: "in_house", onChange: () => changes++ }));
  expect(changes).toBe(0);
  expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  expect(html).toContain('data-preview-key="in_house"');
  expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"[^>]*>.*?In house/);
  expect(html).toContain("<small>8</small>");
});

test("preview wiring preserves mouse leave/cancel, focus exit and touch semantics", () => {
  const source = readFileSync("frontend/yellow/src/ui/SegmentedRibbon.tsx", "utf8");
  expect(source).toContain("refs.current.get(previewKey)");
  expect(source).toContain('event.pointerType !== "touch"');
  expect(source).toContain("onPointerLeave={() => setHoverKey(null)}");
  expect(source).toContain("onPointerCancel={() => setHoverKey(null)}");
  expect(source).toContain("event.currentTarget.contains(event.relatedTarget)");
  expect(source).toContain("}, [value, expanded]);");
  expect(source).toContain("aria-selected={item.key === value}");
  expect(source).toContain("onClick={() => onChange(item.key)}");
});

test("create icon retains explicit accessible name, touch help and exact busy guard", () => {
  const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
  const css = readFileSync("frontend/yellow/src/workspaces/reservation-journey.css", "utf8");
  expect(source).toContain('aria-label="New reservation"');
  expect(source).toContain('disabled={createBusy || creating} onClick={() => setCreating(true)}');
  expect(source).toContain('className="reservation-create-help">New reservation');
  expect(css).toContain("@media (hover: none)");
  expect(css).toContain("width: 44px; min-width: 44px; height: 44px");
});

test("Today pointer leave restores focused movement rather than forcing the first", () => {
  const source = readFileSync("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx", "utf8");
  expect(source).toContain("movementHover ?? movementFocus ?? 0");
  expect(source).toContain("onPointerLeave={() => setMovementHover(null)}");
  expect(source).toContain("onFocus={() => setMovementFocus(index)}");
  expect(source).toContain("event.currentTarget.contains(event.relatedTarget)) setMovementFocus(null)");
});
