import { describe, expect, test } from "bun:test";

const migration = new URL(
  "../migrations/0054_india_sez_unit_loa_renewal.sql",
  import.meta.url,
);
const source = new URL(
  "../src/contexts/tax-fiscal/india-sez-unit-loa-renewal.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

describe("Order 288 intentional red: exact first Form-F2 LoA renewal", () => {
  test("P0: migration/table, resolver source and bounded-context export are absent before implementation", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(source).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const resolver = await Bun.file(source).text();
    const moduleSurface = await Bun.file(index).text();

    expect(sql).toContain("CREATE TABLE public.india_sez_unit_loa_renewal");
    expect(resolver).toContain("export class IndiaSezUnitLoaRenewalService");
    expect(resolver).toContain("async resolve(");
    expect(moduleSurface).toContain('from "./india-sez-unit-loa-renewal"');
  });
});
