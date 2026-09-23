import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

describe("Order 211 reservation-detail Guests & shares UI", () => {
  test("one semantic drawer action hosts the existing editor in a bounded panel", () => {
    expect(script).toContain("Guests & shares");
    expect(script).toContain("reservation-guest-allocation-action");
    expect(script).toContain("reservation-guest-allocation-panel");
    expect(css).toContain(".reservation-guest-allocation-action { min-width: 0; max-width: 100%; min-height: 44px;");
    expect(css).toContain(".reservation-guest-allocation-panel { min-width: 0; max-width: 100%;");
    expect(css).toContain(".reservation-guest-allocation-panel .reservation-guest-editor { width: 100%; min-width: 0; max-width: none;");
  });

  test("dynamic rows, long identifiers and share totals contain at phone and zoom sizes", () => {
    expect(css).toContain(".reservation-guest-allocation-panel :is(form, fieldset, label, .reservation-summary, .reservation-guest-list, .reservation-guest-row) { min-width: 0; max-width: 100%; }");
    expect(css).toContain(".reservation-guest-allocation-panel .reservation-guest-row { grid-template-columns: minmax(0, 1fr); }");
    expect(css).toContain(".reservation-guest-allocation-panel :is(input, select, textarea, button) { min-width: 0; max-width: 100%; min-height: 44px;");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("font-variant-numeric: tabular-nums");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".reservation-guest-allocation-panel :is(.reservation-summary, .reservation-guest-row) { grid-template-columns: minmax(0, 1fr); }");
  });

  test("all six appearances retain native material treatment and Android uses 48-pixel targets", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-guest-allocation-panel`);
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-guest-allocation-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .reservation-guest-allocation-action, :root[data-theme="android"] .reservation-guest-allocation-panel :is(input, select, textarea, button) { min-height: 48px; }');
    expect(css).toContain(':root[data-theme="win95"] .reservation-guest-allocation-panel { padding: 6px;');
    expect(css).toContain(':root[data-theme="glass"] .reservation-guest-allocation-panel { border-color: rgba(255,255,255,.58);');
    expect(css).toContain(':root[data-theme="neo"] .reservation-guest-allocation-panel { border-color: #a1adb3;');
    expect(css).toContain(':root[data-theme="erp"] .reservation-guest-allocation-panel { border: 1px solid #d9dee7; border-left: 4px solid #163ee9;');
  });

  test("keyboard, forced-colour and reduced-motion behavior is explicit", () => {
    expect(css).toContain(".reservation-guest-allocation-action:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain(".reservation-guest-allocation-action, .reservation-guest-allocation-panel { animation: none; transition: none; transform: none; }");
    expect(css).toContain(".reservation-guest-allocation-action:focus-visible { outline: 3px solid Highlight;");
    expect(css).toContain(".reservation-guest-allocation-panel, .reservation-guest-allocation-panel .reservation-guest-row { border: 2px solid CanvasText;");
  });
});
