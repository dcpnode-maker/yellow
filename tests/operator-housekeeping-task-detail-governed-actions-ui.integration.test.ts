import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

describe("Order 220 housekeeping-task detail governed action UI", () => {
  test("reuses the exact existing action labels and renders at most one semantic control", () => {
    expect(script).toContain('start: "Start cleaning", complete: "Mark room clean", verify: "Verify inspection"');
    expect(script).toContain("housekeeping-task-detail-governed-action");
    expect(script).toContain("HOUSEKEEPING_ACTION_LABELS[action]");
    expect(script).toContain('button.type = "button"');
    expect(script).toContain('button.setAttribute("aria-label"');
    expect(script).toContain('const action = task.allowedActions[0] || ""');
    expect(script).toContain("allowedActions.length > 1");
  });

  test("uses a legible wrapping 44px target with visible keyboard focus", () => {
    expect(css).toContain(".housekeeping-task-detail-governed-action { min-width: 0; min-height: 44px; max-width: 100%; display: inline-flex;");
    expect(css).toContain("white-space: normal; overflow-wrap: anywhere;");
    expect(css).toContain(".housekeeping-task-detail-governed-action:focus-visible { outline: 3px solid var(--focus);");
  });

  test("gives all six appearances dedicated material treatment and Android a 48px target", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-task-detail-governed-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .housekeeping-task-detail-governed-action { min-height: 48px;');
    expect(css).toContain("backdrop-filter: blur(22px) saturate(175%)");
    expect(css).toContain(':root[data-theme="win95"] .housekeeping-task-detail-governed-action:active { border-style: inset;');
    expect(css).toContain(':root[data-theme="neo"] .housekeeping-task-detail-governed-action:active { transform: none; box-shadow: inset');
  });

  test("contains 375px and 200% zoom without clipping or truncating the action", () => {
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 420px) { .housekeeping-task-detail-governed-action { width: 100%; }");
    expect(spec).toContain("375 pixels and 200% zoom");
  });

  test("contains reduced motion and forced colours while retaining the Order217 final oracle", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .housekeeping-task-detail-governed-action { animation: none; transition: none; transform: none; }");
    expect(css).toContain("@media (forced-colors: active) { .housekeeping-task-detail-governed-action { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;");
    expect(css).toContain("forced-color-adjust: auto;");
    expect(css).toContain(".housekeeping-task-detail-governed-action:focus-visible { outline: 3px solid Highlight;");

    const finalForcedColours = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
    expect(finalForcedColours).toContain(".housekeeping-task-detail-panel");
    expect(finalForcedColours).toContain("CanvasText");
    expect(finalForcedColours).toContain("background: Canvas");
  });
});
