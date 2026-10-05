import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import {
  packagePriceLabsDashboardExport,
  preparePriceLabsDashboardExport,
  PriceLabsDashboardExportError,
} from "../scripts/research/pricelabs-dashboard-export";

const LIST_HEADER = "ListingID,listing_link,lat,lng,Bedrooms,Star Rating,Reviews,Price,Active Nights,Min Stay,Dynamic Pricing,new_listing,listing_title,id";
const PRICE_HEADER = "Dates,25th Percentile,50th Percentile,75th Percentile,90th Percentile,Median Booked Price,No. Of Bookings";
const longId = "900719925474099312345";
const listing = (id = longId, title = 'A, "quoted"\n=FORMULA') =>
  `${id},https://example.test/listing/${id},24.43128,54.6207,Studio,-NA,0,393.0,361.0,3,Moderate,0,"${title.replaceAll('"', '""')}",101`;
const price = (date: string, median = "NA") => `${date},403.1,559.8,797.5,1135.9,${median},0.0`;
const context = { observedAt: "2026-09-25T12:34:56Z", sourceRefreshed: "25 September 2026 02:12 AM" };
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(listRows = [listing()], priceRows = [price("2026-10-01")]) {
  const root = mkdtempSync(join(tmpdir(), "order722-")); roots.push(root);
  const listings = join(root, "listings.csv"); const prices = join(root, "prices.csv");
  writeFileSync(listings, `${LIST_HEADER}\n${listRows.join("\n")}\n`);
  writeFileSync(prices, `${PRICE_HEADER}\n${priceRows.join("\n")}\n`);
  return { root, listings, prices, output: join(root, "package") };
}
function code(action: () => unknown): string {
  try { action(); } catch (error) { return (error as PriceLabsDashboardExportError).code; }
  return "no_error";
}

describe("Order722 offline PriceLabs dashboard export", () => {
  test("preserves long IDs, hostile quoted text, source decimal strings, nulls and zero counts", () => {
    const f = fixture();
    const result = preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context });
    expect(result.listings.rows[0]?.listingId).toBe(longId);
    expect(result.listings.rows[0]?.sourceRowId).toBe("101");
    expect(result.listings.rows[0]?.title).toBe('A, "quoted"\n=FORMULA');
    expect(result.listings.rows[0]?.starRating).toBeNull();
    expect(result.listings.rows[0]?.reviews).toBe("0");
    expect(result.report.listings.nullCounts.starRating).toBe(1);
    expect(result.report.listings.nullCounts.priceNextYearAverage).toBe(0);
    expect(result.report.listings.zeroCounts.reviews).toBe(1);
    expect(result.report.prices.zeroCounts.bookings).toBe(1);
    expect(result.october.rows[0]?.medianBookedPrice).toBeNull();
    expect(result.october.rows[0]?.bookings).toBe("0.0");
    expect(result.october.rows).toHaveLength(1);
    expect(result.report.october.missingDates).toHaveLength(30);
    expect(result.octoberCsv).toContain("2026-10-01,403.1,559.8,797.5,1135.9,,0.0");
    expect(result.octoberCsv).not.toContain("=FORMULA");
    expect(result.report.source.market).toBe("Abu Dhabi, UAE");
    expect(result.report.source.currency).toBe("AED");
    expect(result.report.source.contextBasis).toBe("operator-supplied-dashboard-context-not-encoded-in-csv");
  });

  test("keeps all 31 actual October rows without interpolation", () => {
    const days = Array.from({ length: 31 }, (_, index) => price(`2026-10-${String(index + 1).padStart(2, "0")}`, "436.6"));
    const f = fixture([listing()], [price("2026-09-30"), ...days, price("2026-11-01")]);
    const result = preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context });
    expect(result.october.rows).toHaveLength(31);
    expect(result.report.october.missingDates).toEqual([]);
    expect(result.october.rows[0]?.date).toBe("2026-10-01");
    expect(result.october.rows[30]?.date).toBe("2026-10-31");
    expect(result.report.prices.sourceRows).toBe(33);
  });

  test("preserves absent regional percentiles and bookings as null, never invented zero", () => {
    const f = fixture([listing()], ["2026-10-01,NA,,797.5,1135.9,-NA,NA"]);
    const result = preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context });
    expect(result.october.rows[0]?.percentile25).toBeNull();
    expect(result.october.rows[0]?.percentile50).toBeNull();
    expect(result.october.rows[0]?.medianBookedPrice).toBeNull();
    expect(result.october.rows[0]?.bookings).toBeNull();
    expect(result.report.prices.nullCounts.percentile25).toBe(1);
    expect(result.report.prices.nullCounts.bookings).toBe(1);
    expect(result.report.prices.zeroCounts.bookings).toBe(0);
    expect(result.octoberCsv).toContain("2026-10-01,,,797.5,1135.9,,\n");
  });

  test("rejects normalized invalid UTC calendar and clock instants", () => {
    const f = fixture();
    for (const observedAt of ["2026-02-30T12:00:00Z", "2026-09-25T24:00:00Z", "2026-09-25T12:60:00Z", "2026-09-25T12:00:60Z"]) {
      expect(code(() => preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context, observedAt }))).toBe("invalid_observed_at");
    }
    expect(preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context,
      observedAt: "2026-09-25T12:34:56.7Z" }).report.source.observedAt).toBe("2026-09-25T12:34:56.7Z");
  });

  test("rejects duplicate listing identity and duplicate price date", () => {
    const duplicateId = fixture([listing(), listing(longId, "different")]);
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: duplicateId.listings, pricesPath: duplicateId.prices, ...context }))).toBe("duplicate_listing_id");
    const duplicateDate = fixture([listing()], [price("2026-10-01"), price("2026-10-01")]);
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: duplicateDate.listings, pricesPath: duplicateDate.prices, ...context }))).toBe("duplicate_price_date");
  });

  test("rejects wrong headers, invalid numeric/date/coordinate and oversized files", () => {
    const f = fixture();
    writeFileSync(f.listings, `${LIST_HEADER.replace("ListingID", "UnknownID")}\n${listing()}\n`);
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context }))).toBe("invalid_listing_header");
    writeFileSync(f.listings, `${LIST_HEADER}\n${listing().replace("24.43128", "91")}\n`);
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context }))).toBe("invalid_coordinate");
    writeFileSync(f.listings, `${LIST_HEADER}\n${listing().replace("393.0", "1e9")}\n`);
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context }))).toBe("invalid_listing_number");
    writeFileSync(f.listings, `${LIST_HEADER}\n${listing()}\n`);
    writeFileSync(f.prices, `${PRICE_HEADER}\n${price("2026-02-30")}\n`);
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context }))).toBe("invalid_price_date");
    writeFileSync(f.prices, `${PRICE_HEADER}\n${price("2026-10-01").replace("403.1", "NaN")}\n`);
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context }))).toBe("invalid_price_number");
    writeFileSync(f.prices, "x".repeat(2_100_000));
    expect(code(() => preparePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, ...context }))).toBe("input_too_large");
  });

  test("writes only a new directory and refuses overwrite", () => {
    const f = fixture();
    const receipt = packagePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, outputDir: f.output, ...context });
    expect(receipt.outputFiles).toEqual(["listings.normalized.json", "october-2026-prices.json", "october-2026-prices.csv", "validation-report.json"]);
    expect(existsSync(join(f.output, "listings.normalized.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(f.output, "validation-report.json"), "utf8")).listings.sourceRows).toBe(1);
    expect(code(() => packagePriceLabsDashboardExport({ listingsPath: f.listings, pricesPath: f.prices, outputDir: f.output, ...context }))).toBe("output_exists");
  });
});
