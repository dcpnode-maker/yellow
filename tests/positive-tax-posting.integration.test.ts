import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  ChargeCorrectionService,
  ChargeService,
  PositiveTaxPostingConflictError,
  PositiveTaxPostingService,
  PositiveTaxPostingValidationError,
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

setDefaultTimeout(90_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_POSITIVE_TAX_POSTING_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_POSITIVE_TAX_POSTING === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 262 positive-tax posting proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(26201);
const TENANT_B = id(26202);
const PROPERTY_A = id(26211);
const PROPERTY_B = id(26212);
const ACTOR_A = id(26221);
const ACTOR_B = id(26222);
const PARTY_A = id(26231);
const PARTY_B = id(26232);
const UNIT_TYPE_A = id(26241);
const UNIT_TYPE_B = id(26242);
const SELLABLE_A = id(26251);
const SELLABLE_B = id(26252);
const RATE_PLAN_A = id(26261);
const RATE_PLAN_B = id(26262);
const EXTENSION_A = id(26271);
const EXTENSION_B = id(26272);
const EXTENSION_TYPE = "order262_jurisdiction";
const DAY_MS = 86_400_000;

interface TaxOption {
  readonly code: string;
  readonly name: string;
  readonly taxMinor: bigint;
}

interface GraphOptions {
  readonly tenantId?: string;
  readonly propertyNode?: string;
  readonly actorId?: string;
  readonly partyId?: string;
  readonly unitTypeId?: string;
  readonly sellableId?: string;
  readonly ratePlanId?: string;
  readonly extensionId?: string;
  readonly currency?: string;
  readonly country?: string;
  readonly rounding?: "line" | "document";
  readonly taxes?: readonly TaxOption[];
  readonly sharedTaxAccount?: boolean;
  readonly seedRoutes?: boolean;
}

interface RouteFixture {
  readonly mappingId: string;
  readonly txCode: string;
  readonly accountId: string;
}

interface GraphFixture {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly holdId: string;
  readonly holdBindingId: string;
  readonly attributionId: string;
  readonly lineageId: string;
  readonly folioId: string;
  readonly guestAccountId: string;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly snapshot: ReturnType<typeof createPositiveTaxAttributionSnapshot>;
  readonly revenueRoute: RouteFixture | null;
  readonly taxRoutes: readonly RouteFixture[];
}

interface ArtifactCounts {
  readonly journals: number;
  readonly lines: number;
  readonly bindings: number;
  readonly journalFacts: number;
  readonly taxFacts: number;
  readonly journalEvents: number;
  readonly taxEvents: number;
  readonly keys: number;
  readonly documents: number;
  readonly submissions: number;
}

let deploy: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let service: PositiveTaxPostingService | undefined;
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

function input(graph: GraphFixture, key = `order262-${crypto.randomUUID()}`) {
  return {
    tenantId: graph.tenantId,
    propertyNode: graph.propertyNode,
    reservationId: graph.reservationId,
    idempotencyKey: key,
    envelope: envelope(graph.tenantId, graph.propertyNode, graph.actorId),
  };
}

function makeService(bus: EventBus): PositiveTaxPostingService {
  return new PositiveTaxPostingService({
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
}

function post(
  graph: GraphFixture,
  request = input(graph),
  using = service!,
  transactionTenant = graph.tenantId,
) {
  return database!.withTenantTransaction(transactionTenant, (tx) => using.post(tx, request));
}

class FailAfterPublish implements EventBus {
  #published = 0;

  constructor(readonly delegate: EventBus, readonly failAfter: number) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    const published = await this.delegate.publish(tx, event);
    this.#published += 1;
    if (this.#published === this.failAfter) {
      throw new Error("Order 262 injected failure after outbox insertion");
    }
    return published;
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function snapshotInput(
  n: number,
  quoteHash: string,
  currency: string,
  extensionId: string,
  ownerTenantId: string,
  options: GraphOptions,
): CreatePositiveTaxAttributionSnapshotInput {
  const taxes = options.taxes ?? [
    { code: "PST", name: "Provincial sales tax", taxMinor: 500n },
  ];
  const taxTotal = taxes.reduce((sum, tax) => sum + tax.taxMinor, 0n);
  const businessDate = new Date(Date.UTC(2036, 0, (n % 27) + 1)).toISOString().slice(0, 10);
  const jurisdictionKey = `ca.order262.tax.${n}`;
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
      country: options.country ?? "CA",
      priceDisplay: "tax_exclusive",
      rounding: options.rounding ?? "line",
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
          taxMinor: options.rounding === "document" ? null : tax.taxMinor,
          rateBasisPoints: Number(tax.taxMinor),
        }],
      })),
    },
  };
}

async function seedRoute(
  graph: Omit<GraphFixture, "revenueRoute" | "taxRoutes">,
  kind: "revenue" | "tax",
  semanticCode: string,
  accountId?: string,
): Promise<RouteFixture> {
  const n = ++sequence;
  const mappingId = crypto.randomUUID();
  const routeAccountId = accountId ?? crypto.randomUUID();
  const txCode = `O262_${kind === "revenue" ? "R" : "T"}_${n}`;
  const role = kind === "revenue" ? "revenue" : "tax_payable";
  await deploy!`INSERT INTO account(
      id,tenant_id,property_node,role,name,currency,status
    ) VALUES (
      ${routeAccountId}::uuid,${graph.tenantId}::uuid,${graph.propertyNode}::uuid,
      ${role},${`Order 262 ${semanticCode}`},${graph.currency}::char(3),'open'
    ) ON CONFLICT (id) DO NOTHING`;
  await deploy!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
    VALUES (
      ${txCode},${`Order 262 ${semanticCode}`},${kind},
      ${kind === "revenue" ? "Rooms" : null},'guest',${role}
    )`;
  await deploy!`INSERT INTO tx_code_route(
      tenant_id,property_node,currency,tx_code,credit_account_id
    ) VALUES (
      ${graph.tenantId}::uuid,${graph.propertyNode}::uuid,${graph.currency}::char(3),
      ${txCode},${routeAccountId}::uuid
    )`;
  await deploy!`INSERT INTO tax_semantic_route(
      tenant_id,id,property_node,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,semantic_kind,semantic_code,tx_code
    ) VALUES (
      ${graph.tenantId}::uuid,${mappingId}::uuid,${graph.propertyNode}::uuid,
      ${graph.currency}::char(3),${graph.snapshot.jurisdiction.extensionId}::uuid,
      ${graph.snapshot.jurisdiction.ownerTenantId}::uuid,
      ${graph.snapshot.jurisdiction.key},${graph.snapshot.jurisdiction.version},
      ${graph.snapshot.jurisdiction.contentHash},${kind},${semanticCode},${txCode}
    )`;
  return { mappingId, txCode, accountId: routeAccountId };
}

async function seedGraph(options: GraphOptions = {}): Promise<GraphFixture> {
  const tenantId = options.tenantId ?? TENANT_A;
  const propertyNode = options.propertyNode ?? PROPERTY_A;
  const actorId = options.actorId ?? ACTOR_A;
  const partyId = options.partyId ?? PARTY_A;
  const unitTypeId = options.unitTypeId ?? UNIT_TYPE_A;
  const sellableId = options.sellableId ?? SELLABLE_A;
  const ratePlanId = options.ratePlanId ?? RATE_PLAN_A;
  const extensionId = options.extensionId ?? EXTENSION_A;
  const currency = options.currency ?? "CAD";
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
    n, quoteHash, currency, extensionId, tenantId, options,
  ));
  const periodFrom = new Date(Date.UTC(2036, 0, (n % 27) + 1, 15));
  const periodTo = new Date(periodFrom.getTime() + DAY_MS);
  const period = `[${periodFrom.toISOString()},${periodTo.toISOString()})`;

  await deploy!`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES (
      ${reservationId}::uuid,${tenantId}::uuid,${propertyNode}::uuid,
      ${`O262-${n}`},'checked_out',${partyId}::uuid,'direct',${currency}::char(3)
    )`;
  await deploy!`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
      adults,children,rate_plan_id,status
    ) VALUES (
      ${segmentId}::uuid,${tenantId}::uuid,${reservationId}::uuid,1,
      ${unitTypeId}::uuid,${sellableId}::uuid,${period}::tstzrange,
      2,'[]'::jsonb,${ratePlanId}::uuid,'booked'
    )`;
  await deploy!`INSERT INTO hold(
      id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status
    ) VALUES (
      ${holdId}::uuid,${tenantId}::uuid,${propertyNode}::uuid,${sellableId}::uuid,
      ${period}::tstzrange,'cart','{}'::jsonb,${periodTo.toISOString()}::timestamptz,'consumed'
    )`;
  await deploy!`INSERT INTO tax_attribution_snapshot(
      tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,
      snapshot_hash,currency,snapshot
    ) VALUES (
      ${tenantId}::uuid,${attributionId}::uuid,${propertyNode}::uuid,${actorId}::uuid,
      1,'rate_quote',${quoteHash},${snapshot.snapshotHash},${currency}::char(3),
      ${JSON.stringify(snapshot)}::jsonb
    )`;
  await deploy!`INSERT INTO tax_attribution_hold_binding(
      tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,
      origin_quote_hash,snapshot_hash,currency
    ) VALUES (
      ${tenantId}::uuid,${holdBindingId}::uuid,${propertyNode}::uuid,${actorId}::uuid,
      ${holdId}::uuid,${attributionId}::uuid,${sellableId}::uuid,${period}::tstzrange,
      ${quoteHash},${snapshot.snapshotHash},${currency}::char(3)
    )`;
  await deploy!`INSERT INTO tax_attribution_reservation_binding(
      tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,
      segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency
    ) VALUES (
      ${tenantId}::uuid,${lineageId}::uuid,${propertyNode}::uuid,${actorId}::uuid,
      ${holdBindingId}::uuid,${holdId}::uuid,${attributionId}::uuid,${reservationId}::uuid,
      ${segmentId}::uuid,${sellableId}::uuid,${period}::tstzrange,
      ${quoteHash},${snapshot.snapshotHash},${currency}::char(3)
    )`;
  await deploy!`INSERT INTO account(
      id,tenant_id,property_node,role,party_id,name,currency,status
    ) VALUES (
      ${guestAccountId}::uuid,${tenantId}::uuid,${propertyNode}::uuid,'guest',
      ${partyId}::uuid,${`Order 262 Guest ${n}`},${currency}::char(3),'open'
    )`;
  await deploy!`INSERT INTO folio(
      id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
    ) VALUES (
      ${folioId}::uuid,${tenantId}::uuid,${guestAccountId}::uuid,${reservationId}::uuid,
      ${`O262-F-${n}`},1,'Primary','open'
    )`;

  const base = {
    tenantId, propertyNode, actorId, reservationId, segmentId, holdId,
    holdBindingId, attributionId, lineageId, folioId, guestAccountId,
    quoteHash, snapshotHash: snapshot.snapshotHash, currency, snapshot,
  };
  if (options.seedRoutes === false) {
    return Object.freeze({ ...base, revenueRoute: null, taxRoutes: Object.freeze([]) });
  }
  const revenueRoute = await seedRoute(base, "revenue", "room_revenue");
  const taxRoutes: RouteFixture[] = [];
  let sharedAccount: string | undefined;
  for (const tax of snapshot.evaluation.taxes) {
    if (BigInt(tax.taxMinor) === 0n) continue;
    if (options.sharedTaxAccount) sharedAccount ??= crypto.randomUUID();
    taxRoutes.push(await seedRoute(base, "tax", tax.code, sharedAccount));
  }
  return Object.freeze({
    ...base,
    revenueRoute,
    taxRoutes: Object.freeze(taxRoutes),
  });
}

async function counts(): Promise<ArtifactCounts> {
  return (await deploy!<ArtifactCounts[]>`SELECT
    (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_A}::uuid) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT_A}::uuid) lines,
    (SELECT count(*)::int FROM tax_attribution_journal_binding
      WHERE tenant_id=${TENANT_A}::uuid) bindings,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
      AND fact_type='journal.posted') journal_facts,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
      AND fact_type='tax.attribution_posted') tax_facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
      AND event_type='journal.posted') journal_events,
    (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
      AND event_type='tax.attribution_posted') tax_events,
    (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid
      AND operation='financials.positive-tax.post') keys,
    (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT_A}::uuid) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT_A}::uuid) submissions`)[0]!;
}

function expectDeepFrozen(
  value: unknown,
  seen = new Set<object>(),
  path: readonly PropertyKey[] = [],
): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) {
    throw new Error(`Expected deeply frozen value at ${path.map(String).join(".") || "root"}`);
  }
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen, [...path, key]);
  }
}

function sqlState(error: unknown): string | undefined {
  const typed = error as { errno?: string; code?: string };
  return typed.errno ?? typed.code;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM tax_attribution_journal_binding
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_semantic_route WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tx_code_route WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_reservation_binding
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation_segment WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_hold_binding
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM hold WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_snapshot
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM business_day WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM sellable_unit WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM unit_type WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM rate_plan WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM app_user WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM extension WHERE id IN (${EXTENSION_A}::uuid,${EXTENSION_B}::uuid)`;
  await deploy`DELETE FROM extension_type WHERE type=${EXTENSION_TYPE}`;
  await deploy`DELETE FROM tx_code WHERE code LIKE 'O262\_%' ESCAPE '\\'`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 262 P0: financials exports the governed positive-tax posting service", () => {
  expect(typeof PositiveTaxPostingService).toBe("function");
});

databaseDescribe("Order 262 governed positive-tax journal posting", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 48, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 48, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 64, prepare: false });
    events = new PostgresEventBus(eventPool);
    service = makeService(events);
    await cleanup();
    currentDay = (await deploy<Array<{ business_date: string }>>`
      SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS business_date`
    )[0]!.business_date;
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order262-a','Order 262 A','shared','active'),
      (${TENANT_B}::uuid,'order262-b','Order 262 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order262a.property'::ltree,'property','Order 262 A','UTC','CAD'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order262b.property'::ltree,'property','Order 262 B','UTC','USD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor@order262-a.local','Actor A','active'),
      (${ACTOR_B}::uuid,${TENANT_B}::uuid,'actor@order262-b.local','Actor B','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Order 262 Guest A','active'),
      (${PARTY_B}::uuid,${TENANT_B}::uuid,'person','Order 262 Guest B','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
      (${TENANT_A}::uuid,${PARTY_A}::uuid,'guest'),
      (${TENANT_B}::uuid,${PARTY_B}::uuid,'guest')`;
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES
      (${UNIT_TYPE_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O262A','Order 262 Room A','hotel',4),
      (${UNIT_TYPE_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O262B','Order 262 Room B','hotel',4)`;
    await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
      (${SELLABLE_A}::uuid,${TENANT_A}::uuid,${UNIT_TYPE_A}::uuid,'Order 262 Sellable A','active'),
      (${SELLABLE_B}::uuid,${TENANT_B}::uuid,${UNIT_TYPE_B}::uuid,'Order 262 Sellable B','active')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES
      (${RATE_PLAN_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O262-A','Order 262 Rate A','CAD',false,'active'),
      (${RATE_PLAN_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O262-B','Order 262 Rate B','USD',false,'active')`;
    await deploy`INSERT INTO extension_type(type,json_schema)
      VALUES (${EXTENSION_TYPE},'{"type":"object"}'::jsonb)`;
    await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
      (${EXTENSION_A}::uuid,${TENANT_A}::uuid,${EXTENSION_TYPE},'ca.order262.tax',1,
       '[2030-01-01 00:00:00+00,)'::tstzrange,'{}'::jsonb,'active'),
      (${EXTENSION_B}::uuid,${TENANT_B}::uuid,${EXTENSION_TYPE},'us.order262.tax',1,
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

  test("P1: one tax posts exact balanced lines, root detail, binding and dual evidence", async () => {
    const graph = await seedGraph();
    const result = await post(graph);
    expectDeepFrozen(result);
    // Bun's asymmetric matcher writes its matcher object into the received property;
    // match a disposable copy so the immutable receipt remains usable for SQL proof.
    expect({ ...result }).toMatchObject({
      state: "posted",
      postingBindingId: expect.any(String),
      journalId: expect.any(String),
      lineageId: graph.lineageId,
      holdBindingId: graph.holdBindingId,
      attributionId: graph.attributionId,
      reservationId: graph.reservationId,
      segmentId: graph.segmentId,
      folioId: graph.folioId,
      businessDate: currentDay,
      currency: "CAD",
      quoteHash: graph.quoteHash,
      snapshotHash: graph.snapshotHash,
      grandTotalMinor: "10500",
      lineCount: 3,
      created: true,
      replayed: false,
    });
    if (result.state !== "posted") throw new Error("expected a posted result");

    const header = (await deploy!<Array<Record<string, unknown>>>`
      SELECT kind,description,business_date::text,currency,source,created_by
      FROM journal WHERE tenant_id=${TENANT_A}::uuid AND id=${result.journalId}::uuid`)[0]!;
    expect(header).toMatchObject({
      kind: "charge", business_date: currentDay, currency: "CAD", created_by: ACTOR_A,
      source: { interface: "financials.positive-tax.post", lineage_id: graph.lineageId },
    });

    const lines = await deploy!<Array<Record<string, unknown>>>`
      SELECT seq,account_id,folio_id,tx_code,amount_minor::text,quantity::text,
             business_date::text,currency,tax_detail
      FROM posting_line WHERE tenant_id=${TENANT_A}::uuid
        AND journal_id=${result.journalId}::uuid ORDER BY seq`;
    expect(lines.map(({ seq, account_id, folio_id, tx_code, amount_minor, quantity }) =>
      ({ seq, account_id, folio_id, tx_code, amount_minor, quantity }))).toEqual([
      { seq: 1, account_id: graph.guestAccountId, folio_id: graph.folioId,
        tx_code: graph.revenueRoute!.txCode, amount_minor: "10500", quantity: "1.000" },
      { seq: 2, account_id: graph.revenueRoute!.accountId, folio_id: null,
        tx_code: graph.revenueRoute!.txCode, amount_minor: "-10000", quantity: "1.000" },
      { seq: 3, account_id: graph.taxRoutes[0]!.accountId, folio_id: null,
        tx_code: graph.taxRoutes[0]!.txCode, amount_minor: "-500", quantity: "1.000" },
    ]);
    expect(lines[0]!.tax_detail).toBeTruthy();
    expect(lines.slice(1).every(({ tax_detail }) => tax_detail === null)).toBeTrue();
    expect(lines[0]!.tax_detail).toEqual({
      schemaVersion: 1,
      lineage: {
        lineageId: graph.lineageId,
        holdBindingId: graph.holdBindingId,
        attributionId: graph.attributionId,
        reservationId: graph.reservationId,
        segmentId: graph.segmentId,
        folioId: graph.folioId,
        journalId: result.journalId,
      },
      quote: {
        originQuoteHash: graph.quoteHash,
        snapshotHash: graph.snapshotHash,
        currency: graph.currency,
      },
      jurisdiction: {
        extensionId: graph.snapshot.jurisdiction.extensionId,
        ownerTenantId: graph.snapshot.jurisdiction.ownerTenantId,
        key: graph.snapshot.jurisdiction.key,
        version: String(graph.snapshot.jurisdiction.version),
        contentHash: graph.snapshot.jurisdiction.contentHash,
      },
      routes: {
        revenue: {
          mappingId: graph.revenueRoute!.mappingId,
          semanticCode: "room_revenue",
          txCode: graph.revenueRoute!.txCode,
          creditAccountId: graph.revenueRoute!.accountId,
        },
        taxes: [{
          taxIndex: "0",
          taxCode: "PST",
          mappingId: graph.taxRoutes[0]!.mappingId,
          txCode: graph.taxRoutes[0]!.txCode,
          creditAccountId: graph.taxRoutes[0]!.accountId,
        }],
      },
      totals: { baseMinor: "10000", taxMinor: "500", grandMinor: "10500" },
      taxes: [{ index: "0", code: "PST", name: "Provincial sales tax", taxMinor: "500" }],
    });
    expect(JSON.stringify(lines[0]!.tax_detail)).not.toMatch(/email|display_name|password|token/i);
    expect((await deploy!<Array<{ total: string }>>`SELECT sum(amount_minor)::text total
      FROM posting_line WHERE tenant_id=${TENANT_A}::uuid
        AND journal_id=${result.journalId}::uuid`)[0]!.total).toBe("0");
    expect((await deploy!<Array<{ balance: string }>>`SELECT balance_minor::text balance
      FROM folio_balance WHERE tenant_id=${TENANT_A}::uuid
        AND folio_id=${graph.folioId}::uuid`)[0]!.balance).toBe("10500");

    const binding = (await deploy!<Array<Record<string, unknown>>>`
      SELECT id,lineage_id,folio_id,journal_id,origin_quote_hash,snapshot_hash,
             currency,business_date::text,posted_by
      FROM tax_attribution_journal_binding
      WHERE tenant_id=${TENANT_A}::uuid AND id=${result.postingBindingId}::uuid`)[0]!;
    expect(binding).toMatchObject({
      id: result.postingBindingId, lineage_id: graph.lineageId, folio_id: graph.folioId,
      journal_id: result.journalId, origin_quote_hash: graph.quoteHash,
      snapshot_hash: graph.snapshotHash, currency: "CAD", business_date: currentDay,
      posted_by: ACTOR_A,
    });
    const evidence = await deploy!<Array<{ kind: string; count: number }>>`
      SELECT 'fact:' || fact_type kind,count(*)::int count FROM fact_log
      WHERE tenant_id=${TENANT_A}::uuid AND entity_id IN
        (${result.journalId}::uuid,${result.postingBindingId}::uuid) GROUP BY fact_type
      UNION ALL
      SELECT 'event:' || event_type,count(*)::int FROM outbox
      WHERE tenant_id=${TENANT_A}::uuid AND aggregate_id IN
        (${result.journalId}::uuid,${result.postingBindingId}::uuid) GROUP BY event_type
      ORDER BY kind`;
    expect(evidence).toEqual([
      { kind: "event:journal.posted", count: 1 },
      { kind: "event:tax.attribution_posted", count: 1 },
      { kind: "fact:journal.posted", count: 1 },
      { kind: "fact:tax.attribution_posted", count: 1 },
    ]);
  });

  test("P2: zero and multiple taxes preserve canonical line order and shared liability accounts", async () => {
    const zero = await seedGraph({
      taxes: [{ code: "ZERO", name: "Zero tax", taxMinor: 0n }],
    });
    const zeroResult = await post(zero);
    expect(zeroResult).toMatchObject({ state: "posted", grandTotalMinor: "10000", lineCount: 2 });
    if (zeroResult.state !== "posted") throw new Error("expected zero-tax posting");
    expect(await deploy!`SELECT seq FROM posting_line WHERE tenant_id=${TENANT_A}::uuid
      AND journal_id=${zeroResult.journalId}::uuid ORDER BY seq`).toHaveLength(2);
    const zeroDetail = (await deploy!<Array<{ tax_detail: Record<string, unknown> }>>`
      SELECT tax_detail FROM posting_line WHERE tenant_id=${TENANT_A}::uuid
        AND journal_id=${zeroResult.journalId}::uuid AND seq=1`)[0]!.tax_detail;
    expect((zeroDetail.routes as { taxes: unknown[] }).taxes).toEqual([]);
    expect(zeroDetail.taxes).toEqual([
      { index: "0", code: "ZERO", name: "Zero tax", taxMinor: "0" },
    ]);

    const multiple = await seedGraph({
      sharedTaxAccount: true,
      taxes: [
        { code: "PST", name: "Provincial tax", taxMinor: 700n },
        { code: "ZERO", name: "Zero tax", taxMinor: 0n },
        { code: "QST", name: "Quebec tax", taxMinor: 900n },
      ],
    });
    const multipleResult = await post(multiple);
    expect(multipleResult).toMatchObject({ state: "posted", grandTotalMinor: "11600", lineCount: 4 });
    if (multipleResult.state !== "posted") throw new Error("expected multiple-tax posting");
    const lines = await deploy!<Array<{ seq: number; account_id: string; tx_code: string; amount: string }>>`
      SELECT seq,account_id,tx_code,amount_minor::text amount FROM posting_line
      WHERE tenant_id=${TENANT_A}::uuid AND journal_id=${multipleResult.journalId}::uuid
      ORDER BY seq`;
    expect(lines.slice(2)).toEqual([
      { seq: 3, account_id: multiple.taxRoutes[0]!.accountId,
        tx_code: multiple.taxRoutes[0]!.txCode, amount: "-700" },
      { seq: 4, account_id: multiple.taxRoutes[1]!.accountId,
        tx_code: multiple.taxRoutes[1]!.txCode, amount: "-900" },
    ]);
    expect(multiple.taxRoutes[0]!.accountId).toBe(multiple.taxRoutes[1]!.accountId);
  });

  test("P3/P4: policy blockers and hostile caller authority write nothing", async () => {
    for (const { options, blockers } of ([
      {
        options: { rounding: "document" as const },
        blockers: ["document_tax_allocation_required"],
      },
      {
        options: { country: "IN" },
        blockers: ["india_place_of_supply_decomposition_required"],
      },
      {
        options: { taxes: [{ code: "GST_ROOM", name: "Aggregate GST", taxMinor: 500n }] },
        blockers: ["india_place_of_supply_decomposition_required"],
      },
      {
        options: { country: "IN", rounding: "document" as const },
        blockers: [
          "document_tax_allocation_required",
          "india_place_of_supply_decomposition_required",
        ],
      },
    ] as const)) {
      const graph = await seedGraph({ ...options, seedRoutes: false });
      const before = await counts();
      const result = await post(graph);
      expect(result.state).toBe("policy_blocked");
      if (result.state === "policy_blocked") {
        expect(result.blockers).toEqual(blockers);
        expectDeepFrozen(result);
      }
      expect(await counts()).toEqual(before);
    }

    const graph = await seedGraph();
    const before = await counts();
    await expect(post(graph, {
      ...input(graph, "order262-hostile-caller"),
      amountMinor: "1",
      businessDate: "2001-01-01",
      accountId: graph.guestAccountId,
      txCode: graph.revenueRoute!.txCode,
      taxDetail: {},
    } as never)).rejects.toBeInstanceOf(PositiveTaxPostingValidationError);
    expect(await counts()).toEqual(before);

    const mismatchedEnvelope = input(graph, "order262-mismatched-envelope");
    await expect(post(graph, {
      ...mismatchedEnvelope,
      envelope: { ...mismatchedEnvelope.envelope, propertyNode: PROPERTY_B },
    })).rejects.toBeInstanceOf(PositiveTaxPostingValidationError);
    expect(await counts()).toEqual(before);

    await expect(post(graph, {
      ...input(graph, "order262-foreign-actor"),
      envelope: envelope(TENANT_A, PROPERTY_A, ACTOR_B),
    })).rejects.toBeInstanceOf(PositiveTaxPostingConflictError);
    expect(await counts()).toEqual(before);

    await deploy!`UPDATE account SET status='frozen' WHERE tenant_id=${TENANT_A}::uuid
      AND id=${graph.taxRoutes[0]!.accountId}::uuid`;
    await expect(post(graph, input(graph, "order262-frozen-tax-route")))
      .rejects.toBeInstanceOf(PositiveTaxPostingConflictError);
    expect(await counts()).toEqual(before);
  });

  test("P5: replay, changed reuse and different-key convergence create one effect", async () => {
    const graph = await seedGraph();
    const exact = input(graph, "order262-same-key-race");
    const results = await Promise.all(Array.from({ length: 20 }, () => post(graph, exact)));
    expect(new Set(results.filter((result) => result.state === "posted")
      .map((result) => result.state === "posted" ? result.journalId : "blocked")).size).toBe(1);
    expect(results.filter((result) => result.state === "posted" && !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.state === "posted" && result.replayed)).toHaveLength(19);
    const canonicalReceipts = results.map((result) => {
      if (result.state !== "posted") throw new Error("expected an exact posted replay");
      const { replayed: _replayed, ...receipt } = result;
      return JSON.stringify(receipt);
    });
    expect(new Set(canonicalReceipts).size).toBe(1);
    for (const result of results) expectDeepFrozen(result);

    const other = await seedGraph();
    await expect(post(other, { ...exact, reservationId: other.reservationId }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);

    const converged = await seedGraph();
    const differentKeys = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      post(converged, input(converged, `order262-different-key-${index}`))));
    const posted = differentKeys.filter((result) => result.state === "posted");
    expect(new Set(posted.map(({ journalId }) => journalId)).size).toBe(1);
    expect(new Set(posted.map(({ postingBindingId }) => postingBindingId)).size).toBe(1);
    expect(posted.filter(({ created }) => created)).toHaveLength(1);
  }, 60_000);

  test("P5: failure after real outbox insertion rolls every artifact back before retry", async () => {
    const graph = await seedGraph();
    const exact = input(graph, "order262-rollback-after-event");
    const before = await counts();
    const failing = makeService(new FailAfterPublish(events!, 2));
    await expect(post(graph, exact, failing)).rejects.toThrow(
      "Order 262 injected failure after outbox insertion",
    );
    expect(await counts()).toEqual(before);
    const retry = await post(graph, exact);
    expect(retry).toMatchObject({ state: "posted", created: true, replayed: false });
  });

  test("P6: account/day races fail closed and contention never reports a deadlock", async () => {
    const accountRace = await seedGraph();
    const held = await deploy!.reserve();
    try {
      await held.unsafe("BEGIN");
      await held`SELECT id FROM account WHERE tenant_id=${TENANT_A}::uuid
        AND id=${accountRace.revenueRoute!.accountId}::uuid FOR UPDATE`;
      const attempt = post(accountRace, input(accountRace, "order262-account-race"));
      await Bun.sleep(40);
      await held`UPDATE account SET status='closed' WHERE tenant_id=${TENANT_A}::uuid
        AND id=${accountRace.revenueRoute!.accountId}::uuid`;
      await held.unsafe("COMMIT");
      await expect(attempt).rejects.toBeInstanceOf(PositiveTaxPostingConflictError);
    } finally {
      await held.unsafe("ROLLBACK").catch(() => undefined);
      held.release();
    }

    const folioRace = await seedGraph();
    const folioLock = await deploy!.reserve();
    try {
      await folioLock.unsafe("BEGIN");
      await folioLock`SELECT id FROM folio WHERE tenant_id=${TENANT_A}::uuid
        AND id=${folioRace.folioId}::uuid FOR UPDATE`;
      const attempt = post(folioRace, input(folioRace, "order262-folio-race"));
      await Bun.sleep(40);
      await folioLock`UPDATE folio SET status='closed' WHERE tenant_id=${TENANT_A}::uuid
        AND id=${folioRace.folioId}::uuid`;
      await folioLock.unsafe("COMMIT");
      await expect(attempt).rejects.toBeInstanceOf(PositiveTaxPostingConflictError);
    } finally {
      await folioLock.unsafe("ROLLBACK").catch(() => undefined);
      folioLock.release();
    }

    const routeRace = await seedGraph();
    const routeLock = await deploy!.reserve();
    try {
      await routeLock.unsafe("BEGIN");
      await routeLock`SELECT id FROM account WHERE tenant_id=${TENANT_A}::uuid
        AND id=${routeRace.taxRoutes[0]!.accountId}::uuid FOR UPDATE`;
      const attempt = post(routeRace, input(routeRace, "order262-route-race"));
      await Bun.sleep(40);
      await deploy!`UPDATE tax_semantic_route SET tx_code=${routeRace.revenueRoute!.txCode}
        WHERE tenant_id=${TENANT_A}::uuid AND id=${routeRace.taxRoutes[0]!.mappingId}::uuid`;
      await routeLock.unsafe("COMMIT");
      await expect(attempt).rejects.toBeInstanceOf(PositiveTaxPostingConflictError);
    } finally {
      await routeLock.unsafe("ROLLBACK").catch(() => undefined);
      routeLock.release();
    }

    const dayRace = await seedGraph();
    const dayLock = await deploy!.reserve();
    try {
      await dayLock.unsafe("BEGIN");
      await dayLock`UPDATE business_day SET sealed_at=transaction_timestamp(),sealed_by=${ACTOR_A}::uuid
        WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid
          AND business_date=${currentDay}::date`;
      const attempt = post(dayRace, input(dayRace, "order262-day-race"));
      await Bun.sleep(40);
      await dayLock.unsafe("COMMIT");
      await expect(attempt).rejects.toBeInstanceOf(PositiveTaxPostingConflictError);
    } finally {
      await dayLock.unsafe("ROLLBACK").catch(() => undefined);
      dayLock.release();
      await deploy!`UPDATE business_day SET sealed_at=NULL,sealed_by=NULL
        WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid
          AND business_date=${currentDay}::date`;
    }

    const sharedA = await seedGraph({ sharedTaxAccount: true, taxes: [
      { code: "PST", name: "PST", taxMinor: 300n },
      { code: "QST", name: "QST", taxMinor: 400n },
    ] });
    const settled = await Promise.allSettled(Array.from({ length: 10 }, (_, index) =>
      post(sharedA, input(sharedA, `order262-lock-order-${index}`))));
    expect(settled.some((result) => result.status === "fulfilled")).toBeTrue();
    for (const result of settled) {
      if (result.status === "rejected") expect(sqlState(result.reason)).not.toBe("40P01");
    }

    const ordinaryRace = await seedGraph();
    const ordinary = new ChargeService({
      events: events!, idempotency: new PostgresIdempotency(),
    });
    const ordinaryRequest = {
      tenantId: TENANT_A,
      folioId: ordinaryRace.folioId,
      txCode: ordinaryRace.revenueRoute!.txCode,
      amountMinor: "250",
      idempotencyKey: "order262-ordinary-lock-race",
      envelope: envelope(),
    };
    const mixed = await Promise.allSettled([
      post(ordinaryRace, input(ordinaryRace, "order262-taxed-lock-race")),
      database!.withTenantTransaction(TENANT_A, (tx) => ordinary.postCharge(tx, ordinaryRequest)),
    ]);
    expect(mixed.every((result) => result.status === "fulfilled")).toBeTrue();
    for (const result of mixed) {
      if (result.status === "rejected") expect(sqlState(result.reason)).not.toBe("40P01");
    }
  }, 60_000);

  test("P7: binding/capability RLS, ACL, definer path and immutable authority are exact", async () => {
    const shape = (await deploy!<Array<Record<string, unknown>>>`SELECT
      c.relrowsecurity rls,
      has_table_privilege('app_role','public.tax_attribution_journal_binding','SELECT') app_select,
      has_table_privilege('app_role','public.tax_attribution_journal_binding','INSERT') app_insert,
      has_table_privilege('app_role','public.tax_attribution_journal_binding','UPDATE') app_update,
      has_table_privilege('app_role','public.tax_attribution_journal_binding','DELETE') app_delete,
      has_column_privilege('app_role','public.posting_line','tax_detail','INSERT') tax_insert,
      has_column_privilege('app_role','public.posting_line','tax_detail','UPDATE') tax_update
      FROM pg_class c WHERE c.oid='public.tax_attribution_journal_binding'::regclass`)[0]!;
    expect(shape).toMatchObject({
      rls: true, app_select: true, app_insert: false, app_update: false,
      app_delete: false, tax_insert: false, tax_update: false,
    });
    const functions = await deploy!<Array<{
      name: string; owner: string; security_definer: boolean; config: string[] | null;
      app_execute: boolean; runtime_execute: boolean; public_execute: boolean;
    }>>`SELECT p.proname name,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,
      p.proconfig config,
      has_function_privilege('app_role',p.oid,'EXECUTE') app_execute,
      has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime_execute,
      has_function_privilege('public',p.oid,'EXECUTE') public_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN
        ('lock_positive_tax_posting_rows','record_positive_tax_journal_binding')
      ORDER BY p.proname`;
    expect(functions).toHaveLength(2);
    for (const fn of functions) {
      expect(fn).toMatchObject({
        owner: "yellow_owner", security_definer: true, app_execute: true,
        runtime_execute: false, public_execute: false,
      });
      expect(fn.config).toContain("search_path=pg_catalog, public, pg_temp");
    }
    const constraints = await deploy!<Array<{ name: string; definition: string }>>`
      SELECT conname name,pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='public.tax_attribution_journal_binding'::regclass ORDER BY conname`;
    expect(constraints.some(({ definition }) =>
      definition.includes("UNIQUE (tenant_id, lineage_id)"))).toBeTrue();
    expect(constraints.some(({ definition }) =>
      definition.includes("UNIQUE (tenant_id, journal_id)"))).toBeTrue();
    expect(constraints.filter(({ definition }) => definition.startsWith("FOREIGN KEY"))
      .every(({ definition }) => definition.startsWith("FOREIGN KEY (tenant_id,"))).toBeTrue();

    const local = await seedGraph();
    const localResult = await post(local);
    if (localResult.state !== "posted") throw new Error("expected local posting fixture");
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => tx`
      INSERT INTO posting_line(
        tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
        amount_minor,quantity,business_date,currency,tax_detail
      )
      SELECT tenant_id,journal_id,99,account_id,folio_id,tx_code,'forged taxed line',
             amount_minor,quantity,business_date,currency,'{}'::jsonb
        FROM posting_line
       WHERE tenant_id=${TENANT_A}::uuid AND journal_id=${localResult.journalId}::uuid AND seq=1
    `)).rejects.toBeTruthy();

    const foreign = await seedGraph({
      tenantId: TENANT_B, propertyNode: PROPERTY_B, actorId: ACTOR_B, partyId: PARTY_B,
      unitTypeId: UNIT_TYPE_B, sellableId: SELLABLE_B, ratePlanId: RATE_PLAN_B,
      extensionId: EXTENSION_B, currency: "USD",
    });
    const foreignResult = await post(foreign);
    if (foreignResult.state !== "posted") throw new Error("expected foreign posting fixture");
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ count: number }>>`SELECT count(*)::int count
        FROM tax_attribution_journal_binding WHERE tenant_id=${TENANT_B}::uuid`);
    expect(visible).toEqual([{ count: 0 }]);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`UPDATE tax_attribution_journal_binding SET posted_at=posted_at
        WHERE tenant_id=${TENANT_A}::uuid`)).rejects.toBeTruthy();
  });

  test("P8: the existing untaxed correction path rejects a taxed journal without effects", async () => {
    const graph = await seedGraph();
    const posted = await post(graph);
    if (posted.state !== "posted") throw new Error("expected taxed journal");
    const correction = new ChargeCorrectionService({
      events: events!, idempotency: new PostgresIdempotency(),
    });
    const before = await counts();
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => correction.reverseCharge(tx, {
      tenantId: TENANT_A,
      folioId: graph.folioId,
      reversesJournalId: posted.journalId,
      reason: "Tax-aware correction is a later governed command",
      postSealAuthorized: false,
      idempotencyKey: "order262-tax-correction-denied",
      envelope: envelope(),
    }))).rejects.toBeTruthy();
    expect(await counts()).toEqual(before);
  });
});
