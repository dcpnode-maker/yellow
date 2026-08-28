import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

describe("Order 210 reservation-detail Stay changes UI", () => {
  test("the semantic drawer action and reused editor expose one bounded presentation", () => {
    expect(script).toContain('"Stay changes"');
    expect(script).toContain("reservation-stay-changes-action");
    expect(script).toContain("reservation-stay-changes-panel");
    expect(css).toContain(".reservation-stay-changes-action { min-width: 0; max-width: 100%; min-height: 44px;");
    expect(css).toContain(".reservation-stay-changes-panel { min-width: 0; max-width: 100%;");
    expect(css).toContain(".reservation-stay-changes-panel .reservation-segment-editor { width: 100%; min-width: 0; max-width: none;");
    expect(css).toContain("repeat(auto-fit, minmax(min(100%, 128px), 1fr))");
  });

  test("phone and zoom containment preserve legible forms and identifiers", () => {
    expect(css).toContain(".reservation-stay-changes-panel :is(form, fieldset, label, .reservation-field-grid, .reservation-segment-history, .reservation-segment-history li) { min-width: 0; max-width: 100%; }");
    expect(css).toContain(".reservation-stay-changes-panel :is(input, select, textarea, button) { min-width: 0; max-width: 100%; min-height: 44px;");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".reservation-stay-changes-panel .reservation-field-grid { grid-template-columns: minmax(0, 1fr); }");
  });

  test("all six appearances retain material fidelity and Android uses 48-pixel targets", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-stay-changes-panel`);
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-stay-changes-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .reservation-stay-changes-action, :root[data-theme="android"] .reservation-stay-changes-panel :is(input, select, textarea, button) { min-height: 48px; }');
    expect(css).toContain(':root[data-theme="win95"] .reservation-stay-changes-panel { padding: 6px;');
    expect(css).toContain(':root[data-theme="glass"] .reservation-stay-changes-panel { border-color: rgba(255,255,255,.58);');
    expect(css).toContain(':root[data-theme="neo"] .reservation-stay-changes-panel { border-color: #a1adb3;');
    expect(css).toContain(':root[data-theme="erp"] .reservation-stay-changes-panel { border: 1px solid #d9dee7; border-left: 4px solid #163ee9;');
  });

  test("keyboard, forced-colour and reduced-motion contracts remain explicit", () => {
    expect(css).toContain(".reservation-stay-changes-action:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain("@media (forced-colors: active) { .reservation-stay-changes-action:focus-visible { outline: 3px solid Highlight;");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".reservation-stay-changes-action, .reservation-stay-changes-panel { animation: none; transition: none; transform: none; }");
  });
});
