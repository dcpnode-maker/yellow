import { expect, test } from "bun:test";

import { BROWSER_SQL_SYNTAX } from "./helpers/browser-asset-security";

const LEGACY_SQL_WORD_GUARD = /\b(?:SELECT|INSERT|UPDATE|DELETE)\s/i;
const ORDINARY_UI_COPY = "Save or select a draft before previewing.";

test("Order 074 P0/P1: SQL syntax is rejected without treating ordinary UI copy as SQL", async () => {
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(script).toContain(ORDINARY_UI_COPY);
  expect(ORDINARY_UI_COPY).toMatch(LEGACY_SQL_WORD_GUARD);
  expect(ORDINARY_UI_COPY).not.toMatch(BROWSER_SQL_SYNTAX);
  for (const sql of [
    "SELECT tenant_id, code FROM rate_plan",
    "INSERT INTO rate_plan (id) VALUES ('x')",
    "UPDATE rate_plan SET code = 'x'",
    "UPDATE rate_plan WHERE id = 'x'",
    "DELETE FROM rate_plan WHERE id = 'x'",
    "DELETE rate_plan WHERE id = 'x'",
  ]) {
    expect(sql).toMatch(BROWSER_SQL_SYNTAX);
  }
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});

test("Order 076 P3: immutable rate history is inspectable and only copied as an unsaved Expert start", async () => {
  const html = await Bun.file(new URL("../src/http/operator/index.html", import.meta.url)).text();
  const css = await Bun.file(new URL("../src/http/operator/operator.css", import.meta.url)).text();
  const script = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
  expect(html).toContain("Inspect exact server-owned configuration");
  expect(html).toContain("Old versions never change");
  expect(css).toContain(".release-inspection");
  expect(css).toContain(".release-command");
  expect(script).toContain('inspectionTitle.textContent = "Inspect exact version"');
  expect(script).toContain('reuse.textContent = "Use as starting point"');
  expect(script).toContain('use.textContent = release.id === builderReleaseId ? "Selected" : "Use draft"');
  expect(script).toContain('undo.textContent = "Create undo draft"');
  expect(script).toContain('setBuilderMode("expert", false)');
  expect(script).toContain("builderExpertJson.value = JSON.stringify(command, null, 2)");
  expect(script).toContain("commandView.textContent = JSON.stringify(command, null, 2)");
  expect(script).toContain("No release was changed or saved");
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
  expect(script).not.toMatch(BROWSER_SQL_SYNTAX);
});
