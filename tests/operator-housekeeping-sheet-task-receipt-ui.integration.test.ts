import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

describe("Order 221 housekeeping-sheet task receipt presentation", () => {
  test("contains one bounded wrapping receipt and semantic task list", () => {
    expect(css).toContain(".housekeeping-sheet-task-receipt { min-width: 0; max-width: 100%;");
    expect(css).toContain(".housekeeping-sheet-task-receipt-list { min-width: 0; max-width: 100%;");
    expect(css).toContain(".housekeeping-sheet-task-receipt-item { min-width: 0; max-width: 100%;");
    expect(css).toContain("grid-template-columns: minmax(0,1fr) auto");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(spec).toContain("no more than the command's existing 200-task bound");
  });

  test("uses a wrapping 44px action with visible focus and Android 48px touch treatment", () => {
    expect(css).toContain(".housekeeping-sheet-task-receipt-action { min-width: 0; min-height: 44px; max-width: 100%; display: inline-flex;");
    expect(css).toContain("white-space: normal; overflow-wrap: anywhere;");
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain(".housekeeping-sheet-task-receipt-action:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain(':root[data-theme="android"] .housekeeping-sheet-task-receipt-action { min-height: 48px;');
  });

  test("gives the receipt and action dedicated material across all six appearances", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-sheet-task-receipt {`);
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-sheet-task-receipt-action {`);
    }
    expect(css).toContain("backdrop-filter: blur(28px) saturate(172%)");
    expect(css).toContain(':root[data-theme="win95"] .housekeeping-sheet-task-receipt-action:active { border-style: inset;');
    expect(css).toContain(':root[data-theme="neo"] .housekeeping-sheet-task-receipt-action:active { transform: none; box-shadow: inset');
  });

  test("contains at 375px and 200% zoom without clipping actions or task truth", () => {
    expect(css).toContain("@media (max-width: 420px) { .housekeeping-sheet-task-receipt { padding: .75rem;");
    expect(css).toContain(".housekeeping-sheet-task-receipt-item { grid-template-columns: minmax(0,1fr); }");
    expect(css).toContain(".housekeeping-sheet-task-receipt-action { width: 100%; }");
    expect(spec).toContain("375 pixels and");
    expect(spec).toContain("200% zoom");
  });

  test("retains system contrast and removes nonessential motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .housekeeping-sheet-task-receipt-action { animation: none; transition: none; transform: none; }");
    expect(css).toContain("@media (forced-colors: active) { .housekeeping-sheet-task-receipt,.housekeeping-sheet-task-receipt-item { border: 1px solid CanvasText; background: Canvas; color: CanvasText;");
    expect(css).toContain(".housekeeping-sheet-task-receipt-action { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;");
    expect(css).toContain("forced-color-adjust: auto;");
    expect(css).toContain(".housekeeping-sheet-task-receipt-action:focus-visible { outline: 3px solid Highlight;");
  });

  test("documents transient read-only composition rather than persistent sheet history", () => {
    expect(spec).toContain("## 28. Housekeeping-sheet task receipt");
    expect(spec).toContain("The receipt is not persisted in browser storage and makes no sheet-history claim.");
    expect(spec).toContain("Merely displaying the receipt makes no request.");
    expect(spec).toContain("Order220 remains the");
    expect(spec).toContain("sole action authority after detail loads.");
  });
});
