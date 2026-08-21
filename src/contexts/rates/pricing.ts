import type { AuditEnvelope, EventBus, Tx } from "../../kernel";
import { recordFact } from "../../kernel";
import { RateNotFoundError, RateValidationError } from "./configuration";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MAX_OCCUPANCY_TIER = 100;

export interface ChildRateInput {
  readonly maxAge: number;
  readonly amountMinor: bigint;
}

export interface RatePricingInput {
  readonly occupancy: Readonly<Record<string, bigint>>;
  readonly extraAdultMinor?: bigint;
  readonly extraChildren?: readonly ChildRateInput[];
}

export interface RatePricing {
  readonly occupancy: Readonly<Record<string, bigint>>;
  readonly extraAdultMinor: bigint | null;
  readonly extraChildren: readonly ChildRateInput[];
}

export interface RatePrice {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly unitTypeId: string;
  readonly stayStart: string;
  readonly stayEnd: string;
  readonly dowMask: number;
  readonly currency: string;
  readonly pricing: RatePricing;
  readonly recordedAt: Date;
  readonly supersededBy: string | null;
}

export interface CreateRatePriceInput {
  readonly ratePlanId: string;
  readonly unitTypeId: string;
  readonly stayStart: string;
  readonly stayEnd: string;
  readonly dowMask?: number;
  readonly pricing: RatePricingInput;
  readonly envelope: AuditEnvelope;
}

export interface FindCurrentRatePriceInput {
  readonly propertyNode: string;
  readonly ratePlanId: string;
  readonly unitTypeId: string;
  readonly stayDate: string;
}

interface RatePriceRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly rate_plan_id: string;
  readonly unit_type_id: string;
  readonly stay_start: string;
  readonly stay_end: string;
  readonly dow_mask: number;
  readonly currency: string;
  readonly extra_adult_minor: string | null;
  readonly recorded_at: Date;
  readonly superseded_by: string | null;
}

interface OccupancyAmountRow {
  readonly rate_price_id: string;
  readonly occupancy: string;
  readonly amount_minor: string;
}

interface ChildAmountRow {
  readonly rate_price_id: string;
  readonly ordinal: number | bigint;
  readonly max_age: number;
  readonly amount_minor: string;
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new RateValidationError(`${name} must be a UUID`);
}

function requireDate(name: string, value: string): void {
  if (!DATE.test(value)) throw new RateValidationError(`${name} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RateValidationError(`${name} must be a real calendar date`);
  }
}

function requireAmount(name: string, value: unknown): bigint {
  if (typeof value !== "bigint" || value < 0n || value > MAX_BIGINT) {
    throw new RateValidationError(`${name} must be a non-negative signed-bigint minor-unit value`);
  }
  return value;
}

function normalizePricing(input: RatePricingInput): RatePricing {
  if (typeof input.occupancy !== "object" || input.occupancy === null || Array.isArray(input.occupancy)) {
    throw new RateValidationError("pricing.occupancy must be an object");
  }
  const entries = Object.entries(input.occupancy);
  if (entries.length === 0 || entries.length > MAX_OCCUPANCY_TIER) {
    throw new RateValidationError(`pricing.occupancy must contain 1 to ${MAX_OCCUPANCY_TIER} tiers`);
  }
  const occupancy: Record<string, bigint> = {};
  const tiers = entries.map(([key, amount]) => {
    const tier = Number(key);
    if (!/^[1-9]\d*$/.test(key) || !Number.isSafeInteger(tier) || tier > MAX_OCCUPANCY_TIER) {
      throw new RateValidationError(`occupancy key ${key} must be an integer from 1 to ${MAX_OCCUPANCY_TIER}`);
    }
    return { key, tier, amount: requireAmount(`occupancy ${key}`, amount) };
  }).sort((left, right) => left.tier - right.tier);
  for (const { key, amount } of tiers) occupancy[key] = amount;

  const extraAdultMinor = input.extraAdultMinor === undefined
    ? null
    : requireAmount("extraAdultMinor", input.extraAdultMinor);
  const children = input.extraChildren ?? [];
  if (!Array.isArray(children) || children.length > 20) {
    throw new RateValidationError("extraChildren must contain at most 20 age bands");
  }
  let previousAge = -1;
  const extraChildren = children.map((child, index) => {
    if (typeof child !== "object" || child === null) {
      throw new RateValidationError(`extraChildren ${index} must be an object`);
    }
    if (!Number.isInteger(child.maxAge) || child.maxAge < 0 || child.maxAge > 17 || child.maxAge <= previousAge) {
      throw new RateValidationError("child maxAge values must be strictly increasing integers from 0 to 17");
    }
    previousAge = child.maxAge;
    return { maxAge: child.maxAge, amountMinor: requireAmount(`extraChildren ${index} amountMinor`, child.amountMinor) };
  });
  return { occupancy, extraAdultMinor, extraChildren };
}

function encodePricing(pricing: RatePricing): string {
  const occupancy = Object.entries(pricing.occupancy)
    .map(([tier, amount]) => `${JSON.stringify(tier)}:${amount.toString()}`)
    .join(",");
  const parts = [`"occ":{${occupancy}}`];
  if (pricing.extraAdultMinor !== null) parts.push(`"extra_adult":${pricing.extraAdultMinor.toString()}`);
  if (pricing.extraChildren.length > 0) {
    const children = pricing.extraChildren
      .map(({ maxAge, amountMinor }) => `{"max_age":${maxAge},"amount":${amountMinor.toString()}}`)
      .join(",");
    parts.push(`"extra_child":[${children}]`);
  }
  return `{${parts.join(",")}}`;
}

function requireOperation(envelope: AuditEnvelope): void {
  if (envelope.operation !== "rate_price.created") {
    throw new RateValidationError("audit operation must be rate_price.created");
  }
}

async function requireConfiguration(
  tx: Tx,
  envelope: AuditEnvelope,
  ratePlanId: string,
  unitTypeId: string,
): Promise<{ currency: string }> {
  const rows = await tx<Array<{ currency: string }>>`
    SELECT rp.currency::text AS currency
    FROM rate_plan AS rp
    JOIN unit_type AS ut
      ON ut.id = ${unitTypeId}::uuid
     AND ut.tenant_id = rp.tenant_id
     AND ut.property_node = rp.property_node
    WHERE rp.id = ${ratePlanId}::uuid
      AND rp.tenant_id = ${envelope.tenantId}::uuid
      AND rp.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND rp.property_node = ${envelope.propertyNode}::uuid
      AND rp.status = 'active'
  `;
  const row = rows[0];
  if (!row) throw new RateNotFoundError("Active rate plan and unit type were not found in the active property");
  return row;
}

async function attachPricing(tx: Tx, rows: readonly RatePriceRow[]): Promise<readonly RatePrice[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(({ id }) => id);
  const occupancyRows = await tx<OccupancyAmountRow[]>`
    SELECT rp.id AS rate_price_id, amount.key AS occupancy, amount.value::text AS amount_minor
    FROM rate_price AS rp
    CROSS JOIN LATERAL jsonb_each(rp.pricing->'occ') AS amount(key, value)
    WHERE rp.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND rp.id IN ${tx(ids)}
    ORDER BY rp.id, amount.key::int
  `;
  const childRows = await tx<ChildAmountRow[]>`
    SELECT rp.id AS rate_price_id, child.ordinality AS ordinal,
           (child.value->>'max_age')::int AS max_age,
           child.value->>'amount' AS amount_minor
    FROM rate_price AS rp
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rp.pricing->'extra_child', '[]'::jsonb))
      WITH ORDINALITY AS child(value, ordinality)
    WHERE rp.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND rp.id IN ${tx(ids)}
    ORDER BY rp.id, child.ordinality
  `;
  const occupancyByPrice = new Map<string, Record<string, bigint>>();
  for (const amount of occupancyRows) {
    const current = occupancyByPrice.get(amount.rate_price_id) ?? {};
    current[amount.occupancy] = BigInt(amount.amount_minor);
    occupancyByPrice.set(amount.rate_price_id, current);
  }
  const childrenByPrice = new Map<string, ChildRateInput[]>();
  for (const child of childRows) {
    const current = childrenByPrice.get(child.rate_price_id) ?? [];
    current.push({ maxAge: child.max_age, amountMinor: BigInt(child.amount_minor) });
    childrenByPrice.set(child.rate_price_id, current);
  }
  return rows.map((row) => {
    const occupancy = occupancyByPrice.get(row.id);
    if (!occupancy || Object.keys(occupancy).length === 0) {
      throw new RateValidationError(`Rate price ${row.id} has no valid occupancy pricing`);
    }
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyNode: row.property_node,
      ratePlanId: row.rate_plan_id,
      unitTypeId: row.unit_type_id,
      stayStart: row.stay_start,
      stayEnd: row.stay_end,
      dowMask: row.dow_mask,
      currency: row.currency,
      pricing: {
        occupancy,
        extraAdultMinor: row.extra_adult_minor === null ? null : BigInt(row.extra_adult_minor),
        extraChildren: childrenByPrice.get(row.id) ?? [],
      },
      recordedAt: row.recorded_at,
      supersededBy: row.superseded_by,
    };
  });
}

export class RatePricingService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async create(tx: Tx, input: CreateRatePriceInput): Promise<RatePrice> {
    requireOperation(input.envelope);
    requireUuid("ratePlanId", input.ratePlanId);
    requireUuid("unitTypeId", input.unitTypeId);
    requireDate("stayStart", input.stayStart);
    requireDate("stayEnd", input.stayEnd);
    if (input.stayStart >= input.stayEnd) throw new RateValidationError("stay range must be non-empty and increasing");
    const dowMask = input.dowMask ?? 127;
    if (!Number.isInteger(dowMask) || dowMask < 1 || dowMask > 127) {
      throw new RateValidationError("dowMask must be an integer from 1 to 127");
    }
    const pricing = normalizePricing(input.pricing);
    const { currency } = await requireConfiguration(tx, input.envelope, input.ratePlanId, input.unitTypeId);
    const rows = await tx<RatePriceRow[]>`
      INSERT INTO rate_price (
        tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask, pricing
      )
      VALUES (
        ${input.envelope.tenantId}::uuid, ${input.ratePlanId}::uuid, ${input.unitTypeId}::uuid,
        daterange(${input.stayStart}::date, ${input.stayEnd}::date, '[)'), ${dowMask},
        ${encodePricing(pricing)}::text::jsonb
      )
      RETURNING id, tenant_id, ${input.envelope.propertyNode}::uuid AS property_node,
                rate_plan_id, unit_type_id, lower(stay_dates)::text AS stay_start,
                upper(stay_dates)::text AS stay_end, dow_mask, ${currency}::text AS currency,
                pricing->>'extra_adult' AS extra_adult_minor, recorded_at, superseded_by
    `;
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the created rate price");
    const fact = await recordFact(tx, {
      entityType: "rate_price",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        rate_plan_id: row.rate_plan_id,
        unit_type_id: row.unit_type_id,
        stay_start: row.stay_start,
        stay_end: row.stay_end,
        dow_mask: row.dow_mask,
        currency,
      },
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: input.envelope.propertyNode,
      businessDate: fact.businessDate,
      aggregateType: "rate_price",
      aggregateId: row.id,
      eventType: "rate_price.created",
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload: {
        rate_price_id: row.id,
        rate_plan_id: row.rate_plan_id,
        unit_type_id: row.unit_type_id,
        stay_dates: { start: row.stay_start, end: row.stay_end },
        dow_mask: row.dow_mask,
        currency,
      },
    });
    const result = (await attachPricing(tx, [row]))[0];
    if (!result) throw new Error("Created rate price could not be read back");
    return result;
  }

  async get(tx: Tx, propertyNode: string, ratePriceId: string): Promise<RatePrice> {
    requireUuid("propertyNode", propertyNode);
    requireUuid("ratePriceId", ratePriceId);
    const rows = await tx<RatePriceRow[]>`
      SELECT rp.id, rp.tenant_id, plan.property_node, rp.rate_plan_id, rp.unit_type_id,
             lower(rp.stay_dates)::text AS stay_start,
             upper(rp.stay_dates)::text AS stay_end, rp.dow_mask,
             plan.currency::text AS currency,
             rp.pricing->>'extra_adult' AS extra_adult_minor,
             rp.recorded_at, rp.superseded_by
      FROM rate_price AS rp
      JOIN rate_plan AS plan ON plan.id = rp.rate_plan_id AND plan.tenant_id = rp.tenant_id
      WHERE rp.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND plan.property_node = ${propertyNode}::uuid
        AND rp.id = ${ratePriceId}::uuid
    `;
    const result = (await attachPricing(tx, rows))[0];
    if (!result) throw new RateNotFoundError("Rate price was not found in the active property");
    return result;
  }

  async findCurrent(tx: Tx, input: FindCurrentRatePriceInput): Promise<RatePrice> {
    requireUuid("propertyNode", input.propertyNode);
    requireUuid("ratePlanId", input.ratePlanId);
    requireUuid("unitTypeId", input.unitTypeId);
    requireDate("stayDate", input.stayDate);
    const rows = await tx<RatePriceRow[]>`
      SELECT rp.id, rp.tenant_id, plan.property_node, rp.rate_plan_id, rp.unit_type_id,
             lower(rp.stay_dates)::text AS stay_start,
             upper(rp.stay_dates)::text AS stay_end, rp.dow_mask,
             plan.currency::text AS currency,
             rp.pricing->>'extra_adult' AS extra_adult_minor,
             rp.recorded_at, rp.superseded_by
      FROM rate_price AS rp
      JOIN rate_plan AS plan ON plan.id = rp.rate_plan_id AND plan.tenant_id = rp.tenant_id
      WHERE rp.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND plan.property_node = ${input.propertyNode}::uuid
        AND rp.rate_plan_id = ${input.ratePlanId}::uuid
        AND rp.unit_type_id = ${input.unitTypeId}::uuid
        AND rp.superseded_by IS NULL
        AND rp.stay_dates @> ${input.stayDate}::date
        AND (rp.dow_mask & (1 << (EXTRACT(ISODOW FROM ${input.stayDate}::date)::int - 1))) <> 0
      ORDER BY rp.recorded_at DESC, rp.id DESC
      LIMIT 1
    `;
    const result = (await attachPricing(tx, rows))[0];
    if (!result) throw new RateNotFoundError("No current rate price applies to the requested date");
    return result;
  }
}
