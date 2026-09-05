import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0055_india_gst_supplier_registration_status.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-supplier-registration-status.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 289 intentional red: exact India GST supplier registration status", () => {
  test("P0: the snapshot, resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain(
      "CREATE TABLE public.india_gst_supplier_registration_status_snapshot",
    );
    expect(sql).toContain("FOREIGN KEY (tenant_id, supplier_registration_id)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toMatch(
      /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.india_gst_supplier_registration_status_snapshot\s+TO\s+app_role/i,
    );
    expect(service).toContain(
      "export class IndiaGstSupplierRegistrationStatusService",
    );
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain(
      'from "./india-gst-supplier-registration-status"',
    );
  });
});
