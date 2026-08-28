import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

describe("Order 225 vehicle-register linked-reservation presentation", () => {
  test("renders the contextual action as a semantic button with exact navigation copy", () => {
    expect(script).toContain('node("button", "vehicle-register-linked-reservation-action", "Open linked reservation")');
    expect(css).toContain(".vehicle-register-linked-reservation-action { min-width: 0; min-height: 44px;");
    expect(css).toContain("white-space: normal; overflow-wrap: anywhere; touch-action: manipulation;");
    expect(spec).toContain("## 31. Vehicle-register-to-reservation return continuity");
    expect(spec).toContain("The existing vehicle-detail action remains unchanged.");
  });

  test("gives all six appearances a dedicated material treatment", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .vehicle-register-linked-reservation-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .vehicle-register-linked-reservation-action { min-height: 48px;');
    expect(css).toContain(':root[data-theme="glass"] .vehicle-register-linked-reservation-action');
    expect(css).toContain("backdrop-filter: blur(20px) saturate(170%)");
    expect(css).toContain(':root[data-theme="win95"] .vehicle-register-linked-reservation-action:active { border-style: inset;');
    expect(css).toContain(':root[data-theme="neo"] .vehicle-register-linked-reservation-action:active { transform: none; box-shadow: inset');
  });

  test("contains 375px and 200% zoom without truncation", () => {
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 420px) { .vehicle-register-linked-reservation-action { width: 100%; }");
    expect(spec).toContain("wraps within its register card at 375");
    expect(spec).toContain("pixels and 200% zoom");
  });

  test("retains focus and contrast while respecting reduced motion", () => {
    expect(css).toContain(".vehicle-register-linked-reservation-action:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .vehicle-register-linked-reservation-action { animation: none; transition: none; transform: none; }");
    expect(css).toContain("@media (forced-colors: active) { .vehicle-register-linked-reservation-action { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;");
    expect(css).toContain("forced-color-adjust: auto;");
    expect(css).toContain(".vehicle-register-linked-reservation-action:focus-visible { outline: 3px solid Highlight;");
  });
});
