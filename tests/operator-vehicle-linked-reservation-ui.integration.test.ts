import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

describe("Order 218 vehicle linked-reservation UI", () => {
  test("uses a semantic, legible and keyboard-visible action rather than a colour-only cue", () => {
    expect(script).toContain('node("button", "vehicle-linked-reservation-action", "Open linked reservation")');
    expect(css).toContain(".vehicle-linked-reservation-action { min-width: 0; min-height: 44px;");
    expect(css).toContain("white-space: normal; overflow-wrap: anywhere;");
    expect(css).toContain(".vehicle-linked-reservation-action:focus-visible { outline: 3px solid var(--focus);");
  });

  test("gives all six appearances a dedicated material treatment", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .vehicle-linked-reservation-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .vehicle-linked-reservation-action { min-height: 48px;');
    expect(css).toContain(':root[data-theme="glass"] .vehicle-linked-reservation-action');
    expect(css).toContain("backdrop-filter: blur(20px) saturate(170%)");
    expect(css).toContain(':root[data-theme="win95"] .vehicle-linked-reservation-action:active { border-style: inset;');
    expect(css).toContain(':root[data-theme="neo"] .vehicle-linked-reservation-action:active { box-shadow: inset');
  });

  test("contains 375px and 200% zoom without clipping or truncating the action", () => {
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 420px) { .vehicle-linked-reservation-action { width: 100%; }");
  });

  test("contains forced colours and reduced motion while retaining visible focus", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .vehicle-linked-reservation-action { animation: none; transition: none; transform: none; }");
    expect(css).toContain("@media (forced-colors: active) { .vehicle-linked-reservation-action { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;");
    expect(css).toContain("forced-color-adjust: auto;");
    expect(css).toContain(".vehicle-linked-reservation-action:focus-visible { outline: 3px solid Highlight;");
  });
});
