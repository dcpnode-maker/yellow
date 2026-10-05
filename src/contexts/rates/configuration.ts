import type { AuditEnvelope, EventBus, Tx } from "../../kernel";
import { recordFact } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLAN_CODE = /^[A-Z0-9][A-Z0-9._-]{0,31}$/;
const OPTIONAL_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const CURRENCY = /^[A-Z]{3}$/;

export type PolicyKind = "cancellation" | "deposit" | "guarantee" | "no_show";
export type GuaranteeKind = "card_on_file" | "deposit_paid" | "company_letter" | "none";

export interface CancellationPolicyContent {
  readonly kind: "cancellation";
  readonly rules: readonly {
    readonly before_hours: number;
    readonly penalty: {
      readonly basis: "nights" | "percent";
      readonly value: number;
    };
  }[];
}

export interface DepositPolicyContent {
  readonly kind: "deposit";
  readonly deposit: {
    readonly basis: "first_night" | "percent" | "one_month";
    readonly value?: number;
    readonly due: "at_booking" | "days_before_arrival";
    readonly days_before?: number;
  };
}

export interface GuaranteePolicyContent {
  readonly kind: "guarantee";
  readonly guarantee: GuaranteeKind;
}

export interface NoShowPolicyContent {
  readonly kind: "no_show";
  readonly no_show_charge: {
    readonly basis: "first_night" | "full_stay";
    readonly value?: 1;
  };
}

export type PolicyContent =
  | CancellationPolicyContent
  | DepositPolicyContent
  | GuaranteePolicyContent
  | NoShowPolicyContent;

export interface Policy {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: PolicyKind;
  readonly name: string;
  readonly content: PolicyContent;
}

export interface RatePlan {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly taxInclusive: boolean;
  readonly cancellationPolicyId: string | null;
  readonly guaranteePolicyId: string | null;
  readonly depositPolicyId: string | null;
  readonly parentPlanId: null;
  readonly derivation: null;
  readonly marketCode: string | null;
  readonly sourceCode: string | null;
  readonly status: string;
}

export interface CreatePolicyInput {
  readonly kind: PolicyKind;
  readonly name: string;
  readonly content: Readonly<Record<string, unknown>>;
  readonly envelope: AuditEnvelope;
}

export interface CreateRatePlanInput {
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly taxInclusive?: boolean;
  readonly cancellationPolicyId?: string | null;
  readonly guaranteePolicyId?: string | null;
  readonly depositPolicyId?: string | null;
  readonly marketCode?: string | null;
  readonly sourceCode?: string | null;
  readonly envelope: AuditEnvelope;
}

interface PolicyRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly kind: PolicyKind;
  readonly name: string;
  readonly content: Record<string, unknown>;
}

interface RatePlanRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly tax_inclusive: boolean;
  readonly cancellation_policy: string | null;
  readonly guarantee_policy: string | null;
  readonly deposit_policy: string | null;
  readonly parent_plan: null;
  readonly derivation: null;
  readonly market_code: string | null;
  readonly source_code: string | null;
  readonly status: string;
}

export class RateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateValidationError";
  }
}

export class RateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateConflictError";
  }
}

export class RateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateNotFoundError";
  }
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new RateValidationError(`${name} must be a UUID`);
}

function requireOperation(envelope: AuditEnvelope, expected: string): void {
  if (envelope.operation !== expected) {
    throw new RateValidationError(`audit operation must be ${expected}`);
  }
}

function requireName(value: string): void {
  if (value !== value.trim() || value.length === 0 || value.length > 200) {
    throw new RateValidationError("name must be trimmed and contain 1 to 200 characters");
  }
}

function requireOnlyKeys(value: Record<string, unknown>, keys: readonly string[], subject: string): void {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new RateValidationError(`${subject} contains unsupported fields`);
  }
}

function requireObject(value: unknown, subject: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RateValidationError(`${subject} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireNonNegativeInteger(value: unknown, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RateValidationError(`${subject} must be a non-negative integer`);
  }
  return value as number;
}

function requirePercent(value: unknown, subject: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new RateValidationError(`${subject} must be a finite number between 0 and 100`);
  }
  return value;
}

function validateCancellation(source: Record<string, unknown>): CancellationPolicyContent {
  requireOnlyKeys(source, ["kind", "rules"], "cancellation policy");
  if (!Array.isArray(source.rules) || source.rules.length === 0 || source.rules.length > 50) {
    throw new RateValidationError("cancellation rules must contain 1 to 50 entries");
  }
  let previous = Number.POSITIVE_INFINITY;
  const rules = source.rules.map((candidate, index) => {
    const rule = requireObject(candidate, `cancellation rule ${index}`);
    requireOnlyKeys(rule, ["before_hours", "penalty"], `cancellation rule ${index}`);
    const beforeHours = requireNonNegativeInteger(rule.before_hours, `cancellation rule ${index} before_hours`);
    if (beforeHours >= previous) {
      throw new RateValidationError("cancellation rules must be ordered by descending before_hours");
    }
    previous = beforeHours;
    const penalty = requireObject(rule.penalty, `cancellation rule ${index} penalty`);
    requireOnlyKeys(penalty, ["basis", "value"], `cancellation rule ${index} penalty`);
    if (penalty.basis === "fixed") {
      throw new RateValidationError("fixed penalties require a future currency + bigint contract");
    }
    if (penalty.basis !== "nights" && penalty.basis !== "percent") {
      throw new RateValidationError("cancellation penalty basis must be nights or percent");
    }
    const basis: "nights" | "percent" = penalty.basis;
    const value = basis === "nights"
      ? requireNonNegativeInteger(penalty.value, `cancellation rule ${index} nights`)
      : requirePercent(penalty.value, `cancellation rule ${index} percent`);
    return { before_hours: beforeHours, penalty: { basis, value } };
  });
  return { kind: "cancellation", rules };
}

function validateDeposit(source: Record<string, unknown>): DepositPolicyContent {
  requireOnlyKeys(source, ["kind", "deposit"], "deposit policy");
  const deposit = requireObject(source.deposit, "deposit terms");
  requireOnlyKeys(deposit, ["basis", "value", "due", "days_before"], "deposit terms");
  if (deposit.basis === "fixed") {
    throw new RateValidationError("fixed deposits require a future currency + bigint contract");
  }
  if (deposit.basis !== "first_night" && deposit.basis !== "percent" && deposit.basis !== "one_month") {
    throw new RateValidationError("deposit basis must be first_night, percent, or one_month");
  }
  if (deposit.due !== "at_booking" && deposit.due !== "days_before_arrival") {
    throw new RateValidationError("deposit due must be at_booking or days_before_arrival");
  }
  let value: number | undefined;
  if (deposit.basis === "percent") {
    value = requirePercent(deposit.value, "deposit percent");
  } else if (deposit.value !== undefined) {
    throw new RateValidationError(`${deposit.basis} deposit must not carry a numeric value`);
  }
  let daysBefore: number | undefined;
  if (deposit.due === "days_before_arrival") {
    daysBefore = requireNonNegativeInteger(deposit.days_before, "deposit days_before");
  } else if (deposit.days_before !== undefined) {
    throw new RateValidationError("at_booking deposit must not carry days_before");
  }
  return {
    kind: "deposit",
    deposit: {
      basis: deposit.basis,
      ...(value === undefined ? {} : { value }),
      due: deposit.due,
      ...(daysBefore === undefined ? {} : { days_before: daysBefore }),
    },
  };
}

function validateGuarantee(source: Record<string, unknown>): GuaranteePolicyContent {
  requireOnlyKeys(source, ["kind", "guarantee"], "guarantee policy");
  const allowed: readonly GuaranteeKind[] = ["card_on_file", "deposit_paid", "company_letter", "none"];
  if (!allowed.includes(source.guarantee as GuaranteeKind)) {
    throw new RateValidationError("guarantee must be card_on_file, deposit_paid, company_letter, or none");
  }
  return { kind: "guarantee", guarantee: source.guarantee as GuaranteeKind };
}

function validateNoShow(source: Record<string, unknown>): NoShowPolicyContent {
  requireOnlyKeys(source, ["kind", "no_show_charge"], "no-show policy");
  const charge = requireObject(source.no_show_charge, "no-show charge");
  requireOnlyKeys(charge, ["basis", "value"], "no-show charge");
  if (charge.basis === "fixed") {
    throw new RateValidationError("fixed no-show charges require a future currency + bigint contract");
  }
  if (charge.basis !== "first_night" && charge.basis !== "full_stay") {
    throw new RateValidationError("no-show charge basis must be first_night or full_stay");
  }
  if (charge.basis === "first_night" && charge.value !== 1) {
    throw new RateValidationError("first_night no-show charge must carry value 1");
  }
  if (charge.basis === "full_stay" && charge.value !== undefined) {
    throw new RateValidationError("full_stay no-show charge must not carry a numeric value");
  }
  return {
    kind: "no_show",
    no_show_charge: charge.basis === "first_night"
      ? { basis: "first_night", value: 1 }
      : { basis: "full_stay" },
  };
}

function validatePolicyContent(kind: PolicyKind, value: Readonly<Record<string, unknown>>): PolicyContent {
  const source = requireObject(value, "policy content");
  if (source.kind !== kind) throw new RateValidationError("policy row kind must match content.kind");
  let content: PolicyContent;
  switch (kind) {
    case "cancellation": content = validateCancellation(source); break;
    case "deposit": content = validateDeposit(source); break;
    case "guarantee": content = validateGuarantee(source); break;
    case "no_show": content = validateNoShow(source); break;
  }
  return JSON.parse(JSON.stringify(content)) as PolicyContent;
}

export function parseCancellationPolicyContent(
  value: Readonly<Record<string, unknown>>,
): CancellationPolicyContent {
  return validatePolicyContent("cancellation", value) as CancellationPolicyContent;
}

function requireOptionalCode(name: string, value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (value !== value.trim() || !OPTIONAL_CODE.test(value)) {
    throw new RateValidationError(`${name} must be null or a trimmed stable identifier`);
  }
  return value;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errno" in error && error.errno === "23505";
}

async function requireProperty(tx: Tx, envelope: AuditEnvelope): Promise<void> {
  const rows = await tx<Array<{ id: string }>>`
    SELECT id FROM org_node
    WHERE id = ${envelope.propertyNode}::uuid
      AND tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND kind = 'property'
  `;
  if (!rows[0]) throw new RateNotFoundError("Property was not found in the active tenant");
}

async function requirePolicyReference(tx: Tx, id: string | null, kind: PolicyKind): Promise<void> {
  if (id === null) return;
  requireUuid(`${kind}PolicyId`, id);
  const rows = await tx<Array<{ id: string }>>`
    SELECT id FROM policy
    WHERE id = ${id}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND kind = ${kind}
  `;
  if (!rows[0]) throw new RateNotFoundError(`${kind} policy was not found in the active tenant`);
}

function toPolicy(row: PolicyRow): Policy {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind,
    name: row.name,
    content: validatePolicyContent(row.kind, row.content),
  };
}

function toRatePlan(row: RatePlanRow): RatePlan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    propertyNode: row.property_node,
    code: row.code,
    name: row.name,
    currency: row.currency,
    taxInclusive: row.tax_inclusive,
    cancellationPolicyId: row.cancellation_policy,
    guaranteePolicyId: row.guarantee_policy,
    depositPolicyId: row.deposit_policy,
    parentPlanId: row.parent_plan,
    derivation: row.derivation,
    marketCode: row.market_code,
    sourceCode: row.source_code,
    status: row.status,
  };
}

export class RateConfigurationService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async createPolicy(tx: Tx, input: CreatePolicyInput): Promise<Policy> {
    requireOperation(input.envelope, "policy.created");
    requireName(input.name);
    if (!( ["cancellation", "deposit", "guarantee", "no_show"] as const).includes(input.kind)) {
      throw new RateValidationError("policy kind is unsupported");
    }
    const content = validatePolicyContent(input.kind, input.content);
    await requireProperty(tx, input.envelope);
    const rows = await tx<PolicyRow[]>`
      INSERT INTO policy (tenant_id, kind, name, content)
      VALUES (
        ${input.envelope.tenantId}::uuid, ${input.kind}, ${input.name},
        ${JSON.stringify(content)}::text::jsonb
      )
      RETURNING id, tenant_id, kind, name, content
    `;
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the created policy");
    const fact = await recordFact(tx, {
      entityType: "policy",
      entityId: row.id,
      envelope: input.envelope,
      payload: { kind: row.kind, name: row.name },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: input.envelope.propertyNode,
      businessDate: fact.businessDate,
      aggregateType: "policy",
      aggregateId: row.id,
      eventType: "policy.created",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: { policy_id: row.id, kind: row.kind },
    });
    return toPolicy(row);
  }

  async createRatePlan(tx: Tx, input: CreateRatePlanInput): Promise<RatePlan> {
    requireOperation(input.envelope, "rate_plan.created");
    if (input.code !== input.code.trim() || !PLAN_CODE.test(input.code)) {
      throw new RateValidationError("code must be an uppercase stable identifier of 1 to 32 characters");
    }
    requireName(input.name);
    if (!CURRENCY.test(input.currency)) {
      throw new RateValidationError("currency must be an uppercase ISO-style three-letter code");
    }
    const cancellationPolicyId = input.cancellationPolicyId ?? null;
    const guaranteePolicyId = input.guaranteePolicyId ?? null;
    const depositPolicyId = input.depositPolicyId ?? null;
    const marketCode = requireOptionalCode("marketCode", input.marketCode);
    const sourceCode = requireOptionalCode("sourceCode", input.sourceCode);
    await requireProperty(tx, input.envelope);
    await requirePolicyReference(tx, cancellationPolicyId, "cancellation");
    await requirePolicyReference(tx, guaranteePolicyId, "guarantee");
    await requirePolicyReference(tx, depositPolicyId, "deposit");

    let rows: RatePlanRow[];
    try {
      rows = await tx<RatePlanRow[]>`
        INSERT INTO rate_plan (
          tenant_id, property_node, code, name, currency, tax_inclusive,
          cancellation_policy, guarantee_policy, deposit_policy, market_code, source_code
        ) VALUES (
          ${input.envelope.tenantId}::uuid, ${input.envelope.propertyNode}::uuid,
          ${input.code}, ${input.name}, ${input.currency}, ${input.taxInclusive ?? true},
          ${cancellationPolicyId}::uuid, ${guaranteePolicyId}::uuid,
          ${depositPolicyId}::uuid, ${marketCode}, ${sourceCode}
        )
        RETURNING id, tenant_id, property_node, code, name, currency::text,
                  tax_inclusive, cancellation_policy, guarantee_policy, deposit_policy,
                  parent_plan, derivation, market_code, source_code, status
      `;
    } catch (error) {
      if (isUniqueViolation(error)) throw new RateConflictError(`Rate plan code ${input.code} already exists`);
      throw error;
    }
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the created rate plan");
    const fact = await recordFact(tx, {
      entityType: "rate_plan",
      entityId: row.id,
      envelope: input.envelope,
      payload: { code: row.code, currency: row.currency, property_node: row.property_node },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      businessDate: fact.businessDate,
      aggregateType: "rate_plan",
      aggregateId: row.id,
      eventType: "rate_plan.created",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: {
        rate_plan_id: row.id,
        code: row.code,
        currency: row.currency,
        policy_ids: {
          cancellation: row.cancellation_policy,
          guarantee: row.guarantee_policy,
          deposit: row.deposit_policy,
        },
      },
    });
    return toRatePlan(row);
  }

  async listPolicies(tx: Tx): Promise<readonly Policy[]> {
    const rows = await tx<PolicyRow[]>`
      SELECT id, tenant_id, kind, name, content
      FROM policy
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
      ORDER BY kind, name, id
    `;
    return rows.map(toPolicy);
  }

  async getPolicy(tx: Tx, policyId: string): Promise<Policy> {
    requireUuid("policyId", policyId);
    const rows = await tx<PolicyRow[]>`
      SELECT id, tenant_id, kind, name, content
      FROM policy
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND id = ${policyId}::uuid
    `;
    const row = rows[0];
    if (!row) throw new RateNotFoundError("Policy was not found in the active tenant");
    return toPolicy(row);
  }

  async listRatePlans(tx: Tx, propertyNode: string): Promise<readonly RatePlan[]> {
    requireUuid("propertyNode", propertyNode);
    const rows = await tx<RatePlanRow[]>`
      SELECT id, tenant_id, property_node, code, name, currency::text,
             tax_inclusive, cancellation_policy, guarantee_policy, deposit_policy,
             parent_plan, derivation, market_code, source_code, status
      FROM rate_plan
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${propertyNode}::uuid
      ORDER BY code, id
    `;
    return rows.map(toRatePlan);
  }

  async getRatePlan(tx: Tx, propertyNode: string, ratePlanId: string): Promise<RatePlan> {
    requireUuid("propertyNode", propertyNode);
    requireUuid("ratePlanId", ratePlanId);
    const rows = await tx<RatePlanRow[]>`
      SELECT id, tenant_id, property_node, code, name, currency::text,
             tax_inclusive, cancellation_policy, guarantee_policy, deposit_policy,
             parent_plan, derivation, market_code, source_code, status
      FROM rate_plan
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${propertyNode}::uuid
        AND id = ${ratePlanId}::uuid
    `;
    const row = rows[0];
    if (!row) throw new RateNotFoundError("Rate plan was not found in the active property");
    return toRatePlan(row);
  }
}
