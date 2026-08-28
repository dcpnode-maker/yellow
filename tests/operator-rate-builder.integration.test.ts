import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityProjectionService, AvailabilityService } from "../src/contexts/inventory";
import {
  RateModelService,
  RatePublicationService,
  RateQuoteService,
  RateTargetService,
} from "../src/contexts/rates";
import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";
import { OperatorHttpApi } from "../src/http/operator";
import {
  ApprovalService,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";
import { REVIEW_EMAIL, runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_OPERATOR_RATE_BUILDER_URL;
const PASSWORD = process.env.YELLOW_OPERATOR_RATE_BUILDER_PASSWORD;
const APPROVER_PASSWORD = PASSWORD ? `${PASSWORD}-approver` : undefined;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATOR_RATE_BUILDER === "1";
const SECRET = "yellow-order-071-test-token-secret-exactly-long-enough";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000007191";
const POLICY = Object.freeze({
  cancellation: "00000000-0000-0000-0000-000000007161",
  deposit: "00000000-0000-0000-0000-000000007162",
  guarantee: "00000000-0000-0000-0000-000000007163",
  noShow: "00000000-0000-0000-0000-000000007164",
});
const PLANS = Object.freeze({
  main: "00000000-0000-0000-0000-000000007101",
  conflicts: "00000000-0000-0000-0000-000000007102",
  rollback: "00000000-0000-0000-0000-000000007103",
  targeting: "00000000-0000-0000-0000-000000007104",
  reuse: "00000000-0000-0000-0000-000000007105",
});
const FULL_SCOPES = Object.freeze([
  "inventory.availability:read", "inventory.blocks:read", "inventory.blocks:write",
  "inventory.configuration:read", "inventory.configuration:write", "inventory.holds:read",
  "inventory.holds:write", "inventory.offline_leases:read", "inventory.offline_leases:write",
  "inventory.policy:read", "inventory.policy:write", "inventory.restriction:read",
  "inventory.restriction:write", "rates.configuration:read", "rates.configuration:write",
  "rates.pricing:read", "rates.pricing:write",
]);
type RateBuilderTestOperations = NonNullable<ConstructorParameters<typeof OperatorHttpApi>[12]>;

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error("YELLOW_OPERATOR_RATE_BUILDER_URL and YELLOW_OPERATOR_RATE_BUILDER_PASSWORD are required by Order 071");
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let extensionPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let approvals: ApprovalService;
let models: RateModelService;
let targets: RateTargetService;
let publication: RatePublicationService;
let quote: RateQuoteService;
let app: ReturnType<typeof createApp>;
let requester = "";
let approver = "";
let requesterToken = "";
let approverToken = "";
let unitTypeId = "";
let sellableUnitId = "";

function headers(token = requesterToken, key?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(key ? { "idempotency-key": key } : {}),
  };
}

function request(path: string, init: RequestInit = {}): Promise<Response> {
  return app.handle(new Request(`http://yellow.test${path}`, init));
}

function builderPath(planId: string, suffix = "", propertyNode: string = SEED_PROPERTY.id): string {
  return `/api/v1/properties/${propertyNode}/rate-builder/${planId}${suffix}`;
}

function command(planId: string, rules: readonly Record<string, unknown>[] = [
  { key: "property-default", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} },
]) {
  return {
    authoringMode: "guided",
    ratePlanId: planId,
    model: { key: "simple-fixed", version: 1, componentModelKeys: [] },
    target: { rules },
    evaluator: {
      modelKey: "simple-fixed",
      currency: "USD",
      base: { kind: "fixed", amountMinor: "12500" },
      gate: {},
      rules: [],
      floorMinor: null,
      ceilingMinor: null,
      eligibleTargetRuleKeys: [],
    },
    composition: {
      currency: "USD",
      guestEligibility: {
        minAdults: 1, maxAdults: 4, minChildren: 0, maxChildren: 3,
        minTotalGuests: 1, maxTotalGuests: 6,
      },
      package: null,
      promotions: [],
      policy: {
        cancellationPolicyId: POLICY.cancellation,
        depositPolicyId: POLICY.deposit,
        guaranteePolicyId: POLICY.guarantee,
        noShowPolicyId: POLICY.noShow,
        refundTreatment: "policy",
      },
      distribution: { mode: "all", channelCodes: [] },
    },
    rmsBinding: null,
  };
}

function policyEvidence() {
  return [
    { kind: "cancellation", policyId: POLICY.cancellation, evidenceRef: "policy:cancellation-v1" },
    { kind: "deposit", policyId: POLICY.deposit, evidenceRef: "policy:deposit-v1" },
    { kind: "guarantee", policyId: POLICY.guarantee, evidenceRef: "policy:guarantee-v1" },
    { kind: "no_show", policyId: POLICY.noShow, evidenceRef: "policy:no-show-v1" },
  ];
}

function previewCell(key = "cell-2026-09-10") {
  return {
    key,
    evaluationContext: {
      propertyTimeZone: "UTC",
      bookingInstant: "2026-09-01T00:00:00.000Z",
      stayStartInstant: "2026-09-10T15:00:00.000Z",
      stayEndInstant: "2026-09-11T11:00:00.000Z",
      nightDate: "2026-09-10",
    },
    targetContext: { unitTypeId, sellableUnitId, commercial: {} },
    guests: { adults: 2, childAges: [] },
    selectedPromotionCodes: [],
    mandatoryPolicyEvidence: [{ key: "tax-assignment", evidenceRef: "tax:in-gst-lodging" }],
    availabilityEvidence: {
      sellableUnitId,
      availableCount: 1,
      bookable: true,
      restrictionEvidence: [],
      operationalBlockEvidence: [],
      evidenceRef: "availability:order071",
    },
    channelCode: "direct",
    channelMappingEvidenceRef: null,
  };
}

async function postDraft(
  planId: string,
  body: unknown,
  key: string,
  token = requesterToken,
  propertyNode: string = SEED_PROPERTY.id,
): Promise<Response> {
  return request(builderPath(planId, "/releases", propertyNode), {
    method: "POST", headers: headers(token, key), body: JSON.stringify(body),
  });
}

function rateBuilderOperations(): RateBuilderTestOperations {
  return {
    models,
    targets,
    publication,
    quote,
  };
}

function buildApp(operations: RateBuilderTestOperations = rateBuilderOperations()): ReturnType<typeof createApp> {
  const availability = new AvailabilityService();
  return createApp({
    database,
    tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(
      new LocalLoginService(loginPool, tokens),
      availability,
      undefined,
      new PostgresIdempotency(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new AvailabilityProjectionService(),
      undefined,
      operations,
    ),
  });
}

beforeAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  const review = await runReviewSeed({ databaseUrl: DATABASE_URL, password: PASSWORD,
    approverPassword: APPROVER_PASSWORD!, logger: () => undefined });
  requester = review.userId;
  approver = review.approverUserId;
  admin = new SQL(DATABASE_URL, { max: 8 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  extensionPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 24 });
  tokens = new Hs256TokenSigner(SECRET);
  const events = new PostgresEventBus(eventPool);
  const registry = new ExtensionRegistry(extensionPool);
  approvals = new ApprovalService(events);
  models = new RateModelService(registry);
  targets = new RateTargetService(registry);
  publication = new RatePublicationService(registry, approvals, events);
  quote = new RateQuoteService(publication, new TaxJurisdictionResolutionService(registry));

  const inventory = await admin<Array<{ unit_type_id: string; sellable_unit_id: string }>>`
    SELECT unit.id AS unit_type_id, sellable.id AS sellable_unit_id
    FROM unit_type AS unit
    JOIN sellable_unit AS sellable ON sellable.unit_type_id = unit.id AND sellable.tenant_id = unit.tenant_id
    WHERE unit.tenant_id = ${SEED_TENANT.id}::uuid AND unit.property_node = ${SEED_PROPERTY.id}::uuid
    ORDER BY unit.code, sellable.id
    LIMIT 1
  `;
  unitTypeId = inventory[0]!.unit_type_id;
  sellableUnitId = inventory[0]!.sellable_unit_id;
  await admin`
    INSERT INTO policy (id, tenant_id, kind, name, content)
    VALUES
      (${POLICY.cancellation}::uuid, ${SEED_TENANT.id}::uuid, 'cancellation', 'Order 071 cancellation', '{"kind":"cancellation"}'::jsonb),
      (${POLICY.deposit}::uuid, ${SEED_TENANT.id}::uuid, 'deposit', 'Order 071 deposit', '{"kind":"deposit"}'::jsonb),
      (${POLICY.guarantee}::uuid, ${SEED_TENANT.id}::uuid, 'guarantee', 'Order 071 guarantee', '{"kind":"guarantee"}'::jsonb),
      (${POLICY.noShow}::uuid, ${SEED_TENANT.id}::uuid, 'no_show', 'Order 071 no show', '{"kind":"no_show"}'::jsonb)
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status,
                           cancellation_policy, guarantee_policy, deposit_policy)
    VALUES
      (${PLANS.main}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, 'O71-MAIN', 'Order 071 Main', 'USD', 'active', ${POLICY.cancellation}::uuid, ${POLICY.guarantee}::uuid, ${POLICY.deposit}::uuid),
      (${PLANS.conflicts}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, 'O71-CONFLICT', 'Order 071 Conflict', 'USD', 'active', ${POLICY.cancellation}::uuid, ${POLICY.guarantee}::uuid, ${POLICY.deposit}::uuid),
      (${PLANS.rollback}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, 'O71-ROLLBACK', 'Order 071 Rollback', 'USD', 'active', ${POLICY.cancellation}::uuid, ${POLICY.guarantee}::uuid, ${POLICY.deposit}::uuid),
      (${PLANS.targeting}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, 'O73-TARGET', 'Order 073 Targeting', 'USD', 'active', ${POLICY.cancellation}::uuid, ${POLICY.guarantee}::uuid, ${POLICY.deposit}::uuid),
      (${PLANS.reuse}::uuid, ${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, 'O76-REUSE', 'Order 076 Reuse', 'USD', 'active', ${POLICY.cancellation}::uuid, ${POLICY.guarantee}::uuid, ${POLICY.deposit}::uuid)
  `;
  await admin`
    INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
    VALUES (${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, 'in-gst-lodging', daterange('2026-09-01', '2026-10-01', '[)'))
  `;
  requesterToken = await tokens.issue({ userId: requester, tenantId: SEED_TENANT.id, scopes: FULL_SCOPES });
  approverToken = await tokens.issue({ userId: approver, tenantId: SEED_TENANT.id, scopes: FULL_SCOPES });
  app = buildApp();
});

afterAll(async () => {
  if (!DATABASE_URL || !PASSWORD) return;
  await database.close();
  await extensionPool.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
});

databaseDescribe("Order 071 operator universal rate builder", () => {
  let mainReleaseId = "";
  let reuseReleaseId = "";
  let mainDraftBody: Record<string, unknown> = {};
  let rejectedApprovalId = "";
  const cells = () => [previewCell()];

  test("P2: one idempotent request creates exactly one atomic model/target/release trio", async () => {
    const first = await postDraft(PLANS.main, command(PLANS.main), "order071-main-draft");
    expect(first.status).toBe(201);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    mainDraftBody = await first.json() as Record<string, unknown>;
    mainReleaseId = String((mainDraftBody.release as Record<string, unknown>).id);
    const rows = await admin<Array<{ type: string; total: number }>>`
      SELECT type, count(*)::int AS total FROM extension
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND key = ${`rate-plan:${PLANS.main}`}
      GROUP BY type ORDER BY type
    `;
    expect(rows).toEqual([
      { type: "rate_plan_model", total: 1 },
      { type: "rate_plan_release", total: 1 },
      { type: "rate_plan_target", total: 1 },
    ]);
    const replay = await postDraft(PLANS.main, command(PLANS.main), "order071-main-draft");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual(mainDraftBody);
  });

  test("Order 077 P0: approval inbox route is available before a decision", async () => {
    const inbox = await request(builderPath(PLANS.main, "/approvals"), {
      headers: headers(requesterToken),
    });
    expect(inbox.status).toBe(200);
    expect(await inbox.json()).toEqual({ approvals: [], nextCursor: null });
  });

  test("P2: an injected middle-step failure rolls back the model draft and idempotency claim", async () => {
    const before = await admin<Array<{ extensions: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM extension WHERE key = ${`rate-plan:${PLANS.rollback}`}) AS extensions,
        (SELECT count(*)::int FROM api_idempotency WHERE operation = 'operator.rates.release.draft') AS claims
    `;
    const failing = buildApp({
      ...rateBuilderOperations(),
      targets: {
        listDraftVersions: targets.listDraftVersions.bind(targets),
        async createDraftVersion(): Promise<never> { throw new Error("injected target failure secret"); },
      },
    });
    const response = await failing.handle(new Request(`http://yellow.test${builderPath(PLANS.rollback, "/releases")}`, {
      method: "POST",
      headers: headers(requesterToken, "order071-rollback"),
      body: JSON.stringify(command(PLANS.rollback)),
    }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    const after = await admin<Array<{ extensions: number; claims: number }>>`
      SELECT
        (SELECT count(*)::int FROM extension WHERE key = ${`rate-plan:${PLANS.rollback}`}) AS extensions,
        (SELECT count(*)::int FROM api_idempotency WHERE operation = 'operator.rates.release.draft') AS claims
    `;
    expect(after).toEqual(before);
  });

  test("P3: preview is server-evaluated and an equal-rank target conflict cannot request approval", async () => {
    const simulation = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/simulate`), {
      method: "POST", headers: headers(), body: JSON.stringify({ previewCells: cells() }),
    });
    expect(simulation.status).toBe(200);
    const simulationBody = await simulation.json() as { simulation: Record<string, unknown> };
    expect(simulationBody.simulation).toMatchObject({ quotedCount: 1, conflictCount: 0 });
    expect(String(simulationBody.simulation.contentHash)).toHaveLength(64);
    expect(String(simulationBody.simulation.previewHash)).toHaveLength(64);

    const conflicted = await postDraft(PLANS.conflicts, command(PLANS.conflicts, [
      { key: "property-a", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} },
      { key: "property-b", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} },
    ]), "order071-conflict-draft");
    expect(conflicted.status).toBe(201);
    const releaseId = String(((await conflicted.json() as Record<string, unknown>).release as Record<string, unknown>).id);
    const conflictPreview = await request(builderPath(PLANS.conflicts, `/releases/${releaseId}/simulate`), {
      method: "POST", headers: headers(), body: JSON.stringify({ previewCells: cells() }),
    });
    expect(conflictPreview.status).toBe(200);
    expect((await conflictPreview.json() as { simulation: { conflictCount: number } }).simulation.conflictCount).toBe(1);
    const approval = await request(builderPath(PLANS.conflicts, `/releases/${releaseId}/approval-request`), {
      method: "POST", headers: headers(requesterToken, "order071-conflict-approval"),
      body: JSON.stringify({ previewCells: cells() }),
    });
    expect(approval.status).toBe(409);
  });

  test("Order 075 P0: selected-release policy evidence is server-bound, never browser-owned", async () => {
    const browserCell = previewCell("selected-release-policy-cell");
    const staleBrowser = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/simulate`), {
      method: "POST", headers: headers(),
      body: JSON.stringify({ previewCells: [{ ...browserCell, policyEvidence: [] }] }),
    });
    const serverBound = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/simulate`), {
      method: "POST", headers: headers(), body: JSON.stringify({ previewCells: [browserCell] }),
    });
    const callerOwned = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/simulate`), {
      method: "POST", headers: headers(),
      body: JSON.stringify({ previewCells: [{ ...browserCell, policyEvidence: policyEvidence() }] }),
    });
    expect([staleBrowser.status, serverBound.status, callerOwned.status]).toEqual([400, 200, 400]);
    const serverBody = await serverBound.json() as { simulation: { cells: Array<{
      result: { policyEvidence: unknown };
    }> } };
    expect(serverBody.simulation.cells[0]?.result.policyEvidence).toEqual(policyEvidence().map(({ kind, policyId }) => ({
      kind,
      policyId,
      evidenceRef: `rate-release:${mainReleaseId}:${kind}:${policyId}`,
    })));
  });

  test("Order 076 P0: immutable history returns a complete reusable command and preserves its source", async () => {
    const initial = command(PLANS.reuse, [
      { key: "exact-room", effect: "exclude", priority: 20,
        physical: { kind: "sellable", sellableUnitId }, commercial: { channelCode: "direct" } },
      { key: "property-default", effect: "include", priority: 0,
        physical: { kind: "property" }, commercial: {} },
    ]);
    const sourceCommand = {
      ...initial,
      evaluator: { ...initial.evaluator, base: { kind: "fixed", amountMinor: "13750" } },
    };
    const drafted = await postDraft(PLANS.reuse, sourceCommand, "order076-source-draft");
    expect(drafted.status).toBe(201);
    const sourceReleaseId = String(((await drafted.json() as Record<string, unknown>).release as Record<string, unknown>).id);
    reuseReleaseId = sourceReleaseId;

    const history = await request(builderPath(PLANS.reuse), { headers: headers() });
    expect(history.status).toBe(200);
    const source = (await history.json() as { releases: Array<Record<string, unknown>> }).releases
      .find(({ id }) => id === sourceReleaseId);
    expect(source?.authoringCommand).toEqual(sourceCommand);

    const successorCommand = structuredClone(source?.authoringCommand) as typeof sourceCommand;
    successorCommand.evaluator.base.amountMinor = "14200";
    const copied = await postDraft(PLANS.reuse, successorCommand, "order076-copied-draft");
    expect(copied.status).toBe(201);
    const successorReleaseId = String(((await copied.json() as Record<string, unknown>).release as Record<string, unknown>).id);

    const reread = await request(builderPath(PLANS.reuse), { headers: headers() });
    expect(reread.status).toBe(200);
    const releases = (await reread.json() as { releases: Array<Record<string, unknown>> }).releases;
    expect(releases.find(({ id }) => id === sourceReleaseId)?.authoringCommand).toEqual(sourceCommand);
    expect(releases.find(({ id }) => id === successorReleaseId)?.authoringCommand).toEqual(successorCommand);
    expect(successorReleaseId).not.toBe(sourceReleaseId);
  });

  test("Order 076 P1: missing or mismatched stored version joins fail closed", async () => {
    const missingModel = buildApp({
      ...rateBuilderOperations(),
      models: {
        createDraftVersion: models.createDraftVersion.bind(models),
        async listDraftVersions() { return []; },
      },
    });
    const mismatchedModel = buildApp({
      ...rateBuilderOperations(),
      models: {
        createDraftVersion: models.createDraftVersion.bind(models),
        async listDraftVersions(tx, propertyNode, ratePlanId) {
          return (await models.listDraftVersions(tx, propertyNode, ratePlanId)).map((draft) =>
            Object.freeze({ ...draft, modelKey: "calendar" as const })
          );
        },
      },
    });
    const attempts = await Promise.all([missingModel, mismatchedModel].map((candidate) =>
      candidate.handle(new Request(`http://yellow.test${builderPath(PLANS.reuse)}`, { headers: headers() }))
    ));
    expect(attempts.map(({ status }) => status)).toEqual([404, 400]);
    for (const attempt of attempts) {
      const text = await attempt.text();
      expect(text).not.toContain(reuseReleaseId);
      expect(text).not.toContain("authoringCommand");
    }
  });

  test("Order 073: one draft preserves broad inheritance, a commercial include and an exact-room exclusion", async () => {
    const drafted = await postDraft(PLANS.targeting, command(PLANS.targeting, [
      { key: "property-default", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} },
      { key: "business-room", effect: "include", priority: 10,
        physical: { kind: "unit_type", unitTypeId }, commercial: { marketCode: "BUSINESS" } },
      { key: "direct-stop", effect: "exclude", priority: 20,
        physical: { kind: "sellable", sellableUnitId }, commercial: { channelCode: "direct" } },
    ]), "order073-target-draft");
    expect(drafted.status).toBe(201);
    const releaseId = String(((await drafted.json() as Record<string, unknown>).release as Record<string, unknown>).id);
    const base = previewCell("business-room-cell");
    const previewCells = [
      { ...base, targetContext: { unitTypeId, sellableUnitId, commercial: { marketCode: "BUSINESS" } } },
      { ...base, key: "direct-stop-cell",
        targetContext: { unitTypeId, sellableUnitId, commercial: { marketCode: "BUSINESS", channelCode: "direct" } } },
    ];
    const preview = await request(builderPath(PLANS.targeting, `/releases/${releaseId}/simulate`), {
      method: "POST", headers: headers(), body: JSON.stringify({ previewCells }),
    });
    expect(preview.status).toBe(200);
    const body = await preview.json() as { simulation: { cells: Array<{
      key: string;
      targetResolution: { state: string; winningRuleKey: string | null; matchedRuleKeys: string[] };
      result: { state: string; preTaxSubtotalMinor: string | null };
    }> } };
    expect(body.simulation.cells[0]).toMatchObject({
      key: "business-room-cell",
      targetResolution: { state: "included", winningRuleKey: "business-room",
        matchedRuleKeys: ["business-room", "property-default"] },
      result: { state: "quoted", preTaxSubtotalMinor: "12500" },
    });
    expect(body.simulation.cells[1]).toMatchObject({
      key: "direct-stop-cell",
      targetResolution: { state: "excluded", winningRuleKey: "direct-stop",
        matchedRuleKeys: ["direct-stop", "business-room", "property-default"] },
      result: { state: "unpriced", preTaxSubtotalMinor: null },
    });
  });

  test("P4: four-eyes approval publishes once, quote shows tax truth, and undo creates history", async () => {
    const requested = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/approval-request`), {
      method: "POST", headers: headers(requesterToken, "order071-main-approval"),
      body: JSON.stringify({ previewCells: cells() }),
    });
    expect(requested.status).toBe(201);
    const approvalId = String(((await requested.json() as Record<string, unknown>).approval as Record<string, unknown>).id);
    const requesterInbox = await request(builderPath(PLANS.main, "/approvals?limit=1"), {
      headers: headers(requesterToken),
    });
    expect(requesterInbox.status).toBe(200);
    expect(await requesterInbox.json()).toMatchObject({ approvals: [{
      id: approvalId,
      releaseId: mainReleaseId,
      status: "pending",
      requestedBy: { id: requester, displayName: "Yellow Review Operator" },
      canDecide: false,
      canPublish: false,
    }], nextCursor: null });
    const selfDecision = await request(builderPath(PLANS.main, `/approvals/${approvalId}/decision`), {
      method: "POST", headers: headers(requesterToken, "order077-self-decision"),
      body: JSON.stringify({ decision: "approved" }),
    });
    expect(selfDecision.status).toBe(409);
    const approverInbox = await request(builderPath(PLANS.main, "/approvals?limit=1"), {
      headers: headers(approverToken),
    });
    expect(approverInbox.status).toBe(200);
    expect(await approverInbox.json()).toMatchObject({ approvals: [{
      id: approvalId,
      status: "pending",
      canDecide: true,
      canPublish: false,
    }] });
    const decisionRequest = {
      method: "POST",
      headers: headers(approverToken, "order077-approve-main"),
      body: JSON.stringify({ decision: "approved" }),
    };
    const decision = await request(builderPath(PLANS.main, `/approvals/${approvalId}/decision`), decisionRequest);
    expect(decision.status).toBe(200);
    expect(decision.headers.get("idempotency-replayed")).toBe("false");
    const decisionBody = await decision.json();
    expect(decisionBody).toMatchObject({ approval: {
      id: approvalId,
      status: "approved",
      decidedBy: { id: approver, displayName: "Yellow Rate Approver" },
      canDecide: false,
      canPublish: true,
    } });
    const replay = await request(builderPath(PLANS.main, `/approvals/${approvalId}/decision`), decisionRequest);
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual(decisionBody);
    const selfPublish = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/publish`), {
      method: "POST", headers: headers(requesterToken, "order071-self-publish"),
      body: JSON.stringify({ approvalId, previewCells: cells() }),
    });
    expect(selfPublish.status).toBe(409);
    const refreshedPreview = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/simulate`), {
      method: "POST", headers: headers(approverToken), body: JSON.stringify({ previewCells: cells() }),
    });
    expect(refreshedPreview.status).toBe(200);
    const published = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/publish`), {
      method: "POST", headers: headers(approverToken, "order071-approved-publish"),
      body: JSON.stringify({ approvalId, previewCells: cells() }),
    });
    expect(published.status).toBe(201);
    expect((await published.json() as { release: { status: string } }).release.status).toBe("active");

    const quoteResponse = await request(builderPath(PLANS.main, "/quotes:resolve"), {
      method: "POST",
      headers: headers(approverToken),
      body: JSON.stringify({
        sellableUnitId,
        stayStart: "2026-09-10T15:00:00.000Z",
        stayEnd: "2026-09-11T11:00:00.000Z",
        guests: { adults: 2, childAges: [] },
        selectedPromotionCodes: [],
        commercial: {},
        channelCode: "direct",
      }),
    });
    expect(quoteResponse.status).toBe(200);
    const quoteBody = (await quoteResponse.json() as { quote: Record<string, unknown> }).quote;
    expect(quoteBody.taxAssignmentState).toBe("configured");
    expect((quoteBody.result as Record<string, unknown>).preTaxSubtotalMinor).toBe("12500");

    const undo = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/undo`), {
      method: "POST", headers: headers(approverToken, "order071-undo"), body: "{}",
    });
    expect(undo.status).toBe(201);
    expect(await undo.json()).toMatchObject({ status: "draft", undoOfVersion: 1, extensionVersion: 2 });
  });

  test("Order 077 P3: rejection is terminal and cannot publish", async () => {
    const requested = await request(builderPath(PLANS.reuse, `/releases/${reuseReleaseId}/approval-request`), {
      method: "POST", headers: headers(requesterToken, "order077-reject-request"),
      body: JSON.stringify({ previewCells: cells() }),
    });
    expect(requested.status).toBe(201);
    rejectedApprovalId = String(((await requested.json() as Record<string, unknown>).approval as Record<string, unknown>).id);
    const rejected = await request(builderPath(PLANS.reuse, `/approvals/${rejectedApprovalId}/decision`), {
      method: "POST", headers: headers(approverToken, "order077-reject-decision"),
      body: JSON.stringify({ decision: "rejected" }),
    });
    expect(rejected.status).toBe(200);
    expect(await rejected.json()).toMatchObject({ approval: {
      id: rejectedApprovalId, status: "rejected", canDecide: false, canPublish: false,
    } });
    const publishRejected = await request(builderPath(PLANS.reuse, `/releases/${reuseReleaseId}/publish`), {
      method: "POST", headers: headers(approverToken, "order077-rejected-publish"),
      body: JSON.stringify({ approvalId: rejectedApprovalId, previewCells: cells() }),
    });
    expect(publishRejected.status).toBe(409);
  });

  test("P2/P3: scope, property, route/body and caller-result attacks fail before mutation or leaks", async () => {
    const noScope = await tokens.issue({ userId: requester, tenantId: SEED_TENANT.id, scopes: ["rates.configuration:read"] });
    expect((await postDraft(PLANS.rollback, { ...command(PLANS.rollback), result: { price: 1 } }, "order071-no-scope", noScope)).status).toBe(403);
    expect((await postDraft(PLANS.rollback, command(PLANS.rollback), "order071-foreign-property", requesterToken, FOREIGN_PROPERTY)).status).toBe(403);
    expect((await postDraft(PLANS.rollback, command(PLANS.main), "order071-route-mismatch")).status).toBe(400);
    const forged = await request(builderPath(PLANS.main, `/releases/${mainReleaseId}/simulate`), {
      method: "POST", headers: headers(), body: JSON.stringify({ previewCells: cells(), contentHash: "caller" }),
    });
    expect(forged.status).toBe(400);
    const foreignTenant = await tokens.issue({ userId: requester, tenantId: FOREIGN_PROPERTY, scopes: FULL_SCOPES });
    expect((await request(builderPath(PLANS.main), { headers: headers(foreignTenant) })).status).toBe(403);
    const readOnly = await tokens.issue({ userId: requester, tenantId: SEED_TENANT.id, scopes: ["rates.configuration:read"] });
    expect((await request(builderPath(PLANS.main, "/approvals"), { headers: headers(readOnly) })).status).toBe(403);
    expect((await request(builderPath(PLANS.main, "/approvals?offset=1"), { headers: headers() })).status).toBe(400);
    expect((await request(builderPath(PLANS.main, "/approvals?limit=01"), { headers: headers() })).status).toBe(400);
    expect((await request(builderPath(PLANS.main, "/approvals?after=not/a/cursor"), { headers: headers() })).status).toBe(400);
    expect((await request(builderPath(PLANS.main, `/approvals/${rejectedApprovalId}/decision`), {
      method: "POST", headers: headers(approverToken, "order077-wrong-plan"),
      body: JSON.stringify({ decision: "approved" }),
    })).status).toBe(404);
    expect((await request(builderPath(PLANS.reuse, `/approvals/${rejectedApprovalId}/decision`), {
      method: "POST", headers: headers(approverToken, "order077-bad-body"),
      body: JSON.stringify({ decision: "expired" }),
    })).status).toBe(400);
    expect((await request(builderPath(PLANS.reuse, `/approvals/${rejectedApprovalId}/decision`), {
      method: "POST", headers: headers(approverToken),
      body: JSON.stringify({ decision: "approved" }),
    })).status).toBe(400);
  });
});
