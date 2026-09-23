import { describe, expect, test } from "bun:test";

const migrationUrl = new URL("../migrations/0073_document_series_runtime_authority_containment.sql", import.meta.url);
const foliosUrl = new URL("../src/contexts/financials/folios.ts", import.meta.url);

describe("Order 410 intentional-red authority containment", () => {
  test("P0: raw counter mutation is revoked and one bounded allocator is exposed", async () => {
    const migration = await Bun.file(migrationUrl).text();
    expect(migration).toMatch(/REVOKE\s+UPDATE\s*\(\s*next_no\s*\)\s+ON\s+(?:TABLE\s+)?public\.document_series\s+FROM\s+app_role/i);
    expect(migration).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.allocate_non_fiscal_folio_reference\s*\(\s*(?:\w+\s+)?uuid\s*,\s*(?:\w+\s+)?uuid\s*\)/i);
    expect(migration).toMatch(/SECURITY\s+DEFINER/i);
    expect(migration).toMatch(/SET\s+search_path\s*=\s*pg_catalog\s*,\s*public/i);
    expect(migration).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.allocate_non_fiscal_folio_reference\s*\(\s*uuid\s*,\s*uuid\s*\)\s+FROM\s+PUBLIC/i);
    expect(migration).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.allocate_non_fiscal_folio_reference\s*\(\s*uuid\s*,\s*uuid\s*\)\s+TO\s+app_role/i);
    expect(migration).not.toMatch(/GRANT\s+EXECUTE[\s\S]*TO\s+(?:yellow_deploy|yellow_runtime|runtime_role|deploy_role)/i);
  });

  test("P0: both production folio paths use the fixed allocator and never update the counter", async () => {
    const source = await Bun.file(foliosUrl).text();
    expect(source.match(/allocate_non_fiscal_folio_reference/g)).toHaveLength(1);
    expect(source.match(/allocateNonFiscalFolioReference/g)).toHaveLength(3);
    expect(source).not.toMatch(/UPDATE\s+document_series/i);
    expect(source).not.toMatch(/FOR\s+UPDATE[\s\S]{0,300}document_series/i);
  });
});
