import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function requireText(source: string, expected: string, contract: string): void {
  if (!source.includes(expected)) throw new Error(`Order188 P0 missing ${contract}`);
}

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Order188 P0 missing browser function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Order188 P0 unclosed browser function ${name}`);
}

test("Order188 P0/P6: one workbench has roving folio-window tabs and contextual correction", () => {
  requireText(html, 'id="folio-window-tabs" role="tablist" aria-label="Folio windows"', "roving window tablist");
  expect(html).toContain('id="folio-window-new-form"');
  expect(html).toContain('id="folio-organize-form"');
  expect(html).toContain("Statement");
  expect(html).toContain("Add charge");
  expect(html).toContain("Organize charges");
  expect(html).not.toContain('id="folio-tab-correction"');
  expect(`${html}\n${script}`).toContain("Correct a wrong charge");

  const tabs = functionSource("renderFolioWindowTabs");
  expect(tabs).toContain('setAttribute("role", "tab")');
  expect(tabs).toContain("tab.tabIndex = selected ? 0 : -1");
  expect(tabs).toContain('setAttribute("aria-selected", String(selected))');
  expect(tabs).toContain("window.id");
  expect(tabs).toContain("window.balanceMinor");

  const keys = functionSource("handleFolioWindowTabKeydown");
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "]) {
    expect(keys).toContain(`"${key}"`);
  }
  expect(keys).toContain("canonicalFolioPath(propertySelect.value, target.dataset.folioId");
});

test("Order188 P6/P7: additional windows use an exact reservation identity and never request undefined", () => {
  const open = functionSource("openAdditionalFolioWindow");
  expect(open).toContain("const reservationId = folioStatementData.reservationId");
  expect(open).toContain("if (!canonicalUuid(reservationId))");
  expect(open).toContain("No reservation.");
  expect(open).toContain("/reservations/${enc(reservationId)}/folios");
  expect(open).not.toContain("enc(folioStatementData.reservationId)");
  expect(script).toContain("folioWindowNew.disabled = !canonicalUuid(statement.reservationId)");
});

test("Order188 P7: failed property-scoped reads clear every prior folio summary before showing an error", () => {
  const reset = functionSource("resetFolioPresentation");
  for (const target of ["folioWindow", "folioStatus", "folioCurrency", "folioBalance", "folioStayTotal",
    "folioActiveTotal", "folioAccountCurrency"]) expect(reset).toContain(target);
  for (const target of ["folioStatementTitle", "folioWorkspaceTitle", "folioWindowCount", "folioLineCount"])
    expect(reset).toContain(`${target}.textContent =`);
  expect(reset).toContain('target.textContent = "—"');
  expect(reset).toContain("folioStatementData = null");
  expect(reset).toContain("folioWindowTabs.replaceChildren()");
  expect(script.indexOf("resetFolioPresentation();", script.indexOf("async function lookupFolioStatement")))
    .toBeLessThan(script.indexOf("await request(", script.indexOf("async function lookupFolioStatement")));
});

test("Order188 P7: create and contextual correction have explicit non-repeating Enter and Space activation", () => {
  expect(script).toContain('document.addEventListener("keydown", (event) => {');
  expect(script).toContain('"#folio-window-new,.folio-correct-action"');
  expect(script).toContain('/^(Enter| )$/.test(event.key)');
  expect(script).toContain("event.repeat");
  expect(script).toContain("event.preventDefault()");
  expect(script).toContain("action.click()");
});

test("Order188 P0/P6: organize is the canonical whole-group preview then acknowledged commit", () => {
  for (const id of [
    "folio-organize-groups",
    "folio-organize-destination",
    "folio-organize-new-window-name",
    "folio-organize-reason",
    "folio-organize-preview",
    "folio-organize-acknowledgement",
    "folio-organize-submit",
  ]) requireText(html, `id="${id}"`, `organize control ${id}`);
  expect(html).toContain('id="folio-organize-reason" name="reason" required minlength="1" maxlength="500"');
  expect(html).toContain("Financial history is never edited. Yellow adds a balanced transfer.");
  expect(html).toContain("No invoice is generated here; this organizes folio windows for later document issue.");

  const body = functionSource("folioTransferBody");
  for (const field of [
    "sourceFolioId", "destinationFolioId", "newWindowName", "groupIds", "reason", "generation", "previewRevision",
  ]) expect(body).toContain(field);
  expect(body).not.toMatch(/amountMinor|accountId|businessDate|currency|journalKind|authority/);

  const submit = functionSource("submitFolioTransfer");
  const previewAt = submit.indexOf("/transfers:preview");
  const acknowledgementAt = submit.indexOf("folioOrganizeAcknowledgement.checked");
  const commitAt = submit.indexOf("/transfers", previewAt + 1);
  expect(previewAt).toBeGreaterThanOrEqual(0);
  expect(acknowledgementAt).toBeGreaterThan(previewAt);
  expect(commitAt).toBeGreaterThan(acknowledgementAt);
  expect(submit).toContain('headers: { "idempotency-key": attemptKey }');
});

test("Order188 P0/P6: routing displays exact server money strings and never computes money", () => {
  const render = functionSource("renderFolioTransferPreview");
  for (const field of [
    "sourceBeforeMinor", "sourceAfterMinor", "destinationBeforeMinor", "destinationAfterMinor", "stayTotalMinor",
  ]) expect(render).toContain(field);
  expect(render).toContain("exactFolioMinor");

  const routingSurface = `${functionSource("folioTransferBody")}\n${render}\n${functionSource("renderFolioWindowTabs")}`;
  expect(routingSurface).not.toMatch(
    /\bNumber\s*\(|\bBigInt\s*\(|parseInt\s*\(|parseFloat\s*\(|Math\.|\.toFixed\s*\(|(?:\+|-|\*|\/)\s*(?:row|group|preview|window)\.(?:amount|balance)/,
  );
});

test("Order188 P0/P6: one global live region survives hidden panels and every dirty exit is guarded", () => {
  const liveRegions = html.match(/id="operation-status"/g)?.length ?? 0;
  if (liveRegions !== 1) throw new Error(`Order188 P0 expected one global operation-status live region, found ${liveRegions}`);
  expect(html).toContain('id="operation-status" role="status" aria-live="polite" aria-atomic="true"');
  expect(html.indexOf('id="operation-status"')).toBeLessThan(html.indexOf('<main id="main">'));

  const dirty = functionSource("currentFolioDraftIsDirty");
  for (const draft of ["currentFolioChargeIsDirty", "currentFolioCorrectionIsDirty", "currentFolioWindowIsDirty", "currentFolioOrganizeIsDirty"]) {
    expect(dirty).toContain(`${draft}()`);
  }
  expect(script).toContain('window.addEventListener("beforeunload", (event) => {');
  expect(script).toContain("if (!currentFolioDraftIsDirty()) return;");
  expect(script).toContain("event.preventDefault();");
  expect(script).toContain('event.returnValue = "";');
  for (const exit of ["propertySelect", "folioWorkspaceBack", "signOut", "popstate"]) {
    expect(script).toContain(exit);
  }
});
