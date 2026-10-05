import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../frontend/yellow/src/${path}`, import.meta.url), "utf8");
const css = source("ui/reference-theme.css");
const app = source("App.tsx");
describe("Order 673 shared theme and retained workflow boundaries", () => {
  test("one shared stylesheet follows the baseline without new runtime dependencies", () => {
    const main = source("main.tsx");
    expect(main.indexOf('./ui/reference-theme.css')).toBeGreaterThan(main.indexOf('./styles.css'));
    expect(css).toContain('--reference-canvas: #f7f7f7');
    expect(css).toContain('--reference-paper: #fff');
    expect(css).toContain('--reference-rail: #e9e9e9');
    expect(css).toContain('.folio-workspace');
    expect(css).toContain('.business-mappings');
    expect(css).toContain('.yellow-next .topbar nav { flex: 1 1 0; min-width: 0; overflow-x: auto;');
  });
  test("AI uses existing real mode state, with static ready/result and one slow active animation", () => {
    expect(css).toContain('.yellow-next.yellow-ai-active {');
    expect(css).toContain('.yellow-next.yellow-ai-active::before { animation: none;');
    expect(css).toContain('.yellow-ai-mode.yellow-ai-result .yellow-neon-field { animation: none;');
    expect(css).toContain('.yellow-next:is(.yellow-ai-listening, .yellow-ai-thinking)::before');
    expect(css).toContain('2400ms');
    expect(app).toContain('const yellowVisualState = listening');
    expect(app).toContain('const shellClassName = `yellow-next${assistant ?');
  });
  test("decorations cannot trap input and accessibility modes suppress them", () => {
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('prefers-reduced-transparency: reduce');
    expect(css).toContain('forced-colors: active');
    expect(css).toContain('outline: 2px solid #665300');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('.segmented-ribbon-panel { overflow-x: auto;');
    expect(source('ui/SegmentedRibbon.tsx')).toContain('ref={scrollerRef}\n        id={panelId}');
    expect(css).toContain('animation: none !important; transition: none !important');
  });
  test("settings ribbon keeps the existing dirty draft confirmation and stable editor key", () => {
    const settings = app.slice(app.indexOf('function PropertySettingsWorkspace'), app.indexOf('function PropertySetupSummary'));
    expect(settings).toContain('next === "overview" && mappingsDirty');
    expect(settings).toContain('setConfirmExit(true)');
    expect(settings).toContain('dialog.showModal()');
    expect(settings).toContain('Keep editing');
    expect(settings).toContain('key={propertyId}');
    expect(settings).toContain('<RibbonPanel id="settings-ribbon-content" transitionKey={section}>');
    expect(settings).not.toContain('key={section}');
  });
});
