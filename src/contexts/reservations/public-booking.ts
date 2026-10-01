import { randomUUID } from "node:crypto";
import {
  PublicBookingSiteAuthority, PublicBookingSiteError, type PublicBookingSiteContext, GuestBookingAuthority, GuestBookingAuthorityError,
  GuestBookingTokenSigner,
} from "../identity";
import { PartyDuplicateReviewRequiredError, PartyProfileValidationError, type PartyProfileService } from "../crm";
import type { HoldService } from "../inventory";
import { RateNotFoundError, type RateConfigurationService, type RatePublicationService, type RateQuote, type RateQuoteService, type ResolveRateQuoteInput } from "../rates";
import { QuotedTaxHoldBindingService, type TaxAttributionPersistenceService } from "../tax-fiscal";
import { createAuditEnvelope, recordFact, type AuditEnvelope, type EventBus, type JsonValue, type PostgresIdempotency, type Tx } from "../../kernel";
import {guestBookingTermsFingerprint as publicBookingTermsFingerprint} from "./guest-booking";
import type { ReservationCommitService } from "./commit";
import type { ReservationOfferSearchService } from "./offers";

type Data = Readonly<Record<string, unknown>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const CHANNEL = /^[a-z][a-z0-9._-]{0,63}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;

export class PublicBookingError extends Error {
  constructor(readonly status: number, readonly code: string) { super("Guest booking request could not be completed"); this.name = "PublicBookingError"; }
}
function invalid(): never { throw new PublicBookingError(400, "booking/invalid"); }
function denied(): never { throw new PublicBookingError(403, "booking/unavailable"); }
function stale(): never { throw new PublicBookingError(409, "booking/quote_changed"); }
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
export interface PublicBookingSession {
  readonly tenantId: string; readonly propertyNode: string; readonly actorId: string;
  readonly siteId: string; readonly siteVersion: number; readonly ratePlanIds: readonly string[]; readonly channelCode: string;
  readonly sessionId: string; readonly issuedAt: number; readonly expiresAt: number;
}
export interface PublicBookingServiceOptions {
  readonly tokens: GuestBookingTokenSigner;
  readonly authority?: Pick<PublicBookingSiteAuthority, "authorize">;
  readonly parties: Pick<PartyProfileService, "create">;
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

export class PublicBookingService {
  readonly #o: PublicBookingServiceOptions;
  readonly #authority: Pick<PublicBookingSiteAuthority, "authorize">;
  readonly #sessions = new WeakSet<object>();
  readonly #now: () => number;
  constructor(options: PublicBookingServiceOptions) {
    this.#o = options; this.#authority = options.authority ?? new PublicBookingSiteAuthority(); this.#now = options.now ?? Date.now;
  }
  #ttl(expiresAt: number, limit: number): number {
    const ttl = Math.min(limit, expiresAt - Math.floor(this.#now() / 1000));
    if (ttl < 1) throw new PublicBookingError(401, "booking/expired");
    return ttl;
  }
  authenticate(token: string): PublicBookingSession | null {
    const verified = this.#o.tokens.verify("public-session", token);
    if (!verified) return null;
    try {
      const v = record(verified.payload, ["tenantId", "propertyNode", "actorId", "siteId", "siteVersion", "ratePlanIds", "channelCode", "sessionId", "validFrom", "validUntil"]);
      if (!Number.isSafeInteger(v.siteVersion) || (v.siteVersion as number)<1 || !Array.isArray(v.ratePlanIds) || v.ratePlanIds.length < 1 || v.ratePlanIds.length > 16 ||
          new Set(v.ratePlanIds).size !== v.ratePlanIds.length || typeof v.channelCode !== "string" || !CHANNEL.test(v.channelCode) ||
          !Number.isSafeInteger(v.validFrom) || !Number.isSafeInteger(v.validUntil) ||
          (v.validUntil as number) <= (v.validFrom as number) || (v.validUntil as number) - (v.validFrom as number) > 900) return null;
      const session: PublicBookingSession = Object.freeze({ tenantId: uuid(v.tenantId), propertyNode: uuid(v.propertyNode),
        actorId: uuid(v.actorId), siteId: uuid(v.siteId), siteVersion: v.siteVersion as number, sessionId: uuid(v.sessionId),
        ratePlanIds: Object.freeze(v.ratePlanIds.map(uuid)), channelCode: v.channelCode,
        issuedAt: v.validFrom as number, expiresAt: Math.min(v.validUntil as number, verified.expiresAt) });
      this.#ttl(session.expiresAt, 900); this.#sessions.add(session); return session;
    } catch { return null; }
  }
  async #fresh(tx: Tx, session: Pick<PublicBookingSession,"issuedAt"|"expiresAt">, boundUntil = session.expiresAt): Promise<void> {
    const rows = await tx<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    const now = rows[0]?.now;
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new PublicBookingError(503, "service/unavailable");
    const seconds = Math.floor(now.getTime()/1000);
    if (seconds < session.issuedAt || seconds >= Math.min(session.expiresAt,boundUntil)) throw new PublicBookingError(401,"booking/expired");
  }
  async #authorize(tx: Tx, session: PublicBookingSession): Promise<Date> {
    if (!this.#sessions.has(session)) return denied();
    let now: Date;
    try {
      const live = await this.#authority.authorize(tx, session.siteId, session.siteVersion);
      this.#sameSite(session, live); now=live.now;
    } catch (error) {
      if (error instanceof PublicBookingSiteError && error.status===403) return denied(); throw error;
    }
    if (Math.floor(now.getTime()/1000) >= session.expiresAt || Math.floor(now.getTime()/1000) < session.issuedAt) {
      throw new PublicBookingError(401, "booking/expired");
    }
    return now;
  }
  #sameSite(session: PublicBookingSession, live: PublicBookingSiteContext): void {
    if (live.tenantId!==session.tenantId || live.propertyNode!==session.propertyNode ||
        live.site.issuerId!==session.actorId || live.site.channelCode!==session.channelCode ||
        canonical([...live.site.ratePlanIds].sort())!==canonical([...session.ratePlanIds].sort())) return denied();
  }
  async start(tx: Tx, siteId: string, version: number): Promise<unknown> {
    let live;
    try { live=await this.#authority.authorize(tx, uuid(siteId), version); }
    catch(error){ if(error instanceof PublicBookingSiteError && error.status===403) return denied(); throw error; }
    const issuedAt=Math.floor(live.now.getTime()/1000),expiresAt=issuedAt+900;
    const claims={tenantId:live.tenantId,propertyNode:live.propertyNode,actorId:live.site.issuerId,
      siteId:live.site.siteId,siteVersion:live.site.version,ratePlanIds:[...live.site.ratePlanIds],
      channelCode:live.site.channelCode,sessionId:randomUUID(),validFrom:issuedAt,validUntil:expiresAt};
    await this.#fresh(tx,{issuedAt,expiresAt});
    return {token:this.#o.tokens.issue("public-session",claims,this.#ttl(expiresAt,900)),
      expiresAt:new Date(expiresAt*1000).toISOString(),property:{id:live.propertyNode,name:live.propertyName,timeZone:live.timeZone},
      paymentAccepted:false};
  }
  async #event(tx: Tx, session: PublicBookingSession, requestId: string, eventType: string,
    entityType: string, entityId: string, details: Data): Promise<void> {
    const envelope=createAuditEnvelope({tenantId:session.tenantId,propertyNode:session.propertyNode,
      actorId:session.actorId,requestId,operation:eventType});
    const payload={sessionId:session.sessionId,siteId:session.siteId,siteVersion:session.siteVersion,...details};
    const fact=await recordFact(tx,{entityType,entityId,envelope,payload});
    await this.#o.events.publish(tx,{tenantId:session.tenantId,propertyNode:session.propertyNode,
      businessDate:fact.businessDate,aggregateType:entityType,aggregateId:entityId,eventType,
      actorId:session.actorId,correlationId:requestId,payload});
  }
  #input(session: PublicBookingSession, value: unknown): ResolveRateQuoteInput {
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
  async #lock(tx: Tx, session: PublicBookingSession, ratePlanId: string): Promise<void> {
    const key = `rate-plan-release:${session.tenantId}:${ratePlanId}`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
    try { const live=await this.#authority.authorize(tx,session.siteId,session.siteVersion,ratePlanId);
      this.#sameSite(session,live); } catch (error) {
      if (error instanceof PublicBookingSiteError && error.status===403) return denied(); throw error;
    }
  }
  async #planHash(tx: Tx, session: PublicBookingSession, ratePlanId: string): Promise<string> {
    const plan = await this.#o.rates.getRatePlan(tx, session.propertyNode, ratePlanId);
    const policyIds = [plan.cancellationPolicyId, plan.guaranteePolicyId, plan.depositPolicyId].filter((id): id is string => id !== null);
    const policies = [];
    for (const id of policyIds) policies.push(await this.#o.rates.getPolicy(tx, id));
    return digest({ plan, policies });
  }
  async offers(tx: Tx, session: PublicBookingSession, body: unknown): Promise<unknown> {
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
  async quote(tx: Tx, session: PublicBookingSession, body: unknown): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    const input = this.#input(session, body), now = await this.#authorize(tx, session);
    await this.#lock(tx, session, input.ratePlanId);
    const planHash = await this.#planHash(tx, session, input.ratePlanId);
    const quote = await this.#o.quotes.resolve(tx, input);
    if (!quote.availabilityOption.bookable || quote.result.state !== "quoted" || quote.tenantId !== session.tenantId) return stale();
    const validUntil = Math.min(session.expiresAt, Math.floor(now.getTime()/1000)+300,Math.floor(this.#now()/1000)+300);
    const selection = { sessionId: session.sessionId, input: this.#selection(input), termsHash: publicBookingTermsFingerprint(quote),
      planHash, releaseId: quote.releaseId, releaseVersion: quote.releaseVersion, releaseContentHash: quote.releaseContentHash,
      quoteHash: quote.quoteHash, validUntil };
    await this.#fresh(tx,session,validUntil);
    return { quote, quoteToken: this.#o.tokens.issue("public-quote", selection, this.#ttl(validUntil, 300)),
      expiresAt: new Date(validUntil*1000).toISOString(), paymentAccepted: false };
  }
  #boundToken(session: PublicBookingSession, body: unknown, purpose: "quote"|"hold", now: Date): Data {
    const name = purpose === "quote" ? "quoteToken" : "holdToken", value = record(body, [name])[name];
    if (typeof value !== "string") return invalid();
    const token = this.#o.tokens.verify(purpose === "quote" ? "public-quote" : "public-hold", value);
    if (!token) throw new PublicBookingError(401, "booking/expired");
    const p = record(token.payload, ["sessionId", "input", "termsHash", "planHash", "releaseId", "releaseVersion", "releaseContentHash", "quoteHash", "validUntil", ...(purpose === "hold" ? ["holdId"] : [])]);
    if (p.sessionId !== session.sessionId || !Number.isSafeInteger(p.validUntil) ||
        (p.validUntil as number) > Math.min(session.expiresAt,token.expiresAt) || Math.floor(now.getTime()/1000) >= (p.validUntil as number)) return denied();
    for (const key of ["termsHash","planHash","releaseContentHash","quoteHash"]) if (typeof p[key] !== "string" || !HASH.test(p[key] as string)) return invalid();
    uuid(p.releaseId); if (!Number.isSafeInteger(p.releaseVersion) || (p.releaseVersion as number) < 1) return invalid();
    if (purpose === "hold") uuid(p.holdId);
    this.#input(session, p.input); return p;
  }
  async hold(tx: Tx, session: PublicBookingSession, body: unknown, requestId: string): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    const captured = { quoteToken: record(body, ["quoteToken"]).quoteToken };
    const now = await this.#authorize(tx, session), p = this.#boundToken(session, captured, "quote", now);
    const input = this.#input(session, p.input);
    const outcome = await this.#o.idempotency.execute(tx, { tenantId: session.tenantId, operation: "public.booking.hold",
      key: `public-hold:${session.sessionId}`, request: p }, async (commandTx) => {
      const quotedHolds = new QuotedTaxHoldBindingService({ holds: this.#o.holds, attributions: this.#o.attributions,
        events: this.#o.events, idempotency: this.#o.idempotency, quotes: { resolve: async (quoteTx, q) => {
          await this.#lock(quoteTx, session, q.ratePlanId);
          const planHash = await this.#planHash(quoteTx, session, q.ratePlanId);
          const live = await this.#o.quotes.resolve(quoteTx, q);
          if (planHash !== p.planHash || publicBookingTermsFingerprint(live) !== p.termsHash) return stale();
          await this.#fresh(quoteTx,session,p.validUntil as number);
          return live;
        } } });
      await this.#fresh(commandTx,session,p.validUntil as number);
      if (session.expiresAt - Math.floor(now.getTime()/1000) < 600) throw new PublicBookingError(401,"booking/expired");
      const receipt = await quotedHolds.place(commandTx, { tenantId: session.tenantId, propertyNode: session.propertyNode,
        quote: input, ttlSeconds: 600,
        idempotencyKey: `public-tax-hold:${session.sessionId}`,
        envelope: createAuditEnvelope({ tenantId:session.tenantId,propertyNode:session.propertyNode,actorId:session.actorId,requestId, operation: "tax.attribution_bound" }) });
      if (!receipt.created || receipt.replayed) return stale(); // Never adopt a prior session's snapshot/hold.
      const holds = await commandTx<{expires_at:Date}[]>`SELECT expires_at FROM hold
        WHERE tenant_id=${session.tenantId}::uuid AND tenant_id=current_setting('app.tenant_id',true)::uuid
        AND property_node=${session.propertyNode}::uuid AND id=${receipt.holdId}::uuid AND status='active' FOR SHARE`;
      const expiry = holds[0]?.expires_at; if (!(expiry instanceof Date)) return stale();
      const payload = { ...p, holdId: receipt.holdId, validUntil: Math.min(session.expiresAt, Math.floor(expiry.getTime()/1000)) };
      await this.#event(commandTx, session, requestId, "public_booking.hold_accepted", "hold", receipt.holdId,
        { bindingId: receipt.bindingId, termsHash: p.termsHash });
      return { status: 201, body: json({ payload, receipt, expiresAt: expiry.toISOString() }) };
    });
    const result = outcome.body as Data, payload = result.payload as Data;
    await this.#fresh(tx,session,Math.min(payload.validUntil as number,p.validUntil as number));
    return { hold: result.receipt, expiresAt: result.expiresAt, replayed: outcome.replayed,
      holdToken: this.#o.tokens.issue("public-hold", payload, this.#ttl(payload.validUntil as number, 900)) };
  }
  async details(tx:Tx,session:PublicBookingSession,body:unknown,requestId:string):Promise<unknown>{
    if(!this.#sessions.has(session)) return denied();
    const b=record(body,["holdToken","displayName","email","phone"]);
    const captured={holdToken:b.holdToken};
    if(typeof b.displayName!=="string" || b.displayName.length<1 || b.displayName.length>200 ||
      (b.email!==null && (typeof b.email!=="string" || b.email.length>320)) ||
      (b.phone!==null && (typeof b.phone!=="string" || b.phone.length>40)) || (b.email===null&&b.phone===null))return invalid();
    const displayName=b.displayName as string;
    const contacts=[...(b.email===null?[]:[{kind:"email" as const,value:b.email as string,isPrimary:true}]),
      ...(b.phone===null?[]:[{kind:"phone" as const,value:b.phone as string,isPrimary:b.email===null}])];
    const now=await this.#authorize(tx,session),p=this.#boundToken(session,captured,"hold",now);
    const outcome=await this.#o.idempotency.execute(tx,{tenantId:session.tenantId,operation:"public.booking.details",
      key:`public-details:${session.sessionId}`,request:{hold:p,displayName,contacts}},async(commandTx)=>{
      await this.#lock(commandTx,session,this.#input(session,p.input).ratePlanId);
      const holds=await commandTx<{id:string}[]>`SELECT id FROM hold WHERE tenant_id=${session.tenantId}::uuid
        AND property_node=${session.propertyNode}::uuid AND id=${p.holdId as string}::uuid
        AND status='active' AND expires_at>clock_timestamp() FOR SHARE`;
      if(holds.length!==1)return stale();
      let created;
      try{created=await this.#o.parties.create(commandTx,{kind:"person",displayName,
        roles:["guest"],contacts,acknowledgedDuplicatePartyIds:[],idempotencyKey:`public-party:${session.sessionId}`,
        envelope:createAuditEnvelope({tenantId:session.tenantId,propertyNode:session.propertyNode,
          actorId:session.actorId,requestId,operation:"party.created"})});}
      catch(error){if(error instanceof PartyDuplicateReviewRequiredError)throw new PublicBookingError(409,"booking/guest_review_required");
        if(error instanceof PartyProfileValidationError)return invalid();throw error;}
      await this.#fresh(commandTx,session,p.validUntil as number);
      return {status:201,body:json({primaryPartyId:created.party.partyId,holdId:p.holdId,
        sessionId:session.sessionId,holdHash:digest(p),validUntil:p.validUntil})};
    });
    const payload=outcome.body as Data;
    await this.#fresh(tx,session,p.validUntil as number);
    return {detailsToken:this.#o.tokens.issue("public-details",payload,this.#ttl(payload.validUntil as number,900)),
      expiresAt:new Date((payload.validUntil as number)*1000).toISOString(),replayed:outcome.replayed};
  }
  async reserve(tx: Tx, session: PublicBookingSession, body: unknown, requestId: string): Promise<unknown> {
    if (!this.#sessions.has(session)) return denied();
    const b=record(body,["holdToken","detailsToken"]);
    const captured={holdToken:b.holdToken};
    if(typeof b.detailsToken!=="string")return invalid();
    const details=this.#o.tokens.verify("public-details",b.detailsToken);
    if(!details)throw new PublicBookingError(401,"booking/expired");
    const d=record(details.payload,["primaryPartyId","holdId","sessionId","holdHash","validUntil"]);
    const primaryPartyId=uuid(d.primaryPartyId);
    if(!Number.isSafeInteger(d.validUntil) || (d.validUntil as number)>Math.min(session.expiresAt,details.expiresAt))return denied();
    const now = await this.#authorize(tx, session), p = this.#boundToken(session, captured, "hold", now), input = this.#input(session, p.input);
    if(d.sessionId!==session.sessionId || d.holdId!==p.holdId || d.holdHash!==digest(p) || d.validUntil!==p.validUntil)return denied();
    const outcome = await this.#o.idempotency.execute(tx, { tenantId: session.tenantId, operation: "public.booking.reserve",
      key: `public-reserve:${session.sessionId}`, request: {hold:p,primaryPartyId} }, async (commandTx) => {
      await this.#lock(commandTx, session, input.ratePlanId);
      const release = await this.#o.publication.getActiveRelease(commandTx, session.propertyNode, input.ratePlanId);
      if (release.id !== p.releaseId || release.extensionVersion !== p.releaseVersion || release.contentHash !== p.releaseContentHash ||
          await this.#planHash(commandTx, session, input.ratePlanId) !== p.planHash) return stale();
      await this.#fresh(commandTx,session,p.validUntil as number);
      try {await new GuestBookingAuthority().authorize(commandTx,{tenantId:session.tenantId,propertyNode:session.propertyNode,actorId:session.actorId,primaryPartyId,ratePlanId:input.ratePlanId});}
      catch(error){if(error instanceof GuestBookingAuthorityError)return denied();throw error;}
      const reservation = await this.#o.reservations.commitHeld(commandTx, { holdId: p.holdId as string,
        primaryPartyId, ratePlanId: input.ratePlanId, adults: input.guests.adults,
        childAges: input.guests.childAges, channelCode: session.channelCode,
        idempotencyKey: `public-confirm:${session.sessionId}`,
        envelope: createAuditEnvelope({ tenantId:session.tenantId,propertyNode:session.propertyNode,actorId:session.actorId,requestId, operation: "reservation.confirmed" }) });
      await this.#event(commandTx, session, requestId, "public_booking.reservation_confirmed", "reservation", reservation.reservationId,
        { holdId: p.holdId });
      return { status: 201, body: json({ reservation }) };
    });
    await this.#fresh(tx,session,p.validUntil as number);
    return { ...(outcome.body as Data), replayed: outcome.replayed, paymentAccepted: false };
  }
}
