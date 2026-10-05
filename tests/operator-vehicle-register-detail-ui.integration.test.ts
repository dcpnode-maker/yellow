import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const spec = readFileSync(new URL("../docs/UI-SPEC.md", import.meta.url), "utf8");

describe("Order 216 exact Vehicle Register detail UI", () => {
  test("contains a bounded readable panel and accessible actions", () => {
    expect(css).toContain(".vehicle-detail-panel { position: relative; display: grid;");
    expect(css).toContain("min-width: 0; max-width: 100%; overflow: clip;");
    expect(css).toContain(".vehicle-detail-action, .vehicle-detail-actions button, .vehicle-detail-error button { min-height: 44px;");
    expect(css).toContain(".vehicle-detail-title");
    expect(spec).toContain("375 pixels and 200% zoom");
  });

  test("gives all six appearances a dedicated material treatment", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .vehicle-detail-panel`);
    }
    expect(css).toContain(':root[data-theme="glass"] :is(.vehicle-detail-summary,.vehicle-detail-facts .vehicle-meta-item)');
    expect(css).toContain(':root[data-theme="neo"] :is(.vehicle-detail-summary,.vehicle-detail-facts .vehicle-meta-item)');
  });

  test("preserves small-screen, forced-colour and reduced-motion containment", () => {
    expect(css).toContain("@media (max-width: 420px) { .vehicle-register-meta, .vehicle-detail-facts");
    expect(css).toContain(".vehicle-detail-actions button, .vehicle-detail-action { flex-basis: 100%; width: 100%; }");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .vehicle-register-loading span, .vehicle-detail-loading span { animation: none; }");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain(".vehicle-detail-panel, .vehicle-detail-summary, .vehicle-detail-identifiers, .vehicle-detail-error");
  });
});
