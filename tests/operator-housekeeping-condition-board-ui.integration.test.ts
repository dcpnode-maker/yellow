import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order 208 Housekeeping room-condition human board", () => {
  test("the bounded read-only panel has explicit filter, paging and accessible async states", () => {
    for (const id of [
      "housekeeping-condition-board", "housekeeping-condition-title", "housekeeping-condition-refresh",
      "housekeeping-condition-filter", "housekeeping-condition-count", "housekeeping-condition-loading",
      "housekeeping-condition-error", "housekeeping-condition-retry", "housekeeping-condition-empty",
      "housekeeping-condition-list", "housekeeping-condition-status", "housekeeping-condition-more",
    ]) expect(html).toContain(`id="${id}"`);
    for (const condition of ["clean", "dirty", "pickup", "inspected"]) {
      expect(html).toContain(`<option value="${condition}">`);
    }
    expect(html).toContain('id="housekeeping-condition-board" aria-labelledby="housekeeping-condition-title" aria-busy="false"');
    expect(html).toContain('id="housekeeping-condition-list" role="list"');
    expect(html).toContain('id="housekeeping-condition-status" role="status" aria-live="polite"');
    expect(html).toContain('id="housekeeping-condition-error" hidden role="alert"');
    expect(html).toContain("rooms loaded");
    expect(html).toContain("No readiness, occupancy or guest meaning is inferred");
  });

  test("requests use literal filters and opaque cursors with property, route, view and generation guards", () => {
    const load = functionSource("loadHousekeepingConditions");
    const current = functionSource("housekeepingConditionIsCurrent");
    const result = functionSource("housekeepingConditionResult");
    expect(load).toContain('new URLSearchParams({ limit: "50" })');
    expect(load).toContain('query.set("condition", condition)');
    expect(load).toContain('query.set("cursor", cursor)');
    expect(load).toContain("/housekeeping/conditions?");
    expect(load).toContain("housekeepingConditionRequestGeneration");
    expect(current).toContain("housekeepingConditionGeneration");
    expect(current).toContain("housekeepingConditionRequestGeneration");
    expect(current).toContain("property === propertySelect.value");
    expect(current).toContain("condition === housekeepingConditionFilter.value");
    expect(current).toContain('activeView === "housekeeping"');
    expect(current).toContain('location.pathname === `/p/${property}/housekeeping`');
    expect(result).toContain('["nextCursor", "rooms"]');
    expect(result).toContain('["code", "condition", "floor", "spaceId", "updatedAt"]');
    expect(load).not.toMatch(/localStorage|sessionStorage|setInterval|offset|trim\(|toUpperCase|toLowerCase/);
  });

  test("the client accepts only canonical six-digit PostgreSQL UTC instants", () => {
    const source = functionSource("housekeepingCanonicalInstant");
    const validate = new Function(`${source}; return housekeepingCanonicalInstant;`)() as (value: unknown) => boolean;
    expect(validate("2026-09-17T18:25:45.123456Z")).toBe(true);
    expect(validate("2026-09-17T18:25:45.123Z")).toBe(false);
    expect(validate("2026-09-17T18:25:45.123456+00:00")).toBe(false);
    expect(validate("2026-02-30T18:25:45.123456Z")).toBe(false);
  });

  test("cards remain minimized and loaded counts never claim a property total", () => {
    const card = functionSource("housekeepingConditionCard");
    const render = functionSource("renderHousekeepingConditions");
    expect(card).toContain('article.setAttribute("role", "listitem")');
    expect(card).toContain("room.code");
    expect(card).toContain("room.floor");
    expect(card).toContain("room.condition");
    expect(card).toContain("room.updatedAt");
    expect(card).not.toMatch(/task|assignee|occupancy|reservation|guest|readiness|ready|out.of.order|out.of.service|source|reason/i);
    expect(render).toContain("bounded loaded count, not a whole-property total");
    expect(render).toContain("housekeepingConditionCount.textContent");
    expect(render).toContain("housekeepingConditionNextCursor = page.nextCursor");
  });

  test("focus recovery, paging failure preservation and task actions remain explicit", () => {
    const load = functionSource("loadHousekeepingConditions");
    const focus = functionSource("restoreHousekeepingConditionFocus");
    const taskAction = functionSource("submitHousekeepingAction");
    expect(load).toContain("const previousRows = housekeepingConditionRows.slice()");
    expect(load).toContain("already loaded room");
    expect(load).toContain("housekeepingConditionRetry.focus");
    expect(focus).toContain("housekeepingConditionList.children[previousLength]");
    expect(focus).toContain("housekeepingConditionFilter.focus");
    expect(focus).toContain("housekeepingConditionRefresh.focus");
    expect(taskAction).toContain("/housekeeping/tasks/");
    expect(taskAction).toContain("loadHousekeepingBoard()");
    expect(taskAction).toContain("loadHousekeepingConditions()");
  });

  test("the panel contains at phone zoom, honors motion/forced colours and all appearances", () => {
    expect(css).toContain(".housekeeping-condition-list { min-width: 0;");
    expect(css).toContain("minmax(min(100%,230px),1fr)");
    expect(css).toContain("@media (max-width: 420px) { .housekeeping-condition-board");
    expect(css).toContain(".housekeeping-condition-loading span");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("min-height: 48px");
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-condition-board`);
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-condition-card`);
    }
  });
});
