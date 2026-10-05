import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0053_india_gst_supplier_sez_status.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-supplier-sez-status.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 286 intentional red: exact India GST supplier SEZ status", () => {
  test("P0: the status root, resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain(
      "CREATE TABLE public.india_gst_supplier_sez_status",
    );
    expect(sql).toContain("FOREIGN KEY (tenant_id, supplier_registration_id)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.india_gst_supplier_sez_status TO app_role",
    );
    expect(service).toContain(
      "export class IndiaGstSupplierSezStatusService",
    );
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain(
      'from "./india-gst-supplier-sez-status"',
    );
  });
});
