import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = new URL("../", import.meta.url);

describe("Order562 governed non-fiscal folio-series configuration contract", () => {
  test("adds only the fixed non-fiscal folio capability and minimized evidence", () => {
    const migration = readFileSync(new URL("migrations/0097_governed_nonfiscal_folio_series_configuration.sql", source), "utf8");
    expect(migration).toContain("financials.folio-series:configure");
    expect(migration).toContain("configure_non_fiscal_folio_series");
    expect(migration).toContain("assert_non_fiscal_folio_series_configuration_authority");
    expect(migration).toContain("'folio.series.configured'");
    expect(migration).toContain("'folio'");
    expect(migration).toContain("false");
    expect(migration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.configure_non_fiscal_folio_series/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.configure_non_fiscal_folio_series[\s\S]*TO app_role/);
    expect(migration).not.toMatch(/UPDATE\s+public\.document_series|DELETE\s+FROM\s+public\.document_series/i);
  });

  test("serves a dedicated idempotent operator route without weakening raw series DML", () => {
    const app = readFileSync(new URL("src/app.ts", source), "utf8");
    const operator = readFileSync(new URL("src/http/operator.ts", source), "utf8");
    const service = readFileSync(new URL("src/contexts/financials/folio-series.ts", source), "utf8");
    expect(app).toContain('.post("/api/v1/properties/:property/folio-series"');
    expect(operator).toContain('const FOLIO_SERIES_CONFIGURE_SCOPE = "financials.folio-series:configure"');
    expect(operator).toContain("configureNonFiscalFolioSeries");
    expect(service).toContain('operation: "financials.folio-series.configure"');
    expect(service).toContain("configure_non_fiscal_folio_series");
    expect(service).toContain("assert_non_fiscal_folio_series_configuration_authority");
    expect(service).toContain("PostgresIdempotency");
    expect(service).not.toMatch(/INSERT\s+INTO\s+document_series|UPDATE\s+document_series|DELETE\s+FROM\s+document_series/i);
  });

  test("documents the exact non-fiscal event boundary", () => {
    const events = readFileSync(new URL("docs/EVENTS.md", source), "utf8");
    expect(events).toContain("### folio.series.configured — non-fiscal folio numbering configuration");
    expect(events).toContain("{seriesId,propertyNode,kind:'folio',prefix,fiscal:false}");
  });
});
