import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0048_party_fiscal_registration.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-recipient-registration.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 276 intentional red: exact India GST recipient registration", () => {
  test("P0: the new table, resolver module and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain("CREATE TABLE public.party_fiscal_registration");
    expect(sql).toContain("FOREIGN KEY (tenant_id, party_id)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.party_fiscal_registration TO app_role",
    );
    expect(service).toContain("export class IndiaGstRecipientRegistrationService");
    expect(service).toContain("async discover(");
    expect(service).toContain("async resolve(");
    expect(moduleSurface).toContain('from "./india-gst-recipient-registration"');
  });
});
