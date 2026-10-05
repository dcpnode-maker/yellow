import { describe, expect, test } from "bun:test";
import { parseHostInventory, parseHostRatePrice, validateHostCalendarSelection, HostCalendarReadError,
  HOST_CALENDAR_READ_BOUNDS, type HostCalendarSelection, type ReadFailure } from "../frontend/yellow/src/host-calendar-read-foundation";
const id = (n: number) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const tenant = id(1), property = id(2), type = id(3), unit = id(4), space = id(5), second = id(6), plan = id(7);
function selection(): HostCalendarSelection { return { propertyId: property, timezone: "Asia/Kolkata", unitTypeId: type, sellableUnitId: unit,
  price: { ratePlanId: plan, occupancy: 2, channelCode: "direct", stayDate: "2024-03-10" } }; }
function inventory(): any {
  const s = (spaceId: string, code: string) => ({ id: spaceId, tenantId: tenant, propertyNode: property, code, profileKey: "hotel",
    capacity: 4, maxOccupancy: 4, floor: "1", areaSqm: "22.50", genderPolicy: "any", attrs: {}, status: "active" });
  return { unitTypes: [{ id: type, tenantId: tenant, propertyNode: property, code: "STD", name: "Standard", profileKey: "hotel",
    baseOccupancy: 2, maxOccupancy: 4, attrs: {}, sortOrder: 0 }], spaces: [s(space, "101"), s(second, "102")],
    sellableUnits: [{ id: unit, tenantId: tenant, propertyNode: property, unitTypeId: type, unitTypeCode: "STD", name: "Suite 101 + 102", status: "active",
      spaces: [{ spaceId: space, code: "101", claimMode: "exclusive" }, { spaceId: second, code: "102", claimMode: "exclusive" }] }] };
}
function price(): any { return { ratePrice: { id: id(8), tenantId: tenant, propertyNode: property, ratePlanId: plan, unitTypeId: type,
  stayStart: "2024-03-01", stayEnd: "2024-04-01", dowMask: 64, currency: "INR", recordedAt: "2024-02-29T20:00:00.123Z", supersededBy: null,
  pricing: { occupancy: { "1": "0", "2": "9007199254740993", "3": "9223372036854775807" }, extraAdultMinor: "15000",
    extraChildren: [{ maxAge: 5, amountMinor: "0" }, { maxAge: 17, amountMinor: "2500" }] } } }; }
function bad(operation: () => unknown, code: ReadFailure = "malformed") {
  try { operation(); throw new Error("expected rejection"); }
  catch (error) { expect(error).toBeInstanceOf(HostCalendarReadError); expect((error as HostCalendarReadError).code).toBe(code); }
}
describe("Order758 inventory identity and complete reported claims", () => {
  test("joins all spaces by identity and keeps composite/shared/positional units without inventing containment", () => {
    const body = inventory();
    body.sellableUnits.push({ ...body.sellableUnits[0], id: id(9), name: "Room 101", spaces: [body.sellableUnits[0].spaces[0]] },
      { ...body.sellableUnits[0], id: id(10), name: "Bed in 101", spaces: [{ spaceId: space, code: "101", claimMode: "positional" }] });
    const result = parseHostInventory(body, selection(), tenant);
    expect(result.selectedUnit.id).toBe(unit); expect(result.selectedUnit.id).not.toBe(space);
    expect(result.selectedUnit.claims.reported.map(c => c.spaceId)).toEqual([space, second]);
    expect(result.sellableUnits[1]!.claims.reported[0]!.space).toBe(result.spaces[0]!);
    expect(result.sellableUnits[2]!.claims.reported[0]!.claimMode).toBe("positional");
    expect(result.sellableUnits[2]!.claims.reported[0]!.space.capacity).toBe(4);
    for (const key of ["spaceRelations", "listingIdentity", "operatingMode", "availability", "snapshotVersion"] as const)
      expect(result[key].state).toBe("unknown");
    expect(result.timezoneSource).toBe("granted-selection"); expect("attrs" in result.unitTypes[0]!).toBe(false);
    body.sellableUnits[0].spaces.length = 0; expect(result.selectedUnit.claims.reported).toHaveLength(2);
    expect(Object.isFrozen(result.selectedUnit.claims.reported)).toBe(true); expect(Object.isFrozen(result.spaces[0])).toBe(true);
  });
  test("zero claims remain explicitly incomplete and never create a space from a unit ID", () => {
    const body = inventory(); body.sellableUnits[0].spaces = [];
    const result = parseHostInventory(body, selection(), tenant);
    expect(result.selectedUnit.claims).toEqual({ state: "incomplete", reason: "zero-reported-claims", reported: [] });
    expect(result.availability.state).toBe("unknown");
  });
  test("same UUID in separate entity namespaces is joined only through the actual claim", () => {
    const body = inventory(); body.sellableUnits[0].id = space;
    const result = parseHostInventory(body, { ...selection(), sellableUnitId: space }, tenant);
    expect(result.selectedUnit.claims.reported.map(c => c.spaceId)).toEqual([space, second]);
  });
  for (const table of ["unitTypes", "spaces", "sellableUnits"]) {
    test(table + " rejects foreign tenant and sibling/parent property rows", () => {
      for (const field of ["tenantId", "propertyNode"]) {
        const body = inventory(); body[table][0][field] = id(90); bad(() => parseHostInventory(body, selection(), tenant));
      }
    });
    test(table + " rejects duplicate or malformed identities", () => {
      const body = inventory(); body[table].push(structuredClone(body[table][0])); bad(() => parseHostInventory(body, selection(), tenant));
      body[table].pop(); body[table][0].id = "not-a-uuid"; bad(() => parseHostInventory(body, selection(), tenant));
    });
  }
  test("conflicting type parent/code and unknown claimed space fail closed", () => {
    for (const change of [
      (b: any) => { b.sellableUnits[0].unitTypeId = id(99); },
      (b: any) => { b.sellableUnits[0].unitTypeCode = "OTHER"; },
      (b: any) => { b.sellableUnits[0].spaces[0].spaceId = id(99); },
      (b: any) => { b.sellableUnits[0].spaces[0].code = "WRONG"; },
      (b: any) => { b.sellableUnits[0].spaces[0].claimMode = "shared"; },
      (b: any) => { b.sellableUnits[0].spaces.push({ ...b.sellableUnits[0].spaces[0], claimMode: "positional" }); },
    ]) { const body = inventory(); change(body); bad(() => parseHostInventory(body, selection(), tenant)); }
    bad(() => parseHostInventory(inventory(), { ...selection(), unitTypeId: id(77) }, tenant));
  });
  test("missing selected unit and bounded array overflow report incomplete", () => {
    bad(() => parseHostInventory(inventory(), { ...selection(), sellableUnitId: id(77) }, tenant), "incomplete");
    const body = inventory(); body.spaces = Array(HOST_CALENDAR_READ_BOUNDS.spaces + 1).fill(body.spaces[0]);
    bad(() => parseHostInventory(body, selection(), tenant), "incomplete");
  });
  test("malformed/partial/unknown shapes cannot become an empty inventory", () => {
    for (const body of [null, {}, { ...inventory(), spaces: null }, { ...inventory(), limited: true }]) bad(() => parseHostInventory(body, selection(), tenant));
    const body = inventory(); delete body.sellableUnits[0].spaces; bad(() => parseHostInventory(body, selection(), tenant));
    const getter = inventory(); Object.defineProperty(getter, "spaces", { enumerable: true, get() { throw new Error("must not invoke accessor"); } });
    bad(() => parseHostInventory(getter, selection(), tenant));
  });
  test("positive capacities, type occupancy ordering and exact decimal area are validated", () => {
    for (const change of [(b: any) => { b.spaces[0].capacity = 0; }, (b: any) => { b.spaces[0].capacity = 1.5; },
      (b: any) => { b.unitTypes[0].baseOccupancy = 5; }, (b: any) => { b.spaces[0].areaSqm = 22.5; }]) {
      const body = inventory(); change(body); bad(() => parseHostInventory(body, selection(), tenant));
    }
  });
  test("claim array accessors are rejected without invoking them", () => {
    const body = inventory(); let invoked = false;
    Object.defineProperty(body.sellableUnits[0].spaces, "0", { enumerable: true, get() { invoked = true; throw new Error("untrusted accessor"); } });
    bad(() => parseHostInventory(body, selection(), tenant)); expect(invoked).toBe(false);
  });
});
describe("Order758 type-level price provenance", () => {
  test("preserves bigint minor amounts, currency, all occupancy bands and record/effective identity", () => {
    const result = parseHostRatePrice(price(), selection(), tenant);
    expect(result.scope).toBe("unit-type"); expect(result.occupancy["2"]).toBe(9007199254740993n);
    expect(result.occupancy["3"]).toBe(9223372036854775807n); expect(result.currency).toBe("INR");
    expect(result.selectedTier).toEqual({ state: "known", scope: "unit-type-occupancy-tier", amountMinor: 9007199254740993n, currency: "INR" });
    expect(result.extraAdultMinor).toBe(15000n); expect(result.extraChildren[1]).toEqual({ maxAge: 17, amountMinor: 2500n });
    expect(result.version).toEqual({ kind: "record-id-and-recorded-at", id: id(8), recordedAt: "2024-02-29T20:00:00.123Z", supersededBy: null });
    expect([result.stayStart, result.stayEndExclusive, result.dowMask]).toEqual(["2024-03-01", "2024-04-01", 64]);
    expect(result.effectiveSource).toBe("latest-unsuperseded-record-for-type-plan-date");
    for (const key of ["unitPrice", "channelApplicability", "taxInclusion", "fees", "availability", "smartPricing", "policyTerms"] as const)
      expect(result[key].state).toBe("unknown");
    expect("sellableUnitId" in result).toBe(false); expect("taxInclusive" in result).toBe(false);
    expect(Object.isFrozen(result.occupancy)).toBe(true); expect(Object.isFrozen(result.extraChildren[0])).toBe(true);
  });
  test("missing tier is unknown without interpolation or extra-adult inference", () => {
    const pick = selection(); const result = parseHostRatePrice(price(), { ...pick, price: { ...pick.price!, occupancy: 4 } }, tenant);
    expect(result.selectedTier).toEqual({ state: "unknown", reason: "requested-occupancy-tier-not-returned", source: "rate-price" });
  });
  for (const amount of [1, 9007199254740992, "01", "-1", "1.5", "1e3", "9223372036854775808", null]) {
    test("rejects noncanonical/unsafe amount " + String(amount), () => {
      const body = price(); body.ratePrice.pricing.occupancy["2"] = amount; bad(() => parseHostRatePrice(body, selection(), tenant));
    });
  }
  test("foreign parent/type/plan, superseded row and bad currency/version are rejected", () => {
    for (const [field, value] of [["tenantId", id(90)], ["propertyNode", id(90)], ["unitTypeId", id(90)], ["ratePlanId", id(90)],
      ["supersededBy", id(90)], ["currency", "inr"], ["recordedAt", "2024-02-30T00:00:00.000Z"], ["recordedAt", "2024-03-01T00:00:00Z"]]) {
      const body = price(); body.ratePrice[field as string] = value; bad(() => parseHostRatePrice(body, selection(), tenant));
    }
  });
  test("ISO Monday-bit mask, exclusive stay end and real calendar dates are enforced", () => {
    for (const [field, value] of [["dowMask", 1], ["dowMask", 0], ["dowMask", 128], ["stayEnd", "2024-03-10"], ["stayStart", "2024-03-11"], ["stayStart", "2024-02-30"]]) {
      const body = price(); body.ratePrice[field as string] = value; bad(() => parseHostRatePrice(body, selection(), tenant));
    }
    const pick = selection(); const body = price(); body.ratePrice.dowMask = 1;
    expect(parseHostRatePrice(body, { ...pick, price: { ...pick.price!, stayDate: "2024-03-11" } }, tenant).dowMask).toBe(1);
  });
  test("occupancy key and child band constraints reject ambiguous prices", () => {
    for (const change of [(b: any) => { b.ratePrice.pricing.occupancy = { "01": "1" }; },
      (b: any) => { b.ratePrice.pricing.occupancy = { "101": "1" }; }, (b: any) => { b.ratePrice.pricing.occupancy = {}; },
      (b: any) => { b.ratePrice.pricing.extraChildren[1].maxAge = 5; }, (b: any) => { b.ratePrice.pricing.extraChildren[0].maxAge = -1; },
      (b: any) => { b.ratePrice.pricing.extraAdultMinor = "-1"; }]) {
      const body = price(); change(body); bad(() => parseHostRatePrice(body, selection(), tenant));
    }
  });
  test("null/partial/current-price shapes and unsolicited quote fields are rejected", () => {
    for (const body of [null, {}, { ratePrice: null }, { ...price(), taxInclusive: true }]) bad(() => parseHostRatePrice(body, selection(), tenant));
    const body = price(); delete body.ratePrice.pricing.extraChildren; bad(() => parseHostRatePrice(body, selection(), tenant));
  });
});
test("selection is explicit, bounded, immutable and does not infer defaults", () => {
  for (const change of [(s: any) => { delete s.price; }, (s: any) => { s.propertyId = "../other"; },
    (s: any) => { s.timezone = "not/timezone"; }, (s: any) => { s.price.occupancy = 0; },
    (s: any) => { delete s.price.channelCode; }, (s: any) => { s.price.stayDate = "2024-02-30"; },
    (s: any) => { s.price.dates = ["2024-03-10"]; }]) {
    const pick = selection(); change(pick); bad(() => validateHostCalendarSelection(pick), "invalid-selection");
  }
  const pick = selection(), checked = validateHostCalendarSelection(pick); expect(Object.isFrozen(checked.price)).toBe(true);
  expect(validateHostCalendarSelection({ ...pick, price: null }).price).toBeNull();
  expect(validateHostCalendarSelection({ ...pick, price: { ...pick.price!, channelCode: null } }).price!.channelCode).toBeNull();
});
