import { expect, test } from "bun:test";
import { RATE_MODEL_CATALOGUE } from "../src/contexts/rates/models";
import * as rms from "../frontend/yellow/src/workspaces/staff-rms-client";
const P = "6081b544-22a1-534f-a86d-bb1ae0519e14", R = "22222222-2222-4222-8222-222222222222", U = "11111111-1111-4111-8111-111111111111";
const property = { id: P, name: "Synthetic Riyadh", timezone: "Asia/Riyadh" };
const draft = { arrivalDate: "2026-10-02", departureDate: "2026-10-05", adults: 2, childAges: [0, 12], channelCode: "direct" };
function quote(state = "quoted", reason: string | null = null) { return { quote: { propertyNode: P, ratePlanId: R, sellableUnitId: U,
  propertyTimeZone: property.timezone, stayStartDate: draft.arrivalDate, stayEndDate: draft.departureDate,
  quoteHash: "synthetic-hash", taxAssignmentState: "none", result: { state, reason, currency: "SAR", guests: { adults: draft.adults, childAges: [...draft.childAges] }, distributionEvidence: { channelCode: draft.channelCode },
    roomAmountMinor: "9007199254740993", includedAllocationMinor: "0", packageExtraMinor: "0", promotionDiscountMinor: "0", preTaxSubtotalMinor: "9007199254740993" } } }; }
test("RMS reads the actual ten-model catalogue, scoped drafts and never forwards authoring commands", () => {
  const response = { catalogue: RATE_MODEL_CATALOGUE, modelDrafts: [], targetDrafts: [], releases: [{ id: U, propertyNode: P, ratePlanId: R, authoringCommand: { dangerous: "synthetic-only" } }] };
  const result = rms.parseStaffRateBuilder(response, P, R);
  expect(result.catalogue).toHaveLength(10); expect(result.catalogue.map(item => item.key)).toEqual(RATE_MODEL_CATALOGUE.map(item => item.key));
  expect(result.releaseCount).toBe(1); expect(result).not.toHaveProperty("releases"); expect(JSON.stringify(result)).not.toContain("authoringCommand");
  expect(() => rms.parseStaffRateBuilder({ ...response, releases: [{ id: U, propertyNode: U, ratePlanId: R }] }, P, R)).toThrow();
});
test("RMS resolver uses exact canonical request, real property timezone and preserves successful nullable reason", async () => {
  let seen: { url: string; init?: RequestInit } | undefined;
  const client = rms.createStaffRmsClient({ session: async () => "synthetic", grants: async () => [property],
    fetch: async (url, init) => { seen = { url, init }; return Response.json(quote()); } });
  const result = await client.quote(P, R, U, draft);
  expect(seen).toBeDefined(); expect(seen!.url).toBe(`/api/v1/properties/${P}/rate-builder/${R}/quotes:resolve`);
  const body = JSON.parse(String(seen!.init!.body));
  expect(Object.keys(body)).toEqual(["sellableUnitId", "stayStart", "stayEnd", "guests", "selectedPromotionCodes", "commercial", "channelCode"]);
  expect(body.stayStart).toBe("2026-10-02T12:00:00.000Z"); expect(body.stayEnd).toBe("2026-10-05T08:00:00.000Z");
  expect(body.guests).toEqual({ adults: 2, childAges: [0, 12] }); expect(body.selectedPromotionCodes).toEqual([]); expect(body.commercial).toEqual({});
  expect(result.state).toBe("quoted"); expect(result.reason).toBeNull(); expect(result.components.roomAmountMinor).toBe("9007199254740993");
  for (const [state, reason] of [["unpriced", "no-release"], ["blocked", "closed"], ["conflict", "ambiguous"]]) {
    expect(rms.parseStaffRateQuote(quote(state!, reason!), P, R, U, property.timezone, draft).state).toBe(state!);
  }
  expect(() => rms.parseStaffRateQuote(quote(), U, R, U, property.timezone, draft)).toThrow();
  expect(() => rms.parseStaffRateQuote(quote(), P, R, U, "Europe/London", draft)).toThrow();
});
test("recorded economics uses exact strings and recorded provenance without invented forecast or financial scope", async () => {
  let path = "";
  const value = { property: { name: property.name, businessDate: "2026-10-02", currency: "SAR" }, provenance: "stats_daily_commercial_taxonomy",
    total: { roomNights: 1, roomsAvailable: 2, occupancyBasisPoints: 5000, roomRevenueMinor: "9007199254740993", adrMinor: "9007199254740993", revparMinor: "4503599627370496" }, groups: [] };
  const client = rms.createStaffRmsClient({ session: async () => "synthetic", grants: async () => [property], fetch: async url => { path = url; return Response.json(value); } });
  const result = await client.economics(P); expect(path).toBe(`/api/v1/properties/${P}/commercial-contribution`);
  expect(result.roomRevenueMinor).toBe("9007199254740993"); expect(result.adrMinor).toBe("9007199254740993"); expect(result.revparMinor).toBe("4503599627370496");
  expect(() => rms.parseStaffEconomics({ ...value, provenance: "forecast" }, property.name)).toThrow();
  expect(() => rms.parseStaffEconomics({ ...value, total: { ...value.total, roomRevenueMinor: 123 } }, property.name)).toThrow();
});
test("RMS rejects revoked scope, actual403, token changes and aborted asynchronous results", async () => {
  let calls = 0;
  const revoked = rms.createStaffRmsClient({ session: async () => "synthetic", grants: async () => [], fetch: async () => { ++calls; return Response.json({}); } });
  await expect(revoked.builder(P, R)).rejects.toThrow("no longer granted"); expect(calls).toBe(0);
  const forbidden = rms.createStaffRmsClient({ session: async () => "synthetic", grants: async () => [property], fetch: async () => Response.json({}, { status: 403 }) });
  await expect(forbidden.economics(P)).rejects.toThrow("not granted");
  let token = "synthetic-a";
  const changed = rms.createStaffRmsClient({ session: async () => token, grants: async () => [property], fetch: async () => { token = "synthetic-b"; return Response.json(quote()); } });
  await expect(changed.quote(P, R, U, draft)).rejects.toThrow("session changed");
  const controller = new AbortController(); controller.abort(); await expect(changed.builder(P, R, controller.signal)).rejects.toThrow("cancelled");
});
