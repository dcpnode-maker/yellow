import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
const statements = readFileSync(new URL("../src/contexts/financials/statements.ts", import.meta.url), "utf8");
const seed = readFileSync(new URL("../scripts/seed-review.ts", import.meta.url), "utf8");

function requireText(source: string, expected: string, contract: string): void {
  if (!source.includes(expected)) throw new Error(`Order188 P0 missing ${contract}`);
}

function interfaceSource(name: string, source = statements): string {
  const start = source.indexOf(`export interface ${name} {`);
  if (start < 0) throw new Error(`Order188 P0 missing interface ${name}`);
  const end = source.indexOf("\n}", start);
  if (end < 0) throw new Error(`Order188 P0 unclosed interface ${name}`);
  return source.slice(start, end + 2);
}

function methodSource(name: string): string {
  const start = operator.indexOf(`  async ${name}(`);
  if (start < 0) throw new Error(`Order188 P0 missing HTTP adapter ${name}`);
  const next = operator.indexOf("\n  async ", start + 1);
  return operator.slice(start, next < 0 ? operator.length : next);
}

test("Order188 P0/P6: exact additional-window, preview and commit routes are wired", () => {
  requireText(app,
    '.post("/api/v1/properties/:property/reservations/:reservation/folios",',
    "additional-window route",
  );
  requireText(app, "operator.openAdditionalFolio(", "additional-window adapter wiring");
  requireText(app,
    '.post("/api/v1/properties/:property/folios/:folioId/transfers:preview",',
    "transfer-preview route",
  );
  requireText(app, "operator.previewFolioTransfer(", "transfer-preview adapter wiring");
  requireText(app,
    '.post("/api/v1/properties/:property/folios/:folioId/transfers",',
    "transfer-commit route",
  );
  requireText(app, "operator.transferFolioGroups(", "transfer-commit adapter wiring");
});

test("Order188 P0/P6: open authority is reused while transfer preview and commit use one exact property grant", () => {
  requireText(operator, 'const FOLIO_OPEN_SCOPE = "financials.folios:open"', "retained folio-open scope");
  requireText(operator, 'const FOLIO_TRANSFER_SCOPE = "financials.transfers:write"', "exact transfer scope");
  requireText(seed,
    '{ code: "financials.transfers:write", description: "Preview and commit governed folio transfers" }',
    "review-seed transfer permission",
  );

  const open = methodSource("openAdditionalFolio");
  expect(open).toContain("hasScope(context, FOLIO_OPEN_SCOPE)");
  expect(open).toContain("listGrantedProperties(context, FOLIO_OPEN_SCOPE)");
  expect(open).toContain("this.#folios.openAdditional(context.tx");
  expect(open).toContain('operation: "folio.opened"');

  for (const name of ["previewFolioTransfer", "transferFolioGroups"]) {
    const source = methodSource(name);
    expect(source).toContain("hasScope(context, FOLIO_TRANSFER_SCOPE)");
    expect(source).toContain("listGrantedProperties(context, FOLIO_TRANSFER_SCOPE)");
  }
});

test("Order188 P0/P6: canonical routing input carries identities and revision but no financial authority", () => {
  requireText(operator, "function parseFolioTransfer(", "canonical transfer parser");
  expect(operator).toContain(
    '["sourceFolioId", "destinationFolioId", "newWindowName", "groupIds", "reason", "generation", "previewRevision"]',
  );
  const parserStart = operator.indexOf("function parseFolioTransfer(");
  const parserEnd = operator.indexOf("\n}", parserStart);
  const parser = operator.slice(parserStart, parserEnd + 2);
  for (const forbidden of [
    "amountMinor", "accountId", "businessDate", "currency", "journalKind", "source", "authority",
  ]) expect(parser).not.toContain(forbidden);

  const preview = methodSource("previewFolioTransfer");
  const commit = methodSource("transferFolioGroups");
  expect(preview).toContain("this.#folioTransfers.preview(context.tx");
  expect(commit).toContain("this.#folioTransfers.transfer(context.tx");
  expect(commit).toContain('operation: "journal.posted"');
  expect(commit).toContain('"idempotency-replayed": String(result.replayed)');
});

test("Order188 P0/P6: workspace DTO exposes only safe sibling windows and server-owned groups", () => {
  const result = interfaceSource("FolioStatementResult");
  expect(result).toContain("readonly reservationId: string | null;");
  expect(result).toContain("readonly siblingWindows: readonly FolioSiblingWindow[];");
  expect(result).toContain("readonly stayTotalMinor: string;");

  const sibling = interfaceSource("FolioSiblingWindow");
  for (const field of [
    "readonly id: string;",
    "readonly windowNo: number;",
    "readonly reference: string | null;",
    "readonly name: string | null;",
    "readonly status: string;",
    "readonly balanceMinor: string;",
  ]) expect(sibling).toContain(field);

  const group = interfaceSource("FolioTransferGroup");
  for (const field of [
    "readonly id: string;",
    "readonly memberCount: number;",
    "readonly eligible: boolean;",
    "readonly reason: string | null;",
    "readonly currentWindowId: string;",
  ]) expect(group).toContain(field);
  expect(interfaceSource("FolioStatementRow")).toContain(
    "readonly transferGroup: FolioTransferGroup;",
  );

  const publicDto = `${result}\n${sibling}\n${group}\n${interfaceSource("FolioStatementRow")}`;
  expect(publicDto).not.toMatch(/account|party|guest|email|phone|address/i);
});
