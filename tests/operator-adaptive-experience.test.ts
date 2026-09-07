import { expect, test } from "bun:test";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

test("Order444: three workspace layouts have a safe Calm default and one semantic shell", async () => {
  const html = await Bun.file(htmlFile).text();
  const script = await Bun.file(scriptFile).text();

  expect(html).toContain('data-workspace-skin="calm"');
  expect(html).toContain('<label class="workspace-skin-control"><span>Workspace layout</span>');
  expect(html).toContain('id="workspace-skin-select" aria-label="Workspace layout"');
  expect(html).toContain('<option value="calm">Calm Workbench</option>');
  expect(html).toContain('<option value="precision">Precision Desk</option>');
  expect(html).toContain('<option value="timeline">Service Timeline</option>');
  expect(html).toContain('id="secondary-workspaces-toggle"');
  expect(html).toContain('id="secondary-workspaces" hidden');
  expect(script).toContain('const WORKSPACE_SKINS = new Set(["calm", "precision", "timeline"])');
  expect(script).toContain('const next = WORKSPACE_SKINS.has(skin) ? skin : "calm"');
  expect(script).toContain('document.documentElement.dataset.workspaceSkin = next');
  expect(script).toContain('applyWorkspaceSkin(workspaceSkinSelect.value)');
  expect(`${html}\n${script}`).not.toMatch(/data-experience|experience-select|theme-select|applyExperience|applyTheme|const (?:EXPERIENCES|THEMES)\b/);
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
});

test("Order195 / Order444: historical material CSS remains internal, not a public appearance picker", async () => {
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
    ["calm", "Calm Workbench"], ["precision", "Precision Desk"], ["timeline", "Service Timeline"],
  ]);
  expect(html).not.toMatch(/id="(?:theme|experience)-select"|>Appearance<|>Workspace detail</);
  expect(script).not.toMatch(/document\.documentElement\.dataset\.(?:theme|experience)\s*=|\b(?:THEMES|EXPERIENCES)\b/);
  expect(`${html}\n${css}\n${script}`).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
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

test("Order314 / Order444: contextual disclosure names every additional management workspace", async () => {
  const html = await Bun.file(htmlFile).text();
  const css = await Bun.file(cssFile).text();

  expect(html).toContain('id="secondary-workspaces-toggle" type="button" aria-expanded="false" aria-controls="secondary-workspaces" aria-describedby="secondary-workspaces-preview"');
  expect(html).toContain('id="secondary-workspaces-preview"');
  expect(html).toContain("7 additional workspaces:");
  for (const label of [
    "Operations", "Housekeeping", "Vehicle register", "Inventory setup",
    "Restrictions", "Rates", "Project status",
  ]) {
    expect(html).toContain(label);
  }
  expect(html.match(/class="domain-tab(?: is-active)?"/g)).toHaveLength(14);
  expect(html).toContain('id="nav-invoices" type="button" data-view="invoices" aria-controls="invoices-view"');
  expect(html).toMatch(/id="nav-invoices"[^>]*>[\s\S]*?<svg class="domain-icon"[^>]*>[\s\S]*?<use href="#i-folios"\/>/);
  expect(css).toContain(".workspace-catalogue-preview");
  expect(css).not.toContain("data-experience");
});
