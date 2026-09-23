import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("binds Yellow's procedural glow to assistant runtime state", () => {
  for (const state of [
    "yellow-ai-ready",
    "yellow-ai-listening",
    "yellow-ai-thinking",
    "yellow-ai-result",
  ]) {
    expect(app).toContain(state);
    expect(css).toContain(`.${state}`);
  }
  expect(app).toContain("yellowVisualState");
  expect(app).toContain("listening ?");
  expect(app).toMatch(/: thinking\s*\?/);
});

test("uses image-free neon bloom with accessible motion fallback", () => {
  const fieldStart = css.indexOf(".yellow-neon-field {");
  const fieldEnd = css.indexOf(".yellow-command-surface {", fieldStart);
  const fieldCss = css.slice(fieldStart, fieldEnd);
  expect(fieldStart).toBeGreaterThan(-1);
  expect(fieldCss).toContain("box-shadow");
  expect(fieldCss).toContain("filter: blur");
  expect(fieldCss).not.toContain("url(");
  expect(fieldCss).not.toContain("radial-gradient");
  expect(fieldCss).not.toContain("linear-gradient");
  expect(fieldCss).not.toContain("image-set(");
  expect(fieldCss).toContain("inset 0 0 5px 1px rgba(255, 241, 0, .9)");
  expect(fieldCss).toContain("pointer-events: none");
  expect(css).toContain(".yellow-next.yellow-ai-active .yellow-launch");
  expect(css).toContain("visibility: hidden");
  expect(css).toContain(".yellow-command-surface header { top: 6px");
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  const resultStateStart = css.indexOf(".yellow-ai-mode.yellow-ai-result .yellow-neon-field");
  const reducedMotionStart = css.indexOf(
    "@media (prefers-reduced-motion: reduce)",
    resultStateStart,
  );
  const reducedMotionEnd = css.indexOf("@media (forced-colors: active)", reducedMotionStart);
  expect(resultStateStart).toBeGreaterThan(-1);
  expect(reducedMotionStart).toBeGreaterThan(resultStateStart);
  const reducedMotionCss = css.slice(reducedMotionStart, reducedMotionEnd);
  expect(reducedMotionCss).toContain(".yellow-ai-mode.yellow-ai-result .yellow-neon-field");
  expect(reducedMotionCss).toContain("animation: none");
  expect(reducedMotionCss).toContain("transform: none");
  expect(css).toContain("@media (forced-colors: active)");
  expect(css).toContain(".yellow-neon-field { display: none; }");
}
);
