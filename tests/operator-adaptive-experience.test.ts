import { expect, test } from "bun:test";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

test("Order 176: progressive detail has a safe Simple default and one semantic shell", async () => {
  const html = await Bun.file(htmlFile).text();
  const script = await Bun.file(scriptFile).text();

  expect(html).toContain('data-experience="simple"');
  expect(html).toContain('id="experience-select" aria-label="Workspace detail"');
  for (const value of ["simple", "advanced", "expert"]) {
    expect(html).toContain(`<option value="${value}">`);
  }
  expect(html).toContain('id="secondary-workspaces-toggle"');
  expect(html).toContain('id="secondary-workspaces" hidden');
  expect(script).toContain('const EXPERIENCES = new Set(["simple", "advanced", "expert"])');
  expect(script).toContain('applyExperience("simple", { preserveActive: false })');
  expect(script).toContain('SECONDARY_VIEWS.has(activeView)');
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
});

test("Order 176: appearances are original token packs and remain orthogonal", async () => {
  const html = await Bun.file(htmlFile).text();
  const css = await Bun.file(cssFile).text();
  const script = await Bun.file(scriptFile).text();
  const themes = [
    "yellow", "apple", "macos", "win95", "winxp", "windows", "pixel", "linux",
    "glass", "neo", "skeuo", "clay", "aurora", "stripe", "airbnb", "duolingo",
  ];

  for (const theme of themes) {
    expect(html).toContain(`<option value="${theme}">`);
    if (theme !== "yellow") expect(css).toContain(`:root[data-theme="${theme}"]`);
  }
  for (const theme of themes) expect(script).toContain(`"${theme}"`);
  expect(script).toContain('document.documentElement.dataset.theme = next');
  expect(script).toContain('document.documentElement.dataset.experience = next');
  expect(`${html}\n${css}\n${script}`).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
});

test("Order 176: every detail level retains target and responsive safety rules", async () => {
  const css = await Bun.file(cssFile).text();

  expect(css).toContain(':root[data-experience="simple"]');
  expect(css).toContain(':root[data-experience="expert"]');
  expect(css).toContain("min-height: 44px");
  expect(css).toContain("@media (max-width: 1020px)");
  expect(css).toContain("@media (max-width: 767px)");
  expect(css).toContain(".app-bar { flex-wrap: wrap; gap: .45rem; padding: .5rem .75rem; }");
  expect(css).toContain(".app-actions { width: 100%; min-width: 0; gap: .45rem; }");
  expect(css).toContain(".theme-control, .experience-control { flex: 1 1 0; min-width: 0; }");
  expect(css).toContain(".theme-control select, .experience-control select { width: 100%; min-width: 0; max-width: none; }");
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).not.toContain("overflow-x: hidden");
});
