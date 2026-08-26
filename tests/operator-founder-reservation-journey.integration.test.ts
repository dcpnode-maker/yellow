import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { PartyProfileService } from "../src/contexts/crm";
import { ChargeService, FolioService, FolioStatementService } from "../src/contexts/financials";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import {
  AvailabilityProjectionService,
  AvailabilityService,
  HoldService,
  ReservationOccupancyService,
} from "../src/contexts/inventory";
import {
  RateConfigurationService,
  RateEvaluationError,
  RatePublicationService,
  RateQuoteService,
} from "../src/contexts/rates";
import {
  ReservationCommitService,
  ReservationLifecycleService,
  ReservationOfferSearchService,
} from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import { ApprovalService, Database, ExtensionRegistry, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { REVIEW_EMAIL, REVIEW_PERMISSIONS, runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DEPLOY_URL = process.env.YELLOW_FOUNDER_RESERVATION_JOURNEY_DEPLOY_URL ??
  process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_FOUNDER_RESERVATION_JOURNEY_RUNTIME_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
const PASSWORD = process.env.YELLOW_FOUNDER_RESERVATION_JOURNEY_PASSWORD;
const APPROVER_PASSWORD = process.env.YELLOW_FOUNDER_RESERVATION_JOURNEY_APPROVER_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_FOUNDER_RESERVATION_JOURNEY === "1";
const EXPECTATION = process.env.YELLOW_FOUNDER_RESERVATION_JOURNEY_EXPECTATION;
const SECRET = "yellow-order-160-founder-journey-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000016011";
const FOREIGN_USER = "00000000-0000-0000-0000-000000016021";

if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL || !PASSWORD || !APPROVER_PASSWORD)) {
  throw new Error("Order 160 requires distinct deploy/runtime URLs and both local-review passwords");
}
if (REQUIRE_DATABASE && EXPECTATION !== "base-denied" && EXPECTATION !== "candidate-success") {
  throw new Error("Order 160 requires an explicit base-denied or candidate-success expectation");
}
if (REQUIRE_DATABASE && DEPLOY_URL === RUNTIME_URL) {
  throw new Error("Order 160 refuses one shared deployment/runtime database authority URL");
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL && PASSWORD && APPROVER_PASSWORD &&
  (EXPECTATION === "base-denied" || EXPECTATION === "candidate-success")
  ? describe.serial
  : describe.skip;
const runTag = crypto.randomUUID().slice(0, 8);
const displayName = `Order 160 Founder Guest ${runTag}`;
const email = `founder-${runTag}@order160.test`;
const phone = "+919876540160";
const whatsapp = "+919876550160";
const partyKey = `order160-party-${runTag}`;
const holdKey = `order160-hold-${runTag}`;
const commitKey = `order160-commit-${runTag}`;
const folioKey = `order171-folio-${runTag}`;
const chargeKey = `order171-charge-${runTag}`;
const partyCorrelation = crypto.randomUUID();
const holdCorrelation = crypto.randomUUID();
const commitCorrelation = crypto.randomUUID();
const rawSensitiveValues = Object.freeze([displayName, email, phone, whatsapp]);

let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let extensionPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;
let accessToken = "";
let noScopeToken = "";
let foreignPropertyToken = "";
let noFolioOpenToken = "";

function headers(token = accessToken, key?: string, correlationId = crypto.randomUUID()): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}),
    "x-correlation-id": correlationId,
  };
}

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

interface FinancialCounts {
  readonly accounts: number;
  readonly folios: number;
  readonly journals: number;
  readonly postings: number;
  readonly payment_instruments: number;
  readonly payments: number;
  readonly document_series: number;
  readonly documents: number;
  readonly fiscal_submissions: number;
}

async function counts(): Promise<FinancialCounts> {
  const rows = await admin<FinancialCounts[]>`
    SELECT
      (SELECT count(*)::int FROM account WHERE tenant_id=${SEED_TENANT.id}::uuid) AS accounts,
      (SELECT count(*)::int FROM folio WHERE tenant_id=${SEED_TENANT.id}::uuid) AS folios,
      (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS postings,
      (SELECT count(*)::int FROM payment_instrument WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payment_instruments,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payments,
      (SELECT count(*)::int FROM document_series WHERE tenant_id=${SEED_TENANT.id}::uuid) AS document_series,
      (SELECT count(*)::int FROM document WHERE tenant_id=${SEED_TENANT.id}::uuid) AS documents,
      (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${SEED_TENANT.id}::uuid) AS fiscal_submissions
  `;
  if (!rows[0]) throw new Error("financial artifact count returned no row");
  return rows[0];
}

async function serializedEvidence(): Promise<string> {
  const rows = await admin<Array<{ stored: string }>>`
    SELECT payload::text AS stored FROM fact_log WHERE tenant_id=${SEED_TENANT.id}::uuid
    UNION ALL
    SELECT payload::text AS stored FROM outbox WHERE tenant_id=${SEED_TENANT.id}::uuid
    UNION ALL
    SELECT to_jsonb(api_idempotency)::text AS stored FROM api_idempotency
      WHERE tenant_id=${SEED_TENANT.id}::uuid
  `;
  return rows.map(({ stored }) => stored).join(" ");
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL || !PASSWORD || !APPROVER_PASSWORD) return;
  await runSeed({ databaseUrl: DEPLOY_URL, logger: () => undefined });
  const review = await runReviewSeed({
    databaseUrl: DEPLOY_URL,
    password: PASSWORD,
    approverPassword: APPROVER_PASSWORD,
    logger: () => undefined,
  });
  admin = new SQL(DEPLOY_URL, { max: 4 });
  loginPool = new SQL(RUNTIME_URL, { max: 4, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 4, prepare: false });
  extensionPool = new SQL(RUNTIME_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 12, prepare: false });
  tokens = new Hs256TokenSigner(SECRET);

  const events = new PostgresEventBus(eventPool);
  const availability = new AvailabilityService();
  const projection = new AvailabilityProjectionService();
  const rates = new RateConfigurationService(events);
  const publication = new RatePublicationService(
    new ExtensionRegistry(extensionPool),
    new ApprovalService(events),
    events,
  );
  const offers = new ReservationOfferSearchService(
    rates,
    new RateQuoteService(publication, availability, projection),
    availability,
  );
  const holds = new HoldService(events);
  const reservations = new ReservationCommitService({
    holds,
    occupancy: new ReservationOccupancyService(events),
    events,
    idempotency: new PostgresIdempotency(),
  });
  const lifecycle = new ReservationLifecycleService({ events, idempotency: new PostgresIdempotency() });
  const parties = new PartyProfileService({ events, idempotency: new PostgresIdempotency() });
  const folios = new FolioService({ events, idempotency: new PostgresIdempotency() });
  const statements = new FolioStatementService();
  const charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      availability,
      undefined,
      new PostgresIdempotency(),
      undefined,
      rates,
      undefined,
      undefined,
      undefined,
      holds,
      projection,
      undefined,
      undefined,
      reservations,
      offers,
      undefined,
      lifecycle,
      undefined,
      parties,
      statements,
      charges,
      undefined,
      undefined,
      folios,
    ),
  });

  const empty = await admin<Array<{ reservations: number; holds: number }>>`
    SELECT
      (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid) AS reservations,
      (SELECT count(*)::int FROM hold WHERE tenant_id=${SEED_TENANT.id}::uuid) AS holds
  `;
  expect(empty[0]).toEqual({ reservations: 0, holds: 0 });

  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${FOREIGN_PROPERTY}::uuid, ${SEED_TENANT.id}::uuid,
      'yellow_demo.order160_foreign', 'property', 'Order 160 Other Property', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, auth, status)
    SELECT ${FOREIGN_USER}::uuid, tenant_id, 'foreign-order160@yellow.local',
      'Order 160 Other Property Operator', auth, 'active'
    FROM app_user WHERE id=${review.userId}::uuid
  `;
  await admin`
    INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
    VALUES (${SEED_TENANT.id}::uuid, ${FOREIGN_USER}::uuid, ${review.roleId}::uuid, ${FOREIGN_PROPERTY}::uuid)
  `;

  const login = await call("/api/v1/auth/local:login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
  });
  expect(login.status).toBe(200);
  accessToken = (await login.json() as { accessToken: string }).accessToken;
  const verified = await tokens.verify(accessToken);
  const verifiedScopes = verified?.scp.split(" ") ?? [];
  expect(verifiedScopes).toEqual(REVIEW_PERMISSIONS.map(({ code }) => code).sort());
  expect(verifiedScopes.filter((scope) => scope === "reservations.booking:write")).toEqual(
    EXPECTATION === "candidate-success" ? ["reservations.booking:write"] : [],
  );
  const properties = await call("/api/v1/me/properties", { headers: headers() });
  expect(properties.status).toBe(200);
  expect((await properties.json() as { properties: Array<{ id: string }> }).properties.map(({ id }) => id)).toEqual([
    SEED_PROPERTY.id,
  ]);
  noScopeToken = await tokens.issue({
    userId: review.userId,
    tenantId: SEED_TENANT.id,
    scopes: REVIEW_PERMISSIONS.map(({ code }) => code).filter((code) => code !== "reservations.booking:write"),
  });
  noFolioOpenToken = await tokens.issue({
    userId: review.userId,
    tenantId: SEED_TENANT.id,
    scopes: REVIEW_PERMISSIONS.map(({ code }) => code).filter((code) => code !== "financials.folios:open"),
  });
  foreignPropertyToken = await tokens.issue({
    userId: FOREIGN_USER,
    tenantId: SEED_TENANT.id,
    scopes: ["financials.folios:open", "inventory.availability:read", "reservations.booking:write"],
  });
  const foreignProperties = await call("/api/v1/me/properties", { headers: headers(foreignPropertyToken) });
  expect(foreignProperties.status).toBe(200);
  expect((await foreignProperties.json() as { properties: Array<{ id: string }> }).properties.map(({ id }) => id)).toEqual([
    FOREIGN_PROPERTY,
  ]);
}, 120_000);

afterAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL || !PASSWORD || !APPROVER_PASSWORD) return;
  await database.close();
  await extensionPool.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
}, 30_000);

databaseDescribe("Orders 160/171 founder reservation-to-folio journey through runtime authority", () => {
  test("Party, offer, hold, reservation, explicit folio and governed charge are executable and replayable", async () => {
    const financialBefore = await counts();
    const partyInput = {
      kind: "person",
      displayName,
      legalName: null,
      roles: ["guest"],
      contacts: [
        { kind: "email", value: email, isPrimary: true },
        { kind: "phone", value: phone },
        { kind: "whatsapp", value: whatsapp },
      ],
      acknowledgedDuplicatePartyIds: [],
    };
    const partyResponse = await call(`/api/v1/properties/${SEED_PROPERTY.id}/parties`, {
      method: "POST",
      headers: headers(accessToken, partyKey, partyCorrelation),
      body: JSON.stringify(partyInput),
    });
    expect(partyResponse.status).toBe(201);
    const partyText = await partyResponse.text();
    const party = (JSON.parse(partyText) as { party: { partyId: string; contacts: Array<{ hint: string }> } }).party;
    expect(party.contacts[0]?.hint).not.toContain(email);
    const partyReplay = await call(`/api/v1/properties/${SEED_PROPERTY.id}/parties`, {
      method: "POST", headers: headers(accessToken, partyKey), body: JSON.stringify(partyInput),
    });
    expect(partyReplay.status).toBe(201);
    expect(partyReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await partyReplay.text()).toBe(partyText);

    const searched = await call(`/api/v1/properties/${SEED_PROPERTY.id}/parties:search`, {
      method: "POST", headers: headers(), body: JSON.stringify({ query: displayName }),
    });
    expect(searched.status).toBe(200);
    const profiles = (await searched.json() as { profiles: Array<{ partyId: string; contacts: Array<{ hint: string }> }> }).profiles;
    expect(profiles.map(({ partyId }) => partyId)).toContain(party.partyId);
    expect(JSON.stringify(profiles)).not.toContain(email);

    const operatorScriptResponse = await call("/assets/operator.js");
    expect(operatorScriptResponse.status).toBe(200);
    const operatorScript = await operatorScriptResponse.text();
    expect(operatorScript).toContain("reservationBookingForm.elements.from.value = utcInstantInputValue(from)");
    expect(operatorScript).toContain("reservationBookingForm.elements.to.value = utcInstantInputValue(to)");
    const from = new Date();
    from.setDate(from.getDate() + 1);
    from.setHours(15, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 2);
    const offerResponse = await call(`/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        stay: { from: from.toISOString(), to: to.toISOString() },
        party: { adults: 1, children: [] },
        channel: "direct",
      }),
    });
    expect(offerResponse.status).toBe(200);
    const offers = (await offerResponse.json() as { options: Array<any> }).options;
    const offer = offers.find(({ bookable }: { bookable: boolean }) => bookable);
    expect(offer).toMatchObject({
      bookable: true,
      promise: false,
      commit_arbitration_required: true,
      stay: { from: from.toISOString(), to: to.toISOString() },
      total: { amount_minor: "25000", currency: "USD", kind: "pre_tax" },
    });

    const distantFrom = new Date(from.getTime() + 800 * 86_400_000);
    const distantTo = new Date(distantFrom.getTime() + 2 * 86_400_000);
    const outsideBookingWindow = await call(`/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        stay: { from: distantFrom.toISOString(), to: distantTo.toISOString() },
        party: { adults: 1, children: [] },
        channel: "direct",
      }),
    });
    expect(outsideBookingWindow.status).toBe(400);
    expect(outsideBookingWindow.headers.get("cache-control")).toBe("no-store");
    expect(await outsideBookingWindow.json()).toEqual(expect.objectContaining({
      type: "request/booking_window",
      title: "Stay dates unavailable",
      detail: "Choose stay dates within the next 730 property-local days",
    }));

    const unrelatedFailureApp = createApp({
      database,
      tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(
        new LocalLoginService(loginPool, tokens),
        undefined,
        undefined,
        new PostgresIdempotency(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { async search(): Promise<never> {
          throw new RateEvaluationError("currency must be an uppercase three-letter code");
        } },
      ),
    });
    const unrelatedFailure = await unrelatedFailureApp.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/availability:search`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          stay: { from: from.toISOString(), to: to.toISOString() },
          party: { adults: 1, children: [] },
          channel: "direct",
        }),
      },
    ));
    expect(unrelatedFailure.status).toBe(503);
    const unrelatedFailureText = await unrelatedFailure.text();
    expect(unrelatedFailureText).toContain("Availability is temporarily unavailable");
    expect(unrelatedFailureText).not.toContain("currency must be an uppercase three-letter code");

    const holdInput = {
      sellableUnitId: offer.sellable_unit.id,
      from: offer.stay.from,
      to: offer.stay.to,
      holderReference: `booking:${party.partyId}`,
    };
    const holdResponse = await call(`/api/v1/properties/${SEED_PROPERTY.id}/holds`, {
      method: "POST", headers: headers(accessToken, holdKey, holdCorrelation), body: JSON.stringify(holdInput),
    });
    expect(holdResponse.status).toBe(201);
    const holdText = await holdResponse.text();
    const hold = (JSON.parse(holdText) as { hold: { id: string; status: string } }).hold;
    expect(hold.status).toBe("active");
    const holdReplay = await call(`/api/v1/properties/${SEED_PROPERTY.id}/holds`, {
      method: "POST", headers: headers(accessToken, holdKey), body: JSON.stringify(holdInput),
    });
    expect(holdReplay.status).toBe(201);
    expect(holdReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await holdReplay.text()).toBe(holdText);

    const commitInput = {
      propertyNode: SEED_PROPERTY.id,
      holdId: hold.id,
      primaryPartyId: party.partyId,
      ratePlanId: offer.rate_plan.id,
      adults: 1,
      childAges: [],
      channelCode: "direct",
    };
    const deniedBefore = await admin<Array<{ hold_status: string; hold_claims: number; reservations: number }>>`
      SELECT status AS hold_status,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${hold.id}::uuid AND slot_kind='hold') AS hold_claims,
        (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid) AS reservations
      FROM hold WHERE id=${hold.id}::uuid
    `;
    expect(deniedBefore[0]).toEqual({ hold_status: "active", hold_claims: 1, reservations: 0 });
    const noScope = await call("/api/v1/reservations:commit", {
      method: "POST", headers: headers(noScopeToken, `order160-denied-scope-${runTag}`), body: JSON.stringify(commitInput),
    });
    expect(noScope.status).toBe(403);
    expect(await noScope.json()).toMatchObject({ type: "auth/scope_missing" });
    const foreignProperty = await call("/api/v1/reservations:commit", {
      method: "POST", headers: headers(foreignPropertyToken, `order160-denied-property-${runTag}`),
      body: JSON.stringify(commitInput),
    });
    expect(foreignProperty.status).toBe(403);
    expect(await foreignProperty.json()).toMatchObject({ type: "auth/property_forbidden" });
    const deniedAfter = await admin<Array<{ hold_status: string; hold_claims: number; reservations: number }>>`
      SELECT status AS hold_status,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${hold.id}::uuid AND slot_kind='hold') AS hold_claims,
        (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid) AS reservations
      FROM hold WHERE id=${hold.id}::uuid
    `;
    expect(deniedAfter).toEqual(deniedBefore);

    if (EXPECTATION === "base-denied") {
      const baseCommit = await call("/api/v1/reservations:commit", {
        method: "POST", headers: headers(accessToken, commitKey, commitCorrelation), body: JSON.stringify(commitInput),
      });
      expect(baseCommit.status).toBe(403);
      expect(await baseCommit.json()).toMatchObject({ type: "auth/scope_missing" });
      const baseAfter = await admin<Array<{
        hold_status: string;
        hold_claims: number;
        reservations: number;
        reservation_claims: number;
      }>>`
        SELECT status AS hold_status,
          (SELECT count(*)::int FROM space_occupancy
            WHERE slot_ref=${hold.id}::uuid AND slot_kind='hold') AS hold_claims,
          (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid) AS reservations,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${SEED_TENANT.id}::uuid
            AND operation='reservation.commit') AS reservation_claims
        FROM hold WHERE id=${hold.id}::uuid
      `;
      expect(baseAfter[0]).toEqual({
        hold_status: "active",
        hold_claims: 1,
        reservations: 0,
        reservation_claims: 0,
      });
      expect(await counts()).toEqual(financialBefore);
      const baseEvidence = await serializedEvidence();
      for (const sensitive of [...rawSensitiveValues, partyKey, holdKey, commitKey]) {
        expect(baseEvidence).not.toContain(sensitive);
      }
      return;
    }
    expect(EXPECTATION).toBe("candidate-success");

    const committed = await call("/api/v1/reservations:commit", {
      method: "POST", headers: headers(accessToken, commitKey, commitCorrelation), body: JSON.stringify(commitInput),
    });
    expect(committed.status).toBe(201);
    const committedText = await committed.text();
    const reservation = (JSON.parse(committedText) as { reservation: any }).reservation;
    expect(reservation).toMatchObject({
      status: "reserved",
      source: "hold",
      holdId: hold.id,
      primaryPartyId: party.partyId,
      ratePlanId: offer.rate_plan.id,
      sellableUnitId: offer.sellable_unit.id,
      adults: 1,
      childAges: [],
      channelCode: "direct",
      currency: "USD",
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const commitReplay = await call("/api/v1/reservations:commit", {
      method: "POST", headers: headers(accessToken, commitKey), body: JSON.stringify(commitInput),
    });
    expect(commitReplay.status).toBe(201);
    expect(commitReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await commitReplay.text()).toBe(committedText);
    const changedReplay = await call("/api/v1/reservations:commit", {
      method: "POST", headers: headers(accessToken, commitKey),
      body: JSON.stringify({ ...commitInput, adults: 2 }),
    });
    expect(changedReplay.status).toBe(409);

    const confirmation = await call(
      `/api/v1/properties/${SEED_PROPERTY.id}/reservations?confirmationNo=${encodeURIComponent(reservation.confirmationNo)}`,
      { headers: headers() },
    );
    expect(confirmation.status).toBe(200);
    expect(await confirmation.json()).toMatchObject({
      reservation: {
        reservationId: reservation.reservationId,
        confirmationNo: reservation.confirmationNo,
        status: "reserved",
        actions: { canModify: true, canCancel: true, canReinstate: false },
      },
    });

    const domain = await admin<Array<any>>`
      SELECT reservation.status AS reservation_status,
        reservation.primary_party AS primary_party,
        reservation.channel_code,
        reservation.currency,
        segment.seq, segment.status AS segment_status, segment.period::text AS period,
        segment.adults, segment.children, segment.rate_plan_id, segment.sellable_unit_id,
        guest.role AS guest_role, guest.share_pct,
        hold.status AS hold_status,
        (SELECT count(*)::int FROM reservation WHERE id=reservation.id) AS reservations,
        (SELECT count(*)::int FROM reservation_segment WHERE reservation_id=reservation.id) AS segments,
        (SELECT count(*)::int FROM reservation_guest WHERE reservation_id=reservation.id) AS guests,
        (SELECT count(*)::int FROM hold WHERE id=hold.id) AS holds,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=hold.id) AS hold_claims,
        (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=segment.id AND slot_kind='segment'
          AND period=segment.period) AS segment_claims,
        segment.period=tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)') AS exact_period,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=${party.partyId}::uuid
          AND fact_type='party.created') AS party_facts,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=hold.id
          AND fact_type='hold.created') AS hold_created_facts,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=reservation.id
          AND fact_type='reservation.confirmed') AS reservation_facts,
        (SELECT count(*)::int FROM fact_log WHERE entity_id=hold.id AND fact_type='hold.consumed') AS consumed_facts
      FROM reservation
      JOIN reservation_segment AS segment ON segment.reservation_id=reservation.id
      JOIN reservation_guest AS guest ON guest.reservation_id=reservation.id AND guest.party_id=reservation.primary_party
      JOIN hold ON hold.id=${hold.id}::uuid
      WHERE reservation.id=${reservation.reservationId}::uuid
    `;
    expect(domain[0]).toMatchObject({
      reservation_status: "reserved",
      primary_party: party.partyId,
      channel_code: "direct",
      currency: "USD",
      seq: 1,
      segment_status: "booked",
      adults: 1,
      children: [],
      rate_plan_id: offer.rate_plan.id,
      sellable_unit_id: offer.sellable_unit.id,
      guest_role: "primary",
      share_pct: null,
      hold_status: "consumed",
      reservations: 1,
      segments: 1,
      guests: 1,
      holds: 1,
      hold_claims: 0,
      segment_claims: 1,
      exact_period: true,
      party_facts: 1,
      hold_created_facts: 1,
      reservation_facts: 1,
      consumed_facts: 1,
    });

    const eventRows = await admin<Array<{ correlation_id: string; event_types: string[] }>>`
      SELECT correlation_id, array_agg(event_type ORDER BY seq) AS event_types
      FROM outbox
      WHERE correlation_id IN (${partyCorrelation}::uuid, ${holdCorrelation}::uuid, ${commitCorrelation}::uuid)
      GROUP BY correlation_id
    `;
    expect(Object.fromEntries(eventRows.map(({ correlation_id, event_types }) => [correlation_id, event_types]))).toEqual({
      [partyCorrelation]: ["party.created"],
      [holdCorrelation]: ["hold.created", "occupancy.recorded"],
      [commitCorrelation]: ["hold.consumed", "occupancy.released", "occupancy.recorded", "reservation.confirmed"],
    });

    const evidence = await admin<Array<{
      operation: string;
      response_status: number;
      complete: boolean;
      lifetime_seconds: number;
      same_instant: boolean;
      key_hash: string;
      request_hash: string;
      response_body: Record<string, any>;
      stored: string;
    }>>`
      SELECT operation, response_status,
        completed_at IS NOT NULL AS complete,
        extract(epoch FROM expires_at-created_at)::int AS lifetime_seconds,
        completed_at=created_at AS same_instant,
        key_hash, request_hash, response_body,
        to_jsonb(api_idempotency)::text AS stored
      FROM api_idempotency
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND operation IN (
        'profiles.party.create', 'operator.inventory.holds.place', 'reservation.commit')
      ORDER BY operation
    `;
    expect(evidence.map(({ operation, response_status, complete, lifetime_seconds, same_instant }) => ({
      operation, response_status, complete, lifetime_seconds, same_instant,
    }))).toEqual([
      { operation: "operator.inventory.holds.place", response_status: 201, complete: true,
        lifetime_seconds: 86_400, same_instant: true },
      { operation: "profiles.party.create", response_status: 201, complete: true,
        lifetime_seconds: 86_400, same_instant: true },
      { operation: "reservation.commit", response_status: 201, complete: true,
        lifetime_seconds: 86_400, same_instant: true },
    ]);
    for (const row of evidence) {
      expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.request_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.response_body).toBeTruthy();
    }
    expect(evidence.find(({ operation }) => operation === "profiles.party.create")?.response_body)
      .toMatchObject({ partyId: party.partyId });
    expect(evidence.find(({ operation }) => operation === "operator.inventory.holds.place")?.response_body)
      .toMatchObject({ hold: { id: hold.id, status: "active" } });
    expect(evidence.find(({ operation }) => operation === "reservation.commit")?.response_body)
      .toMatchObject({ reservationId: reservation.reservationId, holdId: hold.id, status: "reserved" });
    const evidenceText = evidence.map(({ stored }) => stored).join(" ");
    for (const sensitive of [...rawSensitiveValues, partyKey, holdKey, commitKey]) {
      expect(evidenceText).not.toContain(sensitive);
    }
    const privateEvidence = await serializedEvidence();
    for (const sensitive of [...rawSensitiveValues, partyKey, holdKey, commitKey]) {
      expect(privateEvidence).not.toContain(sensitive);
    }
    expect(await counts()).toEqual(financialBefore);
    const financialLinkBefore = await admin<Array<{ folios: number }>>`
      SELECT count(*)::int AS folios FROM folio WHERE reservation_id=${reservation.reservationId}::uuid
    `;
    expect(financialLinkBefore[0]?.folios).toBe(0);

    const openPath = `/api/v1/properties/${SEED_PROPERTY.id}/reservations/${reservation.reservationId}/primary-folio`;
    const deniedOpen = await call(openPath, {
      method: "POST", headers: headers(noFolioOpenToken, `order171-denied-${runTag}`), body: "{}",
    });
    expect(deniedOpen.status).toBe(403);
    const foreignOpen = await call(openPath, {
      method: "POST", headers: headers(foreignPropertyToken, `order171-foreign-${runTag}`), body: "{}",
    });
    expect(foreignOpen.status).toBe(403);
    const malformedOpen = await call(openPath, {
      method: "POST", headers: headers(accessToken, `order171-malformed-${runTag}`),
      body: JSON.stringify({ accountId: crypto.randomUUID() }),
    });
    expect(malformedOpen.status).toBe(400);
    expect(await counts()).toEqual(financialBefore);

    const opened = await call(openPath, {
      method: "POST", headers: headers(accessToken, folioKey), body: "{}",
    });
    expect(opened.status).toBe(201);
    expect(opened.headers.get("idempotency-replayed")).toBe("false");
    const openedText = await opened.text();
    expect(openedText).not.toMatch(/account|party|displayName|email|phone/i);
    const primaryFolio = JSON.parse(openedText) as {
      folioId: string; reservationId: string; folioNo: string; windowNo: number;
      changed: boolean; replayed: boolean;
    };
    expect(primaryFolio).toMatchObject({
      reservationId: reservation.reservationId, windowNo: 1, changed: true, replayed: false,
    });
    const openedReplay = await call(openPath, {
      method: "POST", headers: headers(accessToken, folioKey), body: "{}",
    });
    expect(openedReplay.status).toBe(201);
    expect(openedReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await openedReplay.json()).toEqual({ ...primaryFolio, replayed: true });

    const emptyStatement = await call(
      `/api/v1/properties/${SEED_PROPERTY.id}/folios/${primaryFolio.folioId}/statement?limit=50`,
      { headers: headers() },
    );
    expect(emptyStatement.status).toBe(200);
    expect(await emptyStatement.json()).toMatchObject({
      folio: { id: primaryFolio.folioId, reference: primaryFolio.folioNo, windowNo: 1, status: "open", currency: "USD" },
      balanceMinor: "0", lineCount: 0, rows: [],
      chargeOptions: [{ code: "ROOM", name: "Room charge", usaliLine: "Rooms" }],
      chargeAvailability: { allowed: true, reason: null },
    });

    const charged = await call(`/api/v1/properties/${SEED_PROPERTY.id}/folios/${primaryFolio.folioId}/charges`, {
      method: "POST",
      headers: headers(accessToken, chargeKey),
      body: JSON.stringify({ txCode: "ROOM", amountMinor: "12500", quantity: "1.000" }),
    });
    expect(charged.status).toBe(201);
    const charge = await charged.json() as { journalId: string; amountMinor: string; currency: string; replayed: boolean };
    expect(charge).toMatchObject({ amountMinor: "12500", currency: "USD", replayed: false });
    const refreshed = await call(
      `/api/v1/properties/${SEED_PROPERTY.id}/folios/${primaryFolio.folioId}/statement?limit=50`,
      { headers: headers() },
    );
    expect(refreshed.status).toBe(200);
    expect(await refreshed.json()).toMatchObject({
      balanceMinor: "12500", lineCount: 1,
      rows: [{ journalId: charge.journalId, kind: "charge", txCode: "ROOM", amountMinor: "12500", runningBalanceMinor: "12500" }],
    });

    const financialAfter = await counts();
    expect(financialAfter).toEqual({
      ...financialBefore,
      accounts: financialBefore.accounts + 1,
      folios: financialBefore.folios + 1,
      journals: financialBefore.journals + 1,
      postings: financialBefore.postings + 2,
    });
    const exactFinancials = await admin<Array<{
      folios: number; guest_accounts: number; folio_facts: number; folio_events: number;
      folio_keys: number; charge_keys: number; balanced: string; series_advanced: boolean;
    }>>`
      SELECT
        (SELECT count(*)::int FROM folio WHERE reservation_id=${reservation.reservationId}::uuid) AS folios,
        (SELECT count(*)::int FROM account WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND property_node=${SEED_PROPERTY.id}::uuid AND party_id=${party.partyId}::uuid
          AND role='guest' AND currency='USD') AS guest_accounts,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND entity_id=${primaryFolio.folioId}::uuid AND fact_type='folio.opened') AS folio_facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND aggregate_id=${primaryFolio.folioId}::uuid AND event_type='folio.opened') AS folio_events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND operation='financials.folio.open') AS folio_keys,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND operation='financials.charge.post') AS charge_keys,
        (SELECT sum(amount_minor)::text FROM posting_line WHERE journal_id=${charge.journalId}::uuid) AS balanced,
        (SELECT next_no > 1 FROM document_series WHERE tenant_id=${SEED_TENANT.id}::uuid
          AND property_node=${SEED_PROPERTY.id}::uuid AND kind='folio' AND fiscal=false) AS series_advanced
    `;
    expect(exactFinancials[0]).toEqual({
      folios: 1, guest_accounts: 1, folio_facts: 1, folio_events: 1,
      folio_keys: 1, charge_keys: 1, balanced: "0", series_advanced: true,
    });
  }, 120_000);
});
