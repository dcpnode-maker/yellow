import type { AuditEnvelope, EventBus, Tx } from "../../kernel";
import { recordFact } from "../../kernel";
import { InventoryNotFoundError, InventoryValidationError } from "./inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPERATION = "inventory.policy.changed";

export type OosSellability = "blocked" | "allowed";

export interface InventoryPolicy {
  readonly propertyNode: string;
  readonly oosSellability: OosSellability;
}

export interface SetOosSellabilityInput {
  readonly value: OosSellability;
  readonly envelope: AuditEnvelope;
}

interface PropertyRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly config: unknown;
}

interface ParsedConfig {
  readonly oosSellability: OosSellability;
}

function requireUuid(name: string, value: string): void {
  if (!UUID.test(value)) throw new InventoryValidationError(`${name} must be a UUID`);
}

function requireObject(name: string, value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InventoryValidationError(`${name} must be a JSON object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function parseConfig(value: unknown): ParsedConfig {
  const root = requireObject("property config", value);
  const inventory = root.inventory === undefined
    ? {}
    : requireObject("property config inventory", root.inventory);
  const raw = inventory.oos_sellability;
  if (raw !== undefined && raw !== "blocked" && raw !== "allowed") {
    throw new InventoryValidationError("stored OOS sellability must be blocked or allowed");
  }
  return { oosSellability: raw ?? "blocked" };
}

function requireValue(value: unknown): asserts value is OosSellability {
  if (value !== "blocked" && value !== "allowed") {
    throw new InventoryValidationError("OOS sellability must be blocked or allowed");
  }
}

function toPolicy(propertyNode: string, oosSellability: OosSellability): InventoryPolicy {
  return { propertyNode, oosSellability };
}

export class InventoryPolicyService {
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  async get(tx: Tx, propertyNode: string): Promise<InventoryPolicy> {
    requireUuid("propertyNode", propertyNode);
    const rows = await tx<Array<PropertyRow>>`
      SELECT id, tenant_id, config
      FROM org_node
      WHERE id = ${propertyNode}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND kind = 'property'
    `;
    const row = rows[0];
    if (!row) throw new InventoryNotFoundError("Property was not found");
    return toPolicy(row.id, parseConfig(row.config).oosSellability);
  }

  async setOosSellability(tx: Tx, input: SetOosSellabilityInput): Promise<InventoryPolicy> {
    if (input.envelope.operation !== OPERATION) {
      throw new InventoryValidationError(`audit operation must be ${OPERATION}`);
    }
    requireUuid("propertyNode", input.envelope.propertyNode);
    requireValue(input.value);

    const rows = await tx<Array<PropertyRow>>`
      SELECT id, tenant_id, config
      FROM org_node
      WHERE id = ${input.envelope.propertyNode}::uuid
        AND tenant_id = ${input.envelope.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND kind = 'property'
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new InventoryNotFoundError("Property was not found");
    const current = parseConfig(row.config);
    if (current.oosSellability === input.value) {
      return toPolicy(row.id, current.oosSellability);
    }

    const updated = await tx<Array<{ id: string }>>`
      UPDATE org_node
      SET config = jsonb_set(
        config,
        '{inventory}',
        (COALESCE(config -> 'inventory', '{}'::jsonb) ||
          jsonb_build_object('oos_sellability', ${input.value}::text)),
        true
      )
      WHERE id = ${row.id}::uuid
        AND tenant_id = ${row.tenant_id}::uuid
      RETURNING id
    `;
    if (updated[0]?.id !== row.id) throw new Error("Property policy update lost its locked row");

    const payload = {
      policy: "oos_sellability",
      previous: current.oosSellability,
      value: input.value,
    } as const;
    const fact = await recordFact(tx, {
      entityType: "org_node",
      entityId: row.id,
      envelope: input.envelope,
      payload,
    });
    await this.#events.publish(tx, {
      tenantId: row.tenant_id,
      propertyNode: row.id,
      businessDate: fact.businessDate,
      aggregateType: "org_node",
      aggregateId: row.id,
      eventType: OPERATION,
      actorId: input.envelope.actorId,
      correlationId: input.envelope.requestId,
      payload,
    });
    return toPolicy(row.id, input.value);
  }
}
