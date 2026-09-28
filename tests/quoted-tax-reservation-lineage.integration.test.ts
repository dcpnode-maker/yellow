import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import { HoldService, type PlaceCartHoldInput } from "../src/contexts/inventory";
import { ReservationCommitService } from "../src/contexts/reservations";
import {
  TaxAttributionPersistenceService,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
} from "../src/contexts/tax-fiscal";
import {
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  createAuditEnvelope,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_QUOTED_TAX_RESERVATION_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_QUOTED_TAX_RESERVATION === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 252 quoted-tax reservation proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(25201);
const TENANT_B = id(25202);
const PROPERTY_A = id(25211);
const PROPERTY_A_OTHER = id(25212);
const PROPERTY_B = id(25213);
const ACTOR_A = id(25221);
const ACTOR_B = id(25222);
const PARTY_A = id(25231);
const PARTY_B = id(25232);
const UNIT_TYPE = id(25241);
const SPACE = id(25242);
const SELLABLE = id(25243);
const RATE_PLAN = id(25251);
const EXTENSION_ID = id(25261);
const JURISDICTION_OWNER = id(25262);
const DAY_MS = 86_400_000;

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let holds: HoldService | undefined;
let reservations: ReservationCommitService | undefined;
let attributions: TaxAttributionPersistenceService | undefined;
let containmentBefore: Record<string, number> | undefined;

function stay(offset: number) {
  const from = new Date(Date.UTC(2032, 0, 1 + offset, 15));
  return Object.freeze({ from, to: new Date(from.getTime() + DAY_MS) });
}

function envelope(operation: string, requestId = crypto.randomUUID(), tenantId = TENANT_A, propertyNode = PROPERTY_A) {
  return createAuditEnvelope({ actorId: tenantId === TENANT_A ? ACTOR_A : ACTOR_B,
    tenantId, propertyNode, requestId, operation });
}

async function place(offset: number) {
  const range = stay(offset);
  const input: PlaceCartHoldInput = {
    sellableUnitId: SELLABLE,
    ...range,
    ttlSeconds: 600,
    holder: { client_id: `order252-${offset}` },
    envelope: envelope("hold.created"),
  };
  return database!.withTenantTransaction(TENANT_A, (tx) => holds!.place(tx, input));
}

function commitInput(holdId: string, key: string, requestId = crypto.randomUUID(), adults = 2) {
  return Object.freeze({
    holdId,
    primaryPartyId: PARTY_A,
    ratePlanId: RATE_PLAN,
    adults,
    childAges: Object.freeze([7]),
    channelCode: "direct",
    idempotencyKey: key,
    envelope: envelope("reservation.confirmed", requestId),
  });
}

function serviceFor(bus: EventBus): ReservationCommitService {
  return new ReservationCommitService({
    holds: new HoldService(bus),
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
}

function snapshotInput(offset: number, quoteHash: string): CreatePositiveTaxAttributionSnapshotInput {
  const date = stay(offset).from.toISOString().slice(0, 10);
  return {
    origin: { kind: "rate_quote", quoteHash },
    currency: "INR",
    line: {
      lineId: "room", revenueGroup: "room_revenue", amountMinor: 10_000n,
      nights: 1, personNights: 2,
      roomNights: [{ businessDate: date, amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate: date,
      jurisdictionKey: "ca.test.tax",
      evidenceRef: `tax-assignment:${quoteHash}`,
    }],
    jurisdiction: {
      extensionId: EXTENSION_ID,
      ownerTenantId: JURISDICTION_OWNER,
      key: "ca.test.tax",
      version: 1,
      contentHash: "b".repeat(64),
      evidenceRef: `tax-jurisdiction:${"c".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: "ca.test.tax",
      country: "CA",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: 500n,
      grandTotalMinor: 10_500n,
      taxes: [{
        code: "GST", name: "GST", taxMinor: 500n,
        components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10_000n,
          taxMinor: 500n, rateBasisPoints: 500 }],
      }],
    },
  };
}

async function bind(holdId: string, offset: number) {
  const quoteHash = offset.toString(16).padStart(64, "a").slice(-64);
  const snapshot = createPositiveTaxAttributionSnapshot(snapshotInput(offset, quoteHash));
  const attribution = await database!.withTenantTransaction(TENANT_A, (tx) => attributions!.record(tx, {
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    snapshot,
    idempotencyKey: `order252-attribution-${offset}`,
    envelope: envelope("tax.attribution_recorded"),
  }));
  const rows = await database!.withTenantTransaction(TENANT_A, (tx) => tx<Array<{
    binding_id: string; attribution_id: string; snapshot_hash: string;
  }>>`
    SELECT binding_id, attribution_id, snapshot_hash
    FROM public.record_tax_attribution_hold_binding(
      ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${ACTOR_A}::uuid,
      ${holdId}::uuid, ${attribution.attributionId}::uuid
    )
  `);
  expect(rows).toHaveLength(1);
  return Object.freeze({ attribution, bindingId: rows[0]!.binding_id });
}

async function commitHeld(input: ReturnType<typeof commitInput>, target = reservations!) {
  return database!.withTenantTransaction(TENANT_A, (tx) => target.commitHeld(tx, input));
}

async function containmentCounts(): Promise<Record<string, number>> {
  const rows = await deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM folio WHERE tenant_id=${TENANT_A}::uuid) folios,
    (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_A}::uuid) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT_A}::uuid) postings,
    (SELECT COALESCE(sum(pg_catalog.octet_length(tax_detail::text)),0)::int FROM posting_line
      WHERE tenant_id=${TENANT_A}::uuid) tax_detail_bytes,
    (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT_A}::uuid) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT_A}::uuid) submissions`;
  if (!rows[0]) throw new Error("containment query returned no row");
  return rows[0];
}

async function lineageCount(): Promise<number> {
  return (await deploy!<Array<{ n: number }>>`SELECT count(*)::int n
    FROM tax_attribution_reservation_binding WHERE tenant_id=${TENANT_A}::uuid`)[0]!.n;
}

async function invokeLink(
  tenantId: string, propertyNode: string, actorId: string, holdId: string,
  reservationId: string, segmentId: string,
) {
  return database!.withTenantTransaction(tenantId, (tx) => tx<Array<Record<string, unknown>>>`
    SELECT lineage_id,binding_id,hold_id,attribution_id,reservation_id,segment_id,
           origin_quote_hash,snapshot_hash,currency::text,linked_by,linked_at,created
    FROM public.link_tax_attribution_reservation(
      ${tenantId}::uuid,${propertyNode}::uuid,${actorId}::uuid,
      ${holdId}::uuid,${reservationId}::uuid,${segmentId}::uuid
    )
  `);
}

class FailLineagePublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    const published = await this.delegate.publish(tx, event);
    if (event.eventType === "tax.attribution_reservation_bound") {
      throw new Error("Order 252 injected lineage publication failure");
    }
    return published;
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await deploy`DELETE FROM tax_attribution_reservation_binding WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM reservation_guest WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM space_occupancy WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM reservation_segment WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM reservation WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tax_attribution_hold_binding WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM hold WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tax_attribution_snapshot WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM api_idempotency WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM outbox WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM fact_log WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM sellable_unit_space WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM sellable_unit WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM space WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM unit_type WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM rate_plan WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM party_role WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM party WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM app_user WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM org_node WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tenant WHERE id=${tenantId}::uuid`;
  }
}

test("Order 252 P0: quoted-tax reservation lineage migration exists", async () => {
  expect(await Bun.file("migrations/0041_quoted_tax_reservation_lineage.sql").exists()).toBeTrue();
});

databaseDescribe("Order 252 quoted-tax reservation lineage", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 8, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 24, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 48, prepare: false });
    events = new PostgresEventBus(eventPool);
    holds = new HoldService(events);
    reservations = serviceFor(events);
    attributions = new TaxAttributionPersistenceService({ events, idempotency: new PostgresIdempotency() });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order252-a','Order 252 A','shared','active'),
      (${TENANT_B}::uuid,'order252-b','Order 252 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order252a.property'::ltree,'property','Order 252 A','UTC','INR'),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order252a.other'::ltree,'property','Order 252 Other','UTC','INR'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order252b.property'::ltree,'property','Order 252 B','UTC','INR')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor@order252-a.local','Actor A','active'),
      (${ACTOR_B}::uuid,${TENANT_B}::uuid,'actor@order252-b.local','Actor B','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Order 252 Guest','active'),
      (${PARTY_B}::uuid,${TENANT_B}::uuid,'person','Order 252 Foreign','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
      (${TENANT_A}::uuid,${PARTY_A}::uuid,'guest'),(${TENANT_B}::uuid,${PARTY_B}::uuid,'guest')`;
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES
      (${UNIT_TYPE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O252','Order 252 Room','hotel',4)`;
    await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity) VALUES
      (${SPACE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O252-101','hotel',1)`;
    await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
      (${SELLABLE}::uuid,${TENANT_A}::uuid,${UNIT_TYPE}::uuid,'Order 252 Sellable','active')`;
    await deploy`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
      (${TENANT_A}::uuid,${SELLABLE}::uuid,${SPACE}::uuid,'exclusive')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES
      (${RATE_PLAN}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O252-RATE','Order 252 Rate','INR',false,'active')`;
    containmentBefore = await containmentCounts();
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("P1/P6: append-only RLS root exposes only SELECT and the exact governed capability", async () => {
    const rows = await deploy!<Array<Record<string, unknown>>>`SELECT
      c.relrowsecurity rls,
      has_table_privilege('app_role','public.tax_attribution_reservation_binding','SELECT') app_select,
      has_table_privilege('app_role','public.tax_attribution_reservation_binding','INSERT') app_insert,
      has_table_privilege('app_role','public.tax_attribution_reservation_binding','UPDATE') app_update,
      has_table_privilege('app_role','public.tax_attribution_reservation_binding','DELETE') app_delete,
      p.prosecdef security_definer,p.proconfig config,
      has_function_privilege('app_role','public.link_tax_attribution_reservation(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE') app_execute,
      has_function_privilege('yellow_runtime','public.link_tax_attribution_reservation(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE') runtime_execute
    FROM pg_class c CROSS JOIN pg_proc p
    WHERE c.oid='public.tax_attribution_reservation_binding'::regclass
      AND p.oid='public.link_tax_attribution_reservation(uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure`;
    expect(rows).toEqual([{ rls: true, app_select: true, app_insert: false, app_update: false,
      app_delete: false, security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"], app_execute: true, runtime_execute: false }]);
  });

  test("P1: ordinary unquoted held and direct commits retain exact public shape with zero lineage", async () => {
    const unquoted = await place(0);
    const held = await commitHeld(commitInput(unquoted.id, "order252-unquoted-held"));
    expect(Object.keys(held)).toEqual(["reservationId","confirmationNo","segmentId","status","propertyNode",
      "primaryPartyId","sellableUnitId","unitTypeId","ratePlanId","from","to","adults","childAges",
      "channelCode","currency","guaranteePolicyId","claimCount","source","holdId","replayed"]);
    const directRange = stay(3);
    const direct = await database!.withTenantTransaction(TENANT_A, (tx) => reservations!.commitDirect(tx, {
      sellableUnitId: SELLABLE, ...directRange, primaryPartyId: PARTY_A, ratePlanId: RATE_PLAN,
      adults: 1, childAges: [], channelCode: "direct", idempotencyKey: "order252-unquoted-direct",
      envelope: envelope("reservation.confirmed"),
    }));
    expect(direct.source).toBe("direct");
    expect(JSON.stringify([held, direct])).not.toMatch(/lineage|attribution|snapshot|quote/i);
    expect(await lineageCount()).toBe(0);
  }, 30_000);

  test("P2: consumed quoted hold appends exactly one immutable lineage edge and minimized fact/outbox", async () => {
    const quoted = await place(10);
    const binding = await bind(quoted.id, 10);
    const request = commitInput(quoted.id, "order252-quoted-success");
    const created = await commitHeld(request);
    expect(created).toMatchObject({ source: "hold", holdId: quoted.id, currency: "INR", replayed: false });
    expect(JSON.stringify(created)).not.toMatch(/lineage|attribution|snapshot|quote/i);
    const rows = await deploy!<Array<Record<string, unknown>>>`SELECT
      lineage.id lineage_id,lineage.binding_id,lineage.hold_id,lineage.attribution_id,
      lineage.reservation_id,lineage.segment_id,lineage.origin_quote_hash,lineage.snapshot_hash,
      lineage.currency::text,lineage.linked_by,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
        AND entity_type='tax_attribution_reservation_binding' AND entity_id=lineage.id
        AND fact_type='tax.attribution_reservation_bound') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
        AND aggregate_type='tax_attribution_reservation_binding' AND aggregate_id=lineage.id
        AND event_type='tax.attribution_reservation_bound') events
    FROM tax_attribution_reservation_binding lineage
    WHERE lineage.tenant_id=${TENANT_A}::uuid AND lineage.reservation_id=${created.reservationId}::uuid`;
    expect(rows).toEqual([expect.objectContaining({
      lineage_id: expect.any(String), binding_id: binding.bindingId, hold_id: quoted.id,
      attribution_id: binding.attribution.attributionId, reservation_id: created.reservationId,
      segment_id: created.segmentId, currency: "INR", linked_by: ACTOR_A, facts: 1, events: 1,
      origin_quote_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      snapshot_hash: binding.attribution.snapshotHash,
    })]);
    const payloads = await deploy!<Array<{ payload: Record<string, unknown> }>>`SELECT payload FROM outbox
      WHERE tenant_id=${TENANT_A}::uuid AND event_type='tax.attribution_reservation_bound'
        AND aggregate_id=${String(rows[0]!.lineage_id)}::uuid`;
    expect(Object.keys(payloads[0]!.payload).sort()).toEqual([
      "attribution_id","binding_id","currency","hold_id","lineage_id","origin_quote_hash",
      "reservation_id","segment_id","snapshot_hash",
    ]);
  }, 30_000);

  test("P3/P4: exact replay converges while divergent and foreign authority fail concealed", async () => {
    const quoted = await place(20);
    await bind(quoted.id, 20);
    const request = commitInput(quoted.id, "order252-replay");
    const first = await commitHeld(request);
    const before = await lineageCount();
    expect(await commitHeld({ ...request, envelope: envelope("reservation.confirmed") })).toEqual({ ...first, replayed: true });
    await expect(commitHeld(commitInput(quoted.id, "order252-replay", crypto.randomUUID(), 3)))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
    const exact = await invokeLink(TENANT_A, PROPERTY_A, ACTOR_A, quoted.id, first.reservationId, first.segmentId);
    expect(exact).toHaveLength(1);
    expect(exact[0]).toMatchObject({ reservation_id: first.reservationId, segment_id: first.segmentId, created: false });
    await expect(invokeLink(TENANT_A, PROPERTY_A_OTHER, ACTOR_A, quoted.id, first.reservationId, first.segmentId))
      .rejects.toMatchObject({ errno: expect.stringMatching(/23505|55000/) });
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => tx`
      SELECT * FROM public.link_tax_attribution_reservation(
        ${TENANT_A}::uuid,${PROPERTY_A}::uuid,${ACTOR_A}::uuid,${quoted.id}::uuid,
        ${first.reservationId}::uuid,${first.segmentId}::uuid)`))
      .rejects.toMatchObject({ errno: "42501" });
    expect(await lineageCount()).toBe(before);
  }, 30_000);

  test("P5: failure after lineage outbox insertion rolls back reservation, occupancy transfer, lineage and evidence", async () => {
    const quoted = await place(30);
    await bind(quoted.id, 30);
    const before = await deploy!<Array<Record<string, unknown>>>`SELECT
      (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT_A}::uuid) reservations,
      (SELECT count(*)::int FROM reservation_segment WHERE tenant_id=${TENANT_A}::uuid) segments,
      (SELECT count(*)::int FROM tax_attribution_reservation_binding WHERE tenant_id=${TENANT_A}::uuid) lineages,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid AND fact_type='tax.attribution_reservation_bound') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid AND event_type='tax.attribution_reservation_bound') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid AND operation='reservation.commit') keys,
      (SELECT status FROM hold WHERE tenant_id=${TENANT_A}::uuid AND id=${quoted.id}::uuid) hold_status,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT_A}::uuid AND slot_ref=${quoted.id}::uuid) hold_claims`;
    const request = commitInput(quoted.id, "order252-rollback");
    await expect(commitHeld(request, serviceFor(new FailLineagePublishBus(events!))))
      .rejects.toThrow("Order 252 injected lineage publication failure");
    const after = await deploy!<Array<Record<string, unknown>>>`SELECT
      (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT_A}::uuid) reservations,
      (SELECT count(*)::int FROM reservation_segment WHERE tenant_id=${TENANT_A}::uuid) segments,
      (SELECT count(*)::int FROM tax_attribution_reservation_binding WHERE tenant_id=${TENANT_A}::uuid) lineages,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid AND fact_type='tax.attribution_reservation_bound') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid AND event_type='tax.attribution_reservation_bound') events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid AND operation='reservation.commit') keys,
      (SELECT status FROM hold WHERE tenant_id=${TENANT_A}::uuid AND id=${quoted.id}::uuid) hold_status,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT_A}::uuid AND slot_ref=${quoted.id}::uuid) hold_claims`;
    expect(after).toEqual(before);
    expect(await commitHeld(request)).toMatchObject({ holdId: quoted.id, replayed: false });
  }, 30_000);

  test("P7: lineage work creates no folio, financial, tax-detail, document or fiscal artifacts", async () => {
    expect(await containmentCounts()).toEqual(containmentBefore!);
  });
});
