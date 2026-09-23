import { expect, test } from "bun:test";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

test("Order458: eight interfaces have a safe Ledger default and one semantic shell", async () => {
  const html = await Bun.file(htmlFile).text();
  const script = await Bun.file(scriptFile).text();

  expect(html).toContain('data-workspace-skin="ledger"');
  expect(html).toContain('<label class="workspace-skin-control"><span>Workspace layout</span>');
  expect(html).toContain('id="workspace-skin-select" aria-label="Workspace layout"');
  expect(html).toContain('<option value="ledger">Ledger · Precision desk</option>');
  expect(html).toContain('<option value="aura">Aura · Spatial glass</option>');
  expect(html).toContain('<option value="relay">Relay · Operations board</option>');
  expect(html).toContain('<option value="journey">Journey · Guided workspace</option>');
  expect(html).toContain('<option value="orbit">Orbit · Command centre</option>');
  expect(html).toContain('<option value="atlas">Atlas · Portfolio studio</option>');
  expect(html).toContain('<option value="focus">Focus · Task companion</option>');
  expect(html).toContain('<option value="index">Index · Planning desk</option>');
  expect(html).toContain('class="workspace-group" data-workspace-group="front-desk" open');
  expect(html).not.toContain('id="secondary-workspaces"');
  expect(script).toContain('const WORKSPACE_SKINS = new Set(["ledger", "aura", "relay", "journey", "orbit", "atlas", "focus", "index"])');
  expect(script).toContain('const next = WORKSPACE_SKINS.has(skin) ? skin : "ledger"');
  expect(script).toContain('document.documentElement.dataset.workspaceSkin = next');
  expect(script).toContain('applyWorkspaceSkin(workspaceSkinSelect.value)');
  expect(`${html}\n${script}`).not.toMatch(/data-experience|experience-select|theme-select|applyExperience|applyTheme|const (?:EXPERIENCES|THEMES)\b/);
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
});

test("Order195 / Order458: historical material CSS remains internal, not a public appearance picker", async () => {
  const html = await Bun.file(htmlFile).text();
  const css = await Bun.file(cssFile).text();
  const script = await Bun.file(scriptFile).text();
  const themes = [
    "apple", "android", "win95", "glass", "neo", "erp",
  ];

  for (const theme of themes) expect(css).toContain(`:root[data-theme="${theme}"]`);
  const layoutSelect = html.match(/<select id="workspace-skin-select"[\s\S]*?<\/select>/)?.[0] ?? "";
  const options = [...layoutSelect.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
    .map((match) => [match[1], match[2]]);
  expect(options).toEqual([
    ["ledger", "Ledger · Precision desk"], ["aura", "Aura · Spatial glass"],
    ["relay", "Relay · Operations board"], ["journey", "Journey · Guided workspace"],
    ["orbit", "Orbit · Command centre"], ["atlas", "Atlas · Portfolio studio"],
    ["focus", "Focus · Task companion"], ["index", "Index · Planning desk"],
  ]);
  expect(html).not.toMatch(/id="(?:theme|experience)-select"|>Appearance<|>Workspace detail</);
  expect(script).not.toMatch(/document\.documentElement\.dataset\.(?:theme|experience)\s*=|\b(?:THEMES|EXPERIENCES)\b/);
  expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(css).toContain('url("/static/fonts/urbanist-v1.330.woff2")');
  expect(`${html}\n${css}\n${script}`
    .replaceAll('xmlns="http://www.w3.org/2000/svg"', "")
    .replaceAll('url("/static/fonts/urbanist-v1.330.woff2")', ""))
    .not.toMatch(/https?:\/\/|@import|url\s*\(/i);
});

test("Order444: every workspace layout retains target and responsive safety rules", async () => {
  const css = await Bun.file(cssFile).text();

  expect(css).toContain('html:root[data-workspace-skin="calm"]');
  expect(css).toContain('html:root[data-workspace-skin="precision"]');
  expect(css).toContain('html:root[data-workspace-skin="timeline"]');
  expect(css).not.toContain("data-experience");
  expect(css).toContain("min-height: 44px");
  expect(css).toContain("@media (max-width: 1020px)");
  expect(css).toContain("@media (max-width: 767px)");
  expect(css).toContain(".app-bar { flex-wrap: wrap; gap: .45rem; padding: .5rem .75rem; }");
  expect(css).toContain(".app-actions { width: 100%; min-width: 0; gap: .45rem; }");
    expect(css).toMatch(
      /html:root\[data-workspace-skin\] \.workspace-skin-control \{[^}]*min-width:\s*0;/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*600px\)[\s\S]*html:root\[data-workspace-skin\] \.workspace-skin-control \{[^}]*flex:\s*1 1 100%;/,
    );
    expect(css).toMatch(
      /html:root\[data-workspace-skin\] #workspace-skin-select \{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*min-height:\s*44px;/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*600px\)[\s\S]*#workspace-skin-select \{[^}]*width:\s*min\(100%,\s*14rem\);/,
    );
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).not.toContain("overflow-x: hidden");
});

test("Order459: hotel workflow groups replace the catch-all additional workspace menu", async () => {
  const html = await Bun.file(htmlFile).text();
  const css = await Bun.file(cssFile).text();

  expect([...html.matchAll(/data-workspace-group="([^"]+)"/g)].map(match => match[1]))
    .toEqual(["front-desk", "finance", "operations", "revenue", "system"]);
  expect(html.match(/class="workspace-group-items"/g)).toHaveLength(5);
  expect(html).not.toMatch(/id="secondary-workspaces|More workspaces|Fewer workspaces/);
  for (const label of [
    "Operations", "Housekeeping", "Vehicle register", "Inventory setup",
    "Restrictions", "Rates", "Project status",
  ]) {
    expect(html).toContain(label);
  }
  expect(html.match(/class="domain-tab(?: is-active)?"/g)).toHaveLength(14);
  expect(html).toContain('id="nav-invoices" type="button" data-view="invoices" aria-controls="invoices-view"');
  expect(html).toMatch(/id="nav-invoices"[^>]*>[\s\S]*?<svg class="domain-icon"[^>]*>[\s\S]*?<use href="#ph-invoice"\/>/);
  expect(css).toContain(".workspace-catalogue-preview");
  expect(css).not.toContain("data-experience");
});
