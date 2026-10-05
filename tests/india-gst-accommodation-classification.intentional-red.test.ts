import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0050_india_gst_item_classification.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-classification.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 281 intentional red: exact India GST accommodation classification", () => {
  test("P0: the classification root, resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain("CREATE TABLE public.india_gst_item_classification");
    expect(sql).toContain("FOREIGN KEY (tenant_id, property_node)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.india_gst_item_classification TO app_role",
    );
    expect(service).toContain(
      "export class IndiaGstAccommodationClassificationService",
    );
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain(
      'from "./india-gst-accommodation-classification"',
    );
  });
});
