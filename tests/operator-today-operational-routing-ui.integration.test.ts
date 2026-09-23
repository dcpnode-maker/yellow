import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

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

describe("Order 209 Today operational routing UI", () => {
  test("exact due-in and due-out preparation actions expose the governed workbench query hooks", () => {
    const action = functionSource("todayOperationalAction");
    const render = functionSource("renderTodayLane");
    expect(action).toContain("Prepare check-in");
    expect(action).toContain("Prepare checkout");
    expect(action).toContain('"due_in"');
    expect(action).toContain('"due_out"');
    expect(script).toContain('["check-in", "checkout"]');
    expect(script).toContain('const RESERVATION_WORKBENCH_QUERY = Object.freeze({\n  "check-in": "workbench=check-in",\n  checkout: "workbench=checkout",\n });');
    expect(functionSource("openReservationDetail")).toContain("RESERVATION_WORKBENCH_QUERY[currentReservationWorkbench]");
    expect(render).toContain("todayOperationalAction(status, row.status)");
    const card = functionSource("reservationCard");
    expect(card).toContain('node("button", "today-operational-action"');
    expect(card).toContain('action.type = "button"');
    expect(card).toContain('action.setAttribute("aria-label"');
  });

  test("the pure action choice creates only the exact in-house route and never infers one from evidence", () => {
    const action = functionSource("todayOperationalAction");
    expect(action).toContain('laneStatus === "in_house" && rowStatus === "in_house"');
    expect(action).not.toMatch(/arrival|departure|travel|pickup|room|folio|readiness|condition/i);
  });

  test("the CTA wraps without a fixed inline measure and remains a 44/48-pixel target", () => {
    expect(css).toContain(".today-operational-action { min-width: 0; max-width: 100%; min-height: 44px; inline-size: auto;");
    expect(css).toContain("display: inline-flex; flex-wrap: wrap;");
    expect(css).toContain('@media (max-width: 420px) { .today-operational-action { width: 100%;');
    expect(css).toContain(':root[data-theme="android"] .today-operational-action { min-height: 48px;');
    expect(css).toContain(".today-operational-action:focus-visible { outline: 3px solid var(--focus);");
  });

  test("all appearances, forced colours and reduced motion have explicit compatibility", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .today-operational-action`);
    }
    expect(css).toContain('@media (forced-colors: active) { .today-operational-action');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(".today-operational-action { transition: none; transform: none; }");
  });
});
