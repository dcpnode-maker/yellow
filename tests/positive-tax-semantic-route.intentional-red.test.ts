import { describe, expect, test } from "bun:test";

const migration = new URL("../migrations/0043_positive_tax_semantic_route.sql", import.meta.url);
const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

describe("Order 259 intentional red: configured positive-tax semantic routing", () => {
  test("P0: the tenant route root and exact resolver surface exist", async () => {
    expect(await Bun.file(migration).exists()).toBeTrue();
    expect(await Bun.file(new URL("semantic-route.ts", sourceRoot)).exists()).toBeTrue();

    const sql = await Bun.file(migration).text();
    const service = await Bun.file(new URL("semantic-route.ts", sourceRoot)).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(sql).toContain("CREATE TABLE public.tax_semantic_route");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("GRANT SELECT ON TABLE public.tax_semantic_route TO app_role");
    expect(service).toContain("export class PositiveTaxSemanticRouteService");
    expect(service).toContain("async resolve(");
    expect(index).toContain('from "./semantic-route"');
  });
});
