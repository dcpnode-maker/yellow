import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  LocalPaymentProvider, PaymentConflictError, PaymentService, PaymentValidationError,
  type PaymentProvider, type PaymentProviderRequest,
} from "../src/contexts/financials";
import {
  createAuditEnvelope, Database, PostgresEventBus, type EventBus, type OutboxEvent,
  type PublishEventInput, type Tx,
} from "../src/kernel";

const URL = process.env.YELLOW_FINANCIAL_PAYMENTS_URL;
const ADMIN_URL = process.env.YELLOW_FINANCIAL_PAYMENTS_ADMIN_URL ?? URL;
if (process.env.YELLOW_REQUIRE_FINANCIAL_PAYMENTS === "1" && !URL) {
  throw new Error("YELLOW_FINANCIAL_PAYMENTS_URL is required by the Order 192 proof");
}
const TENANT = "00000000-0000-0000-0000-000000019201";
const PROPERTY = "00000000-0000-0000-0000-000000019211";
const ACTOR = "00000000-0000-0000-0000-000000019221";
const PARTY = "00000000-0000-0000-0000-000000019231";
const GUEST = "00000000-0000-0000-0000-000000019241";
const REVENUE = "00000000-0000-0000-0000-000000019242";
const CLEARING = "00000000-0000-0000-0000-000000019243";
const FOLIO = "00000000-0000-0000-0000-000000019251";
const INSTRUMENT = "00000000-0000-0000-0000-000000019261";
const TOKEN = "tok_order192_network_opaque";

const dbDescribe = URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let day = "";

function audit(operation: string, tenantId = TENANT, propertyNode = PROPERTY) {
  return createAuditEnvelope({ operation, tenantId, propertyNode, actorId: ACTOR,
    requestId: crypto.randomUUID() });
}

function service(provider: PaymentProvider = new LocalPaymentProvider(), bus: EventBus = events!) {
  return new PaymentService({ database: database!, events: bus, provider });
}

async function clean(): Promise<void> {
  if (!admin) return;
  for (const table of ["outbox","fact_log","payment","provider_event_receipt","payment_operation",
    "payment_instrument","posting_line","journal","tx_code_route","business_day","folio","account",
    "app_user","party_role","party","org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
  }
  await admin`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
  await admin`DELETE FROM tx_code WHERE code IN ('O192_ROOM','CARD_PAYMENT')`;
}

async function seed(): Promise<void> {
  await admin!`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES(${TENANT}::uuid,'order192','Order 192','shared','active')`;
  await admin!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
    VALUES(${PROPERTY}::uuid,${TENANT}::uuid,'order192','property','Order 192','UTC','INR')`;
  await admin!`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${ACTOR}::uuid,${TENANT}::uuid,'actor@order192.test','Order 192 actor','active')`;
  await admin!`INSERT INTO party(id,tenant_id,kind,display_name,status)
    VALUES(${PARTY}::uuid,${TENANT}::uuid,'person','Order 192 guest','active')`;
  await admin!`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${TENANT}::uuid,${PARTY}::uuid,'guest')`;
  await admin!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${GUEST}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Guest','INR','open'),
    (${REVENUE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'revenue',NULL,'Revenue','INR','open'),
    (${CLEARING}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'card_clearing',NULL,'Card clearing','INR','open')`;
  await admin!`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,status)
    VALUES(${FOLIO}::uuid,${TENANT}::uuid,${GUEST}::uuid,'O192-1',1,'open')`;
  await admin!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    ('O192_ROOM','Room charge','revenue','Rooms','guest','revenue'),
    ('CARD_PAYMENT','Card payment','payment',NULL,'card_clearing','guest')`;
  await admin!`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,'INR','O192_ROOM',NULL,${REVENUE}::uuid),
    (${TENANT}::uuid,${PROPERTY}::uuid,'INR','CARD_PAYMENT',${CLEARING}::uuid,NULL)`;
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date)
    VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${day}::date)`;
  await admin!`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status)
    VALUES(${INSTRUMENT}::uuid,${TENANT}::uuid,${PARTY}::uuid,'card_network_token',${TOKEN},'Test','0192','12/99','local','active')`;
  await admin!.begin(async (tx) => {
    const journal = (await tx<Array<{ id: string }>>`INSERT INTO journal(tenant_id,property_node,business_date,kind,
      description,currency,source,created_by) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${day}::date,'charge',
      'Order 192 opening charge','INR','{}'::jsonb,${ACTOR}::uuid) RETURNING id`)[0]!;
    await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
      amount_minor,quantity,business_date,currency) VALUES
      (${TENANT}::uuid,${journal.id}::uuid,1,${GUEST}::uuid,${FOLIO}::uuid,'O192_ROOM','charge',10000,1,${day}::date,'INR'),
      (${TENANT}::uuid,${journal.id}::uuid,2,${REVENUE}::uuid,NULL,'O192_ROOM','charge',-10000,1,${day}::date,'INR')`;
  });
}

async function authorize(using = service(), idempotencyKey = `order192-auth-${crypto.randomUUID()}`,
  amountMinor = "10000") {
  return using.authorize({ tenantId: TENANT, folioId: FOLIO, instrumentId: INSTRUMENT,
    amountMinor, idempotencyKey, envelope: audit("payment.authorized") });
}

class ThrowAfterPublish implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, input: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, input);
    throw new Error("Order 192 injected rollback");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(ADMIN_URL!, { max: 48 }); eventPool = new SQL(URL, { max: 48 });
  database = Database.connect(URL, { maxConnections: 80 }); events = new PostgresEventBus(eventPool);
  day = (await admin<Array<{ d: string }>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
}, 30_000);
beforeEach(async () => { if (URL) { await clean(); await seed(); } }, 30_000);
afterAll(async () => { await clean(); await database?.close(); await eventPool?.close(); await admin?.close(); }, 60_000);

describe("Order 192 token-only payment foundation", () => {
  test("P0: migration, provider port and service exist", async () => {
    expect(await Bun.file("migrations/0021_token_only_payment_foundation.sql").exists()).toBeTrue();
    expect(typeof LocalPaymentProvider).toBe("function"); expect(typeof PaymentService).toBe("function");
  });
});

dbDescribe("Order 192 fresh PostgreSQL P1-P5", () => {
  test("P1: exact schema, tenant-leading indexes, RLS and insert-only ACLs", async () => {
    const counts = (await admin!<Array<{ tables: number; rls: number; policies: number }>>`
      SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') tables,
        (SELECT count(*)::int FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity) rls,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies`)[0]!;
    expect(counts).toEqual({ tables: 87, rls: 77, policies: 77 });
    const acl = (await admin!<Array<{ op_select: boolean; op_insert: boolean; op_mutate: boolean;
      receipt_select: boolean; receipt_insert: boolean; receipt_mutate: boolean; payment_mutate: boolean }>>`
      SELECT has_table_privilege('app_role','payment_operation','SELECT') op_select,
        has_column_privilege('app_role','payment_operation','id','INSERT') op_insert,
        has_table_privilege('app_role','payment_operation','UPDATE,DELETE,TRUNCATE') op_mutate,
        has_table_privilege('app_role','provider_event_receipt','SELECT') receipt_select,
        has_column_privilege('app_role','provider_event_receipt','tenant_id','INSERT') receipt_insert,
        has_table_privilege('app_role','provider_event_receipt','UPDATE,DELETE,TRUNCATE') receipt_mutate,
        has_table_privilege('app_role','payment','UPDATE,DELETE,TRUNCATE') payment_mutate`)[0]!;
    expect(acl).toEqual({ op_select: true, op_insert: true, op_mutate: false,
      receipt_select: true, receipt_insert: true, receipt_mutate: false, payment_mutate: false });
    const badIndexes = await admin!<Array<{ name: string }>>`
      SELECT indexrelid::regclass::text name FROM pg_index
       WHERE indrelid IN ('payment_operation'::regclass,'provider_event_receipt'::regclass)
         AND (indkey::smallint[])[0] <> (SELECT attnum FROM pg_attribute
           WHERE attrelid=indrelid AND attname='tenant_id')`;
    expect(badIndexes).toEqual([]);
    const definitions = (await admin!<Array<{ d: string }>>`SELECT pg_get_constraintdef(oid) d FROM pg_constraint
      WHERE conrelid IN ('payment_operation'::regclass,'provider_event_receipt'::regclass,'payment'::regclass)`)
      .map((row) => row.d).join("\n");
    for (const required of ["FOREIGN KEY (tenant_id, operation_id, currency)",
      "FOREIGN KEY (tenant_id, predecessor_payment_id)", "FOREIGN KEY (tenant_id, receipt_id)",
      "FOREIGN KEY (tenant_id, capture_payment_id)", "FOREIGN KEY (tenant_id, capture_journal_id)"]) {
      expect(definitions).toContain(required);
    }
  });

  test("P2: authorization increments and void are append-only and journal-free", async () => {
    const api = service();
    const first = await authorize(api, "order192-auth-main");
    const replay = await authorize(api, "order192-auth-main");
    expect(replay).toMatchObject({ paymentId: first.paymentId, replayed: true, outcome: "approved" });
    await api.incrementalAuthorize({ tenantId: TENANT, operationId: first.operationId, amountMinor: "2000",
      idempotencyKey: "order192-increment-main", envelope: audit("payment.incrementally_authorized") });
    const other = await authorize(api, "order192-auth-void", "5000");
    await api.void({ tenantId: TENANT, operationId: other.operationId, idempotencyKey: "order192-void-main",
      envelope: audit("payment.voided") });
    const rows = await admin!<Array<{ phase: string; status: string; journal_id: string | null; predecessor_payment_id: string | null }>>`
      SELECT phase,status,journal_id,predecessor_payment_id FROM payment WHERE tenant_id=${TENANT}::uuid ORDER BY operation_id,attempt_no`;
    expect(rows.every((row) => row.journal_id === null)).toBeTrue();
    expect(rows.filter((row) => row.status === "succeeded").map((row) => row.phase).sort())
      .toEqual(["auth","auth","incremental_auth","void"]);
    expect(rows.filter((row) => row.predecessor_payment_id !== null).length).toBeGreaterThanOrEqual(4);
    await expect(api.capture({ tenantId: TENANT, operationId: other.operationId, amountMinor: "1",
      idempotencyKey: "order192-after-void", envelope: audit("payment.captured") })).rejects.toBeInstanceOf(PaymentConflictError);
  });

  test("P3: one balance-capped capture and bounded refunds post exact linked journals", async () => {
    const api = service(); const auth = await authorize(api, "order192-auth-money", "12000");
    const capture = await api.capture({ tenantId: TENANT, operationId: auth.operationId, amountMinor: "8000",
      idempotencyKey: "order192-capture-money", envelope: audit("payment.captured") });
    const refund1 = await api.refund({ tenantId: TENANT, operationId: auth.operationId, amountMinor: "3000",
      idempotencyKey: "order192-refund-one", envelope: audit("payment.refunded") });
    const refund2 = await api.refund({ tenantId: TENANT, operationId: auth.operationId, amountMinor: "1000",
      idempotencyKey: "order192-refund-two", envelope: audit("payment.refunded") });
    if (!capture.journalId || !refund1.journalId || !refund2.journalId) {
      throw new Error("Successful capture/refund must return journal identity");
    }
    const lines = await admin!<Array<{ kind: string; guest: string; clearing: string; total: string }>>`
      SELECT j.kind,sum(l.amount_minor) FILTER (WHERE l.account_id=${GUEST}::uuid)::text guest,
        sum(l.amount_minor) FILTER (WHERE l.account_id=${CLEARING}::uuid)::text clearing,sum(l.amount_minor)::text total
      FROM journal j JOIN posting_line l ON l.tenant_id=j.tenant_id AND l.journal_id=j.id
      WHERE j.tenant_id=${TENANT}::uuid AND j.id IN (${capture.journalId}::uuid,${refund1.journalId}::uuid,${refund2.journalId}::uuid)
      GROUP BY j.id,j.kind ORDER BY j.kind,j.id`;
    expect(lines.map((row) => [row.kind,row.guest,row.clearing,row.total]).sort())
      .toEqual([["payment","-8000","8000","0"],["refund","1000","-1000","0"],["refund","3000","-3000","0"]].sort());
    const lineage = await admin!<Array<{ capture_payment_id: string; capture_journal_id: string }>>`
      SELECT capture_payment_id,capture_journal_id FROM payment WHERE tenant_id=${TENANT}::uuid
       AND operation_id=${auth.operationId}::uuid AND phase='refund' AND status='succeeded'`;
    expect(lineage).toHaveLength(2);
    expect(lineage.every((row) => row.capture_payment_id === capture.paymentId && row.capture_journal_id === capture.journalId)).toBeTrue();
    const journalEvidence = await admin!<Array<{ payload: { journal_id: string; kind: string; payment_id: string;
      operation_id: string; lines: Array<Record<string,string>> } }>>`
      SELECT payload FROM outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id=${capture.journalId}::uuid
       AND event_type='journal.posted'`;
    expect(journalEvidence[0]?.payload).toEqual({ journal_id: capture.journalId, kind: "payment",
      payment_id: capture.paymentId, operation_id: auth.operationId, lines: [
        { account: GUEST, folio: FOLIO, tx_code: "CARD_PAYMENT", amount_minor: "-8000" },
        { account: CLEARING, tx_code: "CARD_PAYMENT", amount_minor: "8000" },
      ] });
    await expect(api.capture({ tenantId: TENANT, operationId: auth.operationId, amountMinor: "1",
      idempotencyKey: "order192-second-capture", envelope: audit("payment.captured") })).rejects.toBeInstanceOf(PaymentConflictError);
    await expect(api.refund({ tenantId: TENANT, operationId: auth.operationId, amountMinor: "5000",
      idempotencyKey: "order192-over-refund", envelope: audit("payment.refunded") })).rejects.toBeInstanceOf(PaymentConflictError);
  });

  test("P4: twenty racers converge, reconciliation is durable, and apply rollback retries", async () => {
    const api = service();
    const auths = await Promise.all(Array.from({ length: 20 }, () => authorize(api, "order192-race-auth", "9000")));
    const operationId = auths[0]!.operationId;
    expect(new Set(auths.map((row) => row.operationId)).size).toBe(1);
    const captures = await Promise.all(Array.from({ length: 20 }, () => api.capture({ tenantId: TENANT,
      operationId, amountMinor: "7000", idempotencyKey: "order192-race-capture", envelope: audit("payment.captured") })));
    expect(new Set(captures.map((row) => row.paymentId)).size).toBe(1);
    expect((await admin!<Array<{ n: number }>>`SELECT count(*)::int n FROM payment WHERE tenant_id=${TENANT}::uuid
      AND operation_id=${operationId}::uuid AND phase='capture' AND status='succeeded'`)[0]!.n).toBe(1);

    const indeterminate = service(new LocalPaymentProvider({ decide: (request) => request.phase === "capture" ? "indeterminate" : "approved" }));
    const pendingAuth = await authorize(indeterminate, "order192-auth-late", "2000");
    const pending = await indeterminate.capture({ tenantId: TENANT, operationId: pendingAuth.operationId, amountMinor: "1000",
      idempotencyKey: "order192-capture-late", envelope: audit("payment.captured") });
    expect(pending.outcome).toBe("indeterminate");
    await expect(indeterminate.refund({ tenantId: TENANT, operationId: pendingAuth.operationId, amountMinor: "1",
      idempotencyKey: "order192-blocked", envelope: audit("payment.refunded") })).rejects.toBeInstanceOf(PaymentConflictError);
    const receipt = { tenantId: TENANT, operationId: pendingAuth.operationId, eventId: "evt-order192-late-0001",
      contentHash: new Bun.CryptoHasher("sha256").update("order192 receipt").digest("hex"),
      providerReference: "local-late-order192", phase: "capture" as const, outcome: "approved" as const,
      amountMinor: "1000", currency: "INR", envelope: audit("payment.reconciled") };
    const reconciled = await indeterminate.reconcile(receipt);
    const receiptReplay = await indeterminate.reconcile({ ...receipt, envelope: audit("payment.reconciled") });
    expect(receiptReplay).toMatchObject({ paymentId: reconciled.paymentId, replayed: true });
    await expect(indeterminate.reconcile({ ...receipt,
      contentHash: new Bun.CryptoHasher("sha256").update("changed").digest("hex"),
      envelope: audit("payment.reconciled") })).rejects.toBeInstanceOf(PaymentConflictError);

    const rollbackAuth = await authorize(api, "order192-auth-rollback", "1000");
    const failing = service(new LocalPaymentProvider(), new ThrowAfterPublish(events!));
    const command = { tenantId: TENANT, operationId: rollbackAuth.operationId, amountMinor: "500",
      idempotencyKey: "order192-capture-rollback", envelope: audit("payment.captured") };
    await expect(failing.capture(command)).rejects.toThrow("injected rollback");
    const retried = await api.capture({ ...command, envelope: audit("payment.captured") });
    expect(retried.outcome).toBe("approved");
  }, 30_000);

  test("P5: hostile money, authority and token inputs fail without leakage", async () => {
    const api = service();
    for (const value of ["0","-1","01","9223372036854775808"]) {
      await expect(authorize(api, `order192-hostile-${value}`, value)).rejects.toBeInstanceOf(PaymentValidationError);
    }
    await expect(api.authorize({ tenantId: TENANT, folioId: FOLIO, instrumentId: INSTRUMENT,
      amountMinor: "1", idempotencyKey: "order192-foreign-property",
      envelope: audit("payment.authorized", TENANT, crypto.randomUUID()) })).rejects.toThrow();
    let observed: Omit<PaymentProviderRequest,"token"> | undefined;
    const inspecting = new LocalPaymentProvider({ decide: (request) => { observed = request; return "declined"; } });
    const result = await authorize(service(inspecting), "order192-token-boundary", "1");
    expect(result.outcome).toBe("declined"); expect(JSON.stringify(observed)).not.toContain(TOKEN);
    const declinedEvidence = await admin!<Array<{ operation: string; event_type: string }>>`
      SELECT f.fact_type operation,o.event_type FROM fact_log f JOIN outbox o
        ON o.tenant_id=f.tenant_id AND o.aggregate_id=(f.payload->>'operation_id')::uuid
       AND o.payload->>'payment_id'=f.entity_id::text
       WHERE f.tenant_id=${TENANT}::uuid AND f.entity_type='payment'
         AND f.payload->>'outcome'='declined'`;
    expect(declinedEvidence).toEqual([{ operation: "payment.failed", event_type: "payment.failed" }]);
    const evidence = JSON.stringify(await admin!`SELECT payload FROM fact_log WHERE tenant_id=${TENANT}::uuid
      UNION ALL SELECT payload FROM outbox WHERE tenant_id=${TENANT}::uuid`);
    expect(evidence).not.toContain(TOKEN);
    const luhn = (candidate: string) => {
      let sum = 0; let alternate = false;
      for (let index = candidate.length - 1; index >= 0; index -= 1) {
        let digit = Number(candidate[index]);
        if (alternate) { digit *= 2; if (digit > 9) digit -= 9; }
        sum += digit; alternate = !alternate;
      }
      return sum % 10 === 0;
    };
    const sourceFiles: string[] = [];
    for (const root of ["src", "migrations", "scripts"]) {
      for await (const file of new Bun.Glob("**/*.{ts,tsx,js,jsx,json,sql,html,css,md}").scan(root)) {
        sourceFiles.push(`${root}/${file}`);
      }
    }
    for (const file of sourceFiles) {
      const source = (await Bun.file(file).text())
        .replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi, "")
        .replace(/(?<![0-9a-f])[0-9a-f]{40,128}(?![0-9a-f])/gi, "");
      const candidates = source.match(/(?<![0-9])[0-9]{12,19}(?![0-9])/g) ?? [];
      expect(candidates.filter(luhn)).toEqual([]);
    }
    const forbiddenColumns = await admin!<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_schema='public'
        AND column_name ~* '(^|_)(pan|cvv|cvc|card_verification|security_code)($|_)'`;
    expect(forbiddenColumns).toEqual([]);
  });
});
