import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0049_property_fiscal_location.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-property-location.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 280 intentional red: exact India property fiscal location", () => {
  test("P0: the new table, resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain("CREATE TABLE public.property_fiscal_location");
    expect(sql).toContain("FOREIGN KEY (tenant_id, property_node)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.property_fiscal_location TO app_role",
    );
    expect(service).toContain("export class IndiaGstPropertyLocationService");
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain('from "./india-gst-property-location"');
  });
});
