import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

describe("Order 219 reservation-detail operational preparation UI", () => {
  test("renders at most one semantic status-matched preparation action", () => {
    expect(script).toContain("function reservationOperationalPreparation(");
    expect(script).toContain("function openReservationOperationalPreparation(");
    expect(script).toContain("reservation-operational-preparation-action");
    expect(script).toContain('"Prepare check-in"');
    expect(script).toContain('"Prepare checkout"');
    expect(script).toContain('action.type = "button"');
    expect(script).toContain('action.setAttribute("aria-label"');
  });

  test("uses a legible wrapping 44px target with visible keyboard focus", () => {
    expect(css).toContain(".reservation-operational-preparation-action { min-width: 0; min-height: 44px; max-width: 100%; display: inline-flex;");
    expect(css).toContain("white-space: normal; overflow-wrap: anywhere;");
    expect(css).toContain(".reservation-operational-preparation-action:focus-visible { outline: 3px solid var(--focus);");
  });

  test("gives all six appearances dedicated material treatment and Android a 48px target", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .reservation-operational-preparation-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .reservation-operational-preparation-action { min-height: 48px;');
    expect(css).toContain(':root[data-theme="glass"] .reservation-operational-preparation-action');
    expect(css).toContain("backdrop-filter: blur(22px) saturate(175%)");
    expect(css).toContain(':root[data-theme="win95"] .reservation-operational-preparation-action:active { border-style: inset;');
    expect(css).toContain(':root[data-theme="neo"] .reservation-operational-preparation-action:active { transform: none; box-shadow: inset');
  });

  test("contains 375px and 200% zoom without clipping or truncation", () => {
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 420px) { .reservation-operational-preparation-action { width: 100%; }");
  });

  test("contains reduced motion and forced colours while retaining visible focus", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .reservation-operational-preparation-action { animation: none; transition: none; transform: none; }");
    expect(css).toContain("@media (forced-colors: active) { .reservation-operational-preparation-action { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;");
    expect(css).toContain("forced-color-adjust: auto;");
    expect(css).toContain(".reservation-operational-preparation-action:focus-visible { outline: 3px solid Highlight;");
  });
});
