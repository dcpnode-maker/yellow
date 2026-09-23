import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  BusinessDayCloseReadinessService,
  BusinessDayCloseReadinessUnavailableError,
} from "../src/contexts/financials";
import { Database } from "../src/kernel";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_BUSINESS_DAY_CLOSE_READINESS === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Order 349 database proof requires deploy and runtime URLs");
const databaseDescribe = DEPLOY && RUNTIME ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000034900";
const PROPERTY = "00000000-0000-0000-0000-000000034901";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000034902";
const ACTOR = "00000000-0000-0000-0000-000000034903";
const INACTIVE_ACTOR = "00000000-0000-0000-0000-000000034904";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000034905";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000034906";
const PARTY = "00000000-0000-0000-0000-000000034907";
const RESERVATION = "00000000-0000-0000-0000-000000034908";
const SPACE = "00000000-0000-0000-0000-000000034909";
const ACCOUNT = "00000000-0000-0000-0000-000000034910";
const CLEARING = "00000000-0000-0000-0000-000000034911";
const FOLIO = "00000000-0000-0000-0000-000000034912";
const INSTRUMENT = "00000000-0000-0000-0000-000000034913";
const DRAWER = "00000000-0000-0000-0000-000000034914";
const DAY = "2047-05-06";

let admin: SQL | undefined;
let database: Database | undefined;
let service: BusinessDayCloseReadinessService | undefined;

const input = (overrides: Record<string, string> = {}) => ({
  tenantId: TENANT, propertyNode: PROPERTY, businessDate: DAY, actorId: ACTOR, ...overrides,
});

async function clearEvidence() {
  await admin!.begin(async (tx) => {
    await tx`SET CONSTRAINTS ALL DEFERRED`;
    await tx`DELETE FROM cashier_count_line WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM cashier_count WHERE tenant_id=${TENANT}::uuid`;
    await tx`DELETE FROM cashier_session WHERE tenant_id=${TENANT}::uuid`;
  });
  await admin!`DELETE FROM fiscal_submission WHERE tenant_id=${TENANT}::uuid`;
  await admin!`DELETE FROM statutory_submission WHERE tenant_id=${TENANT}::uuid`;
  await admin!`DELETE FROM document WHERE tenant_id=${TENANT}::uuid`;
  await admin!`DELETE FROM discrepancy WHERE tenant_id=${TENANT}::uuid`;
  await admin!`DELETE FROM payment WHERE tenant_id=${TENANT}::uuid`;
  await admin!`DELETE FROM payment_operation WHERE tenant_id=${TENANT}::uuid`;
  await admin!`DELETE FROM inbound_message WHERE tenant_id=${TENANT}::uuid`;
  await admin!`UPDATE reservation SET status='reserved' WHERE tenant_id=${TENANT}::uuid AND id=${RESERVATION}::uuid`;
  await admin!`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await admin!`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date)
    VALUES (${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date)`;
}

async function addEvent(options: {
  propertyNode?: string | null;
  businessDate?: string;
  aggregateType?: string;
  aggregateId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  createdOffset?: string;
  published?: boolean;
} = {}) {
  const propertyNode = options.propertyNode === undefined ? PROPERTY : options.propertyNode;
  await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload,created_at,published_at)
    VALUES (${TENANT}::uuid,${propertyNode}::uuid,${options.businessDate ?? DAY}::date,
      ${options.aggregateType ?? "proof"},${options.aggregateId ?? crypto.randomUUID()}::uuid,
      ${options.eventType ?? "proof.event"},${ACTOR}::uuid,${crypto.randomUUID()}::uuid,
      ${JSON.stringify(options.payload ?? {})}::jsonb,
      transaction_timestamp()+${options.createdOffset ?? "0 seconds"}::interval,
      CASE WHEN ${options.published ?? false} THEN transaction_timestamp() ELSE NULL END)`;
}

/** Catalogue truth for every tenant-bearing public relation a readiness read must leave unchanged. */
async function tenantRelationCatalogue(): Promise<string[]> {
  const rows = await admin!<Array<{ relation_name: string }>>`
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

/** Byte-stable tenant-row evidence catches updates as well as inserts and deletes. */
async function tenantRelationSnapshot(relations: readonly string[]): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  for (const relation of relations) {
    const rows = await admin!.unsafe<Array<{ bytes: string }>>(`
      SELECT encode(convert_to(COALESCE(
        string_agg(pg_catalog.row_to_json(t)::text, E'\\n' ORDER BY pg_catalog.row_to_json(t)::text), ''
      ), 'UTF8'), 'hex') AS bytes
        FROM public.${relation} AS t
       WHERE t.tenant_id='${TENANT}'::uuid
    `);
    snapshot[relation] = rows[0]?.bytes ?? "";
  }
  return snapshot;
}

databaseDescribe("Order 349 PostgreSQL-authoritative close readiness", () => {
  beforeAll(async () => {
    admin = new SQL(DEPLOY!, { max: 4, prepare: false });
    database = Database.connect(RUNTIME!, { maxConnections: 6, prepare: false });
    service = new BusinessDayCloseReadinessService({ database });
    await admin.unsafe("CREATE SCHEMA order352_proof; CREATE EXTENSION pg_stat_statements WITH SCHEMA order352_proof");
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT}::uuid,'o349','Order349','shared','active'),
      (${FOREIGN_TENANT}::uuid,'o349-foreign','Order349 foreign','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY}::uuid,${TENANT}::uuid,'o349.p1','property','Order349','UTC','USD'),
      (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'o349.p2','property','Other','UTC','USD'),
      (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'o349f.p1','property','Foreign','UTC','USD')`;
    await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR}::uuid,${TENANT}::uuid,'o349@example.invalid','Order349','active'),
      (${INACTIVE_ACTOR}::uuid,${TENANT}::uuid,'o349-inactive@example.invalid','Inactive','inactive')`;
    await admin`INSERT INTO party(id,tenant_id,kind,display_name,status)
      VALUES(${PARTY}::uuid,${TENANT}::uuid,'person','Order349 guest','active')`;
    await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
      VALUES(${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O349-1','reserved',${PARTY}::uuid,'direct','USD')`;
    await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
      VALUES(${SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O349-ROOM','hotel',1,'active')`;
    await admin`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
      (${ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Order349 guest','USD','open'),
      (${CLEARING}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'card_clearing',NULL,'Order349 clearing','USD','open')`;
    await admin`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,status)
      VALUES(${FOLIO}::uuid,${TENANT}::uuid,${ACCOUNT}::uuid,${RESERVATION}::uuid,'O349-F1',1,'open')`;
    await admin`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status)
      VALUES(${INSTRUMENT}::uuid,${TENANT}::uuid,${PARTY}::uuid,'card_network_token',
        'tok_order349_network_opaque','Test','0349','12/99','local','active')`;
    await admin`INSERT INTO tx_code(code,name,grp) VALUES('O349_PAY','Order349 payment','payment')`;
    await admin`INSERT INTO cash_drawer(tenant_id,id,property_node,account_id,code,name,currency)
      VALUES(${TENANT}::uuid,${DRAWER}::uuid,${PROPERTY}::uuid,${CLEARING}::uuid,'O349','Order349 drawer','USD')`;
    await admin`INSERT INTO cash_drawer_denomination(tenant_id,drawer_id,unit_minor)
      VALUES(${TENANT}::uuid,${DRAWER}::uuid,100)`;
    await admin`INSERT INTO channel(code,name) VALUES('o349','Order349')`;
    await clearEvidence();
  });

  afterAll(async () => {
    await clearEvidence();
    await admin!`DELETE FROM outbox WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM business_day WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM cash_drawer_denomination WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM cash_drawer WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM folio WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM account WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM payment_instrument WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM space WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM reservation WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM party WHERE tenant_id=${TENANT}::uuid`;
    await admin!`DELETE FROM app_user WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM org_node WHERE tenant_id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
    await admin!`DELETE FROM tx_code WHERE code='O349_PAY'`;
    await admin!`DELETE FROM channel WHERE code='o349'`;
    await admin!.unsafe("DROP EXTENSION pg_stat_statements; DROP SCHEMA order352_proof");
    await database?.close(); await admin?.close();
  });

  test("binds the exact active actor, tenant, property and open backlog day", async () => {
    await clearEvidence();
    expect((await service!.read(input())).ready).toBe(true);
    await Promise.all([
      input({ actorId: INACTIVE_ACTOR }),
      input({ actorId: crypto.randomUUID() }),
      input({ propertyNode: OTHER_PROPERTY }),
      input({ propertyNode: FOREIGN_PROPERTY }),
      input({ businessDate: "2047-05-07" }),
    ].map((target) => expect(service!.read(target)).rejects.toBeInstanceOf(BusinessDayCloseReadinessUnavailableError)));

    await admin!`UPDATE business_day SET sealed_at=transaction_timestamp(),sealed_by=${ACTOR}::uuid
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${DAY}::date`;
    await expect(service!.read(input())).rejects.toBeInstanceOf(BusinessDayCloseReadinessUnavailableError);
  }, 40_000);

  test("uses exact typed property/date and a strict PostgreSQL five-minute boundary", async () => {
    await clearEvidence();
    const insert = async (property: string | null, created: string, published = false) => admin!`
      INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
        actor_id,correlation_id,payload,created_at,published_at)
      VALUES (${TENANT}::uuid,${property}::uuid,${DAY}::date,'proof',${crypto.randomUUID()}::uuid,'proof.event',
        ${ACTOR}::uuid,${crypto.randomUUID()}::uuid,'{}',transaction_timestamp()+${created}::interval,
        CASE WHEN ${published} THEN transaction_timestamp() ELSE NULL END)`;

    await insert(OTHER_PROPERTY, "-20 minutes");
    await insert(PROPERTY, "-4 minutes 59 seconds");
    await insert(PROPERTY, "-10 seconds");
    const within = await service!.read(input());
    expect(within.ready).toBe(true);
    expect(within.outboxLag.kind).toBe("within_threshold");
    if (within.outboxLag.kind === "within_threshold") expect(within.outboxLag.ageMilliseconds).toBeLessThan(300000);

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await insert(PROPERTY, "-5 minutes");
    const boundary = await service!.read(input());
    expect(boundary.ready).toBe(false);
    expect(boundary.outboxLag.kind).toBe("over_threshold");

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await insert(PROPERTY, "-30 minutes", true);
    expect((await service!.read(input())).outboxLag).toEqual({ kind: "none", ageMilliseconds: 0 });
  });

  test("P2 classifies typed due-in/out lineage and rejects forged or missing authority", async () => {
    await clearEvidence();
    await admin!`UPDATE reservation SET status='due_in' WHERE tenant_id=${TENANT}::uuid AND id=${RESERVATION}::uuid`;
    await addEvent({ aggregateType: "reservation", aggregateId: RESERVATION,
      eventType: "reservation.due_in", payload: { business_date: "1900-01-01", property_node: OTHER_PROPERTY },
      published: true });
    let result = await service!.read(input());
    expect(result.counts.unresolvedDueIn).toBe(1);
    expect(result.counts.unknownAttribution).toBe(0);

    await clearEvidence();
    await admin!`UPDATE reservation SET status='due_out' WHERE tenant_id=${TENANT}::uuid AND id=${RESERVATION}::uuid`;
    await addEvent({ aggregateType: "reservation", aggregateId: RESERVATION,
      eventType: "reservation.due_out", published: true });
    result = await service!.read(input());
    expect(result.counts.unresolvedDueOut).toBe(1);

    await clearEvidence();
    await admin!`UPDATE reservation SET status='due_in' WHERE tenant_id=${TENANT}::uuid AND id=${RESERVATION}::uuid`;
    result = await service!.read(input());
    expect(result.counts.unresolvedDueIn).toBe(0);
    expect(result.reasons).toContainEqual({ code: "source_attribution_unknown", source: "reservations", count: 1 });

    await addEvent({ aggregateType: "reservation", aggregateId: RESERVATION,
      eventType: "reservation.due_out", published: true });
    result = await service!.read(input());
    expect(result.counts.unknownAttribution).toBe(1);
  });

  test("P2 counts only exact typed open cashier and discrepancy blockers", async () => {
    await clearEvidence();
    const sessionId = crypto.randomUUID();
    const countId = crypto.randomUUID();
    await admin!.begin(async (tx) => {
      await tx`SET CONSTRAINTS ALL DEFERRED`;
      await tx`INSERT INTO cashier_session(id,tenant_id,property_node,user_id,drawer_id,business_date,currency,
        opening_count_id,expected_minor) VALUES(${sessionId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
        ${ACTOR}::uuid,${DRAWER}::uuid,${DAY}::date,'USD',${countId}::uuid,0)`;
      await tx`INSERT INTO cashier_count(tenant_id,id,session_id,drawer_id,kind,attempt_no,counted_by,total_minor)
        VALUES(${TENANT}::uuid,${countId}::uuid,${sessionId}::uuid,${DRAWER}::uuid,'opening',0,${ACTOR}::uuid,0)`;
    });
    expect((await service!.read(input())).counts.openCashiers).toBe(1);

    await clearEvidence();
    const discrepancyId = crypto.randomUUID();
    await admin!`INSERT INTO discrepancy(id,tenant_id,space_id,reported,system_state,reported_by)
      VALUES(${discrepancyId}::uuid,${TENANT}::uuid,${SPACE}::uuid,'occupied','vacant',${ACTOR}::uuid)`;
    await addEvent({ aggregateType: "discrepancy", aggregateId: discrepancyId,
      eventType: "discrepancy.reported", payload: { business_date: "1900-01-01" }, published: true });
    let result = await service!.read(input());
    expect(result.counts.unresolvedDiscrepancies).toBe(1);
    expect(result.counts.unknownAttribution).toBe(0);

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await addEvent({ aggregateType: "discrepancy", aggregateId: discrepancyId,
      eventType: "discrepancy.reported", businessDate: "2047-05-07",
      payload: { business_date: DAY }, published: true });
    result = await service!.read(input());
    expect(result.counts.unresolvedDiscrepancies).toBe(0);
    expect(result.counts.unknownAttribution).toBe(1);
    expect(result.ready).toBe(false);
    expect(result.reasons).toContainEqual({ code: "source_attribution_unknown", source: "discrepancies", count: 1 });

    let nullDateError: unknown;
    try {
      await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
        actor_id,correlation_id,payload)
        VALUES(${TENANT}::uuid,${PROPERTY}::uuid,NULL,'discrepancy',${discrepancyId}::uuid,
          'discrepancy.reported',${ACTOR}::uuid,${crypto.randomUUID()}::uuid,'{}')`;
    } catch (error) {
      nullDateError = error;
    }
    expect(nullDateError).toMatchObject({ errno: "23502" });

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    result = await service!.read(input());
    expect(result.counts.unresolvedDiscrepancies).toBe(0);
    expect(result.reasons).toContainEqual({ code: "source_attribution_unknown", source: "discrepancies", count: 1 });
  });

  test("P4 separates exact fiscal blockers from typed-incomplete payment, statutory and channel work", async () => {
    await clearEvidence();
    const documentId = crypto.randomUUID();
    await admin!`INSERT INTO document(id,tenant_id,property_node,kind,status,content,business_date)
      VALUES(${documentId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'invoice','issued',
        ${JSON.stringify({ forged_business_date: "1900-01-01", forged_property: OTHER_PROPERTY })}::jsonb,${DAY}::date)`;
    await admin!`INSERT INTO fiscal_submission(tenant_id,document_id,provider_key,mode,status)
      VALUES(${TENANT}::uuid,${documentId}::uuid,'o349','clearance','pending')`;
    let result = await service!.read(input());
    expect(result.counts.fiscalInterface).toBe(1);
    expect(result.counts.unknownAttribution).toBe(0);

    await clearEvidence();
    const operationId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const hash = "a".repeat(64);
    await admin!`INSERT INTO payment_operation(tenant_id,id,property_node,folio_id,guest_account_id,instrument_id,
      provider,method,currency,tx_code,clearing_account_id,purpose,key_hash,request_hash,actor_id)
      VALUES(${TENANT}::uuid,${operationId}::uuid,${PROPERTY}::uuid,${FOLIO}::uuid,${ACCOUNT}::uuid,
        ${INSTRUMENT}::uuid,'local','card','USD','O349_PAY',${CLEARING}::uuid,'folio_payment',${hash},${"b".repeat(64)},${ACTOR}::uuid)`;
    await admin!`INSERT INTO payment(id,tenant_id,operation_id,instrument_id,psp,method,phase,amount_minor,currency,
      status,attempt_no,result_code,command_key_hash,request_hash)
      VALUES(${paymentId}::uuid,${TENANT}::uuid,${operationId}::uuid,${INSTRUMENT}::uuid,'local','card','auth',1,'USD',
        'pending',1,'pending',${"c".repeat(64)},${"d".repeat(64)})`;
    result = await service!.read(input());
    expect(result.counts.financialInterface).toBe(0);
    expect(result.reasons).toContainEqual({ code: "source_attribution_unknown", source: "financial", count: 1 });

    await clearEvidence();
    await admin!`INSERT INTO statutory_submission(tenant_id,property_node,reservation_id,adapter_key,due_at,status,payload)
      VALUES(${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,'o349',transaction_timestamp(),'pending',
        ${JSON.stringify({ business_date: DAY })}::jsonb)`;
    result = await service!.read(input());
    expect(result.counts.statutoryInterface).toBe(0);
    expect(result.reasons).toContainEqual({ code: "source_attribution_unknown", source: "statutory", count: 1 });

    await clearEvidence();
    await admin!`INSERT INTO inbound_message(tenant_id,channel_code,external_id,payload,status)
      VALUES(${TENANT}::uuid,'o349','order349-inbound',${JSON.stringify({ property_node: PROPERTY, business_date: DAY })}::jsonb,'error')`;
    result = await service!.read(input());
    expect(result.counts.channelDelivery).toBe(0);
    expect(result.reasons).toContainEqual({ code: "source_attribution_unknown", source: "channel", count: 1 });
  });

  test("P5 is one snapshot statement, read-only, immutable and coherent across a publication race", async () => {
    await clearEvidence();
    await addEvent({ createdOffset: "-10 minutes" });
    const relations = await tenantRelationCatalogue();
    expect(relations).toContain("folio_balance");
    const before = await tenantRelationSnapshot(relations);
    await admin!.unsafe("SELECT order352_proof.pg_stat_statements_reset()");
    const first = await service!.read(input());
    expect(Object.isFrozen(first)).toBe(true);
    expect(await tenantRelationSnapshot(relations)).toEqual(before);
    const statements = await admin!<Array<{ calls: bigint | number }>>`
      SELECT calls FROM order352_proof.pg_stat_statements
       WHERE query LIKE '%WITH target AS MATERIALIZED%'
         AND query LIKE '%unknown_channel%'
    `;
    expect(statements).toHaveLength(1);
    expect(Number(statements[0]!.calls)).toBe(1);

    const [raced] = await Promise.all([
      service!.read(input()),
      admin!`UPDATE outbox SET published_at=transaction_timestamp()
        WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND business_date=${DAY}::date`,
    ]);
    expect(["over_threshold", "none"]).toContain(raced.outboxLag.kind);
    expect(Object.isFrozen(raced.outboxLag)).toBe(true);
    const subsequent = await service!.read(input());
    expect(subsequent.outboxLag).toEqual({ kind: "none", ageMilliseconds: 0 });
    expect(raced.capturedAt <= subsequent.capturedAt).toBe(true);
  });

  test("future and unrelatable unpublished evidence is explicit unknown and read-only", async () => {
    await clearEvidence();
    const before = await admin!<{ days: number; events: number }[]>`SELECT
      (SELECT count(*)::int FROM business_day WHERE tenant_id=${TENANT}::uuid) AS days,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) AS events`;
    const hostilePayload = JSON.stringify({ forged_property: PROPERTY });
    await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload,created_at)
      VALUES (${TENANT}::uuid,NULL,${DAY}::date,'proof',${crypto.randomUUID()}::uuid,'proof.event',
        ${ACTOR}::uuid,${crypto.randomUUID()}::uuid,${hostilePayload}::jsonb,transaction_timestamp())`;
    const unknown = await service!.read(input());
    expect(unknown.ready).toBe(false);
    expect(unknown.outboxLag).toEqual({ kind: "unknown", count: 1 });
    expect(unknown.reasons.at(-1)).toEqual({ code: "source_attribution_unknown", source: "outbox", count: 1 });
    const after = await admin!<{ days: number; events: number }[]>`SELECT
      (SELECT count(*)::int FROM business_day WHERE tenant_id=${TENANT}::uuid) AS days,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) AS events`;
    expect(after[0]!.days).toBe(before[0]!.days);
    expect(after[0]!.events).toBe(before[0]!.events + 1);

    await admin!`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
    await admin!`INSERT INTO outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      actor_id,correlation_id,payload,created_at)
      VALUES (${TENANT}::uuid,${PROPERTY}::uuid,${DAY}::date,'proof',${crypto.randomUUID()}::uuid,'proof.event',
        ${ACTOR}::uuid,${crypto.randomUUID()}::uuid,'{}',transaction_timestamp()+interval '1 minute')`;
    expect((await service!.read(input())).outboxLag).toEqual({ kind: "unknown", count: 1 });
  });
});
