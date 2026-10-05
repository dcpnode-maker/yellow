import { describe, expect, test } from "bun:test";
import { buildHotelSearchResults } from "../frontend/yellow/src/hotel-search";
import { capabilityByKey } from "../frontend/yellow/src/ecosystem/capability-registry";
import { reservationGroupFromSearch, reservationViewFromSearch, reservationViewHref } from "../frontend/yellow/src/reservation-navigation";

const property = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const groupId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("Order689 group search navigation", () => {
  test("an authorized group result resolves to the exact existing Groups workspace", () => {
    const results = buildHotelSearchResults(property, "PATEL", [], [], 30, { filter: "group", groups: [{
      groupId, code: "GRP-PATEL", name: "Patel party", kind: "linked", status: "tentative", memberCount: 4,
    }] });
    expect(results.counts).toMatchObject({ all: 1, group: 1 });
    const result = results.results[0]!;
    expect(result.kind).toBe("group");
    expect(result.href).toBe(`/p/${property}/reservations?view=groups&group=${groupId}`);
    const url = new URL(result.href, "https://yellow.test");
    expect(reservationViewFromSearch(url.search)).toBe("groups");
    expect(reservationGroupFromSearch(url.search)).toBe(groupId);
    expect(result.cashierHref).toBeUndefined();
  });

  test("invalid and duplicate group links cannot choose a detail; switching tabs drops only group target", () => {
    expect(reservationGroupFromSearch("?view=groups")).toBeUndefined();
    expect(reservationGroupFromSearch("?view=groups&group=../bad")).toBeNull();
    expect(reservationGroupFromSearch(`?view=groups&group=${groupId}&group=${groupId}`)).toBeNull();
    expect(reservationGroupFromSearch(`?view=list&group=${groupId}`)).toBeNull();
    const other = reservationViewHref(`/p/${property}/reservations`, `?view=groups&group=${groupId}&hotelSearch=1`, "", "calendar");
    expect(other).toBe(`/p/${property}/reservations?view=calendar&hotelSearch=1`);
    expect(reservationViewHref(`/p/${property}/reservations`, `?view=groups&group=${groupId}`, "", "groups"))
      .toBe(`/p/${property}/reservations?view=groups&group=${groupId}`);
  });

  test("ecosystem promise stays beta and names only the connected group fields", () => {
    const capability = capabilityByKey("guest-services.universal-search")!;
    expect(capability.status).toBe("beta");
    expect(capability.summary).toContain("group names or codes");
    expect(capability.statusReason).toContain("folio, task and catalog indexes are not yet included");
  });
});
