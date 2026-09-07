import { expect, test } from "bun:test";

const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);
const pageFile = new URL("../src/http/operator/index.html", import.meta.url);
const styleFile = new URL("../src/http/operator/operator.css", import.meta.url);

test("Order444: layout switching is direct and state-preserving with accessible CSS fallbacks", async () => {
  const [script, page, styles] = await Promise.all([
    Bun.file(scriptFile).text(),
    Bun.file(pageFile).text(),
    Bun.file(styleFile).text(),
  ]);
  const setter = script.match(/function applyWorkspaceSkin\(skin\) \{([\s\S]*?)\n \}/)?.[1] ?? "";

  expect(script).toContain('const WORKSPACE_SKINS = new Set(["calm", "precision", "timeline"]);');
  expect(setter).toContain('const next = WORKSPACE_SKINS.has(skin) ? skin : "calm";');
  expect(setter).toContain("document.documentElement.dataset.workspaceSkin = next;");
  expect(setter).toContain("workspaceSkinSelect.value = next;");
  expect(setter).not.toMatch(/fetch|request|setView|history|location|replaceChildren|reset|storage|animate/i);
  expect(script).toContain('workspaceSkinSelect.addEventListener("change", () => {\n applyWorkspaceSkin(workspaceSkinSelect.value);\n });');
  expect(script).not.toMatch(/motionPreference|startViewTransition|cancelWorkspaceMotion|viewTransitionName/);
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  expect(page).toContain('<html lang="en" data-theme="apple" data-workspace-skin="calm">');
  expect(page).toContain('<select id="workspace-skin-select" aria-label="Workspace layout">');

  expect(styles).toContain("@media (prefers-reduced-motion:reduce)");
  expect(styles).toContain("html:root[data-workspace-skin] *,html:root[data-workspace-skin] *::before,html:root[data-workspace-skin] *::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; }");
  expect(styles).toContain("@media (forced-colors:active)");
  expect(styles).toContain("html:root[data-workspace-skin] .domain-tab.is-active { color:HighlightText; background:Highlight; border-color:Highlight; }");
  expect(styles).toContain("html:root[data-workspace-skin] :is(button,input,select,textarea,#workspace-skin-select) { forced-color-adjust:auto; color:ButtonText; background:ButtonFace; border:1px solid ButtonText; box-shadow:none; }");
});

test("Order195: the six flagship systems have structural identity without unsafe motion", async () => {
  const [page, styles] = await Promise.all([
    Bun.file(pageFile).text(),
    Bun.file(styleFile).text(),
  ]);

  for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
    expect(styles).toContain(`:root[data-theme="${theme}"]`);
  }
  expect(page.match(/class="domain-icon"/g)?.length).toBe(12);
  const invoiceTab = page.match(/<button[^>]*id="nav-invoices"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  expect(invoiceTab).toContain('data-view="invoices"');
  expect(invoiceTab).toContain('class="domain-icon"');
  expect(invoiceTab).toContain('<use href="#i-folios"/>');
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
