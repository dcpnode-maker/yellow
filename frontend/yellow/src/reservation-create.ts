import { sameRecordedInstant } from "./reservation-departure-change";

/** Canonical commercial terms, not a timestamp-bearing search receipt ID. */
export function reservationOfferTerms(raw: Readonly<Record<string, unknown>>): string {
  const required = ["release", "policies", "per_night", "taxes", "tax_assignment_state", "tax_preview",
    "package", "selected_promotion_codes", "applied_promotion_codes", "refund_treatment",
    "restrictions_applied", "operational_blocks_applied", "party", "rate_plan", "unit_type"];
  if (required.some(key => !Object.hasOwn(raw, key))) {
    throw new Error("The current offer is missing commercial evidence. Refresh offers before booking.");
  }
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]));
    }
    return value;
  };
  return JSON.stringify(canonical(Object.fromEntries(required.map(key => [key, raw[key]]))));
}

type OfferSelection = Readonly<{
  sellableUnitId: string; ratePlanId: string; stay: Readonly<{ from: string; to: string }>;
}>;

export function sameReservationSelection(left: OfferSelection, right: OfferSelection): boolean {
  return left.sellableUnitId === right.sellableUnitId && left.ratePlanId === right.ratePlanId &&
    sameRecordedInstant(left.stay.from, right.stay.from) && sameRecordedInstant(left.stay.to, right.stay.to);
}
