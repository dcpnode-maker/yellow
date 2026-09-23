import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HostedDepositNotFoundError,
  HostedDepositService,
  LocalPaymentProvider,
  MAX_FOLIO_DEPOSIT_INSTRUMENTS,
  MAX_FOLIO_HOSTED_DEPOSITS,
  PaymentService,
  type PaymentProvider,
} from "../src/contexts/financials";
import { createAuditEnvelope, Database, PostgresEventBus } from "../src/kernel";

const URL = process.env.YELLOW_HOSTED_DEPOSIT_WORKBENCH_URL;
const ADMIN_URL = process.env.YELLOW_HOSTED_DEPOSIT_WORKBENCH_ADMIN_URL ?? URL;
if (process.env.YELLOW_REQUIRE_HOSTED_DEPOSIT_WORKBENCH === "1" && !URL) {
  throw new Error("YELLOW_HOSTED_DEPOSIT_WORKBENCH_URL is required");
}

const T = "00000000-0000-0000-0000-000000057801";
const TB = "00000000-0000-0000-0000-000000057802";
const P = "00000000-0000-0000-0000-000000057811";
const P2 = "00000000-0000-0000-0000-000000057812";
const A = "00000000-0000-0000-0000-000000057821";
const PARTY = "00000000-0000-0000-0000-000000057831";
const OTHER_PARTY = "00000000-0000-0000-0000-000000057832";
const GUEST = "00000000-0000-0000-0000-000000057841";
const GUEST_P2 = "00000000-0000-0000-0000-000000057842";
const CLEARING = "00000000-0000-0000-0000-000000057843";
const DEPOSIT = "00000000-0000-0000-0000-000000057844";
const REVENUE = "00000000-0000-0000-0000-000000057845";
const UPI_CLEARING = "00000000-0000-0000-0000-000000057847";
const FOLIO = "00000000-0000-0000-0000-000000057851";
const FOLIO_P2 = "00000000-0000-0000-0000-000000057852";
const FOLIO_NO_PARTY = "00000000-0000-0000-0000-000000057853";
const CARD = "00000000-0000-0000-0000-000000057861";
const UPI = "00000000-0000-0000-0000-000000057862";
const NULL_TOKEN = "00000000-0000-0000-0000-000000057863";
const NULL_PSP = "00000000-0000-0000-0000-000000057864";
const INVALID_PSP = "00000000-0000-0000-0000-000000057865";
const OVERSIZED_TOKEN = "00000000-0000-0000-0000-000000057866";

let admin: SQL | undefined;
let events: SQL | undefined;
let database: Database | undefined;
let payments: PaymentService | undefined;
let hosted: HostedDepositService | undefined;
let businessDate = "";

class HostedProvider implements PaymentProvider {
  readonly #local = new LocalPaymentProvider();
  execute(request: Parameters<PaymentProvider["execute"]>[0]) {
    return request.phase === "capture"
      ? Promise.resolve({ outcome: "indeterminate" as const,
          providerReference: `order578-${request.commandId}`, resultCode: "indeterminate" })
      : this.#local.execute(request);
  }
}

function envelope(operation: string) {
  return createAuditEnvelope({ tenantId: T, propertyNode: P, actorId: A,
    requestId: crypto.randomUUID(), operation });
}

async function clean(): Promise<void> {
  if (!admin) return;
  for (const table of ["outbox", "fact_log", "deposit_application", "hosted_payment_request", "payment",
    "provider_event_receipt", "payment_operation", "payment_instrument", "posting_line", "journal",
    "tx_code_route", "business_day", "folio", "account", "app_user", "party_role", "party", "org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T, TB]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${T}::uuid,${TB}::uuid)`;
  await admin`DELETE FROM tx_code WHERE code='O578_ROOM'`;
}

async function seed(): Promise<void> {
  await admin!`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${T}::uuid,'order578','Order 578','shared','active')`;
  await admin!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${P}::uuid,${T}::uuid,'order578','property','Order 578 Hotel','UTC','INR'),
    (${P2}::uuid,${T}::uuid,'order578.other','property','Order 578 Other','UTC','INR')`;
  await admin!`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${A}::uuid,${T}::uuid,'actor@order578.test','Order 578 actor','active')`;
  await admin!`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${T}::uuid,'person','Order 578 guest','active'),
    (${OTHER_PARTY}::uuid,${T}::uuid,'person','Other guest','active')`;
  await admin!`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${T}::uuid,${PARTY}::uuid,'guest')`;
  await admin!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${GUEST}::uuid,${T}::uuid,${P}::uuid,'guest',${PARTY}::uuid,'Guest','INR','open'),
    (${GUEST_P2}::uuid,${T}::uuid,${P2}::uuid,'guest',${PARTY}::uuid,'Other property guest','INR','open'),
    (${CLEARING}::uuid,${T}::uuid,${P}::uuid,'card_clearing',NULL,'Clearing','INR','open'),
    (${UPI_CLEARING}::uuid,${T}::uuid,${P}::uuid,'upi_clearing',NULL,'UPI clearing','INR','open'),
    (${DEPOSIT}::uuid,${T}::uuid,${P}::uuid,'deposit_liability',NULL,'Deposit liability','INR','open'),
    (${REVENUE}::uuid,${T}::uuid,${P}::uuid,'revenue',NULL,'Revenue','INR','open')`;
  const partylessAccount = "00000000-0000-0000-0000-000000057846";
  await admin!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
    VALUES(${partylessAccount}::uuid,${T}::uuid,${P}::uuid,'guest',NULL,'Partyless guest','INR','open')`;
  await admin!`INSERT INTO folio(id,tenant_id,account_id,folio_no,window_no,status) VALUES
    (${FOLIO}::uuid,${T}::uuid,${GUEST}::uuid,'O578-1',1,'open'),
    (${FOLIO_P2}::uuid,${T}::uuid,${GUEST_P2}::uuid,'O578-2',1,'open'),
    (${FOLIO_NO_PARTY}::uuid,${T}::uuid,${partylessAccount}::uuid,'O578-3',1,'open')`;
  await admin!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    ('O578_ROOM','Room charge','revenue','Rooms','guest','revenue'),
    ('CARD_PAYMENT','Card payment','payment',NULL,'card_clearing','guest'),
    ('UPI_PAYMENT','UPI payment','payment',NULL,'upi_clearing','guest'),
    ('DEP','Deposit liability','deposit',NULL,'deposit_liability',NULL)
    ON CONFLICT (code) DO NOTHING`;
  await admin!`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id) VALUES
    (${T}::uuid,${P}::uuid,'INR','O578_ROOM',NULL,${REVENUE}::uuid),
    (${T}::uuid,${P}::uuid,'INR','CARD_PAYMENT',${CLEARING}::uuid,NULL),
    (${T}::uuid,${P}::uuid,'INR','UPI_PAYMENT',${UPI_CLEARING}::uuid,NULL),
    (${T}::uuid,${P}::uuid,'INR','DEP',NULL,${DEPOSIT}::uuid)`;
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date)
    VALUES(${T}::uuid,${P}::uuid,${businessDate}::date)`;
  await admin!`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status) VALUES
    (${CARD}::uuid,${T}::uuid,${PARTY}::uuid,'card_network_token','tok_order578_card_opaque','Visa','5781','12/30','local','active'),
    (${UPI}::uuid,${T}::uuid,${PARTY}::uuid,'upi_vpa','tok_order578_upi_opaque',NULL,NULL,NULL,'local','active'),
    (${crypto.randomUUID()}::uuid,${T}::uuid,${PARTY}::uuid,'card_network_token','tok_order578_inactive','MC','5782','11/29','local','inactive'),
    (${crypto.randomUUID()}::uuid,${T}::uuid,${PARTY}::uuid,'bank','tok_order578_bank','Bank',NULL,NULL,'local','active'),
    (${NULL_TOKEN}::uuid,${T}::uuid,${PARTY}::uuid,'card_network_token',NULL,'Null token','5784','10/29','local','active'),
    (${NULL_PSP}::uuid,${T}::uuid,${PARTY}::uuid,'upi_vpa','tok_order578_null_psp',NULL,NULL,NULL,NULL,'active'),
    (${INVALID_PSP}::uuid,${T}::uuid,${PARTY}::uuid,'card_network_token','tok_order578_bad_psp','Bad PSP','5785','10/29','UPPER','active'),
    (${OVERSIZED_TOKEN}::uuid,${T}::uuid,${PARTY}::uuid,'card_network_token',${'x'.repeat(201)},'Long token','5786','10/29','local','active'),
    (${crypto.randomUUID()}::uuid,${T}::uuid,${OTHER_PARTY}::uuid,'card_network_token','tok_order578_other_party','Visa','5783','10/28','local','active')`;
  await admin!.begin(async tx => {
    const journal = (await tx<Array<{ id: string }>>`INSERT INTO journal(tenant_id,property_node,business_date,kind,
      description,currency,source,created_by) VALUES(${T}::uuid,${P}::uuid,${businessDate}::date,'charge',
      'Order 578 opening charge','INR','{}',${A}::uuid) RETURNING id`)[0]!;
    await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,
      quantity,business_date,currency) VALUES
      (${T}::uuid,${journal.id}::uuid,1,${GUEST}::uuid,${FOLIO}::uuid,'O578_ROOM','charge',10000,1,${businessDate}::date,'INR'),
      (${T}::uuid,${journal.id}::uuid,2,${REVENUE}::uuid,NULL,'O578_ROOM','charge',-10000,1,${businessDate}::date,'INR')`;
  });
}

async function fingerprint(): Promise<string> {
  return (await admin!<Array<{ fingerprint: string }>>`SELECT md5(concat_ws('|',
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM hosted_payment_request t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM payment_operation t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM payment t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM deposit_application t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM payment_instrument t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM journal t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM posting_line t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM fact_log t WHERE tenant_id=${T}::uuid),
    (SELECT COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'') FROM outbox t WHERE tenant_id=${T}::uuid)
  )) fingerprint`)[0]!.fingerprint;
}

async function createDeposit(amountMinor: string, suffix: string) {
  return hosted!.create({ tenantId: T, folioId: FOLIO, instrumentId: CARD, amountMinor,
    idempotencyKey: `order578-create-${suffix}`, envelope: envelope("deposit.requested") });
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(ADMIN_URL!, { max: 8 });
  events = new SQL(URL, { max: 8 });
  database = Database.connect(URL, { maxConnections: 16 });
  payments = new PaymentService({ database, events: new PostgresEventBus(events), provider: new HostedProvider() });
  hosted = new HostedDepositService({ database, payments, events: new PostgresEventBus(events) });
  businessDate = (await admin<Array<{ date: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text date`)[0]!.date;
});

beforeEach(async () => { if (URL) { await clean(); await seed(); } });
afterAll(async () => {
  await clean();
  await database?.close();
  await events?.close();
  await admin?.close();
});

describe("Order 578 folio hosted-deposit read model contract", () => {
  test("exports fixed non-zero response caps", () => {
    expect(MAX_FOLIO_HOSTED_DEPOSITS).toBe(50);
    expect(MAX_FOLIO_DEPOSIT_INSTRUMENTS).toBe(50);
  });
});

(URL ? describe.serial : describe.skip)("Order 578 real PostgreSQL read model", () => {
  test("open folio and account return only canonically eligible token and PSP instruments without writes", async () => {
    const before = await fingerprint();
    const result = await hosted!.workbenchForFolio({ tenantId: T, propertyNode: P, folioId: FOLIO });
    expect(result).toEqual({
      propertyNode: P,
      folioId: FOLIO,
      deposits: [],
      instruments: [
        { instrumentId: CARD, kind: "card_network_token", brand: "Visa", last4: "5781", expiry: "12/30", psp: "local" },
        { instrumentId: UPI, kind: "upi_vpa", brand: null, last4: null, expiry: null, psp: "local" },
      ],
    });
    expect(Object.keys(result.instruments[0]!).sort()).toEqual(
      ["brand", "expiry", "instrumentId", "kind", "last4", "psp"],
    );
    const serialized = JSON.stringify(result);
    for (const ineligible of [NULL_TOKEN, NULL_PSP, INVALID_PSP, OVERSIZED_TOKEN]) {
      expect(serialized).not.toContain(ineligible);
    }
    for (const secret of ["tok_order578", "bearer", "bearerHash", "keyHash", "requestHash", "providerReference"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(await fingerprint()).toBe(before);
  });

  test("closed folio or guest account keeps historical deposit truth but advertises no instruments", async () => {
    const ready = await createDeposit("2500", "closed-context-history");

    await admin!`UPDATE account SET status='closed' WHERE tenant_id=${T}::uuid AND id=${GUEST}::uuid`;
    let beforeRead = await fingerprint();
    let result = await hosted!.workbenchForFolio({ tenantId: T, propertyNode: P, folioId: FOLIO });
    expect(result.deposits.map(({ requestId }) => requestId)).toEqual([ready.requestId]);
    expect(result.deposits[0]).toMatchObject({ state: "ready", amountMinor: "2500" });
    expect(result.instruments).toEqual([]);
    expect(await fingerprint()).toBe(beforeRead);

    await admin!`UPDATE account SET status='open' WHERE tenant_id=${T}::uuid AND id=${GUEST}::uuid`;
    await admin!`UPDATE folio SET status='closed' WHERE tenant_id=${T}::uuid AND id=${FOLIO}::uuid`;
    beforeRead = await fingerprint();
    result = await hosted!.workbenchForFolio({ tenantId: T, propertyNode: P, folioId: FOLIO });
    expect(result.deposits.map(({ requestId }) => requestId)).toEqual([ready.requestId]);
    expect(result.deposits[0]).toMatchObject({ state: "ready", amountMinor: "2500" });
    expect(result.instruments).toEqual([]);
    expect(await fingerprint()).toBe(beforeRead);
  });

  test("uses canonical status truth, latest-first ordering and exact response caps", async () => {
    const captured = await createDeposit("5000", "captured");
    await hosted!.beginCapture(captured.bearer!);
    await payments!.reconcile({ tenantId: T, operationId: captured.operationId,
      eventId: `order578-event-${crypto.randomUUID()}`,
      contentHash: new Bun.CryptoHasher("sha256").update(captured.operationId).digest("hex"),
      providerReference: `order578-provider-${crypto.randomUUID()}`, phase: "capture", outcome: "approved",
      amountMinor: "5000", currency: "INR", envelope: envelope("payment.reconciled") });
    await hosted!.apply({ tenantId: T, hostedRequestId: captured.requestId, amountMinor: "2000",
      idempotencyKey: "order578-apply-captured", envelope: envelope("deposit.applied") });
    const ready = await createDeposit("3000", "ready");
    let result = await hosted!.workbenchForFolio({ tenantId: T, propertyNode: P, folioId: FOLIO });
    expect(result.deposits.map(({ requestId }) => requestId)).toEqual([ready.requestId, captured.requestId]);
    expect(result.deposits[0]).toMatchObject({ generation: 2, state: "ready", capturedMinor: "0",
      appliedMinor: "0", remainingMinor: "0" });
    expect(result.deposits[1]).toMatchObject({ generation: 1, state: "captured", amountMinor: "5000",
      capturedMinor: "5000", appliedMinor: "2000", remainingMinor: "3000" });

    for (let generation = 3; generation <= MAX_FOLIO_HOSTED_DEPOSITS + 2; generation += 1) {
      await createDeposit(String(1000 + generation), `bounded-${generation}`);
    }
    for (let index = 0; index < MAX_FOLIO_DEPOSIT_INSTRUMENTS + 3; index += 1) {
      const id = `00000000-0000-0000-0000-${String(578700 + index).padStart(12, "0")}`;
      await admin!`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status)
        VALUES(${id}::uuid,${T}::uuid,${PARTY}::uuid,'card_network_token',${`tok_order578_bound_${index}`},
          'Bound',${String(index).padStart(4, "0")},'12/31','local','active')`;
    }
    const beforeRead = await fingerprint();
    result = await hosted!.workbenchForFolio({ tenantId: T, propertyNode: P, folioId: FOLIO });
    expect(result.deposits).toHaveLength(MAX_FOLIO_HOSTED_DEPOSITS);
    expect(result.deposits.map(({ generation }) => generation)).toEqual(
      Array.from({ length: MAX_FOLIO_HOSTED_DEPOSITS }, (_, index) => MAX_FOLIO_HOSTED_DEPOSITS + 2 - index),
    );
    expect(result.instruments).toHaveLength(MAX_FOLIO_DEPOSIT_INSTRUMENTS);
    expect(result.instruments.map(({ instrumentId }) => instrumentId)).toEqual(
      [...result.instruments.map(({ instrumentId }) => instrumentId)].sort((left, right) => left.localeCompare(right)),
    );
    expect(await fingerprint()).toBe(beforeRead);
  }, 60_000);

  test("fails closed across tenant, property, folio and owner-Party incoherence", async () => {
    await expect(hosted!.workbenchForFolio({ tenantId: T, propertyNode: P2, folioId: FOLIO }))
      .rejects.toBeInstanceOf(HostedDepositNotFoundError);
    await expect(hosted!.workbenchForFolio({ tenantId: T, propertyNode: P, folioId: FOLIO_P2 }))
      .rejects.toBeInstanceOf(HostedDepositNotFoundError);
    await expect(hosted!.workbenchForFolio({ tenantId: T, propertyNode: P, folioId: FOLIO_NO_PARTY }))
      .rejects.toBeInstanceOf(HostedDepositNotFoundError);
    await expect(hosted!.workbenchForFolio({ tenantId: TB, propertyNode: P, folioId: FOLIO }))
      .rejects.toBeInstanceOf(HostedDepositNotFoundError);
    const validOtherProperty = await hosted!.workbenchForFolio({ tenantId: T, propertyNode: P2, folioId: FOLIO_P2 });
    expect(validOtherProperty).toMatchObject({ propertyNode: P2, folioId: FOLIO_P2, deposits: [] });
  });
});
