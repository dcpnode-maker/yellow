import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { PartyProfileService } from "../src/contexts/crm";
import { HoldService } from "../src/contexts/inventory";
import {
  PUBLIC_BOOKING_PUBLISHER_SCOPES,
  PublicBookingSiteAuthority,
  GuestBookingTokenSigner,
} from "../src/contexts/identity";
import {
  ReservationCommitService,
  ReservationOfferSearchService,
  PublicBookingError,
  PublicBookingService,
} from "../src/contexts/reservations";
import {
  RateConfigurationService,
  RateQuoteService,
  deriveRateEvaluationContext,
  evaluateRateModel,
  normalizeRateCompositionSpec,
  normalizeRateEvaluatorSpec,
  type ResolveRateQuoteInput,
} from "../src/contexts/rates";
import {
  TaxAttributionPersistenceService,
  type TaxJurisdictionResolutionResult,
} from "../src/contexts/tax-fiscal";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_PUBLIC_BOOKING_DEPLOY_URL;
const RUNTIME_URL = process.env.YELLOW_PUBLIC_BOOKING_RUNTIME_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_PUBLIC_BOOKING === "1";
if ((REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) || Boolean(DEPLOY_URL) !== Boolean(RUNTIME_URL)) {
  throw new Error("Public-booking integration proof requires both explicit owned deploy and runtime URLs");
}

function parseOwnedUrl(value: string, expectedUser: string): URL {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      decodeURIComponent(url.username) !== expectedUser || databaseName.length === 0 ||
      !databaseName.startsWith("yellow_guest_booking_site_proof")) {
    throw new Error("Public-booking proof URLs must target the owned proof database with the expected role");
  }
  return url;
}

if (DEPLOY_URL && RUNTIME_URL) {
  const deployTarget = parseOwnedUrl(DEPLOY_URL, "yellow_deploy");
  const runtimeTarget = parseOwnedUrl(RUNTIME_URL, "yellow_runtime");
  if (deployTarget.hostname !== runtimeTarget.hostname ||
      (deployTarget.port || "5432") !== (runtimeTarget.port || "5432") ||
      deployTarget.pathname !== runtimeTarget.pathname) {
    throw new Error("Public-booking deploy/runtime URLs must name the same host, port and owned database");
  }
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const uuid = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const DAY_MS = 86_400_000;
const TENANT = uuid(202610020001);
const FOREIGN_TENANT = uuid(202610020002);
const PROPERTY = uuid(202610020011);
const OTHER_PROPERTY = uuid(202610020012);
const FOREIGN_PROPERTY = uuid(202610020013);
const ACTOR = uuid(202610020021);
const PARTY = uuid(202610020022);
const FOREIGN_PARTY = uuid(202610020023);
const ROLE = uuid(202610020024);
const UNIT_TYPE = uuid(202610020031);
const SPACE = uuid(202610020032);
const SELLABLE = uuid(202610020033);
const RATE_PLAN = uuid(202610020041);
const OTHER_RATE_PLAN = uuid(202610020042);
const FOREIGN_RATE_PLAN = uuid(202610020043);
const POLICY = uuid(202610020044);
const RELEASE = uuid(202610020045);
const MODEL = uuid(202610020046);
const TARGET = uuid(202610020047);
const EXTENSION = uuid(202610020048);
const CHANNEL = "direct";
const TOKEN_SECRET = "public-booking-owned-proof-secret-minimum-32-bytes";
const POLICY_CONTENT = Object.freeze({
  kind: "cancellation",
  rules: Object.freeze([Object.freeze({
    before_hours: 24,
    penalty: Object.freeze({ basis: "nights", value: 1 }),
  })]),
});
const TAX_CONTENT = Object.freeze({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "line",
  taxes: Object.freeze([Object.freeze({
    code: "GST_ROOM",
    name: "GST on accommodation",
    mode: "percent",
    rate: 0.18,
    applies_to: Object.freeze(["room_revenue"]),
  })]),
});

type QuoteMode = "normal" | "price_drift" | "release_drift" | "partial_tax";
interface FixtureCounts {
  readonly holds: number;
  readonly occupancies: number;
  readonly reservations: number;
  readonly segments: number;
  readonly hold_bindings: number;
  readonly lineages: number;
  readonly attributions: number;
  readonly events: number;
  readonly facts: number;
  readonly parties: number;
  readonly party_roles: number;
  readonly contacts: number;
}
let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let service: PublicBookingService | undefined;
let publishedSite: { readonly siteId: string; readonly version: number; readonly active: boolean } | undefined;
let quoteMode: QuoteMode = "normal";
let clockNow = Date.now();

function stay(offset: number): Readonly<{ stayStart: string; stayEnd: string }> {
  const start = new Date(Date.UTC(2027, 0, 10 + offset, 15));
  return Object.freeze({ stayStart: start.toISOString(), stayEnd: new Date(start.getTime() + DAY_MS).toISOString() });
}

function requestBody(offset: number, ratePlanId = RATE_PLAN, sellableUnitId = SELLABLE) {
  return Object.freeze({ ...stay(offset), adults: 2, childAges: Object.freeze([8]), ratePlanId, sellableUnitId });
}

function dateAt(index: number): string {
  return new Date(Date.UTC(2027, 0, 10) + index * DAY_MS).toISOString().slice(0, 10);
}

function releaseSpec() {
  const releaseDrift = quoteMode === "release_drift";
  const evaluatorSpec = normalizeRateEvaluatorSpec({
    modelKey: "calendar",
    currency: "INR",
    base: { kind: "calendar", cells: Array.from({ length: 40 }, (_, index) => ({
      stayDate: dateAt(index),
      state: "open",
      amountMinor: quoteMode === "price_drift" ? 120_000n : 100_000n + BigInt(index),
    })) },
    gate: {},
    rules: [],
  });
  const compositionSpec = normalizeRateCompositionSpec({
    currency: "INR",
    guestEligibility: {
      minAdults: 1, maxAdults: 6, minChildren: 0, maxChildren: 4,
      minTotalGuests: 1, maxTotalGuests: 8,
    },
    package: null,
    promotions: [],
    policy: {
      cancellationPolicyId: POLICY,
      depositPolicyId: null,
      guaranteePolicyId: null,
      noShowPolicyId: null,
      refundTreatment: "policy",
    },
    distribution: { mode: "all", channelCodes: [] },
  });
  return Object.freeze({
    id: RELEASE,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    ratePlanId: RATE_PLAN,
    modelDraftId: MODEL,
    modelDraftVersion: 1,
    targetDraftId: TARGET,
    targetDraftVersion: 1,
    evaluatorSpec,
    compositionSpec,
    rmsBinding: null,
    contentHash: releaseDrift ? "e".repeat(64) : "b".repeat(64),
    extensionVersion: releaseDrift ? 2 : 1,
    status: "active" as const,
    undoOfVersion: null,
  });
}

function availabilityOption() {
  return Object.freeze({
    sellableUnitId: SELLABLE,
    sellableUnitName: "Guest Booking Proof Room",
    unitTypeId: UNIT_TYPE,
    unitTypeCode: "GBP-ROOM",
    unitTypeName: "Guest Booking Proof Room",
    profileKey: "hotel",
    maxOccupancy: 4,
    availableCount: 1,
    bookable: true,
    restrictionsApplied: Object.freeze([]),
    operationalBlocksApplied: Object.freeze([]),
  });
}

function quoteHarness() {
  const publication = {
    async getActiveRelease() { return releaseSpec(); },
    async evaluateReleaseNight(_tx: Tx, _releaseId: string, input: Readonly<Record<string, unknown>>) {
      const release = releaseSpec();
      const evaluationContext = deriveRateEvaluationContext({
        propertyTimeZone: input.propertyTimeZone,
        bookingInstant: input.bookingInstant,
        stayStartInstant: input.stayStartInstant,
        stayEndInstant: input.stayEndInstant,
        nightDate: input.nightDate,
      });
      return Object.freeze({
        release,
        targetResolution: null,
        evaluationContext,
        result: evaluateRateModel(release.evaluatorSpec, evaluationContext),
      });
    },
  };
  const availability = { async search() { return [availabilityOption()]; } };
  const taxResolver = {
    async resolve(_tx: Tx, input: Readonly<{ propertyNode: string; businessDate: string }>): Promise<TaxJurisdictionResolutionResult> {
      if (quoteMode === "partial_tax") return Object.freeze({
        state: "unassigned",
        tenantId: TENANT,
        propertyNode: PROPERTY,
        businessDate: input.businessDate,
        propertyTimezone: "UTC",
        businessDayFromInstant: `${input.businessDate}T00:00:00.000000Z`,
        businessDayToInstant: "2030-01-02T00:00:00.000000Z",
      });
      return Object.freeze({
        state: "resolved",
        tenantId: TENANT,
        propertyNode: PROPERTY,
        businessDate: input.businessDate,
        propertyTimezone: "UTC",
        businessDayFromInstant: `${input.businessDate}T00:00:00.000000Z`,
        businessDayToInstant: "2030-01-02T00:00:00.000000Z",
        assignment: Object.freeze({
          jurisdictionKey: "in.gst.hotel",
          effectiveFrom: "2027-01-01",
          effectiveTo: null,
          evidenceRef: `tax-assignment:${new Bun.CryptoHasher("sha256").update(input.businessDate).digest("hex")}`,
        }),
        jurisdiction: Object.freeze({
          extensionId: EXTENSION,
          ownerTenantId: TENANT,
          key: "in.gst.hotel",
          version: 1,
          content: TAX_CONTENT,
          contentHash: "c".repeat(64),
          effectiveFromInstant: "2027-01-01T00:00:00.000000Z",
          effectiveToInstant: null,
          evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
        }),
      });
    },
  };
  return Object.freeze({
    publication,
    availability,
    service: new RateQuoteService(
      publication as never,
      taxResolver as never,
      availability as never,
      { async occupancySignal() { return null; } } as never,
    ),
  });
}

class FailEventBus implements EventBus {
  constructor(readonly delegate: EventBus, readonly eventType: string) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    const result = await this.delegate.publish(tx, event);
    if (event.eventType === this.eventType) throw new Error(`Public-booking injected ${this.eventType} failure`);
    return result;
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function createService(bus: EventBus = events!, now: () => number = () => clockNow, quoteDelayMs = 0,
  onQuoteResolve?: () => void,
  authority?: Pick<PublicBookingSiteAuthority, "authorize">): PublicBookingService {
  const holds = new HoldService(bus);
  const rates = new RateConfigurationService(bus);
  const quote = quoteHarness();
  const quotes = {
    async resolve(...args: Parameters<RateQuoteService["resolve"]>) {
      onQuoteResolve?.();
      if (quoteDelayMs > 0) await Bun.sleep(quoteDelayMs);
      return quote.service.resolve(...args);
    },
  };
  const offers = new ReservationOfferSearchService(rates, quote.service, quote.availability as never);
  const attributions = new TaxAttributionPersistenceService({ events: bus, idempotency: new PostgresIdempotency() });
  const reservations = new ReservationCommitService({ holds, events: bus, idempotency: new PostgresIdempotency() });
  const parties = new PartyProfileService({ events: bus, idempotency: new PostgresIdempotency() });
  return new PublicBookingService({
    tokens: new GuestBookingTokenSigner(TOKEN_SECRET, { now }),
    offers,
    quotes,
    rates,
    publication: quote.publication as never,
    parties,
    holds,
    attributions,
    reservations,
    idempotency: new PostgresIdempotency(),
    events: bus,
    now,
    authority,
  });
}

async function publishSite(options: { active?: boolean; expectedVersion?: number; tenantId?: string; propertyNode?: string } = {}) {
  return database!.withTenantTransaction(options.tenantId ?? TENANT, (tx) =>
    new PublicBookingSiteAuthority().publish(tx, {
      tenantId: options.tenantId ?? TENANT, actorId: ACTOR, scopes: PUBLIC_BOOKING_PUBLISHER_SCOPES,
    }, options.propertyNode ?? PROPERTY, {
      expectedVersion: options.expectedVersion ?? 0,
      active: options.active ?? true,
      ratePlanIds: [options.tenantId === FOREIGN_TENANT ? FOREIGN_RATE_PLAN : RATE_PLAN],
      channelCode: CHANNEL,
    }, crypto.randomUUID()));
}

async function start(siteId: string, version: number, busService = service!) {
  return database!.withTenantTransaction(TENANT, async (tx) => {
    return busService.start(tx, siteId, version) as Promise<{
      readonly token: string;
      readonly expiresAt: string;
      readonly property: { readonly id: string; readonly name: string; readonly timeZone: string };
      readonly paymentAccepted: false;
    }>;
  });
}

async function ensurePublished() {
  if (!publishedSite) publishedSite = await publishSite();
  return publishedSite;
}

async function withSession<T>(token: string, operation: (tx: Tx, session: NonNullable<ReturnType<PublicBookingService["authenticate"]>>) => Promise<T>, busService = service!): Promise<T> {
  const session = busService.authenticate(token);
  if (!session) throw new Error("Guest-booking test token did not authenticate");
  return database!.withTenantTransaction(TENANT, (tx) => operation(tx, session));
}

async function offer(token: string, offset: number, busService = service!) {
  return withSession(token, (tx, session) => busService.offers(tx, session, {
    ...stay(offset), adults: 2, childAges: [8],
  }), busService);
}

async function quote(token: string, offset: number, ratePlanId = RATE_PLAN, sellableUnitId = SELLABLE, busService = service!) {
  return withSession(token, (tx, session) => busService.quote(tx, session, requestBody(offset, ratePlanId, sellableUnitId)), busService);
}

async function hold(token: string, quoteToken: string, requestId = crypto.randomUUID(), busService = service!) {
  const session = busService.authenticate(token);
  if (!session) throw new Error("Guest-booking test session did not authenticate");
  return database!.withTenantTransaction(TENANT, (tx) => busService.hold(tx, session, { quoteToken }, requestId));
}

async function details(token: string, holdToken: string, displayName: string, email: string | null, busService = service!) {
  const session = busService.authenticate(token);
  if (!session) throw new Error("Public-booking test session did not authenticate");
  return database!.withTenantTransaction(TENANT, (tx) => busService.details(tx, session, {
    holdToken, displayName, email, phone: null,
  }, crypto.randomUUID()));
}

async function reserve(token: string, holdToken: string, detailsToken: string, requestId = crypto.randomUUID(), busService = service!) {
  const session = busService.authenticate(token);
  if (!session) throw new Error("Public-booking test session did not authenticate");
  return database!.withTenantTransaction(TENANT, (tx) => busService.reserve(tx, session, { holdToken, detailsToken }, requestId));
}

async function fixtureCounts() {
  const rows = await deploy!<FixtureCounts[]>`SELECT
    (SELECT count(*)::int FROM hold WHERE tenant_id=${TENANT}::uuid) holds,
    (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid) occupancies,
    (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT}::uuid) reservations,
    (SELECT count(*)::int FROM reservation_segment WHERE tenant_id=${TENANT}::uuid) segments,
    (SELECT count(*)::int FROM tax_attribution_hold_binding WHERE tenant_id=${TENANT}::uuid) hold_bindings,
    (SELECT count(*)::int FROM tax_attribution_reservation_binding WHERE tenant_id=${TENANT}::uuid) lineages,
    (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT}::uuid) attributions,
    (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) events,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) facts,
    (SELECT count(*)::int FROM party WHERE tenant_id=${TENANT}::uuid) parties,
    (SELECT count(*)::int FROM party_role WHERE tenant_id=${TENANT}::uuid) party_roles,
    (SELECT count(*)::int FROM contact_point WHERE tenant_id=${TENANT}::uuid) contacts`;
  return rows[0]!;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const tenantId of [TENANT, FOREIGN_TENANT]) {
    const segments = await deploy<Array<{ id: string }>>`SELECT segment.id FROM reservation_segment segment
      WHERE segment.tenant_id=${tenantId}::uuid AND EXISTS (
        SELECT 1 FROM space_occupancy occupied WHERE occupied.tenant_id=segment.tenant_id
          AND occupied.slot_kind='segment' AND occupied.slot_ref=segment.id)`;
    const holds = await deploy<Array<{ id: string }>>`SELECT hold.id FROM hold
      WHERE hold.tenant_id=${tenantId}::uuid AND EXISTS (
        SELECT 1 FROM space_occupancy occupied WHERE occupied.tenant_id=hold.tenant_id
          AND occupied.slot_kind='hold' AND occupied.slot_ref=hold.id)`;
    for (const { id: segmentId } of segments) await deploy`SELECT release_occupancy(${tenantId}::uuid, ${segmentId}::uuid)`;
    for (const { id: holdId } of holds) await deploy`SELECT release_occupancy(${tenantId}::uuid, ${holdId}::uuid)`;
    await deploy`DELETE FROM tax_attribution_reservation_binding WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tax_attribution_hold_binding WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM reservation_guest WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM reservation_segment WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM reservation WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM hold WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tax_attribution_snapshot WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM contact_point WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM api_idempotency WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM outbox WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM fact_log WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM user_role WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
    await deploy`DELETE FROM role WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM party_role WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM party WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM app_user WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM sellable_unit_space WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM sellable_unit WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM space WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM unit_type WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM rate_plan WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM policy WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM org_node WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tenant WHERE id=${tenantId}::uuid AND slug LIKE 'pbp20261002-%'`;
  }
}

async function setupFixture(): Promise<void> {
  await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'pbp20261002-primary','Public Booking Proof','shared','active'),
    (${FOREIGN_TENANT}::uuid,'pbp20261002-foreign','Public Booking Foreign Proof','shared','active')`;
  await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'pbp20261002a.property'::ltree,'property','Public Booking Proof','UTC','INR'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'pbp20261002a.other'::ltree,'property','Public Booking Other','UTC','INR'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'pbp20261002b.property'::ltree,'property','Public Booking Foreign','UTC','INR')`;
  await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'public-booking-proof@local.test','Public Booking Publisher','active')`;
  await deploy!`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Guest Booking Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest Booking Guest','active')`;
  for (const scope of PUBLIC_BOOKING_PUBLISHER_SCOPES) {
    await deploy!`INSERT INTO permission(code,description) VALUES(${scope},'Guest booking proof permission') ON CONFLICT(code) DO NOTHING`;
  }
  await deploy!`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${TENANT}::uuid,'Public Booking Proof Publisher')`;
  for (const scope of PUBLIC_BOOKING_PUBLISHER_SCOPES) {
    await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${scope})`;
  }
  await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
    (${TENANT}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
  await deploy!`INSERT INTO policy(id,tenant_id,kind,name,content) VALUES
    (${POLICY}::uuid,${TENANT}::uuid,'cancellation','Guest Booking Proof Cancellation',${JSON.stringify(POLICY_CONTENT)}::jsonb)`;
  await deploy!`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,base_occupancy,max_occupancy) VALUES
    (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'GBP-ROOM','Guest Booking Proof Room','hotel',2,4)`;
  await deploy!`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status) VALUES
    (${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'GBP-101','hotel',1,'active')`;
  await deploy!`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    (${SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Guest Booking Proof Sellable','active')`;
  await deploy!`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
    (${TENANT}::uuid,${SELLABLE}::uuid,${SPACE}::uuid,'exclusive')`;
  await deploy!`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,cancellation_policy,status) VALUES
    (${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'GBP-RATE','Guest Booking Rate','INR',false,${POLICY}::uuid,'active'),
    (${OTHER_RATE_PLAN}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'GBP-OTHER','Other Property Rate','INR',false,NULL,'active'),
    (${FOREIGN_RATE_PLAN}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'GBP-FOREIGN','Foreign Rate','INR',false,NULL,'active')`;
}

databaseDescribe("Order BOOKING-20261002 public booking PostgreSQL proof", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 4, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 12, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 12, prepare: false });
    await assertDatabaseTargets();
    await cleanup();
    await setupFixture();
    events = new PostgresEventBus(eventPool);
    clockNow = Date.now();
    service = createService();
  });

  afterAll(async () => {
    try { await cleanup(); } finally {
      await Promise.allSettled([
        ...(database ? [database.close()] : []),
        ...(eventPool ? [eventPool.close({ timeout: 0 })] : []),
        ...(directRuntime ? [directRuntime.close({ timeout: 0 })] : []),
        ...(deploy ? [deploy.close({ timeout: 0 })] : []),
      ]);
    }
  });

  test("P0: exact disposable PG18 identities and least-privilege function catalogue", async () => {
    const runtime = await directRuntime!<{ session_user: string; current_user: string; login: boolean;
      superuser: boolean; create_role: boolean; create_db: boolean; bypass_rls: boolean; inherit: boolean;
      app_member: boolean; app_usage: boolean; direct_reservation_insert: boolean }[]>`
      SELECT session_user::text,current_user::text,role.rolcanlogin AS login,role.rolsuper AS superuser,
        role.rolcreaterole AS create_role,role.rolcreatedb AS create_db,role.rolbypassrls AS bypass_rls,
        role.rolinherit AS inherit,pg_has_role('yellow_runtime','app_role','MEMBER') AS app_member,
        pg_has_role('yellow_runtime','app_role','USAGE') AS app_usage,
        has_table_privilege('yellow_runtime','public.reservation','INSERT') AS direct_reservation_insert
      FROM pg_roles role WHERE role.rolname='yellow_runtime'`;
    expect(runtime).toEqual([{ session_user: "yellow_runtime", current_user: "yellow_runtime", login: true,
      superuser: false, create_role: false, create_db: false, bypass_rls: false, inherit: false,
      app_member: true, app_usage: false, direct_reservation_insert: false }]);
    const scoped = await database!.withTenantTransaction(TENANT, (tx) => tx<{ session_user: string;
      current_user: string; tenant_id: string }[]>`SELECT session_user::text,current_user::text,
        current_setting('app.tenant_id',true)::uuid::text AS tenant_id`);
    expect(scoped).toEqual([{ session_user: "yellow_runtime", current_user: "app_role", tenant_id: TENANT }]);

    const rows = await deploy!<{ name: string; owner: string; security_definer: boolean; config: string[] | null;
      app_exec: boolean; runtime_exec: boolean; public_exec: boolean }[]>`
      SELECT proc.proname AS name,owner.rolname AS owner,proc.prosecdef AS security_definer,proc.proconfig AS config,
        has_function_privilege('app_role',proc.oid,'EXECUTE') AS app_exec,
        has_function_privilege('yellow_runtime',proc.oid,'EXECUTE') AS runtime_exec,
        EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proc.proacl,pg_catalog.acldefault('f',proc.proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_exec
      FROM pg_catalog.pg_proc proc JOIN pg_catalog.pg_namespace ns ON ns.oid=proc.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid=proc.proowner
      WHERE ns.nspname='public' AND proc.proname=ANY(ARRAY[
        'assert_public_booking_publisher','publish_public_booking_site','resolve_public_booking_site',
        'assert_public_booking_site','guard_public_booking_site_runtime_write']) ORDER BY proc.proname`;
    expect(rows).toHaveLength(5);
    const byName = Object.fromEntries(rows.map((row) => [row.name,row]));
    for (const name of ["assert_public_booking_publisher","publish_public_booking_site","resolve_public_booking_site",
      "assert_public_booking_site","guard_public_booking_site_runtime_write"]) {
      expect(byName[name]?.owner).toBe("yellow_owner");
      expect(byName[name]?.config).toContain("search_path=pg_catalog, public");
      expect(byName[name]?.public_exec).toBe(false);
    }
    expect(byName.assert_public_booking_publisher).toMatchObject({ security_definer: true, app_exec: false, runtime_exec: false });
    expect(byName.publish_public_booking_site).toMatchObject({ security_definer: true, app_exec: true, runtime_exec: false });
    expect(byName.resolve_public_booking_site).toMatchObject({ security_definer: true, app_exec: false, runtime_exec: true });
    expect(byName.assert_public_booking_site).toMatchObject({ security_definer: true, app_exec: true, runtime_exec: false });
    expect(byName.guard_public_booking_site_runtime_write?.security_definer).toBe(false);

    await deploy!`GRANT EXECUTE ON FUNCTION public.publish_public_booking_site(uuid,uuid,uuid,integer,boolean,uuid[],text,uuid) TO yellow_runtime`;
    try {
      await expect((async () => await directRuntime!`SELECT public.publish_public_booking_site(
        ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,0,true,ARRAY[${RATE_PLAN}::uuid],'direct',${crypto.randomUUID()}::uuid)`)())
        .rejects.toMatchObject({ errno: "42501" });
    } finally {
      await deploy!`REVOKE EXECUTE ON FUNCTION public.publish_public_booking_site(uuid,uuid,uuid,integer,boolean,uuid[],text,uuid) FROM yellow_runtime`;
    }
    await deploy!`GRANT EXECUTE ON FUNCTION public.publish_public_booking_site(uuid,uuid,uuid,integer,boolean,uuid[],text,uuid) TO yellow_deploy`;
    try {
      await expect((async () => await deploy!`SELECT public.publish_public_booking_site(
        ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,0,true,ARRAY[${RATE_PLAN}::uuid],'direct',${crypto.randomUUID()}::uuid)`)())
        .rejects.toMatchObject({ errno: "42501" });
    } finally {
      await deploy!`REVOKE EXECUTE ON FUNCTION public.publish_public_booking_site(uuid,uuid,uuid,integer,boolean,uuid[],text,uuid) FROM yellow_deploy`;
    }
  });

  test("P1: publication is six-scope, versioned, hidden from raw runtime writes and resolves a safe public directory entry", async () => {
    publishedSite = await publishSite();
    expect(publishedSite).toMatchObject({ version: 1, active: true, ratePlanIds: [RATE_PLAN], channelCode: CHANNEL });
    const sessionStart = await start(publishedSite.siteId,publishedSite.version);
    expect(sessionStart.property).toEqual({ id: PROPERTY, name: "Public Booking Proof", timeZone: "UTC" });
    expect(sessionStart.paymentAccepted).toBe(false);
    const session = service!.authenticate(sessionStart.token);
    expect(session).not.toBeNull();
    expect(session).not.toHaveProperty("primaryPartyId");
    expect(session).not.toHaveProperty("partyId");
    const directory = await new PublicBookingSiteAuthority().resolve(directRuntime!,publishedSite.siteId);
    expect(directory).toMatchObject({ tenantId:TENANT,propertyNode:PROPERTY,propertyName:"Public Booking Proof",timeZone:"UTC",
      site:{siteId:publishedSite.siteId,version:1,issuerId:ACTOR}});

    await deploy!`GRANT SELECT (config), UPDATE (config) ON public.org_node TO app_role`;
    try {
      await expect(database!.withTenantTransaction(TENANT,(tx) => tx`UPDATE org_node SET config=jsonb_set(
        config,'{booking,public_site,active}','false'::jsonb) WHERE tenant_id=${TENANT}::uuid AND id=${PROPERTY}::uuid`))
        .rejects.toMatchObject({ errno: "42501" });
    } finally {
      await deploy!`REVOKE SELECT (config), UPDATE (config) ON public.org_node FROM app_role`;
    }

    const revokeScope = PUBLIC_BOOKING_PUBLISHER_SCOPES[5];
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${revokeScope}`;
    try {
      await expect(offer(sessionStart.token,1)).rejects.toBeInstanceOf(PublicBookingError);
    } finally {
      await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${revokeScope}) ON CONFLICT DO NOTHING`;
    }
    await expect(start(uuid(202610020099),1)).rejects.toBeInstanceOf(PublicBookingError);
    await expect(database!.withTenantTransaction(FOREIGN_TENANT,(tx) => service!.start(tx,publishedSite!.siteId,1)))
      .rejects.toBeInstanceOf(PublicBookingError);
  });

  test("P1b: concurrent publishers using one expected version produce one publication and one conflict", async () => {
    const site = await ensurePublished();
    const before = await deploy!<{ facts: number; events: number }[]>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${PROPERTY}::uuid
        AND fact_type='booking.site.published') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid
          AND event_type='booking.site.published') AS events`;
    const attempts = await Promise.allSettled([
      publishSite({ expectedVersion: site.version, active: true }),
      publishSite({ expectedVersion: site.version, active: false }),
    ]);
    const successes = attempts.filter((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof publishSite>>> =>
      attempt.status === "fulfilled");
    const failures = attempts.filter((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.reason).toMatchObject({ status: 409 });
    publishedSite = successes[0]!.value;
    expect(publishedSite.version).toBe(site.version + 1);
    const after = await deploy!<{ facts: number; events: number }[]>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${PROPERTY}::uuid
        AND fact_type='booking.site.published') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid
          AND event_type='booking.site.published') AS events`;
    expect(after[0]!.facts - before[0]!.facts).toBe(1);
    expect(after[0]!.events - before[0]!.events).toBe(1);
  });

  test("P1c: active reads hold publication and issuer grants stable until withdrawal or revocation commits", async () => {
    let site = await ensurePublished();
    if (!site.active) {
      site = await publishSite({ active: true, expectedVersion: site.version });
      publishedSite = site;
    }
    const authority = new PublicBookingSiteAuthority();
    let armed: { enter(): void; blocked: Promise<void> } | undefined;
    const gatedAuthority: Pick<PublicBookingSiteAuthority, "authorize"> = {
      async authorize(...args: Parameters<PublicBookingSiteAuthority["authorize"]>) {
        const live = await authority.authorize(...args);
        const gate = armed;
        if (gate) {
          armed = undefined;
          gate.enter();
          await gate.blocked;
        }
        return live;
      },
    };
    const gatedService = createService(events!, () => clockNow, 0, undefined, gatedAuthority);
    const makeGate = () => {
      let enter!: () => void;
      let release!: () => void;
      const entered = new Promise<void>((resolve) => { enter = resolve; });
      const blocked = new Promise<void>((resolve) => { release = resolve; });
      armed = { enter, blocked };
      return { entered, release };
    };
    const assertMutationWaitsForRead = async (
      runMutation: () => Promise<unknown>,
      runRead: () => Promise<unknown>,
    ) => {
      const gate = makeGate();
      const read = runRead().then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      let mutation: Promise<unknown> | undefined;
      let mutationState = "pending";
      let assertionError: unknown;
      try {
        await gate.entered;
        mutation = runMutation();
        void mutation.then(() => { mutationState = "fulfilled"; }, () => { mutationState = "rejected"; });
        await Bun.sleep(150);
        expect(mutationState).toBe("pending");
      } catch (error) {
        assertionError = error;
      } finally {
        gate.release();
        armed = undefined;
      }
      const readResult = await read;
      if (mutation) await mutation;
      if (assertionError) throw assertionError;
      if (!readResult.ok) throw readResult.error;
    };

    const revokeCode = PUBLIC_BOOKING_PUBLISHER_SCOPES[5];
    try {
      const withdrawSession = await start(site.siteId, site.version, gatedService);
      await assertMutationWaitsForRead(
        async () => { publishedSite = await publishSite({ active: false, expectedVersion: site.version }); },
        () => quote(withdrawSession.token, 11, RATE_PLAN, SELLABLE, gatedService),
      );
      const withdrawn = await deploy!<{ active: boolean; version: number }[]>`
        SELECT (config #>> '{booking,public_site,active}')::boolean AS active,
          (config #>> '{booking,public_site,version}')::int AS version FROM org_node
        WHERE tenant_id=${TENANT}::uuid AND id=${PROPERTY}::uuid`;
      expect(withdrawn).toEqual([{ active: false, version: site.version + 1 }]);
      await expect(offer(withdrawSession.token, 12, gatedService)).rejects.toBeInstanceOf(PublicBookingError);

      const activeAgain = await publishSite({ active: true, expectedVersion: site.version + 1 });
      publishedSite = activeAgain;
      const revokedSession = await start(activeAgain.siteId, activeAgain.version, gatedService);
      await assertMutationWaitsForRead(
        async () => {
          await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${revokeCode}`;
        },
        () => quote(revokedSession.token, 13, RATE_PLAN, SELLABLE, gatedService),
      );
      await expect(offer(revokedSession.token, 14, gatedService)).rejects.toBeInstanceOf(PublicBookingError);
    } finally {
      await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${revokeCode}) ON CONFLICT DO NOTHING`;
      const current = await deploy!<{ site_id: string; version: number; active: boolean }[]>`
        SELECT config #>> '{booking,public_site,siteId}' AS site_id,
          (config #>> '{booking,public_site,version}')::int AS version,
          (config #>> '{booking,public_site,active}')::boolean AS active FROM org_node
        WHERE tenant_id=${TENANT}::uuid AND id=${PROPERTY}::uuid`;
      const row = current[0];
      if (row && !row.active) publishedSite = await publishSite({ active: true, expectedVersion: row.version });
      else if (row && publishedSite) publishedSite = { ...publishedSite, siteId: row.site_id, version: row.version, active: row.active };
    }
  }, 30_000);

  test("P1d: publication audit failure rolls the site version and both audit rows back", async () => {
    const site = await ensurePublished();
    const beforeSite = await deploy!<{ public_site: unknown }[]>`
      SELECT config #> '{booking,public_site}' AS public_site FROM org_node
      WHERE tenant_id=${TENANT}::uuid AND id=${PROPERTY}::uuid`;
    const beforeAudit = await deploy!<{ facts: number; events: number }[]>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${PROPERTY}::uuid
        AND fact_type='booking.site.published') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid
          AND event_type='booking.site.published') AS events`;
    try {
      await deploy!`CREATE OR REPLACE FUNCTION public.public_booking_owned_proof_fail_site_outbox()
        RETURNS trigger LANGUAGE plpgsql AS $proof$
        BEGIN
          IF NEW.tenant_id='00000000-0000-0000-0000-202610020001'::uuid AND NEW.event_type='booking.site.published' THEN
            RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='public booking proof outbox failure';
          END IF;
          RETURN NEW;
        END; $proof$`;
      await deploy!`DROP TRIGGER IF EXISTS public_booking_owned_proof_fail_site_outbox ON public.outbox`;
      await deploy!`CREATE TRIGGER public_booking_owned_proof_fail_site_outbox BEFORE INSERT ON public.outbox
        FOR EACH ROW EXECUTE FUNCTION public.public_booking_owned_proof_fail_site_outbox()`;
      await expect(publishSite({ active: true, expectedVersion: site.version })).rejects.toMatchObject({ status: 503 });
      const afterSite = await deploy!<{ public_site: unknown }[]>`
        SELECT config #> '{booking,public_site}' AS public_site FROM org_node
        WHERE tenant_id=${TENANT}::uuid AND id=${PROPERTY}::uuid`;
      const afterAudit = await deploy!<{ facts: number; events: number }[]>`
        SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${PROPERTY}::uuid
          AND fact_type='booking.site.published') AS facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid
            AND event_type='booking.site.published') AS events`;
      expect(afterSite).toEqual(beforeSite);
      expect(afterAudit).toEqual(beforeAudit);
    } finally {
      await deploy!`DROP TRIGGER IF EXISTS public_booking_owned_proof_fail_site_outbox ON public.outbox`;
      await deploy!`DROP FUNCTION IF EXISTS public.public_booking_owned_proof_fail_site_outbox()`;
    }
  });

  test("P1arrays: governed SQL rejects multidimensional and nonstandard-bound plan arrays",async()=>{
    const before=await fixtureCounts();
    await expect(database!.withTenantTransaction(TENANT,async(tx)=>await tx`SELECT public.publish_public_booking_site(
      ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,1,true,ARRAY[[${RATE_PLAN}::uuid]],'direct',${crypto.randomUUID()}::uuid)`))
      .rejects.toMatchObject({errno:"22023"});
    await expect(database!.withTenantTransaction(TENANT,async(tx)=>await tx`SELECT public.publish_public_booking_site(
      ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,1,true,${`[0:0]={${RATE_PLAN}}`}::uuid[],'direct',${crypto.randomUUID()}::uuid)`))
      .rejects.toMatchObject({errno:"22023"});
    expect(await fixtureCounts()).toEqual(before);
  });

  test("P1a: security-definer directory ignores a forged temporary org_node", async () => {
    const site = await ensurePublished();
    const connection = await directRuntime!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe(`CREATE TEMP TABLE org_node(id uuid,tenant_id uuid,kind text,name text,timezone text,config jsonb)`);
      const schemas = await connection<{ name: string }[]>`SELECT nspname AS name FROM pg_namespace WHERE oid=pg_my_temp_schema()`;
      const schema = schemas[0]?.name;
      if (!schema || !/^pg_temp_[0-9]+$/.test(schema)) throw new Error("Public-booking temp schema missing");
      await connection.unsafe(`GRANT USAGE ON SCHEMA "${schema}" TO yellow_owner`);
      await connection.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO yellow_owner`);
      await connection`INSERT INTO pg_temp.org_node VALUES(${uuid(1)}::uuid,${FOREIGN_TENANT}::uuid,'property',
        'Spoofed Property','Pacific/Auckland',jsonb_build_object('booking',jsonb_build_object('public_site',
          jsonb_build_object('siteId',${site.siteId}::uuid,'version',9,'active',true,'issuerId',${uuid(2)}::uuid,
            'channelCode','spoof','ratePlanIds',jsonb_build_array(${FOREIGN_RATE_PLAN}::uuid)))))`;
      const resolved = await connection<{ snapshot: { tenantId: string; propertyNode: string; propertyName: string; timeZone: string } }[]>`
        SELECT public.resolve_public_booking_site(${site.siteId}::uuid) AS snapshot`;
      expect(resolved[0]?.snapshot).toMatchObject({ tenantId: TENANT, propertyNode: PROPERTY,
        propertyName: "Public Booking Proof", timeZone: "UTC" });
    } finally {
      await connection.unsafe("ROLLBACK").catch(() => undefined);
      connection.release();
    }
  });

  test("P1expiry: public quote envelope bounds prevent longer payload authority",async()=>{
    const site=await ensurePublished(),started=await start(site.siteId,site.version);
    const quoted=await quote(started.token,25) as {quoteToken:string};
    const signer=new GuestBookingTokenSigner(TOKEN_SECRET,{now:()=>clockNow}),p=signer.verify("public-quote",quoted.quoteToken)!.payload;
    const short=signer.issue("public-quote",p,5),before=await fixtureCounts();
    await expect(hold(started.token,short)).rejects.toMatchObject({status:403});
    expect(await fixtureCounts()).toEqual(before);
  });

  test("P2: full quote, complete-tax hold, details-gated Party creation, reservation commit and exact replays", async () => {
    const site = await ensurePublished();
    const before = await fixtureCounts();
    const started = await start(site.siteId,site.version);
    const offers = await offer(started.token,0) as { readonly options: readonly unknown[] };
    expect(offers.options).toHaveLength(1);
    const quoted = await quote(started.token,0) as {
      readonly quote: { readonly result: { readonly preTaxSubtotalMinor: bigint; readonly currency: string };
        readonly taxPreview: { readonly state: string } };
      readonly quoteToken: string; readonly paymentAccepted: false;
    };
    expect(quoted.quote.result.currency).toBe("INR");
    expect(quoted.quote.taxPreview.state).toBe("calculated");
    expect(quoted.quote.result.preTaxSubtotalMinor).toBe(100000n);
    expect(quoted.paymentAccepted).toBe(false);
    const firstHold = await hold(started.token,quoted.quoteToken) as {
      readonly hold: { readonly holdId: string; readonly bindingId: string; readonly attributionId: string };
      readonly holdToken: string; readonly replayed: boolean;
    };
    expect(firstHold.replayed).toBe(false);
    expect(await fixtureCounts()).toMatchObject({ parties: before.parties, party_roles: before.party_roles, contacts: before.contacts });
    const heldCounts = await fixtureCounts();
    const holdReplay = await hold(started.token,quoted.quoteToken) as typeof firstHold;
    expect(holdReplay.replayed).toBe(true);
    expect(holdReplay.hold.holdId).toBe(firstHold.hold.holdId);
    expect(await fixtureCounts()).toEqual(heldCounts);

    const guestName = "Public Booking Guest Alpha";
    const guestEmail = "public-booking-alpha@owned-proof.test";
    const profile = await details(started.token,firstHold.holdToken,guestName,guestEmail) as {
      readonly detailsToken: string; readonly replayed: boolean;
    };
    expect(profile.replayed).toBe(false);
    const createdCounts = await fixtureCounts();
    expect(createdCounts.parties).toBe(before.parties + 1);
    expect(createdCounts.party_roles).toBe(before.party_roles + 1);
    expect(createdCounts.contacts).toBe(before.contacts + 1);
    const profileReplay = await details(started.token,firstHold.holdToken,guestName,guestEmail) as typeof profile;
    expect(profileReplay.replayed).toBe(true);
    expect(await fixtureCounts()).toEqual(createdCounts);

    const committed = await reserve(started.token,firstHold.holdToken,profile.detailsToken) as {
      readonly reservation: { readonly reservationId: string; readonly segmentId: string; readonly primaryPartyId: string; readonly source: string };
      readonly replayed: boolean; readonly paymentAccepted: false;
    };
    expect(committed.reservation.primaryPartyId).toBeTypeOf("string");
    expect(committed.reservation.source).toBe("hold");
    expect(committed.replayed).toBe(false);
    expect(committed.paymentAccepted).toBe(false);
    const replay = await reserve(started.token,firstHold.holdToken,profile.detailsToken) as typeof committed;
    expect(replay.replayed).toBe(true);
    expect(replay.reservation.reservationId).toBe(committed.reservation.reservationId);
    const lineage = await deploy!<{ hold_id: string; reservation_id: string; segment_id: string }[]>`
      SELECT hold_id::text,reservation_id::text,segment_id::text FROM tax_attribution_reservation_binding
      WHERE tenant_id=${TENANT}::uuid AND hold_id=${firstHold.hold.holdId}::uuid
        AND reservation_id=${committed.reservation.reservationId}::uuid`;
    expect(lineage).toHaveLength(1);
    const after = await fixtureCounts();
    expect(after.reservations).toBe(before.reservations + 1);
    expect(after.segments).toBe(before.segments + 1);
    expect(after.lineages).toBe(before.lineages + 1);
    const createdParty = await deploy!<{ id: string; display_name: string }[]>`
      SELECT party.id::text,party.display_name FROM party JOIN party_role role ON role.tenant_id=party.tenant_id
        AND role.party_id=party.id AND role.role='guest' WHERE party.tenant_id=${TENANT}::uuid
        AND party.display_name=${guestName}`;
    expect(createdParty).toHaveLength(1);
    expect(committed.reservation.primaryPartyId).toBe(createdParty[0]!.id);
  });

  test("P2a: public hold revalidation rejects price, release, tax and policy drift without persistence", async () => {
    const site = await ensurePublished();
    const expectQuoteDrift = async (mode: QuoteMode, offset: number) => {
      quoteMode = "normal";
      const started = await start(site.siteId, site.version);
      const quoted = await quote(started.token, offset) as { readonly quoteToken: string };
      const before = await fixtureCounts();
      quoteMode = mode;
      try {
        await expect(hold(started.token, quoted.quoteToken)).rejects.toBeInstanceOf(PublicBookingError);
      } finally {
        quoteMode = "normal";
      }
      expect(await fixtureCounts()).toEqual(before);
    };
    await expectQuoteDrift("price_drift", 15);
    await expectQuoteDrift("release_drift", 16);
    await expectQuoteDrift("partial_tax", 17);

    const policySession = await start(site.siteId, site.version);
    const policyQuote = await quote(policySession.token, 18) as { readonly quoteToken: string };
    const beforePolicyDrift = await fixtureCounts();
    const changedPolicy = {
      ...POLICY_CONTENT,
      rules: [{ before_hours: 48, penalty: { basis: "nights", value: 1 } }],
    };
    await deploy!`UPDATE policy SET content=${JSON.stringify(changedPolicy)}::jsonb
      WHERE tenant_id=${TENANT}::uuid AND id=${POLICY}::uuid`;
    try {
      await expect(hold(policySession.token, policyQuote.quoteToken)).rejects.toBeInstanceOf(PublicBookingError);
    } finally {
      await deploy!`UPDATE policy SET content=${JSON.stringify(POLICY_CONTENT)}::jsonb
        WHERE tenant_id=${TENANT}::uuid AND id=${POLICY}::uuid`;
    }
    expect(await fixtureCounts()).toEqual(beforePolicyDrift);
  });

  test("P3: foreign session cannot adopt the persisted hold or its details token; duplicate review stays generic", async () => {
    const site = await ensurePublished();
    const owner = await start(site.siteId,site.version);
    const stranger = await start(site.siteId,site.version);
    const quoted = await quote(owner.token,2) as { readonly quoteToken: string };
    const held = await hold(owner.token,quoted.quoteToken) as { readonly holdToken: string; readonly hold: { readonly holdId: string } };
    const ownerDetails = await details(owner.token,held.holdToken,"Public Booking Owner","public-booking-owner@owned-proof.test") as { readonly detailsToken: string };
    const beforeAdoption = await fixtureCounts();
    await expect(details(stranger.token,held.holdToken,"Foreign Attempt","foreign-attempt@owned-proof.test"))
      .rejects.toBeInstanceOf(PublicBookingError);
    await expect(reserve(stranger.token,held.holdToken,ownerDetails.detailsToken)).rejects.toBeInstanceOf(PublicBookingError);
    expect(await fixtureCounts()).toEqual(beforeAdoption);

    const secondQuote = await quote(stranger.token,3) as { readonly quoteToken: string };
    const secondHold = await hold(stranger.token,secondQuote.quoteToken) as { readonly holdToken: string };
    const beforeDuplicate = await fixtureCounts();
    const duplicate = "public-booking-alpha@owned-proof.test";
    await expect(details(stranger.token,secondHold.holdToken,"Different Name",duplicate))
      .rejects.toMatchObject({ status: 409, code: "booking/guest_review_required" });
    expect(await fixtureCounts()).toEqual(beforeDuplicate);
  });

  test("P4: withdrawal, revision, issuer-scope revocation and foreign tenant context stop existing sessions", async () => {
    const site = await ensurePublished();
    const oldSession = await start(site.siteId,site.version);
    publishedSite = await publishSite({ active: false, expectedVersion: site.version });
    await expect(offer(oldSession.token,4)).rejects.toBeInstanceOf(PublicBookingError);
    await expect(start(publishedSite.siteId,publishedSite.version)).rejects.toBeInstanceOf(PublicBookingError);
    publishedSite = await publishSite({ active: true, expectedVersion: publishedSite.version });
    await expect(offer(oldSession.token,4)).rejects.toBeInstanceOf(PublicBookingError);
    const current = await start(publishedSite.siteId,publishedSite.version);
    await expect(database!.withTenantTransaction(FOREIGN_TENANT,(tx) => service!.offers(tx,
      service!.authenticate(current.token)!,{...stay(5),adults:2,childAges:[8]}))).rejects.toBeInstanceOf(PublicBookingError);
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${PUBLIC_BOOKING_PUBLISHER_SCOPES[5]}`;
    try {
      await expect(offer(current.token,6)).rejects.toBeInstanceOf(PublicBookingError);
    } finally {
      await deploy!`INSERT INTO role_permission(role_id,permission_code)
        VALUES(${ROLE}::uuid,${PUBLIC_BOOKING_PUBLISHER_SCOPES[5]}) ON CONFLICT DO NOTHING`;
    }
    const reauthorized = await start(publishedSite.siteId,publishedSite.version);
    expect(service!.authenticate(reauthorized.token)).not.toBeNull();
  });

  test("P5: PostgreSQL last-unit arbitration admits one concurrent public hold", async () => {
    const site = await ensurePublished();
    const a = await start(site.siteId,site.version);
    const b = await start(site.siteId,site.version);
    const quoteA = await quote(a.token,8) as { readonly quoteToken: string };
    const quoteB = await quote(b.token,8) as { readonly quoteToken: string };
    const attempts = await Promise.allSettled([hold(a.token,quoteA.quoteToken),hold(b.token,quoteB.quoteToken)]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rows = await deploy!<{ holds: number; claims: number }[]>`
      SELECT (SELECT count(*)::int FROM hold WHERE tenant_id=${TENANT}::uuid
        AND period=tstzrange(${stay(8).stayStart}::timestamptz,${stay(8).stayEnd}::timestamptz,'[)') AND status='active') holds,
        (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid
          AND period=tstzrange(${stay(8).stayStart}::timestamptz,${stay(8).stayEnd}::timestamptz,'[)')) claims`;
    expect(rows).toEqual([{ holds: 1, claims: 1 }]);
  },45_000);

  test("P6: Party and reservation outbox failures roll back, then exact retries succeed", async () => {
    const site = await ensurePublished();
    const started = await start(site.siteId,site.version);
    const quoted = await quote(started.token,9) as { readonly quoteToken: string };
    const held = await hold(started.token,quoted.quoteToken) as { readonly holdToken: string; readonly hold: { readonly holdId: string } };
    const beforeProfileFailure = await fixtureCounts();
    const failingProfile = createService(new FailEventBus(events!,"party.created"));
    await expect(details(started.token,held.holdToken,"Rollback Guest","rollback@owned-proof.test",failingProfile)).rejects.toThrow("Public-booking injected party.created failure");
    expect(await fixtureCounts()).toEqual(beforeProfileFailure);
    const profile = await details(started.token,held.holdToken,"Rollback Guest","rollback@owned-proof.test") as { readonly detailsToken: string };
    const beforeCommitFailure = await fixtureCounts();
    const failingCommit = createService(new FailEventBus(events!,"public_booking.reservation_confirmed"));
    await expect(reserve(started.token,held.holdToken,profile.detailsToken,crypto.randomUUID(),failingCommit)).rejects.toThrow("Public-booking injected public_booking.reservation_confirmed failure");
    const rolledBack = await fixtureCounts();
    expect(rolledBack.reservations).toBe(beforeCommitFailure.reservations);
    expect(rolledBack.segments).toBe(beforeCommitFailure.segments);
    expect(rolledBack.lineages).toBe(beforeCommitFailure.lineages);
    expect(await reserve(started.token,held.holdToken,profile.detailsToken)).toMatchObject({ replayed: false, paymentAccepted: false });
  });

  test("P7: quote expiry during hold re-quote causes no hold, occupancy, Party or outbox writes", async () => {
    const site = await ensurePublished();
    const started = await start(site.siteId,site.version);
    const quoted = await quote(started.token,10) as { readonly quoteToken: string };
    const signer = new GuestBookingTokenSigner(TOKEN_SECRET);
    const claims = signer.verify("public-quote",quoted.quoteToken);
    expect(claims).not.toBeNull();
    const expiring = signer.issue("public-quote",{...claims!.payload,validUntil:Math.floor(Date.now()/1000)+2},300);
    const delayed = createService(events!,()=>Date.now(),3_000);
    const before = await fixtureCounts();
    await expect(withSession(started.token,(tx,session) => delayed.hold(tx,session,{quoteToken:expiring},crypto.randomUUID()),delayed))
      .rejects.toBeInstanceOf(PublicBookingError);
    expect(await fixtureCounts()).toEqual(before);
  },20_000);
});

async function assertDatabaseTargets(): Promise<void> {
  const deployIdentity = await deploy!<{ session_user: string; current_user: string; database_name: string; server_version_num: number }[]>`
    SELECT session_user::text,current_user::text,current_database() AS database_name,
      current_setting('server_version_num')::int AS server_version_num`;
  const runtimeIdentity = await directRuntime!<{ session_user: string; current_user: string; database_name: string; server_version_num: number }[]>`
    SELECT session_user::text,current_user::text,current_database() AS database_name,
      current_setting('server_version_num')::int AS server_version_num`;
  if (deployIdentity.length !== 1 || runtimeIdentity.length !== 1 ||
      deployIdentity[0]?.session_user !== "yellow_deploy" || deployIdentity[0]?.current_user !== "yellow_deploy" ||
      runtimeIdentity[0]?.session_user !== "yellow_runtime" || runtimeIdentity[0]?.current_user !== "yellow_runtime" ||
      deployIdentity[0]?.database_name !== runtimeIdentity[0]?.database_name ||
      !deployIdentity[0].database_name.startsWith("yellow_guest_booking_site_proof") ||
      deployIdentity[0]?.server_version_num < 180_000 || deployIdentity[0]?.server_version_num >= 190_000 ||
      runtimeIdentity[0]?.server_version_num < 180_000 || runtimeIdentity[0]?.server_version_num >= 190_000) {
    throw new Error("Public-booking integration proof refused an unowned or mismatched database target");
  }
}
