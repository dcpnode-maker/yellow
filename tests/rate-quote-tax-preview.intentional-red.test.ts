import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const root = new URL("../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

describe("Order 239 intentional red: attributable rate-quote tax preview", () => {
  test("RateQuoteService does not yet require the Order 238 resolver", () => {
    const quote = source("src/contexts/rates/quote.ts");

    expect({
      publicTaxImport: quote.includes('from "../tax-fiscal"'),
      resolverContract: quote.includes("TaxJurisdictionResolutionService"),
      mandatoryDependency: /taxJurisdictionResolver\s*:\s*Pick<TaxJurisdictionResolutionService,\s*"resolve">/.test(quote),
    }).toEqual({
      publicTaxImport: true,
      resolverContract: true,
      mandatoryDependency: true,
    });
  });

  test("RateQuote does not yet expose one hash-bound tax preview", () => {
    const quote = source("src/contexts/rates/quote.ts");

    expect({
      previewContract: quote.includes("export type RateQuoteTaxPreview"),
      quoteField: quote.includes("readonly taxPreview: RateQuoteTaxPreview"),
      hashBoundValue: quote.includes("taxPreview,"),
    }).toEqual({
      previewContract: true,
      quoteField: true,
      hashBoundValue: true,
    });
  });

  test("reservation offers do not yet retain the quote tax preview", () => {
    const offers = source("src/contexts/reservations/offers.ts");

    expect({
      offerField: offers.includes('readonly taxPreview: RateQuote["taxPreview"]'),
      exactPropagation: offers.includes("taxPreview: quote.taxPreview"),
    }).toEqual({
      offerField: true,
      exactPropagation: true,
    });
  });

  test("operator offer JSON does not yet expose canonical tax_preview evidence", () => {
    const operator = source("src/http/operator.ts");

    expect({
      snakeCaseField: operator.includes("tax_preview: offer.taxPreview"),
      existingBigintSerializer: operator.includes('if (typeof value === "bigint") return value.toString()'),
    }).toEqual({
      snakeCaseField: true,
      existingBigintSerializer: true,
    });
  });
});
