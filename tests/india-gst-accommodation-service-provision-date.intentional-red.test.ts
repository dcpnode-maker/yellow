import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0056_india_gst_accommodation_service_provision_date.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-service-provision-date.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 290 intentional red: exact India GST accommodation service-provision date", () => {
  test("P0: the snapshot, resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain(
      "CREATE TABLE public.india_gst_accommodation_service_provision_snapshot",
    );
    expect(sql).toMatch(
      /FOREIGN KEY\s*\(\s*tenant_id,\s*reservation_lineage_id,\s*property_node,\s*hold_binding_id,\s*attribution_id,\s*reservation_id,\s*segment_id,\s*origin_quote_hash,\s*snapshot_hash,\s*currency\s*\)/i,
    );
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toMatch(
      /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.india_gst_accommodation_service_provision_snapshot\s+TO\s+app_role/i,
    );
    expect(service).toContain(
      "export class IndiaGstAccommodationServiceProvisionDateService",
    );
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-service-provision-date"',
    );
  });
});
