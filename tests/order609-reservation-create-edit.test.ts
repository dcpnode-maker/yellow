import { expect, test } from "bun:test";

import { reservationOperationFor } from "../src/overwatch";

Object.assign(globalThis, {
  window: { location: { pathname: "/p/property-a/reservations", search: "" } },
});
const apiModulePath = "../frontend/yellow/src/yellow-api.tsx";
const api = await import(apiModulePath);

const offer = Object.freeze({
  optionRef: "offer-1",
  sellableUnitId: "unit-1",
  sellableUnitName: "Deluxe King",
  unitTypeCode: "DLX",
  ratePlanId: "rate-1",
  ratePlanCode: "BAR",
  availableCount: 3,
  promise: false as const,
  commitArbitrationRequired: true as const,
  stay: Object.freeze({ from: "2026-10-01T09:30:00.000Z", to: "2026-10-03T05:30:00.000Z" }),
  total: Object.freeze({ amountMinor: "420000", currency: "INR", kind: "stay_total" }),
});

test("exposes duplicate Party evidence without merging canonical identities", () => {
  const profiles = [
    { partyId: "party-b", displayName: "Asha Rao", legalName: null, kind: "person", status: "active", roles: ["guest"], contacts: [] },
    { partyId: "party-a", displayName: "  ASHA   RAO ", legalName: null, kind: "person", status: "active", roles: ["guest"], contacts: [] },
    { partyId: "party-c", displayName: "Dev Shah", legalName: null, kind: "person", status: "active", roles: ["guest"], contacts: [] },
  ] as const;
  expect(api.duplicatePartyEvidence(profiles)).toEqual([{
    normalizedName: "asha rao",
    displayName: "Asha Rao",
    partyIds: ["party-a", "party-b"],
  }]);
  expect(profiles).toHaveLength(3);
});

test("shows success only when the authoritative reservation matches the create receipt", () => {
  const receipt = { reservationId: "reservation-1", confirmationNo: "Y-101", status: "reserved" };
  const evidence = { primaryPartyId: "party-a", offer, adults: 2, childAges: [7], channelCode: "direct" };
  const detail = {
    reservation: {
      reservationId: "reservation-1", confirmationNo: "Y-101", status: "reserved",
      primaryPartyId: "party-a", channelCode: "direct",
      segments: [{ sellableUnitId: "unit-1", ratePlanId: "rate-1", from: offer.stay.from, to: offer.stay.to, adults: 2, childAges: [7] }],
    },
  };
  expect(api.reservationMatchesCreateReceipt(detail as never, receipt, evidence)).toBe(true);
  expect(api.reservationMatchesCreateReceipt({ ...detail, reservation: { ...detail.reservation, primaryPartyId: "party-z" } } as never, receipt, evidence)).toBe(false);
  expect(api.sameReservationOffer(offer, { ...offer, total: { ...offer.total, amountMinor: "430000" } })).toBe(false);
});

test("Overwatch routes multilingual create/edit requests into the real reservation workspace", () => {
  expect(reservationOperationFor("Create a new reservation")).toBe("create");
  expect(reservationOperationFor("नई बुकिंग बनाओ")).toBe("create");
  expect(reservationOperationFor("Edit reservation")).toBe("edit");
  expect(reservationOperationFor("Show today's arrivals")).toBeNull();
});

test("the active App runtime delegates reservation work to the modular workspace", async () => {
  const source = await Bun.file("frontend/yellow/src/App.tsx").text();
  const workspace = await Bun.file("frontend/yellow/src/workspaces/ReservationWorkspace.tsx").text();
  expect(source).toContain("function LegacyReservationWorkspace(");
  expect(source).toContain("function LegacyReservationCreateWorkspace(");
  expect(source).toContain("function LegacyReservationBoardWorkspace(");
  expect(workspace).toContain("Reconcile same request");
  expect(workspace).toContain("reservationMatchesCreateReceipt(authoritative, result, evidence)");
  expect(workspace).toContain("Possible duplicate profiles");
  expect(workspace).toContain("All required fields present");
  expect(workspace).toContain("sameReservationOffer(offer, refreshedOffer)");
  expect(workspace).toContain("if (generation !== offerSearchGeneration.current) return;");
  expect(workspace).toContain("if (generation === offerSearchGeneration.current) setWorking(false);");
  expect(source).toContain("reservationCreationVoiceIntent(message)");
  expect(source).toContain("reservationCreate: true");
  expect(source).toContain("<ReservationCreateWorkspace");
});
