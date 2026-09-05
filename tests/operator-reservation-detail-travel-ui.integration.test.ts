import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");

describe("Order 212 reservation-detail Travel details UI", () => {
  test("uses one labelled semantic progressive form with truthful boundaries", () => {
    expect((html.match(/id="reservation-travel-form"/g) || [])).toHaveLength(1);
    for (const name of ["direction", "mode", "carrier", "serviceNo", "scheduledAt", "pickupRequested"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain("Pickup requested records intent only");
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain('role="status" aria-live="polite" tabindex="-1"');
  });

  test("contains controls and long values at phone and 200-percent zoom sizes", () => {
    expect(css).toContain(".reservation-travel-action { min-width: 0; max-width: 100%; min-height: 44px;");
    expect(css).toContain(".reservation-travel-panel { min-width: 0; max-width: 100%;");
    expect(css).toContain(".reservation-travel-panel .reservation-travel-editor { width: 100%; min-width: 0; max-width: none;");
    expect(css).toContain(".reservation-travel-panel :is(input, select, textarea, button) { min-width: 0; max-width: 100%; min-height: 44px;");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".reservation-travel-panel :is(.reservation-summary, .reservation-travel-grid) { grid-template-columns: minmax(0, 1fr); }");
  });

  test("all six appearances are distinct and Android uses 48-pixel targets", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-travel-panel`);
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-travel-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .reservation-travel-action, :root[data-theme="android"] .reservation-travel-panel :is(input, select, textarea, button) { min-height: 48px; }');
    expect(css).toContain(':root[data-theme="win95"] .reservation-travel-panel { padding: 6px;');
    expect(css).toContain(':root[data-theme="glass"] .reservation-travel-panel { border-color: rgba(255,255,255,.58);');
    expect(css).toContain(':root[data-theme="neo"] .reservation-travel-panel { border-color: #a1adb3;');
    expect(css).toContain(':root[data-theme="erp"] .reservation-travel-panel { border: 1px solid #d9dee7; border-left: 4px solid #163ee9;');
  });

  test("keyboard focus, reduced motion and forced colours are explicit", () => {
    expect(css).toContain(".reservation-travel-action:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain(".reservation-travel-action, .reservation-travel-panel { animation: none; transition: none; transform: none; }");
    expect(css).toContain(".reservation-travel-action:focus-visible { outline: 3px solid Highlight;");
    expect(css).toContain(".reservation-travel-panel, .reservation-travel-summary { border: 2px solid CanvasText;");
  });
});
