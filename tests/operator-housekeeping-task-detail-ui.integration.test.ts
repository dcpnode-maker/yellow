import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

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

describe("Order 217 exact housekeeping-task detail UI", () => {
  test("builds one bounded semantic panel with accessible async and navigation controls", () => {
    const ensure = functionSource("ensureHousekeepingTaskDetailPanel");
    expect(ensure).toContain('node("section", "card housekeeping-task-detail-panel")');
    expect(ensure).toContain('aria-labelledby", "housekeeping-task-detail-title"');
    expect(ensure).toContain('aria-busy", "false"');
    expect(ensure).toContain('node("button", "quiet housekeeping-task-detail-back"');
    expect(ensure).toContain('node("button", "secondary housekeeping-task-detail-refresh"');
    expect(ensure).toContain('setAttribute("role", "alert")');
    expect(ensure).toContain('node("button", "secondary housekeeping-task-detail-retry"');
    expect(css).toContain(".housekeeping-task-detail-panel { min-width: 0;");
    expect(css).toContain("overflow: hidden");
  });

  test("uses text-backed task and room-condition meaning without colour-only status", () => {
    const render = functionSource("renderHousekeepingTaskDetail");
    expect(render).toContain("HOUSEKEEPING_STATUS_LABELS[task.taskStatus]");
    expect(render).toContain("HOUSEKEEPING_CONDITION_LABELS[task.roomCondition]");
    expect(render).toContain('housekeepingBadge("task-status"');
    expect(render).toContain('housekeepingBadge("room-condition"');
    for (const status of ["assigned", "in_progress", "done"]) {
      expect(css).toContain(`.housekeeping-badge[data-value="${status}"]`);
    }
    expect(css).not.toMatch(/\.housekeeping-badge(?::before|::before|:after|::after)[^{]*\{[^}]*content\s*:/);
  });

  test("gives all six appearances dedicated material rather than palette-only hooks", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-task-detail-panel`);
    }
    expect(css).toContain(':root[data-theme="android"] :is(.housekeeping-task-detail-action');
    expect(css).toContain("min-height: 48px");
    expect(css).toContain(':root[data-theme="win95"] .housekeeping-task-detail-panel');
    expect(css).toContain(':root[data-theme="glass"] .housekeeping-task-detail-panel');
    expect(css).toContain("backdrop-filter");
    expect(css).toContain(':root[data-theme="neo"] .housekeeping-task-detail-panel');
    expect(css).toContain("box-shadow");
    expect(css).toContain(':root[data-theme="erp"] .housekeeping-task-detail-panel');
  });

  test("contains at 375 pixels and 200% zoom with visible keyboard focus", () => {
    expect(css).toContain(".housekeeping-task-detail-head h3 { margin: .2rem 0 0; overflow-wrap: anywhere;");
    expect(css).toContain(".housekeeping-task-detail-facts dd { min-width: 0;");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 420px) { .housekeeping-task-detail-summary");
    expect(css).toContain(".housekeeping-task-detail-facts { grid-template-columns: 1fr;");
    expect(css).toContain(".housekeeping-task-detail-actions button,.housekeeping-task-detail-action { width: 100%;");
    expect(css).toContain("button:focus-visible");
    expect(css).toContain("min-height: 44px");
    expect(spec).toContain("375 pixels and 200% zoom");
  });

  test("preserves forced-colour contrast and removes nonessential reduced-motion effects", () => {
    const forced = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
    expect(forced).toContain(".housekeeping-task-detail-panel");
    expect(forced).toContain("CanvasText");
    expect(forced).toContain("background: Canvas");

    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .housekeeping-task-detail-loading span { animation: none; }");
    expect(css).toContain(".card, .option-card, .metric, .reservation-board-card, .folio-posting-card, .reservation-detail-section, input, select, textarea, .primary, .quiet, .secondary { transition: none; }");
  });
});
