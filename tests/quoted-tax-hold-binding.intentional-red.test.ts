import { describe, expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);
const migration = new URL("../migrations/0040_quoted_tax_hold_binding.sql", import.meta.url);

describe("Order 248 intentional red: authoritative quoted-tax cart-hold binding", () => {
  test("P0: the append-only binding root and governed capability exist", async () => {
    const sql = await Bun.file(migration).text();
    expect(sql).toContain("CREATE TABLE public.tax_attribution_hold_binding");
    expect(sql).toContain("CREATE FUNCTION public.record_tax_attribution_hold_binding");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE public.tax_attribution_hold_binding FROM PUBLIC, app_role");
  });

  test("P0: the tax-fiscal context exports the fixed authoritative orchestration contract", async () => {
    const service = await Bun.file(new URL("quoted-holds.ts", sourceRoot)).text();
    const index = await Bun.file(new URL("index.ts", sourceRoot)).text();
    expect(service).toContain("export class QuotedTaxHoldBindingService");
    expect(service).toContain("readonly quotes: Pick<RateQuoteService, \"resolve\">");
    expect(service).toContain("this.#quotes = options.quotes");
    expect(service).toContain("async place(tx: Tx, value: PlaceQuotedTaxHoldInput)");
    expect(service).toContain("RateQuoteService");
    expect(service).toContain("HoldService");
    expect(service).toContain("TaxAttributionPersistenceService");
    expect(service).toContain('eventType: "tax.attribution_bound"');
    expect(index).toContain('from "./quoted-holds"');
  });
});
