import { describe, expect, test } from "bun:test";
import { MarketMapHttpApi } from "../src/http/market-map";
import { PlaceCatalogInputError, type PlaceRecord, type PlaceCatalogSearchInput } from "../src/contexts/distribution";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000009901";
const ACTOR = "00000000-0000-0000-0000-000000009902";
const PROPERTY = "00000000-0000-0000-0000-000000009903";
const OTHER = "00000000-0000-0000-0000-000000009904";
const place = (id: string): PlaceRecord => ({ id, name: "Public Hotel", longitude: 55.28, latitude: 25.2,
  category: "hotel", status: "unknown", address: null, country: "AE", websites: ["https://hotel.example/"],
  brand: null, confidence: null, sources: [{ dataset: "synthetic", license: "CC0-1.0" }] });

function fixture(query = "mode=keyword&q=Hotel", allowed = true) {
  let catalogCalls = 0;
  let grantCalls = 0;
  let lastQuery: PlaceCatalogSearchInput | undefined;
  const tx = (async () => { grantCalls++; return allowed ? [{ id: PROPERTY }] : []; }) as unknown as Tx;
  const context: TenantRequestContext = { request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/market-map/places?${query}`),
    tenantId: TENANT, identity: { tenantId: TENANT, actorId: ACTOR, scopes: ["rates.configuration:read"] }, tx };
  const catalog = {
    search(input: PlaceCatalogSearchInput) {
      catalogCalls++; lastQuery = input;
      if ((input.limit ?? 100) > 200) throw new PlaceCatalogInputError("invalid_limit");
      return { places: [place(input.mode === "id" ? input.id : "one")], truncated: false, ambiguous: false,
        release: "2026-08-19.0" as const, schemaVersion: "1.18.0" as const };
    },
    byIds(ids: readonly string[]) { catalogCalls++; return ids.map(place); },
  };
  return { context, catalog, api: new MarketMapHttpApi(catalog, () => new Date("2026-09-12T23:00:00Z")),
    calls: () => ({ catalogCalls, grantCalls }), query: () => lastQuery };
}

describe("RMS-PLACES-001 authenticated property map boundary", () => {
  test("returns provenance on an authorized read and marks response no-store", async () => {
    const f = fixture(); const result = await f.api.places(f.context, PROPERTY);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect((await result.json()).release).toBe("2026-08-19.0");
    expect(f.query()).toEqual({ mode: "keyword", q: "Hotel", limit: 100 });
    expect(f.calls()).toEqual({ catalogCalls: 1, grantCalls: 1 });
  });

  test("missing actor, inconsistent tenant and missing rate scope never read the catalog", async () => {
    for (const identity of [
      { tenantId: TENANT, scopes: ["rates.configuration:read"] },
      { tenantId: OTHER, actorId: ACTOR, scopes: ["rates.configuration:read"] },
      { tenantId: TENANT, actorId: ACTOR, scopes: ["inventory.availability:read"] },
    ]) {
      const f = fixture(); const result = await f.api.places({ ...f.context, identity }, PROPERTY);
      expect([401, 403]).toContain(result.status);
      expect(f.calls()).toEqual({ catalogCalls: 0, grantCalls: 0 });
    }
  });

  test("missing or different property grant denies reads and selection before catalog access", async () => {
    for (const allowed of [true, false]) {
      const f = fixture(undefined, allowed);
      expect((await f.api.places(f.context, OTHER)).status).toBe(403);
      expect((await f.api.selection(f.context, OTHER, { subjectId: "one", competitorIds: ["two"] })).status).toBe(403);
      expect(f.calls().catalogCalls).toBe(0);
    }
  });

  test("invalid property and hostile query selectors cannot choose a file or inject a second mode", async () => {
    const invalid = fixture();
    expect((await invalid.api.places(invalid.context, "../../database")).status).toBe(400);
    expect(invalid.calls().grantCalls).toBe(0);
    for (const query of ["mode=keyword&q=Hotel&mode=id", "mode=id&id=one&path=/secrets", "mode=all", "mode=keyword", "mode=keyword&q=Hotel&limit=0", "mode=keyword&q=Hotel&limit=1e2", "mode=bbox&west=&east=1&south=0&north=1", "mode=bbox&west=Infinity&east=1&south=0&north=1", "mode=keyword&q=Hotel&limit=201"]) {
      const f = fixture(query);
      expect((await f.api.places(f.context, PROPERTY)).status).toBe(400);
    }
  });

  test("all supported selectors pass the exact fields and bounded limit", async () => {
    const cases = [
      ["mode=id&id=one", { mode: "id", id: "one", limit: 100 }],
      ["mode=url&url=https%3A%2F%2Fhotel.example%2F", { mode: "url", url: "https://hotel.example/", limit: 100 }],
      ["mode=domain&domain=hotel.example&limit=20", { mode: "domain", domain: "hotel.example", limit: 20 }],
      ["mode=bbox&west=55&south=25&east=55.1&north=25.1", { mode: "bbox", west: 55, south: 25, east: 55.1, north: 25.1, limit: 100 }],
    ] as const;
    for (const [query, expected] of cases) {
      const f = fixture(query);
      expect((await f.api.places(f.context, PROPERTY)).status).toBe(200);
      expect(f.query()).toEqual(expected);
    }
  });

  test("unconfigured index is explicit after permission checks and does not expose server paths", async () => {
    const f = fixture(); const api = new MarketMapHttpApi();
    const result = await api.places(f.context, PROPERTY);
    expect(result.status).toBe(503);
    expect((await result.json()).type).toBe("urn:yellow:market/catalog_unavailable");
    expect((await api.places({ ...f.context, identity: { tenantId: TENANT } }, PROPERTY)).status).toBe(401);
  });

  test("selection reloads canonical public records and never claims operational mapping", async () => {
    const f = fixture();
    const result = await f.api.selection(f.context, PROPERTY, { subjectId: "one", competitorIds: ["two", "three"] });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ schemaVersion: "yellow.market-map-selection/v1", propertyId: PROPERTY,
      generatedAt: "2026-09-12T23:00:00.000Z", release: "2026-08-19.0", catalogSchemaVersion: "1.18.0",
      subject: place("one"), competitors: [place("two"), place("three")],
      status: "requires-provider-mapping", automaticPricingEligible: false, operationalWrites: false });
  });

  test("rejects duplicate, excessive, self and caller-mutated selection data", async () => {
    for (const body of [null, [], { subjectId: "one", competitorIds: [] }, { subjectId: "one", competitorIds: ["one"] },
      { subjectId: "one", competitorIds: ["two", "two"] }, { subjectId: "one", competitorIds: ["two"], tenantId: OTHER },
      { subjectId: "one", competitorIds: Array.from({ length: 51 }, (_, i) => `id${i}`) },
      { subjectId: "one", competitorIds: ["<script>"] }, { subjectId: "one", competitorIds: ["two"], subject: { name: "forged" } }]) {
      const f = fixture();
      expect((await f.api.selection(f.context, PROPERTY, body)).status).toBe(400);
      expect(f.calls().catalogCalls).toBe(0);
    }
  });

  test("missing canonical record refuses an incomplete export", async () => {
    const f = fixture();
    const api = new MarketMapHttpApi({ ...f.catalog, byIds: () => [place("one")] });
    expect((await api.selection(f.context, PROPERTY, { subjectId: "one", competitorIds: ["two"] })).status).toBe(409);
    const changed = new MarketMapHttpApi({ ...f.catalog, byIds: () => { throw new PlaceCatalogInputError("Unknown selected IDs", "unknown_ids"); } });
    expect((await changed.selection(f.context, PROPERTY, { subjectId: "one", competitorIds: ["two"] })).status).toBe(409);
  });

  test("database and catalog failures are redacted", async () => {
    const f = fixture();
    const broken = () => { throw new Error("PRIVATE-SERVER-PATH-AND-CREDENTIAL"); };
    const api = new MarketMapHttpApi({ ...f.catalog, search: broken });
    for (const response of [await api.places(f.context, PROPERTY),
      await f.api.places({ ...f.context, tx: broken as unknown as Tx }, PROPERTY)]) {
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("PRIVATE-");
    }
  });
});
