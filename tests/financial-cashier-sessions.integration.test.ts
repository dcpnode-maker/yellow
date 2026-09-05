import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  CashierService,
  CashierValidationError,
} from "../src/contexts/financials";
import {
  createAuditEnvelope,
  ApprovalService,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type Database as DatabaseCapability,
  type EventBus,
  type PostgresIdempotency as IdempotencyCapability,
} from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000019701";
const PROPERTY = "00000000-0000-0000-0000-000000019711";
const DRAWER = "00000000-0000-0000-0000-000000019721";
const SESSION = "00000000-0000-0000-0000-000000019731";
const COUNT = "00000000-0000-0000-0000-000000019741";
const ACTOR = "00000000-0000-0000-0000-000000019751";
const APPROVER = "00000000-0000-0000-0000-000000019752";
const ACCOUNT = "00000000-0000-0000-0000-000000019761";

const RUNTIME_URL = process.env.YELLOW_FINANCIAL_CASHIER_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_FINANCIAL_CASHIER === "1" && (!RUNTIME_URL || !DEPLOY_URL)) {
  throw new Error("YELLOW_FINANCIAL_CASHIER_URL (or YELLOW_RUNTIME_DATABASE_URL) and YELLOW_DEPLOY_DATABASE_URL are required");
}
const dbDescribe = RUNTIME_URL && DEPLOY_URL ? describe.serial : describe.skip;

// Validation must finish before any database capability is reached.  A cast is
// safe here because every exercised command is rejected during normalization.
const service = new CashierService({
  database: {} as DatabaseCapability,
  events: {} as EventBus,
  idempotency: {} as IdempotencyCapability,
});

function envelope(operation: "cashier.opened" | "cashier.counted" | "cashier.closed") {
  return createAuditEnvelope({
    operation, tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, requestId: crypto.randomUUID(),
  });
}

describe("Order 197 governed cashier domain boundary", () => {
  test("exports the transaction-owning cashier service", () => {
    expect(typeof CashierService).toBe("function");
  });

  test("P0 rejects client totals, currency, account and authority injection before SQL", async () => {
    const base = {
      tenantId: TENANT,
      drawerId: DRAWER,
      denominations: [{ denominationMinor: "100", quantity: "100" }],
      idempotencyKey: "order197-strict-open",
      envelope: envelope("cashier.opened"),
    };
    await expect(service.open({ ...base, expectedMinor: "10000" } as unknown as typeof base))
      .rejects.toBeInstanceOf(CashierValidationError);
    await expect(service.open({ ...base, currency: "USD" } as unknown as typeof base))
      .rejects.toBeInstanceOf(CashierValidationError);
    await expect(service.open({ ...base, accountId: DRAWER } as unknown as typeof base))
      .rejects.toBeInstanceOf(CashierValidationError);
    await expect(service.open({ ...base, actorId: ACTOR } as unknown as typeof base))
      .rejects.toBeInstanceOf(CashierValidationError);
  });

  test("P0 accepts only canonical nonnegative denomination quantities with no duplicate units", async () => {
    const base = {
      tenantId: TENANT,
      sessionId: SESSION,
      idempotencyKey: "order197-strict-count",
      envelope: envelope("cashier.counted"),
    };
    for (const denominations of [
      [{ denominationMinor: "0100", quantity: "1" }],
      [{ denominationMinor: "100", quantity: "-1" }],
      [{ denominationMinor: "100", quantity: "1.0" }],
      [{ denominationMinor: "100", quantity: "1" }, { denominationMinor: "100", quantity: "2" }],
    ]) {
      await expect(service.appendCount({ ...base, denominations })).rejects.toBeInstanceOf(CashierValidationError);
    }
  });

  test("P0 keeps close approval and supervision authority server-shaped", async () => {
    const base = {
      tenantId: TENANT,
      sessionId: SESSION,
      countId: COUNT,
      supervised: false,
      idempotencyKey: "order197-strict-close",
      envelope: envelope("cashier.closed"),
    };
    await expect(service.close({ ...base, supervised: "true" } as unknown as typeof base))
      .rejects.toBeInstanceOf(CashierValidationError);
    await expect(service.close({ ...base, supervised: false, reason: "short count" }))
      .rejects.toBeInstanceOf(CashierValidationError);
    await expect(service.close({ ...base, supervised: false, approvalId: COUNT }))
      .rejects.toBeInstanceOf(CashierValidationError);
  });
});

let deploy: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let cashiers: CashierService | undefined;
let businessDate = "";

function commandEnvelope(
  operation: "cashier.opened" | "cashier.counted" | "cashier.closed" | "approval.requested" | "approval.decided",
  actorId = ACTOR,
) {
  return createAuditEnvelope({
    operation, tenantId: TENANT, propertyNode: PROPERTY, actorId, requestId: crypto.randomUUID(),
  });
}

function denominations(quantity: string) {
  return [{ denominationMinor: "1", quantity }] as const;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy.begin(async (tx) => {
    await tx.unsafe("SET CONSTRAINTS ALL DEFERRED");
    for (const table of ["api_idempotency", "outbox", "fact_log", "cashier_count_line", "cashier_count",
      "cashier_session", "approval_request", "cash_drawer_denomination", "cash_drawer", "business_day", "account", "app_user", "org_node"]) {
      await tx.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
    }
  });
  await deploy`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

async function financialArtifacts(): Promise<{ journals: number; payments: number; documents: number }> {
  return (await deploy!<Array<{ journals: number; payments: number; documents: number }>>`
    SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid) AS journals,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${TENANT}::uuid) AS payments,
      (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT}::uuid) AS documents
  `)[0]!;
}

beforeAll(async () => {
  if (!RUNTIME_URL || !DEPLOY_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 16, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 16, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 40, prepare: false });
  const events = new PostgresEventBus(eventPool);
  cashiers = new CashierService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
    approvals: new ApprovalService(events),
  });
  await cleanup();
  businessDate = (await deploy<Array<{ value: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS value
  `)[0]!.value;
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order197','Order 197','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order197','property','Order 197','UTC','USD')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'cashier@order197.test','Cashier','active'),
    (${APPROVER}::uuid,${TENANT}::uuid,'approver@order197.test','Approver','active')`;
  await deploy`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES
    (${ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'cash','Order 197 cash','USD','open')`;
  await deploy`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date)`;
  await deploy`INSERT INTO cash_drawer(tenant_id,id,property_node,account_id,code,name,currency) VALUES
    (${TENANT}::uuid,${DRAWER}::uuid,${PROPERTY}::uuid,${ACCOUNT}::uuid,'FRONT-DESK-1','Front desk','USD')`;
  await deploy`INSERT INTO cash_drawer_denomination(tenant_id,drawer_id,unit_minor) VALUES
    (${TENANT}::uuid,${DRAWER}::uuid,1)`;
}, 30_000);

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await deploy?.close({ timeout: 0 });
}, 60_000);

dbDescribe("Order 197 fresh-PostgreSQL cashier proof", () => {
  test("P2 exact 10000 / 10025 / 9975 economics writes custody evidence but no financial artifacts", async () => {
    const before = await financialArtifacts();
    for (const [countedMinor, overShortMinor] of [["10000", "0"], ["10025", "25"], ["9975", "-25"]] as const) {
      const opened = await cashiers!.open({
        tenantId: TENANT, drawerId: DRAWER, denominations: denominations("10000"),
        idempotencyKey: `order197-open-${countedMinor}`, envelope: commandEnvelope("cashier.opened"),
      });
      expect(opened.expectedMinor).toBe("10000");
      const count = await cashiers!.appendCount({
        tenantId: TENANT, sessionId: opened.sessionId, denominations: denominations(countedMinor),
        idempotencyKey: `order197-count-${countedMinor}`, envelope: commandEnvelope("cashier.counted"),
      });
      expect(Object.hasOwn(count, "countedMinor")).toBeFalse();
      const approvalId = overShortMinor === "0" ? undefined : (await cashiers!.approveOverShort({
        tenantId: TENANT,
        sessionId: opened.sessionId,
        approvalId: (await cashiers!.requestOverShortApproval({
          tenantId: TENANT, sessionId: opened.sessionId, countId: count.countId,
          supervised: false,
          idempotencyKey: `order197-approval-request-${countedMinor}`,
          envelope: commandEnvelope("approval.requested"),
        })).approvalId,
        idempotencyKey: `order197-approval-decide-${countedMinor}`,
        envelope: commandEnvelope("approval.decided", APPROVER),
      })).approvalId;
      const closed = await cashiers!.close({
        tenantId: TENANT, sessionId: opened.sessionId, countId: count.countId,
        ...(approvalId ? { approvalId, reason: "Count discrepancy" } : {}),
        supervised: false, idempotencyKey: `order197-close-${countedMinor}`,
        envelope: commandEnvelope("cashier.closed"),
      });
      expect(closed).toMatchObject({ expectedMinor: "10000", countedMinor, overShortMinor, replayed: false });
      expect((await cashiers!.close({
        tenantId: TENANT, sessionId: opened.sessionId, countId: count.countId,
        ...(approvalId ? { approvalId, reason: "Count discrepancy" } : {}),
        supervised: false, idempotencyKey: `order197-close-${countedMinor}`,
        envelope: commandEnvelope("cashier.closed"),
      })).replayed).toBeTrue();
    }
    expect(await financialArtifacts()).toEqual(before);
  }, 60_000);

  test("P3 twenty-way open/count/close retries converge to exactly one immutable attempt each", async () => {
    const open = {
      tenantId: TENANT, drawerId: DRAWER, denominations: denominations("10000"),
      idempotencyKey: "order197-race-open", envelope: commandEnvelope("cashier.opened"),
    } as const;
    const opened = await Promise.all(Array.from({ length: 20 }, () => cashiers!.open(open)));
    expect(opened.filter(({ replayed }) => !replayed)).toHaveLength(1);
    const sessionId = opened[0]!.sessionId;
    const count = {
      tenantId: TENANT, sessionId, denominations: denominations("10000"),
      idempotencyKey: "order197-race-count", envelope: commandEnvelope("cashier.counted"),
    } as const;
    const counted = await Promise.all(Array.from({ length: 20 }, () => cashiers!.appendCount(count)));
    expect(counted.filter(({ replayed }) => !replayed)).toHaveLength(1);
    const countId = counted[0]!.countId;
    const close = {
      tenantId: TENANT, sessionId, countId, supervised: false,
      idempotencyKey: "order197-race-close", envelope: commandEnvelope("cashier.closed"),
    } as const;
    const closed = await Promise.all(Array.from({ length: 20 }, () => cashiers!.close(close)));
    expect(closed.filter(({ replayed }) => !replayed)).toHaveLength(1);
    expect((await deploy!<Array<{ sessions: number; counts: number; facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM cashier_session WHERE tenant_id=${TENANT}::uuid AND id=${sessionId}::uuid) AS sessions,
        (SELECT count(*)::int FROM cashier_count WHERE tenant_id=${TENANT}::uuid AND session_id=${sessionId}::uuid) AS counts,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id=${sessionId}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${sessionId}::uuid) AS events
    `)[0]).toEqual({ sessions: 1, counts: 2, facts: 3, events: 3 });
  }, 60_000);
});
