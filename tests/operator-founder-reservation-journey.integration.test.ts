import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { PartyProfileService } from "../src/contexts/crm";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import {
  AvailabilityProjectionService,
  AvailabilityService,
  HoldService,
  ReservationOccupancyService,
} from "../src/contexts/inventory";
import { RateConfigurationService, RatePublicationService, RateQuoteService } from "../src/contexts/rates";
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
const SECRET = "yellow-order-160-founder-journey-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000016011";
const FOREIGN_USER = "00000000-0000-0000-0000-000000016021";

if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL || !PASSWORD || !APPROVER_PASSWORD)) {
  throw new Error("Order 160 requires distinct deploy/runtime URLs and both local-review passwords");
}
if (REQUIRE_DATABASE && DEPLOY_URL === RUNTIME_URL) {
  throw new Error("Order 160 refuses one shared deployment/runtime database authority URL");
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL && PASSWORD && APPROVER_PASSWORD
  ? describe.serial
  : describe.skip;
const runTag = crypto.randomUUID().slice(0, 8);
const displayName = `Order 160 Founder Guest ${runTag}`;
const email = `founder-${runTag}@order160.test`;
const partyKey = `order160-party-${runTag}`;
const holdKey = `order160-hold-${runTag}`;
const commitKey = `order160-commit-${runTag}`;
const partyCorrelation = crypto.randomUUID();
const holdCorrelation = crypto.randomUUID();
const commitCorrelation = crypto.randomUUID();

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

async function counts(): Promise<Record<string, number>> {
  const rows = await admin<Array<Record<string, number>>>`
    SELECT
      (SELECT count(*)::int FROM account WHERE tenant_id=${SEED_TENANT.id}::uuid) AS accounts,
      (SELECT count(*)::int FROM folio WHERE tenant_id=${SEED_TENANT.id}::uuid) AS folios,
      (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS postings,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payments,
      (SELECT count(*)::int FROM document_series WHERE tenant_id=${SEED_TENANT.id}::uuid) AS document_series,
      (SELECT count(*)::int FROM document WHERE tenant_id=${SEED_TENANT.id}::uuid) AS documents
  `;
  if (!rows[0]) throw new Error("financial artifact count returned no row");
  return rows[0];
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
  loginPool = new SQL(RUNTIME_URL, { max: 4 });
  eventPool = new SQL(RUNTIME_URL, { max: 4, prepare: false });
  extensionPool = new SQL(RUNTIME_URL, { max: 4 });
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
  expect(verifiedScopes.filter((scope) => scope === "reservations.booking:write")).toEqual([
    "reservations.booking:write",
  ]);
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
  foreignPropertyToken = await tokens.issue({
    userId: FOREIGN_USER,
    tenantId: SEED_TENANT.id,
    scopes: ["inventory.availability:read", "reservations.booking:write"],
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

databaseDescribe("Order 160 founder reservation journey through runtime authority", () => {
  test("Party, offer, hold and reservation are executable, replayable and non-financial", async () => {
    const financialBefore = await counts();
    const partyInput = {
      kind: "person",
      displayName,
      legalName: null,
      roles: ["guest"],
      contacts: [{ kind: "email", value: email, isPrimary: true }],
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

    const from = new Date(Date.now() + 30 * 86_400_000);
    from.setUTCHours(15, 0, 0, 0);
    const to = new Date(from.getTime() + 2 * 86_400_000);
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
      stored: string;
    }>>`
      SELECT operation, response_status,
        completed_at IS NOT NULL AS complete,
        extract(epoch FROM expires_at-created_at)::int AS lifetime_seconds,
        to_jsonb(api_idempotency)::text AS stored
      FROM api_idempotency
      WHERE tenant_id=${SEED_TENANT.id}::uuid AND operation IN (
        'profiles.party.create', 'operator.inventory.holds.place', 'reservation.commit')
      ORDER BY operation
    `;
    expect(evidence.map(({ operation, response_status, complete, lifetime_seconds }) => ({
      operation, response_status, complete, lifetime_seconds,
    }))).toEqual([
      { operation: "operator.inventory.holds.place", response_status: 201, complete: true, lifetime_seconds: 86_400 },
      { operation: "profiles.party.create", response_status: 201, complete: true, lifetime_seconds: 86_400 },
      { operation: "reservation.commit", response_status: 201, complete: true, lifetime_seconds: 86_400 },
    ]);
    const evidenceText = evidence.map(({ stored }) => stored).join(" ");
    for (const sensitive of [partyKey, holdKey, commitKey, email]) expect(evidenceText).not.toContain(sensitive);
    expect(evidenceText).not.toContain("founder-");

    const privateEvidence = await admin<Array<{ stored: string }>>`
      SELECT payload::text AS stored FROM fact_log WHERE tenant_id=${SEED_TENANT.id}::uuid
      UNION ALL
      SELECT payload::text AS stored FROM outbox WHERE tenant_id=${SEED_TENANT.id}::uuid
    `;
    expect(privateEvidence.map(({ stored }) => stored).join(" ")).not.toContain(email);
    expect(await counts()).toEqual(financialBefore);
    const financialLink = await admin<Array<{ folios: number }>>`
      SELECT count(*)::int AS folios FROM folio WHERE reservation_id=${reservation.reservationId}::uuid
    `;
    expect(financialLink[0]?.folios).toBe(0);
  }, 120_000);
});
