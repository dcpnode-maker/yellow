import type { StaffPartyProfile, StaffPartyStay } from "./staff-party-types.mjs";
import { reactAuthSession } from "../auth-session";
import { createStaffReadClient, StaffModuleError, STAFF_UUID, staffRecord, type StaffClientOptions } from "./staff-crs-client";

// Read-only public projection; contact values and internal identity records never enter this client.
export type { StaffPartyProfile, StaffPartyStay } from "./staff-party-types.mjs";
export class StaffPartyScopeError extends StaffModuleError {
  constructor(message: string) { super(message, 403); this.name = "StaffPartyScopeError"; }
}
const invalid = () => new StaffModuleError("The guest evidence could not be verified. No empty result has been inferred.");
const text = (value: unknown): value is string => typeof value === "string";
const nullableText = (value: unknown): value is string | null => value === null || text(value);
const instant = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString().slice(0, 19) === value.slice(0, 19);

export function parseStaffPartyProfiles(value: unknown): readonly StaffPartyProfile[] {
  if (!staffRecord(value) || !Array.isArray(value.profiles) || value.profiles.length > 50) throw invalid();
  const seen = new Set<string>();
  return Object.freeze(value.profiles.map((row: unknown) => {
    if (!staffRecord(row) || !text(row.partyId) || !STAFF_UUID.test(row.partyId) || seen.has(row.partyId) ||
      !text(row.displayName) || !nullableText(row.legalName) || !text(row.kind) || !text(row.status) ||
      !Array.isArray(row.roles) || !row.roles.every(text) || !Array.isArray(row.contacts)) throw invalid();
    seen.add(row.partyId);
    const contacts = Object.freeze(row.contacts.map((contact: unknown) => {
      if (!staffRecord(contact) || !text(contact.kind) || !text(contact.hint)) throw invalid();
      return Object.freeze({ kind: contact.kind, hint: contact.hint });
    }));
    return Object.freeze({ partyId: row.partyId, displayName: row.displayName, legalName: row.legalName,
      kind: row.kind, status: row.status, roles: Object.freeze([...row.roles] as string[]), contacts });
  }));
}

export function parseStaffPartyHistory(value: unknown): Readonly<{ reservations: readonly StaffPartyStay[]; nextCursor: string | null }> {
  if (!staffRecord(value) || !Array.isArray(value.reservations) || value.reservations.length > 100 ||
    !(value.nextCursor === null || (text(value.nextCursor) && /^[A-Za-z0-9_-]{1,512}$/.test(value.nextCursor)))) throw invalid();
  const seen = new Set<string>();
  const reservations = Object.freeze(value.reservations.map((row: unknown) => {
    if (!staffRecord(row) || !text(row.reservationId) || !STAFF_UUID.test(row.reservationId) || seen.has(row.reservationId) ||
      !text(row.primaryPartyId) || !STAFF_UUID.test(row.primaryPartyId) || !text(row.confirmationNo) ||
      !text(row.status) || !text(row.operationalState) || !instant(row.stayFrom) || !instant(row.stayTo) ||
      row.stayFrom >= row.stayTo || !nullableText(row.sellableUnitLabel) || !text(row.unitTypeLabel) || !text(row.ratePlanLabel)) throw invalid();
    seen.add(row.reservationId);
    return Object.freeze({ reservationId: row.reservationId, primaryPartyId: row.primaryPartyId, confirmationNo: row.confirmationNo,
      status: row.status, operationalState: row.operationalState,
      stayFrom: row.stayFrom, stayTo: row.stayTo, sellableUnitLabel: row.sellableUnitLabel,
      unitTypeLabel: row.unitTypeLabel, ratePlanLabel: row.ratePlanLabel });
  }));
  return Object.freeze({ reservations, nextCursor: value.nextCursor as string | null });
}

export function createStaffPartyClient(options: StaffClientOptions = {}) {
  const client = createStaffReadClient(options);
  const session = options.session ?? reactAuthSession.session;
  // Failed operation evidence is distinct from a lost or unverifiable property/session scope.
  async function read(...args: Parameters<typeof client.read>) {
    const token = await session(), signal = args[3];
    try { return await client.read(...args); }
    catch (reason) {
      if (signal?.aborted) throw reason;
      if (reason instanceof StaffModuleError && reason.status === 401)
        throw new StaffPartyScopeError("The account or session changed. Search again.");
      try {
        if (await session() !== token) throw new StaffPartyScopeError("The account or session changed. Search again.");
        const properties = await client.properties(signal);
        if (args[1].some(id => !properties.some(property => property.id === id)))
          throw new StaffPartyScopeError("Access to a selected property is no longer granted.");
        if (await session() !== token) throw new StaffPartyScopeError("The account or session changed. Search again.");
      } catch (scopeReason) {
        if (signal?.aborted) throw reason;
        if (scopeReason instanceof StaffPartyScopeError) throw scopeReason;
        throw new StaffPartyScopeError("Property or session access could not be verified. Read again.");
      }
      throw reason;
    }
  }
  async function search(propertyId: string, query: string, signal?: AbortSignal) {
    const exact = query.trim();
    if (exact.length < 2 || exact.length > 200) throw new StaffModuleError("Enter between two and 200 characters.");
    const response = await read(`/api/v1/properties/${propertyId}/parties:search`, [propertyId], () => ({
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: exact, limit: 50 }),
    }), signal);
    return Object.freeze({ profiles: parseStaffPartyProfiles(response.value), property: response.properties[0]! });
  }
  async function profile(propertyId: string, partyId: string, signal?: AbortSignal) {
    if (!STAFF_UUID.test(partyId)) throw new StaffModuleError("Invalid guest identity.");
    const result = await search(propertyId, partyId, signal);
    return Object.freeze({ profile: result.profiles.find(row => row.partyId === partyId) ?? null, property: result.property });
  }
  async function history(propertyId: string, partyId: string, signal?: AbortSignal) {
    if (!STAFF_UUID.test(partyId)) throw new StaffModuleError("Invalid guest identity.");
    // Every page remains bound to the session captured by this whole history read.
    const token = await session(), rows: StaffPartyStay[] = [], cursors = new Set<string>(), ids = new Set<string>();
    let after: string | null = null;
    for (let page = 0; page < 50; page++) {
      if (await session() !== token) throw new StaffPartyScopeError("The account or session changed. Search again.");
      const query = new URLSearchParams({ partyId, limit: "100", ...(after === null ? {} : { after }) });
      const response = await read(`/api/v1/properties/${propertyId}/reservation-board?${query}`, [propertyId], () => ({ method: "GET" }), signal);
      if (await session() !== token) throw new StaffPartyScopeError("The account or session changed. Search again.");
      const value = parseStaffPartyHistory(response.value);
      for (const row of value.reservations) {
        if (ids.has(row.reservationId)) throw new StaffModuleError("Guest history repeated a reservation across pages.");
        ids.add(row.reservationId); rows.push(row);
      }
      if (value.nextCursor === null) return Object.freeze({ reservations: Object.freeze(rows), property: response.properties[0]! });
      if (cursors.has(value.nextCursor)) throw new StaffModuleError("Guest history repeated a page cursor.");
      cursors.add(value.nextCursor); after = value.nextCursor;
    }
    throw new StaffModuleError("Guest history exceeds the safe page limit. No complete result has been inferred.");
  }
  return Object.freeze({ search, profile, history });
}
