import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  FolioConflictError,
  FolioNotFoundError,
  FolioService,
  FolioValidationError,
  type OpenPrimaryFolioInput,
} from "../src/contexts/financials";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_FINANCIAL_FOLIOS_URL;
const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_FINANCIAL_FOLIOS === "1";

if (REQUIRE_DATABASE && (!DATABASE_URL || !DEPLOY_DATABASE_URL)) {
  throw new Error("YELLOW_FINANCIAL_FOLIOS_URL and YELLOW_DEPLOY_DATABASE_URL are required");
}

const TENANT_A = "00000000-0000-0000-0000-000000010301";
const TENANT_B = "00000000-0000-0000-0000-000000010302";
const PROPERTY_A = "00000000-0000-0000-0000-000000010311";
const PROPERTY_B = "00000000-0000-0000-0000-000000010312";
const PROPERTY_FOREIGN = "00000000-0000-0000-0000-000000010313";
const PROPERTY_ROLLBACK = "00000000-0000-0000-0000-000000010314";
const ACTOR_A = "00000000-0000-0000-0000-000000010321";
const ACTOR_B = "00000000-0000-0000-0000-000000010322";
const PARTY_A = "00000000-0000-0000-0000-000000010331";
const PARTY_B = "00000000-0000-0000-0000-000000010332";
const RESERVATION_ONE = "00000000-0000-0000-0000-000000010341";
const RESERVATION_TWO = "00000000-0000-0000-0000-000000010342";
const RESERVATION_PROPERTY_B = "00000000-0000-0000-0000-000000010343";
const RESERVATION_USD = "00000000-0000-0000-0000-000000010344";
const RESERVATION_RACE = "00000000-0000-0000-0000-000000010345";
const RESERVATION_ROLLBACK = "00000000-0000-0000-0000-000000010346";
const RESERVATION_CORRUPT = "00000000-0000-0000-0000-000000010347";
const RESERVATION_HOSTILE = "00000000-0000-0000-0000-000000010348";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_FINANCIAL_FOLIOS_URL is required by the Order 103 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let folios: FolioService | undefined;

function envelope(propertyNode = PROPERTY_A, tenantId = TENANT_A, actorId = ACTOR_A) {
  return createAuditEnvelope({
    operation: "folio.opened", tenantId, propertyNode, actorId, requestId: crypto.randomUUID(),
  });
}

function input(reservationId: string, idempotencyKey = `order103-${crypto.randomUUID()}`,
  propertyNode = PROPERTY_A): OpenPrimaryFolioInput {
  return { tenantId: TENANT_A, reservationId, idempotencyKey, envelope: envelope(propertyNode) };
}

function serviceFor(bus: EventBus): FolioService {
  return new FolioService({ events: bus, idempotency: new PostgresIdempotency() });
}

async function open(request: OpenPrimaryFolioInput, service = folios!,
  transactionTenant = request.tenantId) {
  return database!.withTenantTransaction(transactionTenant, (tx) => service.openPrimary(tx, request));
}

class FailAfterPublishEventBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 103 injected failure after outbox insertion");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

interface FolioArtifacts { accounts: number; folios: number; facts: number; events: number; idempotency: number }
async function artifactCounts(propertyNode?: string): Promise<FolioArtifacts> {
  const propertyFilter = propertyNode ?? null;
  const rows = await admin!<FolioArtifacts[]>`
    SELECT
      (SELECT count(*)::int FROM account WHERE tenant_id=${TENANT_A}::uuid
        AND (${propertyFilter}::uuid IS NULL OR property_node=${propertyFilter}::uuid)) AS accounts,
      (SELECT count(*)::int FROM folio f JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
        WHERE f.tenant_id=${TENANT_A}::uuid
          AND (${propertyFilter}::uuid IS NULL OR a.property_node=${propertyFilter}::uuid)) AS folios,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
        AND fact_type='folio.opened') AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
        AND event_type='folio.opened') AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid
        AND operation='financials.folio.open') AS idempotency`;
  return rows[0]!;
}

interface ExcludedFinancialCounts {
  journals: number; postingLines: number; paymentInstruments: number; payments: number;
  cashierSessions: number; businessDays: number; documents: number; arAllocations: number;
  fiscalSubmissions: number;
}
async function excludedFinancialCounts(): Promise<ExcludedFinancialCounts> {
  const rows = await admin!<ExcludedFinancialCounts[]>`
    SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_A}::uuid) AS "journals",
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT_A}::uuid) AS "postingLines",
      (SELECT count(*)::int FROM payment_instrument WHERE tenant_id=${TENANT_A}::uuid) AS "paymentInstruments",
      (SELECT count(*)::int FROM payment WHERE tenant_id=${TENANT_A}::uuid) AS "payments",
      (SELECT count(*)::int FROM cashier_session WHERE tenant_id=${TENANT_A}::uuid) AS "cashierSessions",
      (SELECT count(*)::int FROM business_day WHERE tenant_id=${TENANT_A}::uuid) AS "businessDays",
      (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT_A}::uuid) AS "documents",
      (SELECT count(*)::int FROM ar_allocation WHERE tenant_id=${TENANT_A}::uuid) AS "arAllocations",
      (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT_A}::uuid) AS "fiscalSubmissions"`;
  return rows[0]!;
}

async function seriesNext(propertyNode: string): Promise<bigint> {
  const rows = await admin!<Array<{ next_no: bigint }>>`
    SELECT next_no FROM document_series WHERE tenant_id=${TENANT_A}::uuid
      AND property_node=${propertyNode}::uuid AND kind='folio' AND fiscal=false`;
  expect(rows).toHaveLength(1);
  return BigInt(rows[0]!.next_no);
}

async function rejectSql(statement: string, expectedState: string): Promise<void> {
  try {
    await admin!.unsafe(statement);
  } catch (error) {
    expect((error as { errno?: string }).errno).toBe(expectedState);
    return;
  }
  throw new Error(`Expected SQLSTATE ${expectedState}`);
}

async function cleanFixtures(): Promise<void> {
  if (!admin) return;
  await admin!`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM ar_allocation WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM payment WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM payment_instrument WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM cashier_session WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM business_day WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM document_series WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM reservation_guest WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM app_user WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await admin!`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL!, { max: 32 });
  eventPool = new SQL(DATABASE_URL, { max: 32 });
  database = Database.connect(DATABASE_URL, { maxConnections: 64 });
  events = new PostgresEventBus(eventPool);
  folios = serviceFor(events);
  await cleanFixtures();
  await admin!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,'order103-a','Order 103 A','shared','active'),
    (${TENANT_B}::uuid,'order103-b','Order 103 B','shared','active')`;
  await admin!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order103_a','property','Order 103 A','Asia/Kolkata','INR'),
    (${PROPERTY_B}::uuid,${TENANT_A}::uuid,'order103_b','property','Order 103 B','UTC','USD'),
    (${PROPERTY_ROLLBACK}::uuid,${TENANT_A}::uuid,'order103_rollback','property','Order 103 Rollback','UTC','USD'),
    (${PROPERTY_FOREIGN}::uuid,${TENANT_B}::uuid,'order103_foreign','property','Order 103 Foreign','UTC','USD')`;
  await admin!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor-a@order103.test','Order 103 Actor A','active'),
    (${ACTOR_B}::uuid,${TENANT_B}::uuid,'actor-b@order103.test','Order 103 Actor B','active')`;
  await admin!`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Order 103 Guest A','active'),
    (${PARTY_B}::uuid,${TENANT_B}::uuid,'person','Order 103 Guest B','active')`;
  await admin!`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TENANT_A}::uuid,${PARTY_A}::uuid,'guest'),(${TENANT_B}::uuid,${PARTY_B}::uuid,'guest')`;
  await admin!`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency) VALUES
    (${RESERVATION_ONE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O103-1','reserved',${PARTY_A}::uuid,'direct','INR'),
    (${RESERVATION_TWO}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O103-2','due_in',${PARTY_A}::uuid,'direct','INR'),
    (${RESERVATION_PROPERTY_B}::uuid,${TENANT_A}::uuid,${PROPERTY_B}::uuid,'O103-3','in_house',${PARTY_A}::uuid,'direct','USD'),
    (${RESERVATION_USD}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O103-4','due_out',${PARTY_A}::uuid,'direct','USD'),
    (${RESERVATION_RACE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O103-5','reserved',${PARTY_A}::uuid,'direct','INR'),
    (${RESERVATION_ROLLBACK}::uuid,${TENANT_A}::uuid,${PROPERTY_ROLLBACK}::uuid,'O103-6','reserved',${PARTY_A}::uuid,'direct','USD'),
    (${RESERVATION_CORRUPT}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O103-7','reserved',${PARTY_A}::uuid,'direct','INR'),
    (${RESERVATION_HOSTILE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O103-8','reserved',${PARTY_A}::uuid,'direct','INR')`;
  await admin!`INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal) VALUES
    (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'folio','FA-',100,false),
    (${TENANT_A}::uuid,${PROPERTY_B}::uuid,'folio','FB-',200,false),
    (${TENANT_A}::uuid,${PROPERTY_ROLLBACK}::uuid,'folio','RB-',1,false),
    (${TENANT_B}::uuid,${PROPERTY_FOREIGN}::uuid,'folio','FF-',1,false)`;
});

afterAll(async () => {
  await cleanFixtures(); await database?.close(); await eventPool?.close(); await admin?.close();
}, 30_000);

describe("Order 103 account-owned reservation folio foundation", () => {
  test("P0: the financial context exposes canonical primary-folio opening", () => {
    expect(typeof FolioService).toBe("function");
  });
});

databaseDescribe("Order 103 fresh-PostgreSQL account and folio proof", () => {
  test("P1: migration adds tenant-coherent references and one reservation window", async () => {
    const rows = await admin!<Array<{ table_name: string; definition: string }>>`
      SELECT conrelid::regclass::text AS table_name,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid IN ('account'::regclass,'folio'::regclass)
      ORDER BY conrelid::regclass::text,conname`;
    const defs = rows.map((r) => `${r.table_name}:${r.definition}`);
    expect(defs.some((v) => v.includes("account:FOREIGN KEY (tenant_id, property_node)"))).toBeTrue();
    expect(defs.some((v) => v.includes("account:FOREIGN KEY (tenant_id, party_id)"))).toBeTrue();
    expect(defs.some((v) => v.includes("folio:FOREIGN KEY (tenant_id, account_id)"))).toBeTrue();
    expect(defs.some((v) => v.includes("folio:FOREIGN KEY (tenant_id, reservation_id)"))).toBeTrue();
    expect(defs.some((v) => v.includes("folio:UNIQUE (tenant_id, reservation_id, window_no)"))).toBeTrue();
    await rejectSql(`INSERT INTO account(tenant_id,property_node,role,name,currency) VALUES('${TENANT_A}','${PROPERTY_FOREIGN}','guest','reject','USD')`, "23503");
    await rejectSql(`INSERT INTO account(tenant_id,property_node,role,party_id,name,currency) VALUES('${TENANT_A}','${PROPERTY_A}','guest','${PARTY_B}','reject','INR')`, "23503");
    const accountId = crypto.randomUUID();
    await admin!.unsafe("INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency) VALUES($1,$2,$3,'guest',$4,'migration test','INR')",[accountId,TENANT_A,PROPERTY_A,PARTY_A]);
    await rejectSql(`INSERT INTO folio(tenant_id,account_id,folio_no,window_no) VALUES('${TENANT_B}','${accountId}','REJECT-A',1)`, "23503");
    await rejectSql(`INSERT INTO folio(tenant_id,account_id,reservation_id,folio_no,window_no) VALUES('${TENANT_A}','${accountId}','00000000-0000-0000-0000-000000019999','REJECT-R',1)`, "23503");
    await admin!.unsafe("INSERT INTO folio(tenant_id,account_id,reservation_id,folio_no,window_no) VALUES($1,$2,$3,'MIG-W1',1)",[TENANT_A,accountId,RESERVATION_HOSTILE]);
    await rejectSql(`INSERT INTO folio(tenant_id,account_id,reservation_id,folio_no,window_no) VALUES('${TENANT_A}','${accountId}','${RESERVATION_HOSTILE}','MIG-W1-DUP',1)`, "23505");
    await admin!`DELETE FROM folio WHERE account_id=${accountId}::uuid`;
    await admin!`DELETE FROM account WHERE id=${accountId}::uuid`;
  },30_000);

  test("P2: canonical opening reuses only exact dimensions and emits minimized evidence", async () => {
    const excludedBefore = await excludedFinancialCounts();
    const first = await open(input(RESERVATION_ONE,"order103-primary-one"));
    expect(first).toMatchObject({reservationId:RESERVATION_ONE,folioNo:"FA-100",windowNo:1,changed:true,replayed:false});
    const second = await open(input(RESERVATION_TWO,"order103-primary-two"));
    expect(second).toMatchObject({folioNo:"FA-101",changed:true});
    expect(second.accountId).toBe(first.accountId);
    const otherProperty = await open(input(RESERVATION_PROPERTY_B,"order103-primary-property",PROPERTY_B));
    expect(otherProperty).toMatchObject({folioNo:"FB-200",changed:true});
    expect(otherProperty.accountId).not.toBe(first.accountId);
    const otherCurrency = await open(input(RESERVATION_USD,"order103-primary-currency"));
    expect(otherCurrency).toMatchObject({folioNo:"FA-102",changed:true});
    expect(otherCurrency.accountId).not.toBe(first.accountId);
    const accounts = await admin!<Array<Record<string,unknown>>>`SELECT id,tenant_id,property_node,role,party_id,name,currency,status FROM account WHERE tenant_id=${TENANT_A}::uuid ORDER BY property_node,currency`;
    expect(accounts).toHaveLength(3);
    expect(accounts.every((a) => a.role==="guest"&&a.party_id===PARTY_A&&a.status==="open")).toBeTrue();
    expect(JSON.stringify(accounts)).not.toContain("Order 103 Guest A");
    const evidence = await admin!<Array<{fact_payload:Record<string,unknown>;event_payload:Record<string,unknown>;property_node:string;actor_id:string}>>`
      SELECT fact.payload fact_payload,event.payload event_payload,event.property_node,event.actor_id
      FROM fact_log fact JOIN outbox event ON event.tenant_id=fact.tenant_id AND event.aggregate_id=fact.entity_id AND event.event_type='folio.opened'
      WHERE fact.tenant_id=${TENANT_A}::uuid AND fact.fact_type='folio.opened' AND fact.entity_id=${first.folioId}::uuid`;
    const minimized={folio_id:first.folioId,account_id:first.accountId,reservation_id:RESERVATION_ONE,window_no:1,folio_no:"FA-100"};
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.fact_payload).toEqual({...minimized,request_id:expect.any(String)});
    expect(evidence[0]!.event_payload).toEqual(minimized);
    expect(evidence[0]).toMatchObject({property_node:PROPERTY_A,actor_id:ACTOR_A});
    expect(JSON.stringify(evidence)).not.toContain("Order 103 Guest A");
    expect(await excludedFinancialCounts()).toEqual(excludedBefore);
  },30_000);

  test("P2: existing canonical window is unchanged and invents no evidence", async () => {
    const before=await artifactCounts(); const next=await seriesNext(PROPERTY_A);
    const result=await open(input(RESERVATION_ONE,"order103-primary-unchanged"));
    expect(result).toMatchObject({folioNo:"FA-100",windowNo:1,changed:false,replayed:false});
    expect(await artifactCounts()).toEqual({...before,idempotency:before.idempotency+1});
    expect(await seriesNext(PROPERTY_A)).toBe(next);
  });

  test("P3: twenty different keys converge on one window and evidence effect", async () => {
    const before=await artifactCounts(); const next=await seriesNext(PROPERTY_A);
    const results=await Promise.all(Array.from({length:20},(_,i)=>open(input(RESERVATION_RACE,`order103-race-${i.toString().padStart(2,"0")}`))));
    expect(new Set(results.map(r=>r.folioId)).size).toBe(1);
    expect(new Set(results.map(r=>r.accountId)).size).toBe(1);
    expect(results.filter(r=>r.changed)).toHaveLength(1);
    expect(results.every(r=>r.folioNo===`FA-${next}`&&r.windowNo===1)).toBeTrue();
    expect(await artifactCounts()).toEqual({accounts:before.accounts,folios:before.folios+1,facts:before.facts+1,events:before.events+1,idempotency:before.idempotency+20});
    expect(await seriesNext(PROPERTY_A)).toBe(next+1n);
  },30_000);

  test("P3: replay is exact and changed content conflicts", async () => {
    const request=input(RESERVATION_RACE,"order103-replay-exact");
    const first=await open(request); expect(await open(request)).toEqual({...first,replayed:true});
    await expect(open({...request,reservationId:RESERVATION_TWO})).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  test("P3: after-outbox failure rolls back and retry reuses the number", async () => {
    const excluded=await excludedFinancialCounts(); const before=await artifactCounts(PROPERTY_ROLLBACK);
    const next=await seriesNext(PROPERTY_ROLLBACK);
    const request=input(RESERVATION_ROLLBACK,"order103-rollback-after-outbox",PROPERTY_ROLLBACK);
    await expect(open(request,serviceFor(new FailAfterPublishEventBus(events!)))).rejects.toThrow("failure after outbox insertion");
    expect(await artifactCounts(PROPERTY_ROLLBACK)).toEqual(before); expect(await seriesNext(PROPERTY_ROLLBACK)).toBe(next);
    expect(await excludedFinancialCounts()).toEqual(excluded);
    expect(await open(request)).toMatchObject({folioNo:`RB-${next}`,changed:true,replayed:false});
    expect(await seriesNext(PROPERTY_ROLLBACK)).toBe(next+1n);
  });

  test("P4: malformed authority, ids, keys and envelopes fail without artifacts", async () => {
    const before=await artifactCounts();
    const invalid:OpenPrimaryFolioInput[]=[
      {...input(RESERVATION_HOSTILE),tenantId:"bad"},{...input(RESERVATION_HOSTILE),reservationId:"bad"},
      {...input(RESERVATION_HOSTILE),idempotencyKey:"short"},{...input(RESERVATION_HOSTILE),idempotencyKey:"order 103 spaces"},
      {...input(RESERVATION_HOSTILE),envelope:{...envelope(),operation:"folio.closed"}},
      {...input(RESERVATION_HOSTILE),envelope:envelope(PROPERTY_A,TENANT_B,ACTOR_B)},
      {...input(RESERVATION_HOSTILE),callerProperty:PROPERTY_B} as unknown as OpenPrimaryFolioInput,
    ];
    for(const request of invalid){await expect(open(request)).rejects.toBeInstanceOf(FolioValidationError);expect(await artifactCounts()).toEqual(before)}
    await expect(open({...input(RESERVATION_HOSTILE),envelope:envelope(PROPERTY_B)}))
      .rejects.toBeInstanceOf(FolioNotFoundError);
    const foreign={tenantId:TENANT_B,reservationId:RESERVATION_HOSTILE,idempotencyKey:"order103-foreign-tenant",envelope:envelope(PROPERTY_FOREIGN,TENANT_B,ACTOR_B)} satisfies OpenPrimaryFolioInput;
    await expect(open(foreign)).rejects.toBeInstanceOf(FolioNotFoundError);
    expect(await artifactCounts()).toEqual(before);
  });

  test("P4: ineligible reservation states fail closed", async () => {
    const before=await artifactCounts();
    for(const status of ["quote","waitlist","checked_out","cancelled","no_show"] as const){
      await admin!`UPDATE reservation SET status=${status} WHERE id=${RESERVATION_HOSTILE}::uuid`;
      await expect(open(input(RESERVATION_HOSTILE,`order103-state-${status}`))).rejects.toBeInstanceOf(FolioConflictError);
      expect(await artifactCounts()).toEqual(before);
    }
    await admin!`UPDATE reservation SET status='reserved' WHERE id=${RESERVATION_HOSTILE}::uuid`;
  });

  test("P4: missing, ambiguous and fiscal-only series fail", async () => {
    const before=await artifactCounts();
    const next=await seriesNext(PROPERTY_A);
    await admin!`DELETE FROM document_series WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND kind='folio'`;
    await expect(open(input(RESERVATION_HOSTILE,"order103-series-missing"))).rejects.toBeInstanceOf(FolioConflictError);
    await admin!`INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal) VALUES(${TENANT_A}::uuid,${PROPERTY_A}::uuid,'folio','FA-',${next},false)`;
    await admin!`INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal) VALUES(${TENANT_A}::uuid,${PROPERTY_A}::uuid,'folio','FA-SECOND-',1,false)`;
    await expect(open(input(RESERVATION_HOSTILE,"order103-series-ambiguous"))).rejects.toBeInstanceOf(FolioConflictError);
    await admin!`DELETE FROM document_series WHERE tenant_id=${TENANT_A}::uuid AND prefix='FA-SECOND-'`;
    await admin!`UPDATE document_series SET fiscal=true WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND prefix='FA-'`;
    await expect(open(input(RESERVATION_HOSTILE,"order103-series-fiscal"))).rejects.toBeInstanceOf(FolioConflictError);
    await admin!`UPDATE document_series SET fiscal=false WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND prefix='FA-'`;
    expect(await artifactCounts()).toEqual(before);
  });

  test("P4: duplicate/non-open accounts and corrupt windows fail closed", async () => {
    const before=await artifactCounts();
    const make=async(status:"open"|"frozen"|"closed",name:string)=>(await admin!<Array<{id:string}>>`INSERT INTO account(tenant_id,property_node,role,party_id,name,currency,status) VALUES(${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest',${PARTY_A}::uuid,${name},'INR',${status}) RETURNING id`)[0]!.id;
    const canonical=(await admin!<Array<{id:string}>>`SELECT id FROM account WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid AND party_id=${PARTY_A}::uuid AND role='guest' AND currency='INR'`)[0]!.id;
    await admin!`UPDATE account SET status='frozen' WHERE id=${canonical}::uuid`;
    await expect(open(input(RESERVATION_HOSTILE,"order103-account-frozen"))).rejects.toBeInstanceOf(FolioConflictError);
    await admin!`UPDATE account SET status='closed' WHERE id=${canonical}::uuid`;
    await expect(open(input(RESERVATION_HOSTILE,"order103-account-closed"))).rejects.toBeInstanceOf(FolioConflictError);
    await admin!`UPDATE account SET status='open' WHERE id=${canonical}::uuid`;
    const duplicate=await make("open","hostile duplicate");
    await expect(open(input(RESERVATION_HOSTILE,"order103-account-ambiguous"))).rejects.toBeInstanceOf(FolioConflictError);
    await admin!`DELETE FROM account WHERE id=${duplicate}::uuid`;
    const corrupt=(await admin!<Array<{id:string}>>`INSERT INTO account(tenant_id,property_node,role,name,currency,status) VALUES(${TENANT_A}::uuid,${PROPERTY_A}::uuid,'house','corrupt relationship','INR','open') RETURNING id`)[0]!.id;
    await admin!`INSERT INTO folio(tenant_id,account_id,reservation_id,folio_no,window_no,status) VALUES(${TENANT_A}::uuid,${corrupt}::uuid,${RESERVATION_CORRUPT}::uuid,'CORRUPT-1',1,'open')`;
    await expect(open(input(RESERVATION_CORRUPT,"order103-corrupt-window"))).rejects.toBeInstanceOf(FolioConflictError);
    await admin!`DELETE FROM folio WHERE reservation_id=${RESERVATION_CORRUPT}::uuid`; await admin!`DELETE FROM account WHERE id=${corrupt}::uuid`;
    expect(await artifactCounts()).toEqual(before);
  });

  test("P4: RLS hides the foreign tenant and excluded tables remain unchanged", async () => {
    const excluded=await excludedFinancialCounts();
    const seen=await database!.withTenantTransaction(TENANT_B,async(tx)=>{
      const a=await tx<Array<{count:number}>>`SELECT count(*)::int count FROM account WHERE tenant_id=${TENANT_A}::uuid`;
      const f=await tx<Array<{count:number}>>`SELECT count(*)::int count FROM folio WHERE tenant_id=${TENANT_A}::uuid`;
      return {accounts:a[0]!.count,folios:f[0]!.count};
    });
    expect(seen).toEqual({accounts:0,folios:0}); expect(await excludedFinancialCounts()).toEqual(excluded);
  });
});
