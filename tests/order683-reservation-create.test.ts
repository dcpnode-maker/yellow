import { expect, test } from "bun:test";
import { reservationOfferTerms, sameReservationSelection } from "../frontend/yellow/src/reservation-create";
const terms = () => ({ option_ref: "offer:old", evidence: { booking_instant: "2026-09-24T12:00:00Z" },
  release: { id: "release", version: 1, content_hash: "release-hash" },
  policies: { cancellation: { policy_id: "policy", evidence_ref: "v1" }, deposit: null, guarantee: null, no_show: null },
  per_night: [{ date: "2026-09-25", amount_minor: "250000" }], taxes: [], tax_assignment_state: "not_required",
  tax_preview: null, package: null, selected_promotion_codes: [], applied_promotion_codes: [],
  refund_treatment: null, restrictions_applied: [], operational_blocks_applied: [], party: { adults: 1, child_ages: [] },
  rate_plan: { id: "plan", currency: "SAR", tax_inclusive: false }, unit_type: { id: "type" } });

test("refreshed receipt/time does not change unchanged commercial terms", () => {
  const first = terms();
  const next = { ...terms(), option_ref: "offer:new", evidence: { booking_instant: "2026-09-24T12:01:00Z" } };
  expect(first.option_ref === next.option_ref).toBe(false); // reproduces the old matching defect
  expect(reservationOfferTerms(first)).toBe(reservationOfferTerms(next));
  expect(reservationOfferTerms({ ...next, rate_plan: { tax_inclusive: false, currency: "SAR", id: "plan" } })).toBe(reservationOfferTerms(first));
});
test("policy, release, per-night, tax and promotion changes still require review", () => {
  for (const change of [{ policies: {} }, { release: { version: 2 } }, { per_night: [{ amount_minor: "260000" }] },
    { tax_preview: { total: "3000" } }, { applied_promotion_codes: ["NEW"] }, { party: { adults: 2 } }]) {
    expect(reservationOfferTerms({ ...terms(), ...change })).not.toBe(reservationOfferTerms(terms()));
  }
  const missing: Record<string, unknown> = terms(); delete missing.policies;
  expect(() => reservationOfferTerms(missing)).toThrow("missing commercial evidence");
});
test("stable selection compares exact instants without losing microseconds", () => {
  const base = { sellableUnitId: "room", ratePlanId: "rate", stay: { from: "2026-09-25T12:00:00.000Z", to: "2026-09-27T08:00:00.000Z" } };
  expect(sameReservationSelection(base, { ...base, stay: { ...base.stay, from: "2026-09-25T12:00:00.000000Z" } })).toBe(true);
  expect(sameReservationSelection(base, { ...base, stay: { ...base.stay, from: "2026-09-25T12:00:00.000001Z" } })).toBe(false);
  expect(sameReservationSelection(base, { ...base, sellableUnitId: "other" })).toBe(false);
});
