import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  BusinessDayCloseReadinessService,
  BusinessDayDiscrepancyCarryOperatorService,
  BusinessDayDiscrepancyCarryService,
} from "../src/contexts/financials";
import { Database, PostgresEventBus, PostgresIdempotency, type EventBus, type IdempotencyCommandResult, type IdempotencyInput, type IdempotencyResult, type JsonValue, type Tx } from "../src/kernel";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_ORDER359 === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Order 359 requires deploy and runtime PostgreSQL URLs");
const databaseDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000035901";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000035902";
const PROPERTY = "00000000-0000-0000-0000-000000035911";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000035913";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000035912";
const REQUESTER = "00000000-0000-0000-0000-000000035921";
const APPROVER = "00000000-0000-0000-0000-000000035922";
const UNAUTHORIZED = "00000000-0000-0000-0000-000000035923";
const INACTIVE = "00000000-0000-0000-0000-000000035924";
const ROLE_REQUEST = "00000000-0000-0000-0000-000000035931";
const ROLE_APPROVE = "00000000-0000-0000-0000-000000035932";
const SPACE = "00000000-0000-0000-0000-000000035941";
const OTHER_SPACE = "00000000-0000-0000-0000-000000035942";
const DISCREPANCY = "00000000-0000-0000-0000-000000035951";
const FOREIGN_DISCREPANCY = "00000000-0000-0000-0000-000000035952";
const OTHER_DISCREPANCY = "00000000-0000-0000-0000-000000035953";
const REUSE_TARGET = "00000000-0000-0000-0000-000000035961";
const REUSE_SOURCE = "00000000-0000-0000-0000-000000035962";
const REUSE_REQUEST = "00000000-0000-0000-0000-000000035963";
const REUSE_REQUEST_2 = "00000000-0000-0000-0000-000000035964";

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let runtimePool: SQL | undefined;
let database: Database | undefined;
let service: BusinessDayDiscrepancyCarryService | undefined;
let operatorService: BusinessDayDiscrepancyCarryOperatorService | undefined;
let eventBus: EventBus | undefined;
let targetDate = "";
let sourceDate = "";

function normalizeDates(value: unknown): JsonValue {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDates(item)]));
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  throw new Error("unexpected non-JSON proof value");
}

class Order359Idempotency extends PostgresIdempotency {
  override execute<T extends JsonValue>(tx: Tx, input: IdempotencyInput, command: (tx: Tx) => Promise<IdempotencyCommandResult<T>>): Promise<IdempotencyResult<T>> {
    return super.execute(tx, input, async (q) => {
      const result = await command(q);
      return { ...result, body: normalizeDates(result.body) as T };
    });
  }
}

async function rejected(operation: () => Promise<unknown>): Promise<void> {
  await expect(operation()).rejects.toThrow();
}

async function counts() {
  const rows = await deploy!<Array<{ carries: number; discrepancies: number; facts: number; events: number; keys: number }>>`
    SELECT
      (SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid) carries,
      (SELECT count(*)::int FROM discrepancy WHERE tenant_id=${TENANT}::uuid) discrepancies,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type='business_day_discrepancy_carry') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND event_type='discrepancy.carried') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='financials.business-day.discrepancy-carry.consume') keys`;
  return rows[0]!;
}

const EXPECTED_CARRY_MUTATION_SURFACES = new Set([
  "api_idempotency", "business_day_discrepancy_carry", "discrepancy", "fact_log", "outbox",
]);

/** Catalogue truth for every tenant-bearing public relation untouched by carry. */
async function tenantRelationCatalogue(): Promise<string[]> {
  const rows = await deploy!<Array<{ relation_name: string }>>`
    SELECT DISTINCT relation.relname relation_name
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
    JOIN pg_catalog.pg_attribute tenant_column
      ON tenant_column.attrelid=relation.oid AND tenant_column.attname='tenant_id'
      AND tenant_column.attnum>0 AND NOT tenant_column.attisdropped
    WHERE namespace.nspname='public' AND relation.relkind IN ('r','p','v','m','f')
    ORDER BY relation.relname`;
  return rows.map((row) => row.relation_name);
}

/** A byte-stable, zero-write snapshot of catalogue-derived tenant-owned rows. */
async function financialSnapshot(relations: readonly string[]): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const table of relations) {
    const rows = await deploy!.unsafe<Array<{ bytes: string }>>(`
      SELECT encode(convert_to(COALESCE(
        string_agg(pg_catalog.row_to_json(t)::text, E'\\n' ORDER BY pg_catalog.row_to_json(t)::text), ''
      ), 'UTF8'), 'hex') AS bytes
      FROM public.${table} AS t
      WHERE t.tenant_id='${TENANT}'::uuid
    `);
    snapshot[table] = rows[0]?.bytes ?? "";
  }
  return snapshot;
}

async function assertFinancialSnapshotSurface(snapshot: Record<string, string>, relations: readonly string[]): Promise<void> {
  expect(Object.keys(snapshot).sort()).toEqual([...relations].sort());
  const observed = JSON.stringify(Object.keys(snapshot));
  const missing = await deploy!<Array<{ relation_name: string }>>`
    SELECT DISTINCT relation.relname relation_name
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
    JOIN pg_catalog.pg_attribute tenant_column
      ON tenant_column.attrelid=relation.oid AND tenant_column.attname='tenant_id'
      AND tenant_column.attnum>0 AND NOT tenant_column.attisdropped
    WHERE namespace.nspname='public' AND relation.relkind IN ('r','p','v','m','f')
      AND NOT relation.relname=ANY(ARRAY(SELECT jsonb_array_elements_text(${observed}::jsonb)))
    ORDER BY relation.relname`;
  expect(missing).toEqual([]);
  expect(relations).toContain("folio_balance");
  for (const table of relations) expect(typeof snapshot[table]).toBe("string");
}

function stableBodyBytes(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableBodyBytes).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableBodyBytes((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function expectRuntimeDenied(statement: string): Promise<void> {
  const connection = await runtimePool!.reserve();
  try {
    await connection.unsafe("BEGIN");
    await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
    await connection.unsafe("SET LOCAL ROLE app_role");
    try {
      await connection.unsafe(statement);
      throw new Error(`expected runtime denial for ${statement}`);
    } catch (error) {
      expect(error).toMatchObject({ errno: "42501" });
    } finally {
      await connection.unsafe("ROLLBACK");
    }
  } finally {
    connection.release();
  }
}

async function injectBoundaryFailure(boundary: "transition" | "target" | "carry-link" | "fact" | "deferred-commit", operation: () => Promise<unknown>): Promise<void> {
  const trigger = `order359_fail_${boundary.replaceAll("-", "_")}`;
  await deploy!.unsafe(`
    CREATE OR REPLACE FUNCTION public.order359_test_boundary_failure() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'order359 injected ${boundary} failure'; END $$
  `);
  if (boundary === "transition") {
    await deploy!.unsafe(`CREATE TRIGGER ${trigger} AFTER UPDATE ON public.discrepancy
      FOR EACH ROW WHEN (NEW.tenant_id='${TENANT}'::uuid AND NEW.resolution='carried_forward')
      EXECUTE FUNCTION public.order359_test_boundary_failure()`);
  } else if (boundary === "target") {
    await deploy!.unsafe(`CREATE TRIGGER ${trigger} AFTER INSERT ON public.discrepancy
      FOR EACH ROW WHEN (NEW.tenant_id='${TENANT}'::uuid AND NEW.reported_by='${REQUESTER}'::uuid)
      EXECUTE FUNCTION public.order359_test_boundary_failure()`);
  } else if (boundary === "carry-link" || boundary === "deferred-commit") {
    const kind = boundary === "deferred-commit" ? "CONSTRAINT " : "";
    const deferred = boundary === "deferred-commit" ? " DEFERRABLE INITIALLY DEFERRED" : "";
    await deploy!.unsafe(`CREATE ${kind}TRIGGER ${trigger} AFTER INSERT ON public.business_day_discrepancy_carry
      ${deferred} FOR EACH ROW EXECUTE FUNCTION public.order359_test_boundary_failure()`);
  } else {
    await deploy!.unsafe(`CREATE TRIGGER ${trigger} AFTER INSERT ON public.fact_log
      FOR EACH ROW WHEN (NEW.tenant_id='${TENANT}'::uuid AND NEW.entity_type='business_day_discrepancy_carry')
      EXECUTE FUNCTION public.order359_test_boundary_failure()`);
  }
  try {
    await expect(operation()).rejects.toThrow(`order359 injected ${boundary}`);
  } finally {
    await deploy!.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON public.${boundary === "transition" || boundary === "target" ? "discrepancy" : boundary === "fact" ? "fact_log" : "business_day_discrepancy_carry"}`);
    await deploy!.unsafe("DROP FUNCTION IF EXISTS public.order359_test_boundary_failure()");
  }
}

async function resetCase(): Promise<void> {
  await deploy!.begin(async (tx) => {
    await tx`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid AND user_id=${REQUESTER}::uuid AND scope_node=${OTHER_PROPERTY}::uuid`;
    await tx`UPDATE org_node SET timezone='UTC' WHERE id=${PROPERTY}::uuid`;
    await tx`UPDATE space SET property_node=${PROPERTY}::uuid WHERE id=${SPACE}::uuid`;
    await tx`UPDATE app_user SET status='active' WHERE tenant_id=${TENANT}::uuid AND id IN (${REQUESTER}::uuid,${APPROVER}::uuid,${UNAUTHORIZED}::uuid,${INACTIVE}::uuid)`;
    await tx`DELETE FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM approval_request WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM discrepancy WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM business_day WHERE tenant_id=${TENANT}::uuid`;
    await tx`INSERT INTO business_day(tenant_id,property_node,business_date)
      VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${sourceDate}::date),
            (${TENANT}::uuid,${PROPERTY}::uuid,${targetDate}::date),
            (${TENANT}::uuid,${OTHER_PROPERTY}::uuid,${sourceDate}::date),
            (${TENANT}::uuid,${OTHER_PROPERTY}::uuid,${targetDate}::date)`;
    await tx`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
      VALUES(${DISCREPANCY}::uuid,${TENANT}::uuid,${SPACE}::uuid,'occupied','vacant',${REQUESTER}::uuid)`;
    await tx`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload)
      VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${sourceDate}::date,'discrepancy',${DISCREPANCY}::uuid,
        'discrepancy.reported',${REQUESTER}::uuid,gen_random_uuid(),'{}'::jsonb)`;
  });
}

async function requestApproval(): Promise<{ approvalId: string; requestHash: string }> {
  const result = await database!.withTenantTransaction(TENANT, (tx) => service!.requestApproval(tx, {
    tenantId: TENANT, propertyNode: PROPERTY, discrepancyId: DISCREPANCY,
    sourceBusinessDate: sourceDate, targetBusinessDate: targetDate,
    reason: "Order 359 hostile proof", idempotencyKey: `order359-request-${crypto.randomUUID()}`,
    envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER,
      requestId: crypto.randomUUID(), operation: "approval.requested" },
  }));
  return { approvalId: result.approvalId, requestHash: result.requestHash };
}

async function requestApprovals(count: number): Promise<readonly string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push((await requestApproval()).approvalId);
  }
  return ids;
}

async function decide(approvalId: string, options: { status?: string; decider?: string; offset?: string } = {}) {
  await deploy!`UPDATE approval_request
    SET status=${options.status ?? "approved"}, decided_by=${options.decider ?? APPROVER}::uuid,
        decided_at=transaction_timestamp()+${options.offset ?? "0 seconds"}::interval
    WHERE tenant_id=${TENANT}::uuid AND id=${approvalId}::uuid`;
}

async function carry(approvalId: string, requestHash: string, key = `order359-carry-${crypto.randomUUID()}`) {
  return carryAs(approvalId, requestHash, { key });
}

async function carryAs(approvalId: string, requestHash: string, options: {
  key?: string; tenantId?: string; actorId?: string; propertyNode?: string; requestId?: string;
} = {}) {
  const tenantId = options.tenantId ?? TENANT;
  return database!.withTenantTransaction(tenantId, (tx) => service!.carry(tx, {
    tenantId, approvalId, expectedRequestHash: requestHash, idempotencyKey: options.key ?? `order359-carry-${crypto.randomUUID()}`,
    envelope: { tenantId, propertyNode: options.propertyNode ?? PROPERTY, actorId: options.actorId ?? REQUESTER, requestId: options.requestId ?? crypto.randomUUID(), operation: "discrepancy.carried" },
  }));
}

async function insertCarryFixture(approvalId: string, values: {
  readonly requestId: string;
  readonly sourceDiscrepancyId: string;
  readonly targetDiscrepancyId: string;
}): Promise<void> {
  await deploy!`INSERT INTO business_day_discrepancy_carry(
    tenant_id,request_id,property_node,source_discrepancy_id,target_discrepancy_id,
    source_business_date,target_business_date,target_opened_at,space_id,discrepancy_state_hash,
    reason,request_hash,approval_request_id,requested_by,approved_by,approval_requested_at,approval_decided_at
  )
  SELECT ${TENANT}::uuid,${values.requestId}::uuid,${PROPERTY}::uuid,
    ${values.sourceDiscrepancyId}::uuid,${values.targetDiscrepancyId}::uuid,
    ${sourceDate}::date,${targetDate}::date,day.opened_at,${SPACE}::uuid,
    approval.payload->>'discrepancyStateHash','Order 366 reuse fixture',approval.payload->>'requestHash',
    approval.id,approval.requested_by,approval.decided_by,approval.created_at,approval.decided_at
  FROM approval_request approval
  CROSS JOIN business_day day
  WHERE approval.tenant_id=${TENANT}::uuid AND approval.id=${approvalId}::uuid
    AND day.tenant_id=${TENANT}::uuid AND day.property_node=${PROPERTY}::uuid AND day.business_date=${targetDate}::date`;
}

async function insertReuseDiscrepancies(): Promise<void> {
  await deploy!`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by,resolved_at,resolution)
    VALUES
      (${REUSE_TARGET}::uuid,${TENANT}::uuid,${SPACE}::uuid,'occupied','vacant',${REQUESTER}::uuid,transaction_timestamp(),'carried_forward'),
      (${REUSE_SOURCE}::uuid,${TENANT}::uuid,${SPACE}::uuid,'occupied','vacant',${REQUESTER}::uuid,transaction_timestamp(),'carried_forward')`;
}

async function expectSqlState(operation: () => Promise<unknown>, state: string): Promise<void> {
  try { await operation(); } catch (error) {
    expect(error).toMatchObject({ errno: state });
    return;
  }
  throw new Error(`expected PostgreSQL ${state}`);
}

databaseDescribe("Order 359 fresh PostgreSQL hostile discrepancy-carry proof", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY!, { max: 6, prepare: false });
    runtime = new SQL(RUNTIME!, { max: 6, prepare: false });
    runtimePool = new SQL(RUNTIME!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME!, { maxConnections: 8, prepare: false });
    const canonicalEvents = new PostgresEventBus(runtimePool);
    const normalizingEvents: EventBus = {
      publish: (tx, event) => {
        const value = (event as unknown as { businessDate: unknown }).businessDate;
        const businessDate = typeof value === "string" ? value : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
        return canonicalEvents.publish(tx, { ...event, businessDate });
      },
      consumeBatch: (...args) => canonicalEvents.consumeBatch(...args),
    };
    eventBus = normalizingEvents;
    service = new BusinessDayDiscrepancyCarryService({ events: normalizingEvents, idempotency: new Order359Idempotency() });
    operatorService = new BusinessDayDiscrepancyCarryOperatorService({ events: normalizingEvents, idempotency: new Order359Idempotency() });
    targetDate = (await deploy<Array<{ d: string }>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
    sourceDate = (await deploy<Array<{ d: string }>>`SELECT (${targetDate}::date - 1)::text d`)[0]!.d;
    await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order359','Order 359','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order359-foreign','Order 359 foreign','shared','active')`;
    await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order359','property','Order 359','UTC','USD'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order359.other','property','Order 359 other','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order359f','property','Order 359 foreign','UTC','USD')`;
    await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${REQUESTER}::uuid,${TENANT}::uuid,'requester@order359.test','Order 359 requester','active'),
      (${APPROVER}::uuid,${TENANT}::uuid,'approver@order359.test','Order 359 approver','active'),
      (${UNAUTHORIZED}::uuid,${TENANT}::uuid,'unauthorized@order359.test','Order 359 unauthorized','active'),
      (${INACTIVE}::uuid,${TENANT}::uuid,'inactive@order359.test','Order 359 inactive','inactive')`;
    await deploy!`INSERT INTO permission(code,description) VALUES
      ('financials.business-day:carry-discrepancy','Order 359 carry'),
      ('financials.business-day:approve-discrepancy-carry','Order 359 approve') ON CONFLICT DO NOTHING`;
    await deploy!`INSERT INTO role(id,tenant_id,name) VALUES
      (${ROLE_REQUEST}::uuid,${TENANT}::uuid,'Order 359 requester'),
      (${ROLE_APPROVE}::uuid,${TENANT}::uuid,'Order 359 approver')`;
    await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES
      (${ROLE_REQUEST}::uuid,'financials.business-day:carry-discrepancy'),
      (${ROLE_APPROVE}::uuid,'financials.business-day:approve-discrepancy-carry')`;
    await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
      (${TENANT}::uuid,${REQUESTER}::uuid,${ROLE_REQUEST}::uuid,${PROPERTY}::uuid),
      (${TENANT}::uuid,${APPROVER}::uuid,${ROLE_APPROVE}::uuid,${PROPERTY}::uuid),
      (${TENANT}::uuid,${INACTIVE}::uuid,${ROLE_APPROVE}::uuid,${PROPERTY}::uuid)`;
    await deploy!`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status) VALUES
      (${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'ORDER359','hotel',1,'active'),
      (${OTHER_SPACE}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'ORDER355OTHER','hotel',1,'active')`;
    await resetCase();
  }, 40_000);

  beforeEach(async () => { await resetCase(); });

  afterAll(async () => {
    if (!deploy) return;
    await deploy`DELETE FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM api_idempotency WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM approval_request WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM discrepancy WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM space WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM user_role WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM role_permission WHERE role_id IN (${ROLE_REQUEST}::uuid,${ROLE_APPROVE}::uuid)`;
    await deploy`DELETE FROM role WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
    await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await database?.close(); await runtimePool?.close({ timeout: 0 }); await runtime?.close({ timeout: 0 }); await deploy?.close({ timeout: 0 });
  });

  test("Order 387 operator facade derives authority and completes request, inbox, decision, carry and replay", async () => {
    const requested = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.requestApproval(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, sourceBusinessDate: sourceDate, discrepancyId: DISCREPANCY,
      reason: "Order 387 operator proof", idempotencyKey: "order387-request-happy",
      envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "approval.requested" },
    }));
    const checkerInbox = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER,
    }));
    expect(checkerInbox.nextCursor).toBeNull();
    expect(checkerInbox.approvals).toHaveLength(1);
    expect(checkerInbox.approvals[0]).toMatchObject({
      approvalId: requested.approvalId, sourceDiscrepancyId: DISCREPANCY, sourceBusinessDate: sourceDate,
      targetBusinessDate: targetDate, roomCode: "ORDER359", reason: "Order 387 operator proof",
      requesterLabel: "Order 359 requester", status: "pending", canDecide: true, canCarry: false,
    });
    expect(checkerInbox.approvals[0]).not.toHaveProperty("payload");
    expect(checkerInbox.approvals[0]).not.toHaveProperty("requestHash");

    const decisionInput = {
      tenantId: TENANT, propertyNode: PROPERTY, approvalId: requested.approvalId, decision: "approved" as const,
      idempotencyKey: "order387-decision-happy",
      envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER, requestId: crypto.randomUUID(), operation: "approval.decided" },
    };
    const decision = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.decideApproval(tx, decisionInput));
    expect(decision).toMatchObject({ approvalId: requested.approvalId, status: "approved", replayed: false });
    const replayedDecision = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.decideApproval(tx, decisionInput));
    expect(replayedDecision).toEqual({ ...decision, replayed: true });

    const makerInbox = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER,
    }));
    expect(makerInbox.approvals[0]).toMatchObject({ status: "approved", canDecide: false, canCarry: true });
    const carryInput = {
      tenantId: TENANT, propertyNode: PROPERTY, approvalId: requested.approvalId, idempotencyKey: "order387-carry-happy",
      envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
    };
    const carried = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.carry(tx, carryInput));
    expect(carried).toMatchObject({ sourceDiscrepancyId: DISCREPANCY, propertyNode: PROPERTY, sourceBusinessDate: sourceDate, targetBusinessDate: targetDate, replayed: false });
    const replayedCarry = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.carry(tx, carryInput));
    expect(replayedCarry).toEqual({ ...carried, replayed: true });
  });

  test("Order 395 executes default-50, explicit-100 and non-null cursor continuation over 101 stored approvals", async () => {
    const approvalIds = await requestApprovals(101);
    const list = (after?: string, limit?: number) => database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER,
      ...(after === undefined ? {} : { after }), ...(limit === undefined ? {} : { limit }),
    }));

    const defaultPage = await list();
    expect(defaultPage.approvals).toHaveLength(50);
    expect(defaultPage.nextCursor).toBeString();
    const defaultContinuation = await list(defaultPage.nextCursor!);
    expect(defaultContinuation.approvals).toHaveLength(50);
    expect(defaultContinuation.nextCursor).toBeString();
    const defaultTail = await list(defaultContinuation.nextCursor!);
    expect(defaultTail.approvals).toHaveLength(1);
    expect(defaultTail.nextCursor).toBeNull();
    expect(new Set([...defaultPage.approvals, ...defaultContinuation.approvals, ...defaultTail.approvals].map((row) => row.approvalId))).toEqual(new Set(approvalIds));

    const maximumPage = await list(undefined, 100);
    expect(maximumPage.approvals).toHaveLength(100);
    expect(maximumPage.nextCursor).toBeString();
    const maximumTail = await list(maximumPage.nextCursor!, 100);
    expect(maximumTail.approvals.map((row) => row.approvalId)).toEqual([approvalIds[0]!]);
    expect(maximumTail.nextCursor).toBeNull();
  }, 40_000);

  test("Order 395 keyset continuation is total for equal created_at ties", async () => {
    const approvalIds = await requestApprovals(7);
    const encodedApprovalIds = JSON.stringify(approvalIds);
    await deploy!`UPDATE approval_request SET created_at='2026-09-03T00:00:00.000000Z'::timestamptz
      WHERE tenant_id=${TENANT}::uuid AND id=ANY(ARRAY(SELECT jsonb_array_elements_text(${encodedApprovalIds}::jsonb)::uuid))`;
    const expected = [...approvalIds].sort().reverse();
    const first = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER, limit: 3,
    }));
    const second = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER, limit: 3, after: first.nextCursor!,
    }));
    const third = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER, limit: 3, after: second.nextCursor!,
    }));
    expect([...first.approvals, ...second.approvals, ...third.approvals].map((row) => row.approvalId)).toEqual(expected);
    expect([first.approvals.length, second.approvals.length, third.approvals.length]).toEqual([3, 3, 1]);
    expect(third.nextCursor).toBeNull();
  });

  test("Order 395 validates the actual MAX+1 row and fails the complete page closed for malformed stored evidence", async () => {
    const approvalIds = await requestApprovals(101);
    const encodedApprovalIds = JSON.stringify(approvalIds);
    await deploy!`UPDATE approval_request SET created_at='2026-09-03T00:00:00.000000Z'::timestamptz
      WHERE tenant_id=${TENANT}::uuid AND id=ANY(ARRAY(SELECT jsonb_array_elements_text(${encodedApprovalIds}::jsonb)::uuid))`;
    const overflowId = [...approvalIds].sort()[0]!;
    await deploy!`UPDATE approval_request SET payload=payload-'requestHash'
      WHERE tenant_id=${TENANT}::uuid AND id=${overflowId}::uuid`;
    await expect(database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER, limit: 100,
    }))).rejects.toThrow("Business-day discrepancy carry approval is unavailable");
  }, 40_000);

  test("Order 395 inbox is tenant/property-contained and exposes only the minimized contract", async () => {
    const requested = await requestApproval();
    await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${TENANT}::uuid,${REQUESTER}::uuid,${ROLE_REQUEST}::uuid,${OTHER_PROPERTY}::uuid)`;
    await deploy!`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
      VALUES(${OTHER_DISCREPANCY}::uuid,${TENANT}::uuid,${OTHER_SPACE}::uuid,'occupied','vacant',${REQUESTER}::uuid)`;
    await deploy!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload) VALUES(${TENANT}::uuid,${OTHER_PROPERTY}::uuid,${sourceDate}::date,
      'discrepancy',${OTHER_DISCREPANCY}::uuid,'discrepancy.reported',${REQUESTER}::uuid,gen_random_uuid(),'{}'::jsonb)`;
    const siblingRequested = await database!.withTenantTransaction(TENANT, (tx) => service!.requestApproval(tx, {
      tenantId: TENANT, propertyNode: OTHER_PROPERTY, discrepancyId: OTHER_DISCREPANCY,
      sourceBusinessDate: sourceDate, targetBusinessDate: targetDate, reason: "Order 395 sibling containment",
      idempotencyKey: "order395-sibling-request",
      envelope: { tenantId: TENANT, propertyNode: OTHER_PROPERTY, actorId: REQUESTER,
        requestId: crypto.randomUUID(), operation: "approval.requested" },
    }));
    const page = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER,
    }));
    expect(page.approvals).toHaveLength(1);
    expect(page.approvals[0]!.approvalId).toBe(requested.approvalId);
    expect(Object.keys(page.approvals[0]!).sort()).toEqual([
      "approvalId", "canCarry", "canDecide", "decidedAt", "expiresAt", "reason", "requestedAt",
      "requesterLabel", "roomCode", "sourceBusinessDate", "sourceDiscrepancyId", "status", "targetBusinessDate",
    ]);
    expect(stableBodyBytes(page)).not.toContain("requestHash");
    expect(stableBodyBytes(page)).not.toContain("discrepancyStateHash");
    expect(stableBodyBytes(page)).not.toContain("@example.test");
    expect(stableBodyBytes(page)).not.toContain("financials.business-day");
    const sibling = await database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: OTHER_PROPERTY, actorId: APPROVER,
    }));
    expect(sibling.approvals.map((row) => row.approvalId)).toEqual([siblingRequested.approvalId]);
    expect(sibling.approvals[0]!.sourceDiscrepancyId).toBe(OTHER_DISCREPANCY);
    const foreign = await database!.withTenantTransaction(FOREIGN_TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: FOREIGN_TENANT, propertyNode: FOREIGN_PROPERTY, actorId: APPROVER,
    }));
    expect(foreign).toEqual({ approvals: [], nextCursor: null });
  });

  test("Order 395 fails a one-row inbox closed for malformed stored payload shape", async () => {
    const requested = await requestApproval();
    await deploy!`UPDATE approval_request SET payload=jsonb_set(payload,'{reason}','null'::jsonb)
      WHERE tenant_id=${TENANT}::uuid AND id=${requested.approvalId}::uuid`;
    await expect(database!.withTenantTransaction(TENANT, (tx) => operatorService!.listApprovals(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, actorId: APPROVER,
    }))).rejects.toThrow("Business-day discrepancy carry approval is unavailable");
  });

  test("rejects a future decision and accepts past and transaction-time decisions", async () => {
    const future = await requestApproval();
    await decide(future.approvalId, { offset: "20 minutes" });
    await rejected(() => carry(future.approvalId, future.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });

    await resetCase();
    const past = await requestApproval(); await decide(past.approvalId, { offset: "-1 second" });
    expect((await carry(past.approvalId, past.requestHash)).replayed).toBe(false);
    await resetCase();
    const now = await requestApproval(); await decide(now.approvalId, { offset: "0 seconds" });
    expect((await carry(now.approvalId, now.requestHash)).replayed).toBe(false);
  });

  test("rejects exact expiry, later, pending, rejected, self and unauthorized decisions", async () => {
    const cases = [
      { status: "approved", offset: "-29 minutes", created: "-30 minutes" },
      { status: "approved", offset: "-31 minutes", created: "-31 minutes" },
      { status: "pending", decider: APPROVER },
      { status: "rejected", offset: "0 seconds" },
      { status: "approved", decider: REQUESTER },
      { status: "approved", decider: UNAUTHORIZED },
    ];
    for (const item of cases) {
      await resetCase(); const approval = await requestApproval();
      if (item.created) await deploy!`UPDATE approval_request SET created_at=transaction_timestamp()+${item.created}::interval WHERE id=${approval.approvalId}::uuid`;
      if (item.status !== "pending") await decide(approval.approvalId, item);
      await rejected(() => carry(approval.approvalId, approval.requestHash));
      expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    }
  });

  test("fails closed for payload, source, lineage and target staleness", async () => {
    const approval = await requestApproval(); await decide(approval.approvalId);
    await deploy!`UPDATE approval_request SET payload=jsonb_set(payload,'{requestHash}',${JSON.stringify("0".repeat(64))}::jsonb) WHERE id=${approval.approvalId}::uuid`;
    await rejected(() => carry(approval.approvalId, approval.requestHash));
    await resetCase();
    const source = await requestApproval(); await decide(source.approvalId); await deploy!`UPDATE discrepancy SET reported='vacant' WHERE id=${DISCREPANCY}::uuid`;
    await rejected(() => carry(source.approvalId, source.requestHash));
    await resetCase();
    const lineage = await requestApproval(); await decide(lineage.approvalId); await deploy!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${sourceDate}::date,'discrepancy',${DISCREPANCY}::uuid,'discrepancy.reported',${REQUESTER}::uuid,gen_random_uuid(),'{}')`;
    await rejected(() => carry(lineage.approvalId, lineage.requestHash));
    await resetCase();
    const target = await requestApproval(); await decide(target.approvalId); await deploy!`UPDATE business_day SET opened_at=opened_at+interval '1 second' WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${targetDate}::date`;
    await rejected(() => carry(target.approvalId, target.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
  });

  test("rejects inactive actors, sealed days and changed property-time authority", async () => {
    const inactive = await requestApproval(); await decide(inactive.approvalId); await deploy!`UPDATE app_user SET status='inactive' WHERE id=${REQUESTER}::uuid`;
    await rejected(() => carry(inactive.approvalId, inactive.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    await resetCase();
    const sealedTarget = await requestApproval(); await decide(sealedTarget.approvalId); await deploy!`UPDATE business_day SET sealed_at=transaction_timestamp(),sealed_by=${APPROVER}::uuid WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${targetDate}::date`;
    await rejected(() => carry(sealedTarget.approvalId, sealedTarget.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    await resetCase();
    const sealedSource = await requestApproval(); await decide(sealedSource.approvalId); await deploy!`UPDATE business_day SET sealed_at=transaction_timestamp(),sealed_by=${APPROVER}::uuid WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${sourceDate}::date`;
    await rejected(() => carry(sealedSource.approvalId, sealedSource.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    await resetCase();
    const timezone = await requestApproval(); await decide(timezone.approvalId); await deploy!`UPDATE org_node SET timezone='Invalid/Order359' WHERE id=${PROPERTY}::uuid`;
    await rejected(() => carry(timezone.approvalId, timezone.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
  });

  test("success is atomic, immutable, one-use and financially isolated", async () => {
    const approval = await requestApproval(); await decide(approval.approvalId);
    const relations = await tenantRelationCatalogue();
    const before = await financialSnapshot(relations);
    await assertFinancialSnapshotSurface(before, relations);
    const beforeDays = await deploy!<Array<{ business_date: string; opened_at: string; sealed_at: string | null }>>`SELECT business_date::text,opened_at::text,sealed_at::text FROM business_day WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid ORDER BY business_date`;
    const result = await carry(approval.approvalId, approval.requestHash, "order359-replay-key");
    expect(result).toMatchObject({ sourceDiscrepancyId: DISCREPANCY, targetBusinessDate: `${targetDate}T00:00:00.000Z`, resolution: "carried_forward", replayed: false });
    const replay = await database!.withTenantTransaction(TENANT, (tx) => service!.carry(tx, {
      tenantId: TENANT, approvalId: approval.approvalId, expectedRequestHash: approval.requestHash,
      idempotencyKey: "order359-replay-key", envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
    }));
    expect(replay).toMatchObject({ carryId: result.carryId, replayed: true });
    await rejected(() => carry(approval.approvalId, "0".repeat(64)));
    await rejected(() => carry(approval.approvalId, approval.requestHash));
    expect(await deploy!<Array<{ resolved: boolean; resolution: string }>>`SELECT resolved_at IS NOT NULL resolved,resolution FROM discrepancy WHERE id=${DISCREPANCY}::uuid`).toEqual([{ resolved: true, resolution: "carried_forward" }]);
    expect(await deploy!<Array<{ carries: number; resolved: number; source: number }>>`SELECT count(*)::int carries,count(*) FILTER (WHERE resolution='carried_forward')::int resolved,count(*) FILTER (WHERE source_discrepancy_id=${DISCREPANCY}::uuid)::int source FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`).toEqual([{ carries: 1, resolved: 1, source: 1 }]);
    expect(await deploy!<Array<{ business_date: string; opened_at: string; sealed_at: string | null }>>`SELECT business_date::text,opened_at::text,sealed_at::text FROM business_day WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid ORDER BY business_date`).toEqual(beforeDays);
    await expect(runtime!.begin(async tx => { await tx`SELECT set_config('app.tenant_id',${TENANT},true)`; await tx.unsafe("SET LOCAL ROLE app_role"); return tx`INSERT INTO business_day_discrepancy_carry(tenant_id,request_id,property_node,source_discrepancy_id,target_discrepancy_id,source_business_date,target_business_date,target_opened_at,space_id,discrepancy_state_hash,reason,request_hash,approval_request_id,requested_by,approved_by,approval_requested_at,approval_decided_at) VALUES(${TENANT}::uuid,gen_random_uuid(),${PROPERTY}::uuid,${DISCREPANCY}::uuid,gen_random_uuid(),${sourceDate}::date,${targetDate}::date,now(),${SPACE}::uuid,${"0".repeat(64)},'raw',${"0".repeat(64)},${approval.approvalId}::uuid,${REQUESTER}::uuid,${APPROVER}::uuid,now(),now())` })).rejects.toThrow();
    const after = await financialSnapshot(relations);
    await assertFinancialSnapshotSurface(after, relations);
    const changed = relations.filter((relation) => after[relation] !== before[relation]);
    expect(changed.sort()).toEqual([...EXPECTED_CARRY_MUTATION_SURFACES].sort());
    for (const relation of relations.filter((name) => !EXPECTED_CARRY_MUTATION_SURFACES.has(name))) {
      expect(after[relation]).toBe(before[relation]);
    }
  });

  test("carried target is a safely attributed readiness blocker", async () => {
    const approval = await requestApproval();
    await decide(approval.approvalId);
    const result = await carry(approval.approvalId, approval.requestHash, "order355-readiness-lineage");
    const readiness = new BusinessDayCloseReadinessService({ database: database! });

    const target = await readiness.read({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate: targetDate,
      actorId: REQUESTER,
    });
    expect(result.targetBusinessDate).toBe(`${targetDate}T00:00:00.000Z`);
    expect(target.counts.unresolvedDiscrepancies).toBe(1);
    expect(target.counts.unknownAttribution).toBe(0);
    expect(target.reasons).toContainEqual({
      code: "unresolved_discrepancy",
      source: "discrepancies",
      count: 1,
    });
    expect(target.ready).toBe(false);

    const source = await readiness.read({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate: sourceDate,
      actorId: REQUESTER,
    });
    expect(source.counts.unresolvedDiscrepancies).toBe(0);
    expect(source.counts.unknownAttribution).toBe(0);

    const otherProperty = await readiness.read({
      tenantId: TENANT,
      propertyNode: OTHER_PROPERTY,
      businessDate: targetDate,
      actorId: REQUESTER,
    });
    expect(otherProperty.counts.unresolvedDiscrepancies).toBe(0);
    expect(otherProperty.counts.unknownAttribution).toBe(0);
  });

  test("fails closed when carried source date disagrees with the canonical source report event", async () => {
    const readiness = new BusinessDayCloseReadinessService({ database: database! });
    await resetCase();
    const approval = await requestApproval();
    await decide(approval.approvalId);
    await carry(approval.approvalId, approval.requestHash);

    const thirdDate = (await deploy!<Array<{ d: string }>>`
      SELECT (${sourceDate}::date - 1)::text AS d`)[0]!.d;
    await deploy!`INSERT INTO business_day(tenant_id,property_node,business_date)
      VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${thirdDate}::date)`;

    await deploy!`WITH canonical AS (
      SELECT carry.id,
        encode(digest(jsonb_build_object(
          'v',1,'tenantId',carry.tenant_id,'propertyNode',carry.property_node,
          'discrepancyId',source_discrepancy.id,
          'sourceBusinessDate',${thirdDate}::date,
          'targetBusinessDate',carry.target_business_date,'reason',carry.reason,
          'discrepancyStateHash',carry.discrepancy_state_hash,
          'targetOpenedAt',carry.target_opened_at
        )::text,'sha256'),'hex') AS request_hash
      FROM business_day_discrepancy_carry AS carry
      JOIN discrepancy AS source_discrepancy
        ON source_discrepancy.tenant_id=carry.tenant_id
       AND source_discrepancy.id=carry.source_discrepancy_id
      WHERE carry.tenant_id=${TENANT}::uuid
    )
    UPDATE business_day_discrepancy_carry AS carry
       SET source_business_date=${thirdDate}::date,
           request_hash=canonical.request_hash
      FROM canonical
     WHERE carry.tenant_id=${TENANT}::uuid AND carry.id=canonical.id`;

    const snapshot = await readiness.read({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate: targetDate,
      actorId: REQUESTER,
    });
    expect(snapshot.counts.unresolvedDiscrepancies).toBe(0);
    expect(snapshot.counts.unknownAttribution).toBeGreaterThanOrEqual(1);
    expect(snapshot.ready).toBe(false);
  });

  test("carried readiness fails closed for missing, mixed or mismatched typed lineage and ignores payload", async () => {
    const readiness = new BusinessDayCloseReadinessService({ database: database! });
    const readTarget = () => readiness.read({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      businessDate: targetDate,
      actorId: REQUESTER,
    });
    const carried = async () => {
      await resetCase();
      const approval = await requestApproval();
      await decide(approval.approvalId);
      return carry(approval.approvalId, approval.requestHash);
    };
    const unknownAfter = async (mutation: (targetId: string) => Promise<unknown>) => {
      const result = await carried();
      await mutation(result.targetDiscrepancyId);
      const snapshot = await readTarget();
      expect(snapshot.counts.unresolvedDiscrepancies).toBe(0);
      expect(snapshot.counts.unknownAttribution).toBeGreaterThanOrEqual(1);
      expect(snapshot.ready).toBe(false);
    };

    await unknownAfter(() => deploy!`DELETE FROM outbox
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${DISCREPANCY}::uuid
        AND event_type='discrepancy.reported'`);
    await unknownAfter(() => deploy!`INSERT INTO outbox(
      tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload
    ) SELECT tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,
        gen_random_uuid(),payload FROM outbox
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${DISCREPANCY}::uuid
        AND event_type='discrepancy.reported'`);
    await unknownAfter(() => deploy!`UPDATE outbox SET aggregate_type='unsupported'
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${DISCREPANCY}::uuid
        AND event_type='discrepancy.reported'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET aggregate_id=${targetId}::uuid
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${DISCREPANCY}::uuid
        AND event_type='discrepancy.reported'`);
    await unknownAfter(() => deploy!`UPDATE outbox SET property_node=${OTHER_PROPERTY}::uuid
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${DISCREPANCY}::uuid
        AND event_type='discrepancy.reported'`);
    await unknownAfter(() => deploy!`UPDATE outbox SET business_date=${targetDate}::date
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${DISCREPANCY}::uuid
        AND event_type='discrepancy.reported'`);
    await unknownAfter((targetId) => deploy!`DELETE FROM outbox
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter(() => deploy!`DELETE FROM business_day_discrepancy_carry
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter((targetId) => deploy!`INSERT INTO outbox(
      tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload
    ) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${targetDate}::date,'discrepancy',${targetId}::uuid,
      'discrepancy.reported',${REQUESTER}::uuid,gen_random_uuid(),'{}')`);
    await unknownAfter((targetId) => deploy!`INSERT INTO outbox(
      tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload
    ) SELECT tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,
        gen_random_uuid(),payload FROM outbox
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET aggregate_type='unsupported'
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET aggregate_id=${DISCREPANCY}::uuid
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET property_node=${OTHER_PROPERTY}::uuid
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET business_date=${sourceDate}::date
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET actor_id=${APPROVER}::uuid
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET correlation_id=gen_random_uuid()
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter((targetId) => deploy!`UPDATE outbox SET created_at=created_at+interval '1 microsecond'
      WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${targetId}::uuid AND event_type='discrepancy.carried'`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET source_discrepancy_id=target_discrepancy_id
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET source_business_date=target_business_date
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET target_business_date=source_business_date
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET property_node=${OTHER_PROPERTY}::uuid
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET space_id=${OTHER_SPACE}::uuid
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET target_opened_at=target_opened_at+interval '1 microsecond'
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET request_id=gen_random_uuid()
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET carried_at=carried_at+interval '1 microsecond'
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET discrepancy_state_hash=${"0".repeat(64)}
      WHERE tenant_id=${TENANT}::uuid`);
    await unknownAfter(() => deploy!`UPDATE business_day_discrepancy_carry
      SET request_hash=${"0".repeat(64)}
      WHERE tenant_id=${TENANT}::uuid`);

    const payloadResult = await carried();
    await deploy!`UPDATE outbox SET payload=jsonb_build_object(
        'tenant_id',${FOREIGN_TENANT}::text,'property_node',${OTHER_PROPERTY}::text,
        'target_discrepancy_id',${DISCREPANCY}::text,'request_hash',${"0".repeat(64)}::text
      ) WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${payloadResult.targetDiscrepancyId}::uuid
        AND event_type='discrepancy.carried'`;
    const relations = await tenantRelationCatalogue();
    const before = await financialSnapshot(relations);
    const payloadIgnored = await readTarget();
    const after = await financialSnapshot(relations);
    expect(payloadIgnored.counts.unresolvedDiscrepancies).toBe(1);
    expect(payloadIgnored.counts.unknownAttribution).toBe(0);
    expect(after).toEqual(before);

    await deploy!`UPDATE discrepancy SET resolved_at=transaction_timestamp(),resolution='verified'
      WHERE tenant_id=${TENANT}::uuid AND id=${payloadResult.targetDiscrepancyId}::uuid`;
    const resolved = await readTarget();
    expect(resolved.counts.unresolvedDiscrepancies).toBe(0);
    expect(resolved.counts.unknownAttribution).toBe(0);
  });

  test("rolls back after every governed boundary and permits one clean retry", async () => {
    for (const boundary of ["transition", "target", "carry-link", "fact", "event", "deferred-commit"] as const) {
      await resetCase();
      const approval = await requestApproval(); await decide(approval.approvalId);
      const relations = await tenantRelationCatalogue();
      const before = await financialSnapshot(relations);
      await assertFinancialSnapshotSurface(before, relations);
      const key = `order359-${boundary}-rollback`;
      if (boundary === "event") {
        const observation: { insertedEvents: number | null } = { insertedEvents: null };
        const failing: EventBus = {
          publish: async (tx, event) => {
            await eventBus!.publish(tx, event);
            const inserted = await tx<Array<{ count: number }>>`SELECT count(*)::int count FROM outbox
              WHERE tenant_id=${TENANT}::uuid AND event_type='discrepancy.carried'
                AND aggregate_id=${event.aggregateId}::uuid`;
            observation.insertedEvents = inserted[0]?.count ?? null;
            throw new Error(`order359 injected ${boundary} failure`);
          },
          consumeBatch: (...args) => eventBus!.consumeBatch(...args),
        };
        const broken = new BusinessDayDiscrepancyCarryService({ events: failing, idempotency: new PostgresIdempotency() });
        await expect(database!.withTenantTransaction(TENANT, (tx) => broken.carry(tx, {
          tenantId: TENANT, approvalId: approval.approvalId, expectedRequestHash: approval.requestHash, idempotencyKey: key,
          envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
        }))).rejects.toThrow(`order359 injected ${boundary}`);
        expect(observation.insertedEvents).toBe(1);
      } else {
        await injectBoundaryFailure(boundary, () => carry(approval.approvalId, approval.requestHash, key));
      }
      expect(await counts()).toMatchObject({ carries: 0, discrepancies: 1, facts: 0, events: 0, keys: 0 });
      const after = await financialSnapshot(relations);
      await assertFinancialSnapshotSurface(after, relations);
      expect(after).toEqual(before);
      expect((await carry(approval.approvalId, approval.requestHash, key)).replayed).toBe(false);
    }
  });

  test("twenty exact same-key contenders replay one result; distinct keys and approvals still make one", async () => {
    const approval = await requestApproval(); await decide(approval.approvalId);
    const sameKey = "order359-exact-same-key";
    const same = await Promise.allSettled(Array.from({ length: 20 }, () => carry(approval.approvalId, approval.requestHash, sameKey)));
    expect(same.filter((r) => r.status === "fulfilled")).toHaveLength(20);
    expect(same.filter((r) => r.status === "rejected")).toHaveLength(0);
    const sameResults = same.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof carry>>> => r.status === "fulfilled").map((r) => r.value);
    const sameBodies = sameResults.map(({ replayed: _replayed, ...body }) => stableBodyBytes(body));
    expect(new Set(sameResults.map((result) => result.carryId)).size).toBe(1);
    expect(new Set(sameBodies).size).toBe(1);
    const exactReplay = await carry(approval.approvalId, approval.requestHash, sameKey);
    const { replayed: _replayed, ...exactBody } = exactReplay;
    expect(sameBodies[0]).toBe(stableBodyBytes(exactBody));
    expect(await counts()).toMatchObject({ carries: 1, facts: 1, events: 1, keys: 1 });

    await resetCase();
    const distinctApproval = await requestApproval(); await decide(distinctApproval.approvalId);
    const distinct = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => carry(distinctApproval.approvalId, distinctApproval.requestHash, `order359-distinct-key-${index.toString().padStart(2, "0")}`)));
    expect(distinct.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await counts()).toMatchObject({ carries: 1, facts: 1, events: 1, keys: 1 });

    await resetCase();
    const approvals = await Promise.all([requestApproval(), requestApproval()]);
    await Promise.all(approvals.map((item) => decide(item.approvalId)));
    const twoApproval = await Promise.allSettled(approvals.map((item, index) => carry(item.approvalId, item.requestHash, `order359-two-approval-${index}`)));
    expect(twoApproval.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await deploy!<Array<{ carries: number }>>`SELECT count(*)::int carries FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`).toEqual([{ carries: 1 }]);
    expect(await database!.withTenantTransaction(FOREIGN_TENANT, (tx) => tx<Array<Record<string, unknown>>>`SELECT * FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`)).toEqual([]);
    expect(await deploy!<Array<{ count: number }>>`SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${FOREIGN_TENANT}::uuid`).toEqual([{ count: 0 }]);
  });

  test("approval, request and target one-use constraints are independently load-bearing", async () => {
    await resetCase();
    const consumedApproval = await requestApproval(); await decide(consumedApproval.approvalId);
    await insertReuseDiscrepancies();
    await insertCarryFixture(consumedApproval.approvalId, {
      requestId: REUSE_REQUEST, sourceDiscrepancyId: REUSE_SOURCE, targetDiscrepancyId: REUSE_TARGET,
    });
    await rejected(() => carry(consumedApproval.approvalId, consumedApproval.requestHash, "order366-approval-reuse"));
    expect(await deploy!<Array<{ resolved_at: Date | null; resolution: string | null }>>`SELECT resolved_at,resolution FROM discrepancy WHERE tenant_id=${TENANT}::uuid AND id=${DISCREPANCY}::uuid`).toEqual([{ resolved_at: null, resolution: null }]);
    expect(await deploy!<Array<{ count: number }>>`SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`).toEqual([{ count: 1 }]);

    await resetCase();
    const requestOwner = await requestApproval(); await decide(requestOwner.approvalId);
    const requestCandidate = await requestApproval(); await decide(requestCandidate.approvalId);
    await insertReuseDiscrepancies();
    await insertCarryFixture(requestOwner.approvalId, {
      requestId: REUSE_REQUEST, sourceDiscrepancyId: REUSE_SOURCE, targetDiscrepancyId: REUSE_TARGET,
    });
    await rejected(() => carryAs(requestCandidate.approvalId, requestCandidate.requestHash, {
      key: "order366-request-reuse", requestId: REUSE_REQUEST,
    }));
    expect(await deploy!<Array<{ resolved_at: Date | null; resolution: string | null }>>`SELECT resolved_at,resolution FROM discrepancy WHERE tenant_id=${TENANT}::uuid AND id=${DISCREPANCY}::uuid`).toEqual([{ resolved_at: null, resolution: null }]);
    expect(await deploy!<Array<{ count: number }>>`SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`).toEqual([{ count: 1 }]);

    await resetCase();
    const targetOwner = await requestApproval(); await decide(targetOwner.approvalId);
    const targetCandidate = await requestApproval(); await decide(targetCandidate.approvalId);
    await insertReuseDiscrepancies();
    await insertCarryFixture(targetOwner.approvalId, {
      requestId: REUSE_REQUEST, sourceDiscrepancyId: REUSE_SOURCE, targetDiscrepancyId: REUSE_TARGET,
    });
    await expectSqlState(() => insertCarryFixture(targetCandidate.approvalId, {
      requestId: REUSE_REQUEST_2, sourceDiscrepancyId: DISCREPANCY, targetDiscrepancyId: REUSE_TARGET,
    }), "23505");
    expect(await deploy!<Array<{ count: number }>>`SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${TENANT}::uuid`).toEqual([{ count: 1 }]);
  });

  test("every tenant, property, room, day, approval and actor binding fails closed with zero artifacts", async () => {
    const hostile = async (label: string, mutate: (approvalId: string) => Promise<void>) => {
      await resetCase();
      const approval = await requestApproval(); await decide(approval.approvalId);
      await mutate(approval.approvalId);
      try { await rejected(() => carry(approval.approvalId, approval.requestHash)); }
      catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`); }
      expect(await counts()).toMatchObject({ carries: 0, discrepancies: 1, facts: 0, events: 0, keys: 0 });
    };

    await hostile("property", async (id) => {
      await deploy!`UPDATE approval_request SET payload=jsonb_set(payload,'{propertyNode}',${JSON.stringify(FOREIGN_PROPERTY)}::jsonb) WHERE id=${id}::uuid`;
    });
    await hostile("room", async () => {
      await deploy!`UPDATE space SET property_node=${FOREIGN_PROPERTY}::uuid WHERE id=${SPACE}::uuid`;
    });
    await hostile("discrepancy", async (id) => {
      await deploy!`UPDATE approval_request SET subject_id=${FOREIGN_DISCREPANCY}::uuid WHERE id=${id}::uuid`;
    });
    await hostile("source", async (id) => {
      await deploy!`UPDATE approval_request SET payload=jsonb_set(payload,'{sourceBusinessDate}',${JSON.stringify(targetDate)}::jsonb) WHERE id=${id}::uuid`;
    });
    await hostile("target", async (id) => {
      await deploy!`UPDATE approval_request SET payload=jsonb_set(payload,'{targetBusinessDate}',${JSON.stringify(sourceDate)}::jsonb) WHERE id=${id}::uuid`;
    });
    await hostile("day", async () => {
      await deploy!`UPDATE business_day SET opened_at=opened_at+interval '1 second' WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${targetDate}::date`;
    });
    await hostile("approval", async (id) => {
      await rejected(() => carry(crypto.randomUUID(), "0".repeat(64)));
      await deploy!`UPDATE approval_request SET status='pending' WHERE id=${id}::uuid`;
    });
    await hostile("actor", async (id) => {
      await deploy!`UPDATE approval_request SET requested_by=${UNAUTHORIZED}::uuid WHERE id=${id}::uuid`;
    });

    await resetCase();
    const inactiveDecider = await requestApproval();
    expect(await deploy!<Array<{ status: string; scope_node: string; permission_code: string }>>`SELECT u.status,ur.scope_node,rp.permission_code
      FROM app_user u JOIN user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id
      JOIN role_permission rp ON rp.role_id=ur.role_id
      WHERE u.tenant_id=${TENANT}::uuid AND u.id=${INACTIVE}::uuid`).toEqual([
      { status: "active", scope_node: PROPERTY, permission_code: "financials.business-day:approve-discrepancy-carry" },
    ]);
    await decide(inactiveDecider.approvalId, { decider: INACTIVE });
    await deploy!`UPDATE app_user SET status='inactive' WHERE tenant_id=${TENANT}::uuid AND id=${INACTIVE}::uuid`;
    await rejected(() => carry(inactiveDecider.approvalId, inactiveDecider.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, discrepancies: 1, facts: 0, events: 0, keys: 0 });

    await resetCase();
    const self = await requestApproval(); await decide(self.approvalId, { decider: REQUESTER });
    await rejected(() => carry(self.approvalId, self.requestHash));
    expect(await counts()).toMatchObject({ carries: 0, discrepancies: 1, facts: 0, events: 0, keys: 0 });

    await resetCase();
    const foreign = await requestApproval();
    await rejected(() => carryAs(foreign.approvalId, foreign.requestHash, { tenantId: FOREIGN_TENANT, actorId: REQUESTER, propertyNode: FOREIGN_PROPERTY }));
    expect(await counts()).toMatchObject({ carries: 0, discrepancies: 1, facts: 0, events: 0, keys: 0 });
    expect(await deploy!<{ count: number }[]>`SELECT count(*)::int FROM business_day_discrepancy_carry WHERE tenant_id=${FOREIGN_TENANT}::uuid`).toEqual([{ count: 0 }]);

    await resetCase();
    const consumed = await requestApproval(); await decide(consumed.approvalId);
    await carry(consumed.approvalId, consumed.requestHash, "order359-consumed-approval");
    await rejected(() => carry(consumed.approvalId, consumed.requestHash, "order359-consumed-reuse"));
    expect(await counts()).toMatchObject({ carries: 1, discrepancies: 2, facts: 1, events: 1, keys: 1 });
  });

  test("carry table and functions retain complete raw-DML, ACL and pg_temp containment", async () => {
    const privileges = await deploy!`SELECT
      has_table_privilege('app_role','public.business_day_discrepancy_carry','SELECT') AS sel,
      has_table_privilege('app_role','public.business_day_discrepancy_carry','INSERT') AS ins,
      has_table_privilege('app_role','public.business_day_discrepancy_carry','UPDATE') AS upd,
      has_table_privilege('app_role','public.business_day_discrepancy_carry','DELETE') AS del,
      has_table_privilege('app_role','public.business_day_discrepancy_carry','TRUNCATE') AS trunc,
      has_table_privilege('yellow_runtime','public.business_day_discrepancy_carry','SELECT') AS runtime_sel,
      has_function_privilege('app_role','public.prepare_business_day_discrepancy_carry(uuid,uuid,uuid,date,date,text,uuid,uuid)','EXECUTE') AS prepare_app_exec,
      has_function_privilege('yellow_runtime','public.prepare_business_day_discrepancy_carry(uuid,uuid,uuid,date,date,text,uuid,uuid)','EXECUTE') AS prepare_runtime_exec,
      has_function_privilege('public','public.prepare_business_day_discrepancy_carry(uuid,uuid,uuid,date,date,text,uuid,uuid)','EXECUTE') AS prepare_public_exec,
      has_function_privilege('app_role','public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)','EXECUTE') AS app_exec,
      has_function_privilege('yellow_runtime','public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)','EXECUTE') AS runtime_exec,
      has_function_privilege('public','public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)','EXECUTE') AS public_exec`;
    expect(privileges).toEqual([{ sel: true, ins: false, upd: false, del: false, trunc: false, runtime_sel: false, prepare_app_exec: true, prepare_runtime_exec: false, prepare_public_exec: false, app_exec: true, runtime_exec: false, public_exec: false }]);
    for (const statement of [
      "INSERT INTO public.business_day_discrepancy_carry DEFAULT VALUES",
      "UPDATE public.business_day_discrepancy_carry SET reason=reason",
      "DELETE FROM public.business_day_discrepancy_carry",
      "TRUNCATE public.business_day_discrepancy_carry",
    ]) await expectRuntimeDenied(statement);
    const sequences = await deploy!`SELECT relname FROM pg_class WHERE relkind='S' AND relname LIKE 'business_day_discrepancy_carry%'`;
    expect(sequences).toEqual([]);
    const runtimeConnection = await runtimePool!.reserve();
    try {
      await runtimeConnection.unsafe("BEGIN");
      await runtimeConnection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      try {
        await runtimeConnection.unsafe(`SELECT * FROM public.prepare_business_day_discrepancy_carry('${TENANT}'::uuid,'${PROPERTY}'::uuid,'${DISCREPANCY}'::uuid,'${sourceDate}'::date,'${targetDate}'::date,'Order 366 ACL','${crypto.randomUUID()}'::uuid,'${REQUESTER}'::uuid)`);
        throw new Error("yellow_runtime unexpectedly executed prepare function");
      } catch (error) {
        expect(error).toMatchObject({ errno: "42501" });
      }
      await runtimeConnection.unsafe("ROLLBACK");
      await runtimeConnection.unsafe("BEGIN");
      await runtimeConnection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      try {
        await runtimeConnection.unsafe(`SELECT * FROM public.carry_business_day_discrepancy('${TENANT}'::uuid,'${crypto.randomUUID()}'::uuid,'${"0".repeat(64)}','${crypto.randomUUID()}'::uuid,'${REQUESTER}'::uuid)`);
        throw new Error("yellow_runtime unexpectedly executed carry function");
      } catch (error) {
        expect(error).toMatchObject({ errno: "42501" });
      }
      await runtimeConnection.unsafe("ROLLBACK");
    } finally {
      runtimeConnection.release();
    }

    await resetCase();
    const approval = await requestApproval();
    await decide(approval.approvalId);
    const connection = await runtimePool!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      await connection.unsafe("SET LOCAL search_path=pg_temp,public");
      await connection.unsafe("CREATE TEMP TABLE business_day_discrepancy_carry(tenant_id uuid)");
      const prepared = await connection`SELECT * FROM public.prepare_business_day_discrepancy_carry(
        ${TENANT}::uuid,${PROPERTY}::uuid,${DISCREPANCY}::uuid,${sourceDate}::date,${targetDate}::date,
        'Order 366 prepare ACL',${crypto.randomUUID()}::uuid,${REQUESTER}::uuid)`;
      expect(prepared).toHaveLength(1);
      const rows = await connection`SELECT * FROM public.carry_business_day_discrepancy(
        ${TENANT}::uuid,${approval.approvalId}::uuid,${approval.requestHash},${crypto.randomUUID()}::uuid,${REQUESTER}::uuid)`;
      expect(rows).toHaveLength(1);
      expect(await connection<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_temp.business_day_discrepancy_carry`).toEqual([{ count: 0 }]);
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
    expect(await counts()).toMatchObject({ carries: 0, facts: 0, events: 0, keys: 0 });
    expect(approval.approvalId).toBeString();
  }, 30_000);

  test("fresh catalogue, forced RLS and fixed owner authority remain exact", async () => {
    const rows = await deploy!`SELECT
      (SELECT count(*)::int FROM schema_migration) migrations,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity) rls,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relforcerowsecurity) forced,
      (SELECT count(*)::int FROM pg_views WHERE schemaname='public') views`;
    expect(rows).toEqual([{ migrations: 70, tables: 122, rls: 112, forced: 21, views: 2 }]);
    const authority = await deploy!`SELECT c.relforcerowsecurity forced,
      has_table_privilege('app_role',c.oid,'SELECT') sel,has_table_privilege('app_role',c.oid,'INSERT') ins,
      pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig config
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL (SELECT p.* FROM pg_proc p WHERE p.oid='public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)'::regprocedure) p
      WHERE n.nspname='public' AND c.relname='business_day_discrepancy_carry'`;
    expect(authority[0]).toMatchObject({ forced: true, sel: true, ins: false, owner: "yellow_owner", definer: true, config: ["search_path=pg_catalog, public"] });
  });
});
