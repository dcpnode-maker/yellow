import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RateModelService,
  RatePublicationError,
  RatePublicationService,
  RateQuoteError,
  RateQuoteService,
  RateRecommendationRegistry,
  RateTargetService,
  type RateRecommendationAdapter,
  type RateRecommendationRequest,
} from "../src/contexts/rates";
import {
  ApprovalService,
  createAuditEnvelope,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
} from "../src/kernel";
import { runSeed, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_RATE_QUOTE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RATE_QUOTE === "1";
const TENANT = SEED_TENANT.id;
const PROPERTY = "00000000-0000-0000-0000-000000007012";
const FOREIGN_TENANT = "00000000-0000-0000-0000-0000000070b0";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-0000000070b1";
const REQUESTER = "00000000-0000-0000-0000-000000007090";
const APPROVER = "00000000-0000-0000-0000-000000007091";
const UNIT_TYPE = "00000000-0000-0000-0000-000000007050";
const SELLABLE = "00000000-0000-0000-0000-000000007051";
const SPACE = "00000000-0000-0000-0000-000000007052";
const CANCELLATION = "00000000-0000-0000-0000-000000007061";
const DEPOSIT = "00000000-0000-0000-0000-000000007062";
const GUARANTEE = "00000000-0000-0000-0000-000000007063";
const NO_SHOW = "00000000-0000-0000-0000-000000007064";
const DAY_MS = 86_400_000;
const FIXTURE_START_OFFSET_DAYS = 1;
const FIXTURE_MAX_NIGHTS = 60;
const CAPTURED_UTC_DAY = (() => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
})();
const fixtureDate = (offsetDays: number) =>
  new Date(CAPTURED_UTC_DAY.getTime() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const FIXTURE_STAY_START = new Date(CAPTURED_UTC_DAY.getTime() + FIXTURE_START_OFFSET_DAYS * DAY_MS + 15 * 60 * 60 * 1_000);
const FIXTURE_STAY_START_DATE = fixtureDate(FIXTURE_START_OFFSET_DAYS);
const FIXTURE_THREE_NIGHT_END_DATE = fixtureDate(FIXTURE_START_OFFSET_DAYS + 3);
const FIXTURE_MAX_STAY_END_DATE = fixtureDate(FIXTURE_START_OFFSET_DAYS + FIXTURE_MAX_NIGHTS);
const PLANS = Object.freeze({
  main: "00000000-0000-0000-0000-000000007001",
  occupancy: "00000000-0000-0000-0000-000000007002",
  parent: "00000000-0000-0000-0000-000000007003",
  child: "00000000-0000-0000-0000-000000007004",
  rms: "00000000-0000-0000-0000-000000007005",
  boundaryLocal: "00000000-0000-0000-0000-000000007006",
  boundaryRms: "00000000-0000-0000-0000-000000007007",
});

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RATE_QUOTE_URL is required by the Order 070 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let platformPool: SQL;
let eventPool: SQL;
let database: Database;
let registry: ExtensionRegistry;
let approvals: ApprovalService;
let models: RateModelService;
let targets: RateTargetService;
let publication: RatePublicationService;
let quote: RateQuoteService;
let recommendationMode: "fresh" | "stale" | "wrong-tenant" | "unavailable" | "error" = "fresh";

function envelope(operation: string, actorId = REQUESTER, tenantId = TENANT, propertyNode = PROPERTY) {
  return createAuditEnvelope({
    tenantId,
    propertyNode,
    actorId,
    requestId: crypto.randomUUID(),
    operation,
  });
}

function evaluatorSpec(modelKey = "simple-fixed", amountMinor = 10_000n, overrides: Record<string, unknown> = {}) {
  return {
    modelKey,
    currency: "USD",
    base: { kind: "fixed", amountMinor },
    gate: {},
    rules: [],
    ...overrides,
  };
}

function policyConfiguration() {
  return {
    cancellationPolicyId: CANCELLATION,
    depositPolicyId: DEPOSIT,
    guaranteePolicyId: GUARANTEE,
    noShowPolicyId: NO_SHOW,
    refundTreatment: "policy",
  };
}

function compositionSpec(overrides: Record<string, unknown> = {}) {
  return {
    currency: "USD",
    guestEligibility: {
      minAdults: 1,
      maxAdults: 6,
      minChildren: 0,
      maxChildren: 4,
      minTotalGuests: 1,
      maxTotalGuests: 8,
    },
    package: null,
    promotions: [],
    policy: policyConfiguration(),
    distribution: { mode: "all", channelCodes: [] },
    ...overrides,
  };
}

function policyEvidence() {
  return [
    { kind: "cancellation" as const, policyId: CANCELLATION, evidenceRef: `policy:${CANCELLATION}` },
    { kind: "deposit" as const, policyId: DEPOSIT, evidenceRef: `policy:${DEPOSIT}` },
    { kind: "guarantee" as const, policyId: GUARANTEE, evidenceRef: `policy:${GUARANTEE}` },
    { kind: "no_show" as const, policyId: NO_SHOW, evidenceRef: `policy:${NO_SHOW}` },
  ];
}

function previewCell(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    evaluationContext: {
      propertyTimeZone: "UTC",
      bookingInstant: CAPTURED_UTC_DAY.toISOString(),
      stayStartInstant: FIXTURE_STAY_START.toISOString(),
      stayEndInstant: new Date(FIXTURE_STAY_START.getTime() + 3 * DAY_MS).toISOString(),
      nightDate: FIXTURE_STAY_START_DATE,
      occupancyBasisPoints: 6_000,
      occupancyEvidenceRef: "projection:order-070-preview",
    },
    targetContext: {
      unitTypeId: UNIT_TYPE,
      sellableUnitId: SELLABLE,
      commercial: {},
    },
    guests: { adults: 2, childAges: [] },
    selectedPromotionCodes: [],
    policyEvidence: policyEvidence(),
    mandatoryPolicyEvidence: [
      { key: "tax-assignment", evidenceRef: "tax-assignment:order-070-preview" },
    ],
    availabilityEvidence: {
      sellableUnitId: SELLABLE,
      availableCount: 1,
      bookable: true,
      restrictionEvidence: [],
      operationalBlockEvidence: [],
      evidenceRef: "availability:order-070-preview",
    },
    channelCode: "direct",
    channelMappingEvidenceRef: null,
    ...overrides,
  };
}

interface CreateReleaseOptions {
  readonly modelKey?: string;
  readonly evaluator?: Record<string, unknown>;
  readonly composition?: Record<string, unknown>;
  readonly rmsBinding?: Record<string, unknown>;
}

async function createRelease(planId: string, options: CreateReleaseOptions = {}) {
  return database.withTenantTransaction(TENANT, async (tx) => {
    const model = await models.createDraftVersion(tx, {
      ratePlanId: planId,
      modelKey: (options.modelKey ?? "simple-fixed") as never,
      modelVersion: 1,
      authoringMode: "expert",
      componentModelKeys: [],
      envelope: envelope("rate_plan_model.drafted"),
    });
    const target = await targets.createDraftVersion(tx, {
      ratePlanId: planId,
      authoringMode: "expert",
      rules: [{ key: "property", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} }],
      envelope: envelope("rate_plan_target.drafted"),
    });
    return publication.createDraftVersion(tx, {
      ratePlanId: planId,
      modelDraftVersion: model.extensionVersion,
      targetDraftVersion: target.extensionVersion,
      evaluatorSpec: options.evaluator ?? evaluatorSpec(options.modelKey),
      compositionSpec: options.composition ?? compositionSpec(),
      ...(options.rmsBinding === undefined ? {} : { rmsBinding: options.rmsBinding }),
      envelope: envelope("rate_plan_release.drafted"),
    });
  });
}

async function activateRelease(releaseId: string, key: string) {
  const cells = [previewCell(key)];
  const requested = await database.withTenantTransaction(TENANT, (tx) =>
    publication.requestPublicationApproval(tx, {
      releaseId,
      previewCells: cells,
      requestedBy: REQUESTER,
      envelope: envelope("rate_plan_release.approval_requested"),
    })
  );
  await database.withTenantTransaction(TENANT, (tx) => approvals.decide(tx, {
    approvalId: requested.approval.id,
    decision: "approved",
    decidedBy: APPROVER,
    envelope: envelope("approval.decided", APPROVER),
  }));
  return database.withTenantTransaction(TENANT, (tx) => publication.publishDraft(tx, {
    releaseId,
    approvalId: requested.approval.id,
    previewCells: cells,
    envelope: envelope("rate_plan_release.published", APPROVER),
  }));
}

function quoteInput(planId: string = PLANS.main, days = 3, channelCode = "direct") {
  return {
    propertyNode: PROPERTY,
    ratePlanId: planId,
    sellableUnitId: SELLABLE,
    stayStart: new Date(FIXTURE_STAY_START),
    stayEnd: new Date(FIXTURE_STAY_START.getTime() + days * DAY_MS),
    guests: { adults: 2, childAges: [] },
    selectedPromotionCodes: planId === PLANS.main ? ["WELCOME"] : [],
    commercial: {},
    channelCode,
  };
}

function acceptedRecommendation(request: RateRecommendationRequest) {
  const observedAt = recommendationMode === "stale"
    ? new Date(Date.parse(request.bookingInstant) - 7_200_000).toISOString()
    : request.bookingInstant;
  return {
    adapterKey: "order-070-rms",
    adapterVersion: 1,
    recommendationId: `recommendation:${request.nightDate}`,
    recommendationVersion: 7,
    observedAt,
    tenantId: recommendationMode === "wrong-tenant" ? FOREIGN_TENANT : request.tenantId,
    propertyNode: request.propertyNode,
    ratePlanId: request.ratePlanId,
    releaseId: request.releaseId,
    releaseVersion: request.releaseVersion,
    sellableUnitId: request.sellableUnitId,
    unitTypeId: request.unitTypeId,
    nightDate: request.nightDate,
    currency: request.currency,
    amountMinor: 15_000n,
    evidenceRef: `rms:order-070:${request.nightDate}`,
  };
}

const recommendationAdapter: RateRecommendationAdapter = Object.freeze({
  adapterKey: "order-070-rms",
  adapterVersion: 1,
  async recommend(request: RateRecommendationRequest) {
    if (recommendationMode === "unavailable") return null;
    if (recommendationMode === "error") throw new Error("injected RMS outage");
    return acceptedRecommendation(request);
  },
});

beforeAll(async () => {
  if (!DATABASE_URL) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  admin = new SQL(DATABASE_URL, { max: 8 });
  platformPool = new SQL(DATABASE_URL, { max: 8 });
  eventPool = new SQL(DATABASE_URL, { max: 12 });
  database = Database.connect(DATABASE_URL, { maxConnections: 48 });
  registry = new ExtensionRegistry(platformPool);
  const events = new PostgresEventBus(eventPool);
  approvals = new ApprovalService(events);
  models = new RateModelService(registry);
  targets = new RateTargetService(registry);
  publication = new RatePublicationService(
    registry,
    approvals,
    events,
    new RateRecommendationRegistry([recommendationAdapter]),
  );
  quote = new RateQuoteService(publication);

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${FOREIGN_TENANT}::uuid, 'order070-foreign', 'Order 070 Foreign', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES
      (${PROPERTY}::uuid, ${TENANT}::uuid, 'order070.property', 'property', 'Order 070 Property', 'UTC', 'USD', '{}'::jsonb),
      (${FOREIGN_PROPERTY}::uuid, ${FOREIGN_TENANT}::uuid, 'order070_foreign.property', 'property', 'Order 070 Foreign', 'UTC', 'USD', '{}'::jsonb)
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name)
    VALUES
      (${REQUESTER}::uuid, ${TENANT}::uuid, 'order070-requester@yellow.test', 'Order 070 Requester'),
      (${APPROVER}::uuid, ${TENANT}::uuid, 'order070-approver@yellow.test', 'Order 070 Approver')
  `;
  await admin`
    INSERT INTO policy (id, tenant_id, kind, name, content)
    VALUES
      (${CANCELLATION}::uuid, ${TENANT}::uuid, 'cancellation', 'Order 070 Cancellation', '{"kind":"cancellation"}'::jsonb),
      (${DEPOSIT}::uuid, ${TENANT}::uuid, 'deposit', 'Order 070 Deposit', '{"kind":"deposit"}'::jsonb),
      (${GUARANTEE}::uuid, ${TENANT}::uuid, 'guarantee', 'Order 070 Guarantee', '{"kind":"guarantee"}'::jsonb),
      (${NO_SHOW}::uuid, ${TENANT}::uuid, 'no_show', 'Order 070 No Show', '{"kind":"no_show"}'::jsonb)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy)
    VALUES (${UNIT_TYPE}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-STD', 'Order 070 Standard', 'hotel', 4)
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES (${SPACE}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-101', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status)
    VALUES (${SELLABLE}::uuid, ${TENANT}::uuid, ${UNIT_TYPE}::uuid, 'Order 070 Sellable', 'active')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES (${TENANT}::uuid, ${SELLABLE}::uuid, ${SPACE}::uuid, 'exclusive')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status)
    VALUES
      (${PLANS.main}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-MAIN', 'Order 070 Main', 'USD', 'active'),
      (${PLANS.occupancy}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-OCC', 'Order 070 Occupancy', 'USD', 'active'),
      (${PLANS.parent}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-PARENT', 'Order 070 Parent', 'USD', 'active'),
      (${PLANS.child}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-CHILD', 'Order 070 Child', 'USD', 'active'),
      (${PLANS.rms}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-RMS', 'Order 070 RMS', 'USD', 'active'),
      (${PLANS.boundaryLocal}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-LOCAL-B', 'Order 070 Local Boundary', 'USD', 'active'),
      (${PLANS.boundaryRms}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O70-RMS-B', 'Order 070 RMS Boundary', 'USD', 'active')
  `;
  await admin`INSERT INTO channel (code, name) VALUES ('booking-com', 'Booking.com') ON CONFLICT (code) DO NOTHING`;
  await admin`
    INSERT INTO channel_map (tenant_id, property_node, channel_code, kind, internal_id, external_code)
    VALUES
      (${TENANT}::uuid, ${PROPERTY}::uuid, 'booking-com', 'rate_plan', ${PLANS.main}::uuid, 'O70-MAIN-EXT'),
      (${TENANT}::uuid, ${PROPERTY}::uuid, 'booking-com', 'unit_type', ${UNIT_TYPE}::uuid, 'O70-STD-EXT')
  `;
  await admin`
    INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
    VALUES (${TENANT}::uuid, ${PROPERTY}::uuid, 'order-070-tax',
            daterange(${FIXTURE_STAY_START_DATE}::date, ${FIXTURE_MAX_STAY_END_DATE}::date, '[)'))
  `;
  await admin`
    INSERT INTO availability_projection (
      tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo, updated_at
    )
    SELECT ${TENANT}::uuid, ${PROPERTY}::uuid, ${UNIT_TYPE}::uuid, day::date,
           10, 6, 0, 0, 0, '2026-08-22T00:00:00.000Z'::timestamptz
    FROM generate_series(${FIXTURE_STAY_START_DATE}::date, ${FIXTURE_MAX_STAY_END_DATE}::date - 1, interval '1 day') AS day
  `;

  const main = await createRelease(PLANS.main, {
    evaluator: evaluatorSpec(),
    composition: compositionSpec({
      package: {
        key: "arrival-welcome",
        version: 1,
        includedInRate: false,
        elements: [{
          key: "arrival",
          kind: "service",
          code: "ARRIVAL",
          rhythm: "per_stay",
          amountMinor: 700n,
          currency: "USD",
        }],
      },
      promotions: [{
        code: "WELCOME",
        version: 1,
        stage: 1,
        priority: 1,
        scope: "room_and_extras",
        discount: { kind: "amount", amountMinor: 100n },
      }],
    }),
  });
  await activateRelease(main.id, "main");

  const occupancy = await createRelease(PLANS.occupancy, {
    modelKey: "occupancy-los",
    evaluator: evaluatorSpec("occupancy-los", 10_000n, {
      rules: [{
        key: "responsive",
        stage: 1,
        priority: 1,
        when: { occupancy: { minBasisPoints: 5_000, maxBasisPoints: 7_000 } },
        adjustment: { kind: "delta", amountMinor: 2_000n },
      }],
    }),
  });
  await activateRelease(occupancy.id, "occupancy");

  const parent = await createRelease(PLANS.parent, { evaluator: evaluatorSpec("simple-fixed", 20_000n) });
  await activateRelease(parent.id, "parent");
  const child = await createRelease(PLANS.child, {
    modelKey: "derived",
    evaluator: evaluatorSpec("derived", 0n, {
      base: { kind: "reference", sourceKind: "parent", sourceId: parent.id, sourceVersion: parent.extensionVersion },
      rules: [{
        key: "child-discount",
        stage: 1,
        priority: 1,
        when: {},
        adjustment: { kind: "basis_points", basisPoints: -1_000 },
      }],
    }),
  });
  await activateRelease(child.id, "child");

  const rms = await createRelease(PLANS.rms, {
    modelKey: "rms-api-managed",
    evaluator: evaluatorSpec("rms-api-managed", 8_000n, {
      rules: [{
        key: "hotel-adjustment",
        stage: 1,
        priority: 1,
        when: {},
        adjustment: { kind: "delta", amountMinor: 1_000n },
      }],
      floorMinor: 9_000n,
      ceilingMinor: 12_000n,
    }),
    rmsBinding: {
      adapterKey: "order-070-rms",
      adapterVersion: 1,
      maximumAgeSeconds: 3_600,
      outageFallback: "local_evaluator",
    },
  });
  await activateRelease(rms.id, "rms");
}, 60_000);

afterAll(async () => {
  if (!DATABASE_URL) return;
  await admin.close();
  await platformPool.close();
  await eventPool.close();
  await database.close();
}, 30_000);

describe("Order 070 universal quote exports", () => {
  test("P0: universal quote and governed recommendation surfaces exist", () => {
    expect(RateQuoteService).toBeDefined();
    expect(RateRecommendationRegistry).toBeDefined();
  });
});

databaseDescribe("Order 070 live PostgreSQL universal quote", () => {
  test("P1/P6: three nights sum exactly and stay choices apply once deterministically", async () => {
    const [first, second] = await database.withTenantTransaction(TENANT, async (tx) => [
      await quote.resolve(tx, quoteInput()),
      await quote.resolve(tx, { ...quoteInput(), selectedPromotionCodes: ["WELCOME"], commercial: {} }),
    ]);
    expect(second).toEqual(first);
    expect(first.quoteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      ratePlanId: PLANS.main,
      sellableUnitId: SELLABLE,
      unitTypeId: UNIT_TYPE,
      stayStartDate: FIXTURE_STAY_START_DATE,
      stayEndDate: FIXTURE_THREE_NIGHT_END_DATE,
      taxAssignmentState: "configured",
      result: {
        state: "quoted",
        roomAmountMinor: 30_000n,
        packageExtraMinor: 700n,
        promotionDiscountMinor: 100n,
        preTaxSubtotalMinor: 30_600n,
        selectedPromotionCodes: ["WELCOME"],
      },
    });
    expect(first.result.rateEvaluations.map(({ nightDate, evaluationResult }) => [
      nightDate,
      evaluationResult.amountMinor,
    ])).toEqual([
      [fixtureDate(FIXTURE_START_OFFSET_DAYS), 10_000n],
      [fixtureDate(FIXTURE_START_OFFSET_DAYS + 1), 10_000n],
      [fixtureDate(FIXTURE_START_OFFSET_DAYS + 2), 10_000n],
    ]);
    expect(first.result.policyEvidence).toEqual(policyEvidence());
    expect(first.result.mandatoryPolicyEvidence).toHaveLength(3);
    expect(first.occupancyEvidence).toHaveLength(3);
    expect(first.occupancyEvidence[0]).toMatchObject({
      nightDate: FIXTURE_STAY_START_DATE,
      signal: { basisPoints: 6_000, sellableCapacity: 10, sold: 6, held: 0 },
    });
    expect(first.taxAssignments).toEqual([
      expect.objectContaining({ nightDate: fixtureDate(FIXTURE_START_OFFSET_DAYS), jurisdictionKey: "order-070-tax" }),
      expect.objectContaining({ nightDate: fixtureDate(FIXTURE_START_OFFSET_DAYS + 1), jurisdictionKey: "order-070-tax" }),
      expect.objectContaining({ nightDate: fixtureDate(FIXTURE_START_OFFSET_DAYS + 2), jurisdictionKey: "order-070-tax" }),
    ]);
  });

  test("P2: live restrictions block a valid price without creating artifacts", async () => {
    const restrictionId = "00000000-0000-0000-0000-000000007071";
    await admin`
      INSERT INTO restriction (id, tenant_id, scope_node, unit_type_id, rate_plan_id, kind, stay_dates)
      VALUES (${restrictionId}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, ${UNIT_TYPE}::uuid,
              ${PLANS.main}::uuid, 'closed', daterange(${FIXTURE_STAY_START_DATE}::date, ${FIXTURE_THREE_NIGHT_END_DATE}::date, '[)'))
    `;
    const before = await admin<Array<{ facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM fact_log) AS facts,
             (SELECT count(*)::int FROM outbox) AS events
    `;
    try {
      const blocked = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput()));
      expect(blocked.result).toMatchObject({ state: "blocked", reason: "availability_blocked" });
      expect(blocked.result.restrictionEvidence).toEqual([
        expect.objectContaining({ kind: "closed", blocked: true }),
      ]);
      const after = await admin<Array<{ facts: number; events: number }>>`
        SELECT (SELECT count(*)::int FROM fact_log) AS facts,
               (SELECT count(*)::int FROM outbox) AS events
      `;
      expect(after).toEqual(before);
    } finally {
      await admin`DELETE FROM restriction WHERE id = ${restrictionId}::uuid`;
    }
  });

  test("P3: occupancy is attributable while exact retired parent history stays reproducible", async () => {
    const occupancy = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.occupancy)));
    expect(occupancy.result).toMatchObject({ state: "quoted", roomAmountMinor: 36_000n });
    expect(occupancy.result.rateEvaluations.every(({ evaluationContext }) =>
      evaluationContext.occupancyBasisPoints === 6_000 &&
      evaluationContext.occupancyEvidenceRef?.startsWith("projection:")
    )).toBe(true);

    await admin`
      UPDATE availability_projection SET sold = 10
      WHERE property_node = ${PROPERTY}::uuid AND unit_type_id = ${UNIT_TYPE}::uuid AND stay_date = ${FIXTURE_STAY_START_DATE}::date
    `;
    const fullProjection = await database.withTenantTransaction(TENANT, (tx) =>
      quote.resolve(tx, quoteInput(PLANS.occupancy))
    );
    expect(fullProjection.result.state).toBe("quoted");
    expect(fullProjection.occupancyEvidence[0]?.signal?.basisPoints).toBe(10_000);
    await admin`
      UPDATE availability_projection SET sold = 6
      WHERE property_node = ${PROPERTY}::uuid AND unit_type_id = ${UNIT_TYPE}::uuid AND stay_date = ${FIXTURE_STAY_START_DATE}::date
    `;

    await admin`
      DELETE FROM availability_projection
      WHERE property_node = ${PROPERTY}::uuid AND unit_type_id = ${UNIT_TYPE}::uuid AND stay_date = ${fixtureDate(FIXTURE_START_OFFSET_DAYS + 1)}::date
    `;
    try {
      await expect(database.withTenantTransaction(TENANT, (tx) =>
        quote.resolve(tx, quoteInput(PLANS.occupancy))
      )).rejects.toThrow("Projected occupancy evidence is missing");
    } finally {
      await admin`
        INSERT INTO availability_projection (
          tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo, updated_at
        ) VALUES (${TENANT}::uuid, ${PROPERTY}::uuid, ${UNIT_TYPE}::uuid, ${fixtureDate(FIXTURE_START_OFFSET_DAYS + 1)}::date, 10, 6, 0, 0, 0,
                  '2026-08-22T00:00:00.000Z'::timestamptz)
      `;
    }

    const historical = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.child)));
    expect(historical.result.roomAmountMinor).toBe(54_000n);
    const newerParent = await createRelease(PLANS.parent, { evaluator: evaluatorSpec("simple-fixed", 24_000n) });
    await activateRelease(newerParent.id, "parent-newer");
    const replay = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.child)));
    expect(replay.result.roomAmountMinor).toBe(54_000n);
    expect(replay.result.rateEvaluations[0]?.evaluationContext.reference).toMatchObject({
      sourceKind: "parent",
      sourceVersion: 1,
      amountMinor: 20_000n,
    });
  });

  test("P4: RMS evidence is bounded and every operational fallback is explicit", async () => {
    recommendationMode = "fresh";
    const accepted = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.rms, 1)));
    expect(accepted.result.roomAmountMinor).toBe(12_000n);
    expect(accepted.result.rateEvaluations[0]?.evaluationContext.recommendation).toMatchObject({
      state: "accepted",
      adapterKey: "order-070-rms",
      recommendationVersion: 7,
      amountMinor: 15_000n,
    });

    const events = new PostgresEventBus(eventPool);
    const missingPublication = new RatePublicationService(registry, approvals, events);
    const missingQuote = new RateQuoteService(missingPublication);
    const missing = await database.withTenantTransaction(TENANT, (tx) => missingQuote.resolve(tx, quoteInput(PLANS.rms, 1)));
    expect(missing.result.roomAmountMinor).toBe(9_000n);
    expect(missing.result.rateEvaluations[0]?.evaluationContext.recommendation).toMatchObject({
      state: "fallback",
      reason: "adapter_missing",
    });

    recommendationMode = "stale";
    const stale = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.rms, 1)));
    expect(stale.result.roomAmountMinor).toBe(9_000n);
    expect(stale.result.rateEvaluations[0]?.evaluationContext.recommendation).toMatchObject({
      state: "fallback",
      reason: "stale",
    });

    recommendationMode = "unavailable";
    const unavailable = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.rms, 1)));
    expect(unavailable.result.rateEvaluations[0]?.evaluationContext.recommendation).toMatchObject({
      state: "fallback",
      reason: "adapter_unavailable",
    });
    recommendationMode = "error";
    const errored = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.rms, 1)));
    expect(errored.result.rateEvaluations[0]?.evaluationContext.recommendation).toMatchObject({
      state: "fallback",
      reason: "adapter_error",
    });

    recommendationMode = "wrong-tenant";
    await expect(database.withTenantTransaction(TENANT, (tx) =>
      quote.resolve(tx, quoteInput(PLANS.rms, 1))
    )).rejects.toThrow("exact quote scope");
    recommendationMode = "fresh";

    await expect(createRelease(PLANS.boundaryLocal, {
      rmsBinding: {
        adapterKey: "order-070-rms",
        adapterVersion: 1,
        maximumAgeSeconds: 3_600,
        outageFallback: "local_evaluator",
      },
    })).rejects.toBeInstanceOf(RatePublicationError);
    await expect(createRelease(PLANS.boundaryRms, {
      modelKey: "rms-api-managed",
      evaluator: evaluatorSpec("rms-api-managed", 8_000n, { floorMinor: 7_000n, ceilingMinor: 12_000n }),
    })).rejects.toBeInstanceOf(RatePublicationError);
  });

  test("P5: database channel and tax assignments are mandatory attributable evidence", async () => {
    const mapped = await database.withTenantTransaction(TENANT, (tx) =>
      quote.resolve(tx, quoteInput(PLANS.main, 3, "booking-com"))
    );
    expect(mapped.result.distributionEvidence).toMatchObject({
      channelCode: "booking-com",
      eligible: true,
    });
    expect(mapped.result.distributionEvidence.mappingEvidenceRef).toMatch(/^channel-map:/);

    await admin`
      DELETE FROM channel_map
      WHERE property_node = ${PROPERTY}::uuid AND channel_code = 'booking-com' AND kind = 'unit_type'
    `;
    try {
      await expect(database.withTenantTransaction(TENANT, (tx) =>
        quote.resolve(tx, quoteInput(PLANS.main, 3, "booking-com"))
      )).rejects.toThrow("requires exact rate-plan and unit-type channel mappings");
    } finally {
      await admin`
        INSERT INTO channel_map (tenant_id, property_node, channel_code, kind, internal_id, external_code)
        VALUES (${TENANT}::uuid, ${PROPERTY}::uuid, 'booking-com', 'unit_type', ${UNIT_TYPE}::uuid, 'O70-STD-EXT')
      `;
    }

    await admin`
      INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
      VALUES (${TENANT}::uuid, ${PROPERTY}::uuid, 'order-070-overlap',
              daterange(${fixtureDate(FIXTURE_START_OFFSET_DAYS + 1)}::date, ${FIXTURE_THREE_NIGHT_END_DATE}::date, '[)'))
    `;
    try {
      await expect(database.withTenantTransaction(TENANT, (tx) =>
        quote.resolve(tx, quoteInput())
      )).rejects.toThrow("Multiple tax assignments apply");
    } finally {
      await admin`
        DELETE FROM tax_assignment
        WHERE property_node = ${PROPERTY}::uuid AND jurisdiction_key = 'order-070-overlap'
      `;
    }

    await admin`DELETE FROM tax_assignment WHERE property_node = ${PROPERTY}::uuid`;
    const withoutTax = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput()));
    expect(withoutTax.taxAssignmentState).toBe("none");
    expect(withoutTax.taxAssignments.every(({ jurisdictionKey, evidenceRef }) =>
      jurisdictionKey === null && evidenceRef === null
    )).toBe(true);
    await admin`
      INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
      VALUES (${TENANT}::uuid, ${PROPERTY}::uuid, 'order-070-partial',
              daterange(${FIXTURE_STAY_START_DATE}::date, ${fixtureDate(FIXTURE_START_OFFSET_DAYS + 1)}::date, '[)'))
    `;
    const partialTax = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput()));
    expect(partialTax.taxAssignmentState).toBe("partial");
    expect(partialTax.taxAssignments.map(({ jurisdictionKey }) => jurisdictionKey)).toEqual([
      "order-070-partial", null, null,
    ]);
    await admin`DELETE FROM tax_assignment WHERE property_node = ${PROPERTY}::uuid`;
    await admin`
      INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
      VALUES (${TENANT}::uuid, ${PROPERTY}::uuid, 'order-070-tax',
              daterange(${FIXTURE_STAY_START_DATE}::date, ${FIXTURE_MAX_STAY_END_DATE}::date, '[)'))
    `;
  });

  test("P6: hostile input, cross-tenant ids and stored reference cycles fail closed", async () => {
    await expect(database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, {
      ...quoteInput(),
      bookingInstant: "2026-08-22T00:00:00.000Z",
    } as never))).rejects.toBeInstanceOf(RateQuoteError);
    await expect(database.withTenantTransaction(FOREIGN_TENANT, (tx) =>
      quote.resolve(tx, quoteInput())
    )).rejects.toThrow("Property was not found");

    const child = await database.withTenantTransaction(TENANT, (tx) =>
      publication.getActiveRelease(tx, PROPERTY, PLANS.child)
    );
    const stored = await admin<Array<{ content: unknown }>>`
      SELECT content FROM extension WHERE id = ${child.id}::uuid
    `;
    await admin`
      UPDATE extension
      SET content = jsonb_set(content, '{evaluator,base,sourceId}', to_jsonb(${child.id}::text))
      WHERE id = ${child.id}::uuid
    `;
    try {
      await expect(database.withTenantTransaction(TENANT, (tx) =>
        quote.resolve(tx, quoteInput(PLANS.child))
      )).rejects.toThrow("cycle");
    } finally {
      await admin`UPDATE extension SET content = ${JSON.stringify(stored[0]!.content)}::jsonb WHERE id = ${child.id}::uuid`;
    }
  });

  test("P7: 30-to-60-night work stays sub-quadratic with a catastrophic wall-clock guard", async () => {
    const start30 = performance.now();
    const thirty = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.main, 30)));
    const elapsed30 = performance.now() - start30;
    const start60 = performance.now();
    const sixty = await database.withTenantTransaction(TENANT, (tx) => quote.resolve(tx, quoteInput(PLANS.main, 60)));
    const elapsed60 = performance.now() - start60;
    expect(sixty.result.workUnits).toBeGreaterThan(thirty.result.workUnits);
    expect(sixty.result.workUnits).toBeLessThan(thirty.result.workUnits * 2.2);
    expect(elapsed30).toBeLessThan(10_000);
    expect(elapsed60).toBeLessThan(10_000);
  }, 30_000);
});
