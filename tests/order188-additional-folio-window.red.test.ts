import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const folios = readFileSync(join(import.meta.dir, "..", "src", "contexts", "financials", "folios.ts"), "utf8");
const financialsIndex = readFileSync(join(import.meta.dir, "..", "src", "contexts", "financials", "index.ts"), "utf8");

describe("Order 188 P0 additional folio-window command", () => {
  test("FolioService exposes the exact server-derived sibling-window contract", () => {
    expect(folios).toContain("export interface OpenAdditionalFolioInput");
    expect(folios).toContain("readonly sourceFolioId: string");
    expect(folios).toContain("readonly name: string");
    expect(folios).toMatch(/async openAdditional\s*\(tx:\s*Tx,\s*input:\s*OpenAdditionalFolioInput\)/);
    expect(folios).toContain('operation: "financials.folio.open"');
    expect(folios).toMatch(/name\.trim\(\)/);
    expect(folios).toMatch(/(?:80|MAX_WINDOW_NAME)/);
    expect(folios).toMatch(/(?:20|MAX_FOLIO_WINDOWS)/);
    expect(folios).toMatch(/pg_advisory_xact_lock/);
    expect(folios).toMatch(/max\s*\(\s*window_no\s*\)/i);
    expect(folios).toMatch(/INSERT INTO folio[\s\S]*window_no[\s\S]*name/i);
    expect(folios).toContain('input.envelope.operation !== "folio.opened"');
    expect(folios).toMatch(/recordFact\s*\(/);
    expect(folios).toMatch(/eventType:\s*"folio\.opened"/);

    expect(financialsIndex).toContain("OpenAdditionalFolioInput");
    expect(financialsIndex).toContain("OpenAdditionalFolioResult");
  });
});
