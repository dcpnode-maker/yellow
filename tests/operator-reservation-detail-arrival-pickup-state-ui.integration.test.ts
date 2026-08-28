import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

describe("Order 214 reservation-detail arrival pickup state UI", () => {
  test("uses one contained text-backed semantic status with every exact state hook", () => {
    expect(css).toContain(".reservation-travel-detail, .reservation-travel-detail-copy { min-width: 0; max-width: 100%; }");
    expect(css).toContain(".reservation-travel-detail-copy { display: block; overflow-wrap: anywhere; }");
    expect(css).toContain(".reservation-pickup-state { box-sizing: border-box; min-width: 0; max-width: 100%; width: fit-content;");
    expect(css).toContain("white-space: normal; overflow-wrap: anywhere;");
    for (const state of ["not-requested", "schedule-required", "task-pending", "task-linked"]) {
      expect(css).toContain(`.reservation-pickup-state[data-pickup-state="${state}"]`);
    }
    expect(css).not.toMatch(/\.reservation-pickup-state(?::before|::before|:after|::after)[^{]*\{[^}]*content\s*:/);
    for (const label of [
      "Pickup not requested",
      "Pickup requested · schedule required",
      "Pickup requested · task pending",
      "Pickup task linked",
    ]) expect(spec).toContain(label);
  });

  test("gives all six existing appearances a dedicated native material treatment", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-pickup-state`);
    }
    expect(css).toContain(':root[data-theme="apple"] .reservation-pickup-state { padding: .34rem .68rem;');
    expect(css).toContain(':root[data-theme="android"] .reservation-pickup-state { padding: .38rem .75rem;');
    expect(css).toContain(':root[data-theme="win95"] .reservation-pickup-state { padding: 3px 6px; border: 2px inset #fff; border-radius: 0;');
    expect(css).toContain(':root[data-theme="glass"] .reservation-pickup-state { border-color: rgba(255,255,255,.72);');
    expect(css).toContain(':root[data-theme="neo"] .reservation-pickup-state { border-color: #a1adb3;');
    expect(css).toContain(':root[data-theme="erp"] .reservation-pickup-state { padding: .3rem .55rem;');
  });

  test("explicitly contains at phone and 200-percent zoom sizes without motion", () => {
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".reservation-pickup-state { width: 100%; justify-content: flex-start; }");
    expect(css).toContain(".reservation-pickup-state { animation: none; transition: none; transform: none; }");
    expect(spec).toContain("375 pixels and 200% zoom");
    expect(spec).toContain("reduced motion applies no animation");
  });

  test("forced colours preserve text and a system-visible boundary", () => {
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain(".reservation-pickup-state, .reservation-pickup-state[data-pickup-state] { border: 2px solid CanvasText; background: Canvas; color: CanvasText; box-shadow: none;");
    expect(css).toContain("forced-color-adjust: auto;");
    expect(spec).toContain("Text carries the complete meaning");
  });
});
