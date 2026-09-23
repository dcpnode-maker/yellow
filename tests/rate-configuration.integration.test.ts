import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  RateConfigurationService,
  RateConflictError,
  RateNotFoundError,
  RateValidationError,
  type Policy,
  type RatePlan,
} from "../src/contexts/rates";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  type EventBus,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RATE_CONFIGURATION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RATE_CONFIGURATION === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const TENANT_B = "00000000-0000-0000-0000-000000003202";
const PROPERTY_B = "00000000-0000-0000-0000-000000003212";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000003213";
const ACTOR_A = "00000000-0000-0000-0000-000000003260";
const ACTOR_B = "00000000-0000-0000-0000-000000003261";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RATE_CONFIGURATION_URL is required by the Order 032 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let eventPool: SQL;
let database: Database;
let service: RateConfigurationService;
let cancellation: Policy | undefined;
let deposit: Policy | undefined;
let guarantee: Policy | undefined;
let noShow: Policy | undefined;
let primaryPlan: RatePlan | undefined;
let foreignPolicyId: string | undefined;
const aggregateIds = new Set<string>();

function envelope(operation: "policy.created" | "rate_plan.created", propertyNode = PROPERTY_A) {
  return createAuditEnvelope({
    actorId: ACTOR_A,
    tenantId: TENANT_A,
    propertyNode,
    requestId: crypto.randomUUID(),
    operation,
  });
}

function remember<T extends { id: string }>(value: T): T {
  aggregateIds.add(value.id);
  return value;
}

async function createPolicy(
  kind: "cancellation" | "deposit" | "guarantee" | "no_show",
  name: string,
  content: Readonly<Record<string, unknown>>,
) {
  return remember(await database!.withTenantTransaction(TENANT_A, (tx) => service!.createPolicy(tx, {
    kind,
    name,
    content,
    envelope: envelope("policy.created"),
  })));
}

class FailingEventBus implements EventBus {
  async publish(_tx: Tx, _event: PublishEventInput): Promise<never> {
    throw new Error("injected publisher failure");
  }

  async consumeBatch(): Promise<never> {
    throw new Error("not used");
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 6 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });
  service = new RateConfigurationService(new PostgresEventBus(eventPool));

  await admin`DELETE FROM rate_plan WHERE code LIKE 'O32-%'`;
  await admin`DELETE FROM policy WHERE name LIKE 'Order 032%'`;
  await admin`DELETE FROM outbox WHERE actor_id IN (${ACTOR_A}::uuid, ${ACTOR_B}::uuid)`;
  await admin`DELETE FROM fact_log WHERE actor_id IN (${ACTOR_A}::uuid, ${ACTOR_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT_B}::uuid, 'order032-b', 'Order 032 Tenant B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order032_property_a2', 'property', 'Order 032 Property A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order032_property_b', 'property', 'Order 032 Property B', 'UTC', 'USD')
  `;
  const rows = await admin<Array<{ id: string }>>`
    INSERT INTO policy (tenant_id, kind, name, content)
    VALUES (${TENANT_B}::uuid, 'cancellation', 'Order 032 Foreign', '{"kind":"cancellation","rules":[{"before_hours":24,"penalty":{"basis":"nights","value":1}}]}'::jsonb)
    RETURNING id
  `;
  foreignPolicyId = rows[0]?.id;
  if (!foreignPolicyId) throw new Error("Foreign policy fixture was not created");
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  const ids = [...aggregateIds];
  if (ids.length > 0) {
    await admin`DELETE FROM outbox WHERE aggregate_id IN ${admin(ids)}`;
    await admin`DELETE FROM fact_log WHERE entity_id IN ${admin(ids)}`;
  }
  await admin`DELETE FROM rate_plan WHERE code LIKE 'O32-%'`;
  await admin`DELETE FROM policy WHERE name LIKE 'Order 032%'`;
  await admin`DELETE FROM outbox WHERE actor_id IN (${ACTOR_A}::uuid, ${ACTOR_B}::uuid)`;
  await admin`DELETE FROM fact_log WHERE actor_id IN (${ACTOR_A}::uuid, ${ACTOR_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A2}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id = ${TENANT_B}::uuid`;
  await admin.close();
  await eventPool.close();
  await database.close();
});

databaseDescribe("Order 032 audited policy and base rate-plan configuration", () => {
  test("P1: four strict non-fixed policy kinds round-trip with one fact and event each", async () => {
    cancellation = await createPolicy("cancellation", "Order 032 Flexible", {
      kind: "cancellation",
      rules: [
        { before_hours: 48, penalty: { basis: "percent", value: 25 } },
        { before_hours: 0, penalty: { basis: "nights", value: 1 } },
      ],
    });
    deposit = await createPolicy("deposit", "Order 032 Deposit", {
      kind: "deposit",
      deposit: { basis: "percent", value: 30, due: "days_before_arrival", days_before: 7 },
    });
    guarantee = await createPolicy("guarantee", "Order 032 Guarantee", {
      kind: "guarantee",
      guarantee: "card_on_file",
    });
    noShow = await createPolicy("no_show", "Order 032 No Show", {
      kind: "no_show",
      no_show_charge: { basis: "first_night", value: 1 },
    });

    const policies = [cancellation, deposit, guarantee, noShow];
    for (const policy of policies) {
      expect(policy.content).toBeObject();
      expect(policy.content.kind).toBe(policy.kind);
      const reread = await database!.withTenantTransaction(TENANT_A, (tx) => service!.getPolicy(tx, policy.id));
      expect(reread).toEqual(policy);
    }
    const policyIds = policies.map(({ id }) => id);
    const facts = await admin<Array<{ aggregate_id: string; count: number }>>`
      SELECT entity_id AS aggregate_id, count(*)::int AS count
      FROM fact_log
      WHERE entity_id IN ${admin(policyIds)}
      GROUP BY entity_id
      ORDER BY entity_id
    `;
    const events = await admin<Array<{ aggregate_id: string; count: number; event_type: string; kind: string }>>`
      SELECT aggregate_id, count(*)::int AS count, min(event_type) AS event_type,
             min(payload->>'kind') AS kind
      FROM outbox WHERE aggregate_id IN ${admin(policyIds)}
      GROUP BY aggregate_id
      ORDER BY aggregate_id
    `;
    expect(facts).toHaveLength(4);
    expect(events).toHaveLength(4);
    expect(facts.every(({ count }) => count === 1)).toBeTrue();
    expect(events.every(({ count }) => count === 1)).toBeTrue();
    const eventTypes = events.map(({ event_type, kind }) => ({ event_type, kind })).sort((a, b) => a.kind.localeCompare(b.kind));
    expect(eventTypes).toEqual([
      { event_type: "policy.created", kind: "cancellation" },
      { event_type: "policy.created", kind: "deposit" },
      { event_type: "policy.created", kind: "guarantee" },
      { event_type: "policy.created", kind: "no_show" },
    ]);
  });

  test("P2: base plan validates three exact policy kinds and reads in code order", async () => {
    if (!cancellation || !deposit || !guarantee) throw new Error("P1 policy fixtures are absent");
    const second = remember(await database!.withTenantTransaction(TENANT_A, (tx) => service!.createRatePlan(tx, {
      code: "O32-ZULU",
      name: "Order 032 Zulu",
      currency: "USD",
      envelope: envelope("rate_plan.created"),
    })));
    const cancellationPolicy = cancellation;
    const depositPolicy = deposit;
    const guaranteePolicy = guarantee;
    primaryPlan = remember(await database.withTenantTransaction(TENANT_A, (tx) => service.createRatePlan(tx, {
      code: "O32-FLEX",
      name: "Order 032 Flexible Rate",
      currency: "USD",
      taxInclusive: false,
      cancellationPolicyId: cancellationPolicy.id,
      depositPolicyId: depositPolicy.id,
      guaranteePolicyId: guaranteePolicy.id,
      marketCode: "LEISURE",
      sourceCode: "DIRECT",
      envelope: envelope("rate_plan.created"),
    })));
    expect(primaryPlan).toMatchObject({
      cancellationPolicyId: cancellationPolicy.id,
      depositPolicyId: depositPolicy.id,
      guaranteePolicyId: guaranteePolicy.id,
      parentPlanId: null,
      derivation: null,
    });
    const listed = await database!.withTenantTransaction(TENANT_A, (tx) => service!.listRatePlans(tx, PROPERTY_A));
    expect(listed.filter(({ code }) => code.startsWith("O32-")).map(({ id }) => id)).toEqual([primaryPlan.id, second.id]);
    const evidence = await admin<Array<{ facts: number; events: number; event_type: string }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE entity_id = ${primaryPlan.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_id = ${primaryPlan.id}::uuid) AS events,
        (SELECT event_type FROM outbox WHERE aggregate_id = ${primaryPlan.id}::uuid) AS event_type
    `;
    expect(evidence[0]).toEqual({ facts: 1, events: 1, event_type: "rate_plan.created" });
  });

  test("P3: malformed and money-ambiguous inputs fail without artifacts", async () => {
    const before = await admin<Array<{ policies: number; plans: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM policy WHERE name LIKE 'Order 032 Invalid%') AS policies,
        (SELECT count(*)::int FROM rate_plan WHERE code LIKE 'O32-INVALID%') AS plans,
        (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR_A}::uuid) AS events
    `;
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createPolicy(tx, {
      kind: "deposit",
      name: "Order 032 Invalid Mismatch",
      content: { kind: "guarantee", guarantee: "none" },
      envelope: envelope("policy.created"),
    }))).rejects.toBeInstanceOf(RateValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createPolicy(tx, {
      kind: "cancellation",
      name: "Order 032 Invalid Fixed",
      content: { kind: "cancellation", rules: [{ before_hours: 0, penalty: { basis: "fixed", value: 1.5 } }] },
      envelope: envelope("policy.created"),
    }))).rejects.toBeInstanceOf(RateValidationError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createPolicy(tx, {
      kind: "early_departure" as never,
      name: "Order 032 Invalid Early",
      content: { kind: "early_departure" },
      envelope: envelope("policy.created"),
    }))).rejects.toBeInstanceOf(RateValidationError);
    for (const [code, name, currency] of [
      ["o32-invalid", "Order 032 Invalid Code", "USD"],
      ["O32-INVALID-NAME", " bad ", "USD"],
      ["O32-INVALID-CURRENCY", "Order 032 Invalid Currency", "usd"],
    ] as const) {
      await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createRatePlan(tx, {
        code, name, currency, envelope: envelope("rate_plan.created"),
      }))).rejects.toBeInstanceOf(RateValidationError);
    }
    const after = await admin<Array<{ policies: number; plans: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM policy WHERE name LIKE 'Order 032 Invalid%') AS policies,
        (SELECT count(*)::int FROM rate_plan WHERE code LIKE 'O32-INVALID%') AS plans,
        (SELECT count(*)::int FROM fact_log WHERE actor_id = ${ACTOR_A}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE actor_id = ${ACTOR_A}::uuid) AS events
    `;
    expect(after[0]).toEqual(before[0]);
  });

  test("P4: wrong-kind, foreign-tenant policy, and foreign property are rejected", async () => {
    if (!guarantee || !foreignPolicyId) throw new Error("Reference fixtures are absent");
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createRatePlan(tx, {
      code: "O32-WRONG-KIND",
      name: "Order 032 Wrong Kind",
      currency: "USD",
      cancellationPolicyId: guarantee!.id,
      envelope: envelope("rate_plan.created"),
    }))).rejects.toBeInstanceOf(RateNotFoundError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createRatePlan(tx, {
      code: "O32-FOREIGN-POLICY",
      name: "Order 032 Foreign Policy",
      currency: "USD",
      cancellationPolicyId: foreignPolicyId!,
      envelope: envelope("rate_plan.created"),
    }))).rejects.toBeInstanceOf(RateNotFoundError);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createRatePlan(tx, {
      code: "O32-FOREIGN-PROPERTY",
      name: "Order 032 Foreign Property",
      currency: "USD",
      envelope: envelope("rate_plan.created", PROPERTY_B),
    }))).rejects.toBeInstanceOf(RateNotFoundError);
  });

  test("P5: duplicate code and publisher failure roll back all artifacts", async () => {
    if (!primaryPlan) throw new Error("P2 plan fixture is absent");
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.createRatePlan(tx, {
      code: primaryPlan!.code,
      name: "Order 032 Duplicate",
      currency: "USD",
      envelope: envelope("rate_plan.created"),
    }))).rejects.toBeInstanceOf(RateConflictError);

    const failing = new RateConfigurationService(new FailingEventBus());
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => failing.createRatePlan(tx, {
      code: "O32-PUBLISH-FAIL",
      name: "Order 032 Publish Failure",
      currency: "USD",
      envelope: envelope("rate_plan.created"),
    }))).rejects.toThrow("injected publisher failure");
    const artifacts = await admin<Array<{ plans: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM rate_plan WHERE code = 'O32-PUBLISH-FAIL') AS plans,
        (SELECT count(*)::int FROM fact_log WHERE payload @> '{"code":"O32-PUBLISH-FAIL"}'::jsonb) AS facts,
        (SELECT count(*)::int FROM outbox WHERE payload @> '{"code":"O32-PUBLISH-FAIL"}'::jsonb) AS events
    `;
    expect(artifacts[0]).toEqual({ plans: 0, facts: 0, events: 0 });
  });

  test("P6: tenant and property reads remain isolated while policies stay tenant-wide", async () => {
    if (!cancellation || !primaryPlan) throw new Error("Canonical fixtures are absent");
    const tenantB = await database!.withTenantTransaction(TENANT_B, async (tx) => ({
      policies: await service!.listPolicies(tx),
      plans: await service!.listRatePlans(tx, PROPERTY_A),
    }));
    expect(tenantB.policies.some(({ id }) => id === cancellation!.id)).toBeFalse();
    expect(tenantB.plans).toEqual([]);
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.getPolicy(tx, cancellation!.id)))
      .rejects.toBeInstanceOf(RateNotFoundError);
    const otherPropertyPlans = await database!.withTenantTransaction(TENANT_A, (tx) => service!.listRatePlans(tx, PROPERTY_A2));
    expect(otherPropertyPlans.some(({ id }) => id === primaryPlan!.id)).toBeFalse();
    const tenantPolicies = await database!.withTenantTransaction(TENANT_A, (tx) => service!.listPolicies(tx));
    expect(tenantPolicies.some(({ id }) => id === cancellation!.id)).toBeTrue();
  });

  test("P7: base plans cannot smuggle derivation or create price history", async () => {
    if (!primaryPlan) throw new Error("P2 plan fixture is absent");
    const rows = await admin<Array<{ parent_plan: string | null; derivation: unknown; prices: number }>>`
      SELECT rp.parent_plan, rp.derivation,
             (SELECT count(*)::int FROM rate_price WHERE rate_plan_id = rp.id) AS prices
      FROM rate_plan AS rp WHERE rp.id = ${primaryPlan.id}::uuid
    `;
    expect(rows[0]).toEqual({ parent_plan: null, derivation: null, prices: 0 });
  });
});
