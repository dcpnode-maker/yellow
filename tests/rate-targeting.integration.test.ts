import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RATE_PLAN_TARGET_EXTENSION_SCHEMA,
  RATE_TARGET_COMMERCIAL_KEYS,
  RateNotFoundError,
  RateTargetService,
  RateValidationError,
  resolveRateTargetRules,
  type RateTargetCommercial,
  type RateTargetContext,
  type RateTargetDraft,
  type RateTargetPhysical,
  type RateTargetRule,
} from "../src/contexts/rates";
import { createAuditEnvelope, Database, ExtensionRegistry } from "../src/kernel";
import {
  LAUNCH_EXTENSIONS,
  LAUNCH_EXTENSION_TYPES,
  runSeed,
  SEED_PROPERTY,
  SEED_TENANT,
  SeedError,
} from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_RATE_TARGETING_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RATE_TARGETING === "1";
const TENANT_A = SEED_TENANT.id;
const PROPERTY_A = SEED_PROPERTY.id;
const TENANT_B = "00000000-0000-0000-0000-000000006602";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000006612";
const PROPERTY_B = "00000000-0000-0000-0000-000000006622";
const ACTOR_A = "00000000-0000-0000-0000-000000006660";
const ACTOR_B = "00000000-0000-0000-0000-000000006661";
const PLAN_A = "00000000-0000-0000-0000-000000006601";
const PLAN_CONCURRENT = "00000000-0000-0000-0000-000000006603";
const PLAN_A2 = "00000000-0000-0000-0000-000000006604";
const PLAN_B = "00000000-0000-0000-0000-000000006605";
const UNIT_A1 = "00000000-0000-0000-0000-000000006631";
const UNIT_A2 = "00000000-0000-0000-0000-000000006632";
const UNIT_A3 = "00000000-0000-0000-0000-000000006633";
const UNIT_A_OTHER_PROPERTY = "00000000-0000-0000-0000-000000006634";
const UNIT_B = "00000000-0000-0000-0000-000000006635";
const SELLABLE_A1 = "00000000-0000-0000-0000-000000006641";
const SELLABLE_A2 = "00000000-0000-0000-0000-000000006642";
const SELLABLE_A_INACTIVE = "00000000-0000-0000-0000-000000006643";
const SELLABLE_A_OTHER_PROPERTY = "00000000-0000-0000-0000-000000006644";
const SELLABLE_B = "00000000-0000-0000-0000-000000006645";
const COMPANY_A = "00000000-0000-0000-0000-000000006671";
const AGENT_A = "00000000-0000-0000-0000-000000006672";
const SOURCE_A = "00000000-0000-0000-0000-000000006673";
const INACTIVE_COMPANY_A = "00000000-0000-0000-0000-000000006674";
const COMPANY_B = "00000000-0000-0000-0000-000000006675";

const ALL_COMMERCIAL: RateTargetCommercial = Object.freeze({
  companyPartyId: COMPANY_A,
  marketGroupCode: "LEISURE",
  marketCode: "RETAIL",
  sourcePartyId: SOURCE_A,
  sourceCode: "WEB",
  channelCode: "direct",
  segmentCode: "TRANSIENT",
  agentPartyId: AGENT_A,
  campaignCode: "SUMMER26",
});

const CONTEXT: RateTargetContext = Object.freeze({
  propertyNode: PROPERTY_A,
  unitTypeId: UNIT_A1,
  sellableUnitId: SELLABLE_A1,
  commercial: ALL_COMMERCIAL,
});

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RATE_TARGETING_URL is required by the Order 066 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let platformPool: SQL;
let database: Database;
let service: RateTargetService;
let referenceDraft: RateTargetDraft | undefined;

function envelope(
  tenantId: string = TENANT_A,
  propertyNode: string = PROPERTY_A,
  actorId: string = ACTOR_A,
) {
  return createAuditEnvelope({
    tenantId,
    propertyNode,
    actorId,
    requestId: crypto.randomUUID(),
    operation: "rate_plan_target.drafted",
  });
}

function targetRule(
  key: string,
  physical: RateTargetPhysical = { kind: "property" },
  commercial: RateTargetCommercial = {},
  effect: "include" | "exclude" = "include",
  priority = 0,
): RateTargetRule {
  return { key, effect, priority, physical, commercial };
}

function draftInput(
  ratePlanId: string,
  rules: readonly RateTargetRule[],
  authoringMode: "guided" | "expert" | "ai" = "expert",
) {
  return {
    ratePlanId,
    authoringMode,
    rules,
    envelope: envelope(),
  } as const;
}

function commercialSubset(mask: number): RateTargetCommercial {
  return Object.fromEntries(RATE_TARGET_COMMERCIAL_KEYS.flatMap((key, index) =>
    (mask & (1 << index)) === 0 ? [] : [[key, ALL_COMMERCIAL[key]]]
  )) as RateTargetCommercial;
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length < 2) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [value, ...tail])
  );
}

async function artifactCounts(ratePlanId: string): Promise<{
  rows: number;
  facts: number;
  events: number;
}> {
  const key = `rate-plan:${ratePlanId}`;
  const rows = await admin<Array<{ rows: number; facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM extension
        WHERE tenant_id = ${TENANT_A}::uuid AND type = 'rate_plan_target' AND key = ${key}) AS rows,
      (SELECT count(*)::int FROM fact_log
        WHERE tenant_id = ${TENANT_A}::uuid
          AND fact_type = 'rate_plan_target.drafted'
          AND payload->>'rate_plan_id' = ${ratePlanId}) AS facts,
      (SELECT count(*)::int FROM outbox
        WHERE tenant_id = ${TENANT_A}::uuid
          AND payload->>'rate_plan_id' = ${ratePlanId}) AS events
  `;
  return rows[0] ?? { rows: -1, facts: -1, events: -1 };
}

async function expectRejectedWithoutTarget(
  operation: () => Promise<unknown>,
  errorClass: typeof RateValidationError | typeof RateNotFoundError,
  ratePlanId = PLAN_A,
): Promise<void> {
  const before = await artifactCounts(ratePlanId);
  await expect(operation()).rejects.toBeInstanceOf(errorClass);
  expect(await artifactCounts(ratePlanId)).toEqual(before);
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  await runSeed({ databaseUrl: DATABASE_URL, logger: () => undefined });
  admin = new SQL(DATABASE_URL, { max: 6 });
  platformPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 30 });
  service = new RateTargetService(new ExtensionRegistry(platformPool));

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT_B}::uuid, 'order066-b', 'Order 066 Tenant B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'yellow_demo.order066_a2', 'property', 'Order 066 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order066_b.property', 'property', 'Order 066 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status)
    VALUES
      (${PLAN_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O66-MAIN', 'Order 066 Main', 'USD', 'active'),
      (${PLAN_CONCURRENT}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O66-RACE', 'Order 066 Race', 'USD', 'active'),
      (${PLAN_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O66-A2', 'Order 066 A2', 'USD', 'active'),
      (${PLAN_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O66-B', 'Order 066 B', 'USD', 'active')
  `;
  await admin`
    INSERT INTO unit_type (
      id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy
    ) VALUES
      (${UNIT_A1}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O66-A1', 'Order 066 A1', 'hotel', 2, 2),
      (${UNIT_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O66-A2', 'Order 066 A2', 'hotel', 2, 3),
      (${UNIT_A3}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O66-A3', 'Order 066 A3', 'hotel', 1, 1),
      (${UNIT_A_OTHER_PROPERTY}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O66-OTHER', 'Order 066 Other', 'hotel', 2, 2),
      (${UNIT_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O66-B', 'Order 066 B', 'hotel', 2, 2)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status)
    VALUES
      (${SELLABLE_A1}::uuid, ${TENANT_A}::uuid, ${UNIT_A1}::uuid, 'Order 066 A1', 'active'),
      (${SELLABLE_A2}::uuid, ${TENANT_A}::uuid, ${UNIT_A2}::uuid, 'Order 066 A2', 'active'),
      (${SELLABLE_A_INACTIVE}::uuid, ${TENANT_A}::uuid, ${UNIT_A1}::uuid, 'Order 066 Inactive', 'inactive'),
      (${SELLABLE_A_OTHER_PROPERTY}::uuid, ${TENANT_A}::uuid, ${UNIT_A_OTHER_PROPERTY}::uuid, 'Order 066 Other', 'active'),
      (${SELLABLE_B}::uuid, ${TENANT_B}::uuid, ${UNIT_B}::uuid, 'Order 066 B', 'active')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES
      (${COMPANY_A}::uuid, ${TENANT_A}::uuid, 'org', 'Order 066 Company A', 'active'),
      (${AGENT_A}::uuid, ${TENANT_A}::uuid, 'org', 'Order 066 Agent A', 'active'),
      (${SOURCE_A}::uuid, ${TENANT_A}::uuid, 'org', 'Order 066 Source A', 'active'),
      (${INACTIVE_COMPANY_A}::uuid, ${TENANT_A}::uuid, 'org', 'Order 066 Inactive Company', 'merged'),
      (${COMPANY_B}::uuid, ${TENANT_B}::uuid, 'org', 'Order 066 Company B', 'active')
  `;
  await admin`
    INSERT INTO party_role (tenant_id, party_id, role)
    VALUES
      (${TENANT_A}::uuid, ${COMPANY_A}::uuid, 'company'),
      (${TENANT_A}::uuid, ${AGENT_A}::uuid, 'agent'),
      (${TENANT_A}::uuid, ${SOURCE_A}::uuid, 'source'),
      (${TENANT_A}::uuid, ${INACTIVE_COMPANY_A}::uuid, 'company'),
      (${TENANT_B}::uuid, ${COMPANY_B}::uuid, 'company')
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await admin`DELETE FROM fact_log WHERE fact_type = 'rate_plan_target.drafted'`;
  await admin`DELETE FROM extension WHERE type = 'rate_plan_target'`;
  await admin`DELETE FROM party_role WHERE party_id IN (
    ${COMPANY_A}::uuid, ${AGENT_A}::uuid, ${SOURCE_A}::uuid,
    ${INACTIVE_COMPANY_A}::uuid, ${COMPANY_B}::uuid
  )`;
  await admin`DELETE FROM party WHERE id IN (
    ${COMPANY_A}::uuid, ${AGENT_A}::uuid, ${SOURCE_A}::uuid,
    ${INACTIVE_COMPANY_A}::uuid, ${COMPANY_B}::uuid
  )`;
  await admin`DELETE FROM sellable_unit WHERE id IN (
    ${SELLABLE_A1}::uuid, ${SELLABLE_A2}::uuid, ${SELLABLE_A_INACTIVE}::uuid,
    ${SELLABLE_A_OTHER_PROPERTY}::uuid, ${SELLABLE_B}::uuid
  )`;
  await admin`DELETE FROM unit_type WHERE id IN (
    ${UNIT_A1}::uuid, ${UNIT_A2}::uuid, ${UNIT_A3}::uuid,
    ${UNIT_A_OTHER_PROPERTY}::uuid, ${UNIT_B}::uuid
  )`;
  await admin`DELETE FROM rate_plan WHERE id IN (
    ${PLAN_A}::uuid, ${PLAN_CONCURRENT}::uuid, ${PLAN_A2}::uuid, ${PLAN_B}::uuid
  )`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin.close();
  await platformPool.close();
  await database.close();
});

describe("Order 066 deterministic targeting resolver", () => {
  test("P5: every physical rank and commercial subset follows documented precedence", () => {
    const physicalRules = [
      targetRule("property", { kind: "property" }, {}, "exclude", 1000),
      targetRule("class", { kind: "class", classCode: "PREMIUM", unitTypeIds: [UNIT_A1, UNIT_A2] }, {}, "exclude", 900),
      targetRule("unit", { kind: "unit_type", unitTypeId: UNIT_A1 }, {}, "exclude", 800),
      targetRule("sellable", { kind: "sellable", sellableUnitId: SELLABLE_A1 }, {}, "include", 0),
    ] as const;
    for (const ordered of permutations(physicalRules)) {
      expect(resolveRateTargetRules(ordered, CONTEXT, PROPERTY_A)).toEqual({
        state: "included",
        winningRuleKey: "sellable",
        matchedRuleKeys: ["sellable", "unit", "class", "property"],
        conflictingRuleKeys: [],
      });
    }

    for (let mask = 1; mask < (1 << RATE_TARGET_COMMERCIAL_KEYS.length); mask += 1) {
      const removedBit = mask & -mask;
      const narrower = targetRule("narrower", { kind: "property" }, commercialSubset(mask));
      const broader = targetRule("broader", { kind: "property" }, commercialSubset(mask ^ removedBit), "exclude", 1000);
      expect(resolveRateTargetRules([broader, narrower], CONTEXT, PROPERTY_A).winningRuleKey).toBe("narrower");
    }

    const tied = resolveRateTargetRules([
      targetRule("company", { kind: "property" }, { companyPartyId: COMPANY_A }),
      targetRule("channel", { kind: "property" }, { channelCode: "direct" }),
    ], CONTEXT, PROPERTY_A);
    expect(tied).toEqual({
      state: "conflict",
      winningRuleKey: null,
      matchedRuleKeys: ["channel", "company"],
      conflictingRuleKeys: ["channel", "company"],
    });
    expect(resolveRateTargetRules([
      targetRule("company", { kind: "property" }, { companyPartyId: COMPANY_A }, "exclude", 8),
      targetRule("channel", { kind: "property" }, { channelCode: "direct" }, "include", 9),
    ], CONTEXT, PROPERTY_A).winningRuleKey).toBe("channel");
    expect(resolveRateTargetRules([
      targetRule("excluded", { kind: "property" }, { marketCode: "RETAIL" }, "exclude"),
    ], CONTEXT, PROPERTY_A).state).toBe("excluded");
    expect(resolveRateTargetRules([
      targetRule("needs-company", { kind: "property" }, { companyPartyId: COMPANY_A }),
    ], { ...CONTEXT, commercial: {} }, PROPERTY_A).state).toBe("not_applicable");
    expect(() => resolveRateTargetRules(
      [targetRule("property")],
      { ...CONTEXT, propertyNode: PROPERTY_A2 },
      PROPERTY_A,
    )).toThrow(RateValidationError);
  });
});

databaseDescribe("Order 066 immutable targeting drafts", () => {
  test("P1: launch seed adds one exact type, replays, and rejects divergent schema atomically", async () => {
    const type = LAUNCH_EXTENSION_TYPES.find(({ type }) => type === "rate_plan_target");
    expect(type?.jsonSchema).toEqual(RATE_PLAN_TARGET_EXTENSION_SCHEMA);
    expect(LAUNCH_EXTENSION_TYPES).toHaveLength(10);
    expect(LAUNCH_EXTENSIONS).toHaveLength(40);
    expect((await admin`SELECT type FROM extension_type WHERE type = 'rate_plan_target'`)).toHaveLength(1);
    const beforeFacts = Number((await admin`SELECT count(*)::int AS count FROM fact_log`)[0]?.count);
    expect((await runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined })).registry).toBe("already exact");
    expect(Number((await admin`SELECT count(*)::int AS count FROM fact_log`)[0]?.count)).toBe(beforeFacts);

    await admin`
      UPDATE extension_type
      SET json_schema = jsonb_set(json_schema, '{title}', '"Divergent"'::jsonb)
      WHERE type = 'rate_plan_target'
    `;
    await expect(runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined })).rejects.toBeInstanceOf(SeedError);
    expect(Number((await admin`SELECT count(*)::int AS count FROM fact_log`)[0]?.count)).toBe(beforeFacts);
    await admin`
      UPDATE extension_type
      SET json_schema = ${JSON.stringify(RATE_PLAN_TARGET_EXTENSION_SCHEMA)}::text::jsonb
      WHERE type = 'rate_plan_target'
    `;
    expect((await runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined })).registry).toBe("already exact");
  }, 30_000);

  test("P2: all authoring modes normalize one strict canonical rule envelope", async () => {
    const sourceRules = [
      targetRule("z-unit", { kind: "unit_type", unitTypeId: UNIT_A3 }, { marketCode: "RETAIL" }),
      targetRule("a-class", {
        kind: "class",
        classCode: "PREMIUM",
        unitTypeIds: [UNIT_A2, UNIT_A1],
      }, { channelCode: "direct", companyPartyId: COMPANY_A }),
    ];
    const drafts: RateTargetDraft[] = [];
    for (const mode of ["guided", "expert", "ai"] as const) {
      drafts.push(await database.withTenantTransaction(TENANT_A, (tx) =>
        service.createDraftVersion(tx, draftInput(PLAN_A, sourceRules, mode))
      ));
    }
    expect(drafts.map(({ authoringMode }) => authoringMode)).toEqual(["guided", "expert", "ai"]);
    expect(drafts.every(({ rules }) => rules.map(({ key }) => key).join(",") === "a-class,z-unit")).toBeTrue();
    expect((drafts[0]?.rules[0]?.physical as { unitTypeIds: readonly string[] }).unitTypeIds).toEqual([UNIT_A1, UNIT_A2]);
    expect(drafts.map(({ rules }) => rules).every((rules) =>
      JSON.stringify(rules) === JSON.stringify(drafts[0]?.rules)
    )).toBeTrue();

    const valid = draftInput(PLAN_A, [targetRule("valid")]);
    const invalidInputs: unknown[] = [
      { ...valid, rules: [] },
      { ...valid, rules: Array.from({ length: 201 }, (_, index) => targetRule(`r-${index}`)) },
      { ...valid, rules: [targetRule("same"), targetRule("same")] },
      { ...valid, rules: [{ ...targetRule("UPPER"), key: "UPPER" }] },
      { ...valid, rules: [{ ...targetRule("bad-priority"), priority: -1 }] },
      { ...valid, rules: [{ ...targetRule("bad-priority"), priority: 1001 }] },
      { ...valid, rules: [{ ...targetRule("bad-priority"), priority: 1.5 }] },
      { ...valid, rules: [{ ...targetRule("bad-effect"), effect: "prefer" }] },
      { ...valid, rules: [targetRule("empty-class", { kind: "class", classCode: "PREMIUM", unitTypeIds: [] })] },
      { ...valid, rules: [targetRule("duplicate-class", { kind: "class", classCode: "PREMIUM", unitTypeIds: [UNIT_A1, UNIT_A1] })] },
      { ...valid, rules: [targetRule("large-class", {
        kind: "class",
        classCode: "PREMIUM",
        unitTypeIds: Array.from({ length: 101 }, () => crypto.randomUUID()),
      })] },
      { ...valid, rules: [
        targetRule("class-one", { kind: "class", classCode: "PREMIUM", unitTypeIds: [UNIT_A1] }),
        targetRule("class-two", { kind: "class", classCode: "PREMIUM", unitTypeIds: [UNIT_A2] }),
      ] },
      { ...valid, rules: [targetRule("bad-class", { kind: "class", classCode: "lower", unitTypeIds: [UNIT_A1] })] },
      { ...valid, rules: [{ ...targetRule("physical-extra"), physical: { kind: "property", unitTypeId: UNIT_A1 } }] },
      { ...valid, rules: [{ ...targetRule("commercial-extra"), commercial: { unknown: "X" } }] },
      { ...valid, rules: [targetRule("bad-code", { kind: "property" }, { marketCode: "retail" })] },
      { ...valid, rules: [targetRule("bad-channel", { kind: "property" }, { channelCode: "Direct" })] },
      { ...valid, clientVersion: 9 },
    ];
    for (const invalid of invalidInputs) {
      await expectRejectedWithoutTarget(
        () => database.withTenantTransaction(TENANT_A, (tx) =>
          service.createDraftVersion(tx, invalid as never)
        ),
        RateValidationError,
      );
    }
  });

  test("P3: every physical and party-role reference is exact and tenant-owned", async () => {
    referenceDraft = await database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(tx, draftInput(
      PLAN_A,
      [
        targetRule("property"),
        targetRule("class", { kind: "class", classCode: "PREMIUM", unitTypeIds: [UNIT_A1, UNIT_A2] }),
        targetRule("unit", { kind: "unit_type", unitTypeId: UNIT_A1 }),
        targetRule("sellable", { kind: "sellable", sellableUnitId: SELLABLE_A1 }, ALL_COMMERCIAL),
      ],
    )));
    expect(referenceDraft.rules).toHaveLength(4);

    for (const physical of [
      { kind: "unit_type", unitTypeId: UNIT_A_OTHER_PROPERTY },
      { kind: "unit_type", unitTypeId: UNIT_B },
      { kind: "sellable", sellableUnitId: SELLABLE_A_INACTIVE },
      { kind: "sellable", sellableUnitId: SELLABLE_A_OTHER_PROPERTY },
      { kind: "sellable", sellableUnitId: SELLABLE_B },
      { kind: "class", classCode: "BAD", unitTypeIds: [UNIT_A1, UNIT_A_OTHER_PROPERTY] },
    ] as const) {
      await expectRejectedWithoutTarget(
        () => database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(
          tx,
          draftInput(PLAN_A, [targetRule("bad-physical", physical as RateTargetPhysical)]),
        )),
        RateNotFoundError,
      );
    }
    for (const commercial of [
      { companyPartyId: AGENT_A },
      { agentPartyId: COMPANY_A },
      { sourcePartyId: COMPANY_A },
      { companyPartyId: INACTIVE_COMPANY_A },
      { companyPartyId: COMPANY_B },
    ] as const) {
      await expectRejectedWithoutTarget(
        () => database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(
          tx,
          draftInput(PLAN_A, [targetRule("bad-party", { kind: "property" }, commercial)]),
        )),
        RateNotFoundError,
      );
    }
  });

  test("P4: concurrent versions and exact facts are gapless, immutable and event-free", async () => {
    const beforeOutbox = Number((await admin`SELECT count(*)::int AS count FROM outbox`)[0]?.count);
    const drafts = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(
        tx,
        draftInput(PLAN_CONCURRENT, [targetRule("default", { kind: "property" }, {}, index % 2 ? "include" : "exclude")]),
      ))
    ));
    expect(drafts.map(({ extensionVersion }) => extensionVersion).sort((left, right) => left - right)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(await artifactCounts(PLAN_CONCURRENT)).toEqual({ rows: 20, facts: 20, events: 0 });
    expect(Number((await admin`SELECT count(*)::int AS count FROM outbox`)[0]?.count)).toBe(beforeOutbox);
    const rows = await admin<Array<{ id: string; version: number; bytes: string }>>`
      SELECT id, version, content::text AS bytes
      FROM extension
      WHERE tenant_id = ${TENANT_A}::uuid AND type = 'rate_plan_target'
        AND key = ${`rate-plan:${PLAN_CONCURRENT}`}
      ORDER BY version
    `;
    const facts = await admin<Array<{
      version: number;
      rule_count: string;
      payload_version: string;
      rate_plan_id: string;
    }>>`
      SELECT extension.version, fact.payload->>'rule_count' AS rule_count,
             fact.payload->>'version' AS payload_version,
             fact.payload->>'rate_plan_id' AS rate_plan_id
      FROM fact_log AS fact
      JOIN extension ON extension.id = fact.entity_id
      WHERE fact.fact_type = 'rate_plan_target.drafted'
        AND fact.payload->>'rate_plan_id' = ${PLAN_CONCURRENT}
      ORDER BY extension.version
    `;
    expect(facts).toHaveLength(20);
    expect(facts.every((fact) =>
      fact.rule_count === "1" &&
      fact.payload_version === String(fact.version) &&
      fact.rate_plan_id === PLAN_CONCURRENT
    )).toBeTrue();
    const before = rows.map(({ id, version, bytes }) => ({ id, version, bytes }));
    await database.withTenantTransaction(TENANT_A, (tx) => service.createDraftVersion(
      tx,
      draftInput(PLAN_CONCURRENT, [targetRule("default")]),
    ));
    expect((await admin<Array<{ id: string; version: number; bytes: string }>>`
      SELECT id, version, content::text AS bytes
      FROM extension
      WHERE tenant_id = ${TENANT_A}::uuid AND type = 'rate_plan_target'
        AND key = ${`rate-plan:${PLAN_CONCURRENT}`} AND version <= 20
      ORDER BY version
    `)).toEqual(before);
  }, 30_000);

  test("P6: list and resolve fail closed across tenant, property and context boundaries", async () => {
    if (!referenceDraft) throw new Error("P3 did not create the reference draft");
    const listed = await database.withTenantTransaction(TENANT_A, (tx) =>
      service.listDraftVersions(tx, PROPERTY_A, PLAN_A)
    );
    expect(listed.map(({ extensionVersion }) => extensionVersion)).toEqual(
      Array.from({ length: listed.length }, (_, index) => index + 1),
    );
    const resolved = await database.withTenantTransaction(TENANT_A, (tx) => service.resolveDraftVersion(tx, {
      propertyNode: PROPERTY_A,
      ratePlanId: PLAN_A,
      extensionVersion: referenceDraft!.extensionVersion,
      unitTypeId: UNIT_A1,
      sellableUnitId: SELLABLE_A1,
      commercial: ALL_COMMERCIAL,
    }));
    expect(resolved).toEqual({
      state: "included",
      winningRuleKey: "sellable",
      matchedRuleKeys: ["sellable", "unit", "class", "property"],
      conflictingRuleKeys: [],
    });

    await expect(database.withTenantTransaction(TENANT_B, (tx) =>
      service.listDraftVersions(tx, PROPERTY_B, PLAN_A)
    )).rejects.toBeInstanceOf(RateNotFoundError);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.resolveDraftVersion(tx, {
      propertyNode: PROPERTY_A2,
      ratePlanId: PLAN_A,
      extensionVersion: referenceDraft!.extensionVersion,
      unitTypeId: UNIT_A_OTHER_PROPERTY,
      sellableUnitId: SELLABLE_A_OTHER_PROPERTY,
      commercial: {},
    }))).rejects.toBeInstanceOf(RateNotFoundError);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.resolveDraftVersion(tx, {
      propertyNode: PROPERTY_A,
      ratePlanId: PLAN_A,
      extensionVersion: referenceDraft!.extensionVersion,
      unitTypeId: UNIT_A1,
      sellableUnitId: SELLABLE_A2,
      commercial: {},
    }))).rejects.toBeInstanceOf(RateNotFoundError);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.resolveDraftVersion(tx, {
      propertyNode: PROPERTY_A,
      ratePlanId: PLAN_A,
      extensionVersion: referenceDraft!.extensionVersion,
      unitTypeId: UNIT_A1,
      sellableUnitId: SELLABLE_A1,
      commercial: { companyPartyId: COMPANY_B },
    }))).rejects.toBeInstanceOf(RateNotFoundError);
    await expect(database.withTenantTransaction(TENANT_A, (tx) => service.resolveDraftVersion(tx, {
      propertyNode: "not-a-uuid",
      ratePlanId: PLAN_A,
      extensionVersion: referenceDraft!.extensionVersion,
      unitTypeId: UNIT_A1,
      sellableUnitId: SELLABLE_A1,
      commercial: {},
    }))).rejects.toBeInstanceOf(RateValidationError);
    expect(await database.withTenantTransaction(TENANT_B, (tx) =>
      service.listDraftVersions(tx, PROPERTY_B, PLAN_B)
    )).toEqual([]);
  });
});
