import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const ribbon = readFileSync(new URL("../frontend/yellow/src/ui/SegmentedRibbon.tsx", import.meta.url), "utf8");
const operations = readFileSync(new URL("../frontend/yellow/src/workspaces/OperationalHub.tsx", import.meta.url), "utf8");
const ecosystem = readFileSync(new URL("../frontend/yellow/src/workspaces/EcosystemHub.tsx", import.meta.url), "utf8");
const market = readFileSync(new URL("../frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../frontend/yellow/src/styles.css", import.meta.url), "utf8");

describe("Order 590 shared ribbon depth", () => {
  test("layering is explicit and contributes exactly two inert decorative cards", () => {
    expect(ribbon).toContain("layered = false");
    expect(ribbon).toContain('className={`segmented-ribbon-scroll${layered ? " is-layered" : ""}`}');
    expect(ribbon.match(/segmented-ribbon-depth segmented-ribbon-depth-/g)).toHaveLength(2);
    expect(ribbon.match(/segmented-ribbon-depth[^>]+aria-hidden="true"/g)).toHaveLength(2);
  });

  test("only substantial top-level workspaces opt into layered mode", () => {
    expect(operations).toContain('<SegmentedRibbon layered label="Operational views"');
    expect(ecosystem).toContain('<SegmentedRibbon layered label="Ecosystem areas"');
    expect(market).toContain('<SegmentedRibbon layered label="Synthetic analysis modes"');
  });

  test("shared ribbon keeps the approved rail, selected pill and pointer-safe depth", () => {
    expect(css).toContain(".segmented-ribbon-scroll.is-layered");
    expect(css).toContain(".segmented-ribbon-depth");
    expect(css).toContain("pointer-events: none");
    expect(css).toContain(".segmented-ribbon button.is-selected");
    expect(css).toContain("border-color: #eeeecb");
    expect(css).toContain("0 0 13px rgba(239,221,0,.42)");
  });

  test("Today uses the same thin yellow edge and valid depth offsets", () => {
    expect(css).toContain(".today-glass-ribbon-pill");
    expect(css).toContain("border-color: #f0d400");
    expect(css).toContain("0 0 0 1px rgba(255,231,0,.5)");
    expect(css).not.toContain("inset-right:");
    expect(css).not.toContain("inset-left:");
  });

  test("accessibility fallbacks remove decoration without removing tabs", () => {
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain(".segmented-ribbon-depth { display: none; }");
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(ribbon).toContain('role="tablist"');
    expect(ribbon).toContain('aria-selected={item.key === value}');
  });

  test("the narrow ribbon owns a real scroll viewport for keyboard reveal", () => {
    expect(ribbon).toContain("const scroller = scrollerRef.current");
    expect(ribbon).toContain("scroller.scrollTo({");
    expect(ribbon).toContain("left: selected.offsetLeft - (scroller.clientWidth - selected.offsetWidth) / 2");
    expect(ribbon).toContain("reveal(next.key)");
    expect(css).toContain(".segmented-ribbon-scroll { margin-inline: 0; padding: 15px 0 12px; }");
    expect(css).not.toContain(".segmented-ribbon-scroll { margin-inline: -14px; padding: 2px 14px 12px; }");
  });
});
