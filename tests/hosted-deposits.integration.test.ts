import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  HostedDepositConflictError, HostedDepositNotFoundError, HostedDepositService, HostedDepositValidationError,
  LocalPaymentProvider, PaymentService,
  type PaymentProvider,
} from "../src/contexts/financials";
import { createAuditEnvelope, Database, PostgresEventBus } from "../src/kernel";

const URL = process.env.YELLOW_HOSTED_DEPOSITS_URL;
const ADMIN_URL = process.env.YELLOW_HOSTED_DEPOSITS_ADMIN_URL ?? URL;
if (process.env.YELLOW_REQUIRE_HOSTED_DEPOSITS === "1" && !URL) throw new Error("YELLOW_HOSTED_DEPOSITS_URL is required");
const T = "00000000-0000-0000-0000-000000019301";
const TB = "00000000-0000-0000-0000-000000019302";
const P = "00000000-0000-0000-0000-000000019311";
const A = "00000000-0000-0000-0000-000000019321";
const PARTY = "00000000-0000-0000-0000-000000019331";
const GUEST = "00000000-0000-0000-0000-000000019341";
const REVENUE = "00000000-0000-0000-0000-000000019342";
const CLEARING = "00000000-0000-0000-0000-000000019343";
const DEPOSIT = "00000000-0000-0000-0000-000000019344";
const FOLIO = "00000000-0000-0000-0000-000000019351";
const INSTRUMENT = "00000000-0000-0000-0000-000000019361";
let admin: SQL | undefined; let eventSql: SQL | undefined; let attackSql: SQL | undefined; let database: Database | undefined;
let hosted: HostedDepositService | undefined; let payments: PaymentService | undefined; let day = "";

class HostedProvider implements PaymentProvider {
  readonly #local = new LocalPaymentProvider();
  execute(request: Parameters<PaymentProvider["execute"]>[0]) {
    return request.phase === "capture" ? Promise.resolve({ outcome: "indeterminate" as const,
      providerReference: `local-${request.commandId}`, resultCode: "indeterminate" }) : this.#local.execute(request);
  }
}

function envelope(operation: string) {
  return createAuditEnvelope({ tenantId: T, propertyNode: P, actorId: A, requestId: crypto.randomUUID(), operation });
}

async function capture(link: { bearer?: string; operationId: string }, amountMinor = "5000") {
  await hosted!.beginCapture(link.bearer!);
  return payments!.reconcile({ tenantId:T,operationId:link.operationId,eventId:`event-${crypto.randomUUID()}`,
    contentHash:new Bun.CryptoHasher("sha256").update(link.operationId).digest("hex"),
    providerReference:`local-${crypto.randomUUID()}`,phase:"capture",outcome:"approved",amountMinor,currency:"INR",
    envelope:envelope("payment.reconciled") });
}

async function withTenantAttack<T>(tenantId:string, operation:(tx:SQL) => Promise<T>):Promise<T> {
  return attackSql!.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${tenantId},true)`;
    await tx.unsafe("SET LOCAL ROLE app_role");
    return operation(tx as unknown as SQL);
  });
}

async function expectAdminRejected(operation:(tx:any) => Promise<unknown>):Promise<void> {
  const rejected = await admin!.begin(async tx => {
    await tx.unsafe("SAVEPOINT order193_hostile");
    try { await operation(tx); await tx.unsafe("ROLLBACK TO SAVEPOINT order193_hostile"); return false; }
    catch { await tx.unsafe("ROLLBACK TO SAVEPOINT order193_hostile"); return true; }
  });
  expect(rejected).toBeTrue();
}

async function clean() {
  if (!admin) return;
  for (const table of ["outbox","fact_log","deposit_application","hosted_payment_request","payment",
    "provider_event_receipt","payment_operation","payment_instrument","posting_line","journal","tx_code_route",
    "business_day","folio","account","app_user","party_role","party","org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T,TB]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${T}::uuid,${TB}::uuid)`;
  await admin`DELETE FROM tx_code WHERE code IN ('O193_ROOM','O193_CARD')`;
}

async function seedTenantB() {
  const p="00000000-0000-0000-0000-000000019312", a="00000000-0000-0000-0000-000000019322";
  const party="00000000-0000-0000-0000-000000019332", guest="00000000-0000-0000-0000-000000019345";
  const clearing="00000000-0000-0000-0000-000000019346", deposit="00000000-0000-0000-0000-000000019347";
  const folio="00000000-0000-0000-0000-000000019352", instrument="00000000-0000-0000-0000-000000019362";
  await admin!`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${TB}::uuid,'order193-b','Order 193 B','shared','active')`;
  await admin!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${p}::uuid,${TB}::uuid,'order193b','property','B Hotel','UTC','INR')`;
  await admin!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${a}::uuid,${TB}::uuid,'actor-b@order193.test','Actor B','active')`;
  await admin!`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${party}::uuid,${TB}::uuid,'person','Guest B','active')`;
  await admin!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${guest}::uuid,${TB}::uuid,${p}::uuid,'guest',${party}::uuid,'Guest B','INR','open'),
    (${clearing}::uuid,${TB}::uuid,${p}::uuid,'card_clearing',NULL,'Clearing B','INR','open'),
    (${deposit}::uuid,${TB}::uuid,${p}::uuid,'deposit_liability',NULL,'Deposit B','INR','open')`;
  await admin!`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,status) VALUES(${folio}::uuid,${TB}::uuid,${guest}::uuid,'O193-B',1,'open')`;
  await admin!`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id) VALUES
    (${TB}::uuid,${p}::uuid,'INR','CARD_PAYMENT',${clearing}::uuid,NULL),(${TB}::uuid,${p}::uuid,'INR','DEP',NULL,${deposit}::uuid)`;
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES(${TB}::uuid,${p}::uuid,${day}::date)`;
  await admin!`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status)
    VALUES(${instrument}::uuid,${TB}::uuid,${party}::uuid,'card_network_token','tok_order193_b_network','Test','0194','12/99','local','active')`;
  const link = await hosted!.create({ tenantId:TB,folioId:folio,instrumentId:instrument,amountMinor:"5000",
    idempotencyKey:"create-order193-tenant-b",envelope:createAuditEnvelope({ tenantId:TB,propertyNode:p,actorId:a,
      requestId:crypto.randomUUID(),operation:"deposit.requested" }) });
  return { p,a,guest,deposit,folio,link };
}

async function seed() {
  await admin!`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${T}::uuid,'order193','Order 193','shared','active')`;
  await admin!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
    VALUES(${P}::uuid,${T}::uuid,'order193','property','Order 193 Hotel','UTC','INR')`;
  await admin!`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${A}::uuid,${T}::uuid,'actor@order193.test','Order 193 actor','active')`;
  await admin!`INSERT INTO party(id,tenant_id,kind,display_name,status)
    VALUES(${PARTY}::uuid,${T}::uuid,'person','Order 193 guest','active')`;
  await admin!`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${T}::uuid,${PARTY}::uuid,'guest')`;
  await admin!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${GUEST}::uuid,${T}::uuid,${P}::uuid,'guest',${PARTY}::uuid,'Guest','INR','open'),
    (${REVENUE}::uuid,${T}::uuid,${P}::uuid,'revenue',NULL,'Revenue','INR','open'),
    (${CLEARING}::uuid,${T}::uuid,${P}::uuid,'card_clearing',NULL,'Card clearing','INR','open'),
    (${DEPOSIT}::uuid,${T}::uuid,${P}::uuid,'deposit_liability',NULL,'Deposit liability','INR','open')`;
  await admin!`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,status)
    VALUES(${FOLIO}::uuid,${T}::uuid,${GUEST}::uuid,'O193-1',1,'open')`;
  await admin!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    ('O193_ROOM','Room charge','revenue','Rooms','guest','revenue'),
    ('O193_CARD','Card payment','payment',NULL,'card_clearing','guest'),
    ('CARD_PAYMENT','Card payment','payment',NULL,'card_clearing','guest'),
    ('DEP','Deposit Liability','deposit',NULL,'deposit_liability',NULL)
    ON CONFLICT (code) DO NOTHING`;
  await admin!`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id) VALUES
    (${T}::uuid,${P}::uuid,'INR','O193_ROOM',NULL,${REVENUE}::uuid),
    (${T}::uuid,${P}::uuid,'INR','CARD_PAYMENT',${CLEARING}::uuid,NULL),
    (${T}::uuid,${P}::uuid,'INR','DEP',NULL,${DEPOSIT}::uuid)`;
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES(${T}::uuid,${P}::uuid,${day}::date)`;
  await admin!`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status)
    VALUES(${INSTRUMENT}::uuid,${T}::uuid,${PARTY}::uuid,'card_network_token','tok_order193_opaque_network','Test','0193','12/99','local','active')`;
  await admin!.begin(async tx => {
    const journal = (await tx<Array<{id:string}>>`INSERT INTO journal(tenant_id,property_node,business_date,kind,
      description,currency,source,created_by) VALUES(${T}::uuid,${P}::uuid,${day}::date,'charge','opening charge','INR','{}',${A}::uuid) RETURNING id`)[0]!;
    await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,
      quantity,business_date,currency) VALUES
      (${T}::uuid,${journal.id}::uuid,1,${GUEST}::uuid,${FOLIO}::uuid,'O193_ROOM','charge',10000,1,${day}::date,'INR'),
      (${T}::uuid,${journal.id}::uuid,2,${REVENUE}::uuid,NULL,'O193_ROOM','charge',-10000,1,${day}::date,'INR')`;
  });
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(ADMIN_URL!, { max: 8 }); eventSql = new SQL(URL, { max: 8 }); attackSql = new SQL(URL, { max:2 });
  database = Database.connect(URL, { maxConnections: 24 });
  payments = new PaymentService({ database, events: new PostgresEventBus(eventSql), provider: new HostedProvider() });
  hosted = new HostedDepositService({ database, payments, events: new PostgresEventBus(eventSql) });
  day = (await admin<Array<{d:string}>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text d`)[0]!.d;
});
beforeEach(async () => { if (URL) { await clean(); await seed(); } });
afterAll(async () => { await clean(); await database?.close(); await attackSql?.close(); await eventSql?.close(); await admin?.close(); });

describe("Order 193 hosted deposit foundation", () => {
  test("P0 marker exists", async () => expect(await Bun.file("migrations/0022_hosted_deposit_workbench.sql").exists()).toBeTrue());
});

(URL ? describe.serial : describe.skip)("Order 193 deposit accounting", () => {
  test("capture is folio-neutral and partial/full application is immutable and capped", async () => {
    const link = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"5000",
      idempotencyKey:`create-${crypto.randomUUID()}`,envelope:envelope("deposit.requested") });
    expect(typeof link.bearer).toBe("string");
    expect(link.bearer).not.toContain("tok_order193");
    expect((await admin!`SELECT bearer_hash::text hash FROM hosted_payment_request WHERE tenant_id=${T}::uuid`)[0]!.hash).not.toBe(link.bearer);
    const pending = await hosted!.beginCapture(link.bearer!); expect(pending.outcome).toBe("indeterminate");
    const raw = JSON.stringify({ tenantId:T, operationId:link.operationId, eventId:`evt-${crypto.randomUUID()}` });
    const captured = await payments!.reconcile({ tenantId:T, operationId:link.operationId,
      eventId:`event-${crypto.randomUUID()}`,contentHash:new Bun.CryptoHasher("sha256").update(raw).digest("hex"),
      providerReference:`local-${crypto.randomUUID()}`,phase:"capture",outcome:"approved",amountMinor:"5000",currency:"INR",
      envelope:envelope("payment.reconciled") });
    expect(captured.outcome).toBe("approved");
    const afterCapture = (await admin!<Array<{folio:string;deposit:string;total:string}>>`SELECT
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${T}::uuid AND folio_id=${FOLIO}::uuid) folio,
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${T}::uuid AND account_id=${DEPOSIT}::uuid) deposit,
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${T}::uuid) total`)[0]!;
    expect(afterCapture).toEqual({ folio:"10000", deposit:"-5000", total:"0" });
    const first = await hosted!.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"2000",
      idempotencyKey:"apply-order193-first",envelope:envelope("deposit.applied") });
    const replay = await hosted!.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"2000",
      idempotencyKey:"apply-order193-first",envelope:envelope("deposit.applied") });
    expect(replay.applicationId).toBe(first.applicationId); expect(replay.replayed).toBeTrue();
    await hosted!.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"3000",
      idempotencyKey:"apply-order193-final",envelope:envelope("deposit.applied") });
    await expect(hosted!.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"1",
      idempotencyKey:"apply-order193-excess",envelope:envelope("deposit.applied") })).rejects.toBeInstanceOf(HostedDepositConflictError);
    const final = (await admin!<Array<{folio:string;deposit:string;applications:number;balanced:boolean}>>`SELECT
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${T}::uuid AND folio_id=${FOLIO}::uuid) folio,
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${T}::uuid AND account_id=${DEPOSIT}::uuid) deposit,
      (SELECT count(*)::int FROM deposit_application WHERE tenant_id=${T}::uuid) applications,
      NOT EXISTS (SELECT 1 FROM posting_line WHERE tenant_id=${T}::uuid GROUP BY journal_id HAVING sum(amount_minor)<>0) balanced`)[0]!;
    expect(final).toEqual({ folio:"5000", deposit:"0", applications:2, balanced:true });
  }, 30_000);

  test("regeneration revokes the old bearer and stores only hashes", async () => {
    const first = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:"create-order193-one",envelope:envelope("deposit.requested") });
    const replay = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:"create-order193-one",envelope:envelope("deposit.requested") });
    expect(replay).toMatchObject({ requestId:first.requestId,generation:1,replayed:true });
    expect(replay.bearer).toBeUndefined();
    const second = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:"create-order193-two",envelope:envelope("deposit.requested") });
    expect(second.generation).toBe(2); expect((await hosted!.status(first.bearer!)).state).toBe("revoked");
    await expect(hosted!.beginCapture(first.bearer!)).rejects.toBeInstanceOf(HostedDepositConflictError);
    expect((await hosted!.status(second.bearer!)).state).toBe("ready");
    await admin!`UPDATE hosted_payment_request SET expires_at=created_at+interval '1 millisecond'
      WHERE tenant_id=${T}::uuid AND id=${second.requestId}::uuid`;
    await Bun.sleep(5); expect((await hosted!.status(second.bearer!)).state).toBe("expired");
    await expect(hosted!.beginCapture(second.bearer!)).rejects.toBeInstanceOf(HostedDepositConflictError);
    const pending = (await admin!<Array<{n:number}>>`SELECT count(*)::int n FROM payment
      WHERE tenant_id=${T}::uuid AND operation_id IN (${first.operationId}::uuid,${second.operationId}::uuid)
        AND phase='capture'`)[0]!.n;
    expect(pending).toBe(0);
    const leaked = await admin!<Array<{n:number}>>`SELECT count(*)::int n FROM hosted_payment_request
      WHERE tenant_id=${T}::uuid AND bearer_hash::text IN (${first.bearer!}::text,${second.bearer!}::text)`;
    expect(leaked[0]!.n).toBe(0);
  });

  test("captured truth survives link expiry and regeneration and remains applicable", async () => {
    const first = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"2000",
      idempotencyKey:"create-order193-captured-precedence",envelope:envelope("deposit.requested") });
    await capture(first, "2000");
    await admin!`UPDATE hosted_payment_request SET expires_at=created_at+interval '1 millisecond'
      WHERE tenant_id=${T}::uuid AND id=${first.requestId}::uuid`;
    await Bun.sleep(5);
    expect((await hosted!.statusForOperator(T, first.requestId)).state).toBe("captured");
    const replacement = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:"create-order193-captured-regeneration",envelope:envelope("deposit.requested") });
    expect(replacement.generation).toBe(2);
    expect((await hosted!.statusForOperator(T, first.requestId)).state).toBe("captured");
    const applied = await hosted!.apply({ tenantId:T,hostedRequestId:first.requestId,amountMinor:"1000",
      idempotencyKey:"apply-order193-captured-regeneration",envelope:envelope("deposit.applied") });
    expect(applied.amountMinor).toBe("1000");
  }, 30_000);

  test("idempotency boundaries and payment errors stay inside hosted domain semantics", async () => {
    for (const length of [190,191,200]) {
      const key=`k${length}`.padEnd(length,"x");
      expect((await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
        idempotencyKey:key,envelope:envelope("deposit.requested") })).requestId).toMatch(/^[0-9a-f-]{36}$/);
    }
    await expect(hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:"x".repeat(201),envelope:envelope("deposit.requested") })).rejects.toBeInstanceOf(HostedDepositValidationError);
    const changedKey="order193-changed-create-key";
    await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:changedKey,envelope:envelope("deposit.requested") });
    await expect(hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1001",
      idempotencyKey:changedKey,envelope:envelope("deposit.requested") })).rejects.toBeInstanceOf(HostedDepositConflictError);
    await expect(hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:crypto.randomUUID(),amountMinor:"1000",
      idempotencyKey:"order193-foreign-instrument",envelope:envelope("deposit.requested") }))
      .rejects.toBeInstanceOf(HostedDepositNotFoundError);
    expect((await admin!<Array<{requests:number;operations:number}>>`SELECT
      (SELECT count(*)::int FROM hosted_payment_request WHERE tenant_id=${T}::uuid) requests,
      (SELECT count(*)::int FROM payment_operation WHERE tenant_id=${T}::uuid) operations`)[0]).toEqual({requests:4,operations:4});
  }, 30_000);

  test("pending, declined and foreign requests cannot be applied and leave zero applications", async () => {
    const pending = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:"create-order193-pending-negative",envelope:envelope("deposit.requested") });
    await hosted!.beginCapture(pending.bearer!);
    await expect(hosted!.apply({ tenantId:T,hostedRequestId:pending.requestId,amountMinor:"1",
      idempotencyKey:"apply-order193-pending-negative",envelope:envelope("deposit.applied") }))
      .rejects.toBeInstanceOf(HostedDepositConflictError);
    const declined = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"1000",
      idempotencyKey:"create-order193-declined-negative",envelope:envelope("deposit.requested") });
    await hosted!.beginCapture(declined.bearer!);
    await payments!.reconcile({ tenantId:T,operationId:declined.operationId,eventId:"event-order193-declined-negative",
      contentHash:new Bun.CryptoHasher("sha256").update("declined-negative").digest("hex"),providerReference:"local-declined-negative",
      phase:"capture",outcome:"declined",amountMinor:"1000",currency:"INR",envelope:envelope("payment.reconciled") });
    await expect(hosted!.apply({ tenantId:T,hostedRequestId:declined.requestId,amountMinor:"1",
      idempotencyKey:"apply-order193-declined-negative",envelope:envelope("deposit.applied") }))
      .rejects.toBeInstanceOf(HostedDepositConflictError);
    const other = await seedTenantB();
    await expect(hosted!.apply({ tenantId:T,hostedRequestId:other.link.requestId,amountMinor:"1",
      idempotencyKey:"apply-order193-foreign-negative",envelope:envelope("deposit.applied") })).rejects.toThrow();
    expect((await admin!<Array<{n:number}>>`SELECT count(*)::int n FROM deposit_application
      WHERE tenant_id IN (${T}::uuid,${TB}::uuid)`)[0]!.n).toBe(0);
  }, 30_000);

  test("folio balance independently caps application and exact capture/application journals preserve liability", async () => {
    const link = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"15000",
      idempotencyKey:"create-order193-balance-cap",envelope:envelope("deposit.requested") });
    const captured = await capture(link,"15000");
    await expect(hosted!.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"10001",
      idempotencyKey:"apply-order193-over-folio",envelope:envelope("deposit.applied") }))
      .rejects.toBeInstanceOf(HostedDepositConflictError);
    const application = await hosted!.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"10000",
      idempotencyKey:"apply-order193-at-folio",envelope:envelope("deposit.applied") });
    const rows = await admin!<Array<{journal_id:string;kind:string;seq:number;account_id:string;folio_id:string|null;
      tx_code:string;amount_minor:string;business_date:string;currency:string}>>`
      SELECT j.id journal_id,j.kind,l.seq,l.account_id,l.folio_id,l.tx_code,l.amount_minor::text,
        l.business_date::text,l.currency::text FROM journal j JOIN posting_line l
        ON l.tenant_id=j.tenant_id AND l.journal_id=j.id WHERE j.tenant_id=${T}::uuid
        AND j.id IN (${captured.journalId!}::uuid,${application.journalId}::uuid) ORDER BY j.id,l.seq`;
    const captureRows = rows.filter(row => row.journal_id===captured.journalId);
    const applicationRows = rows.filter(row => row.journal_id===application.journalId);
    expect(captureRows.map(({kind,seq,account_id,folio_id,tx_code,amount_minor,business_date,currency}) =>
      ({kind,seq,account_id,folio_id,tx_code,amount_minor,business_date,currency}))).toEqual([
      {kind:"payment",seq:1,account_id:DEPOSIT,folio_id:null,tx_code:"DEP",amount_minor:"-15000",business_date:day,currency:"INR"},
      {kind:"payment",seq:2,account_id:CLEARING,folio_id:null,tx_code:"DEP",amount_minor:"15000",business_date:day,currency:"INR"},
    ]);
    expect(applicationRows.map(({kind,seq,account_id,folio_id,tx_code,amount_minor,business_date,currency}) =>
      ({kind,seq,account_id,folio_id,tx_code,amount_minor,business_date,currency}))).toEqual([
      {kind:"payment",seq:1,account_id:DEPOSIT,folio_id:null,tx_code:"DEP",amount_minor:"10000",business_date:day,currency:"INR"},
      {kind:"payment",seq:2,account_id:GUEST,folio_id:FOLIO,tx_code:"DEP",amount_minor:"-10000",business_date:day,currency:"INR"},
    ]);
    const status = await hosted!.statusForOperator(T,link.requestId);
    expect(status).toMatchObject({ capturedMinor:"15000",appliedMinor:"10000",remainingMinor:"5000" });
  }, 30_000);

  test("twenty application racers cannot over-apply one captured deposit", async () => {
    const link = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"5000",
      idempotencyKey:"create-order193-race",envelope:envelope("deposit.requested") });
    await hosted!.beginCapture(link.bearer!);
    await payments!.reconcile({ tenantId:T,operationId:link.operationId,eventId:`event-${crypto.randomUUID()}`,
      contentHash:new Bun.CryptoHasher("sha256").update(link.operationId).digest("hex"),
      providerReference:`local-${crypto.randomUUID()}`,phase:"capture",outcome:"approved",amountMinor:"5000",currency:"INR",
      envelope:envelope("payment.reconciled") });

    const racers = await Promise.allSettled(Array.from({ length:20 }, (_, index) => hosted!.apply({
      tenantId:T,hostedRequestId:link.requestId,amountMinor:"1000",idempotencyKey:`apply-order193-racer-${index}`,
      envelope:envelope("deposit.applied"),
    })));
    expect(racers.filter(result => result.status === "fulfilled")).toHaveLength(5);
    expect(racers.filter(result => result.status === "rejected")).toHaveLength(15);
    expect(racers.filter(result => result.status === "rejected").every(result =>
      result.status === "rejected" && result.reason instanceof HostedDepositConflictError)).toBeTrue();

    const proof = (await admin!<Array<{applied:string;folio:string;deposit:string;balanced:boolean}>>`SELECT
      (SELECT sum(amount_minor)::text FROM deposit_application WHERE tenant_id=${T}::uuid) applied,
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${T}::uuid AND folio_id=${FOLIO}::uuid) folio,
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${T}::uuid AND account_id=${DEPOSIT}::uuid) deposit,
      NOT EXISTS (SELECT 1 FROM posting_line WHERE tenant_id=${T}::uuid GROUP BY journal_id HAVING sum(amount_minor)<>0) balanced`)[0]!;
    expect(proof).toEqual({ applied:"5000", folio:"5000", deposit:"0", balanced:true });
  }, 30_000);

  test("RLS and composite lineage reject cross-tenant, cross-property and non-capture associations", async () => {
    const link = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"5000",
      idempotencyKey:"create-order193-hostile",envelope:envelope("deposit.requested") });
    const other = await seedTenantB();
    expect(await database!.withTenantTransaction(T, async tx => (await tx`SELECT id FROM hosted_payment_request`))).toHaveLength(1);
    expect(await database!.withTenantTransaction(TB, async tx => (await tx`SELECT id FROM hosted_payment_request`))).toHaveLength(1);
    await expect(withTenantAttack(T, async tx => {
      await tx`INSERT INTO hosted_payment_request(tenant_id,property_node,folio_id,guest_account_id,operation_id,
        deposit_account_id,amount_minor,currency,bearer_hash,key_hash,request_hash,generation,created_by,expires_at)
        VALUES(${TB}::uuid,${other.p}::uuid,${other.folio}::uuid,${other.guest}::uuid,${other.link.operationId}::uuid,${other.deposit}::uuid,
          1,'INR',repeat('a',64),repeat('b',64),repeat('c',64),2,${other.a}::uuid,transaction_timestamp()+interval '1 hour')`;
    })).rejects.toThrow();
    await expect(withTenantAttack(T, tx => tx`UPDATE hosted_payment_request SET revoked_at=transaction_timestamp()
      WHERE tenant_id=${T}::uuid AND id=${link.requestId}::uuid`)).rejects.toThrow();
    await expect(withTenantAttack(T, tx => tx`DELETE FROM hosted_payment_request
      WHERE tenant_id=${T}::uuid AND id=${link.requestId}::uuid`)).rejects.toThrow();

    const propertyB = "00000000-0000-0000-0000-000000019313";
    await admin!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
      VALUES(${propertyB}::uuid,${T}::uuid,'order193.other','property','Other Hotel','UTC','INR')`;
    await expectAdminRejected(async tx => { await tx`INSERT INTO hosted_payment_request(tenant_id,property_node,folio_id,guest_account_id,operation_id,
      deposit_account_id,amount_minor,currency,bearer_hash,key_hash,request_hash,generation,created_by,expires_at)
      VALUES(${T}::uuid,${propertyB}::uuid,${FOLIO}::uuid,${GUEST}::uuid,${link.operationId}::uuid,${DEPOSIT}::uuid,
        1,'INR',repeat('d',64),repeat('e',64),repeat('f',64),2,${A}::uuid,transaction_timestamp()+interval '1 hour')`; });

    const captured = await capture(link);
    const auth = (await admin!<Array<{id:string}>>`SELECT id FROM payment WHERE tenant_id=${T}::uuid
      AND operation_id=${link.operationId}::uuid AND phase='auth' AND status='succeeded'`)[0]!;
    await expectAdminRejected(async tx => { await tx`INSERT INTO deposit_application(tenant_id,property_node,hosted_request_id,operation_id,
      capture_payment_id,folio_id,deposit_account_id,guest_account_id,amount_minor,currency,journal_id,key_hash,request_hash,created_by)
      VALUES(${T}::uuid,${P}::uuid,${link.requestId}::uuid,${link.operationId}::uuid,${auth.id}::uuid,${FOLIO}::uuid,
        ${DEPOSIT}::uuid,${GUEST}::uuid,1,'INR',${captured.journalId!}::uuid,repeat('1',64),repeat('2',64),${A}::uuid)`; });
    await hosted!.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"1",
      idempotencyKey:"apply-order193-authority-row",envelope:envelope("deposit.applied") });
    await expect(withTenantAttack(T, tx => tx`UPDATE deposit_application SET amount_minor=2
      WHERE tenant_id=${T}::uuid`)).rejects.toThrow();
    await expect(withTenantAttack(T, tx => tx`DELETE FROM deposit_application WHERE tenant_id=${T}::uuid`)).rejects.toThrow();
    expect((await admin!<Array<{n:number;amount:string}>>`SELECT count(*)::int n,min(amount_minor)::text amount
      FROM deposit_application WHERE tenant_id=${T}::uuid`)[0]).toEqual({ n:1,amount:"1" });
  }, 30_000);

  test("an injected publish failure rolls back application, journal, postings, facts and outbox", async () => {
    const link = await hosted!.create({ tenantId:T,folioId:FOLIO,instrumentId:INSTRUMENT,amountMinor:"5000",
      idempotencyKey:"create-order193-rollback",envelope:envelope("deposit.requested") });
    await capture(link);
    const failing = new HostedDepositService({ database:database!, payments:payments!, events:{
      async publish() { throw new Error("injected order193 publish failure"); },
    } as never });
    await expect(failing.apply({ tenantId:T,hostedRequestId:link.requestId,amountMinor:"1000",
      idempotencyKey:"apply-order193-rollback",envelope:envelope("deposit.applied") })).rejects.toThrow("injected order193");
    const proof = (await admin!<Array<{applications:number;journals:number;lines:number;facts:number;events:number}>>`SELECT
      (SELECT count(*)::int FROM deposit_application WHERE tenant_id=${T}::uuid) applications,
      (SELECT count(*)::int FROM journal WHERE tenant_id=${T}::uuid AND source->>'interface'='financials.deposit.apply') journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${T}::uuid AND description='deposit application') lines,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${T}::uuid AND entity_type='deposit_application') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${T}::uuid AND event_type='deposit.applied') events`)[0]!;
    expect(proof).toEqual({ applications:0,journals:0,lines:0,facts:0,events:0 });
  }, 30_000);
});
