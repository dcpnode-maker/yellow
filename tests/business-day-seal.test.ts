import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  BusinessDaySealConflictError,
  BusinessDaySealService,
  BusinessDaySealValidationError,
} from "../src/contexts/financials";
import {
  IdempotencyConflictError,
  type EventBus,
  type IdempotencyCommandResult,
  type IdempotencyInput,
  type IdempotencyResult,
  type JsonValue,
  type PostgresIdempotency,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000035600";
const PROPERTY = "00000000-0000-0000-0000-000000035601";
const ACTOR = "00000000-0000-0000-0000-000000035602";
const REQUEST = "00000000-0000-0000-0000-000000035603";
const DAY = "2047-05-06";
const SEALED_AT = "2047-05-07T00:00:00.123Z";

const input = (overrides: Record<string, unknown> = {}) => ({
  tenantId: TENANT,
  propertyNode: PROPERTY,
  businessDate: DAY,
  actorId: ACTOR,
  idempotencyKey: "order356-unit-seal",
  envelope: {
    actorId: ACTOR,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    requestId: REQUEST,
    operation: "business_day.sealed",
  },
  ...overrides,
});

interface HarnessOptions {
  readonly sealRows?: readonly Record<string, unknown>[];
  readonly idempotencyFailure?: unknown;
  readonly replayed?: boolean;
  readonly replayBody?: unknown;
}

function harness(options: HarnessOptions = {}) {
  const statements: string[] = [];
  const events: PublishEventInput[] = [];
  let idempotencyInput: IdempotencyInput | undefined;
  const sealRows = options.sealRows ?? [{
    tenant_id: TENANT,
    property_node: PROPERTY,
    business_date: DAY,
    previous_state: "open",
    state: "sealed",
    sealed_at: new Date(SEALED_AT),
    sealed_by: ACTOR,
  }];
  const tx = ((parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    statements.push(sql);
    if (sql.includes("seal_business_day_audited")) return Promise.resolve(sealRows);
    if (sql.includes("INSERT INTO fact_log")) return Promise.resolve([{
      id: crypto.randomUUID(), tenant_id: TENANT, entity_type: "business_day",
      entity_id: PROPERTY, fact_type: "business_day.sealed",
      valid_from: new Date(SEALED_AT), recorded_at: new Date(SEALED_AT),
      business_date: DAY, actor_id: ACTOR, payload: {}, supersedes: null,
    }]);
    throw new Error(`Unexpected SQL: ${sql}`);
  }) as unknown as Tx;
  const idempotency = {
    execute: async <T extends JsonValue>(
      commandTx: Tx,
      commandInput: IdempotencyInput,
      command: (inner: Tx) => Promise<IdempotencyCommandResult<T>>,
    ): Promise<IdempotencyResult<T>> => {
      idempotencyInput = commandInput;
      if (options.idempotencyFailure) throw options.idempotencyFailure;
      if (options.replayBody !== undefined) {
        return { status: 200, body: options.replayBody as T, replayed: true };
      }
      const result = await command(commandTx);
      return { ...result, replayed: options.replayed ?? false };
    },
  } as unknown as PostgresIdempotency;
  const eventBus = {
    publish: async (_tx: Tx, event: PublishEventInput) => {
      events.push(event);
      return {} as never;
    },
  } as unknown as EventBus;
  return {
    service: new BusinessDaySealService({ events: eventBus, idempotency }),
    tx,
    evidence: () => ({ statements, events, idempotencyInput }),
  };
}

describe("Order 356 audited business-day seal", () => {
  test("P0/P5 ships only the bounded service and migration authority", () => {
    expect(existsSync(resolve(import.meta.dir, "../src/contexts/financials/business-day-seal.ts"))).toBe(true);
    expect(existsSync(resolve(import.meta.dir, "../migrations/0064_audited_business_day_seal.sql"))).toBe(true);
    expect(typeof BusinessDaySealService).toBe("function");
    const migration = readFileSync(resolve(import.meta.dir, "../migrations/0064_audited_business_day_seal.sql"), "utf8");
    expect(migration).toContain("CREATE FUNCTION public.seal_business_day_audited(");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.seal_business_day_audited");
    expect(migration).toContain("TO app_role");
    expect(migration).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE).*business_day/i);
    expect(migration).not.toMatch(/(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?public\.(?:fact_log|outbox)\b/i);
    expect(migration).not.toMatch(/seal_business_day\s*\(/i);
  });

  test("P4 binds exact idempotency identity and emits one minimized matching fact/event receipt", async () => {
    const proof = harness();
    const result = await proof.service.seal(proof.tx, input());
    expect(result).toEqual({
      tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY,
      previousState: "open", state: "sealed", sealedAt: SEALED_AT,
      actorId: ACTOR, replayed: false,
    });
    expect(Object.isFrozen(result)).toBe(true);
    const evidence = proof.evidence();
    expect(evidence.idempotencyInput).toEqual({
      tenantId: TENANT,
      operation: "financials.business-day.seal",
      key: "order356-unit-seal",
      request: { actorId: ACTOR, propertyNode: PROPERTY, businessDate: DAY },
    });
    expect(evidence.statements).toHaveLength(2);
    expect(evidence.statements[0]).toContain("seal_business_day_audited");
    expect(evidence.statements[1]).toContain("INSERT INTO fact_log");
    expect(evidence.events).toEqual([{
      tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY,
      aggregateType: "business_day", aggregateId: PROPERTY,
      eventType: "business_day.sealed", eventVersion: 1, actorId: ACTOR,
      correlationId: REQUEST, causationId: null,
      payload: { property_node: PROPERTY, business_date: DAY, previous_state: "open",
        state: "sealed", sealed_at: SEALED_AT, sealed_by: ACTOR },
    }]);
  });

  test("P4 preserves the durable replay marker and byte-stable identity", async () => {
    const proof = harness({ replayed: true });
    const result = await proof.service.seal(proof.tx, input());
    expect(result).toEqual({ tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY,
      previousState: "open", state: "sealed", sealedAt: SEALED_AT, actorId: ACTOR, replayed: true });
  });

  test("P4 fails closed for a malformed, stale or surplus stored replay receipt", async () => {
    const canonical = { tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY,
      previousState: "open", state: "sealed", sealedAt: SEALED_AT, actorId: ACTOR, replayed: false };
    for (const replayBody of [
      { ...canonical, tenantId: crypto.randomUUID() },
      { ...canonical, state: "open" },
      { ...canonical, sealedAt: "not-an-instant" },
      { ...canonical, replayed: true },
      { ...canonical, surplus: "must-not-escape" },
    ]) {
      const proof = harness({ replayBody });
      await expect(proof.service.seal(proof.tx, input())).rejects.toBeInstanceOf(Error);
      expect(proof.evidence().statements).toEqual([]);
      expect(proof.evidence().events).toEqual([]);
    }
  });

  test("P2 rejects surplus/caller authority and malformed targets before SQL", async () => {
    const invalid: unknown[] = [
      { ...input(), ready: true },
      { ...input(), tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaA" },
      { ...input(), propertyNode: "not-a-uuid" },
      { ...input(), actorId: "" },
      { ...input(), businessDate: "2047-02-30" },
      { ...input(), businessDate: "06-05-2047" },
      { ...input(), idempotencyKey: "short" },
      { ...input(), envelope: { ...input().envelope, tenantId: crypto.randomUUID() } },
      { ...input(), envelope: { ...input().envelope, propertyNode: crypto.randomUUID() } },
      { ...input(), envelope: { ...input().envelope, actorId: crypto.randomUUID() } },
      { ...input(), envelope: { ...input().envelope, operation: "business_day.force_sealed" } },
      Object.assign(Object.create(null), input(), { force: true }),
    ];
    for (const candidate of invalid) {
      const proof = harness();
      await expect(proof.service.seal(proof.tx, candidate as never))
        .rejects.toBeInstanceOf(BusinessDaySealValidationError);
      expect(proof.evidence().statements).toEqual([]);
    }
  });

  test("P1/P2 rejects every unsupported database result shape without publishing", async () => {
    const hostileRows = [
      [],
      [{ tenant_id: TENANT }],
      [{ tenant_id: TENANT, property_node: PROPERTY, business_date: DAY, previous_state: "open",
        state: "sealed", sealed_at: SEALED_AT, sealed_by: ACTOR },
       { tenant_id: TENANT, property_node: PROPERTY, business_date: DAY, previous_state: "open",
         state: "sealed", sealed_at: SEALED_AT, sealed_by: ACTOR }],
      [{ tenant_id: crypto.randomUUID(), property_node: PROPERTY, business_date: DAY,
        previous_state: "open", state: "sealed", sealed_at: SEALED_AT, sealed_by: ACTOR }],
      [{ tenant_id: TENANT, property_node: PROPERTY, business_date: DAY,
        previous_state: "sealed", state: "sealed", sealed_at: SEALED_AT, sealed_by: ACTOR }],
      [{ tenant_id: TENANT, property_node: PROPERTY, business_date: DAY,
        previous_state: "open", state: "sealed", sealed_at: "not-an-instant", sealed_by: ACTOR }],
    ] as const;
    for (const rows of hostileRows) {
      const proof = harness({ sealRows: rows });
      await expect(proof.service.seal(proof.tx, input())).rejects.toBeInstanceOf(Error);
      expect(proof.evidence().events).toEqual([]);
    }
  });

  test("P2 translates stale/unauthorized/replay failures into the bounded conflict", async () => {
    for (const failure of [
      Object.assign(new Error("database detail must not escape"), { code: "55000" }),
      Object.assign(new Error("permission detail must not escape"), { errno: "42501" }),
      new IdempotencyConflictError("same key, different command"),
    ]) {
      const proof = harness({ idempotencyFailure: failure });
      let thrown: unknown;
      try { await proof.service.seal(proof.tx, input()); } catch (error) { thrown = error; }
      expect(thrown).toBeInstanceOf(BusinessDaySealConflictError);
      expect((thrown as Error).message).not.toContain("database detail");
      expect((thrown as Error).message).not.toContain("permission detail");
    }
  });
});
