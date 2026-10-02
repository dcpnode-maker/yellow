import { describe, expect, test } from "bun:test";
import {
  PublicBookingSiteAuthority,
  PublicBookingSiteAuthorityError,
  PublicBookingSiteConflictError,
  PublicBookingSiteUnavailableError,
  PublicBookingSiteValidationError,
  PUBLIC_BOOKING_PUBLISHER_SCOPES,
  type PublicBookingRuntimeSql,
} from "../src/contexts/identity";
import type { Tx } from "../src/kernel";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const site = {
  siteId: id(1), version: 2, active: true, issuerId: id(2), channelCode: "direct.web",
  ratePlanIds: [id(3), id(4)],
};
const resolved = {
  tenantId: id(5), propertyNode: id(6), propertyName: "Harbour House", timeZone: "Asia/Kolkata", site,
};

function tagged(result: unknown, calls: unknown[][] = [], error?: unknown) {
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push([strings.join("?"), ...values]);
    if (error) throw error;
    return [{ [strings.join("").includes("publish_public_booking_site") ? "site" : "snapshot"]: result }];
  }) as unknown as PublicBookingRuntimeSql & Tx;
}

const identity = {
  tenantId: id(5), actorId: id(2), scopes: [...PUBLIC_BOOKING_PUBLISHER_SCOPES],
};

describe("PublicBookingSiteAuthority", () => {
  test("resolves only an exact active directory snapshot and returns a frozen safe context", async () => {
    const calls: unknown[][] = [];
    const authority = new PublicBookingSiteAuthority();
    const result = await authority.resolve(tagged(resolved, calls), site.siteId);
    expect(result).toEqual({ tenantId: id(5), propertyNode: id(6), propertyName: "Harbour House", timeZone: "Asia/Kolkata",
      site: { siteId: id(1), version: 2, active: true, issuerId: id(2), ratePlanIds: [id(3), id(4)], channelCode: "direct.web" } });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.site)).toBe(true);
    expect(Object.isFrozen(result.site.ratePlanIds)).toBe(true);
    expect(calls[0]?.[1]).toBe(site.siteId);
  });

  test("hides unavailable directory records and fails closed on malformed trusted snapshots", async () => {
    const authority = new PublicBookingSiteAuthority();
    await expect(authority.resolve(tagged(null), site.siteId)).rejects.toBeInstanceOf(PublicBookingSiteAuthorityError);
    await expect(authority.resolve(tagged({ ...resolved, leaked: "tenant metadata" }), site.siteId))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
    await expect(authority.resolve(tagged({ ...resolved, site: { ...site, version: 0 } }), site.siteId))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
    await expect(authority.resolve(tagged({ ...resolved, site: { ...site, ratePlanIds: [id(3), id(3)] } }), site.siteId))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
    await expect(authority.resolve(tagged({ ...resolved, timeZone: "Not/A_Real_Zone" }), site.siteId))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
    await expect(authority.resolve(tagged(resolved), id(99))).rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
  });

  test("rechecks current site version and plan inside tenant transaction and returns SQL authority time", async () => {
    const now = "2026-10-01T12:34:56.000Z";
    const calls: unknown[][] = [];
    const result = await new PublicBookingSiteAuthority().authorize(tagged({ ...resolved, now }, calls), site.siteId, 2, id(3));
    expect(result.now).toEqual(new Date(now));
    expect(result.timeZone).toBe("Asia/Kolkata");
    expect(calls[0]?.slice(1)).toEqual([site.siteId, 2, id(3)]);
    await expect(new PublicBookingSiteAuthority().authorize(tagged({ ...resolved, now }, []), site.siteId, 3))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
    await expect(new PublicBookingSiteAuthority().authorize(tagged({ ...resolved, now }, []), site.siteId, 2, id(99)))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
    await expect(new PublicBookingSiteAuthority().authorize(tagged({ ...resolved, now: "invalid" }, []), site.siteId, 2))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
  });

  test("maps SQL denial and serialization conflict to generic errors", async () => {
    const authority = new PublicBookingSiteAuthority();
    await expect(authority.resolve(tagged(null, [], { errno: "42501", message: "private detail" }), site.siteId))
      .rejects.toBeInstanceOf(PublicBookingSiteAuthorityError);
    await expect(authority.authorize(tagged(null, [], { errno: "40001", message: "private detail" }), site.siteId, 2))
      .rejects.toBeInstanceOf(PublicBookingSiteConflictError);
    await expect(authority.resolve(tagged(null, [], { errno: "08006", message: "private detail" }), site.siteId))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
  });

  test("publishes exact input only after live six-scope prerequisite and sorts UUID plans", async () => {
    const calls: unknown[][] = [];
    const body = { expectedVersion: 2, active: true, ratePlanIds: [id(4), id(3)], channelCode: "direct.web" };
    const result = await new PublicBookingSiteAuthority().publish(
      tagged({ ...site, version: 3 }, calls), identity, id(6), body, id(8),
    );
    expect(result).toEqual({ siteId: id(1), version: 3, active: true, ratePlanIds: [id(3), id(4)], channelCode: "direct.web" });
    expect(result).not.toHaveProperty("issuerId");
    expect(calls[0]?.slice(1)).toEqual([id(5), id(6), id(2), 2, true, JSON.stringify([id(3), id(4)]), "direct.web", id(8)]);
    await expect(new PublicBookingSiteAuthority().publish(
      tagged({ ...site, version: 3 }), { ...identity, scopes: identity.scopes.slice(0, 5) }, id(6), body, id(8),
    )).rejects.toBeInstanceOf(PublicBookingSiteAuthorityError);
  });

  test("rejects extra fields, duplicate plans, invalid IDs and malformed SQL publication results", async () => {
    const authority = new PublicBookingSiteAuthority();
    const body = { expectedVersion: 2, active: true, ratePlanIds: [id(3)], channelCode: "direct" };
    await expect(authority.publish(tagged(site), identity, id(6), { ...body, actorId: id(2) } as never, id(8)))
      .rejects.toBeInstanceOf(PublicBookingSiteValidationError);
    await expect(authority.publish(tagged(site), identity, id(6), { ...body, ratePlanIds: [id(3), id(3)] }, id(8)))
      .rejects.toBeInstanceOf(PublicBookingSiteValidationError);
    await expect(authority.publish(tagged(site), identity, id(6), body, "bad-request"))
      .rejects.toBeInstanceOf(PublicBookingSiteAuthorityError);
    await expect(authority.publish(tagged({ ...site, tenantId: id(5) }), identity, id(6), body, id(8)))
      .rejects.toBeInstanceOf(PublicBookingSiteUnavailableError);
  });
});
