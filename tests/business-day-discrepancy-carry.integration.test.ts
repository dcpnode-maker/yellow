import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
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
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000035912";
const REQUESTER = "00000000-0000-0000-0000-000000035921";
const APPROVER = "00000000-0000-0000-0000-000000035922";
const UNAUTHORIZED = "00000000-0000-0000-0000-000000035923";
const INACTIVE = "00000000-0000-0000-0000-000000035924";
const ROLE_REQUEST = "00000000-0000-0000-0000-000000035931";
const ROLE_APPROVE = "00000000-0000-0000-0000-000000035932";
const SPACE = "00000000-0000-0000-0000-000000035941";
const DISCREPANCY = "00000000-0000-0000-0000-000000035951";
const FOREIGN_DISCREPANCY = "00000000-0000-0000-0000-000000035952";

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let runtimePool: SQL | undefined;
let database: Database | undefined;
let service: BusinessDayDiscrepancyCarryService | undefined;
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

const CANONICAL_FINANCIAL_TABLES = [
  "account", "folio", "journal", "posting_line", "payment_instrument", "payment",
  "document_series", "document", "tax_assignment", "tax_attribution_snapshot",
  "tax_attribution_hold_binding", "tax_attribution_reservation_binding",
  "tax_attribution_journal_binding", "tax_semantic_route", "fiscal_submission",
  "statutory_submission", "payment_operation", "provider_event_receipt", "hosted_payment_request",
  "property_fiscal_registration", "party_fiscal_registration", "property_fiscal_location",
  "india_gst_item_classification", "india_gst_supplier_service_location",
  "india_gst_recipient_sez_status", "india_gst_supplier_sez_status", "india_sez_unit_loa_renewal",
  "india_gst_supplier_registration_status_snapshot", "india_gst_accommodation_payment_receipt_snapshot",
  "india_gst_accommodation_service_provision_snapshot", "india_gst_accommodation_invoice_issue_snapshot",
  "india_gst_accommodation_final_valuation", "india_gst_accommodation_valuation_source",
  "india_gst_accommodation_valuation_room_night", "india_gst_accommodation_valuation_allocation",
] as const;

/** A byte-stable snapshot of every canonical financial row owned by this tenant. */
async function financialSnapshot(): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const table of CANONICAL_FINANCIAL_TABLES) {
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
            (${TENANT}::uuid,${PROPERTY}::uuid,${targetDate}::date)`;
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
  key?: string; tenantId?: string; actorId?: string; propertyNode?: string;
} = {}) {
  const tenantId = options.tenantId ?? TENANT;
  return database!.withTenantTransaction(tenantId, (tx) => service!.carry(tx, {
    tenantId, approvalId, expectedRequestHash: requestHash, idempotencyKey: options.key ?? `order359-carry-${crypto.randomUUID()}`,
    envelope: { tenantId, propertyNode: options.propertyNode ?? PROPERTY, actorId: options.actorId ?? REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
  }));
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
    service = new BusinessDayDiscrepancyCarryService({ events: normalizingEvents, idempotency: new Order359Idempotency() });
    targetDate = (await deploy<Array<{ d: string }>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
    sourceDate = (await deploy<Array<{ d: string }>>`SELECT (${targetDate}::date - 1)::text d`)[0]!.d;
    await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'order359','Order 359','shared','active'),
      (${FOREIGN_TENANT}::uuid,'order359-foreign','Order 359 foreign','shared','active')`;
    await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'order359','property','Order 359','UTC','USD'),
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
      (${TENANT}::uuid,${APPROVER}::uuid,${ROLE_APPROVE}::uuid,${PROPERTY}::uuid)`;
    await deploy!`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
      VALUES(${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'ORDER359','hotel',1,'active')`;
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
    const before = await financialSnapshot();
    const approval = await requestApproval(); await decide(approval.approvalId);
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
    const after = await financialSnapshot();
    expect(after).toEqual(before);
  });

  test("rolls back after every governed boundary and permits one clean retry", async () => {
    for (const boundary of ["transition", "target", "carry-link", "fact", "event", "deferred-commit"] as const) {
      await resetCase();
      const approval = await requestApproval(); await decide(approval.approvalId);
      const before = await financialSnapshot();
      const key = `order359-${boundary}-rollback`;
      if (boundary === "event") {
        const failing: EventBus = { publish: async () => { throw new Error(`order359 injected ${boundary} failure`); } } as unknown as EventBus;
        const broken = new BusinessDayDiscrepancyCarryService({ events: failing, idempotency: new PostgresIdempotency() });
        await expect(database!.withTenantTransaction(TENANT, (tx) => broken.carry(tx, {
          tenantId: TENANT, approvalId: approval.approvalId, expectedRequestHash: approval.requestHash, idempotencyKey: key,
          envelope: { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER, requestId: crypto.randomUUID(), operation: "discrepancy.carried" },
        }))).rejects.toThrow(`order359 injected ${boundary}`);
      } else {
        await injectBoundaryFailure(boundary, () => carry(approval.approvalId, approval.requestHash, key));
      }
      expect(await counts()).toMatchObject({ carries: 0, discrepancies: 1, facts: 0, events: 0, keys: 0 });
      expect(await financialSnapshot()).toEqual(before);
      expect((await carry(approval.approvalId, approval.requestHash, key)).replayed).toBe(false);
    }
  });

  test("twenty exact same-key contenders replay one result; distinct keys and approvals still make one", async () => {
    const approval = await requestApproval(); await decide(approval.approvalId);
    const sameKey = "order359-exact-same-key";
    const same = await Promise.allSettled(Array.from({ length: 20 }, () => carry(approval.approvalId, approval.requestHash, sameKey)));
    expect(same.filter((r) => r.status === "fulfilled")).toHaveLength(20);
    expect(same.filter((r) => r.status === "rejected")).toHaveLength(0);
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
    const inactiveDecider = await requestApproval(); await decide(inactiveDecider.approvalId, { decider: INACTIVE });
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
      has_function_privilege('app_role','public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)','EXECUTE') AS app_exec,
      has_function_privilege('yellow_runtime','public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)','EXECUTE') AS runtime_exec,
      has_function_privilege('public','public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)','EXECUTE') AS public_exec`;
    expect(privileges).toEqual([{ sel: true, ins: false, upd: false, del: false, trunc: false, runtime_sel: false, app_exec: true, runtime_exec: false, public_exec: false }]);
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
    expect(rows).toEqual([{ migrations: 63, tables: 116, rls: 106, forced: 15, views: 2 }]);
    const authority = await deploy!`SELECT c.relforcerowsecurity forced,
      has_table_privilege('app_role',c.oid,'SELECT') sel,has_table_privilege('app_role',c.oid,'INSERT') ins,
      pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig config
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL (SELECT p.* FROM pg_proc p WHERE p.oid='public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid)'::regprocedure) p
      WHERE n.nspname='public' AND c.relname='business_day_discrepancy_carry'`;
    expect(authority[0]).toMatchObject({ forced: true, sel: true, ins: false, owner: "yellow_owner", definer: true, config: ["search_path=pg_catalog, public"] });
  });
});
