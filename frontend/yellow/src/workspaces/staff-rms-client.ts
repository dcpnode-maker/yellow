import { propertyLocalDateTimeToIso, createStaffReadClient, snapshotStaffDraft, STAFF_UUID, StaffModuleError, staffRecord, staffCount,
  staffMinor, staffCurrency, type StaffClientOptions, type StaffSearchDraft } from "./staff-crs-client";

export type StaffRateModel = Readonly<{ key: string; version: number; label: string; description: string; capabilities: readonly string[] }>;
export type StaffRateBuilder = Readonly<{ catalogue: readonly StaffRateModel[]; modelDraftCount: number; targetDraftCount: number; releaseCount: number }>;
export type StaffRateQuote = Readonly<{ state: string; reason: string | null; currency: string; quoteHash: string | null;
  components: Readonly<Record<string, string | null>>; taxAssignmentState: string | null }>;
export type StaffEconomics = Readonly<{ name: string; businessDate: string; currency: string; roomNights: number;
  roomsAvailable: number; occupancyBasisPoints: number; roomRevenueMinor: string; adrMinor: string; revparMinor: string }>;
const MONEY_KEYS = ["roomAmountMinor", "includedAllocationMinor", "packageExtraMinor", "promotionDiscountMinor", "preTaxSubtotalMinor"] as const;
function invalid(): never { throw new StaffModuleError("The RMS response does not match the requested scope or evidence."); }
export function parseStaffRateBuilder(value: unknown, propertyId: string, planId: string): StaffRateBuilder {
  if (!staffRecord(value) || !Array.isArray(value.catalogue) || !Array.isArray(value.modelDrafts) || !Array.isArray(value.targetDrafts) || !Array.isArray(value.releases)) invalid();
  const keys = new Set<string>();
  const catalogue = value.catalogue.map((item: unknown) => {
    if (!staffRecord(item) || typeof item.key !== "string" || keys.has(item.key) || item.version !== 1 ||
        typeof item.label !== "string" || typeof item.description !== "string" || !Array.isArray(item.capabilities) ||
        item.capabilities.some(capability => typeof capability !== "string")) invalid();
    keys.add(item.key);
    return Object.freeze({ key: item.key, version: item.version, label: item.label, description: item.description,
      capabilities: Object.freeze(item.capabilities as string[]) });
  });
  for (const item of [...value.modelDrafts, ...value.targetDrafts, ...value.releases]) {
    if (!staffRecord(item) || typeof item.id !== "string" || !STAFF_UUID.test(item.id) || item.propertyNode !== propertyId || item.ratePlanId !== planId) invalid();
  }
  // Authoring commands and release contents are intentionally never returned to this read-only surface.
  return Object.freeze({ catalogue: Object.freeze(catalogue), modelDraftCount: value.modelDrafts.length,
    targetDraftCount: value.targetDrafts.length, releaseCount: value.releases.length });
}
export function parseStaffRateQuote(value: unknown, propertyId: string, planId: string, unitId: string, timezone: string,
  draft: StaffSearchDraft): StaffRateQuote {
  if (!staffRecord(value) || !staffRecord(value.quote)) invalid();
  const q = value.quote;
  if (q.propertyNode !== propertyId || q.ratePlanId !== planId || q.sellableUnitId !== unitId || q.propertyTimeZone !== timezone ||
      q.stayStartDate !== draft.arrivalDate || q.stayEndDate !== draft.departureDate || !staffRecord(q.result)) invalid();
  const result = q.result;
  if (!staffRecord(result.guests) || result.guests.adults !== draft.adults || !Array.isArray(result.guests.childAges) ||
      result.guests.childAges.length !== draft.childAges.length || result.guests.childAges.some((age, index) => age !== draft.childAges[index]) ||
      !staffRecord(result.distributionEvidence) || result.distributionEvidence.channelCode !== draft.channelCode) invalid();
  if (!["quoted", "unpriced", "blocked", "conflict"].includes(String(result.state)) || !(result.reason === null || typeof result.reason === "string") ||
      !staffCurrency(result.currency)) invalid();
  const components: Record<string, string | null> = {};
  for (const key of MONEY_KEYS) {
    const amount = result[key]; if (!(amount === null || staffMinor(amount))) invalid();
    components[key] = amount as string | null;
  }
  return Object.freeze({ state: String(result.state), reason: result.reason as string | null, currency: result.currency,
    quoteHash: typeof q.quoteHash === "string" ? q.quoteHash : null, components: Object.freeze(components),
    taxAssignmentState: typeof q.taxAssignmentState === "string" ? q.taxAssignmentState : null });
}
export function parseStaffEconomics(value: unknown, propertyName: string): StaffEconomics {
  if (!staffRecord(value) || value.provenance !== "stats_daily_commercial_taxonomy" || !staffRecord(value.property) ||
      value.property.name !== propertyName || typeof value.property.businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.property.businessDate) ||
      !staffCurrency(value.property.currency) || !staffRecord(value.total)) invalid();
  const total = value.total;
  if (![total.roomNights, total.roomsAvailable, total.occupancyBasisPoints].every(staffCount) || Number(total.occupancyBasisPoints) > 10_000 ||
      ![total.roomRevenueMinor, total.adrMinor, total.revparMinor].every(staffMinor)) invalid();
  return Object.freeze({ name: propertyName, businessDate: value.property.businessDate, currency: value.property.currency,
    roomNights: Number(total.roomNights), roomsAvailable: Number(total.roomsAvailable), occupancyBasisPoints: Number(total.occupancyBasisPoints),
    roomRevenueMinor: String(total.roomRevenueMinor), adrMinor: String(total.adrMinor), revparMinor: String(total.revparMinor) });
}
export function createStaffRmsClient(options: StaffClientOptions = {}) {
  const client = createStaffReadClient(options);
  const path = (property: string, plan: string) => {
    if (!STAFF_UUID.test(property) || !STAFF_UUID.test(plan)) throw new StaffModuleError("Choose a configured rate plan.");
    return `/api/v1/properties/${property}/rate-builder/${plan}`;
  };
  return Object.freeze({
    properties: client.properties,
    async builder(property: string, plan: string, signal?: AbortSignal) {
      const response = await client.read(path(property, plan), [property], () => ({}), signal);
      return parseStaffRateBuilder(response.value, property, plan);
    },
    async quote(property: string, plan: string, unit: string, proposal: StaffSearchDraft, signal?: AbortSignal) {
      if (!STAFF_UUID.test(unit)) throw new StaffModuleError("Choose a configured sellable unit.");
      const draft = snapshotStaffDraft(proposal);
      const response = await client.read(`${path(property, plan)}/quotes:resolve`, [property], properties => ({ method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ sellableUnitId: unit,
          stayStart: propertyLocalDateTimeToIso(draft.arrivalDate, "15:00", properties[0]!.timezone),
          stayEnd: propertyLocalDateTimeToIso(draft.departureDate, "11:00", properties[0]!.timezone),
          guests: { adults: draft.adults, childAges: [...draft.childAges] }, selectedPromotionCodes: [], commercial: {}, channelCode: draft.channelCode }) }), signal);
      return parseStaffRateQuote(response.value, property, plan, unit, response.properties[0]!.timezone, draft);
    },
    async economics(property: string, signal?: AbortSignal) {
      const response = await client.read(`/api/v1/properties/${property}/commercial-contribution`, [property], () => ({}), signal);
      return parseStaffEconomics(response.value, response.properties[0]!.name);
    },
  });
}
