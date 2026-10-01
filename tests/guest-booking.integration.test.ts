import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { HoldService } from "../src/contexts/inventory";
import {
  GUEST_BOOKING_ISSUER_SCOPES,
  Hs256TokenSigner,
  GuestBookingTokenSigner,
} from "../src/contexts/identity";
import {
  ReservationCommitService,
  ReservationOfferSearchService,
  GuestBookingError,
  GuestBookingService,
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
  QuotedTaxHoldBindingConflictError,
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

const DEPLOY_URL = process.env.YELLOW_GUEST_BOOKING_DEPLOY_URL;
const RUNTIME_URL = process.env.YELLOW_GUEST_BOOKING_RUNTIME_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_GUEST_BOOKING === "1";
if ((REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) || Boolean(DEPLOY_URL) !== Boolean(RUNTIME_URL)) {
  throw new Error("Guest-booking integration proof requires both explicit owned deploy and runtime URLs");
}

function parseOwnedUrl(value: string, expectedUser: string): URL {
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
      decodeURIComponent(url.username) !== expectedUser || databaseName.length === 0 ||
      !databaseName.startsWith("yellow_guest_booking_proof")) {
    throw new Error("Guest-booking proof URLs must target the owned proof database with the expected role");
  }
  return url;
}

if (DEPLOY_URL && RUNTIME_URL) {
  const deployTarget = parseOwnedUrl(DEPLOY_URL, "yellow_deploy");
  const runtimeTarget = parseOwnedUrl(RUNTIME_URL, "yellow_runtime");
  if (deployTarget.hostname !== runtimeTarget.hostname ||
      (deployTarget.port || "5432") !== (runtimeTarget.port || "5432") ||
      deployTarget.pathname !== runtimeTarget.pathname) {
    throw new Error("Guest-booking deploy/runtime URLs must name the same host, port and owned database");
  }
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const uuid = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const DAY_MS = 86_400_000;
const TENANT = uuid(202610010001);
const FOREIGN_TENANT = uuid(202610010002);
const PROPERTY = uuid(202610010011);
const OTHER_PROPERTY = uuid(202610010012);
const FOREIGN_PROPERTY = uuid(202610010013);
const ACTOR = uuid(202610010021);
const PARTY = uuid(202610010022);
const FOREIGN_PARTY = uuid(202610010023);
const ROLE = uuid(202610010024);
const UNIT_TYPE = uuid(202610010031);
const SPACE = uuid(202610010032);
const SELLABLE = uuid(202610010033);
const RATE_PLAN = uuid(202610010041);
const OTHER_RATE_PLAN = uuid(202610010042);
const FOREIGN_RATE_PLAN = uuid(202610010043);
const POLICY = uuid(202610010044);
const RELEASE = uuid(202610010045);
const MODEL = uuid(202610010046);
const TARGET = uuid(202610010047);
const EXTENSION = uuid(202610010048);
const CHANNEL = "direct";
const TOKEN_SECRET = "guest-booking-owned-proof-secret-minimum-32-bytes";
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
}
let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let service: GuestBookingService | undefined;
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
    if (event.eventType === this.eventType) throw new Error(`Guest-booking injected ${this.eventType} failure`);
    return result;
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function createService(bus: EventBus = events!, now: () => number = () => clockNow, quoteDelayMs = 0,
  onQuoteResolve?: () => void): GuestBookingService {
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
  return new GuestBookingService({
    tokens: new GuestBookingTokenSigner(TOKEN_SECRET, { now }),
    offers,
    quotes,
    rates,
    publication: quote.publication as never,
    holds,
    attributions,
    reservations,
    idempotency: new PostgresIdempotency(),
    events: bus,
    now,
  });
}

async function issueInvitation(options: {
  readonly partyId?: string;
  readonly tenantId?: string;
  readonly propertyNode?: string;
  readonly ratePlanIds?: readonly string[];
  readonly channelCode?: string;
  readonly idempotencyKey?: string;
} = {}): Promise<string> {
  const body = {
    primaryPartyId: options.partyId ?? PARTY,
    channelCode: options.channelCode ?? CHANNEL,
    ratePlanIds: options.ratePlanIds ?? [RATE_PLAN],
  };
  const issued = await database!.withTenantTransaction(options.tenantId ?? TENANT, (tx) => service!.issue(
    tx,
    { tenantId: options.tenantId ?? TENANT, actorId: ACTOR, scopes: GUEST_BOOKING_ISSUER_SCOPES },
    options.propertyNode ?? PROPERTY,
    body,
    options.idempotencyKey ?? `guest-booking-invite-${crypto.randomUUID()}`,
    crypto.randomUUID(),
  )) as { readonly token: string };
  return issued.token;
}

async function withSession<T>(token: string, operation: (tx: Tx, session: NonNullable<ReturnType<GuestBookingService["authenticate"]>>) => Promise<T>): Promise<T> {
  const session = service!.authenticate(token);
  if (!session) throw new Error("Guest-booking test token did not authenticate");
  return database!.withTenantTransaction(TENANT, (tx) => operation(tx, session));
}

async function offer(token: string, offset: number) {
  return withSession(token, (tx, session) => service!.offers(tx, session, {
    ...stay(offset), adults: 2, childAges: [8],
  }));
}

async function quote(token: string, offset: number, ratePlanId = RATE_PLAN, sellableUnitId = SELLABLE) {
  return withSession(token, (tx, session) => service!.quote(tx, session, requestBody(offset, ratePlanId, sellableUnitId)));
}

async function hold(token: string, quoteToken: string, requestId = crypto.randomUUID(), busService = service!) {
  const session = busService.authenticate(token);
  if (!session) throw new Error("Guest-booking test session did not authenticate");
  return database!.withTenantTransaction(TENANT, (tx) => busService.hold(tx, session, { quoteToken }, requestId));
}

async function reserve(token: string, holdToken: string, requestId = crypto.randomUUID(), busService = service!) {
  const session = busService.authenticate(token);
  if (!session) throw new Error("Guest-booking test session did not authenticate");
  return database!.withTenantTransaction(TENANT, (tx) => busService.reserve(tx, session, { holdToken }, requestId));
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
    (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) facts`;
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
    await deploy`DELETE FROM tenant WHERE id=${tenantId}::uuid AND slug LIKE 'gbp20261001-%'`;
  }
}

async function setupFixture(): Promise<void> {
  await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'gbp20261001-primary','Guest Booking Proof','shared','active'),
    (${FOREIGN_TENANT}::uuid,'gbp20261001-foreign','Guest Booking Foreign Proof','shared','active')`;
  await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'gbp20261001a.property'::ltree,'property','Guest Booking Proof','UTC','INR'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'gbp20261001a.other'::ltree,'property','Guest Booking Other','UTC','INR'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'gbp20261001b.property'::ltree,'property','Guest Booking Foreign','UTC','INR')`;
  await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'guest-booking-proof@local.test','Guest Booking Issuer','active')`;
  await deploy!`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Guest Booking Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest Booking Guest','active')`;
  for (const scope of GUEST_BOOKING_ISSUER_SCOPES) {
    await deploy!`INSERT INTO permission(code,description) VALUES(${scope},'Guest booking proof permission') ON CONFLICT(code) DO NOTHING`;
  }
  await deploy!`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${TENANT}::uuid,'Guest Booking Proof Issuer')`;
  for (const scope of GUEST_BOOKING_ISSUER_SCOPES) {
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

databaseDescribe("Order BOOKING-20261001 guest invitation PostgreSQL proof", () => {
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

  test("P0: uses the named owned database and proves runtime is a restricted non-inheriting role", async () => {
    const deployRows = await deploy!<{ session_user: string; current_user: string }[]>`
      SELECT session_user::text, current_user::text`;
    expect(deployRows).toEqual([{ session_user: "yellow_deploy", current_user: "yellow_deploy" }]);
    const runtimeRows = await directRuntime!<{ session_user: string; current_user: string; login: boolean;
      superuser: boolean; create_role: boolean; create_db: boolean; bypass_rls: boolean; inherit: boolean;
      app_member: boolean; app_usage: boolean; direct_reservation_insert: boolean }[]>`
      SELECT session_user::text, current_user::text, role.rolcanlogin AS login,
        role.rolsuper AS superuser, role.rolcreaterole AS create_role, role.rolcreatedb AS create_db,
        role.rolbypassrls AS bypass_rls, role.rolinherit AS inherit,
        pg_has_role('yellow_runtime','app_role','MEMBER') AS app_member,
        pg_has_role('yellow_runtime','app_role','USAGE') AS app_usage,
        has_table_privilege('yellow_runtime','public.reservation','INSERT') AS direct_reservation_insert
      FROM pg_roles role WHERE role.rolname='yellow_runtime'`;
    expect(runtimeRows).toEqual([{
      session_user: "yellow_runtime", current_user: "yellow_runtime", login: true, superuser: false,
      create_role: false, create_db: false, bypass_rls: false, inherit: false,
      app_member: true, app_usage: false, direct_reservation_insert: false,
    }]);
    const scoped = await database!.withTenantTransaction(TENANT, async (tx) => tx<{
      session_user: string; current_user: string; tenant_id: string;
    }[]>`SELECT session_user::text, current_user::text,
      current_setting('app.tenant_id',true)::uuid::text AS tenant_id`);
    expect(scoped).toEqual([{ session_user: "yellow_runtime", current_user: "app_role", tenant_id: TENANT }]);
  });

  test("P0a: guest authority is owner-controlled, exact-role granted, tenant-bound and resistant to temp relation spoofing", async () => {
    const catalogue = await deploy!<{ owner: string; security_definer: boolean; config: string[] | null;
      app_role_execute: boolean; runtime_execute: boolean; public_execute: boolean }[]>`
      SELECT owner.rolname AS owner, proc.prosecdef AS security_definer, proc.proconfig AS config,
        has_function_privilege('app_role',proc.oid,'EXECUTE') AS app_role_execute,
        has_function_privilege('yellow_runtime',proc.oid,'EXECUTE') AS runtime_execute,
        EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proc.proacl,
          pg_catalog.acldefault('f',proc.proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute
      FROM pg_catalog.pg_proc proc
      JOIN pg_catalog.pg_namespace ns ON ns.oid=proc.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid=proc.proowner
      WHERE ns.nspname='public' AND proc.proname='assert_guest_booking_authority'
        AND pg_catalog.pg_get_function_identity_arguments(proc.oid)=
          'p_tenant uuid, p_property uuid, p_actor uuid, p_party uuid, p_rate_plan uuid'`;
    expect(catalogue).toHaveLength(1);
    expect(catalogue[0]).toMatchObject({ owner: "yellow_owner", security_definer: true,
      app_role_execute: true, runtime_execute: false, public_execute: false });
    expect(catalogue[0]?.config).toContain("search_path=pg_catalog, public");

    const authorize = (tx: Tx, tenantId = TENANT, propertyId = PROPERTY, actorId = ACTOR,
      partyId = PARTY, ratePlanId: string | null = RATE_PLAN) =>
      tx`SELECT public.assert_guest_booking_authority(${tenantId}::uuid,${propertyId}::uuid,
        ${actorId}::uuid,${partyId}::uuid,${ratePlanId}::uuid)`;
    await expect(database!.withTenantTransaction(TENANT, (tx) => authorize(tx, FOREIGN_TENANT, FOREIGN_PROPERTY, ACTOR)))
      .rejects.toMatchObject({ errno: "42501" });
    await expect(database!.withTenantTransaction(TENANT, (tx) => authorize(tx, TENANT, PROPERTY, uuid(202610010099))))
      .rejects.toMatchObject({ errno: "42501" });
    await expect(database!.withTenantTransaction(TENANT, async (tx) => {
      await tx`SELECT set_config('app.tenant_id',${FOREIGN_TENANT},true)`;
      return authorize(tx);
    })).rejects.toMatchObject({ errno: "42501" });
    await deploy!`GRANT EXECUTE ON FUNCTION public.assert_guest_booking_authority(uuid,uuid,uuid,uuid,uuid)
      TO yellow_runtime`;
    try {
      await expect((async () => await directRuntime!`SELECT public.assert_guest_booking_authority(
        ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,${PARTY}::uuid,${RATE_PLAN}::uuid)` )())
        .rejects.toMatchObject({ errno: "42501" });
    } finally {
      await deploy!`REVOKE EXECUTE ON FUNCTION public.assert_guest_booking_authority(uuid,uuid,uuid,uuid,uuid)
        FROM yellow_runtime`;
    }

    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
    try {
      await expect(database!.withTenantTransaction(TENANT, (tx) => authorize(tx))).rejects.toMatchObject({ errno: "42501" });
    } finally {
      for (const scope of GUEST_BOOKING_ISSUER_SCOPES) {
        await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${scope}) ON CONFLICT DO NOTHING`;
      }
    }
  });

  test("P0c: temporary relation authority spoofing cannot replace revoked persisted grants", async () => {
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid`;
    try {
      await expect(database!.withTenantTransaction(TENANT, async (tx) => {
        await tx`CREATE TEMP TABLE tenant(id uuid, status text)`;
        await tx`CREATE TEMP TABLE app_user(tenant_id uuid, id uuid, status text)`;
        await tx`CREATE TEMP TABLE user_role(tenant_id uuid, user_id uuid, role_id uuid, scope_node uuid)`;
        await tx`CREATE TEMP TABLE role(tenant_id uuid, id uuid)`;
        await tx`CREATE TEMP TABLE role_permission(role_id uuid, permission_code text)`;
        await tx`CREATE TEMP TABLE org_node(tenant_id uuid, id uuid, kind text, path ltree)`;
        await tx`CREATE TEMP TABLE party(tenant_id uuid, id uuid, status text)`;
        await tx`CREATE TEMP TABLE rate_plan(tenant_id uuid, id uuid, property_node uuid, status text,
          cancellation_policy uuid, guarantee_policy uuid, deposit_policy uuid)`;
        await tx`CREATE TEMP TABLE policy(tenant_id uuid, id uuid)`;
        const schemas = await tx<{ name: string }[]>`SELECT nspname AS name FROM pg_namespace
          WHERE oid=pg_my_temp_schema()`;
        const temporarySchema = schemas[0]?.name;
        if (!temporarySchema || !/^pg_temp_[0-9]+$/.test(temporarySchema)) {
          throw new Error("Runtime temporary schema was not created for the spoofing probe");
        }
        await tx.unsafe(`GRANT USAGE ON SCHEMA "${temporarySchema}" TO yellow_owner`);
        await tx.unsafe(`GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA "${temporarySchema}" TO yellow_owner`);
        await tx`INSERT INTO tenant VALUES(${TENANT}::uuid,'active')`;
        await tx`INSERT INTO app_user VALUES(${TENANT}::uuid,${ACTOR}::uuid,'active')`;
        await tx`INSERT INTO user_role VALUES(${TENANT}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
        await tx`INSERT INTO role VALUES(${TENANT}::uuid,${ROLE}::uuid)`;
        for (const scope of GUEST_BOOKING_ISSUER_SCOPES) {
          await tx`INSERT INTO role_permission VALUES(${ROLE}::uuid,${scope})`;
        }
        await tx`INSERT INTO org_node VALUES(${TENANT}::uuid,${PROPERTY}::uuid,'property','gbp20261001a.property'::ltree)`;
        await tx`INSERT INTO party VALUES(${TENANT}::uuid,${PARTY}::uuid,'active')`;
        await tx`INSERT INTO rate_plan VALUES(${TENANT}::uuid,${RATE_PLAN}::uuid,${PROPERTY}::uuid,
          'active',${POLICY}::uuid,NULL,NULL)`;
        await tx`INSERT INTO policy VALUES(${TENANT}::uuid,${POLICY}::uuid)`;
        await tx`SELECT public.assert_guest_booking_authority(${TENANT}::uuid,${PROPERTY}::uuid,
          ${ACTOR}::uuid,${PARTY}::uuid,${RATE_PLAN}::uuid)`;
      })).rejects.toMatchObject({ errno: "42501" });
    } finally {
      for (const scope of GUEST_BOOKING_ISSUER_SCOPES) {
        await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${scope}) ON CONFLICT DO NOTHING`;
      }
    }
  }, 10_000);

  test("P0b: issuer revocation waits for an in-flight locked authority check and denies the next command", async () => {
    const invitation = await issueInvitation();
    let signalQuoteResolve!: () => void;
    const quoteResolving = new Promise<void>((resolve) => { signalQuoteResolve = resolve; });
    const lockedService = createService(events!, () => Date.now(), 1_200, signalQuoteResolve);
    const session = lockedService.authenticate(invitation);
    expect(session).not.toBeNull();
    let authorizedCommand: Promise<unknown> | undefined;
    let revocation: Promise<unknown> | undefined;
    try {
      authorizedCommand = database!.withTenantTransaction(TENANT, (tx) =>
        lockedService.quote(tx, session!, requestBody(14)));
      await quoteResolving;
      revocation = deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid
        AND permission_code=${GUEST_BOOKING_ISSUER_SCOPES[4]}`;
      const completedBeforeUnlock = await Promise.race([
        revocation.then(() => true),
        Bun.sleep(100).then(() => false),
      ]);
      expect(completedBeforeUnlock).toBe(false);
      await authorizedCommand;
      await revocation;
      await expect(offer(invitation, 15)).rejects.toBeInstanceOf(GuestBookingError);
    } finally {
      await authorizedCommand?.catch(() => undefined);
      await revocation?.catch(() => undefined);
      await deploy!`INSERT INTO role_permission(role_id,permission_code)
        VALUES(${ROLE}::uuid,${GUEST_BOOKING_ISSUER_SCOPES[4]}) ON CONFLICT DO NOTHING`;
    }
  }, 10_000);

  test("P1: issues only for active same-tenant Party/property/rate plans with the complete live issuer grant", async () => {
    const token = await issueInvitation();
    expect(typeof token).toBe("string");
    expect(service!.authenticate(token)).not.toBeNull();
    await expect(issueInvitation({ partyId: FOREIGN_PARTY })).rejects.toBeInstanceOf(GuestBookingError);
    await expect(issueInvitation({ propertyNode: OTHER_PROPERTY })).rejects.toThrow();
    expect(await new Hs256TokenSigner(TOKEN_SECRET).verify(token)).toBeNull();
    await expect(issueInvitation({ ratePlanIds: [OTHER_RATE_PLAN] })).rejects.toThrow();
    await expect(issueInvitation({ tenantId: FOREIGN_TENANT, partyId: FOREIGN_PARTY, propertyNode: FOREIGN_PROPERTY,
      ratePlanIds: [FOREIGN_RATE_PLAN] })).rejects.toThrow();

    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${GUEST_BOOKING_ISSUER_SCOPES[4]}`;
    await expect(offer(token, 1)).rejects.toBeInstanceOf(GuestBookingError);
    await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${GUEST_BOOKING_ISSUER_SCOPES[4]})`;
  });

  test("C1: context reads authoritative property/plan metadata without writes and denies revoked issuer", async()=>{
    const token=await issueInvitation();
    const before=await fixtureCounts();
    const result=await withSession(token,(tx,session)=>service!.context(tx,session,{})) as {
      property:{id:string;name:string;timeZone:string};ratePlans:{id:string;code:string;name:string;unitTypes:unknown[]}[]
    };
    expect(result.property).toEqual({id:PROPERTY,name:"Guest Booking Proof",timeZone:"UTC"});
    expect(result.ratePlans).toEqual([{id:RATE_PLAN,code:"GBP-RATE",name:"Guest Booking Rate",unitTypes:[]}]);
    expect(await fixtureCounts()).toEqual(before);
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${GUEST_BOOKING_ISSUER_SCOPES[4]}`;
    try{await expect(withSession(token,(tx,session)=>service!.context(tx,session,{}))).rejects.toMatchObject({status:403});}
    finally{await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${GUEST_BOOKING_ISSUER_SCOPES[4]})`;}
  });

  test("C2: bound quote cannot extend a valid signed envelope with a later payload deadline",async()=>{
    const sessionToken=await issueInvitation();
    const quoted=await quote(sessionToken,18) as {quoteToken:string};
    const signer=new GuestBookingTokenSigner(TOKEN_SECRET,{now:()=>clockNow});
    const payload=signer.verify("quote",quoted.quoteToken)!.payload;
    const short=signer.issue("quote",payload,5);
    const before=await fixtureCounts();
    await expect(hold(sessionToken,short)).rejects.toMatchObject({status:403});
    expect(await fixtureCounts()).toEqual(before);
  });

  test("P2: canonical offer, quote, complete-tax hold and held commit bind one reservation with exact replay and tax lineage", async () => {
    quoteMode = "normal";
    const before = await fixtureCounts();
    const sessionToken = await issueInvitation();
    const offers = await offer(sessionToken, 0) as { readonly options: readonly unknown[] };
    expect(offers.options).toHaveLength(1);

    const quoted = await quote(sessionToken, 0) as {
      readonly quote: { readonly result: { readonly preTaxSubtotalMinor: bigint; readonly currency: string };
        readonly taxAssignmentState: string; readonly taxPreview: { readonly state: string } };
      readonly quoteToken: string;
      readonly paymentAccepted: false;
    };
    expect(quoted.quote.result.currency).toBe("INR");
    expect(quoted.quote.taxAssignmentState).toBe("configured");
    expect(quoted.quote.taxPreview.state).toBe("calculated");
    const jsonQuote = JSON.parse(JSON.stringify(quoted.quote, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    )) as { result: { preTaxSubtotalMinor: unknown } };
    expect(jsonQuote.result.preTaxSubtotalMinor).toBe("100000");
    expect(typeof jsonQuote.result.preTaxSubtotalMinor).toBe("string");
    expect(quoted.paymentAccepted).toBe(false);

    const held = await hold(sessionToken, quoted.quoteToken) as {
      readonly hold: { readonly holdId: string; readonly bindingId: string; readonly attributionId: string;
        readonly quoteHash: string; readonly snapshotHash: string; readonly currency: string };
      readonly holdToken: string;
      readonly replayed: boolean;
    };
    expect(held.replayed).toBe(false);
    expect(held.hold.currency).toBe("INR");
    expect(held.hold.quoteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(held.hold.snapshotHash).toMatch(/^[0-9a-f]{64}$/);

    const afterFirstHold = await fixtureCounts();
    const exactHoldReplay = await hold(sessionToken, quoted.quoteToken) as typeof held;
    expect(exactHoldReplay.replayed).toBe(true);
    expect(exactHoldReplay.hold.holdId).toBe(held.hold.holdId);
    expect(exactHoldReplay.hold.bindingId).toBe(held.hold.bindingId);
    expect(await fixtureCounts()).toEqual(afterFirstHold);
    expect(await fixtureCounts()).toMatchObject({
      holds: before.holds + 1,
      occupancies: before.occupancies + 1,
      hold_bindings: before.hold_bindings + 1,
      attributions: before.attributions + 1,
    });

    const reservation = await reserve(sessionToken, held.holdToken) as {
      readonly reservation: { readonly reservationId: string; readonly segmentId: string;
        readonly primaryPartyId: string; readonly source: string; readonly holdId: string;
        readonly currency: string; readonly from: string; readonly to: string };
      readonly paymentAccepted: false;
      readonly replayed: boolean;
    };
    expect(reservation.reservation).toMatchObject({
      primaryPartyId: PARTY,
      source: "hold",
      holdId: held.hold.holdId,
      currency: "INR",
      from: stay(0).stayStart,
      to: stay(0).stayEnd,
    });
    expect(reservation.replayed).toBe(false);
    expect(reservation.paymentAccepted).toBe(false);
    const replay = await reserve(sessionToken, held.holdToken) as typeof reservation;
    expect(replay.replayed).toBe(true);
    expect(replay.reservation.reservationId).toBe(reservation.reservation.reservationId);

    const lineage = await deploy!<{ count: number; hold_id: string; reservation_id: string; segment_id: string }[]>`
      SELECT count(*) OVER()::int AS count, hold_id::text, reservation_id::text, segment_id::text
      FROM tax_attribution_reservation_binding WHERE tenant_id=${TENANT}::uuid
        AND hold_id=${held.hold.holdId}::uuid AND reservation_id=${reservation.reservation.reservationId}::uuid
        AND segment_id=${reservation.reservation.segmentId}::uuid`;
    expect(lineage).toHaveLength(1);
    expect(lineage[0]).toMatchObject({ count: 1, hold_id: held.hold.holdId,
      reservation_id: reservation.reservation.reservationId, segment_id: reservation.reservation.segmentId });
    const after = await fixtureCounts();
    expect(after.reservations - before.reservations).toBe(1);
    expect(after.segments - before.segments).toBe(1);
    expect(after.hold_bindings - before.hold_bindings).toBe(1);
    expect(after.lineages - before.lineages).toBe(1);
    const eventRows = await deploy!<{ event_type: string; count: number }[]>`
      SELECT event_type,count(*)::int AS count FROM outbox WHERE tenant_id=${TENANT}::uuid
        AND event_type IN ('tax.attribution_bound','tax.attribution_reservation_bound',
          'reservation.confirmed','guest_booking.reservation_confirmed')
      GROUP BY event_type ORDER BY event_type`;
    expect(eventRows).toEqual([
      { event_type: "guest_booking.reservation_confirmed", count: 1 },
      { event_type: "reservation.confirmed", count: 1 },
      { event_type: "tax.attribution_bound", count: 1 },
      { event_type: "tax.attribution_reservation_bound", count: 1 },
    ]);
  });

  test("P3: session-bound tokens, strict request shapes and fixed command keys reject cross-session and caller-selected hold data", async () => {
    quoteMode = "normal";
    const firstSession = await issueInvitation();
    const otherSession = await issueInvitation();
    const firstQuote = await quote(firstSession, 2) as { readonly quoteToken: string };
    const otherSessionBefore = await fixtureCounts();
    await expect(hold(otherSession, firstQuote.quoteToken)).rejects.toBeInstanceOf(GuestBookingError);
    expect(await fixtureCounts()).toEqual(otherSessionBefore);
    await expect(withSession(firstSession, (tx, session) => service!.quote(tx, session, {
      ...requestBody(2), unexpected: "body-drift",
    }))).rejects.toBeInstanceOf(GuestBookingError);
    await expect(withSession(firstSession, (tx, session) => service!.hold(tx, session, {
      quoteToken: firstQuote.quoteToken, holdId: uuid(999),
    }, crypto.randomUUID()))).rejects.toBeInstanceOf(GuestBookingError);

    const accepted = await hold(firstSession, firstQuote.quoteToken) as { readonly holdToken: string; readonly hold: { readonly holdId: string } };
    const altered = `${accepted.holdToken.slice(0, -1)}${accepted.holdToken.endsWith("A") ? "B" : "A"}`;
    await expect(reserve(firstSession, altered)).rejects.toBeInstanceOf(GuestBookingError);
    await expect(withSession(firstSession, (tx, session) => service!.reserve(tx, session, {
      holdToken: accepted.holdToken, holdId: uuid(999),
    }, crypto.randomUUID()))).rejects.toBeInstanceOf(GuestBookingError);
    const changedSelection = await quote(firstSession, 3) as { readonly quoteToken: string };
    await expect(hold(firstSession, changedSelection.quoteToken)).rejects.toThrow();

    const persistedOwner = await issueInvitation();
    const laterSession = await issueInvitation();
    const persistedQuote = await quote(persistedOwner, 10) as { readonly quoteToken: string };
    const persistedHold = await hold(persistedOwner, persistedQuote.quoteToken) as {
      readonly holdToken: string; readonly hold: { readonly holdId: string };
    };
    const beforeAdoption = await fixtureCounts();
    await expect(reserve(laterSession, persistedHold.holdToken)).rejects.toBeInstanceOf(GuestBookingError);
    expect(await fixtureCounts()).toEqual(beforeAdoption);
    const storedHold = await deploy!<{ status: string; claims: number }[]>`
      SELECT status,(SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid
        AND slot_kind='hold' AND slot_ref=${persistedHold.hold.holdId}::uuid) claims
      FROM hold WHERE tenant_id=${TENANT}::uuid AND id=${persistedHold.hold.holdId}::uuid`;
    expect(storedHold).toEqual([{ status: "active", claims: 1 }]);
  });

  test("P4: price, release and policy drift fail closed, and an expired database hold cannot commit", async () => {
    quoteMode = "normal";
    const partialTaxSession = await issueInvitation();
    quoteMode = "partial_tax";
    const partialTaxQuote = await quote(partialTaxSession, 11) as {
      readonly quoteToken: string;
      readonly quote: { readonly taxAssignmentState: string; readonly taxPreview: { readonly state: string } };
    };
    expect(partialTaxQuote.quote.taxAssignmentState).toBe("none");
    expect(partialTaxQuote.quote.taxPreview.state).toBe("unavailable");
    const beforePartialTaxHold = await fixtureCounts();
    await expect(hold(partialTaxSession, partialTaxQuote.quoteToken)).rejects.toBeInstanceOf(QuotedTaxHoldBindingConflictError);
    expect(await fixtureCounts()).toEqual(beforePartialTaxHold);

    quoteMode = "normal";
    const priceSession = await issueInvitation();
    const priceQuote = await quote(priceSession, 4) as { readonly quoteToken: string };
    const beforePrice = await fixtureCounts();
    quoteMode = "price_drift";
    await expect(hold(priceSession, priceQuote.quoteToken)).rejects.toBeInstanceOf(GuestBookingError);
    expect(await fixtureCounts()).toEqual(beforePrice);

    quoteMode = "normal";
    const releaseSession = await issueInvitation();
    const releaseQuote = await quote(releaseSession, 5) as { readonly quoteToken: string };
    const releaseHold = await hold(releaseSession, releaseQuote.quoteToken) as { readonly holdToken: string; readonly hold: { readonly holdId: string } };
    quoteMode = "release_drift";
    await expect(reserve(releaseSession, releaseHold.holdToken)).rejects.toBeInstanceOf(GuestBookingError);
    quoteMode = "normal";
    await deploy!`UPDATE policy SET content=${JSON.stringify({ ...POLICY_CONTENT, rules: [{ before_hours: 48, penalty: { basis: "nights", value: 1 } }] })}::jsonb
      WHERE tenant_id=${TENANT}::uuid AND id=${POLICY}::uuid`;
    const policySession = await issueInvitation();
    const policyQuote = await quote(policySession, 6) as { readonly quoteToken: string };
    const beforePolicy = await fixtureCounts();
    await deploy!`UPDATE policy SET content=${JSON.stringify({ ...POLICY_CONTENT, rules: [{ before_hours: 72, penalty: { basis: "nights", value: 1 } }] })}::jsonb
      WHERE tenant_id=${TENANT}::uuid AND id=${POLICY}::uuid`;
    await expect(hold(policySession, policyQuote.quoteToken)).rejects.toBeInstanceOf(GuestBookingError);
    expect(await fixtureCounts()).toEqual(beforePolicy);
    await deploy!`UPDATE policy SET content=${JSON.stringify(POLICY_CONTENT)}::jsonb
      WHERE tenant_id=${TENANT}::uuid AND id=${POLICY}::uuid`;

    const expiredSession = await issueInvitation();
    const expiredQuote = await quote(expiredSession, 7) as { readonly quoteToken: string };
    const expiredHold = await hold(expiredSession, expiredQuote.quoteToken) as { readonly holdToken: string; readonly hold: { readonly holdId: string } };
    await deploy!`UPDATE hold SET expires_at=transaction_timestamp()-interval '1 second'
      WHERE tenant_id=${TENANT}::uuid AND id=${expiredHold.hold.holdId}::uuid AND status='active'`;
    const beforeExpiredCommit = await fixtureCounts();
    await expect(reserve(expiredSession, expiredHold.holdToken)).rejects.toThrow();
    const afterExpiredCommit = await fixtureCounts();
    expect(afterExpiredCommit.reservations).toBe(beforeExpiredCommit.reservations);
    expect(afterExpiredCommit.hold_bindings).toBe(beforeExpiredCommit.hold_bindings);
  });

  test("P5: expired session tokens fail authentication and concurrent last-unit holds admit one winner", async () => {
    let tokenClock = Date.now();
    const tokenSigner = new GuestBookingTokenSigner(TOKEN_SECRET, { now: () => tokenClock });
    const expiring = createService(events!, () => tokenClock);
    const firstToken = await issueInvitation();
    const first = expiring.authenticate(firstToken);
    expect(first).not.toBeNull();
    const expired = tokenSigner.issue("session", {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, primaryPartyId: PARTY,
      ratePlanIds: [RATE_PLAN], channelCode: CHANNEL, sessionId: uuid(202610019991),
      validFrom: Math.floor(tokenClock / 1_000), validUntil: Math.floor(tokenClock / 1_000) + 900,
    }, 900);
    tokenClock += 901_000;
    const expiredVerifier = new GuestBookingTokenSigner(TOKEN_SECRET, { now: () => tokenClock });
    expect(expiredVerifier.verify("session", expired)).toBeNull();
    expect(expiring.authenticate(expired)).toBeNull();

    quoteMode = "normal";
    const sessionA = await issueInvitation();
    const sessionB = await issueInvitation();
    const quoteA = await quote(sessionA, 8) as { readonly quoteToken: string };
    const quoteB = await quote(sessionB, 8) as { readonly quoteToken: string };
    const attempts = await Promise.allSettled([
      hold(sessionA, quoteA.quoteToken),
      hold(sessionB, quoteB.quoteToken),
    ]);
    const accepted = attempts.filter((result): result is PromiseFulfilledResult<unknown> => result.status === "fulfilled");
    expect(accepted).toHaveLength(1);
    expect(attempts).toHaveLength(2);
    const occupancy = await deploy!<{ holds: number; claims: number }[]>`
      SELECT (SELECT count(*)::int FROM hold WHERE tenant_id=${TENANT}::uuid
        AND period=tstzrange(${stay(8).stayStart}::timestamptz,${stay(8).stayEnd}::timestamptz,'[)') AND status='active') holds,
        (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid
          AND period=tstzrange(${stay(8).stayStart}::timestamptz,${stay(8).stayEnd}::timestamptz,'[)')) claims`;
    expect(occupancy).toEqual([{ holds: 1, claims: 1 }]);
  }, 45_000);

  test("P6: injected outbox failure rolls hold and commit effects back, then exact retries succeed", async () => {
    quoteMode = "normal";
    const session = await issueInvitation();
    const quoted = await quote(session, 9) as { readonly quoteToken: string };
    const beforeHoldFailure = await fixtureCounts();
    const failingHoldService = createService(new FailEventBus(events!, "guest_booking.hold_accepted"));
    await expect(hold(session, quoted.quoteToken, crypto.randomUUID(), failingHoldService)).rejects.toThrow("injected guest_booking.hold_accepted failure");
    expect(await fixtureCounts()).toEqual(beforeHoldFailure);

    const held = await hold(session, quoted.quoteToken) as { readonly holdToken: string; readonly hold: { readonly holdId: string } };
    const beforeCommitFailure = await fixtureCounts();
    const failingCommitService = createService(new FailEventBus(events!, "guest_booking.reservation_confirmed"));
    await expect(reserve(session, held.holdToken, crypto.randomUUID(), failingCommitService)).rejects.toThrow("injected guest_booking.reservation_confirmed failure");
    const afterCommitFailure = await fixtureCounts();
    expect(afterCommitFailure.reservations).toBe(beforeCommitFailure.reservations);
    expect(afterCommitFailure.segments).toBe(beforeCommitFailure.segments);
    expect(afterCommitFailure.lineages).toBe(beforeCommitFailure.lineages);
    const activeHold = await deploy!<{ status: string; claims: number }[]>`
      SELECT status,(SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT}::uuid
        AND slot_kind='hold' AND slot_ref=${held.hold.holdId}::uuid) claims
      FROM hold WHERE tenant_id=${TENANT}::uuid AND id=${held.hold.holdId}::uuid`;
    expect(activeHold).toEqual([{ status: "active", claims: 1 }]);
    const committed = await reserve(session, held.holdToken);
    expect(committed).toMatchObject({ replayed: false, paymentAccepted: false });
  });

  test("P7: database wall-clock expiry after quote and hold I/O rejects before durable mutation", async () => {
    const signer = new GuestBookingTokenSigner(TOKEN_SECRET);
    const makeSessionToken = (seconds: number) => {
      const validFrom = Math.floor(Date.now() / 1_000);
      return signer.issue("session", {
        tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, primaryPartyId: PARTY,
        ratePlanIds: [RATE_PLAN], channelCode: CHANNEL, sessionId: crypto.randomUUID(),
        validFrom, validUntil: validFrom + seconds,
      }, 900);
    };

    const quoteService = createService(events!, () => Date.now(), 1_200);
    const shortQuoteSession = quoteService.authenticate(makeSessionToken(1));
    expect(shortQuoteSession).not.toBeNull();
    const beforeQuoteExpiry = await fixtureCounts();
    await expect(database!.withTenantTransaction(TENANT, (tx) => quoteService.quote(
      tx, shortQuoteSession!, requestBody(12),
    ))).rejects.toBeInstanceOf(GuestBookingError);
    expect(await fixtureCounts()).toEqual(beforeQuoteExpiry);

    const longHoldToken = makeSessionToken(900);
    const quoteIssuer = createService(events!, () => Date.now());
    const quoteSession = quoteIssuer.authenticate(longHoldToken);
    expect(quoteSession).not.toBeNull();
    const issuedQuote = await database!.withTenantTransaction(TENANT, (tx) => quoteIssuer.quote(
      tx, quoteSession!, requestBody(13),
    )) as { readonly quoteToken: string };
    const issuedClaims = signer.verify("quote", issuedQuote.quoteToken);
    expect(issuedClaims).not.toBeNull();
    const expiringQuote = signer.issue("quote", {
      ...issuedClaims!.payload,
      validUntil: Math.floor(Date.now() / 1_000) + 2,
    }, 300);
    const delayedHoldService = createService(events!, () => Date.now(), 3_000);
    const holdSession = delayedHoldService.authenticate(longHoldToken);
    expect(holdSession).not.toBeNull();
    const beforeHoldExpiry = await fixtureCounts();
    await expect(database!.withTenantTransaction(TENANT, (tx) => delayedHoldService.hold(
      tx, holdSession!, { quoteToken: expiringQuote }, crypto.randomUUID(),
    ))).rejects.toBeInstanceOf(GuestBookingError);
    expect(await fixtureCounts()).toEqual(beforeHoldExpiry);
  }, 20_000);
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
      !deployIdentity[0].database_name.startsWith("yellow_guest_booking_proof") ||
      deployIdentity[0]?.server_version_num < 180_000 || deployIdentity[0]?.server_version_num >= 190_000 ||
      runtimeIdentity[0]?.server_version_num < 180_000 || runtimeIdentity[0]?.server_version_num >= 190_000) {
    throw new Error("Guest-booking integration proof refused an unowned or mismatched database target");
  }
}
