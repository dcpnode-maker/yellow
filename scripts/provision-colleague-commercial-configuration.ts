import { SQL } from "bun";

import {
  RateConfigurationService,
  RatePricingService,
  type Policy,
  type RatePlan,
  type RatePricing,
  type RatePricingInput,
} from "../src/contexts/rates";
import { createAuditEnvelope, Database, PostgresEventBus } from "../src/kernel";
import { SEED_TENANT } from "./seed";
import { COLLEAGUE_PROPERTY_NAME, COLLEAGUE_PROPERTY_PATH } from "./provision-colleague-current-date";
import { REVIEW_EMAIL } from "./seed-review";

const PLAN_CODES = ["BAR", "FLEX", "ADV", "CORP"] as const;
const POLICY_NAMES = ["Demo Flexible Cancellation", "Demo Advance Deposit", "Demo Card Guarantee", "Demo Corporate Guarantee"] as const;

export type ColleagueCommercialConfiguration = Readonly<{
  propertyId: string;
  plans: number;
  prices: number;
}>;

type PolicyIds = Readonly<{ flexible: string; advanceDeposit: string; card: string; corporate: string }>;

type CommercialPolicyDefinition = Readonly<{
  name: (typeof POLICY_NAMES)[number];
  kind: Policy["kind"];
  content: Readonly<Record<string, unknown>>;
}>;

const POLICY_DEFINITIONS: readonly CommercialPolicyDefinition[] = [
  { name: "Demo Flexible Cancellation", kind: "cancellation", content: { kind: "cancellation", rules: [{ before_hours: 24, penalty: { basis: "nights", value: 0 } }, { before_hours: 0, penalty: { basis: "nights", value: 1 } }] } },
  { name: "Demo Advance Deposit", kind: "deposit", content: { kind: "deposit", deposit: { basis: "percent", value: 100, due: "at_booking" } } },
  { name: "Demo Card Guarantee", kind: "guarantee", content: { kind: "guarantee", guarantee: "card_on_file" } },
  { name: "Demo Corporate Guarantee", kind: "guarantee", content: { kind: "guarantee", guarantee: "company_letter" } },
] as const;

const PLAN_DISCOUNT_BY_CODE: Readonly<Record<(typeof PLAN_CODES)[number], bigint>> = {
  BAR: 0n,
  FLEX: 0n,
  ADV: 60000n,
  CORP: 40000n,
};

const BASE_BY_UNIT_TYPE: Readonly<Record<string, bigint>> = {
  COSY: 760000n,
  FAM: 1180000n,
  PREM: 980000n,
  SUITE: 1620000n,
};

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameJson(leftRecord[key], rightRecord[key]));
}

function samePricing(left: RatePricing, right: RatePricing): boolean {
  const leftOccupancy = Object.entries(left.occupancy).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const rightOccupancy = Object.entries(right.occupancy).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return left.extraAdultMinor === right.extraAdultMinor &&
    leftOccupancy.length === rightOccupancy.length &&
    leftOccupancy.every(([key, amount], index) => key === rightOccupancy[index]?.[0] && amount === rightOccupancy[index]?.[1]) &&
    left.extraChildren.length === right.extraChildren.length &&
    left.extraChildren.every((child, index) => child.maxAge === right.extraChildren[index]?.maxAge && child.amountMinor === right.extraChildren[index]?.amountMinor);
}

function addMonths(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

function envelope(actorId: string, propertyId: string, operation: string) {
  return createAuditEnvelope({ actorId, tenantId: SEED_TENANT.id, propertyNode: propertyId, requestId: crypto.randomUUID(), operation });
}

async function propertyAndActor(sql: SQL): Promise<{ propertyId: string; actorId: string; businessDate: string }> {
  const rows = await sql<Array<{ property_id: string; actor_id: string; business_date: string }>>`
    SELECT p.id AS property_id, u.id AS actor_id, p.config->>'business_date' AS business_date
    FROM org_node p JOIN app_user u ON u.tenant_id=p.tenant_id
    WHERE p.tenant_id=${SEED_TENANT.id}::uuid AND p.path=${COLLEAGUE_PROPERTY_PATH}::ltree
      AND p.name=${COLLEAGUE_PROPERTY_NAME} AND p.config @> '{"synthetic":true,"contact_free":true}'::jsonb
      AND u.email=${REVIEW_EMAIL} AND u.status='active'`;
  const row = rows[0];
  if (!row || rows.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(row.business_date)) throw new Error("canonical colleague scenario and review operator are required first");
  return { propertyId: row.property_id, actorId: row.actor_id, businessDate: row.business_date };
}

function policyIdsFromCanonicalRows(rows: readonly Policy[]): PolicyIds {
  const byName = new Map(rows.map((row) => [row.name, row]));
  const flexible = byName.get("Demo Flexible Cancellation");
  const advanceDeposit = byName.get("Demo Advance Deposit");
  const card = byName.get("Demo Card Guarantee");
  const corporate = byName.get("Demo Corporate Guarantee");
  if (!flexible || !advanceDeposit || !card || !corporate) throw new Error("colleague commercial policy identity is invalid");
  return { flexible: flexible.id, advanceDeposit: advanceDeposit.id, card: card.id, corporate: corporate.id };
}

async function requireExistingPolicies(database: Database, configuration: RateConfigurationService): Promise<PolicyIds | null> {
  return database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
    const rows = (await configuration.listPolicies(tx)).filter((row) => POLICY_NAMES.includes(row.name as (typeof POLICY_NAMES)[number]));
    if (rows.length === 0) {
      const provenance = await tx<Array<{ entity_id: string }>>`
        SELECT entity_id FROM fact_log
        WHERE tenant_id=current_setting('app.tenant_id', true)::uuid AND entity_type='policy' AND (
          payload @> ${JSON.stringify({ kind: "cancellation", name: "Demo Flexible Cancellation" })}::text::jsonb OR
          payload @> ${JSON.stringify({ kind: "deposit", name: "Demo Advance Deposit" })}::text::jsonb OR
          payload @> ${JSON.stringify({ kind: "guarantee", name: "Demo Card Guarantee" })}::text::jsonb OR
          payload @> ${JSON.stringify({ kind: "guarantee", name: "Demo Corporate Guarantee" })}::text::jsonb
        )`;
      if (provenance.length !== 0) throw new Error("colleague commercial policy provenance exists but policy rows are not canonical");
      return null;
    }
    if (rows.length !== POLICY_NAMES.length) throw new Error("colleague commercial policies are incomplete");
    const canonical = POLICY_DEFINITIONS.every((definition) => {
      const matches = rows.filter((row) => row.name === definition.name);
      return matches.length === 1 && matches[0]?.kind === definition.kind && sameJson(matches[0]?.content, definition.content);
    });
    if (!canonical) throw new Error("colleague commercial policy definitions are not canonical");
    return policyIdsFromCanonicalRows(rows);
  });
}

function isCanonicalPlan(plan: RatePlan, propertyId: string, policyIds: PolicyIds): boolean {
  const common = plan.tenantId === SEED_TENANT.id && plan.propertyNode === propertyId && plan.currency === "INR" &&
    plan.taxInclusive && plan.parentPlanId === null && plan.derivation === null && plan.status === "active";
  if (!common) return false;
  switch (plan.code) {
    case "BAR":
      return plan.name === "Best Available Rate" && plan.cancellationPolicyId === null && plan.guaranteePolicyId === null &&
        plan.depositPolicyId === null && plan.marketCode === null && plan.sourceCode === null;
    case "FLEX":
      return plan.name === "Flexible Direct Rate" && plan.cancellationPolicyId === policyIds.flexible && plan.guaranteePolicyId === policyIds.card &&
        plan.depositPolicyId === null && plan.marketCode === null && plan.sourceCode === null;
    case "ADV":
      return plan.name === "Advance Purchase" && plan.cancellationPolicyId === policyIds.flexible && plan.guaranteePolicyId === policyIds.card &&
        plan.depositPolicyId === policyIds.advanceDeposit && plan.marketCode === null && plan.sourceCode === null;
    case "CORP":
      return plan.name === "Corporate Direct" && plan.cancellationPolicyId === policyIds.flexible && plan.guaranteePolicyId === policyIds.corporate &&
        plan.depositPolicyId === null && plan.marketCode === "corporate" && plan.sourceCode === "direct";
    default:
      return false;
  }
}

function assertCanonicalPlans(plans: readonly RatePlan[], propertyId: string, policyIds: PolicyIds): void {
  if (plans.length !== PLAN_CODES.length || !PLAN_CODES.every((code) => plans.filter((plan) => plan.code === code).length === 1) ||
    !plans.every((plan) => isCanonicalPlan(plan, propertyId, policyIds))) {
    throw new Error("colleague commercial rate plans are not canonical");
  }
}

function expectedPricing(planCode: (typeof PLAN_CODES)[number], unitTypeCode: string): RatePricing {
  const base = BASE_BY_UNIT_TYPE[unitTypeCode];
  if (base === undefined) throw new Error("commercial configuration type is unsupported");
  const amount = base - PLAN_DISCOUNT_BY_CODE[planCode];
  return { occupancy: { "1": amount, "2": amount }, extraAdultMinor: null, extraChildren: [] };
}

function expectedPricingInput(planCode: (typeof PLAN_CODES)[number], unitTypeCode: string): RatePricingInput {
  const expected = expectedPricing(planCode, unitTypeCode);
  return { occupancy: expected.occupancy };
}

function expectedPricingJson(planCode: (typeof PLAN_CODES)[number], unitTypeCode: string): string {
  const expected = expectedPricing(planCode, unitTypeCode);
  const occupancy = Object.entries(expected.occupancy)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tier, amount]) => `${JSON.stringify(tier)}:${amount.toString()}`)
    .join(",");
  return `{\"occ\":{${occupancy}}}`;
}

export async function provisionColleagueCommercialConfiguration(options: Readonly<{ databaseUrl: string }>): Promise<ColleagueCommercialConfiguration> {
  if (!options.databaseUrl) throw new Error("databaseUrl is required");
  const lookup = new SQL(options.databaseUrl, { max: 1, prepare: false });
  const eventPool = new SQL(options.databaseUrl, { max: 1, prepare: false });
  const database = Database.connect(options.databaseUrl, { maxConnections: 1, prepare: false });
  try {
    const { propertyId, actorId, businessDate } = await propertyAndActor(lookup);
    const priceEnd = addMonths(businessDate, 6);
    const configuration = new RateConfigurationService(new PostgresEventBus(eventPool));
    const pricing = new RatePricingService(new PostgresEventBus(eventPool));
    const existingPolicies = await requireExistingPolicies(database, configuration);
    const policyIds = existingPolicies ?? await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const created = await Promise.all(POLICY_DEFINITIONS.map((definition) => configuration.createPolicy(tx, {
        kind: definition.kind,
        name: definition.name,
        content: definition.content,
        envelope: envelope(actorId, propertyId, "policy.created"),
      })));
      return policyIdsFromCanonicalRows(created);
    });

    await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const current = await configuration.listRatePlans(tx, propertyId);
      if (current.length === 1 && current[0]?.code === "BAR" && isCanonicalPlan(current[0], propertyId, policyIds)) {
        await configuration.createRatePlan(tx, { code: "FLEX", name: "Flexible Direct Rate", currency: "INR", cancellationPolicyId: policyIds.flexible, guaranteePolicyId: policyIds.card, envelope: envelope(actorId, propertyId, "rate_plan.created") });
        await configuration.createRatePlan(tx, { code: "ADV", name: "Advance Purchase", currency: "INR", cancellationPolicyId: policyIds.flexible, guaranteePolicyId: policyIds.card, depositPolicyId: policyIds.advanceDeposit, envelope: envelope(actorId, propertyId, "rate_plan.created") });
        await configuration.createRatePlan(tx, { code: "CORP", name: "Corporate Direct", currency: "INR", cancellationPolicyId: policyIds.flexible, guaranteePolicyId: policyIds.corporate, marketCode: "corporate", sourceCode: "direct", envelope: envelope(actorId, propertyId, "rate_plan.created") });
      } else {
        assertCanonicalPlans(current, propertyId, policyIds);
      }
    });

    await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const plans = await configuration.listRatePlans(tx, propertyId);
      assertCanonicalPlans(plans, propertyId, policyIds);
      const unitTypes = await tx<Array<{ id: string; code: string }>>`SELECT id, code FROM unit_type WHERE tenant_id=current_setting('app.tenant_id', true)::uuid AND property_node=${propertyId}::uuid ORDER BY code`;
      if (unitTypes.length !== 4) throw new Error("canonical colleague room types are required");
      const existing = await tx<Array<{ id: string; rate_plan_id: string; unit_type_id: string }>>`
        SELECT rp.id, rp.rate_plan_id, rp.unit_type_id FROM rate_price rp JOIN rate_plan plan ON plan.id=rp.rate_plan_id AND plan.tenant_id=rp.tenant_id
        WHERE rp.tenant_id=current_setting('app.tenant_id', true)::uuid AND plan.property_node=${propertyId}::uuid AND rp.superseded_by IS NULL`;
      if (existing.length === 0) {
        for (const plan of plans) for (const unitType of unitTypes) {
          if (!PLAN_CODES.includes(plan.code as (typeof PLAN_CODES)[number])) throw new Error("commercial configuration plan is unsupported");
          await pricing.create(tx, {
            ratePlanId: plan.id,
            unitTypeId: unitType.id,
            stayStart: businessDate,
            stayEnd: priceEnd,
            dowMask: 127,
            pricing: expectedPricingInput(plan.code as (typeof PLAN_CODES)[number], unitType.code),
            envelope: envelope(actorId, propertyId, "rate_price.created"),
          });
        }
      } else if (existing.length !== 16) {
        throw new Error("colleague commercial rate prices are incomplete");
      }
    });
    const result = await database.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const plans = await configuration.listRatePlans(tx, propertyId);
      assertCanonicalPlans(plans, propertyId, policyIds);
      const unitTypes = await tx<Array<{ id: string; code: string }>>`SELECT id, code FROM unit_type WHERE tenant_id=current_setting('app.tenant_id', true)::uuid AND property_node=${propertyId}::uuid ORDER BY code`;
      const prices = await tx<Array<{ id: string; plan: string; unit_type: string }>>`
        SELECT rp.id, plan.code AS plan, unit_type.code AS unit_type
        FROM rate_price rp JOIN rate_plan plan ON plan.id=rp.rate_plan_id AND plan.tenant_id=rp.tenant_id
          JOIN unit_type unit_type ON unit_type.id=rp.unit_type_id AND unit_type.tenant_id=rp.tenant_id
        WHERE rp.tenant_id=current_setting('app.tenant_id', true)::uuid AND plan.property_node=${propertyId}::uuid AND rp.superseded_by IS NULL`;
      const expectedPairs = new Set(plans.flatMap((plan) => unitTypes.map((unitType) => `${plan.code}/${unitType.code}`)));
      const exactPrices = prices.length === 16 && prices.every((row) => expectedPairs.delete(`${row.plan}/${row.unit_type}`));
      if (!exactPrices || expectedPairs.size !== 0) throw new Error("colleague commercial rate prices are not canonical");
      for (const row of prices) {
        if (!PLAN_CODES.includes(row.plan as (typeof PLAN_CODES)[number])) throw new Error("commercial configuration plan is unsupported");
        const price = await pricing.get(tx, propertyId, row.id);
        const stored = await tx<Array<{ canonical: boolean }>>`
          SELECT pricing=${expectedPricingJson(row.plan as (typeof PLAN_CODES)[number], row.unit_type)}::text::jsonb AS canonical
          FROM rate_price WHERE tenant_id=current_setting('app.tenant_id', true)::uuid AND id=${row.id}::uuid`;
        if (price.stayStart !== businessDate || price.stayEnd !== priceEnd || price.dowMask !== 127 || price.currency !== "INR" || stored[0]?.canonical !== true ||
          !samePricing(price.pricing, expectedPricing(row.plan as (typeof PLAN_CODES)[number], row.unit_type))) {
          throw new Error("colleague commercial rate prices are not canonical");
        }
      }
      return { propertyId, plans: plans.length, prices: prices.length };
    });
    return Object.freeze(result);
  } finally {
    await database.close();
    await eventPool.close({ timeout: 0 });
    await lookup.close({ timeout: 0 });
  }
}

if (import.meta.main || process.env.YELLOW_RUN_COLLEAGUE_COMMERCIAL_CONFIGURATION === "1") {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_DEPLOY_DATABASE_URL or DATABASE_URL is required");
  await provisionColleagueCommercialConfiguration({ databaseUrl });
}
