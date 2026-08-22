import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RATE_MODEL_CATALOGUE,
  RATE_MODEL_KEYS,
  RateModelService,
  RateNotFoundError,
  RateValidationError,
  type RateModelDraft,
  type RateModelKey,
} from "../src/contexts/rates";
import {
  createAuditEnvelope,
  Database,
  ExtensionRegistry,
  validateJsonSchema,
} from "../src/kernel";
import {
  LAUNCH_EXTENSIONS,
  LAUNCH_EXTENSION_TYPES,
  runSeed,
  SeedError,
} from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_RATE_MODELS_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RATE_MODELS === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000006512";
const TENANT_B = "00000000-0000-0000-0000-000000006502";
const PROPERTY_B = "00000000-0000-0000-0000-000000006522";
const ACTOR_A = "00000000-0000-0000-0000-000000006560";
const ACTOR_B = "00000000-0000-0000-0000-000000006561";
const PLAN_A = "00000000-0000-0000-0000-000000006501";
const PLAN_CONCURRENT = "00000000-0000-0000-0000-000000006503";
const PLAN_A2 = "00000000-0000-0000-0000-000000006504";
const PLAN_B = "00000000-0000-0000-0000-000000006505";

const EXPECTED_KEYS = [
  "simple-fixed",
  "calendar",
  "bar-ladder",
  "derived",
  "room-matrix",
  "occupancy-los",
  "contract-negotiated",
  "package",
  "rms-api-managed",
  "expert-composition",
] as const;

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RATE_MODELS_URL is required by the Order 065 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let platformPool: SQL;
let database: Database;
let registry: ExtensionRegistry;
let service: RateModelService;
const createdDrafts: RateModelDraft[] = [];

function envelope(tenantId = TENANT_A, propertyNode = PROPERTY_A, actorId = ACTOR_A) {
  return createAuditEnvelope({
    tenantId,
    propertyNode,
    actorId,
    requestId: crypto.randomUUID(),
    operation: "rate_plan_model.drafted",
  });
}

function input(
  ratePlanId: string,
  modelKey: RateModelKey,
  authoringMode: "guided" | "expert" | "ai",
  componentModelKeys: readonly RateModelKey[] = [],
) {
  return {
    ratePlanId,
    modelKey,
    modelVersion: 1,
    authoringMode,
    componentModelKeys,
    envelope: envelope(),
  } as const;
}

async function countDraftArtifacts(ratePlanId: string): Promise<{
  rows: number;
  facts: number;
  events: number;
}> {
  const key = `rate-plan:${ratePlanId}`;
  const rows = await admin<Array<{ rows: number; facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM extension
        WHERE tenant_id = ${TENANT_A}::uuid AND type = 'rate_plan_model' AND key = ${key}) AS rows,
      (SELECT count(*)::int FROM fact_log
        WHERE tenant_id = ${TENANT_A}::uuid
          AND entity_type = 'extension'
          AND fact_type = 'rate_plan_model.drafted'
          AND payload->>'rate_plan_id' = ${ratePlanId}) AS facts,
      (SELECT count(*)::int FROM outbox
        WHERE tenant_id = ${TENANT_A}::uuid
          AND aggregate_type IN ('extension', 'rate_plan_model')
          AND payload->>'rate_plan_id' = ${ratePlanId}) AS events
  `;
  return rows[0] ?? { rows: -1, facts: -1, events: -1 };
}

async function expectRejectedWithoutDraft(
  operation: () => Promise<unknown>,
  errorClass: typeof RateValidationError | typeof RateNotFoundError,
  ratePlanId = PLAN_A,
) {
  const before = await countDraftArtifacts(ratePlanId);
  await expect(operation()).rejects.toBeInstanceOf(errorClass);
  expect(await countDraftArtifacts(ratePlanId)).toEqual(before);
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  admin = new SQL(DATABASE_URL, { max: 6 });
  platformPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 28 });
  registry = new ExtensionRegistry(platformPool);
  service = new RateModelService(registry);

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT_B}::uuid, 'order065-b', 'Order 065 Tenant B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'yellow_demo.order065_a2', 'property', 'Order 065 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order065_b.property', 'property', 'Order 065 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status)
    VALUES
      (${PLAN_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O65-MAIN', 'Order 065 Main', 'USD', 'active'),
      (${PLAN_CONCURRENT}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O65-RACE', 'Order 065 Race', 'USD', 'active'),
      (${PLAN_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O65-A2', 'Order 065 A2', 'USD', 'active'),
      (${PLAN_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O65-B', 'Order 065 B', 'USD', 'active')
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await admin`DELETE FROM fact_log WHERE fact_type = 'rate_plan_model.drafted'`;
  await admin`DELETE FROM extension WHERE type = 'rate_plan_model'`;
  await admin`DELETE FROM rate_plan WHERE id IN (
    ${PLAN_A}::uuid, ${PLAN_CONCURRENT}::uuid, ${PLAN_A2}::uuid, ${PLAN_B}::uuid
  )`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin.close();
  await platformPool.close();
  await database.close();
});

describe("Order 065 registered rate-model catalogue", () => {
  test("P2: catalogue keys, versions and capabilities are exact and schema-valid", () => {
    expect(RATE_MODEL_KEYS).toEqual(EXPECTED_KEYS);
    expect(RATE_MODEL_CATALOGUE).toHaveLength(10);
    expect(RATE_MODEL_CATALOGUE.map(({ key }) => key)).toEqual(EXPECTED_KEYS);
    expect(RATE_MODEL_CATALOGUE.every(({ version, label, description, capabilities }) =>
      version === 1 &&
      label.trim() === label &&
      label.length > 0 &&
      description.trim() === description &&
      description.length > 0 &&
      capabilities.length > 0 &&
      new Set(capabilities).size === capabilities.length
    )).toBeTrue();

    const type = LAUNCH_EXTENSION_TYPES.find(({ type }) => type === "rate_model");
    if (!type) throw new Error("rate_model launch schema missing");
    const rows = LAUNCH_EXTENSIONS.filter(({ type }) => type === "rate_model");
    expect(rows).toHaveLength(10);
    expect(rows.map(({ key }) => key)).toEqual(EXPECTED_KEYS);
    expect(rows.map(({ content }) => content)).toEqual(
      RATE_MODEL_CATALOGUE.map(({ key: _key, ...content }) => content),
    );
    expect(rows.flatMap(({ key, content }) =>
      validateJsonSchema(type.jsonSchema, content).map((issue) => ({ key, issue }))
    )).toEqual([]);
    expect(validateJsonSchema(type.jsonSchema, {
      version: 1,
      label: "Broken",
      description: "Missing capabilities",
      capabilities: [],
      extra: true,
    })).not.toEqual([]);
  });
});

databaseDescribe("Order 065 immutable tenant rate-model selections", () => {
  test("P1: production seed is exact, replayable, and divergent catalogue content rolls back", async () => {
    const types = await admin<Array<{ type: string }>>`
      SELECT type FROM extension_type WHERE type IN ('rate_model', 'rate_plan_model') ORDER BY type
    `;
    const models = await admin<Array<{ key: string; version: number; status: string }>>`
      SELECT key, version, status FROM extension
      WHERE tenant_id IS NULL AND type = 'rate_model'
      ORDER BY key
    `;
    expect(types.map(({ type }) => type)).toEqual(["rate_model", "rate_plan_model"]);
    expect(models).toHaveLength(10);
    expect(models.every(({ version, status }) => version === 1 && status === "active")).toBeTrue();
    expect(models.map(({ key }) => key)).toEqual([...EXPECTED_KEYS].sort());

    const beforeFacts = Number((await admin`SELECT count(*)::int AS count FROM fact_log`)[0]?.count);
    const replay = await runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined });
    expect(replay.registry).toBe("already exact");
    expect(Number((await admin`SELECT count(*)::int AS count FROM fact_log`)[0]?.count)).toBe(beforeFacts);

    const canonical = RATE_MODEL_CATALOGUE.find(({ key }) => key === "simple-fixed");
    if (!canonical) throw new Error("simple-fixed catalogue content missing");
    await admin`
      UPDATE extension
      SET content = jsonb_set(content, '{label}', '"Divergent"'::jsonb)
      WHERE tenant_id IS NULL AND type = 'rate_model' AND key = 'simple-fixed' AND version = 1
    `;
    await expect(runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined })).rejects.toBeInstanceOf(SeedError);
    expect(Number((await admin`SELECT count(*)::int AS count FROM fact_log`)[0]?.count)).toBe(beforeFacts);
    const { key: _key, ...content } = canonical;
    await admin`
      UPDATE extension
      SET content = ${JSON.stringify(content)}::text::jsonb
      WHERE tenant_id IS NULL AND type = 'rate_model' AND key = 'simple-fixed' AND version = 1
    `;
    expect((await runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined })).registry).toBe("already exact");
  }, 30_000);

  test("P3: all authoring modes share one envelope and expert components normalize", async () => {
    const selections = await Promise.all([
      database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, input(PLAN_A, "simple-fixed", "guided"))),
      database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, input(PLAN_A, "simple-fixed", "expert"))),
      database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, input(PLAN_A, "simple-fixed", "ai"))),
    ]);
    createdDrafts.push(...selections);
    expect(selections.map(({ authoringMode }) => authoringMode)).toEqual(["guided", "expert", "ai"]);
    expect(selections.map(({ modelKey, modelVersion, componentModelKeys, status }) => ({
      modelKey,
      modelVersion,
      componentModelKeys,
      status,
    }))).toEqual(Array.from({ length: 3 }, () => ({
      modelKey: "simple-fixed",
      modelVersion: 1,
      componentModelKeys: [],
      status: "draft",
    })));

    const composition = await database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, input(
      PLAN_A,
      "expert-composition",
      "expert",
      ["room-matrix", "calendar", "derived"],
    )));
    createdDrafts.push(composition);
    expect(composition.componentModelKeys).toEqual(["calendar", "derived", "room-matrix"]);

    for (const invalid of [
      input(PLAN_A, "simple-fixed", "guided", ["calendar"]),
      input(PLAN_A, "expert-composition", "expert", []),
      input(PLAN_A, "expert-composition", "expert", ["expert-composition"]),
      input(PLAN_A, "expert-composition", "expert", ["calendar", "calendar"]),
      input(PLAN_A, "expert-composition", "expert", [
        "simple-fixed", "calendar", "bar-ladder", "derived", "room-matrix",
        "occupancy-los", "contract-negotiated", "package", "rms-api-managed",
      ]),
    ]) {
      await expectRejectedWithoutDraft(
        () => database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, invalid)),
        RateValidationError,
      );
    }
  });

  test("P4: versions and facts are exact while every prior row stays byte-equivalent", async () => {
    const before = await admin<Array<{ id: string; version: number; bytes: string }>>`
      SELECT id, version, content::text AS bytes
      FROM extension
      WHERE tenant_id = ${TENANT_A}::uuid AND type = 'rate_plan_model'
        AND key = ${`rate-plan:${PLAN_A}`}
      ORDER BY version
    `;
    const next = await database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(
      tx,
      input(PLAN_A, "calendar", "guided"),
    ));
    createdDrafts.push(next);
    expect(next.extensionVersion).toBe(before.length + 1);

    const after = await admin<Array<{ id: string; version: number; bytes: string }>>`
      SELECT id, version, content::text AS bytes
      FROM extension
      WHERE tenant_id = ${TENANT_A}::uuid AND type = 'rate_plan_model'
        AND key = ${`rate-plan:${PLAN_A}`}
      ORDER BY version
    `;
    expect(after.slice(0, before.length)).toEqual(before);
    const listed = await database.withTenantTransaction(TENANT_A, (tx) =>
      service.listDraftVersions(tx, PROPERTY_A, PLAN_A)
    );
    expect(listed.map(({ extensionVersion }) => extensionVersion)).toEqual(
      Array.from({ length: after.length }, (_, index) => index + 1),
    );
    const evidence = await countDraftArtifacts(PLAN_A);
    expect(evidence).toEqual({ rows: after.length, facts: after.length, events: 0 });
  });

  test("P5: twenty concurrent drafts produce gapless versions and no events", async () => {
    const beforeOutbox = Number((await admin`SELECT count(*)::int AS count FROM outbox`)[0]?.count);
    const drafts = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, input(
        PLAN_CONCURRENT,
        index % 2 === 0 ? "simple-fixed" : "calendar",
        index % 3 === 0 ? "ai" : "guided",
      )))
    ));
    createdDrafts.push(...drafts);
    expect(drafts.map(({ extensionVersion }) => extensionVersion).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(await countDraftArtifacts(PLAN_CONCURRENT)).toEqual({ rows: 20, facts: 20, events: 0 });
    expect(Number((await admin`SELECT count(*)::int AS count FROM outbox`)[0]?.count)).toBe(beforeOutbox);
  }, 30_000);

  test("P6: tenant, property, plan and strict input boundaries fail closed", async () => {
    await expectRejectedWithoutDraft(
      () => database.withTenantTransaction(TENANT_B, (tx) => service.createDraftVersion(tx, {
        ...input(PLAN_A, "simple-fixed", "guided"),
        envelope: envelope(TENANT_B, PROPERTY_B, ACTOR_B),
      })),
      RateNotFoundError,
    );
    await expectRejectedWithoutDraft(
      () => database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, {
        ...input(PLAN_A2, "simple-fixed", "guided"),
        envelope: envelope(TENANT_A, PROPERTY_A),
      })),
      RateNotFoundError,
      PLAN_A2,
    );
    await expectRejectedWithoutDraft(
      () => database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, {
        ...input(PLAN_B, "simple-fixed", "guided"),
        envelope: envelope(TENANT_A, PROPERTY_A),
      })),
      RateNotFoundError,
      PLAN_B,
    );

    for (const invalid of [
      { ...input("not-a-uuid", "simple-fixed", "guided") },
      { ...input(PLAN_A, "simple-fixed", "guided"), modelKey: "unknown-model" },
      { ...input(PLAN_A, "simple-fixed", "guided"), modelVersion: 2 },
      { ...input(PLAN_A, "simple-fixed", "guided"), authoringMode: "automatic" },
      { ...input(PLAN_A, "simple-fixed", "guided"), clientVersion: 99 },
    ]) {
      await expectRejectedWithoutDraft(
        () => database.withTenantTransaction(TENANT_A, (tx) =>
          service.createDraftVersion(tx, invalid as never)
        ),
        RateValidationError,
        invalid.ratePlanId === PLAN_A ? PLAN_A : "not-a-uuid",
      );
    }

    await expect(database.withTenantTransaction(TENANT_B, (tx) =>
      service.listDraftVersions(tx, PROPERTY_B, PLAN_A)
    )).rejects.toBeInstanceOf(RateNotFoundError);
    expect(await database.withTenantTransaction(TENANT_B, (tx) =>
      service.listDraftVersions(tx, PROPERTY_B, PLAN_B)
    )).toEqual([]);
  });
});
