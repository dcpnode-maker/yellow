import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
// @ts-expect-error Browser-only module intentionally has no Node declaration surface.
import { tryCreateMarketMapData, tryParseMarketPlanPreview, tryParseMarketSnapshots } from "../src/http/operator/market.js";

const root = resolve(import.meta.dir, "..");
const source = (path: string) => readFile(resolve(root, path), "utf8");

test("Order472 market workspace stays lazy, property-bound, and explicitly confirmable", async () => {
  const [html, operator, market, css] = await Promise.all([
    source("src/http/operator/index.html"), source("src/http/operator/operator.js"),
    source("src/http/operator/market.js"), source("src/http/operator/operator.css"),
  ]);
  expect(html).toContain('id="nav-market"');
  expect(html).toContain('data-view="market"');
  expect(html).toContain('id="market-view"');
  expect(html).toContain('id="market-mount"');
  expect(html).not.toContain("operator-market.js");
  expect(operator).toContain('import("/assets/operator-market.js")');
  expect(operator).toContain('activeView === "market"');
  expect(operator).toContain('location.pathname.endsWith("/market")');
  expect(market).toContain("/market/discovery");
  expect(market).toContain("/market/compset");
  expect(market).toContain("/market/compset/confirm");
  expect(market).toContain("MAX_CONFIRM_BYTES = 16_384");
  expect(market).toContain("PAGE_SIZE = 25");
  expect(market).toContain("sameRecord(row, state.own)");
  expect(market).toContain("Boolean(left && right");
  expect(market).toContain("confirmBox.checked = false");
  expect(market).toContain("tryParseMarketSnapshots");
  expect(market).toContain("requiresReload: false");
  expect(market).toContain("state.requiresReload = true");
  expect(market).toContain("longitudePadding");
  expect(market).toContain("confirmation outcome is unknown");
  expect(market).toContain("currentVersion");
  expect(market).toContain("Coverage is publisher all-places extraction, not hotel coverage");
  expect(market).toContain("market-selected-evidence");
  expect(market).toContain("/me/market-properties");
  expect(market).toContain("market-property-next");
  expect(market).toContain("/market/identity/suggest");
  expect(market).toContain("market-identity-suggest");
  expect(market).toContain("requiresConfirmation");
  expect(market).toContain("radio.checked = false");
  expect(market).toContain("identitySuggest.disabled = false");
  expect(market).toContain("/market/plan/preview");
  expect(market).toContain("market-saved-evidence");
  expect(market).toContain("__plan-comparator");
  expect(market).toContain("Confirmation receipt recorded. Latest saved evidence loaded");
  expect(market).toContain("Select 1–200 saved comparators");
  expect(operator).toContain("marketOnlyAccess");
  expect(operator).toContain("/api/v1/me/market-properties");
  expect(operator).toContain("boundProperty !== currentEffectiveMarketProperty()");
  expect(operator).toContain("let boundProperty = currentEffectiveMarketProperty()");
  expect(operator).toContain("boundProperty = selected");
  expect(market).toContain('src = "/assets/market-map/frame.html"');
  expect(market).toContain("yellow-market-map-ready");
  expect(market).toContain("yellow-market-map-inspect");
  expect(market).toContain("tryCreateMarketMapData");
  expect(market).toContain("const syncMapControls");
  expect(market).toContain("mapEnable.disabled = frozen || !state || Boolean(mapBinding)");
  expect(market).toContain("market-record-inspector");
  expect(market).toContain("inspectorContent.append(facts)");
  expect(market).toContain("market-map-disclosure");
  expect(market).toContain("OpenStreetMap receives your IP address");
  expect(market).toContain('box.dataset.testid = `market-attribute-${key}`');
  for (const [key, label] of [["address", "Address"], ["categories", "Categories"], ["websites", "Websites"], ["coordinates", "Coordinates"], ["operatingStatus", "Operating status"], ["provenance", "Provenance"]]) {
    expect(market).toContain(`["${key}", "${label}"]`);
  }
  expect(market).toContain('new Set(["coordinates", "operatingStatus", "provenance"])');
  expect(market).toContain("Table attributes");
  expect(css).toContain("market-workspace__attribute-controls");
  expect(market).not.toContain("innerHTML");
  expect(market).not.toContain("http://");
  expect(css).toContain(".market-workspace");
  expect(css).toContain("prefers-reduced-motion");
});

test("market discovery rejects ambiguous snapshot and record identities", () => {
  const record = Object.freeze({ provenance: { recordId: "source-1", source: "Overture", release: "v1", schema: "places", attribution: "Open data" }, name: "Hotel A", coordinates: { latitude: 25.2, longitude: 55.3 }, address: "1 Market Road", websites: ["https://example.test/market"], categories: ["hotel"], operatingStatus: "unknown" });
  const snapshot = Object.freeze({ logicalId: "dubai", sha256: "a".repeat(64), capturedAt: "2026-09-13T00:00:00.000Z", region: { minimumLatitude: 25.1, maximumLatitude: 25.3, minimumLongitude: 55.2, maximumLongitude: 55.4 }, completeness: { scope: "publisher-range-extract-all-places", status: "complete", sourceRows: 1, returnedRecords: 1, rejectedRows: 0 }, records: [record] });
  const parsed = tryParseMarketSnapshots([snapshot]);
  expect(parsed).not.toBeNull();
  expect(parsed?.[0]?.records[0]).toMatchObject({ address: "1 Market Road", websites: ["https://example.test/market"], categories: ["hotel"] });
  expect(tryParseMarketSnapshots([snapshot, { ...snapshot, sha256: "b".repeat(64) }])).toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, records: [record, record] }])).toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, records: [{ ...record, websites: ["http://unsafe.example/"] }] }])).toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, capturedAt: "not-a-date" }])).toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, region: undefined }])).toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, completeness: { ...snapshot.completeness, returnedRecords: 2 } }])).toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, records: [{ ...record, provenance: { ...record.provenance, source: "\u0001malformed" } }] }])).toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, records: [{ ...record, provenance: { ...record.provenance, source: "Over\u0085ture" } }] }])).not.toBeNull();
  expect(tryParseMarketSnapshots([{ ...snapshot, records: [{ ...record, operatingStatus: "not-a-status" }] }])).toBeNull();
});

test("planner detail accepts only the exact saved version, normalized request and bounded server plan", () => {
  const extensionId = "00000000-0000-4000-8000-000000000920";
  const reference = { logicalId: "riyadh", sha256: "a".repeat(64), sourceRecordId: "saved-1" };
  const binding = Object.freeze({ extensionId, version: 4, comparatorIndexes: Object.freeze([1]), comparatorReferences: Object.freeze([reference]), conditions: Object.freeze({
    destination: "Riyadh", lookaheadMonths: 3, selectedSources: Object.freeze(["booking-mcp"]),
    guests: Object.freeze({ rooms: 1, adults: 2, childAges: Object.freeze([4, 9]) }), pointOfSaleMarket: "SA", language: "en", lengthsOfStayNights: Object.freeze([1]),
  }) });
  const preview = Object.freeze({ preview: Object.freeze({ previewOnly: true, executable: false, compset: { extensionId, version: 4 }, conditions: binding.conditions,
    propertyTimezone: "Asia/Riyadh", currency: "SAR", comparatorMapping: [{ token: `evidence:${"b".repeat(64)}`, index: 1, reference }],
    plan: { asOfUtc: "2026-09-13T08:30:00.000Z", propertyLocalDate: "2026-09-13", arrivalEndExclusive: "2026-12-13",
      requestedPotentialQueryCount: 91, dueRequestCount: 2, selectedRequestCount: 2, deferredRequestCount: 89, deferredDueToBudgetCount: 0, deferredDueToCadenceCount: 89, nextDueAtUtc: "2026-09-13T09:30:00.000Z" },
    sample: [
      { source: "booking-mcp", arrivalDate: "2026-09-13", checkoutDate: "2026-09-14", lengthOfStayNights: 1, daysAhead: 0, cadence: { kind: "fixed", intervalMinutes: 60 } },
      { source: "booking-mcp", arrivalDate: "2026-09-14", checkoutDate: "2026-09-15", lengthOfStayNights: 1, daysAhead: 1, cadence: { kind: "fixed", intervalMinutes: 60 } },
    ],
  }) });
  const parsed = tryParseMarketPlanPreview(preview, binding);
  expect(parsed).not.toBeNull();
  expect(parsed?.comparatorMapping).toEqual([{ index: 1, reference }]);
  expect(JSON.stringify(parsed)).not.toContain("evidence:");
  expect(JSON.stringify(parsed)).not.toContain("token");
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, compset: { extensionId, version: 5 } } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, comparatorMapping: [{ ...preview.preview.comparatorMapping[0]!, reference: { ...reference, sha256: "c".repeat(64) } }] } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, conditions: { ...binding.conditions, selectedSources: ["trivago-mcp"] } } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, plan: { ...preview.preview.plan, deferredRequestCount: 88 } } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, sample: [preview.preview.sample[0]!] } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, sample: [{ ...preview.preview.sample[0]!, source: "bad\u0001source" }, preview.preview.sample[1]!] } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, comparatorMapping: [{ ...preview.preview.comparatorMapping[0]!, token: "run:secret" }] } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, conditions: { ...binding.conditions, destination: "Riyadh " } } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, plan: { ...preview.preview.plan, dueRequestCount: 101, selectedRequestCount: 101, deferredRequestCount: 0, deferredDueToBudgetCount: 0, deferredDueToCadenceCount: 0, nextDueAtUtc: null } } }, binding)).toBeNull();
  expect(tryParseMarketPlanPreview({ preview: { ...preview.preview, sample: preview.preview.sample.map(sample => ({ ...sample, cadence: { kind: "calendar-month", months: 1 } })) } }, binding)).toBeNull();
});

test("map parent envelope keeps only opaque bounded point facts", () => {
  const nonce = "00000000-0000-4000-8000-000000000268";
  const points = [{ id: "point-1", name: "دبي evidence", latitude: 25.2048, longitude: 55.2708, role: "candidate" }];
  const data = tryCreateMarketMapData(nonce, 1, points);
  expect(data).toEqual({ type: "yellow-market-map-data", version: 1, nonce, revision: 1, points });
  expect(tryCreateMarketMapData(nonce, 0, points)).toBeNull();
  expect(tryCreateMarketMapData(nonce, 1, [...points, { ...points[0]! }])).toBeNull();
  expect(tryCreateMarketMapData(nonce, 1, [{ ...points[0]!, id: "bad\u0001id" }])).toBeNull();
  expect(tryCreateMarketMapData(nonce, 1, [{ ...points[0]!, role: "own-property" }])).toBeNull();
  expect(tryCreateMarketMapData(nonce, 1, [{ ...points[0]!, logicalId: "must-not-cross-frame" }])).toBeNull();
});
