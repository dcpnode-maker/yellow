import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  Hs256TokenSigner,
  LocalLoginService,
} from "../src/contexts/identity";
import {
  AvailabilityProjectionService,
  AvailabilityService,
  type SearchAvailabilityInput,
} from "../src/contexts/inventory";
import {
  RateConfigurationService,
  RatePublicationService,
  RateQuoteService,
} from "../src/contexts/rates";
import {
  ReservationOfferSearchService,
  ReservationOfferSearchTooBroadError,
  ReservationOfferValidationError,
  type ReservationOfferSearchInput,
} from "../src/contexts/reservations";
import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";
import { OperatorHttpApi } from "../src/http/operator";
import {
  ApprovalService,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";
import { runReviewSeed, REVIEW_EMAIL } from "../scripts/seed-review";
import { SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_RESERVATION_OFFERS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_OFFERS === "1";
const PASSWORD = process.env.YELLOW_RESERVATION_OFFERS_PASSWORD;
const APPROVER_PASSWORD = process.env.YELLOW_RESERVATION_OFFERS_APPROVER_PASSWORD;
const SECRET = "yellow-order-084-offer-search-token-secret";
const OCCUPANCY_SLOT = "00000000-0000-0000-0000-000000008401";
const RESTRICTION = "00000000-0000-0000-0000-000000008402";

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD || !APPROVER_PASSWORD)) {
  throw new Error(
    "YELLOW_RESERVATION_OFFERS_URL, YELLOW_RESERVATION_OFFERS_PASSWORD and " +
    "YELLOW_RESERVATION_OFFERS_APPROVER_PASSWORD are required by the Order 084 proof",
  );
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let registryPool: SQL;
let database: Database;
let availability: AvailabilityService;
let projection: AvailabilityProjectionService;
let rates: RateConfigurationService;
let registry: ExtensionRegistry;
let publication: RatePublicationService;
let offers: ReservationOfferSearchService;
let tokens: Hs256TokenSigner;
let app: ReturnType<typeof createApp>;
let accessToken: string;
let ratePlanId: string;
let stayStart: Date;
let stayEnd: Date;
let localStart: string;
let localEnd: string;

interface InventoryFixtureRow {
  readonly sellable_unit_id: string;
  readonly sellable_unit_name: string;
  readonly unit_type_id: string;
  readonly unit_type_code: string;
  readonly space_id: string;
  readonly space_code: string;
}

interface ArtifactCounts {
  readonly holds: number;
  readonly occupancies: number;
  readonly reservations: number;
  readonly segments: number;
  readonly guests: number;
  readonly facts: number;
  readonly events: number;
  readonly idempotency: number;
}

function input(overrides: Partial<ReservationOfferSearchInput> = {}): ReservationOfferSearchInput {
  return {
    propertyNode: SEED_PROPERTY.id,
    stayStart,
    stayEnd,
    guests: { adults: 1, childAges: [] },
    channelCode: "direct",
    ...overrides,
  };
}

async function artifactCounts(): Promise<ArtifactCounts> {
  const rows = await admin<ArtifactCounts[]>`
    SELECT
      (SELECT count(*)::int FROM hold WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS holds,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS occupancies,
      (SELECT count(*)::int FROM reservation WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS reservations,
      (SELECT count(*)::int FROM reservation_segment WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS segments,
      (SELECT count(*)::int FROM reservation_guest WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS guests,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id = ${SEED_TENANT.id}::uuid) AS idempotency
  `;
  const row = rows[0];
  if (!row) throw new Error("artifact count query returned no row");
  return row;
}

async function inventoryFixtures(): Promise<readonly InventoryFixtureRow[]> {
  return admin<InventoryFixtureRow[]>`
    SELECT sellable.id AS sellable_unit_id, sellable.name AS sellable_unit_name,
           unit_type.id AS unit_type_id, unit_type.code AS unit_type_code,
           space.id AS space_id, space.code AS space_code
    FROM sellable_unit AS sellable
    JOIN unit_type ON unit_type.id = sellable.unit_type_id
    JOIN sellable_unit_space AS mapping ON mapping.sellable_unit_id = sellable.id
    JOIN space ON space.id = mapping.space_id
    WHERE sellable.tenant_id = ${SEED_TENANT.id}::uuid
      AND unit_type.property_node = ${SEED_PROPERTY.id}::uuid
    ORDER BY unit_type.sort_order, unit_type.code, sellable.name, sellable.id
  `;
}

function canonicalBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    stay: { from: stayStart.toISOString(), to: stayEnd.toISOString() },
    party: { adults: 1, children: [] },
    channel: "direct",
    ...overrides,
  };
}

function jsonHeaders(token = accessToken): HeadersInit {
  return { "content-type": "application/json", authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD || !APPROVER_PASSWORD) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 4 });
  registryPool = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 10 });
  const review = await runReviewSeed({
    databaseUrl: DATABASE_URL,
    password: PASSWORD,
    approverPassword: APPROVER_PASSWORD,
    logger: () => undefined,
  });
  ratePlanId = review.rate.ratePlanId;
  stayStart = new Date(Date.now() + 30 * 86_400_000);
  stayStart.setUTCHours(15, 0, 0, 0);
  stayEnd = new Date(stayStart.getTime() + 2 * 86_400_000);
  const dates = await admin<Array<{ local_start: string; local_end: string }>>`
    SELECT (${stayStart.toISOString()}::timestamptz AT TIME ZONE timezone)::date::text AS local_start,
           (${stayEnd.toISOString()}::timestamptz AT TIME ZONE timezone)::date::text AS local_end
    FROM org_node WHERE id = ${SEED_PROPERTY.id}::uuid
  `;
  localStart = dates[0]?.local_start ?? "";
  localEnd = dates[0]?.local_end ?? "";
  if (!localStart || !localEnd) throw new Error("property-local offer dates are unavailable");

  const events = new PostgresEventBus(eventPool);
  availability = new AvailabilityService();
  projection = new AvailabilityProjectionService();
  rates = new RateConfigurationService(events);
  registry = new ExtensionRegistry(registryPool);
  publication = new RatePublicationService(
    registry,
    new ApprovalService(events),
    events,
  );
  const quote = new RateQuoteService(
    publication,
    new TaxJurisdictionResolutionService(registry),
    availability,
    projection,
  );
  offers = new ReservationOfferSearchService(rates, quote, availability);
  tokens = new Hs256TokenSigner(SECRET);
  const login = new LocalLoginService(loginPool, tokens);
  app = createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      login,
      availability,
      undefined,
      new PostgresIdempotency(),
      undefined,
      rates,
      undefined,
      undefined,
      undefined,
      undefined,
      projection,
      undefined,
      undefined,
      undefined,
      offers,
    ),
  });
  const loginResponse = await app.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant: SEED_TENANT.slug, email: REVIEW_EMAIL, password: PASSWORD }),
  }));
  const loginBody = await loginResponse.json() as { accessToken?: string };
  if (loginResponse.status !== 200 || !loginBody.accessToken) throw new Error("review login failed");
  accessToken = loginBody.accessToken;
}, 90_000);

afterAll(async () => {
  if (!DATABASE_URL) return;
  await admin`DELETE FROM restriction WHERE id = ${RESTRICTION}::uuid`;
  await admin`DELETE FROM space_occupancy WHERE slot_ref = ${OCCUPANCY_SLOT}::uuid`;
  await admin.close();
  await loginPool.close();
  await eventPool.close();
  await registryPool.close();
  await database.close();
}, 30_000);

describe("Order 084 offer-search pre-registration", () => {
  test("P0: the canonical reservation-offer composer is public", () => {
    expect(ReservationOfferSearchService).toBeDefined();
    expect(ReservationOfferValidationError).toBeDefined();
    expect(ReservationOfferSearchTooBroadError).toBeDefined();
  });
});

databaseDescribe("Order 084 live PostgreSQL reservation offers", () => {
  test("P1: published two-night offers bind exact money and evidence without writes", async () => {
    const before = await artifactCounts();
    const result = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input()));
    expect(result.summary).toEqual({
      inventoryOptions: 5,
      candidatePairs: 5,
      evaluatedPairs: 5,
      bookable: 5,
      blocked: 0,
      unpriced: 0,
      conflicted: 0,
      publicationUnavailable: 0,
      pricingEvidenceUnavailable: 0,
      workLimit: 1_000,
    });
    expect(result.issues).toEqual([]);
    expect(result.options).toHaveLength(5);
    for (const offer of result.options) {
      expect(offer).toMatchObject({
        state: "bookable",
        bookable: true,
        promise: false,
        commitArbitrationRequired: true,
        ratePlan: { id: ratePlanId, code: "FLEX", currency: "USD" },
        release: { version: expect.any(Number), contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
        stay: { from: stayStart.toISOString(), to: stayEnd.toISOString(), localFrom: localStart, localTo: localEnd },
        perNight: [
          { date: localStart, amountMinor: 12_500n },
          { date: expect.any(String), amountMinor: 12_500n },
        ],
        total: { amountMinor: 25_000n, currency: "USD", kind: "pre_tax" },
        taxAssignmentState: "none",
        availableCount: 1,
      });
      expect(offer.optionRef).toMatch(/^offer:[0-9a-f]{64}$/);
      expect(offer.evidence.quoteHash).toMatch(/^[0-9a-f]{64}$/);
      expect(offer.evidence.availabilityRef).toMatch(/^availability:/);
      expect(Object.values(offer.policies).filter(Boolean)).toHaveLength(4);
      expect(offer.taxes).toHaveLength(2);
      expect(offer.taxes.every(({ jurisdictionKey, evidenceRef }) =>
        jurisdictionKey === null && evidenceRef === null
      )).toBe(true);
    }
    expect(await artifactCounts()).toEqual(before);
  });

  test("P2: typed filters, exact hot attributes and the work ceiling fail closed", async () => {
    const fixtures = await inventoryFixtures();
    const deluxe = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input({
      unitTypeCodes: ["DLX"],
      ratePlanCodes: ["FLEX"],
      currency: "USD",
    })));
    expect(deluxe.options.map(({ unitType }) => unitType.code)).toEqual(["DLX", "DLX"]);

    const party = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input({
      guests: { adults: 3, childAges: [] },
    })));
    expect(party.options.map(({ unitType }) => unitType.code)).toEqual(["DLX", "DLX"]);

    const room201 = fixtures.find(({ space_code }) => space_code === "201");
    if (!room201) throw new Error("Room 201 fixture is absent");
    await admin`UPDATE space SET gender_policy = 'female' WHERE id = ${room201.space_id}::uuid`;
    try {
      const female = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input({
        attributes: { genderPolicy: "female" },
      })));
      expect(female.options.map(({ sellableUnit }) => sellableUnit.name)).toEqual(["Room 201"]);
    } finally {
      await admin`UPDATE space SET gender_policy = 'any' WHERE id = ${room201.space_id}::uuid`;
    }

    const noCurrency = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input({
      currency: "AED",
    })));
    expect(noCurrency.options).toEqual([]);
    expect(noCurrency.summary.candidatePairs).toBe(0);

    await expect(database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input({
      unitTypeCodes: ["STD", "STD"],
    })))).rejects.toBeInstanceOf(ReservationOfferValidationError);
    await expect(database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input({
      commercial: { channelCode: "booking-com" },
    })))).rejects.toBeInstanceOf(ReservationOfferValidationError);

    const bounded = new ReservationOfferSearchService(
      rates,
      new RateQuoteService(
        publication,
        new TaxJurisdictionResolutionService(registry),
        availability,
        projection,
      ),
      availability,
      { maxCandidatePairs: 4 },
    );
    await expect(database.withTenantTransaction(SEED_TENANT.id, (tx) => bounded.search(tx, input())))
      .rejects.toBeInstanceOf(ReservationOfferSearchTooBroadError);
  });

  test("P3: live occupancy and restrictions beat favorable projection; stale-low projection cannot block fixed truth", async () => {
    const fixtures = await inventoryFixtures();
    const room101 = fixtures.find(({ space_code }) => space_code === "101");
    const standard = fixtures.find(({ unit_type_code }) => unit_type_code === "STD");
    if (!room101 || !standard) throw new Error("standard review fixtures are absent");

    await admin`
      INSERT INTO availability_projection (
        tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo
      )
      SELECT ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, unit_type.id, day::date, 100, 0, 0, 0, 0
      FROM unit_type
      CROSS JOIN generate_series(${localStart}::date, (${localEnd}::date - 1), interval '1 day') AS day
      WHERE unit_type.tenant_id = ${SEED_TENANT.id}::uuid
        AND unit_type.property_node = ${SEED_PROPERTY.id}::uuid
      ON CONFLICT (property_node, unit_type_id, stay_date)
      DO UPDATE SET physical = EXCLUDED.physical, sold = 0, held = 0, blocked = 0, ooo = 0
    `;
    await admin`
      INSERT INTO space_occupancy (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
      VALUES (${SEED_TENANT.id}::uuid, ${room101.space_id}::uuid,
              tstzrange(${stayStart.toISOString()}::timestamptz, ${stayEnd.toISOString()}::timestamptz, '[)'),
              ${OCCUPANCY_SLOT}::uuid, 'hold', true, int4range(0, NULL))
    `;
    const occupiedBefore = await artifactCounts();
    const occupied = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input()));
    const blockedRoom = occupied.options.find(({ sellableUnit }) => sellableUnit.id === room101.sellable_unit_id);
    expect(blockedRoom).toMatchObject({
      state: "blocked", bookable: false, availableCount: 0, total: null, perNight: [],
    });
    expect(await artifactCounts()).toEqual(occupiedBefore);
    await admin`DELETE FROM space_occupancy WHERE slot_ref = ${OCCUPANCY_SLOT}::uuid`;

    await admin`
      INSERT INTO restriction (
        id, tenant_id, scope_node, unit_type_id, rate_plan_id, kind, stay_dates, source
      ) VALUES (
        ${RESTRICTION}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid,
        ${standard.unit_type_id}::uuid, ${ratePlanId}::uuid, 'closed',
        daterange(${localStart}::date, ${localEnd}::date, '[)'), 'manual'
      )
    `;
    const restrictedBefore = await artifactCounts();
    const restricted = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input()));
    const standardOffers = restricted.options.filter(({ unitType }) => unitType.code === "STD");
    expect(standardOffers).toHaveLength(3);
    expect(standardOffers.every(({ state, total, restrictionsApplied }) =>
      state === "blocked" && total === null && restrictionsApplied.some(({ kind }) => kind === "closed")
    )).toBe(true);
    expect(await artifactCounts()).toEqual(restrictedBefore);
    await admin`DELETE FROM restriction WHERE id = ${RESTRICTION}::uuid`;

    await admin`
      UPDATE availability_projection SET physical = 100, sold = 100, held = 0, blocked = 0, ooo = 0
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND property_node = ${SEED_PROPERTY.id}::uuid
        AND stay_date >= ${localStart}::date AND stay_date < ${localEnd}::date
    `;
    const staleLow = await database.withTenantTransaction(SEED_TENANT.id, (tx) => offers.search(tx, input()));
    expect(staleLow.options).toHaveLength(5);
    expect(staleLow.options.every(({ state, bookable }) => state === "bookable" && bookable)).toBe(true);
  });

  test("P4: canonical HTTP is strict and authorized while legacy raw truth remains compatible", async () => {
    const canonical = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify(canonicalBody()),
      },
    ));
    expect(canonical.status).toBe(200);
    expect(canonical.headers.get("cache-control")).toBe("no-store");
    expect(canonical.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    const body = await canonical.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("tenant_id");
    expect(body).not.toHaveProperty("actor_id");
    expect(body).toMatchObject({
      summary: { candidate_pairs: 5, bookable: 5, work_limit: 1_000 },
      issues: [],
    });
    const canonicalOptions = body.options as Array<Record<string, unknown>>;
    expect(canonicalOptions).toHaveLength(5);
    expect(canonicalOptions[0]).toMatchObject({
      option_ref: expect.stringMatching(/^offer:/),
      state: "bookable",
      promise: false,
      commit_arbitration_required: true,
      rate_plan: { code: "FLEX", currency: "USD" },
      total: { amount_minor: "25000", currency: "USD", kind: "pre_tax" },
      available_count: 1,
    });

    const legacy = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${SEED_PROPERTY.id}/availability:search`, {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ from: stayStart.toISOString(), to: stayEnd.toISOString(), partySize: 1 }),
      },
    ));
    expect(legacy.status).toBe(200);
    const legacyBody = await legacy.json() as { options: Array<Record<string, unknown>> };
    expect(legacyBody.options).toHaveLength(5);
    expect(legacyBody.options[0]).toMatchObject({
      sellableUnitName: "Room 101", unitTypeCode: "STD", availableCount: 1, bookable: true,
    });

    const noScope = await tokens.issue({
      userId: "00000000-0000-0000-0000-000000008410",
      tenantId: SEED_TENANT.id,
      scopes: [],
    });
    const noGrant = await tokens.issue({
      userId: "00000000-0000-0000-0000-000000008411",
      tenantId: SEED_TENANT.id,
      scopes: ["inventory.availability:read"],
    });
    const path = `/api/v1/properties/${SEED_PROPERTY.id}/availability:search`;
    const forbiddenScope = await app.handle(new Request(`http://yellow.test${path}`, {
      method: "POST", headers: jsonHeaders(noScope), body: JSON.stringify(canonicalBody()),
    }));
    const forbiddenProperty = await app.handle(new Request(`http://yellow.test${path}`, {
      method: "POST", headers: jsonHeaders(noGrant), body: JSON.stringify(canonicalBody()),
    }));
    const malformed = await app.handle(new Request(`http://yellow.test${path}`, {
      method: "POST", headers: jsonHeaders(), body: JSON.stringify(canonicalBody({ unknown: true })),
    }));
    expect(await forbiddenScope.json()).toMatchObject({ status: 403, type: "auth/scope_missing" });
    expect(await forbiddenProperty.json()).toMatchObject({ status: 403, type: "auth/property_forbidden" });
    expect(await malformed.json()).toMatchObject({ status: 400, type: "request/invalid" });
  });

  test("P5: one broad read plus exact sellable quote reads is deterministic and linear", async () => {
    const exactCalls: SearchAvailabilityInput[] = [];
    const exactAvailability: Pick<AvailabilityService, "search"> = {
      async search(tx, value) {
        exactCalls.push(value);
        return availability.search(tx, value);
      },
    };
    const observed = new ReservationOfferSearchService(
      rates,
      new RateQuoteService(
        publication,
        new TaxJurisdictionResolutionService(registry),
        exactAvailability,
        projection,
      ),
      availability,
    );
    const [first, second] = await database.withTenantTransaction(SEED_TENANT.id, async (tx) => [
      await observed.search(tx, input()),
      await observed.search(tx, input()),
    ]);
    expect(second).toEqual(first);
    expect(exactCalls).toHaveLength(10);
    expect(exactCalls.every(({ sellableUnitId }) => typeof sellableUnitId === "string")).toBe(true);
    expect(new Set(exactCalls.map(({ sellableUnitId }) => sellableUnitId))).toEqual(
      new Set((await inventoryFixtures()).map(({ sellable_unit_id }) => sellable_unit_id)),
    );
    expect(exactCalls.every(({ genderPolicy }) => genderPolicy === undefined)).toBe(true);
  });
});
