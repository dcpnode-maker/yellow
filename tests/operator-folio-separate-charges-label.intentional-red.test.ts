import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function elementById(id: string): string {
  const match = html.match(new RegExp(`<[^>]+id="${id}"[^>]*>[^<]*</[^>]+>`));
  if (!match) throw new Error(`Missing bounded element ${id}`);
  return match[0];
}

test("Order 326 intentional red: only the visible Folio tab label becomes Separate charges", () => {
  const tab = elementById("folio-tab-organize");

  expect(html.match(/id="folio-tab-organize"/g)).toHaveLength(1);
  expect(tab).toContain('type="button" role="tab"');
  expect(tab).toContain('aria-controls="folio-organize-panel"');
  expect(html).toContain(
    '<section id="folio-organize-panel" role="tabpanel" aria-labelledby="folio-tab-organize" hidden>',
  );

  expect(script).toContain(
    'const tabs = [...$("#folio-workspace-tabs").children].map(t=>[t.id.slice(10),t]);',
  );
  expect(script).toContain('t === "organize"');
  expect(script).toContain('new URLSearchParams({ tab: tabs.find(([name]) => name === tab) ? tab : "postings" })');
  expect(script).toContain('canonicalFolioPath(propertySelect.value, folioStatementData.folio.id, next, folioRouteCursor)');
  expect(script).toContain('for (const [tab, element] of tabs)');
  expect(script).toContain('element.addEventListener("click", () => setFolioTab(tab))');

  expect(html).not.toContain('id="folio-tab-correction"');
  expect(script.match(/action\.textContent = "Correct a wrong charge";/g)).toHaveLength(2);
  expect(script.match(/action\.dataset\.journalId = row\.journalId;/g)).toHaveLength(2);

  expect(tab.replace(/<[^>]+>/g, "").trim()).toBe("Separate charges");
});
