import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { SQL } from "bun";

import {
  COLLEAGUE_PROPERTY_NAME,
  COLLEAGUE_PROPERTY_PATH,
  COLLEAGUE_SCENARIO_KEY,
  provisionColleagueCurrentDateScenario,
} from "../scripts/provision-colleague-current-date";
import { provisionColleagueCommercialConfiguration } from "../scripts/provision-colleague-commercial-configuration";
import { SEED_TENANT } from "../scripts/seed";

test("current-date colleague scenario remains isolated and explicitly synthetic", () => {
  expect(COLLEAGUE_SCENARIO_KEY).toBe("yellow-colleague-current-date-v1");
  expect(COLLEAGUE_PROPERTY_PATH).toBe("yellow_demo.colleague_current");
  expect(COLLEAGUE_PROPERTY_NAME).toBe("Yellow House Mumbai");
});

const scenarioDatabaseUrl = process.env.YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL;
const databaseTest = process.env.YELLOW_REQUIRE_COLLEAGUE_SCENARIO === "1" ? test : test.skip;

databaseTest("isolated database proves exact replay and rejects a changed business date", async () => {
  if (!scenarioDatabaseUrl) throw new Error("YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL is required");
  const businessDate = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const date = `${businessDate.year}-${businessDate.month}-${businessDate.day}`;
  const first = await provisionColleagueCurrentDateScenario({ databaseUrl: scenarioDatabaseUrl, businessDate: date });
  const second = await provisionColleagueCurrentDateScenario({ databaseUrl: scenarioDatabaseUrl, businessDate: date });
  expect(second).toEqual(first);

  const sql = new SQL(scenarioDatabaseUrl, { max: 1 });
  try {
    const before = await sql<Array<{ reservations: number; events: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation WHERE property_node=${first.propertyId}::uuid) AS reservations,
        (SELECT count(*)::int FROM outbox WHERE property_node=${first.propertyId}::uuid) AS events,
        (SELECT count(*)::int FROM fact_log WHERE payload @> ${JSON.stringify({ scenario: COLLEAGUE_SCENARIO_KEY })}::text::jsonb) AS facts`;
    await expect(provisionColleagueCurrentDateScenario({ databaseUrl: scenarioDatabaseUrl, businessDate: "2099-01-01" }))
      .rejects.toThrow("collides with non-canonical data");
    const after = await sql<Array<{ reservations: number; events: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation WHERE property_node=${first.propertyId}::uuid) AS reservations,
        (SELECT count(*)::int FROM outbox WHERE property_node=${first.propertyId}::uuid) AS events,
        (SELECT count(*)::int FROM fact_log WHERE payload @> ${JSON.stringify({ scenario: COLLEAGUE_SCENARIO_KEY })}::text::jsonb) AS facts`;
    expect(after).toEqual(before);
    expect(before[0]).toEqual({ reservations: 21, events: 132, facts: 132 });
  } finally {
    await sql.close({ timeout: 0 });
  }
});

databaseTest("a disposable non-login RLS proof role cannot read the scenario from a second tenant", async () => {
  if (!scenarioDatabaseUrl) throw new Error("YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL is required");
  const businessDate = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const date = `${businessDate.year}-${businessDate.month}-${businessDate.day}`;
  const scenario = await provisionColleagueCurrentDateScenario({ databaseUrl: scenarioDatabaseUrl, businessDate: date });
  const victimTenantId = randomUUID();
  const proofRole = `colleague_rls_${randomUUID().replaceAll("-", "")}`;
  const admin = new SQL(scenarioDatabaseUrl, { max: 2, prepare: false });
  const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const quotedProofRole = quoteIdentifier(proofRole);
  const proof = new SQL(scenarioDatabaseUrl, { max: 1, prepare: false });
  try {
    await admin`INSERT INTO tenant (id, slug, name)
      VALUES (${victimTenantId}::uuid, ${`colleague-proof-${victimTenantId.slice(0, 8)}`}, 'Colleague isolation proof')`;
    await admin.unsafe(`CREATE ROLE ${quotedProofRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await admin.unsafe(`GRANT SELECT ON public.cash_drawer, public.cash_drawer_denomination TO ${quotedProofRole}`);
    await admin.unsafe(`GRANT ${quotedProofRole} TO yellow_deploy`);

    const readScenarioAs = (tenantId: string) => proof.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.unsafe(`SET LOCAL ROLE ${quotedProofRole}`);
      return tx<Array<{
        role: string; tenantId: string; drawers: number; denominations: number;
      }>>`
        SELECT current_user::text AS role,
               current_setting('app.tenant_id') AS "tenantId",
               (SELECT count(*)::int FROM cash_drawer WHERE property_node=${scenario.propertyId}::uuid) AS drawers,
               (SELECT count(*)::int
                  FROM cash_drawer_denomination denomination
                  JOIN cash_drawer drawer ON drawer.id=denomination.drawer_id
                 WHERE drawer.property_node=${scenario.propertyId}::uuid) AS denominations
      `;
    });
    const sourceVisible = await readScenarioAs(SEED_TENANT.id);
    expect(sourceVisible).toEqual([{
      role: proofRole, tenantId: SEED_TENANT.id, drawers: 1, denominations: 4,
    }]);
    const victimVisible = await readScenarioAs(victimTenantId);
    expect(victimVisible).toEqual([{
      role: proofRole, tenantId: victimTenantId, drawers: 0, denominations: 0,
    }]);
  } finally {
    await proof.close({ timeout: 0 });
    await admin.unsafe(`REVOKE SELECT ON public.cash_drawer, public.cash_drawer_denomination FROM ${quotedProofRole}`).catch(() => undefined);
    await admin.unsafe(`REVOKE ${quotedProofRole} FROM yellow_deploy`).catch(() => undefined);
    await admin.unsafe(`DROP ROLE IF EXISTS ${quotedProofRole}`).catch(() => undefined);
    await admin`DELETE FROM tenant WHERE id=${victimTenantId}::uuid`;
    const cleanup = await admin<Array<{ roles: number; tenants: number }>>`
      SELECT
        (SELECT count(*)::int FROM pg_roles WHERE rolname=${proofRole}) AS roles,
        (SELECT count(*)::int FROM tenant WHERE id=${victimTenantId}::uuid) AS tenants`;
    expect(cleanup).toEqual([{ roles: 0, tenants: 0 }]);
    await admin.close({ timeout: 0 });
  }
});

databaseTest("commercial configuration is exact and replay-safe on the existing scenario property", async () => {
  if (!scenarioDatabaseUrl) throw new Error("YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL is required");
  const scenario = await provisionColleagueCurrentDateScenario({ databaseUrl: scenarioDatabaseUrl });
  const first = await provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl });
  const second = await provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl });
  expect(second).toEqual(first);
  expect(first.propertyId).toBe(scenario.propertyId);
  const sql = new SQL(scenarioDatabaseUrl, { max: 1 });
  try {
    const rows = await sql<Array<{ plans: number; prices: number; facts: number; events: number; numeric_occ: boolean }>>`
      SELECT
        (SELECT count(*)::int FROM rate_plan WHERE property_node=${scenario.propertyId}::uuid) AS plans,
        (SELECT count(*)::int FROM rate_price rp JOIN rate_plan p ON p.id=rp.rate_plan_id AND p.tenant_id=rp.tenant_id WHERE p.property_node=${scenario.propertyId}::uuid AND rp.superseded_by IS NULL) AS prices,
        (SELECT count(*)::int FROM fact_log WHERE entity_type='rate_price' AND tenant_id=${SEED_TENANT.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_type='rate_price' AND property_node=${scenario.propertyId}::uuid) AS events,
        (SELECT bool_and(jsonb_typeof(pricing->'occ'->'1')='number') FROM rate_price rp JOIN rate_plan p ON p.id=rp.rate_plan_id AND p.tenant_id=rp.tenant_id WHERE p.property_node=${scenario.propertyId}::uuid) AS numeric_occ`;
    expect(rows).toEqual([{ plans: 4, prices: 16, facts: 16, events: 16, numeric_occ: true }]);
  } finally {
    await sql.close({ timeout: 0 });
  }
});

databaseTest("commercial replay rejects hostile policy, plan and complete-pricing drift without writing evidence", async () => {
  if (!scenarioDatabaseUrl) throw new Error("YELLOW_COLLEAGUE_SCENARIO_DATABASE_URL is required");
  const sql = new SQL(scenarioDatabaseUrl, { max: 1, prepare: false });
  const scenarioRows = await sql<Array<{ property_id: string }>>`
    SELECT id AS property_id FROM org_node
    WHERE tenant_id=${SEED_TENANT.id}::uuid AND path=${COLLEAGUE_PROPERTY_PATH}::ltree AND name=${COLLEAGUE_PROPERTY_NAME}`;
  const scenarioRow = scenarioRows[0];
  if (!scenarioRow || scenarioRows.length !== 1) throw new Error("canonical colleague scenario must be provisioned before hostile commercial replay proof");
  const scenario = { propertyId: scenarioRow.property_id };
  await provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl });
  const evidence = async () => sql<Array<{ policies: number; plans: number; prices: number; facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM policy WHERE tenant_id=${SEED_TENANT.id}::uuid) AS policies,
      (SELECT count(*)::int FROM rate_plan WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${scenario.propertyId}::uuid) AS plans,
      (SELECT count(*)::int FROM rate_price rp JOIN rate_plan plan ON plan.id=rp.rate_plan_id AND plan.tenant_id=rp.tenant_id WHERE plan.property_node=${scenario.propertyId}::uuid AND rp.superseded_by IS NULL) AS prices,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${SEED_TENANT.id}::uuid AND entity_type IN ('policy', 'rate_plan', 'rate_price')) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${scenario.propertyId}::uuid AND aggregate_type IN ('policy', 'rate_plan', 'rate_price')) AS events`;
  try {
    const before = await evidence();
    const policy = await sql<Array<{ id: string; content: unknown }>>`
      SELECT id, content FROM policy WHERE tenant_id=${SEED_TENANT.id}::uuid AND name='Demo Card Guarantee'`;
    expect(policy).toHaveLength(1);
    await sql`UPDATE policy SET content=${JSON.stringify({ kind: "guarantee", guarantee: "company_letter" })}::text::jsonb WHERE id=${policy[0]?.id}::uuid`;
    await expect(provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl })).rejects.toThrow("policy definitions are not canonical");
    expect(await evidence()).toEqual(before);
    await sql`UPDATE policy SET content=${JSON.stringify(policy[0]?.content)}::text::jsonb WHERE id=${policy[0]?.id}::uuid`;

    const policyNames = await sql<Array<{ id: string; name: string }>>`
      SELECT id, name FROM policy WHERE tenant_id=${SEED_TENANT.id}::uuid AND name LIKE 'Demo %' ORDER BY name`;
    expect(policyNames).toHaveLength(4);
    await sql`UPDATE policy SET name='Hostile ' || name WHERE id IN ${sql(policyNames.map((row) => row.id))}`;
    await expect(provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl })).rejects.toThrow("policy provenance exists");
    expect(await evidence()).toEqual(before);
    for (const row of policyNames) await sql`UPDATE policy SET name=${row.name} WHERE id=${row.id}::uuid`;

    const plan = await sql<Array<{ id: string; name: string; status: string; cancellation_policy: string | null }>>`
      SELECT id, name, status, cancellation_policy FROM rate_plan WHERE property_node=${scenario.propertyId}::uuid AND code='FLEX'`;
    expect(plan).toHaveLength(1);
    await sql`UPDATE rate_plan SET name='Hostile Flex', status='inactive', cancellation_policy=NULL WHERE id=${plan[0]?.id}::uuid`;
    await expect(provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl })).rejects.toThrow("rate plans are not canonical");
    expect(await evidence()).toEqual(before);
    await sql`UPDATE rate_plan SET name=${plan[0]?.name}, status=${plan[0]?.status}, cancellation_policy=${plan[0]?.cancellation_policy}::uuid WHERE id=${plan[0]?.id}::uuid`;

    const price = await sql<Array<{ id: string; pricing: unknown }>>`
      SELECT rp.id, rp.pricing FROM rate_price rp JOIN rate_plan plan ON plan.id=rp.rate_plan_id AND plan.tenant_id=rp.tenant_id
      JOIN unit_type unit_type ON unit_type.id=rp.unit_type_id AND unit_type.tenant_id=rp.tenant_id
      WHERE plan.property_node=${scenario.propertyId}::uuid AND plan.code='BAR' AND unit_type.code='COSY' AND rp.superseded_by IS NULL`;
    expect(price).toHaveLength(1);
    await sql`UPDATE rate_price SET pricing=${JSON.stringify({ occ: { "1": 760000, "2": 760000, "3": 760000 } })}::text::jsonb WHERE id=${price[0]?.id}::uuid`;
    await expect(provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl })).rejects.toThrow("rate prices are not canonical");
    expect(await evidence()).toEqual(before);
    await sql`UPDATE rate_price SET pricing=${JSON.stringify(price[0]?.pricing)}::text::jsonb WHERE id=${price[0]?.id}::uuid`;

    await sql`UPDATE rate_price SET pricing=${JSON.stringify({ occ: { "1": 760000, "2": 760000 }, extra_adult: null })}::text::jsonb WHERE id=${price[0]?.id}::uuid`;
    await expect(provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl })).rejects.toThrow("rate prices are not canonical");
    expect(await evidence()).toEqual(before);
    await sql`UPDATE rate_price SET pricing=${JSON.stringify(price[0]?.pricing)}::text::jsonb WHERE id=${price[0]?.id}::uuid`;
    expect(await provisionColleagueCommercialConfiguration({ databaseUrl: scenarioDatabaseUrl })).toEqual({ propertyId: scenario.propertyId, plans: 4, prices: 16 });
  } finally {
    await sql.close({ timeout: 0 });
  }
});

test("scenario source uses occupancy, audit events and an atomic guarded replay", async () => {
  const source = await Bun.file("scripts/provision-colleague-current-date.ts").text();
  expect(source).toContain("record_occupancy");
  expect(source).toContain("pg_advisory_xact_lock");
  expect(source).toContain("auditScenarioWrite");
  expect(source).toContain('eventType: "unit_type.created"');
  expect(source).toContain('eventType: "space.created"');
  expect(source).toContain('eventType: "sellable_unit.created"');
  expect(source).toContain('eventType: "ooo.opened"');
  expect(source).toContain('eventType: "occupancy.recorded"');
  expect(source).toContain("aggregateId: occupancyId");
  expect(source).toContain("aggregateId: oooOccupancyId");
  expect(source).toContain("business_date: businessDate");
  expect(source).toContain("existing cardinality is not canonical");
  expect(source).toContain("BEGIN");
  expect(source).toContain("ROLLBACK");
  expect(source).toContain("contact_free: true");
  expect(source).not.toContain("contact_point");
  expect(source).not.toContain("payment_instrument");
});

test("commercial extension uses the governed configuration and price services", async () => {
  const source = await Bun.file("scripts/provision-colleague-commercial-configuration.ts").text();
  expect(source).toContain("RateConfigurationService");
  expect(source).toContain("RatePricingService");
  expect(source).toContain("PostgresEventBus");
  expect(source).toContain('"rate_plan.created"');
  expect(source).toContain('"rate_price.created"');
  expect(source).toContain("withTenantTransaction");
  expect(source).toContain("contact_free");
  expect(source).not.toContain("INSERT INTO rate_price");
  expect(source).not.toContain("UPDATE rate_price");
  expect(source).not.toContain("payment_instrument");
});
