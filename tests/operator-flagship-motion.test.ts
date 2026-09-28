import { expect, test } from "bun:test";

const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);
const pageFile = new URL("../src/http/operator/index.html", import.meta.url);
const styleFile = new URL("../src/http/operator/operator.css", import.meta.url);

test("Order187: flagship transitions are bounded, interruptible and accessibility-safe", async () => {
  const script = await Bun.file(scriptFile).text();

  expect(script).toContain('motionPreference("(prefers-reduced-motion: reduce)")');
  expect(script).toContain('motionPreference("(pointer: coarse)")');
  expect(script).toContain('motionPreference("(forced-colors: active)")');
  expect(script).toContain('typeof window.matchMedia === "function"');
  expect(script).toContain('document.visibilityState === "visible"');
  expect(script).toContain('CSS.supports("backdrop-filter", "blur(2px)")');
  expect(script).toContain('typeof document.startViewTransition !== "function"');
  expect(script).toContain('typeof workbenchView.animate !== "function"');
  expect(script).toContain("Math.min(400, Math.max(0, duration))");
  expect(script).toContain("animation.effect.updateTiming({ duration: boundedDuration })");
  expect(script).toContain("transition.skipTransition?.()");
  expect(script).toContain("animation.cancel()");
  expect(script).toContain('document.documentElement.style.viewTransitionName = "none"');
  expect(script).toContain('workbenchView.style.viewTransitionName = "yellow-workspace"');
  expect(script).toContain('document.addEventListener("visibilitychange"');
  expect(script).toContain('typeof preference.addEventListener === "function"');
  expect(script).toContain("preference.addListener?.(() => cancelWorkspaceMotion(true))");

  const fallbackFrames = script.match(/workbenchView\.animate\(\[([\s\S]*?)\], \{ duration/)?.[1] ?? "";
  expect(fallbackFrames).toContain("opacity");
  expect(fallbackFrames).toContain("transform");
  expect(fallbackFrames).not.toMatch(/\b(?:filter|width|height|top|left|blur)\b/);
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
});

test("Order195: the six flagship systems have structural identity without unsafe motion", async () => {
  const [page, styles] = await Promise.all([
    Bun.file(pageFile).text(),
    Bun.file(styleFile).text(),
  ]);

  for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
    expect(styles).toContain(`:root[data-theme="${theme}"]`);
  }
  expect(page.match(/class="domain-icon"/g)?.length).toBe(11);
  expect(page.match(/<symbol id="i-/g)?.length).toBe(9);
  expect(page).toContain('class="ambient-stage" aria-hidden="true"');
  expect(page.match(/class="depth-plane /g)?.length).toBe(3);
  expect(page).toContain('class="win-window-chrome" aria-hidden="true"');
  expect(styles).toContain(':root[data-theme="win95"] .workbench-head');
  expect(styles).toContain(':root[data-theme="android"] :is(.status-summary-grid,.metric-grid)');
  expect(styles).toContain(':root[data-theme="glass"] .ambient-stage');
  expect(styles).toContain(':root[data-theme="neo"] :is(.domain-bar,.workbench-head)');
  expect(styles).toContain(':root[data-theme="erp"] :is(.status-summary-grid,.metric-grid)');
  expect(styles).toContain('@media (hover: none), (pointer: coarse)');
  expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  expect(styles.match(/:root\[data-theme="glass"\] \.workbench > section:not\(\[hidden\]\) \{ animation: none; \}/g)?.length).toBe(4);
  expect(styles).not.toContain("will-change");
  expect(styles).not.toMatch(/@keyframes[^}]*\bfilter\s*:/s);
  expect(styles).not.toMatch(/transition:[^;]*(?:filter|width|height|top|left)/);
});
