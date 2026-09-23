import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

describe("Order 224 reservation-to-Folio return presentation", () => {
  test("uses the exact contextual class and documents complete copy precedence", () => {
    expect(css).toContain(".folio-reservation-return { min-width: 0; min-height: 44px; max-width: 100%; display: inline-flex;");
    expect(spec).toContain("`folio-reservation-return`");
    expect(spec).toContain("**Back to departure**; otherwise a current reservation descriptor");
    expect(spec).toContain("**Back to reservation**; otherwise the direct and non-contextual control");
    expect(spec).toContain("**Back to folio lookup**");
  });

  test("wraps a 44px contextual action with visible focus and Android 48px touch sizing", () => {
    expect(css).toContain("white-space: normal; overflow-wrap: anywhere;");
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain(".folio-reservation-return:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain(':root[data-theme="android"] .folio-reservation-return { min-height: 48px;');
  });

  test("gives the contextual control dedicated material across all six appearances", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .folio-reservation-return {`);
    }
    expect(css).toContain("backdrop-filter: blur(20px) saturate(170%)");
    expect(css).toContain(':root[data-theme="win95"] .folio-reservation-return:active { border-style: inset;');
    expect(css).toContain(':root[data-theme="neo"] .folio-reservation-return:active { transform: none; box-shadow: inset');
  });

  test("contains at 375px and 200% zoom without truncating contextual copy", () => {
    expect(css).toContain("@media (max-width: 420px) { .folio-reservation-return { width: 100%; }");
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(spec).toContain("375 pixels and 200% zoom");
  });

  test("retains system contrast and removes nonessential motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .folio-reservation-return { animation: none; transition: none; transform: none; }");
    expect(css).toContain("@media (forced-colors: active) { .folio-reservation-return { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;");
    expect(css).toContain("forced-color-adjust: auto;");
    expect(css).toContain(".folio-reservation-return:focus-visible { outline: 3px solid Highlight;");
  });

  test("documents contextual history, dirty-exit and no-command containment", () => {
    expect(spec).toContain("## 30. Reservation-to-Folio return continuity");
    expect(spec).toContain("Opening adds exactly one history entry");
    expect(spec).toContain("Existing dirty-Folio confirmation remains mandatory");
    expect(spec).toContain("Navigation runs no POST, PUT, PATCH or DELETE");
    expect(spec).toContain("no financial or checkout command");
  });
});
