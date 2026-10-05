import { describe, expect, test } from "bun:test";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000068101";
const PROPERTY = "00000000-0000-0000-0000-000000068102";
const ACTOR = "00000000-0000-0000-0000-000000068109";

function fixture(query: string, scopes: string[] = ["reservations.lifecycle:read"], granted = true) {
  const calls: string[] = [];
  const tx = ((strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    calls.push(sql);
    if (sql.includes("FROM user_role")) return Promise.resolve(granted ? [{ id: PROPERTY }] : []);
    if (sql.includes("FROM org_node AS property")) return Promise.resolve([{ id: PROPERTY, timezone: "UTC" }]);
    return Promise.resolve([]);
  }) as unknown as Tx;
  const request = new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/reservation-calendar${query}`);
  const context = { request, tenantId: TENANT, identity: { tenantId: TENANT, actorId: ACTOR, scopes }, tx } as TenantRequestContext;
  return { api: new OperatorHttpApi({} as never), context, calls };
}

describe("Order681 reservation calendar HTTP authority", () => {
  test("rejects malformed, duplicate, extra and impossible local dates", async () => {
    for (const query of ["", "?from=2026-01-01", "?from=2026-01-01&to=2026-01-02&limit=1", "?from=2026-01-01&from=2026-01-02&to=2026-01-03", "?from=0000-01-01&to=0000-01-02", "?from=2026-02-30&to=2026-03-01"]) {
      const f = fixture(query);
      expect((await f.api.reservationCalendar(f.context, PROPERTY)).status).toBe(400);
      if (!query.includes("0000") && !query.includes("02-30")) expect(f.calls).toHaveLength(0);
    }
  });

  test("exact scope and granted property precede calendar SQL", async () => {
    const q = "?from=2026-11-01&to=2026-11-02";
    const noScope = fixture(q, ["reservations.booking:write"]);
    expect((await noScope.api.reservationCalendar(noScope.context, PROPERTY)).status).toBe(403);
    expect(noScope.calls).toHaveLength(0);
    const noGrant = fixture(q, undefined, false);
    expect((await noGrant.api.reservationCalendar(noGrant.context, PROPERTY)).status).toBe(403);
    expect(noGrant.calls).toHaveLength(1);
    expect(noGrant.calls[0]).toContain("FROM user_role");
  });

  test("granted read emits explicit empty-room and segment limits", async () => {
    const f = fixture("?from=2026-11-01&to=2026-11-02");
    const response = await f.api.reservationCalendar(f.context, PROPERTY);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ propertyId: PROPERTY, timezone: "UTC", fromDate: "2026-11-01", toDateExclusive: "2026-11-02", limit: 1000, limited: false, roomLimit: 500, roomsLimited: false, rooms: [], segments: [] });
    expect(f.calls).toHaveLength(4);
  });
});
