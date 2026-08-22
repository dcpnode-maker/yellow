import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RateModelService,
  RatePublicationConflictError,
  RatePublicationError,
  RatePublicationNotFoundError,
  RatePublicationService,
  RateTargetService,
} from "../src/contexts/rates";
import {
  ApprovalService,
  createAuditEnvelope,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  type EventBus,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";
import { LAUNCH_EXTENSION_TYPES, runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_RATE_PUBLICATION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RATE_PUBLICATION === "1";
const TENANT = SEED_TENANT.id;
const PROPERTY = SEED_PROPERTY.id;
const FOREIGN_TENANT = "00000000-0000-0000-0000-0000000069b0";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-0000000069b1";
const REQUESTER = "00000000-0000-0000-0000-000000006990";
const APPROVER = "00000000-0000-0000-0000-000000006991";
const UNIT_TYPE = "00000000-0000-0000-0000-000000006950";
const SELLABLE = "00000000-0000-0000-0000-000000006951";
const CANCELLATION = "00000000-0000-0000-0000-000000006961";
const DEPOSIT = "00000000-0000-0000-0000-000000006962";
const GUARANTEE = "00000000-0000-0000-0000-000000006963";
const NO_SHOW = "00000000-0000-0000-0000-000000006964";
const PLANS = Object.freeze({
  main: "00000000-0000-0000-0000-000000006901",
  conflicts: "00000000-0000-0000-0000-000000006902",
  stale: "00000000-0000-0000-0000-000000006903",
  race: "00000000-0000-0000-0000-000000006904",
  rollback: "00000000-0000-0000-0000-000000006905",
  undo: "00000000-0000-0000-0000-000000006906",
  boundary: "00000000-0000-0000-0000-000000006907",
  scaling: "00000000-0000-0000-0000-000000006908",
  foreign: "00000000-0000-0000-0000-000000006909",
});

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RATE_PUBLICATION_URL is required by the Order 069 proof");
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
const approvalIds = new Set<string>();

function envelope(operation: string, actorId = REQUESTER, tenantId = TENANT, propertyNode = PROPERTY) {
  return createAuditEnvelope({
    tenantId,
    propertyNode,
    actorId,
    requestId: crypto.randomUUID(),
    operation,
  });
}

function evaluatorSpec(amountMinor: unknown = 10_000n, overrides: Record<string, unknown> = {}) {
  return {
    modelKey: "simple-fixed",
    currency: "USD",
    base: { kind: "fixed", amountMinor },
    gate: {},
    rules: [],
    ...overrides,
  };
}

function policyConfiguration(overrides: Record<string, unknown> = {}) {
  return {
    cancellationPolicyId: CANCELLATION,
    depositPolicyId: DEPOSIT,
    guaranteePolicyId: GUARANTEE,
    noShowPolicyId: NO_SHOW,
    refundTreatment: "policy",
    ...overrides,
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
    { kind: "cancellation", policyId: CANCELLATION, evidenceRef: "policy:cancellation-v1" },
    { kind: "deposit", policyId: DEPOSIT, evidenceRef: "policy:deposit-v1" },
    { kind: "guarantee", policyId: GUARANTEE, evidenceRef: "policy:guarantee-v1" },
    { kind: "no_show", policyId: NO_SHOW, evidenceRef: "policy:no-show-v1" },
  ];
}

function previewCell(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    evaluationContext: {
      propertyTimeZone: "UTC",
      bookingInstant: "2026-09-01T00:00:00.000Z",
      stayStartInstant: "2026-09-10T15:00:00.000Z",
      stayEndInstant: "2026-09-12T11:00:00.000Z",
      nightDate: "2026-09-10",
    },
    targetContext: {
      unitTypeId: UNIT_TYPE,
      sellableUnitId: SELLABLE,
      commercial: {},
    },
    guests: { adults: 2, childAges: [7] },
    selectedPromotionCodes: [],
    policyEvidence: policyEvidence(),
    mandatoryPolicyEvidence: [
      { key: "jurisdiction-registration", evidenceRef: "compliance:registration-v1" },
    ],
    availabilityEvidence: {
      sellableUnitId: SELLABLE,
      availableCount: 3,
      bookable: true,
      restrictionEvidence: [],
      operationalBlockEvidence: [],
      evidenceRef: "availability:projection-v1",
    },
    channelCode: "direct",
    channelMappingEvidenceRef: null,
    ...overrides,
  };
}

function propertyTarget(key = "property-base") {
  return [{ key, effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} }];
}

async function createRelease(planId: string, options: {
  modelKey?: string;
  componentModelKeys?: readonly string[];
  evaluator?: Record<string, unknown>;
  composition?: Record<string, unknown>;
  targetRules?: readonly Record<string, unknown>[];
} = {}) {
  return database.withTenantTransaction(TENANT, async (tx) => {
    const model = await models.createDraftVersion(tx, {
      ratePlanId: planId,
      modelKey: (options.modelKey ?? "simple-fixed") as never,
      modelVersion: 1,
      authoringMode: "expert",
      componentModelKeys: (options.componentModelKeys ?? []) as never,
      envelope: envelope("rate_plan_model.drafted"),
    });
    const target = await targets.createDraftVersion(tx, {
      ratePlanId: planId,
      authoringMode: "expert",
      rules: (options.targetRules ?? propertyTarget()) as never,
      envelope: envelope("rate_plan_target.drafted"),
    });
    return publication.createDraftVersion(tx, {
      ratePlanId: planId,
      modelDraftVersion: model.extensionVersion,
      targetDraftVersion: target.extensionVersion,
      evaluatorSpec: options.evaluator ?? evaluatorSpec(),
      compositionSpec: options.composition ?? compositionSpec(),
      envelope: envelope("rate_plan_release.drafted"),
    });
  });
}

async function requestAndApprove(releaseId: string, cells: readonly Record<string, unknown>[]) {
  const requested = await database.withTenantTransaction(TENANT, (tx) =>
    publication.requestPublicationApproval(tx, {
      releaseId,
      previewCells: cells,
      requestedBy: REQUESTER,
      envelope: envelope("rate_plan_release.approval_requested"),
    })
  );
  approvalIds.add(requested.approval.id);
  const approved = await database.withTenantTransaction(TENANT, (tx) => approvals.decide(tx, {
    approvalId: requested.approval.id,
    decision: "approved",
    decidedBy: APPROVER,
    envelope: envelope("approval.decided", APPROVER),
  }));
  expect(approved.status).toBe("approved");
  return requested;
}

async function publish(releaseId: string, approvalId: string, cells: readonly Record<string, unknown>[]) {
  return database.withTenantTransaction(TENANT, (tx) => publication.publishDraft(tx, {
    releaseId,
    approvalId,
    previewCells: cells,
    envelope: envelope("rate_plan_release.published", APPROVER),
  }));
}

class FailingEventBus implements EventBus {
  async publish(_tx: Tx, event: PublishEventInput): Promise<never> {
    if (event.eventType === "extension.activated") throw new Error("injected activation publisher failure");
    throw new Error("unexpected event");
  }

  async consumeBatch(): Promise<never> {
    throw new Error("not used");
  }
}

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
  publication = new RatePublicationService(registry, approvals, events);

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${FOREIGN_TENANT}::uuid, 'order069-foreign', 'Order 069 Foreign', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${FOREIGN_PROPERTY}::uuid, ${FOREIGN_TENANT}::uuid, 'order069_foreign.property', 'property', 'Order 069 Foreign', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name)
    VALUES
      (${REQUESTER}::uuid, ${TENANT}::uuid, 'order069-requester@yellow.test', 'Order 069 Requester'),
      (${APPROVER}::uuid, ${TENANT}::uuid, 'order069-approver@yellow.test', 'Order 069 Approver')
  `;
  await admin`
    INSERT INTO policy (id, tenant_id, kind, name, content)
    VALUES
      (${CANCELLATION}::uuid, ${TENANT}::uuid, 'cancellation', 'Order 069 Cancellation', '{"kind":"cancellation"}'::jsonb),
      (${DEPOSIT}::uuid, ${TENANT}::uuid, 'deposit', 'Order 069 Deposit', '{"kind":"deposit"}'::jsonb),
      (${GUARANTEE}::uuid, ${TENANT}::uuid, 'guarantee', 'Order 069 Guarantee', '{"kind":"guarantee"}'::jsonb),
      (${NO_SHOW}::uuid, ${TENANT}::uuid, 'no_show', 'Order 069 No Show', '{"kind":"no_show"}'::jsonb)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key)
    VALUES (${UNIT_TYPE}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-STD', 'Order 069 Standard', 'hotel')
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status)
    VALUES (${SELLABLE}::uuid, ${TENANT}::uuid, ${UNIT_TYPE}::uuid, 'Order 069 Sellable', 'active')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status)
    VALUES
      (${PLANS.main}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-MAIN', 'Order 069 Main', 'USD', 'active'),
      (${PLANS.conflicts}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-CONFLICT', 'Order 069 Conflicts', 'USD', 'active'),
      (${PLANS.stale}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-STALE', 'Order 069 Stale', 'USD', 'active'),
      (${PLANS.race}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-RACE', 'Order 069 Race', 'USD', 'active'),
      (${PLANS.rollback}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-ROLLBACK', 'Order 069 Rollback', 'USD', 'active'),
      (${PLANS.undo}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-UNDO', 'Order 069 Undo', 'USD', 'active'),
      (${PLANS.boundary}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-BOUNDARY', 'Order 069 Boundary', 'USD', 'active'),
      (${PLANS.scaling}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid, 'O69-SCALING', 'Order 069 Scaling', 'USD', 'active'),
      (${PLANS.foreign}::uuid, ${FOREIGN_TENANT}::uuid, ${FOREIGN_PROPERTY}::uuid, 'O69-FOREIGN', 'Order 069 Foreign', 'USD', 'active')
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await admin`DELETE FROM outbox WHERE actor_id IN (${REQUESTER}::uuid, ${APPROVER}::uuid)`;
  await admin`DELETE FROM fact_log WHERE actor_id IN (${REQUESTER}::uuid, ${APPROVER}::uuid)`;
  await admin`DELETE FROM approval_request WHERE kind = 'rate_plan_release'`;
  await admin`DELETE FROM extension WHERE tenant_id = ${TENANT}::uuid AND key LIKE 'rate-plan:%' AND type IN ('rate_plan_model','rate_plan_target','rate_plan_release')`;
  await admin`DELETE FROM rate_plan WHERE id IN ${admin(Object.values(PLANS))}`;
  await admin`DELETE FROM sellable_unit WHERE id = ${SELLABLE}::uuid`;
  await admin`DELETE FROM unit_type WHERE id = ${UNIT_TYPE}::uuid`;
  await admin`DELETE FROM policy WHERE id IN (${CANCELLATION}::uuid, ${DEPOSIT}::uuid, ${GUARANTEE}::uuid, ${NO_SHOW}::uuid)`;
  await admin`DELETE FROM app_user WHERE id IN (${REQUESTER}::uuid, ${APPROVER}::uuid)`;
  await admin`DELETE FROM org_node WHERE id = ${FOREIGN_PROPERTY}::uuid`;
  await admin`DELETE FROM tenant WHERE id = ${FOREIGN_TENANT}::uuid`;
  await admin.close();
  await platformPool.close();
  await eventPool.close();
  await database.close();
});

describe("Order 069 launch release schema", () => {
  test("P1: release schema is registered without a seeded active instance", () => {
    expect(LAUNCH_EXTENSION_TYPES).toHaveLength(10);
    const releaseType = LAUNCH_EXTENSION_TYPES.filter(({ type }) => type === "rate_plan_release");
    expect(releaseType).toHaveLength(1);
  });
});

databaseDescribe("Order 069 atomic rate release publication", () => {
  test("P1: a draft binds exact inputs and persists only tagged exact money", async () => {
    const first = await createRelease(PLANS.main);
    expect(first).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      ratePlanId: PLANS.main,
      extensionVersion: 1,
      status: "draft",
      rmsBinding: null,
      undoOfVersion: null,
    });
    const before = await admin<Array<{ id: string; version: number; content: string }>>`
      SELECT id, version, content::text AS content FROM extension
      WHERE tenant_id = ${TENANT}::uuid AND type = 'rate_plan_release'
        AND key = ${`rate-plan:${PLANS.main}`} ORDER BY version
    `;
    expect(before).toHaveLength(1);
    expect(before[0]?.content).toContain('"$minor": "10000"');
    expect(before[0]?.content).toContain('"rms_binding": null');
    expect(before[0]?.content).not.toMatch(/amountMinor"\s*:\s*10000/);

    const second = await createRelease(PLANS.main, { evaluator: evaluatorSpec(12_345n, {
      rules: [
        { key: "signed-discount", stage: 1, priority: 1, when: {}, adjustment: { kind: "delta", amountMinor: -345n } },
      ],
    }) });
    expect(second.extensionVersion).toBe(2);
    const after = await admin<Array<{ id: string; version: number; content: string }>>`
      SELECT id, version, content::text AS content FROM extension
      WHERE tenant_id = ${TENANT}::uuid AND type = 'rate_plan_release'
        AND key = ${`rate-plan:${PLANS.main}`} ORDER BY version
    `;
    expect(after[0]).toEqual(before[0]);
    expect(after[1]?.content).toContain('"$minor": "-345"');
    const signed = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: second.id,
      previewCells: [previewCell("signed-discount")],
    }));
    expect(signed.cells[0]?.result.preTaxSubtotalMinor).toBe(12_000n);
    const evidence = await admin<Array<{ facts: number; activations: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE fact_type = 'rate_plan_release.drafted'
          AND entity_id IN ${admin(after.map(({ id }) => id))}) AS facts,
        (SELECT count(*)::int FROM outbox WHERE event_type = 'extension.activated'
          AND aggregate_id IN ${admin(after.map(({ id }) => id))}) AS activations
    `;
    expect(evidence).toEqual([{ facts: 2, activations: 0 }]);
  });

  test("P2: server simulation is deterministic and every conflict source blocks approval", async () => {
    const stable = await createRelease(PLANS.conflicts);
    const cells = [previewCell("zeta"), previewCell("alpha", { guests: { adults: 1, childAges: [] } })];
    const first = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: stable.id,
      previewCells: cells,
    }));
    const second = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: stable.id,
      previewCells: [...cells].reverse(),
    }));
    expect(second).toEqual(first);
    expect(first.cells.map(({ key }) => key)).toEqual(["alpha", "zeta"]);
    expect(first).toMatchObject({ quotedCount: 2, conflictCount: 0, blockedCount: 0, unpricedCount: 0 });
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.previewHash).toMatch(/^[0-9a-f]{64}$/);

    const targetConflict = await createRelease(PLANS.conflicts, {
      targetRules: [
        { key: "zeta", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} },
        { key: "alpha", effect: "include", priority: 0, physical: { kind: "property" }, commercial: {} },
      ],
    });
    const evaluatorConflict = await createRelease(PLANS.conflicts, {
      modelKey: "expert-composition",
      componentModelKeys: ["simple-fixed"],
      evaluator: evaluatorSpec(10_000n, {
        modelKey: "expert-composition",
        rules: [
          { key: "zeta", stage: 1, priority: 5, when: {}, adjustment: { kind: "delta", amountMinor: 1n } },
          { key: "alpha", stage: 1, priority: 5, when: {}, adjustment: { kind: "delta", amountMinor: 2n } },
        ],
      }),
    });
    const promotionConflict = await createRelease(PLANS.conflicts, {
      composition: compositionSpec({ promotions: [
        { code: "ZETA", version: 1, stage: 1, priority: 5, scope: "room", discount: { kind: "amount", amountMinor: 1n } },
        { code: "ALPHA", version: 1, stage: 1, priority: 5, scope: "room", discount: { kind: "amount", amountMinor: 2n } },
      ] }),
    });
    const conflictCases = [
      { release: targetConflict, cell: previewCell("target") },
      { release: evaluatorConflict, cell: previewCell("evaluator") },
      { release: promotionConflict, cell: previewCell("promotion", { selectedPromotionCodes: ["ZETA", "ALPHA"] }) },
    ];
    for (const { release, cell } of conflictCases) {
      const simulation = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
        releaseId: release.id,
        previewCells: [cell],
      }));
      expect(simulation.conflictCount).toBe(1);
      expect(simulation.cells[0]?.result.state).toBe("conflict");
      await expect(database.withTenantTransaction(TENANT, (tx) => publication.requestPublicationApproval(tx, {
        releaseId: release.id,
        previewCells: [cell],
        requestedBy: REQUESTER,
        envelope: envelope("rate_plan_release.approval_requested"),
      }))).rejects.toBeInstanceOf(RatePublicationConflictError);
    }
  });

  test("P3: approval binds exact hashes and becomes stale after a newer draft", async () => {
    const draft = await createRelease(PLANS.stale);
    const cells = [previewCell("stale")];
    const requested = await database.withTenantTransaction(TENANT, (tx) => publication.requestPublicationApproval(tx, {
      releaseId: draft.id,
      previewCells: cells,
      requestedBy: REQUESTER,
      envelope: envelope("rate_plan_release.approval_requested"),
    }));
    approvalIds.add(requested.approval.id);
    expect(requested.approval).toMatchObject({
      kind: "rate_plan_release",
      subjectType: "extension",
      subjectId: draft.id,
      status: "pending",
      payload: {
        rate_plan_id: PLANS.stale,
        extension_version: draft.extensionVersion,
        content_hash: requested.simulation.contentHash,
        preview_hash: requested.simulation.previewHash,
        preview_cell_count: 1,
      },
    });
    await expect(database.withTenantTransaction(TENANT, (tx) => approvals.decide(tx, {
      approvalId: requested.approval.id,
      decision: "approved",
      decidedBy: REQUESTER,
      envelope: envelope("approval.decided", REQUESTER),
    }))).rejects.toThrow("Self-approval is forbidden");
    await database.withTenantTransaction(TENANT, (tx) => approvals.decide(tx, {
      approvalId: requested.approval.id,
      decision: "approved",
      decidedBy: APPROVER,
      envelope: envelope("approval.decided", APPROVER),
    }));
    await createRelease(PLANS.stale, { evaluator: evaluatorSpec(11_000n) });
    await expect(publish(draft.id, requested.approval.id, cells)).rejects.toBeInstanceOf(RatePublicationConflictError);
    const artifacts = await admin<Array<{ status: string; facts: number; events: number }>>`
      SELECT extension.status,
        (SELECT count(*)::int FROM fact_log WHERE entity_id = extension.id AND fact_type = 'rate_plan_release.published') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = extension.id AND event_type = 'extension.activated') AS events
      FROM extension WHERE id = ${draft.id}::uuid
    `;
    expect(artifacts).toEqual([{ status: "draft", facts: 0, events: 0 }]);
  });

  test("P4: latest publication is atomic and twenty contenders activate once", async () => {
    const first = await createRelease(PLANS.race);
    const cells = [previewCell("race")];
    const firstApproval = await requestAndApprove(first.id, cells);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => publish(
      first.id,
      firstApproval.approval.id,
      cells,
    )));
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(19);
    const firstEvidence = await admin<Array<{ status: string; facts: number; events: number }>>`
      SELECT extension.status,
        (SELECT count(*)::int FROM fact_log WHERE entity_id = extension.id AND fact_type = 'rate_plan_release.published') AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = extension.id AND event_type = 'extension.activated') AS events
      FROM extension WHERE id = ${first.id}::uuid
    `;
    expect(firstEvidence).toEqual([{ status: "active", facts: 1, events: 1 }]);

    const second = await createRelease(PLANS.race, { evaluator: evaluatorSpec(12_000n) });
    const secondApproval = await requestAndApprove(second.id, cells);
    const published = await publish(second.id, secondApproval.approval.id, cells);
    expect(published).toMatchObject({ previousActiveVersion: 1, release: { status: "active", extensionVersion: 2 } });
    const versions = await database.withTenantTransaction(TENANT, (tx) => publication.listReleaseVersions(tx, PROPERTY, PLANS.race));
    expect(versions.map(({ extensionVersion, status }) => [extensionVersion, status])).toEqual([
      [1, "retired"],
      [2, "active"],
    ]);
    expect((await database.withTenantTransaction(TENANT, (tx) => publication.getActiveRelease(tx, PROPERTY, PLANS.race))).id).toBe(second.id);
  }, 30_000);

  test("P5: late event failure restores prior active state and leaves no partial bulk publish", async () => {
    const active = await createRelease(PLANS.rollback);
    const oneCell = [previewCell("active")];
    const activeApproval = await requestAndApprove(active.id, oneCell);
    await publish(active.id, activeApproval.approval.id, oneCell);

    const candidate = await createRelease(PLANS.rollback, { evaluator: evaluatorSpec(13_000n) });
    const bulk = [previewCell("three"), previewCell("one"), previewCell("two")];
    const candidateApproval = await requestAndApprove(candidate.id, bulk);
    const failing = new RatePublicationService(registry, approvals, new FailingEventBus());
    await expect(database.withTenantTransaction(TENANT, (tx) => failing.publishDraft(tx, {
      releaseId: candidate.id,
      approvalId: candidateApproval.approval.id,
      previewCells: bulk,
      envelope: envelope("rate_plan_release.published", APPROVER),
    }))).rejects.toThrow("injected activation publisher failure");
    const statuses = await admin<Array<{ id: string; status: string; publish_facts: number; events: number }>>`
      SELECT extension.id, extension.status,
        (SELECT count(*)::int FROM fact_log WHERE entity_id = extension.id AND fact_type IN ('rate_plan_release.published','rate_plan_release.retired')) AS publish_facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = extension.id AND event_type = 'extension.activated') AS events
      FROM extension WHERE id IN (${active.id}::uuid, ${candidate.id}::uuid) ORDER BY extension.version
    `;
    expect(statuses).toEqual([
      { id: active.id, status: "active", publish_facts: 1, events: 1 },
      { id: candidate.id, status: "draft", publish_facts: 0, events: 0 },
    ]);
  });

  test("P6: undo copies history into a new version and repeats approval", async () => {
    const cells = [previewCell("undo")];
    const first = await createRelease(PLANS.undo, { evaluator: evaluatorSpec(10_000n) });
    const firstSimulation = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: first.id,
      previewCells: cells,
    }));
    const firstApproval = await requestAndApprove(first.id, cells);
    await publish(first.id, firstApproval.approval.id, cells);
    const historicalBytes = (await admin<Array<{ content: string }>>`
      SELECT content::text AS content FROM extension WHERE id = ${first.id}::uuid
    `)[0]!.content;

    const second = await createRelease(PLANS.undo, { evaluator: evaluatorSpec(20_000n) });
    const secondApproval = await requestAndApprove(second.id, cells);
    await publish(second.id, secondApproval.approval.id, cells);
    const undo = await database.withTenantTransaction(TENANT, (tx) => publication.createUndoDraftVersion(tx, {
      sourceReleaseId: first.id,
      envelope: envelope("rate_plan_release.undo_drafted"),
    }));
    expect(undo).toMatchObject({ extensionVersion: 3, status: "draft", undoOfVersion: 1 });
    expect((await admin<Array<{ content: string }>>`
      SELECT content::text AS content FROM extension WHERE id = ${first.id}::uuid
    `)[0]!.content).toBe(historicalBytes);
    const undoSimulation = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: undo.id,
      previewCells: cells,
    }));
    expect(undoSimulation.cells).toEqual(firstSimulation.cells);
    expect(undoSimulation.previewHash).toBe(firstSimulation.previewHash);
    expect(undoSimulation.contentHash).not.toBe(firstSimulation.contentHash);
    const undoApproval = await requestAndApprove(undo.id, cells);
    await publish(undo.id, undoApproval.approval.id, cells);
    expect((await database.withTenantTransaction(TENANT, (tx) => publication.getActiveRelease(tx, PROPERTY, PLANS.undo))).id).toBe(undo.id);
  });

  test("P7: tenant, reference, storage and caller-evidence boundaries fail closed", async () => {
    const release = await createRelease(PLANS.boundary);
    const cells = [previewCell("boundary")];
    await expect(database.withTenantTransaction(FOREIGN_TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: release.id,
      previewCells: cells,
    }))).rejects.toBeInstanceOf(RatePublicationNotFoundError);
    await expect(database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: release.id,
      previewCells: [{ ...previewCell("forged"), rateEvaluationResult: { state: "priced" } }],
    }))).rejects.toBeInstanceOf(RatePublicationError);

    const original = (await admin<Array<{ content: string }>>`
      SELECT content::text AS content FROM extension WHERE id = ${release.id}::uuid
    `)[0]!.content;
    await admin`
      UPDATE extension SET content = jsonb_set(content, '{evaluator,base,amountMinor,$minor}', '"01"'::jsonb)
      WHERE id = ${release.id}::uuid
    `;
    await expect(database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: release.id,
      previewCells: cells,
    }))).rejects.toBeInstanceOf(RatePublicationError);
    await admin`UPDATE extension SET content = ${original}::text::jsonb WHERE id = ${release.id}::uuid`;

    await admin`
      UPDATE extension
      SET content = jsonb_set(content, '{model_draft_id}', to_jsonb(${crypto.randomUUID()}::text))
      WHERE id = ${release.id}::uuid
    `;
    await expect(database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: release.id,
      previewCells: cells,
    }))).rejects.toBeInstanceOf(RatePublicationNotFoundError);
    await admin`UPDATE extension SET content = ${original}::text::jsonb WHERE id = ${release.id}::uuid`;

    await admin`
      UPDATE extension
      SET content = jsonb_set(content, '{rms_binding}', ${JSON.stringify({
        adapter_key: "order070-reserved",
        adapter_version: 1,
        maximum_age_seconds: 300,
        outage_fallback: "local_evaluator",
      })}::text::jsonb)
      WHERE id = ${release.id}::uuid
    `;
    await expect(database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: release.id,
      previewCells: cells,
    }))).rejects.toBeInstanceOf(RatePublicationError);
    await admin`UPDATE extension SET content = ${original}::text::jsonb WHERE id = ${release.id}::uuid`;

    await expect(createRelease(PLANS.boundary, { evaluator: evaluatorSpec(10_000.5) })).rejects.toThrow();
    await expect(createRelease(PLANS.boundary, {
      modelKey: "rms-api-managed",
      evaluator: evaluatorSpec(),
    })).rejects.toBeInstanceOf(RatePublicationError);
    await expect(createRelease(PLANS.boundary, {
      composition: compositionSpec({ policy: policyConfiguration({ noShowPolicyId: crypto.randomUUID() }) }),
    })).rejects.toBeInstanceOf(RatePublicationNotFoundError);
  });

  test("P8: 250 to 500 preview cells expose bounded work", async () => {
    const release = await createRelease(PLANS.scaling);
    const cells = (count: number) => Array.from({ length: count }, (_, index) =>
      previewCell(`cell-${index.toString().padStart(3, "0")}`)
    );
    const started = performance.now();
    const first = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: release.id,
      previewCells: cells(250),
    }));
    const second = await database.withTenantTransaction(TENANT, (tx) => publication.simulateDraft(tx, {
      releaseId: release.id,
      previewCells: cells(500),
    }));
    const elapsed = performance.now() - started;
    expect(second.workUnits).toBeGreaterThan(first.workUnits);
    expect(second.workUnits).toBeLessThan(first.workUnits * 2.2);
    expect(second.cells).toHaveLength(500);
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);
});
