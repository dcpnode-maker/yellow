import { expect, test } from "bun:test";
import * as crs from "../frontend/yellow/src/workspaces/staff-crs-client";
const P = "6081b544-22a1-534f-a86d-bb1ae0519e14", Q = "01e4e102-c54f-5205-9542-d84d103084f8";
const U = "11111111-1111-4111-8111-111111111111", R = "22222222-2222-4222-8222-222222222222";
const properties = [{ id: P, name: "Synthetic Riyadh", timezone: "Asia/Riyadh" }, { id: Q, name: "Synthetic London", timezone: "Europe/London" }];
const draft = { arrivalDate: "2026-10-02", departureDate: "2026-10-05", adults: 2, childAges: [0, 12], channelCode: "direct" };
function result() {
  const request = crs.buildStaffCrsBody(properties, draft);
  return { properties: properties.map((p, index) => ({ property_id: p.id, property_name: p.name, time_zone: p.timezone, result: {
    summary: { bookable: 1, blocked: 0, unpriced: 1, conflicted: 0 }, options: [{ option_ref: "synthetic-ref-" + index,
      bookable: true, promise: false, commit_arbitration_required: true, sellable_unit: { id: U, name: "Synthetic room" },
      unit_type: { code: "KING" }, rate_plan: { id: R, code: "BAR" }, available_count: 1,
      stay: request.searches[index]!.search.stay, party: { adults: draft.adults, child_ages: [...draft.childAges] }, total: { amount_minor: "9007199254740993", currency: index ? "GBP" : "SAR", kind: "published" } }] } })) };
}
test("CRS sends canonical ordered per-property local stays and retains exact server money without promise", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = crs.createStaffCrsClient({ session: async () => "synthetic-memory-token", grants: async () => properties,
    fetch: async (url, init) => { calls.push({ url, init }); return Response.json(result()); } });
  const rows = await client.search([P, Q], draft);
  expect(calls).toHaveLength(1); expect(calls[0]!.url).toBe("/api/v1/crs/availability:search");
  const init = calls[0]!.init!; expect(init.method).toBe("POST"); expect(init.credentials).toBe("omit");
  expect(new Headers(init.headers).get("authorization")).toBe("Bearer synthetic-memory-token");
  const body = JSON.parse(String(init.body)); expect(Object.keys(body)).toEqual(["searches"]);
  expect(body.searches.map((item: {property_id: string}) => item.property_id)).toEqual([P, Q]);
  expect(body.searches[0].search.stay.from).toBe("2026-10-02T12:00:00.000Z");
  expect(body.searches[1].search.stay.from).toBe("2026-10-02T14:00:00.000Z");
  expect(body.searches[0].search.party).toEqual({ adults: 2, children: [{ age: 0 }, { age: 12 }] });
  expect(rows[0]!.offers[0]!.total.amountMinor).toBe("9007199254740993");
  expect(rows[0]!.offers[0]!.promise).toBe(false); expect(rows[0]!.unpriced).toBe(1);
  const href = crs.staffCrsReservationHref(rows[1]!, rows[1]!.offers[0]!, draft);
  expect(href).toStartWith(`/p/${Q}/reservations?create=crs&`); expect(href).not.toContain("amount"); expect(href).not.toContain("token");
  expect(crs.readStaffCrsReservationDraft(href.slice(href.indexOf("?")))).toEqual({ ...draft, optionRef: "synthetic-ref-1" });
});
test("CRS authorizes all selected properties before POST and rejects scope/stay/unsafe promise evidence", async () => {
  let calls = 0;
  const client = crs.createStaffCrsClient({ session: async () => "synthetic", grants: async () => properties.slice(0, 1), fetch: async () => { ++calls; return Response.json(result()); } });
  await expect(client.search([P, Q], draft)).rejects.toThrow("no longer granted"); expect(calls).toBe(0);
  expect(() => crs.buildStaffCrsBody([properties[0]!, properties[0]!], draft)).toThrow();
  for (const change of ["property", "stay", "party", "promise"]) {
    const value = result(); if (change === "property") value.properties[0]!.property_id = Q;
    if (change === "stay") value.properties[0]!.result.options[0]!.stay.from = "2026-10-01T00:00:00Z";
    if (change === "party") value.properties[0]!.result.options[0]!.party.adults = 3;
    if (change === "promise") value.properties[0]!.result.options[0]!.promise = true;
    expect(() => crs.parseStaffCrsResults(value, properties, draft)).toThrow();
  }
});
test("CRS discards token-generation changes, cancellation and revoked grants without presenting stale results", async () => {
  let token = "synthetic-a";
  const client = crs.createStaffCrsClient({ session: async () => token, grants: async () => properties,
    fetch: async () => { token = "synthetic-b"; return Response.json(result()); } });
  await expect(client.search([P, Q], draft)).rejects.toThrow("session changed");
  const controller = new AbortController(); controller.abort();
  await expect(client.search([P], draft, controller.signal)).rejects.toThrow("cancelled");
});
test("CRS draft URL is bounded, canonical and never accepts command or price authority", () => {
  const query = new URLSearchParams({ create: "crs", from: draft.arrivalDate, to: draft.departureDate, adults: "2", child_ages: "0,12", channel: "direct", option_ref: "synthetic-ref" });
  expect(crs.readStaffCrsReservationDraft("?" + query)).not.toBeNull();
  for (const [key, values] of Object.entries({ adults: ["0", "02", "2e0", "21"], child_ages: [",", "1,,2", "01", "18"], from: ["2026-02-30"], option_ref: ["x".repeat(513)] })) {
    for (const value of values) { const changed = new URLSearchParams(query); changed.set(key, value); expect(crs.readStaffCrsReservationDraft("?" + changed)).toBeNull(); }
  }
  for (const key of ["token", "amount", "guest", "operation_key", "idempotency_key"]) expect(crs.readStaffCrsReservationDraft("?" + query + `&${key}=synthetic`)).toBeNull();
  expect(crs.readStaffCrsReservationDraft("?" + query + "&adults=2")).toBeNull();
  expect(crs.readStaffCrsReservationDraft("?" + "x".repeat(4097))).toBeNull();
});
