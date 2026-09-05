import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

describe("Order 215 reservation pickup-task detail UI", () => {
  test("contains one readable action and panel with long-identity safety", () => {
    expect(css).toContain(".pickup-task-detail-action { min-width: 0; max-width: 100%; min-height: 44px;");
    expect(css).toContain(".pickup-task-detail-panel { min-width: 0; max-width: 100%;");
    expect(css).toContain(".pickup-task-detail-panel :is(h4, p, strong, span, dt, dd, button) { overflow-wrap: anywhere;");
    expect(css).toContain(".pickup-task-detail-identifiers");
    expect(spec).toContain("375 pixels and 200% zoom");
  });

  test("gives all six appearances a dedicated native material treatment", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .pickup-task-detail-panel`);
    }
    expect(css).toContain(':root[data-theme="android"] .pickup-task-detail-action');
    expect(css).toContain("min-height: 48px");
    expect(css).toContain(':root[data-theme="win95"] .pickup-task-detail-panel');
    expect(css).toContain(':root[data-theme="glass"] .pickup-task-detail-panel');
  });

  test("uses text-backed task status with every exact state hook", () => {
    for (const status of ["open", "assigned", "in_progress", "done", "verified", "cancelled"]) {
      expect(css).toContain(`.pickup-task-detail-status[data-task-status="${status}"]`);
    }
    expect(css).not.toMatch(/\.pickup-task-detail-status(?::before|::before|:after|::after)[^{]*\{[^}]*content\s*:/);
    expect(spec).toContain("Text carries the complete task-status meaning");
  });

  test("preserves visible focus, small-screen containment, forced colours and reduced motion", () => {
    expect(css).toContain(".pickup-task-detail-action:focus-visible, .pickup-task-detail-back:focus-visible, .pickup-task-detail-retry:focus-visible");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".pickup-task-detail-panel { margin-inline: 0; padding: .75rem;");
    expect(css).toContain(".pickup-task-detail-action, .pickup-task-detail-panel { animation: none; transition: none; transform: none;");
    expect(css).toContain(".pickup-task-detail-panel, .pickup-task-detail-status { border: 2px solid CanvasText;");
    expect(css).toContain("forced-color-adjust: auto");
  });
});
