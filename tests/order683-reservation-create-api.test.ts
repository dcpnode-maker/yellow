import { describe, expect, test } from "bun:test";

Object.assign(globalThis, { window: { location: { pathname: "/p/property-a/reservations", search: "" } } });
const apiModulePath = "../frontend/yellow/src/yellow-api.tsx";
const api = await import(apiModulePath);
const originalFetch = globalThis.fetch;

function offer(overrides: Record<string, unknown> = {}) {
  return {
    option_ref: "offer:timestamp-a", bookable: true, promise: false, commit_arbitration_required: true,
    sellable_unit: { id: "room-a", name: "Room A" },
    unit_type: { id: "type-a", code: "DLX", name: "Deluxe", profile_key: "hotel", max_occupancy: 2 },
    rate_plan: { id: "plan-a", code: "BAR", name: "Best available", currency: "SAR", tax_inclusive: false },
    available_count: 1, stay: { from: "2026-09-25T12:00:00.000Z", to: "2026-09-27T08:00:00.000Z" },
    total: { amount_minor: "250000", currency: "SAR", kind: "pre_tax" },
    release: { id: "release-a", version: 1, content_hash: "hash-a" },
    policies: { cancellation: { policy_id: "policy-a", evidence_ref: "policy:a" }, deposit: null, guarantee: null, no_show: null },
    per_night: [{ date: "2026-09-25", amount_minor: "125000" }, { date: "2026-09-26", amount_minor: "125000" }],
    taxes: [], tax_assignment_state: "not_required", tax_preview: null,
    package: null, selected_promotion_codes: [], applied_promotion_codes: [], refund_treatment: null,
    restrictions_applied: [], operational_blocks_applied: [], party: { adults: 1, child_ages: [] },
    evidence: { quote_hash: "timestamp-a", availability_ref: "availability:a", booking_instant: "2026-09-24T12:00:00.000Z" },
    ...overrides,
  };
}

function mockSearch(...options: ReturnType<typeof offer>[]) {
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url === "/api/v1/auth/demo:enter") return Response.json({ accessToken: "synthetic-token" });
    if (url.endsWith("/availability:search")) return Response.json({ options });
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  return requests;
}

const searchInput = { from: "2026-09-25T12:00:00.000Z", to: "2026-09-27T08:00:00.000Z", adults: 1, childAges: [], channelCode: "direct" };

describe.serial("Order683 actual offer HTTP mapping and receipt checks", () => {
  test("fresh receipt/hash/timestamp can vary while stable selection and rich terms agree", async () => {
    const first = offer();
    const next = offer({ option_ref: "offer:timestamp-b", evidence: { quote_hash: "timestamp-b", availability_ref: "availability:b", booking_instant: "2026-09-24T12:01:00.000Z" } });
    try {
      const requests = mockSearch(first);
      const [oldOffer] = await api.searchReservationOffers(searchInput);
      mockSearch(next);
      const [newOffer] = await api.searchReservationOffers(searchInput);
      expect(requests.some(url => url.endsWith("/availability:search"))).toBe(true);
      expect(oldOffer!.optionRef).not.toBe(newOffer!.optionRef);
      expect(api.sameReservationOffer(oldOffer!, newOffer!)).toBe(true);
    } finally { globalThis.fetch = originalFetch; }
  });

  test("changed price, policy or release remains a review-required offer", async () => {
    try {
      mockSearch(offer());
      const [original] = await api.searchReservationOffers(searchInput);
      for (const changed of [
        offer({ option_ref: "offer:new", total: { amount_minor: "260000", currency: "SAR", kind: "pre_tax" } }),
        offer({ option_ref: "offer:new", policies: { cancellation: { policy_id: "policy-b", evidence_ref: "policy:b" } } }),
        offer({ option_ref: "offer:new", release: { id: "release-a", version: 2, content_hash: "hash-b" } }),
      ]) {
        mockSearch(changed);
        const [refreshed] = await api.searchReservationOffers(searchInput);
        expect(api.sameReservationOffer(original!, refreshed!)).toBe(false);
      }
      mockSearch(offer({ policies: undefined }));
      await expect(api.searchReservationOffers(searchInput)).rejects.toThrow("missing commercial evidence");
    } finally { globalThis.fetch = originalFetch; }
  });

  test("authoritative due-in detail reconciles 6-digit timestamps but not different microseconds", async () => {
    try {
      mockSearch(offer());
      const [selected] = await api.searchReservationOffers(searchInput);
      const receipt = { reservationId: "reservation-a", confirmationNo: "R-683", status: "reserved" };
      const evidence = { primaryPartyId: "guest-a", offer: selected!, adults: 1, childAges: [], channelCode: "direct" };
      const detail = { reservation: {
        reservationId: "reservation-a", confirmationNo: "R-683", status: "due_in", primaryPartyId: "guest-a", channelCode: "direct",
        segments: [{ sellableUnitId: "room-a", ratePlanId: "plan-a", from: "2026-09-25T12:00:00.000000Z", to: "2026-09-27T08:00:00.000000Z", adults: 1, childAges: [] }],
      } };
      expect(api.reservationMatchesCreateReceipt(detail as never, receipt, evidence)).toBe(true);
      const altered = { reservation: { ...detail.reservation, segments: [{ ...detail.reservation.segments[0], to: "2026-09-27T08:00:00.000001Z" }] } };
      expect(api.reservationMatchesCreateReceipt(altered as never, receipt, evidence)).toBe(false);
    } finally { globalThis.fetch = originalFetch; }
  });
});
