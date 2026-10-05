import type { AuthSessionAccess } from "./auth-session";

/** Read-only foundations. No listing identity, sellability, quote or write authority. */
export type ReadSource = "context" | "inventory" | "rate-price";
export type ReadFailure = "invalid-selection" | "unauthenticated" | "denied" | "stale" | "cancelled" | "timeout" |
  "busy" | "unavailable" | "incomplete" | "malformed";
export class HostCalendarReadError extends Error {
  constructor(readonly code: ReadFailure, readonly source: ReadSource, readonly status: number | null = null) {
    super(`Calendar evidence is ${code}.`); this.name = "HostCalendarReadError";
  }
}
export type UnknownEvidence = Readonly<{ state: "unknown"; reason: string; source: ReadSource }>;
const unknown = (reason: string, source: ReadSource): UnknownEvidence => Object.freeze({ state: "unknown", reason, source });
export type HostPriceSelection = Readonly<{ ratePlanId: string; occupancy: number; channelCode: string | null; stayDate: string }>;
export type HostCalendarSelection = Readonly<{
  propertyId: string; timezone: string; unitTypeId: string; sellableUnitId: string; price: HostPriceSelection | null;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const HOST_CALENDAR_READ_BOUNDS = Object.freeze({ unitTypes: 500, spaces: 2000, units: 2000,
  claimsPerUnit: 64, claims: 8192, inventoryBytes: 2_097_152, priceBytes: 65_536, requests: 2, concurrency: 1 });
function fail(source: ReadSource, code: ReadFailure = "malformed"): never { throw new HostCalendarReadError(code, source); }
function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.getOwnPropertySymbols(value).length === 0 &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(item => "value" in item && item.enumerable);
}
function exact(value: unknown, keys: readonly string[], source: ReadSource): Record<string, unknown> {
  if (!record(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) fail(source);
  return value;
}
function text(value: unknown, source: ReadSource, maximum = 200, empty = false): string {
  if (typeof value !== "string" || value !== value.trim() || value.length > maximum || (!empty && !value.length) || /[\x00-\x1f\x7f]/.test(value)) fail(source);
  return value;
}
function uuid(value: unknown, source: ReadSource): string { if (typeof value !== "string" || !UUID.test(value)) fail(source); return value; }
function integer(value: unknown, min: number, max: number, source: ReadSource): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(source); return value;
}
function code(value: unknown, source: ReadSource): string { const result = text(value, source, 64); if (!CODE.test(result)) fail(source); return result; }
function date(value: unknown, source: ReadSource): string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) fail(source);
  return value;
}
function array(value: unknown, maximum: number, source: ReadSource): unknown[] {
  if (!Array.isArray(value)) fail(source);
  if (value.length > maximum) fail(source, "incomplete");
  if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length || Object.keys(value).length !== value.length) fail(source);
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(source);
  }
  return value;
}
function attributes(value: unknown, source: ReadSource): void {
  if (!record(value)) fail(source);
  let count = 0;
  function visit(item: unknown, depth: number) {
    if (++count > 4096 || depth > 8) fail(source, "incomplete");
    if (item === null || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))) return;
    if (typeof item === "string" && item.length <= 4096) return;
    if (Array.isArray(item)) { for (const child of array(item, 1024, source)) visit(child, depth + 1); return; }
    if (!record(item) || Object.keys(item).some(key => ["__proto__", "prototype", "constructor"].includes(key))) fail(source);
    for (const child of Object.values(item)) visit(child, depth + 1);
  }
  visit(value, 0); // Validate, but do not expose arbitrary attrs as calendar policy or secret-bearing metadata.
}
export function validateHostCalendarSelection(value: unknown): HostCalendarSelection {
  try {
    const row = exact(value, ["propertyId", "timezone", "unitTypeId", "sellableUnitId", "price"], "context");
    const timezone = text(row.timezone, "context", 100);
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
    let price: HostPriceSelection | null = null;
    if (row.price !== null) {
      const p = exact(row.price, ["ratePlanId", "occupancy", "channelCode", "stayDate"], "context");
      price = Object.freeze({ ratePlanId: uuid(p.ratePlanId, "context"), occupancy: integer(p.occupancy, 1, 100, "context"),
        channelCode: p.channelCode === null ? null : code(p.channelCode, "context"), stayDate: date(p.stayDate, "context") });
    }
    return Object.freeze({ propertyId: uuid(row.propertyId, "context"), timezone,
      unitTypeId: uuid(row.unitTypeId, "context"), sellableUnitId: uuid(row.sellableUnitId, "context"), price });
  } catch { fail("context", "invalid-selection"); }
}
export type HostUnitType = Readonly<{ id: string; code: string; name: string; profileKey: string;
  baseOccupancy: number; maxOccupancy: number; sortOrder: number }>;
export type HostSpace = Readonly<{ id: string; code: string; profileKey: string; capacity: number; maxOccupancy: number | null;
  floor: string | null; areaSqm: string | null; genderPolicy: "any" | "female" | "male" | null; status: string }>;
export type HostSpaceClaim = Readonly<{ spaceId: string; code: string; claimMode: "exclusive" | "positional"; space: HostSpace }>;
export type HostSellableUnit = Readonly<{ id: string; unitTypeId: string; unitTypeCode: string; name: string; status: string;
  claims: Readonly<{ state: "reported" | "incomplete"; reason: "reported-claims" | "zero-reported-claims"; reported: readonly HostSpaceClaim[] }> }>;
export type HostInventoryEvidence = Readonly<{ state: "known"; source: "inventory"; tenantId: string; propertyId: string;
  timezone: string; timezoneSource: "granted-selection"; selectedUnit: HostSellableUnit;
  unitTypes: readonly HostUnitType[]; spaces: readonly HostSpace[]; sellableUnits: readonly HostSellableUnit[];
  snapshotVersion: UnknownEvidence; spaceRelations: UnknownEvidence; listingIdentity: UnknownEvidence;
  operatingMode: UnknownEvidence; availability: UnknownEvidence }>;
function parent(row: Record<string, unknown>, selection: HostCalendarSelection, tenantId: string, source: ReadSource) {
  if (row.tenantId !== tenantId || row.propertyNode !== selection.propertyId) fail(source);
}
function distinct<T extends { id: string }>(items: readonly T[], source: ReadSource): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) { if (result.has(item.id)) fail(source); result.set(item.id, item); }
  return result;
}
export function parseHostInventory(value: unknown, requested: HostCalendarSelection, tenantId: string): HostInventoryEvidence {
  const selection = validateHostCalendarSelection(requested); uuid(tenantId, "context");
  const src = "inventory";
  const body = exact(value, ["unitTypes", "spaces", "sellableUnits"], src);
  const unitTypes = array(body.unitTypes, HOST_CALENDAR_READ_BOUNDS.unitTypes, src).map(value => {
    const row = exact(value, ["id", "tenantId", "propertyNode", "code", "name", "profileKey", "baseOccupancy", "maxOccupancy", "attrs", "sortOrder"], src);
    parent(row, selection, tenantId, src); attributes(row.attrs, src);
    const baseOccupancy = integer(row.baseOccupancy, 1, 32767, src), maxOccupancy = integer(row.maxOccupancy, 1, 32767, src);
    if (baseOccupancy > maxOccupancy) fail(src);
    return Object.freeze({ id: uuid(row.id, src), code: code(row.code, src), name: text(row.name, src), profileKey: code(row.profileKey, src),
      baseOccupancy, maxOccupancy, sortOrder: integer(row.sortOrder, -2147483648, 2147483647, src) });
  });
  const types = distinct(unitTypes, src);
  if (new Set(unitTypes.map(type => type.code)).size !== unitTypes.length) fail(src);
  const spaces = array(body.spaces, HOST_CALENDAR_READ_BOUNDS.spaces, src).map(value => {
    const row = exact(value, ["id", "tenantId", "propertyNode", "code", "profileKey", "capacity", "maxOccupancy", "floor", "areaSqm", "genderPolicy", "attrs", "status"], src);
    parent(row, selection, tenantId, src); attributes(row.attrs, src);
    if (![null, "any", "female", "male"].includes(row.genderPolicy as null)) fail(src);
    if (row.areaSqm !== null && (typeof row.areaSqm !== "string" || !/^(?:0|[1-9]\d{0,5})\.\d{2}$/.test(row.areaSqm))) fail(src);
    return Object.freeze({ id: uuid(row.id, src), code: code(row.code, src), profileKey: code(row.profileKey, src),
      capacity: integer(row.capacity, 1, 32767, src), maxOccupancy: row.maxOccupancy === null ? null : integer(row.maxOccupancy, 1, 32767, src),
      floor: row.floor === null ? null : text(row.floor, src, 64, true), areaSqm: row.areaSqm as string | null,
      genderPolicy: row.genderPolicy as HostSpace["genderPolicy"], status: text(row.status, src, 64) });
  });
  const spaceMap = distinct(spaces, src);
  if (new Set(spaces.map(space => space.code)).size !== spaces.length) fail(src);
  let totalClaims = 0;
  const sellableUnits = array(body.sellableUnits, HOST_CALENDAR_READ_BOUNDS.units, src).map(value => {
    const row = exact(value, ["id", "tenantId", "propertyNode", "unitTypeId", "unitTypeCode", "name", "status", "spaces"], src);
    parent(row, selection, tenantId, src);
    const type = types.get(uuid(row.unitTypeId, src));
    if (!type || row.unitTypeCode !== type.code) fail(src);
    const seen = new Set<string>();
    const reported = array(row.spaces, HOST_CALENDAR_READ_BOUNDS.claimsPerUnit, src).map(value => {
      const claim = exact(value, ["spaceId", "code", "claimMode"], src);
      const spaceId = uuid(claim.spaceId, src), space = spaceMap.get(spaceId);
      if (!space || seen.has(spaceId) || claim.code !== space.code || !["exclusive", "positional"].includes(claim.claimMode as string)) fail(src);
      seen.add(spaceId); if (++totalClaims > HOST_CALENDAR_READ_BOUNDS.claims) fail(src, "incomplete");
      return Object.freeze({ spaceId, code: space.code, claimMode: claim.claimMode as HostSpaceClaim["claimMode"], space });
    });
    const claims: HostSellableUnit["claims"] = Object.freeze({ state: reported.length ? "reported" : "incomplete",
      reason: reported.length ? "reported-claims" : "zero-reported-claims", reported: Object.freeze(reported) });
    return Object.freeze({ id: uuid(row.id, src), unitTypeId: type.id, unitTypeCode: type.code,
      name: text(row.name, src), status: text(row.status, src, 64), claims });
  });
  const units = distinct(sellableUnits, src), selectedUnit = units.get(selection.sellableUnitId);
  if (!selectedUnit) fail(src, "incomplete");
  if (selectedUnit.unitTypeId !== selection.unitTypeId) fail(src);
  return Object.freeze({ state: "known", source: src, tenantId, propertyId: selection.propertyId,
    timezone: selection.timezone, timezoneSource: "granted-selection", selectedUnit,
    unitTypes: Object.freeze(unitTypes), spaces: Object.freeze(spaces), sellableUnits: Object.freeze(sellableUnits),
    snapshotVersion: unknown("endpoint-has-no-snapshot-or-version", src), spaceRelations: unknown("endpoint-does-not-return-containment", src),
    listingIdentity: unknown("no-listing-mapping", src), operatingMode: unknown("not-returned", src), availability: unknown("inventory-claims-are-not-sellability", src) });
}
function minor(value: unknown): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,18})$/.test(value)) fail("rate-price");
  const amount = BigInt(value); if (amount > 9223372036854775807n) fail("rate-price"); return amount;
}
export type HostRateEvidence = Readonly<{ state: "known"; source: "rate-price"; scope: "unit-type";
  tenantId: string; propertyId: string; unitTypeId: string; ratePlanId: string; currency: string;
  stayStart: string; stayEndExclusive: string; dowMask: number; requested: HostPriceSelection;
  version: Readonly<{ kind: "record-id-and-recorded-at"; id: string; recordedAt: string; supersededBy: null }>;
  effectiveSource: "latest-unsuperseded-record-for-type-plan-date";
  occupancy: Readonly<Record<string, bigint>>; extraAdultMinor: bigint | null;
  extraChildren: readonly Readonly<{ maxAge: number; amountMinor: bigint }>[];
  selectedTier: Readonly<{ state: "known"; scope: "unit-type-occupancy-tier"; amountMinor: bigint; currency: string }> | UnknownEvidence;
  unitPrice: UnknownEvidence; channelApplicability: UnknownEvidence; taxInclusion: UnknownEvidence;
  fees: UnknownEvidence; availability: UnknownEvidence; smartPricing: UnknownEvidence; policyTerms: UnknownEvidence }>;
export function parseHostRatePrice(value: unknown, requested: HostCalendarSelection, tenantId: string): HostRateEvidence {
  const selection = validateHostCalendarSelection(requested); uuid(tenantId, "context");
  if (!selection.price) fail("context", "invalid-selection");
  const src = "rate-price", pick = selection.price;
  const body = exact(value, ["ratePrice"], src);
  const row = exact(body.ratePrice, ["id", "tenantId", "propertyNode", "ratePlanId", "unitTypeId", "stayStart", "stayEnd", "dowMask", "currency", "pricing", "recordedAt", "supersededBy"], src);
  parent(row, selection, tenantId, src);
  if (row.ratePlanId !== pick.ratePlanId || row.unitTypeId !== selection.unitTypeId || row.supersededBy !== null) fail(src);
  const stayStart = date(row.stayStart, src), stayEndExclusive = date(row.stayEnd, src);
  const dowMask = integer(row.dowMask, 1, 127, src), isoDay = (new Date(pick.stayDate + "T00:00:00Z").getUTCDay() + 6) % 7;
  if (stayStart >= stayEndExclusive || pick.stayDate < stayStart || pick.stayDate >= stayEndExclusive || !(dowMask & (1 << isoDay))) fail(src);
  const currency = text(row.currency, src, 3); if (!/^[A-Z]{3}$/.test(currency)) fail(src);
  const recordedAt = text(row.recordedAt, src, 24);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(recordedAt) ||
      !Number.isFinite(Date.parse(recordedAt)) || new Date(recordedAt).toISOString() !== recordedAt) fail(src);
  const pricing = exact(row.pricing, ["occupancy", "extraAdultMinor", "extraChildren"], src);
  if (!record(pricing.occupancy) || Object.keys(pricing.occupancy).length < 1 || Object.keys(pricing.occupancy).length > 100) fail(src);
  const occupancy: Record<string, bigint> = {};
  for (const [tier, amount] of Object.entries(pricing.occupancy)) {
    if (!/^[1-9]\d{0,2}$/.test(tier) || Number(tier) > 100) fail(src); occupancy[tier] = minor(amount);
  }
  let previousAge = -1;
  const extraChildren = array(pricing.extraChildren, 20, src).map(value => {
    const child = exact(value, ["maxAge", "amountMinor"], src), maxAge = integer(child.maxAge, 0, 17, src);
    if (maxAge <= previousAge) fail(src); previousAge = maxAge;
    return Object.freeze({ maxAge, amountMinor: minor(child.amountMinor) });
  });
  const amount = occupancy[String(pick.occupancy)];
  return Object.freeze({ state: "known", source: src, scope: "unit-type", tenantId, propertyId: selection.propertyId,
    unitTypeId: selection.unitTypeId, ratePlanId: pick.ratePlanId, currency, stayStart, stayEndExclusive, dowMask, requested: pick,
    version: Object.freeze({ kind: "record-id-and-recorded-at", id: uuid(row.id, src), recordedAt, supersededBy: null }),
    effectiveSource: "latest-unsuperseded-record-for-type-plan-date", occupancy: Object.freeze(occupancy),
    extraAdultMinor: pricing.extraAdultMinor === null ? null : minor(pricing.extraAdultMinor), extraChildren: Object.freeze(extraChildren),
    selectedTier: amount === undefined ? unknown("requested-occupancy-tier-not-returned", src) :
      Object.freeze({ state: "known", scope: "unit-type-occupancy-tier", amountMinor: amount, currency }),
    unitPrice: unknown("no-per-unit-price-contract", src), channelApplicability: unknown("endpoint-does-not-resolve-channel", src),
    taxInclusion: unknown("not-returned", src), fees: unknown("not-returned", src), availability: unknown("rate-record-is-not-sellability", src),
    smartPricing: unknown("not-returned", src), policyTerms: unknown("not-returned", src) });
}
export type HostCalendarReadResult = Readonly<{ state: "unknown"; reason: ReadFailure; source: ReadSource; status: number | null }> |
  Readonly<{ state: "ready"; cacheContext: string; selection: HostCalendarSelection; inventory: HostInventoryEvidence; price: HostRateEvidence | UnknownEvidence }>;
type ReadAuth = Pick<AuthSessionAccess, "getSnapshot" | "session" | "subscribe">;
type Transport = (url: string, init: RequestInit) => Promise<Response>;
function interrupted<T>(promise: Promise<T>, signal: AbortSignal, error: () => HostCalendarReadError): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(error());
    if (signal.aborted) { promise.catch(() => {}); stop(); return; }
    signal.addEventListener("abort", stop, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}
/** One reader, one explicitly selected unit, at most two sequential GETs. Never persists tokens or results. */
export function createHostCalendarReader(options: Readonly<{ auth: ReadAuth; transport?: Transport; timeoutMs?: number }>) {
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 15000) fail("context", "invalid-selection");
  const transport = options.transport ?? ((url, init) => fetch(url, init));
  const instanceId = crypto.randomUUID(); let readSequence = 0;
  let selected: HostCalendarSelection | null = null, revision = 0, disposed = false;
  let active: { controller: AbortController; reason: ReadFailure } | null = null;
  const changed = () => { revision++; if (active) { active.reason = "stale"; active.controller.abort(); } };
  const unsubscribe = options.auth.subscribe(changed);
  function select(value: HostCalendarSelection) {
    if (disposed) fail("context", "stale");
    // Even an invalid replacement fences the preceding selection's pending response.
    changed(); selected = null; selected = validateHostCalendarSelection(value);
  }
  async function read(signal?: AbortSignal): Promise<HostCalendarReadResult> {
    if (active) return Object.freeze({ state: "unknown", reason: "busy", source: "context", status: null });
    const pending = { controller: new AbortController(), reason: "cancelled" as ReadFailure }; active = pending;
    const captured = selected, generation = revision, snapshot = options.auth.getSnapshot();
    const sequence = ++readSequence;
    const cancel = () => { pending.reason = "cancelled"; pending.controller.abort(); };
    signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel();
    const timer = setTimeout(() => { pending.reason = "timeout"; pending.controller.abort(); }, timeoutMs);
    const stopError = () => new HostCalendarReadError(pending.reason, "context");
    const wait = <T>(promise: Promise<T>) => interrupted(promise, pending.controller.signal, stopError);
    function fence() {
      if (pending.controller.signal.aborted) throw stopError();
      if (disposed || revision !== generation || selected !== captured || options.auth.getSnapshot() !== snapshot) fail("context", "stale");
      if (!captured) fail("context", "invalid-selection");
      if (snapshot.status !== "authenticated" || !snapshot.principal) fail("context", "unauthenticated");
      const matches = snapshot.properties.filter(property => property.id === captured.propertyId);
      if (matches.length !== 1 || matches[0]!.timezone !== captured.timezone) fail("context", "denied");
      uuid(snapshot.principal.tenantId, "context"); uuid(snapshot.principal.actorId, "context");
    }
    let token = "";
    async function sessionFence() {
      fence(); const current = await wait(options.auth.session()); fence();
      if (!current || current !== token) fail("context", "stale");
    }
    async function request(path: string, source: "inventory" | "rate-price", maximum: number): Promise<unknown> {
      await sessionFence();
      const response = await wait(transport(path, { method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { authorization: `Bearer ${token}`, accept: "application/json" }, signal: pending.controller.signal }));
      await sessionFence();
      const discard = () => { if (response.body) void response.body.cancel().catch(() => {}); };
      const denied = () => new HostCalendarReadError(response.status === 401 ? "unauthenticated" : response.status === 403 ? "denied" :
        response.status === 404 ? "incomplete" : "unavailable", source, response.status);
      if (response.redirected) { discard(); fail(source, "malformed"); }
      const length = response.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) { discard(); fail(source, "incomplete"); }
      if (!response.body) { await sessionFence(); if (!response.ok) throw denied(); fail(source, "incomplete"); }
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0, complete = false;
      try {
        while (true) {
          const part = await wait(reader.read()); fence();
          if (part.done) { complete = true; break; }
          bytes += part.value.byteLength; if (bytes > maximum) fail(source, "incomplete"); chunks.push(part.value);
        }
      } finally {
        if (!complete) void reader.cancel().catch(() => {});
        try { reader.releaseLock(); } catch { /* A cancelled in-flight read may settle after this call. */ }
      }
      await sessionFence();
      if (!response.ok) throw denied();
      if (response.status !== 200 || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) fail(source);
      const buffer = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)) as unknown; } catch { fail(source); }
    }
    try {
      fence(); token = await wait(options.auth.session()); fence();
      if (!token) fail("context", "unauthenticated");
      const selection = captured!, tenantId = snapshot.principal!.tenantId;
      const prefix = `/api/v1/properties/${selection.propertyId}`;
      const inventory = parseHostInventory(await request(prefix + "/inventory", "inventory", HOST_CALENDAR_READ_BOUNDS.inventoryBytes), selection, tenantId);
      let price: HostRateEvidence | UnknownEvidence = unknown("not-requested", "rate-price");
      if (selection.price) {
        const query = new URLSearchParams({ ratePlanId: selection.price.ratePlanId, unitTypeId: selection.unitTypeId, stayDate: selection.price.stayDate });
        price = parseHostRatePrice(await request(prefix + "/rate-prices/current?" + query, "rate-price", HOST_CALENDAR_READ_BOUNDS.priceBytes), selection, tenantId);
      }
      await sessionFence();
      // Nonsecret context for caller-owned caches; never contains bearer/claims/display names.
      const cacheContext = JSON.stringify(["host-calendar-read-v1", instanceId, sequence, snapshot.principal!.tenantId, snapshot.principal!.actorId, generation, selection]);
      return Object.freeze({ state: "ready", cacheContext, selection, inventory, price });
    } catch (error) {
      // Re-check scope even after malformed bodies or server errors; never return earlier partial data.
      try { fence(); } catch (current) { error = current; }
      const safe = error instanceof HostCalendarReadError ? error : new HostCalendarReadError("unavailable", "context");
      return Object.freeze({ state: "unknown", reason: safe.code, source: safe.source, status: safe.status });
    } finally {
      token = ""; clearTimeout(timer); signal?.removeEventListener("abort", cancel); active = null;
    }
  }
  function dispose() { if (!disposed) { disposed = true; changed(); unsubscribe(); selected = null; } }
  return Object.freeze({ select, read, dispose });
}
