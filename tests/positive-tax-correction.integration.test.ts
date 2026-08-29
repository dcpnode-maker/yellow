import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  PositiveTaxCorrectionAuthorizationError,
  PositiveTaxCorrectionConflictError,
  PositiveTaxCorrectionNotFoundError,
  PositiveTaxCorrectionService,
  PositiveTaxCorrectionValidationError,
  PositiveTaxPostingService,
  type PositiveTaxCorrectionInput,
} from "../src/contexts/financials";
import {
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
} from "../src/contexts/tax-fiscal";
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

setDefaultTimeout(120_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_POSITIVE_TAX_CORRECTION_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_POSITIVE_TAX_CORRECTION === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 266 positive-tax correction proof requires deploy and runtime database URLs");
}
const dbDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(26601);
const TENANT_B = id(26602);
const PROPERTY_A = id(26611);
const PROPERTY_B = id(26612);
const ACTOR_A = id(26621);
const APPROVER_A = id(26622);
const ACTOR_B = id(26623);
const PARTY_A = id(26631);
const PARTY_B = id(26632);
const UNIT_TYPE_A = id(26641);
const UNIT_TYPE_B = id(26642);
const SELLABLE_A = id(26651);
const SELLABLE_B = id(26652);
const RATE_PLAN_A = id(26661);
const RATE_PLAN_B = id(26662);
const EXTENSION_A = id(26671);
const EXTENSION_B = id(26672);
const EXTENSION_TYPE = "order266_jurisdiction";
const DAY_MS = 86_400_000;

interface TaxOption {
  readonly code: string;
  readonly name: string;
  readonly taxMinor: bigint;
}

interface SeedOptions {
  readonly tenantId?: string;
  readonly propertyNode?: string;
  readonly actorId?: string;
  readonly partyId?: string;
  readonly unitTypeId?: string;
  readonly sellableId?: string;
  readonly ratePlanId?: string;
  readonly extensionId?: string;
  readonly currency?: string;
  readonly taxes?: readonly TaxOption[];
}

interface RouteFixture {
  readonly mappingId: string;
  readonly txCode: string;
  readonly accountId: string;
}

interface PositiveFixture {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly holdBindingId: string;
  readonly attributionId: string;
  readonly lineageId: string;
  readonly folioId: string;
  readonly guestAccountId: string;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly snapshot: ReturnType<typeof createPositiveTaxAttributionSnapshot>;
  readonly revenueRoute: RouteFixture;
  readonly taxRoutes: readonly RouteFixture[];
  readonly postingBindingId: string;
  readonly journalId: string;
}

interface ArtifactCounts {
  readonly reversals: number;
  readonly lines: number;
  readonly facts: number;
  readonly journalEvents: number;
  readonly reversedEvents: number;
  readonly keys: number;
}

let deploy: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let postings: PositiveTaxPostingService | undefined;
let corrections: PositiveTaxCorrectionService | undefined;
let sequence = 0;
let currentDay = "";

function envelope(
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
  actorId = ACTOR_A,
) {
  return createAuditEnvelope({
    operation: "journal.posted",
    tenantId,
    propertyNode,
    actorId,
    requestId: crypto.randomUUID(),
  });
}

function correctionInput(
  fixture: PositiveFixture,
  key: string,
  postSealAuthorized = false,
  actorId = fixture.actorId,
  reason = "Reverse the complete quoted taxed stay",
): PositiveTaxCorrectionInput {
  return {
    tenantId: fixture.tenantId,
    propertyNode: fixture.propertyNode,
    reversesJournalId: fixture.journalId,
    reason,
    postSealAuthorized,
    idempotencyKey: key,
    envelope: envelope(fixture.tenantId, fixture.propertyNode, actorId),
  };
}

function reverse(
  fixture: PositiveFixture,
  input: PositiveTaxCorrectionInput,
  using = corrections!,
  transactionTenant = fixture.tenantId,
) {
  return database!.withTenantTransaction(
    transactionTenant,
    (tx) => using.reverse(tx, input),
  );
}

class FailOnPublish implements EventBus {
  #published = 0;

  constructor(readonly delegate: EventBus, readonly failAfter: number) {}

  async publish(tx: Tx, input: PublishEventInput): Promise<OutboxEvent> {
    const event = await this.delegate.publish(tx, input);
    this.#published += 1;
    if (this.#published === this.failAfter) {
      throw new Error("Order 266 injected publication failure");
    }
    return event;
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function makeCorrections(bus: EventBus): PositiveTaxCorrectionService {
  return new PositiveTaxCorrectionService({
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
}

function snapshotInput(
  n: number,
  quoteHash: string,
  currency: string,
  extensionId: string,
  ownerTenantId: string,
  taxes: readonly TaxOption[],
): CreatePositiveTaxAttributionSnapshotInput {
  const taxTotal = taxes.reduce((sum, tax) => sum + tax.taxMinor, 0n);
  const businessDate = new Date(Date.UTC(2038, 0, (n % 27) + 1)).toISOString().slice(0, 10);
  const jurisdictionKey = `ca.order266.tax.${n}`;
  return {
    origin: { kind: "rate_quote", quoteHash },
    currency,
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: 10_000n,
      nights: 1,
      personNights: 2,
      roomNights: [{ businessDate, amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate,
      jurisdictionKey,
      evidenceRef: `tax-assignment:${quoteHash}`,
    }],
    jurisdiction: {
      extensionId,
      ownerTenantId,
      key: jurisdictionKey,
      version: 1,
      contentHash: quoteHash,
      evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey,
      country: "CA",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: taxTotal,
      grandTotalMinor: 10_000n + taxTotal,
      taxes: taxes.map((tax) => ({
        code: tax.code,
        name: tax.name,
        taxMinor: tax.taxMinor,
        components: tax.taxMinor === 0n ? [] : [{
          lineId: "room",
          revenueGroup: "room_revenue",
          baseMinor: 10_000n,
          taxMinor: tax.taxMinor,
          rateBasisPoints: Number(tax.taxMinor),
        }],
      })),
    },
  };
}

async function seedRoute(
  fixture: Omit<PositiveFixture,
    "revenueRoute" | "taxRoutes" | "postingBindingId" | "journalId">,
  kind: "revenue" | "tax",
  semanticCode: string,
): Promise<RouteFixture> {
  const n = ++sequence;
  const mappingId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const txCode = `O266_${kind === "revenue" ? "R" : "T"}_${n}`;
  const role = kind === "revenue" ? "revenue" : "tax_payable";
  await deploy!`INSERT INTO account(
      id,tenant_id,property_node,role,name,currency,status
    ) VALUES(
      ${accountId}::uuid,${fixture.tenantId}::uuid,${fixture.propertyNode}::uuid,
      ${role},${`Order 266 ${semanticCode}`},${fixture.currency}::char(3),'open'
    )`;
  await deploy!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
    VALUES(
      ${txCode},${`Order 266 ${semanticCode}`},${kind},
      ${kind === "revenue" ? "Rooms" : null},'guest',${role}
    )`;
  await deploy!`INSERT INTO tx_code_route(
      tenant_id,property_node,currency,tx_code,credit_account_id
    ) VALUES(
      ${fixture.tenantId}::uuid,${fixture.propertyNode}::uuid,
      ${fixture.currency}::char(3),${txCode},${accountId}::uuid
    )`;
  await deploy!`INSERT INTO tax_semantic_route(
      tenant_id,id,property_node,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,semantic_kind,semantic_code,tx_code
    ) VALUES(
      ${fixture.tenantId}::uuid,${mappingId}::uuid,${fixture.propertyNode}::uuid,
      ${fixture.currency}::char(3),${fixture.snapshot.jurisdiction.extensionId}::uuid,
      ${fixture.snapshot.jurisdiction.ownerTenantId}::uuid,
      ${fixture.snapshot.jurisdiction.key},${fixture.snapshot.jurisdiction.version},
      ${fixture.snapshot.jurisdiction.contentHash},${kind},${semanticCode},${txCode}
    )`;
  return { mappingId, txCode, accountId };
}

async function seedPositive(options: SeedOptions = {}): Promise<PositiveFixture> {
  const tenantId = options.tenantId ?? TENANT_A;
  const propertyNode = options.propertyNode ?? PROPERTY_A;
  const actorId = options.actorId ?? ACTOR_A;
  const partyId = options.partyId ?? PARTY_A;
  const unitTypeId = options.unitTypeId ?? UNIT_TYPE_A;
  const sellableId = options.sellableId ?? SELLABLE_A;
  const ratePlanId = options.ratePlanId ?? RATE_PLAN_A;
  const extensionId = options.extensionId ?? EXTENSION_A;
  const currency = options.currency ?? "CAD";
  const taxes = options.taxes ?? [
    { code: "PST", name: "Provincial sales tax", taxMinor: 500n },
  ];
  const n = ++sequence;
  const reservationId = crypto.randomUUID();
  const segmentId = crypto.randomUUID();
  const holdId = crypto.randomUUID();
  const holdBindingId = crypto.randomUUID();
  const attributionId = crypto.randomUUID();
  const lineageId = crypto.randomUUID();
  const folioId = crypto.randomUUID();
  const guestAccountId = crypto.randomUUID();
  const quoteHash = n.toString(16).padStart(64, "a").slice(-64);
  const snapshot = createPositiveTaxAttributionSnapshot(snapshotInput(
    n, quoteHash, currency, extensionId, tenantId, taxes,
  ));
  const periodFrom = new Date(Date.UTC(2038, 0, (n % 27) + 1, 15));
  const periodTo = new Date(periodFrom.getTime() + DAY_MS);
  const period = `[${periodFrom.toISOString()},${periodTo.toISOString()})`;

  await deploy!`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(
      ${reservationId}::uuid,${tenantId}::uuid,${propertyNode}::uuid,
      ${`O266-${n}`},'checked_out',${partyId}::uuid,'direct',${currency}::char(3)
    )`;
  await deploy!`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
      adults,children,rate_plan_id,status
    ) VALUES(
      ${segmentId}::uuid,${tenantId}::uuid,${reservationId}::uuid,1,
      ${unitTypeId}::uuid,${sellableId}::uuid,${period}::tstzrange,
      2,'[]'::jsonb,${ratePlanId}::uuid,'booked'
    )`;
  await deploy!`INSERT INTO hold(
      id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status
    ) VALUES(
      ${holdId}::uuid,${tenantId}::uuid,${propertyNode}::uuid,${sellableId}::uuid,
      ${period}::tstzrange,'cart','{}'::jsonb,${periodTo.toISOString()}::timestamptz,'consumed'
    )`;
  await deploy!`INSERT INTO tax_attribution_snapshot(
      tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,
      snapshot_hash,currency,snapshot
    ) VALUES(
      ${tenantId}::uuid,${attributionId}::uuid,${propertyNode}::uuid,${actorId}::uuid,
      1,'rate_quote',${quoteHash},${snapshot.snapshotHash},${currency}::char(3),
      ${JSON.stringify(snapshot)}::jsonb
    )`;
  await deploy!`INSERT INTO tax_attribution_hold_binding(
      tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,
      origin_quote_hash,snapshot_hash,currency
    ) VALUES(
      ${tenantId}::uuid,${holdBindingId}::uuid,${propertyNode}::uuid,${actorId}::uuid,
      ${holdId}::uuid,${attributionId}::uuid,${sellableId}::uuid,${period}::tstzrange,
      ${quoteHash},${snapshot.snapshotHash},${currency}::char(3)
    )`;
  await deploy!`INSERT INTO tax_attribution_reservation_binding(
      tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,
      segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency
    ) VALUES(
      ${tenantId}::uuid,${lineageId}::uuid,${propertyNode}::uuid,${actorId}::uuid,
      ${holdBindingId}::uuid,${holdId}::uuid,${attributionId}::uuid,${reservationId}::uuid,
      ${segmentId}::uuid,${sellableId}::uuid,${period}::tstzrange,
      ${quoteHash},${snapshot.snapshotHash},${currency}::char(3)
    )`;
  await deploy!`INSERT INTO account(
      id,tenant_id,property_node,role,party_id,name,currency,status
    ) VALUES(
      ${guestAccountId}::uuid,${tenantId}::uuid,${propertyNode}::uuid,'guest',
      ${partyId}::uuid,${`Order 266 Guest ${n}`},${currency}::char(3),'open'
    )`;
  await deploy!`INSERT INTO folio(
      id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
    ) VALUES(
      ${folioId}::uuid,${tenantId}::uuid,${guestAccountId}::uuid,${reservationId}::uuid,
      ${`O266-F-${n}`},1,'Primary','open'
    )`;

  const base = {
    tenantId, propertyNode, actorId, reservationId, segmentId, holdBindingId,
    attributionId, lineageId, folioId, guestAccountId, quoteHash,
    snapshotHash: snapshot.snapshotHash, currency, snapshot,
  };
  const revenueRoute = await seedRoute(base as never, "revenue", "room_revenue");
  const taxRoutes: RouteFixture[] = [];
  for (const tax of snapshot.evaluation.taxes) {
    if (BigInt(tax.taxMinor) !== 0n) {
      taxRoutes.push(await seedRoute(base as never, "tax", tax.code));
    }
  }
  const posting = await database!.withTenantTransaction(tenantId, (tx) => postings!.post(tx, {
    tenantId,
    propertyNode,
    reservationId,
    idempotencyKey: `order266-positive-${crypto.randomUUID()}`,
    envelope: envelope(tenantId, propertyNode, actorId),
  }));
  if (posting.state !== "posted") throw new Error("Order 266 fixture requires a posted tax journal");
  return Object.freeze({
    ...base,
    revenueRoute,
    taxRoutes: Object.freeze(taxRoutes),
    postingBindingId: posting.postingBindingId,
    journalId: posting.journalId,
  });
}

async function artifactCounts(tenantId = TENANT_A): Promise<ArtifactCounts> {
  return (await deploy!<ArtifactCounts[]>`SELECT
    (SELECT count(*)::int FROM journal WHERE tenant_id=${tenantId}::uuid
      AND reverses IS NOT NULL) reversals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id=${tenantId}::uuid
      AND journal_id IN (SELECT id FROM journal WHERE tenant_id=${tenantId}::uuid
        AND reverses IS NOT NULL)) lines,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenantId}::uuid
      AND entity_id IN (SELECT id FROM journal WHERE tenant_id=${tenantId}::uuid
        AND reverses IS NOT NULL)) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id=${tenantId}::uuid
      AND aggregate_id IN (SELECT id FROM journal WHERE tenant_id=${tenantId}::uuid
        AND reverses IS NOT NULL) AND event_type='journal.posted') journal_events,
    (SELECT count(*)::int FROM outbox WHERE tenant_id=${tenantId}::uuid
      AND event_type='tax.attribution_reversed') reversed_events,
    (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${tenantId}::uuid) keys`)[0]!;
}

async function immutableHash(fixture: PositiveFixture): Promise<string> {
  return (await deploy!<Array<{ digest: string }>>`
    WITH immutable AS (
      SELECT jsonb_build_object(
        'journal',(SELECT to_jsonb(journal_row) FROM journal journal_row
          WHERE journal_row.tenant_id=${fixture.tenantId}::uuid
            AND journal_row.id=${fixture.journalId}::uuid),
        'lines',(SELECT jsonb_agg(to_jsonb(line_row) ORDER BY line_row.seq)
          FROM posting_line line_row WHERE line_row.tenant_id=${fixture.tenantId}::uuid
            AND line_row.journal_id=${fixture.journalId}::uuid),
        'snapshot',(SELECT to_jsonb(snapshot_row) FROM tax_attribution_snapshot snapshot_row
          WHERE snapshot_row.tenant_id=${fixture.tenantId}::uuid
            AND snapshot_row.id=${fixture.attributionId}::uuid),
        'binding',(SELECT to_jsonb(binding_row) FROM tax_attribution_journal_binding binding_row
          WHERE binding_row.tenant_id=${fixture.tenantId}::uuid
            AND binding_row.id=${fixture.postingBindingId}::uuid),
        'routes',(SELECT jsonb_agg(to_jsonb(route_row) ORDER BY route_row.id)
          FROM tax_semantic_route route_row WHERE route_row.tenant_id=${fixture.tenantId}::uuid)
      ) value
    )
    SELECT encode(digest(value::text::bytea,'sha256'),'hex') digest FROM immutable`)[0]!.digest;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

function sqlState(error: unknown): string | undefined {
  const typed = error as { errno?: string; code?: string };
  return typed.errno ?? typed.code;
}

async function expectSqlState(action: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await action();
    throw new Error(`expected SQLSTATE ${expected}`);
  } catch (error) {
    expect(sqlState(error)).toBe(expected);
  }
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "api_idempotency", "outbox", "fact_log", "tax_attribution_journal_binding",
    "posting_line", "journal", "tax_semantic_route", "tx_code_route", "folio",
    "account", "tax_attribution_reservation_binding",
    "reservation_segment", "reservation", "tax_attribution_hold_binding", "hold",
    "tax_attribution_snapshot", "business_day",
    "sellable_unit", "unit_type", "rate_plan", "party_role", "party", "app_user",
  ]) {
    await deploy.unsafe(
      `DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`,
      [TENANT_A, TENANT_B],
    );
  }
  await deploy`DELETE FROM extension WHERE id IN (${EXTENSION_A}::uuid,${EXTENSION_B}::uuid)`;
  await deploy`DELETE FROM extension_type WHERE type=${EXTENSION_TYPE}`;
  await deploy`DELETE FROM tx_code WHERE code LIKE 'O266\_%' ESCAPE '\\'`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 266 P0: financials exports the governed positive-tax correction service", () => {
  expect(typeof PositiveTaxCorrectionService).toBe("function");
});

dbDescribe("Order 266 governed positive-tax correction", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 48, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 48, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 64, prepare: false });
    events = new PostgresEventBus(eventPool);
    postings = new PositiveTaxPostingService({
      events,
      idempotency: new PostgresIdempotency(),
    });
    corrections = makeCorrections(events);
    await cleanup();
    currentDay = (await deploy<Array<{ business_day: string }>>`
      SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS business_day`
    )[0]!.business_day;
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order266-a','Order 266 A','shared','active'),
      (${TENANT_B}::uuid,'order266-b','Order 266 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order266a.property'::ltree,
       'property','Order 266 A','UTC','CAD'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order266b.property'::ltree,
       'property','Order 266 B','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor@order266-a.local','Actor A','active'),
      (${APPROVER_A}::uuid,${TENANT_A}::uuid,'approver@order266-a.local','Approver A','active'),
      (${ACTOR_B}::uuid,${TENANT_B}::uuid,'actor@order266-b.local','Actor B','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Order 266 Guest A','active'),
      (${PARTY_B}::uuid,${TENANT_B}::uuid,'person','Order 266 Guest B','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
      (${TENANT_A}::uuid,${PARTY_A}::uuid,'guest'),
      (${TENANT_B}::uuid,${PARTY_B}::uuid,'guest')`;
    await deploy`INSERT INTO unit_type(
      id,tenant_id,property_node,code,name,profile_key,max_occupancy
    ) VALUES
      (${UNIT_TYPE_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,
       'O266A','Order 266 Room A','hotel',4),
      (${UNIT_TYPE_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,
       'O266B','Order 266 Room B','hotel',4)`;
    await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
      (${SELLABLE_A}::uuid,${TENANT_A}::uuid,${UNIT_TYPE_A}::uuid,'Order 266 A','active'),
      (${SELLABLE_B}::uuid,${TENANT_B}::uuid,${UNIT_TYPE_B}::uuid,'Order 266 B','active')`;
    await deploy`INSERT INTO rate_plan(
      id,tenant_id,property_node,code,name,currency,tax_inclusive,status
    ) VALUES
      (${RATE_PLAN_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,
       'O266-A','Order 266 Rate A','CAD',false,'active'),
      (${RATE_PLAN_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,
       'O266-B','Order 266 Rate B','USD',false,'active')`;
    await deploy`INSERT INTO extension_type(type,json_schema)
      VALUES(${EXTENSION_TYPE},'{"type":"object"}'::jsonb)`;
    await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
      (${EXTENSION_A}::uuid,${TENANT_A}::uuid,${EXTENSION_TYPE},'ca.order266.tax',1,
       '[2030-01-01 00:00:00+00,)'::tstzrange,'{}'::jsonb,'active'),
      (${EXTENSION_B}::uuid,${TENANT_B}::uuid,${EXTENSION_TYPE},'us.order266.tax',1,
       '[2030-01-01 00:00:00+00,)'::tstzrange,'{}'::jsonb,'active')`;
    await deploy`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
      (${TENANT_A}::uuid,${PROPERTY_A}::uuid,${currentDay}::date),
      (${TENANT_B}::uuid,${PROPERTY_B}::uuid,${currentDay}::date)`;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  }, 60_000);

  test("P1: full correction exactly sign-negates every line and preserves original truth", async () => {
    const fixture = await seedPositive({
      taxes: [
        { code: "PST", name: "Provincial tax", taxMinor: 700n },
        { code: "ZERO", name: "Zero tax", taxMinor: 0n },
        { code: "QST", name: "Quebec tax", taxMinor: 900n },
      ],
    });
    const originalHash = await immutableHash(fixture);
    const originalLines = await deploy!<Array<Record<string, unknown>>>`
      SELECT seq,account_id::text,folio_id::text,tx_code,description,
             amount_minor::text,quantity::text,business_date::text,currency::text,tax_detail
        FROM posting_line WHERE tenant_id=${fixture.tenantId}::uuid
          AND journal_id=${fixture.journalId}::uuid ORDER BY seq`;
    const originalTaxDetail = originalLines[0]!.tax_detail;
    const before = await artifactCounts();
    const result = await reverse(
      fixture,
      correctionInput(fixture, "order266-canonical-reversal"),
    );
    expect(result).toEqual({
      state: "reversed",
      journalId: expect.any(String),
      reversesJournalId: fixture.journalId,
      postingBindingId: fixture.postingBindingId,
      lineageId: fixture.lineageId,
      holdBindingId: fixture.holdBindingId,
      attributionId: fixture.attributionId,
      reservationId: fixture.reservationId,
      segmentId: fixture.segmentId,
      folioId: fixture.folioId,
      businessDate: currentDay,
      currency: "CAD",
      grandTotalMinor: "-11600",
      lineCount: 4,
      created: true,
      replayed: false,
    });
    expectDeepFrozen(result);
    expect(await immutableHash(fixture)).toBe(originalHash);

    const header = (await deploy!<Array<Record<string, unknown>>>`
      SELECT kind,reverses::text,business_date::text,currency::text,source,created_by::text
        FROM journal WHERE tenant_id=${TENANT_A}::uuid AND id=${result.journalId}::uuid`)[0]!;
    expect(header).toMatchObject({
      kind: "adjustment",
      reverses: fixture.journalId,
      business_date: currentDay,
      currency: "CAD",
      created_by: ACTOR_A,
      source: {
        interface: "financials.positive-tax.reverse",
        original_journal_id: fixture.journalId,
        lineage_id: fixture.lineageId,
      },
    });

    const reversalLines = await deploy!<Array<Record<string, unknown>>>`
      SELECT seq,account_id::text,folio_id::text,tx_code,description,
             amount_minor::text,quantity::text,business_date::text,currency::text,tax_detail
        FROM posting_line WHERE tenant_id=${fixture.tenantId}::uuid
          AND journal_id=${result.journalId}::uuid ORDER BY seq`;
    expect(reversalLines).toHaveLength(originalLines.length);
    for (const [index, original] of originalLines.entries()) {
      const reversed = reversalLines[index]!;
      expect({
        seq: reversed.seq,
        account_id: reversed.account_id,
        folio_id: reversed.folio_id,
        tx_code: reversed.tx_code,
        description: reversed.description,
        quantity: reversed.quantity,
        business_date: reversed.business_date,
        currency: reversed.currency,
      }).toEqual({
        seq: original.seq,
        account_id: original.account_id,
        folio_id: original.folio_id,
        tx_code: original.tx_code,
        description: original.description,
        quantity: original.quantity,
        business_date: currentDay,
        currency: original.currency,
      });
      expect(reversed.amount_minor).toBe((-BigInt(String(original.amount_minor))).toString());
      if (index > 0) expect(reversed.tax_detail).toBeNull();
    }
    expect(reversalLines[0]!.tax_detail).toEqual({
      schemaVersion: 2,
      effect: "full_reversal",
      lineage: {
        originalJournalId: fixture.journalId,
        reversalJournalId: result.journalId,
        originalPostingBindingId: fixture.postingBindingId,
        lineageId: fixture.lineageId,
        holdBindingId: fixture.holdBindingId,
        attributionId: fixture.attributionId,
        reservationId: fixture.reservationId,
        segmentId: fixture.segmentId,
        folioId: fixture.folioId,
      },
      quote: {
        originQuoteHash: fixture.quoteHash,
        snapshotHash: fixture.snapshotHash,
        currency: fixture.currency,
      },
      originalTaxDetail,
    });
    expect((await deploy!<Array<{ total: string }>>`
      SELECT sum(amount_minor)::text total FROM posting_line
       WHERE tenant_id=${TENANT_A}::uuid AND journal_id=${result.journalId}::uuid`)[0]!.total)
      .toBe("0");
    expect((await deploy!<Array<{ balance: string }>>`
      SELECT balance_minor::text balance FROM folio_balance
       WHERE tenant_id=${TENANT_A}::uuid AND folio_id=${fixture.folioId}::uuid`)[0]!.balance)
      .toBe("0");

    const evidence = await deploy!<Array<{ kind: string; count: number }>>`
      SELECT 'fact:' || fact_type kind,count(*)::int count FROM fact_log
       WHERE tenant_id=${TENANT_A}::uuid AND entity_id=${result.journalId}::uuid
       GROUP BY fact_type
      UNION ALL
      SELECT 'event:' || event_type,count(*)::int FROM outbox
       WHERE tenant_id=${TENANT_A}::uuid AND aggregate_id=${result.journalId}::uuid
       GROUP BY event_type ORDER BY kind`;
    expect(evidence).toEqual([
      { kind: "event:journal.posted", count: 1 },
      { kind: "event:tax.attribution_reversed", count: 1 },
      { kind: "fact:journal.posted", count: 1 },
    ]);
    expect(await artifactCounts()).toEqual({
      reversals: before.reversals + 1,
      lines: before.lines + 4,
      facts: before.facts + 1,
      journalEvents: before.journalEvents + 1,
      reversedEvents: before.reversedEvents + 1,
      keys: before.keys + 1,
    });
  });

  test("P2: replay is exact, changed reuse conflicts and 20 contenders create one reversal", async () => {
    const exactFixture = await seedPositive();
    const exact = correctionInput(exactFixture, "order266-exact-replay");
    const first = await reverse(exactFixture, exact);
    expect(await reverse(exactFixture, exact)).toEqual({ ...first, replayed: true });
    await expect(reverse(exactFixture, {
      ...exact,
      reason: "Changed full reversal reason",
    })).rejects.toBeInstanceOf(IdempotencyConflictError);

    const contested = await seedPositive();
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      reverse(contested, correctionInput(contested, `order266-contender-${index}`))));
    const fulfilled = outcomes.filter((outcome): outcome is PromiseFulfilledResult<
      Awaited<ReturnType<typeof reverse>>
    > => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult =>
      outcome.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    expect(rejected.every(({ reason }) =>
      reason instanceof PositiveTaxCorrectionConflictError)).toBeTrue();
    expect((await deploy!<Array<{ count: number }>>`
      SELECT count(*)::int count FROM journal WHERE tenant_id=${TENANT_A}::uuid
        AND reverses=${contested.journalId}::uuid`)[0]!.count).toBe(1);
  }, 90_000);

  test("P3: publication failure after both events rolls every effect back before retry", async () => {
    const fixture = await seedPositive();
    const input = correctionInput(fixture, "order266-publication-rollback");
    const before = await artifactCounts();
    const beforeHash = await immutableHash(fixture);
    const failing = makeCorrections(new FailOnPublish(events!, 2));
    await expect(reverse(fixture, input, failing)).rejects.toThrow(
      "Order 266 injected publication failure",
    );
    expect(await artifactCounts()).toEqual(before);
    expect(await immutableHash(fixture)).toBe(beforeHash);
    expect(await reverse(fixture, input)).toMatchObject({
      state: "reversed",
      reversesJournalId: fixture.journalId,
      created: true,
      replayed: false,
    });
  });

  test("P4: hostile identity, authority and caller financial payloads fail with zero mutation", async () => {
    const fixture = await seedPositive();
    const before = await artifactCounts();
    const beforeHash = await immutableHash(fixture);
    await expect(reverse(fixture, {
      ...correctionInput(fixture, "order266-hostile-financial-input"),
      amountMinor: "1",
      folioId: fixture.folioId,
      txCode: fixture.revenueRoute.txCode,
      taxDetail: {},
    } as never)).rejects.toBeInstanceOf(PositiveTaxCorrectionValidationError);
    await expect(reverse(fixture, correctionInput(
      fixture,
      "order266-padded-reason",
      false,
      ACTOR_A,
      " padded reason ",
    ))).rejects.toBeInstanceOf(PositiveTaxCorrectionValidationError);
    const mismatched = correctionInput(fixture, "order266-property-mismatch");
    await expect(reverse(fixture, {
      ...mismatched,
      envelope: { ...mismatched.envelope, propertyNode: PROPERTY_B },
    })).rejects.toBeInstanceOf(PositiveTaxCorrectionValidationError);
    await expect(reverse(fixture, {
      ...correctionInput(fixture, "order266-forged-authority"),
      postSealAuthorized: "true",
    } as never)).rejects.toBeInstanceOf(PositiveTaxCorrectionValidationError);
    const missingInput = {
      ...correctionInput(fixture, "order266-random-target"),
      reversesJournalId: crypto.randomUUID(),
    };
    await expect(reverse(fixture, missingInput))
      .rejects.toBeInstanceOf(PositiveTaxCorrectionNotFoundError);

    const foreign = await seedPositive({
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      actorId: ACTOR_B,
      partyId: PARTY_B,
      unitTypeId: UNIT_TYPE_B,
      sellableId: SELLABLE_B,
      ratePlanId: RATE_PLAN_B,
      extensionId: EXTENSION_B,
      currency: "USD",
    });
    await expect(reverse(foreign, correctionInput(
      foreign,
      "order266-cross-tenant",
    ), corrections!, TENANT_A)).rejects.toBeInstanceOf(PositiveTaxCorrectionNotFoundError);
    await expect(reverse(fixture, correctionInput(
      fixture,
      "order266-foreign-actor",
      false,
      ACTOR_B,
    ))).rejects.toBeInstanceOf(PositiveTaxCorrectionConflictError);
    expect(await artifactCounts()).toEqual(before);
    expect(await immutableHash(fixture)).toBe(beforeHash);
  });

  test("P5: account, folio and binding races serialize; current route drift never reroutes history", async () => {
    const accountRace = await seedPositive();
    const accountLock = await deploy!.reserve();
    try {
      await accountLock.unsafe("BEGIN");
      await accountLock`SELECT id FROM account WHERE tenant_id=${TENANT_A}::uuid
        AND id=${accountRace.revenueRoute.accountId}::uuid FOR UPDATE`;
      const attempted = reverse(
        accountRace,
        correctionInput(accountRace, "order266-account-race"),
      );
      await Bun.sleep(50);
      await accountLock`UPDATE account SET status='closed'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${accountRace.revenueRoute.accountId}::uuid`;
      await accountLock.unsafe("COMMIT");
      await expect(attempted).rejects.toBeInstanceOf(PositiveTaxCorrectionConflictError);
    } finally {
      await accountLock.unsafe("ROLLBACK").catch(() => undefined);
      accountLock.release();
      await deploy!`UPDATE account SET status='open' WHERE tenant_id=${TENANT_A}::uuid
        AND id=${accountRace.revenueRoute.accountId}::uuid`;
    }

    const folioRace = await seedPositive();
    const folioLock = await deploy!.reserve();
    try {
      await folioLock.unsafe("BEGIN");
      await folioLock`SELECT id FROM folio WHERE tenant_id=${TENANT_A}::uuid
        AND id=${folioRace.folioId}::uuid FOR UPDATE`;
      const attempted = reverse(
        folioRace,
        correctionInput(folioRace, "order266-folio-race"),
      );
      await Bun.sleep(50);
      await folioLock`UPDATE folio SET status='closed'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${folioRace.folioId}::uuid`;
      await folioLock.unsafe("COMMIT");
      await expect(attempted).rejects.toBeInstanceOf(PositiveTaxCorrectionConflictError);
    } finally {
      await folioLock.unsafe("ROLLBACK").catch(() => undefined);
      folioLock.release();
      await deploy!`UPDATE folio SET status='open' WHERE tenant_id=${TENANT_A}::uuid
        AND id=${folioRace.folioId}::uuid`;
    }

    const bindingRace = await seedPositive();
    const bindingLock = await deploy!.reserve();
    try {
      await bindingLock.unsafe("BEGIN");
      await bindingLock`SELECT id FROM tax_attribution_journal_binding
        WHERE tenant_id=${TENANT_A}::uuid AND id=${bindingRace.postingBindingId}::uuid
        FOR UPDATE`;
      let settled = false;
      const attempted = reverse(
        bindingRace,
        correctionInput(bindingRace, "order266-binding-race"),
      ).then((value) => { settled = true; return value; });
      await Bun.sleep(50);
      expect(settled).toBeFalse();
      await bindingLock.unsafe("COMMIT");
      expect(await attempted).toMatchObject({
        state: "reversed",
        reversesJournalId: bindingRace.journalId,
      });
    } finally {
      await bindingLock.unsafe("ROLLBACK").catch(() => undefined);
      bindingLock.release();
    }

    const routeDrift = await seedPositive();
    const originalLines = await deploy!<Array<{ seq: number; tx_code: string }>>`
      SELECT seq,tx_code FROM posting_line WHERE tenant_id=${TENANT_A}::uuid
        AND journal_id=${routeDrift.journalId}::uuid ORDER BY seq`;
    await deploy!`UPDATE tax_semantic_route SET tx_code=${routeDrift.revenueRoute.txCode}
      WHERE tenant_id=${TENANT_A}::uuid AND id=${routeDrift.taxRoutes[0]!.mappingId}::uuid`;
    const reversed = await reverse(
      routeDrift,
      correctionInput(routeDrift, "order266-frozen-route-evidence"),
    );
    const reversalCodes = await deploy!<Array<{ seq: number; tx_code: string }>>`
      SELECT seq,tx_code FROM posting_line WHERE tenant_id=${TENANT_A}::uuid
        AND journal_id=${reversed.journalId}::uuid ORDER BY seq`;
    expect(reversalCodes).toEqual(originalLines);
  }, 90_000);

  test("P6: correction capabilities, immutable DML, RLS and schema authority are exact", async () => {
    const functions = await deploy!<Array<{
      name: string;
      owner: string;
      security_definer: boolean;
      volatility: string;
      config: string[] | null;
      app_execute: boolean;
      runtime_execute: boolean;
      public_execute: boolean;
    }>>`SELECT p.proname name,pg_get_userbyid(p.proowner) owner,
      p.prosecdef security_definer,p.provolatile::text volatility,p.proconfig config,
      has_function_privilege('app_role',p.oid,'EXECUTE') app_execute,
      has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime_execute,
      has_function_privilege('public',p.oid,'EXECUTE') public_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN
        ('create_positive_tax_correction_header','record_positive_tax_correction_root')
      ORDER BY p.proname`;
    expect(functions).toHaveLength(2);
    for (const fn of functions) {
      expect(fn).toMatchObject({
        owner: "yellow_owner",
        security_definer: true,
        volatility: "v",
        app_execute: true,
        runtime_execute: false,
        public_execute: false,
      });
      expect(fn.config).toContain("search_path=pg_catalog, public, pg_temp");
    }
    expect((await deploy!<Array<{ tables: number; policies: number }>>`SELECT
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p')) tables,
      (SELECT count(*)::int FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') policies`)[0])
      .toEqual({ tables: 98, policies: 88 });

    const fixture = await seedPositive();
    await expectSqlState(() => deploy!.unsafe(
      "SELECT public.create_positive_tax_correction_header($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid)",
      [TENANT_A, PROPERTY_A, fixture.journalId, "Forged owner correction", ACTOR_A],
    ), "42501");
    await expectSqlState(() => deploy!.unsafe(
      "SELECT public.record_positive_tax_correction_root($1::uuid,$2::uuid,$3::uuid,$4::uuid)",
      [TENANT_A, ACTOR_A, fixture.journalId, crypto.randomUUID()],
    ), "42501");
    await expectSqlState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      INSERT INTO journal(
        tenant_id,property_node,business_date,kind,description,currency,reverses,source,created_by
      ) VALUES(
        ${TENANT_A}::uuid,${PROPERTY_A}::uuid,${currentDay}::date,'adjustment',
        'forged positive-tax correction','CAD',${fixture.journalId}::uuid,
        '{"interface":"financials.positive-tax.reverse"}'::jsonb,${ACTOR_A}::uuid
      )
    `), "42501");
    await expectSqlState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      INSERT INTO posting_line(
        tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
        amount_minor,quantity,business_date,currency,tax_detail
      )
      SELECT tenant_id,journal_id,99,account_id,folio_id,tx_code,'forged reversal root',
             -amount_minor,quantity,business_date,currency,'{"schemaVersion":2}'::jsonb
        FROM posting_line WHERE tenant_id=${TENANT_A}::uuid
          AND journal_id=${fixture.journalId}::uuid AND seq=1
    `), "42501");
    for (const sql of [
      "UPDATE journal SET description=description WHERE tenant_id=$1::uuid",
      "DELETE FROM journal WHERE tenant_id=$1::uuid",
      "UPDATE posting_line SET description=description WHERE tenant_id=$1::uuid",
      "DELETE FROM posting_line WHERE tenant_id=$1::uuid",
      "UPDATE tax_attribution_journal_binding SET posted_at=posted_at WHERE tenant_id=$1::uuid",
      "DELETE FROM tax_attribution_journal_binding WHERE tenant_id=$1::uuid",
    ]) {
      await expectSqlState(() => database!.withTenantTransaction(
        TENANT_A,
        (tx) => tx.unsafe(sql, [TENANT_A]),
      ), "42501");
    }

    const foreign = await seedPositive({
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      actorId: ACTOR_B,
      partyId: PARTY_B,
      unitTypeId: UNIT_TYPE_B,
      sellableId: SELLABLE_B,
      ratePlanId: RATE_PLAN_B,
      extensionId: EXTENSION_B,
      currency: "USD",
    });
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) => tx<
      Array<{ journals: number; bindings: number }>
    >`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_B}::uuid
        AND id=${foreign.journalId}::uuid) journals,
      (SELECT count(*)::int FROM tax_attribution_journal_binding
        WHERE tenant_id=${TENANT_B}::uuid AND id=${foreign.postingBindingId}::uuid) bindings`);
    expect(visible).toEqual([{ journals: 0, bindings: 0 }]);
  });

  test("P7: a sealing race denies the operator and exact post-seal authority succeeds", async () => {
    const deniedFixture = await seedPositive();
    const authorizedFixture = await seedPositive();
    const beforeDenied = await artifactCounts();
    const dayLock = await deploy!.reserve();
    try {
      await dayLock.unsafe("BEGIN");
      await dayLock`UPDATE business_day
        SET sealed_at=transaction_timestamp(),sealed_by=${APPROVER_A}::uuid
        WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid
          AND business_date=${currentDay}::date`;
      const denied = reverse(
        deniedFixture,
        correctionInput(deniedFixture, "order266-seal-race-denied"),
      );
      await Bun.sleep(50);
      await dayLock.unsafe("COMMIT");
      await expect(denied).rejects.toBeInstanceOf(PositiveTaxCorrectionAuthorizationError);
    } finally {
      await dayLock.unsafe("ROLLBACK").catch(() => undefined);
      dayLock.release();
    }
    expect(await artifactCounts()).toEqual(beforeDenied);
    const authorized = await reverse(
      authorizedFixture,
      correctionInput(
        authorizedFixture,
        "order266-sealed-authorized",
        true,
        APPROVER_A,
      ),
    );
    expect(authorized).toMatchObject({
      state: "reversed",
      reversesJournalId: authorizedFixture.journalId,
      created: true,
      replayed: false,
    });
    expect((await deploy!<Array<{ sealed: boolean }>>`
      SELECT sealed_at IS NOT NULL sealed FROM business_day
       WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid
         AND business_date=${currentDay}::date`)[0]!.sealed).toBeTrue();
  }, 60_000);
});
