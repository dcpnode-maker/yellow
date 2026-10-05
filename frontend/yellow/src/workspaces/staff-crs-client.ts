import { reactAuthSession, type GrantedProperty } from "../auth-session";

// Exact pure clock/offer closure from the unchanged yellow-api; avoids importing its document-bound runtime into read-only clients.
export function propertyLocalDateTimeToIso(
  date: string,
  time: string,
  timezone: string,
): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite))
    throw new Error("Choose valid property-local stay dates.");
  const desired = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0, 0);
  let instant = desired;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant));
    const value = (kind: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === kind)?.value ?? Number.NaN);
    const observed = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    instant = desired - (observed - instant);
  }
  return new Date(instant).toISOString();
}
export type ReservationOffer = Readonly<{
  optionRef: string;
  sellableUnitId: string;
  sellableUnitName: string;
  unitTypeCode: string;
  ratePlanId: string;
  ratePlanCode: string;
  availableCount: number;
  promise: false;
  commitArbitrationRequired: true;
  stay: Readonly<{ from: string; to: string }>;
  total: Readonly<{ amountMinor: string; currency: string; kind: string }>;
}>;

export const STAFF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const REFERENCE = /^[A-Za-z0-9._:-]{1,512}$/;
export type StaffSearchDraft = Readonly<{ arrivalDate: string; departureDate: string; adults: number;
  childAges: readonly number[]; channelCode: string }>;
export type StaffReservationDraft = StaffSearchDraft & Readonly<{ optionRef: string }>;
export type StaffCrsResult = Readonly<{ property: GrantedProperty; offers: readonly ReservationOffer[];
  blocked: number; unpriced: number; conflicted: number }>;
export type StaffClientOptions = Readonly<{ fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  session?: () => Promise<string>; grants?: () => Promise<readonly GrantedProperty[]> }>;
export class StaffModuleError extends Error {
  constructor(message: string, readonly status: number | null = null) { super(message); this.name = "StaffModuleError"; }
}
export function staffRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function staffCount(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
export function staffMinor(value: unknown): value is string { return typeof value === "string" && /^-?(?:0|[1-9]\d{0,18})$/.test(value); }
export function staffCurrency(value: unknown): value is string { return typeof value === "string" && /^[A-Z]{3}$/.test(value); }
function validDate(value: string): boolean {
  return DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function snapshotStaffDraft(draft: StaffSearchDraft): StaffSearchDraft {
  if (!validDate(draft.arrivalDate) || !validDate(draft.departureDate) || draft.arrivalDate >= draft.departureDate ||
      !Number.isSafeInteger(draft.adults) || draft.adults < 1 || draft.adults > 20 ||
      !Array.isArray(draft.childAges) || draft.childAges.length > 30 ||
      draft.childAges.some(age => !Number.isSafeInteger(age) || age < 0 || age > 17) || !CHANNEL.test(draft.channelCode)) {
    throw new StaffModuleError("Choose valid stay dates, adults, child ages and channel.");
  }
  return Object.freeze({ ...draft, childAges: Object.freeze([...draft.childAges]) });
}
export function buildStaffCrsBody(properties: readonly GrantedProperty[], proposal: StaffSearchDraft) {
  const draft = snapshotStaffDraft(proposal);
  if (properties.length < 1 || properties.length > 4 || new Set(properties.map(p => p.id)).size !== properties.length ||
      properties.some(p => !STAFF_UUID.test(p.id))) throw new StaffModuleError("Choose one to four distinct granted properties.");
  return { searches: properties.map(property => ({ property_id: property.id, search: {
    stay: { from: propertyLocalDateTimeToIso(draft.arrivalDate, "15:00", property.timezone),
      to: propertyLocalDateTimeToIso(draft.departureDate, "11:00", property.timezone) },
    party: { adults: draft.adults, children: draft.childAges.map(age => ({ age })) }, channel: draft.channelCode,
  } })) };
}
function aborted(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException("The search was cancelled.", "AbortError"); }

/** A read-only transport: current memory bearer and fresh granted properties bind every response. */
export function createStaffReadClient(options: StaffClientOptions = {}) {
  const transport = options.fetch ?? ((url, init) => fetch(url, init));
  const session = options.session ?? reactAuthSession.session;
  const grants = options.grants ?? reactAuthSession.grantedProperties;
  async function current(token: string, signal?: AbortSignal) {
    aborted(signal);
    if (await session() !== token) throw new StaffModuleError("The account or session changed. Search again.");
    aborted(signal);
  }
  async function properties(signal?: AbortSignal): Promise<readonly GrantedProperty[]> {
    const token = await session(); aborted(signal);
    const value = await grants(); await current(token, signal);
    return Object.freeze(value.map(property => Object.freeze({ ...property })));
  }
  async function read(path: string, ids: readonly string[], init: (properties: readonly GrantedProperty[]) => RequestInit,
    signal?: AbortSignal): Promise<Readonly<{ value: unknown; properties: readonly GrantedProperty[] }>> {
    const selectedIds = Object.freeze([...ids]);
    if (!path.startsWith("/api/v1/") || selectedIds.length < 1 || selectedIds.length > 4 ||
        selectedIds.some(id => !STAFF_UUID.test(id)) || new Set(selectedIds).size !== selectedIds.length) throw new StaffModuleError("Invalid staff search scope.");
    const token = await session(); aborted(signal);
    const available = await grants(); await current(token, signal);
    const selected = selectedIds.map(id => available.find(property => property.id === id));
    if (selected.some(property => !property)) throw new StaffModuleError("Access to a selected property is no longer granted.", 403);
    const properties = Object.freeze((selected as GrantedProperty[]).map(property => Object.freeze({ ...property })));
    const request = init(properties);
    if (typeof request.body === "string" && new TextEncoder().encode(request.body).length > 16_384) throw new StaffModuleError("Narrow the staff search request.");
    const headers = new Headers(request.headers); headers.set("authorization", `Bearer ${token}`);
    const response = await transport(path, { ...request, headers, signal, credentials: "omit", cache: "no-store" });
    await current(token, signal);
    if (!response.ok) throw new StaffModuleError(response.status === 403 ? "This account is not granted access to this staff operation." :
      "The staff operation is unavailable. No result has been inferred.", response.status);
    const text = await response.text(); await current(token, signal);
    if (new TextEncoder().encode(text).length > 1_048_576) throw new StaffModuleError("The staff response exceeded its bound.");
    let value: unknown; try { value = JSON.parse(text); } catch { throw new StaffModuleError("The server result could not be verified."); }
    return { value, properties };
  }
  return Object.freeze({ read, properties });
}
export function parseStaffCrsResults(value: unknown, properties: readonly GrantedProperty[], draft: StaffSearchDraft): readonly StaffCrsResult[] {
  if (!staffRecord(value) || !Array.isArray(value.properties) || value.properties.length !== properties.length) throw new StaffModuleError("The CRS property result is incoherent.");
  const expected = buildStaffCrsBody(properties, draft);
  return Object.freeze(value.properties.map((row: unknown, index) => {
    const property = properties[index]!; const stay = expected.searches[index]!.search.stay;
    if (!staffRecord(row) || row.property_id !== property.id || row.property_name !== property.name || row.time_zone !== property.timezone ||
        !staffRecord(row.result) || !Array.isArray(row.result.options) || row.result.options.length > 5000 || !staffRecord(row.result.summary)) {
      throw new StaffModuleError("The CRS result does not match the selected property.");
    }
    const summary = row.result.summary;
    if (![summary.blocked, summary.unpriced, summary.conflicted, summary.bookable].every(staffCount)) throw new StaffModuleError("The CRS summary is incoherent.");
    const refs = new Set<string>();
    const offers: ReservationOffer[] = [];
    for (const item of row.result.options) {
      if (!staffRecord(item) || typeof item.bookable !== "boolean" || item.promise !== false || item.commit_arbitration_required !== true) throw new StaffModuleError("The CRS availability evidence is incoherent.");
      if (!item.bookable) continue;
      if (typeof item.option_ref !== "string" || !REFERENCE.test(item.option_ref) || refs.has(item.option_ref) ||
          !staffRecord(item.sellable_unit) || typeof item.sellable_unit.id !== "string" || !STAFF_UUID.test(item.sellable_unit.id) || typeof item.sellable_unit.name !== "string" ||
          !staffRecord(item.unit_type) || typeof item.unit_type.code !== "string" || !staffRecord(item.rate_plan) || typeof item.rate_plan.id !== "string" || !STAFF_UUID.test(item.rate_plan.id) || typeof item.rate_plan.code !== "string" ||
          !staffCount(item.available_count) || !staffRecord(item.stay) || item.stay.from !== stay.from || item.stay.to !== stay.to ||
          !staffRecord(item.party) || item.party.adults !== draft.adults || !Array.isArray(item.party.child_ages) ||
          item.party.child_ages.length !== draft.childAges.length || item.party.child_ages.some((age, index) => age !== draft.childAges[index]) ||
          !staffRecord(item.total) || !staffMinor(item.total.amount_minor) || !staffCurrency(item.total.currency) || typeof item.total.kind !== "string") {
        throw new StaffModuleError("The CRS offer does not match the requested stay.");
      }
      refs.add(item.option_ref);
      offers.push(Object.freeze({ optionRef: item.option_ref, sellableUnitId: item.sellable_unit.id, sellableUnitName: item.sellable_unit.name,
        unitTypeCode: item.unit_type.code, ratePlanId: item.rate_plan.id, ratePlanCode: item.rate_plan.code,
        availableCount: item.available_count, promise: false, commitArbitrationRequired: true,
        stay: Object.freeze({ from: stay.from, to: stay.to }),
        total: Object.freeze({ amountMinor: item.total.amount_minor, currency: item.total.currency, kind: item.total.kind }) }));
    }
    if (offers.length !== summary.bookable) throw new StaffModuleError("The CRS offer count is incoherent.");
    return Object.freeze({ property, offers: Object.freeze(offers), blocked: Number(summary.blocked), unpriced: Number(summary.unpriced), conflicted: Number(summary.conflicted) });
  }));
}
export function createStaffCrsClient(options: StaffClientOptions = {}) {
  const client = createStaffReadClient(options);
  async function search(ids: readonly string[], proposal: StaffSearchDraft, signal?: AbortSignal) {
    const draft = snapshotStaffDraft(proposal);
    const result = await client.read("/api/v1/crs/availability:search", ids, properties => ({ method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(buildStaffCrsBody(properties, draft)) }), signal);
    return parseStaffCrsResults(result.value, result.properties, draft);
  }
  return Object.freeze({ search, properties: client.properties });
}
export function staffCrsReservationHref(result: StaffCrsResult, offer: ReservationOffer, proposal: StaffSearchDraft): string {
  const draft = snapshotStaffDraft(proposal);
  if (!result.offers.includes(offer) || !STAFF_UUID.test(result.property.id) || !REFERENCE.test(offer.optionRef)) throw new StaffModuleError("Choose one current CRS offer.");
  const query = new URLSearchParams({ create: "crs", from: draft.arrivalDate, to: draft.departureDate,
    adults: String(draft.adults), child_ages: draft.childAges.join(","), channel: draft.channelCode, option_ref: offer.optionRef });
  return `/p/${result.property.id}/reservations?${query}`;
}
export function readStaffCrsReservationDraft(search: string): StaffReservationDraft | null {
  try {
    if (search.length > 4096) return null;
    const params = new URLSearchParams(search); const keys = ["create", "from", "to", "adults", "child_ages", "channel", "option_ref"];
    if (params.get("create") !== "crs" || [...params.keys()].some(key => !keys.includes(key)) || keys.some(key => params.getAll(key).length !== 1)) return null;
    const optionRef = params.get("option_ref")!; if (!REFERENCE.test(optionRef)) return null;
    const ages = params.get("child_ages")!;
    if (!/^[1-9]\d?$/.test(params.get("adults")!) || (ages !== "" && !/^(?:0|[1-9]\d?)(?:,(?:0|[1-9]\d?))*$/.test(ages))) return null;
    const draft = snapshotStaffDraft({ arrivalDate: params.get("from")!, departureDate: params.get("to")!,
      adults: Number(params.get("adults")), childAges: ages === "" ? [] : ages.split(",").map(Number), channelCode: params.get("channel")! });
    return Object.freeze({ ...draft, optionRef });
  } catch { return null; }
}
