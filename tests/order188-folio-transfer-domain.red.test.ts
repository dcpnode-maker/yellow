import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const transferPath = join(import.meta.dir, "..", "src", "contexts", "financials", "transfers.ts");
const statementPath = join(import.meta.dir, "..", "src", "contexts", "financials", "statements.ts");
const indexPath = join(import.meta.dir, "..", "src", "contexts", "financials", "index.ts");

describe("Order 188 P0 immutable whole-group routing domain", () => {
  test("FolioTransferService owns preview, commit and durable replay", () => {
    if (!existsSync(transferPath)) {
      expect(existsSync(transferPath)).toBeTrue();
      return;
    }

    const source = readFileSync(transferPath, "utf8");
    const compact = source.replace(/\s+/g, " ");

    expect(source).toContain("export interface FolioTransferInput");
    expect(source).toContain("readonly sourceFolioId: string");
    expect(source).toContain("readonly destinationFolioId?: string");
    expect(source).toContain("readonly newWindowName?: string");
    expect(source).toContain("readonly groupIds: readonly string[]");
    expect(source).toContain("readonly reason: string");
    expect(source).toContain("readonly generation: string");
    expect(source).toContain("readonly previewRevision: string");
    expect(source).toContain("export class FolioTransferService");
    expect(source).toMatch(/async preview\s*\(tx:\s*Tx,\s*input:/);
    expect(source).toMatch(/async transfer\s*\(tx:\s*Tx,\s*input:/);
    expect(source).toContain('operation: "financials.folio.transfer"');
    expect(compact).toMatch(/SELECT\s+(?:\*\s+FROM\s+)?public\.create_folio_transfer\s*\(/i);
    expect(source).toMatch(/eventType:\s*"journal\.posted"/);
    expect(source).toContain('input.envelope.operation !== "journal.posted"');
    expect(source).toMatch(/recordFact\s*\(/);

    const inputBlock = source.match(/export interface FolioTransferInput\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    for (const forbidden of ["amount", "account", "businessDate", "currency", "journalKind", "source", "authority"]) {
      expect(inputBlock).not.toMatch(new RegExp(`readonly\\s+${forbidden}\\??\\s*:`));
    }
    expect(source).toMatch(/groupIds\.length\s*<\s*1|groupIds\.length\s*===\s*0/);
    expect(source).toMatch(/groupIds\.length\s*>\s*50/);
    expect(source).toMatch(/reason\.length\s*>\s*500/);
  });

  test("statement projection exposes server-owned siblings, totals and indivisible groups", () => {
    const source = readFileSync(statementPath, "utf8");

    expect(source).toContain("export interface FolioSiblingWindow");
    expect(source).toContain("export interface FolioTransferGroup");
    expect(source).toContain("readonly siblingWindows: readonly FolioSiblingWindow[]");
    expect(source).toContain("readonly stayTotalMinor: string");
    expect(source).toContain("readonly transferGroup: FolioTransferGroup");
    expect(source).toContain("readonly memberCount: number");
    expect(source).toContain("readonly eligible: boolean");
    expect(source).toContain("readonly reason: string | null");
    expect(source).toContain("readonly currentWindowId: string");
    expect(source).toContain("folio_transfer_root_line_id");
    expect(source).toMatch(/header\.reverses|reverses_journal_id/);
    expect(source).toMatch(/jsonb_build_object\([\s\S]*'transferGroup'/);

    const financialsIndex = readFileSync(indexPath, "utf8");
    expect(financialsIndex).toContain("FolioTransferService");
    expect(financialsIndex).toContain("FolioTransferInput");
    expect(financialsIndex).toContain("FolioTransferPreviewResult");
    expect(financialsIndex).toContain("FolioTransferResult");
  });
});
