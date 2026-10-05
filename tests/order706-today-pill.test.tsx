import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("neutral theme never resets the moving Today pill transform", () => {
  const css = readFileSync("frontend/yellow/src/ui/reference-theme.css", "utf8");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const pillResets = rules.filter(([, selector, declarations]) =>
    selector!.includes(".today-glass-ribbon-pill") && /(?:^|;)\s*transform\s*:\s*none\s*(?:;|$)/.test(declarations!),
  );
  // :is() inherits its most specific arm, so an earlier grouped reset also wins.
  expect(pillResets).toHaveLength(0);
  expect(css).toContain("transform: translateX(calc(var(--today-movement-index) * 100%))");
  expect(css).toMatch(/\.yellow-next :is\(\.segmented-ribbon button\.is-selected, \.checkout-ribbon button\.active\)\s*\{\s*transform: none;/);
});

test("touch press has feedback without replacing the existing navigation callback", () => {
  const source = readFileSync("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx", "utf8");
  const css = readFileSync("frontend/yellow/src/styles.css", "utf8");
  expect(source).toContain('onPointerDown={(event) => { if (event.pointerType === "touch") setMovementHover(index); }}');
  expect(source).toContain("onClick={movement.onOpen}");
  expect(source).toContain("onPointerCancel={() => setMovementHover(null)}");
  expect(source).toContain("movementHover ?? movementFocus ?? 0");
  const button = css.match(/\.today-glass-ribbon button\s*\{([^}]+)\}/)?.[1];
  expect(button).toContain("user-select: none");
  expect(button).toContain("touch-action: manipulation");
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.today-glass-ribbon-pill \{ transition: none; \}/);
});
