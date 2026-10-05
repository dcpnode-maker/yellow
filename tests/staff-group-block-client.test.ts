import { expect, test } from "bun:test";
import { createStaffGroupBlockClient, parseStaffGroupBlocks } from "../frontend/yellow/src/workspaces/staff-group-block-client";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  return { groups: [{ groupId: id(3), code: "BLOCK", name: null, status: "cancelled", statusDeductsInventory: false,
    accountPartyId: null, accountPartyName: null, cutoffDate: null, elastic: false, washSchedule: { unknown: "retained" },
    masterFolioId: null, masterFolioNo: null, masterFolioStatus: null, arrivalDate: null, departureDate: null,
    blockedRooms: 5, pickedUpRooms: 6, remainingRooms: 0, pickupPercent: 120, cutoffState: "not_set",
    allotment: [{ unitTypeId: id(4), unitTypeCode: "KING", unitTypeName: "King", stayDate: "2026-10-03",
      blocked: 5, pickedUp: 6, remaining: 0, rateOverride: { unknown: "opaque" } }],
    roomingList: [{ reservationId: id(5), confirmationNo: "RES", primaryGuestDisplayName: "Synthetic guest", status: "reserved",
      unitTypeCode: null as string | null, unitTypeName: null as string | null, stayFrom: "2026-10-03T15:00:00.000000Z", stayTo: "2026-10-04T11:00:00.000000Z", pickedUpNights: 1 }] }] };
}
test("native group parser preserves overpickup, zero, null, order and opaque evidence without mutating input", () => {
  const input = fixture(), before = JSON.stringify(input), parsed = parseStaffGroupBlocks(input);
  expect(parsed).toEqual(input); expect(JSON.stringify(input)).toBe(before); expect(Object.isFrozen(parsed.groups[0]!.roomingList)).toBe(true);
  expect(parsed.groups[0]!.pickupPercent).toBe(120); expect(parseStaffGroupBlocks({ groups: [] }).groups).toHaveLength(0);
  const split = fixture(); split.groups[0]!.roomingList.push({ ...split.groups[0]!.roomingList[0]!, unitTypeCode: "OTHER", unitTypeName: "Other type" });
  expect(parseStaffGroupBlocks(split).groups[0]!.roomingList).toEqual(split.groups[0]!.roomingList);
});
test("group parser rejects malformed rows, impossible dates, unsafe counts and duplicate identities", () => {
  const variants: unknown[] = [null, {}, { groups: null }];
  for (const [key, value] of [["groupId", "../foreign"], ["blockedRooms", -1], ["pickedUpRooms", Number.MAX_SAFE_INTEGER + 1],
    ["pickupPercent", NaN], ["pickupPercent", 1.5], ["remainingRooms", 0.5], ["cutoffState", "released"], ["cutoffState", ["future"]], ["cutoffDate", "2026-02-30"],
    ["washSchedule", undefined], ["allotment", {}], ["roomingList", null]] as const) {
    variants.push({ groups: [{ ...fixture().groups[0], [key]: value }] });
  }
  const duplicate = fixture(); duplicate.groups.push(duplicate.groups[0]!); variants.push(duplicate);
  const duplicateAllotment = fixture(); duplicateAllotment.groups[0]!.allotment.push(duplicateAllotment.groups[0]!.allotment[0]!); variants.push(duplicateAllotment);
  const duplicateRooming = fixture(); duplicateRooming.groups[0]!.roomingList.push(duplicateRooming.groups[0]!.roomingList[0]!); variants.push(duplicateRooming);
  const badDate = fixture(); badDate.groups[0]!.roomingList[0]!.stayFrom = "2026-02-30T15:00:00.000000Z"; variants.push(badDate);
  for (const value of variants) expect(() => parseStaffGroupBlocks(value)).toThrow("could not be verified");
});
test("group read captures property and bearer with current grants, no-store and no credentials", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const client = createStaffGroupBlockClient({ session: async () => "fixture-token", grants: async () => [{ id: id(1), name: "FIRST", timezone: "UTC" }],
    fetch: async (path, init) => { calls.push({ path, init }); return Response.json(fixture()); } });
  const result = await client.read(id(1)); expect(result.property.id).toBe(id(1)); expect(result.groups[0]!.pickupPercent).toBe(120);
  expect(calls).toHaveLength(1); expect(calls[0]!.path).toBe(`/api/v1/properties/${id(1)}/group-blocks`);
  expect(new Headers(calls[0]!.init!.headers).get("authorization")).toBe("Bearer fixture-token");
  expect(calls[0]!.init!.cache).toBe("no-store"); expect(calls[0]!.init!.credentials).toBe("omit");
});
test("missing grant and invalid scope fail before property transport", async () => {
  let requests = 0;
  const client = createStaffGroupBlockClient({ session: async () => "fixture-token", grants: async () => [{ id: id(2), name: "SECOND", timezone: "UTC" }],
    fetch: async () => { requests++; return Response.json(fixture()); } });
  await expect(client.read(id(1))).rejects.toThrow("no longer granted"); await expect(client.read("../other")).rejects.toThrow("scope"); expect(requests).toBe(0);
});
test("token change and abort fence delayed successful responses", async () => {
  let token = "first", release: (() => void) | undefined;
  const client = createStaffGroupBlockClient({ session: async () => token, grants: async () => [{ id: id(1), name: "FIRST", timezone: "UTC" }],
    fetch: async () => { await new Promise<void>(resolve => { release = resolve; }); return Response.json(fixture()); } });
  const attempt = client.read(id(1)); await Bun.sleep(0); token = "second"; release!(); await expect(attempt).rejects.toThrow("session changed");
  const controller = new AbortController(); const second = client.read(id(1), controller.signal); await Bun.sleep(0); controller.abort(); release!();
  await expect(second).rejects.toThrow("cancelled");
});
