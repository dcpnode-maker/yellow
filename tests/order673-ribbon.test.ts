import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const ribbon = source("../frontend/yellow/src/ui/SegmentedRibbon.tsx");
const panel = source("../frontend/yellow/src/ui/RibbonPanel.tsx");
const operations = source("../frontend/yellow/src/workspaces/OperationalHub.tsx");
const ecosystem = source("../frontend/yellow/src/workspaces/EcosystemHub.tsx");
const market = source("../frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx");

describe("Order 673 shared ribbon interactions", () => {
  test("compact disclosure controls a hidden navigation panel and selected label", () => {
    expect(ribbon).toContain("collapsedLabel?: string");
    expect(ribbon).toContain("defaultExpanded?: boolean");
    expect(ribbon).toContain('aria-expanded={expanded}');
    expect(ribbon).toContain("aria-controls={panelId}");
    expect(ribbon).toContain("hidden={!expanded}");
    expect(ribbon).toContain('event.key === "Escape"');
    expect(ribbon).toContain("disclosureRef.current?.focus()");
  });

  test("tabs retain roving keyboard selection and an automatically measured moving indicator", () => {
    expect(ribbon).toContain('role="tablist"');
    expect(ribbon).toContain('behavior: "auto"');
    expect(ribbon).toContain('focus({ preventScroll: true })');
    expect(ribbon).toContain('role="tab"');
    expect(ribbon).toContain('tabIndex={item.key === value ? 0 : -1}');
    expect(ribbon).toContain('event.key === "ArrowLeft"');
    expect(ribbon).toContain('event.key === "ArrowRight"');
    expect(ribbon).toContain('event.key === "Home"');
    expect(ribbon).toContain('event.key === "End"');
    expect(ribbon).toContain("new ResizeObserver(measure)");
    expect(ribbon).toContain('className="segmented-ribbon-indicator"');
    expect(ribbon).toContain("selected.offsetLeft");
    // The capsule uses CSS reduced-motion rules; viewport reveal is always immediate.
    expect(ribbon).toContain('behavior: "auto"');
  });

  test("transition wrapper animates mounted content without hiding or cloning controls", () => {
    expect(panel).toContain('className={`ribbon-panel');
    expect(panel).toContain("panel.animate(");
    expect(panel).toContain("animation.cancel()");
    expect(panel).toContain("animationRef.current?.cancel()");
    expect(panel).not.toContain("aria-hidden");
    expect(panel).not.toContain("cloneElement");
    expect(panel).not.toContain("key={transitionKey}");
    expect(panel).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
  });

  test("all three top-level hubs opt into compact navigation and content transitions", () => {
    expect(operations).toContain('collapsedLabel="Operations" defaultExpanded={false}');
    expect(operations).toContain("<RibbonPanel transitionKey={view}>");
    expect(ecosystem).toContain('collapsedLabel="Ecosystem" defaultExpanded={false}');
    expect(ecosystem).toContain("<RibbonPanel transitionKey={view}>");
    expect(market).toContain('collapsedLabel="Analysis mode" defaultExpanded={false}');
    expect(market).toContain("<RibbonPanel transitionKey={mode}>");
  });
});
