import { randomUUID } from "node:crypto";
import {
  GuestBookingAuthority, GuestBookingAuthorityError, GUEST_BOOKING_ISSUER_SCOPES,
  GuestBookingTokenSigner,
} from "../identity";
import type { HoldService } from "../inventory";
import { RateNotFoundError, type RateConfigurationService, type RatePublicationService, type RateQuote, type RateQuoteService, type ResolveRateQuoteInput } from "../rates";
import { QuotedTaxHoldBindingService, type TaxAttributionPersistenceService } from "../tax-fiscal";
import { createAuditEnvelope, recordFact, type AuditEnvelope, type EventBus, type JsonValue, type PostgresIdempotency, type Tx } from "../../kernel";
import type { ReservationCommitService } from "./commit";
import type { ReservationOfferSearchService } from "./offers";

type Data = Readonly<Record<string, unknown>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const CHANNEL = /^[a-z][a-z0-9._-]{0,63}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const DISPLAY_CODE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const MAX_CONTEXT_UNIT_ROWS = 4096;

export class GuestBookingError extends Error {
  constructor(readonly status: number, readonly code: string) { super("Guest booking request could not be completed"); this.name = "GuestBookingError"; }
}
function invalid(): never { throw new GuestBookingError(400, "booking/invalid"); }
function denied(): never { throw new GuestBookingError(403, "booking/unavailable"); }
function stale(): never { throw new GuestBookingError(409, "booking/quote_changed"); }
function record(value: unknown, keys: readonly string[]): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid();
  const source = value as Record<string, unknown>;
  if (Object.getPrototypeOf(source) !== Object.prototype || Reflect.ownKeys(source).length !== keys.length ||
      Object.values(Object.getOwnPropertyDescriptors(source)).some((descriptor) => descriptor.get || descriptor.set) ||
      keys.some((key) => !Object.prototype.hasOwnProperty.call(source, key))) return invalid();
  return source;
}
function uuid(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) return invalid(); return value; }
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(canonical(value)).digest("hex"); }
function canonical(value: unknown): string {
  if (value === undefined || typeof value === "function" || typeof value === "symbol" ||
      (typeof value === "number" && !Number.isFinite(value))) return invalid();
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Data)[key])}`).join(",")}}`;
}
function json(value: unknown): JsonValue { return JSON.parse(canonical(value)) as JsonValue; }
function instant(value: unknown): Date {
  if (typeof value !== "string" || value.length !== 24) return invalid();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) return invalid();
  return date;
}
function displayName(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.trim() !== value || value.length > 256 ||
      /[\x00-\x1f\x7f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(value)) return denied();
  return value;
}
function ianaTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 || value.trim() !== value ||
      (value !== "UTC" && value !== "GMT" &&
        (!value.includes("/") || value.split("/").some((part) => !/^[A-Z][A-Za-z0-9._+-]*$/.test(part))))) return denied();
  try {
    const resolved = new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
    const canonical = value === "GMT" && resolved === "GMT" ? "UTC" : resolved;
    if (canonical !== "UTC" && (!canonical.includes("/") ||
        canonical.split("/").some((part) => !/^[A-Z][A-Za-z0-9._+-]*$/.test(part)))) return denied();
    if (canonical === "UTC" && value !== "UTC" && value !== "GMT") return denied();
    return canonical;
  } catch { return denied(); }
}
function stay(value: unknown, selected: boolean): { from: Date; to: Date; adults: number; childAges: readonly number[]; sellableUnitId?: string; ratePlanId?: string } {
  const v = record(value, ["stayStart", "stayEnd", "adults", "childAges", ...(selected ? ["sellableUnitId", "ratePlanId"] : [])]);
  const from = instant(v.stayStart), to = instant(v.stayEnd);
  if (from >= to || to.getTime() - from.getTime() > 366 * 86_400_000 ||
      !Number.isSafeInteger(v.adults) || (v.adults as number) < 1 || (v.adults as number) > 99 ||
      !Array.isArray(v.childAges) || v.childAges.length > 30 || Object.keys(v.childAges).length !== v.childAges.length || Object.keys(v.childAges).some((key,index)=>key!==String(index)) ||
      v.childAges.some((age: unknown) => !Number.isSafeInteger(age) || (age as number) < 0 || (age as number) > 17)) return invalid();
  return { from, to, adults: v.adults as number, childAges: Object.freeze([...(v.childAges as number[])]),
    ...(selected ? { sellableUnitId: uuid(v.sellableUnitId), ratePlanId: uuid(v.ratePlanId) } : {}) };
}
/** Only clock evidence is omitted. Every financial/policy/evaluation field remains compared. */
function withoutBookingClock(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutBookingClock);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "bookingInstant").map(([key, item]) => [key, withoutBookingClock(item)]));
}
export function guestBookingTermsFingerprint(quote: RateQuote): string {
  return digest({ tenantId: quote.tenantId, propertyNode: quote.propertyNode, ratePlanId: quote.ratePlanId,
    sellableUnitId: quote.sellableUnitId, unitTypeId: quote.unitTypeId, releaseId: quote.releaseId,
    releaseVersion: quote.releaseVersion, releaseContentHash: quote.releaseContentHash,
    modelDraftId: quote.modelDraftId, modelDraftVersion: quote.modelDraftVersion,
    targetDraftId: quote.targetDraftId, targetDraftVersion: quote.targetDraftVersion,
    propertyTimeZone: quote.propertyTimeZone, stayStartDate: quote.stayStartDate, stayEndDate: quote.stayEndDate,
    result: withoutBookingClock(quote.result), taxAssignmentState: quote.taxAssignmentState,
    taxAssignments: quote.taxAssignments, taxPreview: quote.taxPreview });
}

export interface GuestBookingSession {
  readonly tenantId: string; readonly propertyNode: string; readonly actorId: string;
  readonly primaryPartyId: string; readonly ratePlanIds: readonly string[]; readonly channelCode: string;
  readonly sessionId: string; readonly issuedAt: number; readonly expiresAt: number;
}
export interface GuestBookingServiceOptions {
  readonly tokens: GuestBookingTokenSigner;
  readonly authority?: Pick<GuestBookingAuthority, "authorize">;
  readonly offers: Pick<ReservationOfferSearchService, "search">;
  readonly quotes: Pick<RateQuoteService, "resolve">;
  readonly rates: Pick<RateConfigurationService, "getRatePlan" | "getPolicy">;
  readonly publication: Pick<RatePublicationService, "getActiveRelease">;
  readonly holds: Pick<HoldService, "place">;
  readonly attributions: Pick<TaxAttributionPersistenceService, "record">;
  readonly reservations: Pick<ReservationCommitService, "commitHeld">;
  readonly idempotency: PostgresIdempotency;
  readonly events: EventBus;
  readonly now?: () => number;
}

export class GuestBookingService {
  readonly #o: GuestBookingServiceOptions;
  readonly #authority: Pick<GuestBookingAuthority, "authorize">;
  readonly #sessions = new WeakSet<object>();
  readonly #now: () => number;
  constructor(options: GuestBookingServiceOptions) {
    this.#o = options; this.#authority = options.authority ?? new GuestBookingAuthority(); this.#now = options.now ?? Date.now;
  }
  #ttl(expiresAt: number, limit: number): number {
    const ttl = Math.min(limit, expiresAt - Math.floor(this.#now() / 1000));
    if (ttl < 1) throw new GuestBookingError(401, "booking/expired");
    return ttl;
  }
  authenticate(token: string): GuestBookingSession | null {
    const verified = this.#o.tokens.verify("session", token);
    if (!verified) return null;
    try {
      const v = record(verified.payload, ["tenantId", "propertyNode", "actorId", "primaryPartyId", "ratePlanIds", "channelCode", "sessionId", "validFrom", "validUntil"]);
      if (!Array.isArray(v.ratePlanIds) || v.ratePlanIds.length < 1 || v.ratePlanIds.length > 16 ||
          new Set(v.ratePlanIds).size !== v.ratePlanIds.length || typeof v.channelCode !== "string" || !CHANNEL.test(v.channelCode) ||
          !Number.isSafeInteger(v.validFrom) || !Number.isSafeInteger(v.validUntil) ||
          (v.validUntil as number) <= (v.validFrom as number) || (v.validUntil as number) - (v.validFrom as number) > 900) return null;
      const session: GuestBookingSession = Object.freeze({ tenantId: uuid(v.tenantId), propertyNode: uuid(v.propertyNode),
        actorId: uuid(v.actorId), primaryPartyId: uuid(v.primaryPartyId), sessionId: uuid(v.sessionId),
        ratePlanIds: Object.freeze(v.ratePlanIds.map(uuid)), channelCode: v.channelCode,
        issuedAt: v.validFrom as number, expiresAt: Math.min(v.validUntil as number, verified.expiresAt) });
      this.#ttl(session.expiresAt, 900); this.#sessions.add(session); return session;
    } catch { return null; }
  }
  async #fresh(tx: Tx, session: Pick<GuestBookingSession,"issuedAt"|"expiresAt">, boundUntil = session.expiresAt): Promise<void> {
    const rows = await tx<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    const now = rows[0]?.now;
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new GuestBookingError(503, "service/unavailable");
    const seconds = Math.floor(now.getTime()/1000);
    if (seconds < session.issuedAt || seconds >= Math.min(session.expiresAt,boundUntil)) throw new GuestBookingError(401,"booking/expired");
  }
  async #authorize(tx: Tx, session: GuestBookingSession, ratePlanId?: string): Promise<Date> {
    if (!this.#sessions.has(session)) return denied();
    let now: Date;
    try {
      now = await this.#authority.authorize(tx, {
        tenantId: session.tenantId, propertyNode: session.propertyNode, actorId: session.actorId,
        primaryPartyId: session.primaryPartyId, ...(ratePlanId === undefined ? {} : { ratePlanId }),
      });
    } catch (error) {
      if (error instanceof GuestBookingAuthorityError) return denied(); throw error;
    }
    if (Math.floor(now.getTime()/1000) >= session.expiresAt || Math.floor(now.getTime()/1000) < session.issuedAt) {
      throw new GuestBookingError(401, "booking/expired");
    }
    return now;
  }
  /** Property-local display authority for constructing a stay; carries no booking promise. */
  async context(tx: Tx, session: GuestBookingSession, body: unknown): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    record(body, []);
    await this.#authorize(tx, session);
    type ContextRow = {
      tenant_id: string; property_id: string; property_name: string; property_timezone: string;
      rate_plan_id: string | null; rate_plan_code: string | null; rate_plan_name: string | null;
      unit_type_id: string | null; unit_type_code: string | null; unit_type_name: string | null;
      sellable_unit_id: string | null; sellable_unit_name: string | null;
    };
    const rows = await tx<ContextRow[]>`
      SELECT property.tenant_id::text AS tenant_id,
             property.id::text AS property_id,
             property.name AS property_name,
             property.timezone AS property_timezone,
             plan.id::text AS rate_plan_id,
             plan.code AS rate_plan_code,
             plan.name AS rate_plan_name,
             unit.id::text AS unit_type_id,
             unit.code AS unit_type_code,
             unit.name AS unit_type_name,
             sellable.id::text AS sellable_unit_id,
             sellable.name AS sellable_unit_name
      FROM public.org_node AS property
      LEFT JOIN public.rate_plan AS plan
        ON plan.tenant_id = property.tenant_id
       AND plan.property_node = property.id
       AND plan.id IN ${tx(session.ratePlanIds)}
       AND plan.status = 'active'
      LEFT JOIN public.unit_type AS unit
        ON unit.tenant_id = property.tenant_id
       AND unit.property_node = property.id
       AND plan.id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.rate_price AS price
         WHERE price.tenant_id = property.tenant_id
           AND price.rate_plan_id = plan.id
           AND price.unit_type_id = unit.id
           AND price.superseded_by IS NULL
       )
      LEFT JOIN public.sellable_unit AS sellable
        ON sellable.tenant_id = unit.tenant_id
       AND sellable.unit_type_id = unit.id
       AND sellable.status = 'active'
      WHERE property.tenant_id = ${session.tenantId}::uuid
        AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property.id = ${session.propertyNode}::uuid
        AND property.kind = 'property'
      ORDER BY plan.code, unit.sort_order, unit.code, sellable.name, sellable.id
      LIMIT ${MAX_CONTEXT_UNIT_ROWS + 1}
    `;
    if (rows.length === 0 || rows.length > MAX_CONTEXT_UNIT_ROWS) {
      if (rows.length > MAX_CONTEXT_UNIT_ROWS) throw new GuestBookingError(503, "service/unavailable");
      return denied();
    }
    const first = rows[0]!;
    if (first.tenant_id !== session.tenantId || first.property_id !== session.propertyNode) return denied();
    const property = Object.freeze({
      id: uuid(first.property_id),
      name: displayName(first.property_name),
      timeZone: ianaTimeZone(first.property_timezone),
    });
    const plans = new Map<string, {
      id: string; code: string; name: string;
      unitTypes: Map<string, { id: string; code: string; name: string; units: Map<string, { id: string; name: string }> }>;
    }>();
    for (const row of rows) {
      if (row.tenant_id !== session.tenantId || row.property_id !== session.propertyNode ||
          row.property_name !== first.property_name || row.property_timezone !== first.property_timezone) return denied();
      if (row.rate_plan_id === null) {
        if (row.rate_plan_code !== null || row.rate_plan_name !== null || row.unit_type_id !== null ||
            row.unit_type_code !== null || row.unit_type_name !== null || row.sellable_unit_id !== null ||
            row.sellable_unit_name !== null) return denied();
        continue;
      }
      const planId = uuid(row.rate_plan_id);
      if (!session.ratePlanIds.includes(planId) || row.rate_plan_code === null || row.rate_plan_name === null) return denied();
      let plan = plans.get(planId);
      if (!plan) {
        if (!DISPLAY_CODE.test(row.rate_plan_code)) return denied();
        plan = { id: planId, code: row.rate_plan_code, name: displayName(row.rate_plan_name), unitTypes: new Map() };
        plans.set(planId, plan);
      } else if (plan.code !== row.rate_plan_code || plan.name !== row.rate_plan_name) return denied();
      if (row.unit_type_id === null) {
        if (row.unit_type_code !== null || row.unit_type_name !== null || row.sellable_unit_id !== null ||
            row.sellable_unit_name !== null) return denied();
        continue;
      }
      const unitTypeId = uuid(row.unit_type_id);
      if (row.unit_type_code === null || !DISPLAY_CODE.test(row.unit_type_code) || row.unit_type_name === null) return denied();
      let unitType = plan.unitTypes.get(unitTypeId);
      if (!unitType) {
        unitType = { id: unitTypeId, code: row.unit_type_code, name: displayName(row.unit_type_name), units: new Map() };
        plan.unitTypes.set(unitTypeId, unitType);
      } else if (unitType.code !== row.unit_type_code || unitType.name !== row.unit_type_name) return denied();
      if (row.sellable_unit_id === null) {
        if (row.sellable_unit_name !== null) return denied();
        continue;
      }
      if (row.sellable_unit_name === null) return denied();
      const unitId = uuid(row.sellable_unit_id);
      const unitName = displayName(row.sellable_unit_name);
      const existingUnit = unitType.units.get(unitId);
      if (existingUnit && existingUnit.name !== unitName) return denied();
      unitType.units.set(unitId, { id: unitId, name: unitName });
    }
    if (plans.size !== session.ratePlanIds.length || session.ratePlanIds.some((id) => !plans.has(id))) return denied();
    for (const plan of plans.values()) await this.#authorize(tx, session, plan.id);
    await this.#fresh(tx, session);
    this.#ttl(session.expiresAt, 900);
    return Object.freeze({
      property,
      ratePlans: Object.freeze([...plans.values()].sort((a, b) => a.code.localeCompare(b.code)).map((plan) => Object.freeze({
        id: plan.id, code: plan.code, name: plan.name,
        unitTypes: Object.freeze([...plan.unitTypes.values()].sort((a, b) => a.code.localeCompare(b.code)).map((unitType) => Object.freeze({
          id: unitType.id, code: unitType.code, name: unitType.name,
          units: Object.freeze([...unitType.units.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
            .map((unit) => Object.freeze(unit))),
        }))),
      }))),
    });
  }
  async #event(tx: Tx, session: Pick<GuestBookingSession,"tenantId"|"propertyNode"|"actorId"|"sessionId"|"primaryPartyId">,
    requestId: string, eventType: string, entityType: string, entityId: string, details: Data): Promise<void> {
    const envelope = createAuditEnvelope({ tenantId:session.tenantId,propertyNode:session.propertyNode,actorId:session.actorId,requestId, operation: eventType });
    const payload = { sessionId: session.sessionId, primaryPartyId: session.primaryPartyId, ...details };
    const fact = await recordFact(tx, { entityType, entityId, envelope, payload });
    await this.#o.events.publish(tx, { tenantId: session.tenantId, propertyNode: session.propertyNode,
      businessDate: fact.businessDate, aggregateType: entityType, aggregateId: entityId, eventType,
      actorId: session.actorId, correlationId: requestId, payload });
  }
  async issue(tx: Tx, identity: { tenantId: string; actorId?: string; scopes?: readonly string[] }, propertyNode: string,
    body: unknown, idempotencyKey: string, requestId: string): Promise<unknown> {
    if (!identity.actorId || !GUEST_BOOKING_ISSUER_SCOPES.every((scope) => identity.scopes?.includes(scope))) return denied();
    const input = record(body, ["primaryPartyId", "channelCode", "ratePlanIds"]);
    const primaryPartyId = uuid(input.primaryPartyId);
    if (typeof input.channelCode !== "string" || !CHANNEL.test(input.channelCode) || !KEY.test(idempotencyKey) ||
        !Array.isArray(input.ratePlanIds) || input.ratePlanIds.length < 1 || input.ratePlanIds.length > 16 ||
        new Set(input.ratePlanIds).size !== input.ratePlanIds.length) return invalid();
    const base = { tenantId: uuid(identity.tenantId), propertyNode: uuid(propertyNode), actorId: uuid(identity.actorId),
      primaryPartyId, channelCode: input.channelCode, ratePlanIds: Object.freeze(input.ratePlanIds.map(uuid).sort()) };
    let now: Date;
    try { now = await this.#authority.authorize(tx, base); } catch (error) {
      if (error instanceof GuestBookingAuthorityError) return denied(); throw error;
    }
    for (const planId of base.ratePlanIds) {
      let plan;
      try { plan = await this.#o.rates.getRatePlan(tx, base.propertyNode, planId); } catch (error) {
        if (error instanceof RateNotFoundError) return denied(); throw error;
      }
      if (plan.status !== "active" || plan.tenantId !== base.tenantId || plan.propertyNode !== base.propertyNode) return denied();
    }
    const outcome = await this.#o.idempotency.execute(tx, { tenantId: base.tenantId,
      operation: "guest.booking.invitation.issue", key: idempotencyKey, request: base }, async (commandTx) => {
      const claims = { ...base, sessionId: randomUUID(), validFrom: Math.floor(now.getTime()/1000), validUntil: Math.floor(now.getTime()/1000)+900 };
      await this.#event(commandTx, claims, requestId, "guest_booking.invitation_issued", "party", primaryPartyId,
        { channelCode: claims.channelCode, ratePlanIds: claims.ratePlanIds, validUntil: claims.validUntil });
      return { status: 201, body: json(claims) };
    });
    const claims = outcome.body as Data;
    await this.#fresh(tx, {issuedAt:claims.validFrom as number,expiresAt:claims.validUntil as number});
    const token = this.#o.tokens.issue("session", claims, this.#ttl(claims.validUntil as number, 900));
    return { token, expiresAt: new Date((claims.validUntil as number)*1000).toISOString(), replayed: outcome.replayed };
  }
  #input(session: GuestBookingSession, value: unknown): ResolveRateQuoteInput {
    const s = stay(value, true);
    if (!s.ratePlanId || !s.sellableUnitId || !session.ratePlanIds.includes(s.ratePlanId)) return denied();
    return { propertyNode: session.propertyNode, ratePlanId: s.ratePlanId, sellableUnitId: s.sellableUnitId,
      stayStart: s.from, stayEnd: s.to, guests: { adults: s.adults, childAges: s.childAges },
      selectedPromotionCodes: [], commercial: {}, channelCode: session.channelCode };
  }
  #selection(input: ResolveRateQuoteInput): Data {
    return { stayStart: input.stayStart.toISOString(), stayEnd: input.stayEnd.toISOString(),
      adults: input.guests.adults, childAges: [...input.guests.childAges], sellableUnitId: input.sellableUnitId, ratePlanId: input.ratePlanId };
  }
  async #lock(tx: Tx, session: GuestBookingSession, ratePlanId: string): Promise<void> {
    const key = `rate-plan-release:${session.tenantId}:${ratePlanId}`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
    try { await this.#authority.authorize(tx, { ...session, ratePlanId }); } catch (error) {
      if (error instanceof GuestBookingAuthorityError) return denied(); throw error;
    }
  }
  async #planHash(tx: Tx, session: GuestBookingSession, ratePlanId: string): Promise<string> {
    const plan = await this.#o.rates.getRatePlan(tx, session.propertyNode, ratePlanId);
    const policyIds = [plan.cancellationPolicyId, plan.guaranteePolicyId, plan.depositPolicyId].filter((id): id is string => id !== null);
    const policies = [];
    for (const id of policyIds) policies.push(await this.#o.rates.getPolicy(tx, id));
    return digest({ plan, policies });
  }
  async offers(tx: Tx, session: GuestBookingSession, body: unknown): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    const s = stay(body, false); await this.#authorize(tx, session); const codes = [];
    for (const id of [...session.ratePlanIds].sort()) {
      await this.#lock(tx,session,id);
      const plan = await this.#o.rates.getRatePlan(tx, session.propertyNode, id);
      if (plan.status !== "active") return denied(); codes.push(plan.code);
    }
    const result = await this.#o.offers.search(tx, { propertyNode: session.propertyNode, stayStart: s.from, stayEnd: s.to,
      guests: { adults: s.adults, childAges: s.childAges }, channelCode: session.channelCode,
      ratePlanCodes: codes, commercial: {} });
    if (result.options.some(option => !session.ratePlanIds.includes(option.ratePlan.id)) ||
        result.issues?.some(issue => !session.ratePlanIds.includes(issue.ratePlanId))) return denied();
    await this.#fresh(tx,session); return result;
  }
  async quote(tx: Tx, session: GuestBookingSession, body: unknown): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    const input = this.#input(session, body), now = await this.#authorize(tx, session);
    await this.#lock(tx, session, input.ratePlanId);
    const planHash = await this.#planHash(tx, session, input.ratePlanId);
    const quote = await this.#o.quotes.resolve(tx, input);
    if (!quote.availabilityOption.bookable || quote.result.state !== "quoted" || quote.tenantId !== session.tenantId) return stale();
    const validUntil = Math.min(session.expiresAt, Math.floor(now.getTime()/1000)+300,Math.floor(this.#now()/1000)+300);
    const selection = { sessionId: session.sessionId, input: this.#selection(input), termsHash: guestBookingTermsFingerprint(quote),
      planHash, releaseId: quote.releaseId, releaseVersion: quote.releaseVersion, releaseContentHash: quote.releaseContentHash,
      quoteHash: quote.quoteHash, validUntil };
    await this.#fresh(tx,session,validUntil);
    return { quote, quoteToken: this.#o.tokens.issue("quote", selection, this.#ttl(validUntil, 300)),
      expiresAt: new Date(validUntil*1000).toISOString(), paymentAccepted: false };
  }
  #boundToken(session: GuestBookingSession, body: unknown, purpose: "quote"|"hold", now: Date): Data {
    const name = purpose === "quote" ? "quoteToken" : "holdToken", value = record(body, [name])[name];
    if (typeof value !== "string") return invalid();
    const token = this.#o.tokens.verify(purpose, value);
    if (!token) throw new GuestBookingError(401, "booking/expired");
    const p = record(token.payload, ["sessionId", "input", "termsHash", "planHash", "releaseId", "releaseVersion", "releaseContentHash", "quoteHash", "validUntil", ...(purpose === "hold" ? ["holdId"] : [])]);
    if (p.sessionId !== session.sessionId || !Number.isSafeInteger(p.validUntil) ||
        (p.validUntil as number) > Math.min(session.expiresAt,token.expiresAt) || Math.floor(now.getTime()/1000) >= (p.validUntil as number)) return denied();
    for (const key of ["termsHash","planHash","releaseContentHash","quoteHash"]) if (typeof p[key] !== "string" || !HASH.test(p[key] as string)) return invalid();
    uuid(p.releaseId); if (!Number.isSafeInteger(p.releaseVersion) || (p.releaseVersion as number) < 1) return invalid();
    if (purpose === "hold") uuid(p.holdId);
    this.#input(session, p.input); return p;
  }
  async hold(tx: Tx, session: GuestBookingSession, body: unknown, requestId: string): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    const captured = { quoteToken: record(body, ["quoteToken"]).quoteToken };
    const now = await this.#authorize(tx, session), p = this.#boundToken(session, captured, "quote", now);
    const input = this.#input(session, p.input);
    const outcome = await this.#o.idempotency.execute(tx, { tenantId: session.tenantId, operation: "guest.booking.hold",
      key: `guest-hold:${session.sessionId}`, request: p }, async (commandTx) => {
      const quotedHolds = new QuotedTaxHoldBindingService({ holds: this.#o.holds, attributions: this.#o.attributions,
        events: this.#o.events, idempotency: this.#o.idempotency, quotes: { resolve: async (quoteTx, q) => {
          await this.#lock(quoteTx, session, q.ratePlanId);
          const planHash = await this.#planHash(quoteTx, session, q.ratePlanId);
          const live = await this.#o.quotes.resolve(quoteTx, q);
          if (planHash !== p.planHash || guestBookingTermsFingerprint(live) !== p.termsHash) return stale();
          await this.#fresh(quoteTx,session,p.validUntil as number);
          return live;
        } } });
      await this.#fresh(commandTx,session,p.validUntil as number);
      if (session.expiresAt - Math.floor(now.getTime()/1000) < 600) throw new GuestBookingError(401,"booking/expired");
      const receipt = await quotedHolds.place(commandTx, { tenantId: session.tenantId, propertyNode: session.propertyNode,
        quote: input, ttlSeconds: 600,
        idempotencyKey: `guest-tax-hold:${session.sessionId}`,
        envelope: createAuditEnvelope({ tenantId:session.tenantId,propertyNode:session.propertyNode,actorId:session.actorId,requestId, operation: "tax.attribution_bound" }) });
      if (!receipt.created || receipt.replayed) return stale(); // Never adopt a prior session's snapshot/hold.
      const holds = await commandTx<{expires_at:Date}[]>`SELECT expires_at FROM hold
        WHERE tenant_id=${session.tenantId}::uuid AND tenant_id=current_setting('app.tenant_id',true)::uuid
        AND property_node=${session.propertyNode}::uuid AND id=${receipt.holdId}::uuid AND status='active' FOR SHARE`;
      const expiry = holds[0]?.expires_at; if (!(expiry instanceof Date)) return stale();
      const payload = { ...p, holdId: receipt.holdId, validUntil: Math.min(session.expiresAt, Math.floor(expiry.getTime()/1000)) };
      await this.#event(commandTx, session, requestId, "guest_booking.hold_accepted", "hold", receipt.holdId,
        { bindingId: receipt.bindingId, termsHash: p.termsHash });
      return { status: 201, body: json({ payload, receipt, expiresAt: expiry.toISOString() }) };
    });
    const result = outcome.body as Data, payload = result.payload as Data;
    await this.#fresh(tx,session,Math.min(payload.validUntil as number,p.validUntil as number));
    return { hold: result.receipt, expiresAt: result.expiresAt, replayed: outcome.replayed,
      holdToken: this.#o.tokens.issue("hold", payload, this.#ttl(payload.validUntil as number, 900)) };
  }
  async reserve(tx: Tx, session: GuestBookingSession, body: unknown, requestId: string): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    const captured = { holdToken: record(body, ["holdToken"]).holdToken };
    const now = await this.#authorize(tx, session), p = this.#boundToken(session, captured, "hold", now), input = this.#input(session, p.input);
    const outcome = await this.#o.idempotency.execute(tx, { tenantId: session.tenantId, operation: "guest.booking.reserve",
      key: `guest-reserve:${session.sessionId}`, request: p }, async (commandTx) => {
      await this.#lock(commandTx, session, input.ratePlanId);
      const release = await this.#o.publication.getActiveRelease(commandTx, session.propertyNode, input.ratePlanId);
      if (release.id !== p.releaseId || release.extensionVersion !== p.releaseVersion || release.contentHash !== p.releaseContentHash ||
          await this.#planHash(commandTx, session, input.ratePlanId) !== p.planHash) return stale();
      await this.#fresh(commandTx,session,p.validUntil as number);
      const reservation = await this.#o.reservations.commitHeld(commandTx, { holdId: p.holdId as string,
        primaryPartyId: session.primaryPartyId, ratePlanId: input.ratePlanId, adults: input.guests.adults,
        childAges: input.guests.childAges, channelCode: session.channelCode,
        idempotencyKey: `guest-confirm:${session.sessionId}`,
        envelope: createAuditEnvelope({ tenantId:session.tenantId,propertyNode:session.propertyNode,actorId:session.actorId,requestId, operation: "reservation.confirmed" }) });
      await this.#event(commandTx, session, requestId, "guest_booking.reservation_confirmed", "reservation", reservation.reservationId,
        { holdId: p.holdId });
      return { status: 201, body: json({ reservation }) };
    });
    await this.#fresh(tx,session,p.validUntil as number);
    return { ...(outcome.body as Data), replayed: outcome.replayed, paymentAccepted: false };
  }
}
