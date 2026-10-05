import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);
const migration = new URL("../migrations/0038_canonical_tax_attribution_persistence.sql", import.meta.url);

describe("Order 244 intentional red: canonical tax-attribution persistence", () => {
  test("the append-only tenant root and governed capability exist", async () => {
    const sql = await Bun.file(migration).text();
    expect(sql).toContain("CREATE TABLE public.tax_attribution_snapshot");
    expect(sql).toContain("CREATE FUNCTION public.record_tax_attribution_snapshot");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE public.tax_attribution_snapshot FROM PUBLIC, app_role");
  });

  test("the tax-fiscal context exports the governed persistence service", async () => {
    const service = await Bun.file(new URL("persistence.ts", sourceRoot)).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(service).toContain("export class TaxAttributionPersistenceService");
    expect(service).toContain("parsePositiveTaxAttributionSnapshot");
    expect(index).toContain('from "./persistence"');
  });
});
