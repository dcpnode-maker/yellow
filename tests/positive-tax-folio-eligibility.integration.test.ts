import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  PositiveTaxFolioEligibilityConflictError,
  PositiveTaxFolioEligibilityNotFoundError,
  PositiveTaxFolioEligibilityService,
  PositiveTaxFolioEligibilityValidationError,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
} from "../src/contexts/tax-fiscal";
import { Database } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_POSITIVE_TAX_FOLIO_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_POSITIVE_TAX_FOLIO === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 256 positive-tax folio proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(25601);
const TENANT_B = id(25602);
const PROPERTY_A = id(25611);
const PROPERTY_A_OTHER = id(25612);
const PROPERTY_B = id(25613);
const ACTOR_A = id(25621);
const ACTOR_B = id(25622);
const PARTY_A = id(25631);
const PARTY_A_OTHER = id(25632);
const PARTY_B = id(25633);
const UNIT_TYPE_A = id(25641);
const UNIT_TYPE_B = id(25642);
const SELLABLE_A = id(25651);
const SELLABLE_B = id(25652);
const RATE_PLAN_A = id(25661);
const RATE_PLAN_B = id(25662);
const EXTENSION_ID = id(25671);
const JURISDICTION_OWNER = id(25672);
const DAY_MS = 86_400_000;

type AccountRole = "guest" | "revenue";
type AccountStatus = "open" | "frozen" | "closed";
type FolioStatus = "open" | "settled" | "closed";

interface ContextFixture {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly partyId: string;
  readonly unitTypeId: string;
  readonly sellableId: string;
  readonly ratePlanId: string;
  readonly currency: string;
}

interface GraphOptions {
  readonly context?: ContextFixture;
  readonly primary?: boolean;
  readonly additionalOnly?: boolean;
  readonly accountRole?: AccountRole;
  readonly accountStatus?: AccountStatus;
  readonly accountPartyId?: string;
  readonly accountCurrency?: string;
  readonly folioStatus?: FolioStatus;
  readonly tamperSnapshot?: boolean;
  readonly divergentFirstSegment?: boolean;
}

interface GraphFixture {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly lineageId: string;
  readonly bindingId: string;
  readonly attributionId: string;
  readonly folioId?: string;
  readonly accountId?: string;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly snapshot: ReturnType<typeof createPositiveTaxAttributionSnapshot>;
}

const CONTEXT_A: ContextFixture = Object.freeze({
  tenantId: TENANT_A, propertyNode: PROPERTY_A, actorId: ACTOR_A, partyId: PARTY_A,
  unitTypeId: UNIT_TYPE_A, sellableId: SELLABLE_A, ratePlanId: RATE_PLAN_A, currency: "INR",
});
const CONTEXT_B: ContextFixture = Object.freeze({
  tenantId: TENANT_B, propertyNode: PROPERTY_B, actorId: ACTOR_B, partyId: PARTY_B,
  unitTypeId: UNIT_TYPE_B, sellableId: SELLABLE_B, ratePlanId: RATE_PLAN_B, currency: "CAD",
});

let deploy: SQL | undefined;
let database: Database | undefined;
let service: PositiveTaxFolioEligibilityService | undefined;
let sequence = 0;

function snapshotInput(day: number, quoteHash: string, currency: string): CreatePositiveTaxAttributionSnapshotInput {
  const businessDate = new Date(Date.UTC(2034, 0, day)).toISOString().slice(0, 10);
  return {
    origin: { kind: "rate_quote", quoteHash },
    currency,
    line: {
      lineId: "room", revenueGroup: "room_revenue", amountMinor: 10_000n,
      nights: 1, personNights: 2,
      roomNights: [{ businessDate, amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate, jurisdictionKey: "ca.test.tax", evidenceRef: `tax-assignment:${quoteHash}`,
    }],
    jurisdiction: {
      extensionId: EXTENSION_ID, ownerTenantId: JURISDICTION_OWNER,
      key: "ca.test.tax", version: 1, contentHash: "b".repeat(64),
      evidenceRef: `tax-jurisdiction:${"c".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1, jurisdictionKey: "ca.test.tax", country: "CA",
      priceDisplay: "tax_exclusive", rounding: "line",
      inputTotalMinor: 10_000n, baseTotalMinor: 10_000n,
      taxTotalMinor: 500n, grandTotalMinor: 10_500n,
      taxes: [{
        code: "GST", name: "GST", taxMinor: 500n,
        components: [{
          lineId: "room", revenueGroup: "room_revenue", baseMinor: 10_000n,
          taxMinor: 500n, rateBasisPoints: 500,
        }],
      }],
    },
  };
}

async function seedGraph(options: GraphOptions = {}): Promise<GraphFixture> {
  const context = options.context ?? CONTEXT_A;
  const n = ++sequence;
  const reservationId = crypto.randomUUID();
  const firstSegmentId = crypto.randomUUID();
  const segmentId = options.divergentFirstSegment ? crypto.randomUUID() : firstSegmentId;
  const holdId = crypto.randomUUID();
  const attributionId = crypto.randomUUID();
  const bindingId = crypto.randomUUID();
  const lineageId = crypto.randomUUID();
  const accountId = options.primary === false ? undefined : crypto.randomUUID();
  const folioId = options.primary === false ? undefined : crypto.randomUUID();
  const quoteHash = n.toString(16).padStart(64, "a").slice(-64);
  const snapshot = createPositiveTaxAttributionSnapshot(snapshotInput(n, quoteHash, context.currency));
  const periodFrom = new Date(Date.UTC(2034, 0, n, 15));
  const periodTo = new Date(periodFrom.getTime() + DAY_MS);
  const period = `[${periodFrom.toISOString()},${periodTo.toISOString()})`;
  const storedSnapshot = options.tamperSnapshot
    ? { ...snapshot, evaluation: { ...snapshot.evaluation, grandTotalMinor: "10501" } }
    : snapshot;

  await deploy!`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES (
      ${reservationId}::uuid,${context.tenantId}::uuid,${context.propertyNode}::uuid,
      ${`O256-${context.tenantId}-${n}`},'checked_out',${context.partyId}::uuid,'direct',${context.currency}::char(3)
    )`;
  await deploy!`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status
    ) VALUES (
      ${firstSegmentId}::uuid,${context.tenantId}::uuid,${reservationId}::uuid,1,
      ${context.unitTypeId}::uuid,${context.sellableId}::uuid,${period}::tstzrange,2,'[]'::jsonb,
      ${context.ratePlanId}::uuid,'booked'
    )`;
  if (options.divergentFirstSegment) {
    await deploy!`INSERT INTO reservation_segment(
        id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status
      ) VALUES (
        ${segmentId}::uuid,${context.tenantId}::uuid,${reservationId}::uuid,2,
        ${context.unitTypeId}::uuid,${context.sellableId}::uuid,${period}::tstzrange,2,'[]'::jsonb,
        ${context.ratePlanId}::uuid,'booked'
      )`;
  }
  await deploy!`INSERT INTO hold(
      id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status
    ) VALUES (
      ${holdId}::uuid,${context.tenantId}::uuid,${context.propertyNode}::uuid,
      ${context.sellableId}::uuid,${period}::tstzrange,'cart','{}'::jsonb,
      ${periodTo.toISOString()}::timestamptz,'consumed'
    )`;
  await deploy!`INSERT INTO tax_attribution_snapshot(
      tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,
      snapshot_hash,currency,snapshot
    ) VALUES (
      ${context.tenantId}::uuid,${attributionId}::uuid,${context.propertyNode}::uuid,
      ${context.actorId}::uuid,1,'rate_quote',${quoteHash},${snapshot.snapshotHash},
      ${context.currency}::char(3),${JSON.stringify(storedSnapshot)}::jsonb
    )`;
  await deploy!`INSERT INTO tax_attribution_hold_binding(
      tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,
      origin_quote_hash,snapshot_hash,currency
    ) VALUES (
      ${context.tenantId}::uuid,${bindingId}::uuid,${context.propertyNode}::uuid,
      ${context.actorId}::uuid,${holdId}::uuid,${attributionId}::uuid,${context.sellableId}::uuid,
      ${period}::tstzrange,${quoteHash},${snapshot.snapshotHash},${context.currency}::char(3)
    )`;
  await deploy!`INSERT INTO tax_attribution_reservation_binding(
      tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,
      segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency
    ) VALUES (
      ${context.tenantId}::uuid,${lineageId}::uuid,${context.propertyNode}::uuid,
      ${context.actorId}::uuid,${bindingId}::uuid,${holdId}::uuid,${attributionId}::uuid,
      ${reservationId}::uuid,${segmentId}::uuid,${context.sellableId}::uuid,${period}::tstzrange,
      ${quoteHash},${snapshot.snapshotHash},${context.currency}::char(3)
    )`;

  if (accountId && folioId) {
    await deploy!`INSERT INTO account(
        id,tenant_id,property_node,role,party_id,name,currency,status
      ) VALUES (
        ${accountId}::uuid,${context.tenantId}::uuid,${context.propertyNode}::uuid,
        ${options.accountRole ?? "guest"},${options.accountPartyId ?? context.partyId}::uuid,
        ${`Order 256 Guest ${n}`},${options.accountCurrency ?? context.currency}::char(3),
        ${options.accountStatus ?? "open"}
      )`;
    await deploy!`INSERT INTO folio(
        id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
      ) VALUES (
        ${folioId}::uuid,${context.tenantId}::uuid,${accountId}::uuid,${reservationId}::uuid,
        ${`O256-F-${context.tenantId}-${n}`},${options.additionalOnly ? 2 : 1},'Primary',
        ${options.folioStatus ?? "open"}
      )`;
  }

  return Object.freeze({
    tenantId: context.tenantId, propertyNode: context.propertyNode, reservationId,
    segmentId, lineageId, bindingId, attributionId, folioId, accountId,
    quoteHash, snapshotHash: snapshot.snapshotHash, currency: context.currency, snapshot,
  });
}

function resolve(graph: GraphFixture, overrides: Partial<{
  tenantId: string; propertyNode: string; reservationId: string;
}> = {}, transactionTenant = overrides.tenantId ?? graph.tenantId) {
  return database!.withTenantTransaction(transactionTenant, (tx) => service!.resolve(tx, {
    tenantId: overrides.tenantId ?? graph.tenantId,
    propertyNode: overrides.propertyNode ?? graph.propertyNode,
    reservationId: overrides.reservationId ?? graph.reservationId,
  }));
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

async function artifactCounts(): Promise<Record<string, number>> {
  const rows = await deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) accounts,
    (SELECT count(*)::int FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) folios,
    (SELECT count(*)::int FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) idempotency,
    (SELECT count(*)::int FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions`;
  return rows[0]!;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_reservation_binding WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation_guest WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation_segment WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_hold_binding WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM hold WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_snapshot WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM sellable_unit WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM unit_type WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM rate_plan WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM app_user WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 256 P0: the exact primary-folio eligibility export exists", () => {
  expect(typeof PositiveTaxFolioEligibilityService).toBe("function");
});

databaseDescribe("Order 256 authoritative positive-tax primary-folio eligibility", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 32, prepare: false });
    service = new PositiveTaxFolioEligibilityService();
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order256-a','Order 256 A','shared','active'),
      (${TENANT_B}::uuid,'order256-b','Order 256 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order256a.property'::ltree,'property','Order 256 A','UTC','INR'),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order256a.other'::ltree,'property','Order 256 Other','UTC','INR'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order256b.property'::ltree,'property','Order 256 B','UTC','CAD')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor@order256-a.local','Actor A','active'),
      (${ACTOR_B}::uuid,${TENANT_B}::uuid,'actor@order256-b.local','Actor B','active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Order 256 Guest','active'),
      (${PARTY_A_OTHER}::uuid,${TENANT_A}::uuid,'person','Order 256 Other Guest','active'),
      (${PARTY_B}::uuid,${TENANT_B}::uuid,'person','Order 256 Foreign Guest','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
      (${TENANT_A}::uuid,${PARTY_A}::uuid,'guest'),
      (${TENANT_A}::uuid,${PARTY_A_OTHER}::uuid,'guest'),
      (${TENANT_B}::uuid,${PARTY_B}::uuid,'guest')`;
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES
      (${UNIT_TYPE_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O256A','Order 256 A Room','hotel',4),
      (${UNIT_TYPE_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O256B','Order 256 B Room','hotel',4)`;
    await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
      (${SELLABLE_A}::uuid,${TENANT_A}::uuid,${UNIT_TYPE_A}::uuid,'Order 256 A Sellable','active'),
      (${SELLABLE_B}::uuid,${TENANT_B}::uuid,${UNIT_TYPE_B}::uuid,'Order 256 B Sellable','active')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES
      (${RATE_PLAN_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O256-A','Order 256 A Rate','INR',false,'active'),
      (${RATE_PLAN_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O256-B','Order 256 B Rate','CAD',false,'active')`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P1/P2: exact lineage resolves only open window 1 and returns fresh deeply frozen evidence", async () => {
    const graph = await seedGraph();
    const result = await resolve(graph);
    expect(result).toEqual({
      lineageId: graph.lineageId, bindingId: graph.bindingId,
      attributionId: graph.attributionId, reservationId: graph.reservationId,
      segmentId: graph.segmentId, folioId: graph.folioId!,
      guestAccountId: graph.accountId!, propertyNode: graph.propertyNode,
      quoteHash: graph.quoteHash, snapshotHash: graph.snapshotHash,
      currency: graph.currency, snapshot: graph.snapshot,
    });
    expect(result.snapshot).not.toBe(graph.snapshot);
    expectDeepFrozen(result);
  });

  test("P3: absent primary and additional-only roots are not found; settled/closed or ineligible accounts conflict", async () => {
    const absent = await seedGraph({ primary: false });
    await expect(resolve(absent)).rejects.toBeInstanceOf(PositiveTaxFolioEligibilityNotFoundError);
    const additional = await seedGraph({ additionalOnly: true });
    await expect(resolve(additional)).rejects.toBeInstanceOf(PositiveTaxFolioEligibilityNotFoundError);

    for (const graph of [
      await seedGraph({ folioStatus: "settled" }),
      await seedGraph({ folioStatus: "closed" }),
      await seedGraph({ accountStatus: "frozen" }),
      await seedGraph({ accountStatus: "closed" }),
      await seedGraph({ accountRole: "revenue" }),
      await seedGraph({ accountPartyId: PARTY_A_OTHER }),
    ]) {
      await expect(resolve(graph)).rejects.toBeInstanceOf(PositiveTaxFolioEligibilityConflictError);
    }
  }, 30_000);

  test("P4: hostile input, foreign authority, divergent first segment and tampered snapshot fail closed", async () => {
    const valid = await seedGraph();
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.resolve(tx, {
      tenantId: TENANT_A, propertyNode: PROPERTY_A, reservationId: "not-a-uuid",
    }))).rejects.toBeInstanceOf(PositiveTaxFolioEligibilityValidationError);
    const hostile = Object.create({ tenantId: TENANT_A });
    Object.assign(hostile, { propertyNode: PROPERTY_A, reservationId: valid.reservationId });
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => service!.resolve(tx, hostile)))
      .rejects.toBeInstanceOf(PositiveTaxFolioEligibilityValidationError);

    await expect(resolve(valid, { propertyNode: PROPERTY_A_OTHER }))
      .rejects.toBeInstanceOf(PositiveTaxFolioEligibilityNotFoundError);
    const foreign = await seedGraph({ context: CONTEXT_B });
    await expect(resolve(valid, { reservationId: foreign.reservationId }))
      .rejects.toBeInstanceOf(PositiveTaxFolioEligibilityNotFoundError);
    const divergent = await seedGraph({ divergentFirstSegment: true });
    await expect(resolve(divergent)).rejects.toBeInstanceOf(PositiveTaxFolioEligibilityConflictError);
    const tampered = await seedGraph({ tamperSnapshot: true });
    await expect(resolve(tampered)).rejects.toBeInstanceOf(PositiveTaxFolioEligibilityConflictError);
  }, 30_000);

  test("P5: financial row lock serializes mutation and post-lock re-read rejects changed account truth", async () => {
    const held = await seedGraph();
    let markResolved!: () => void;
    let releaseResolver!: () => void;
    const resolved = new Promise<void>((resolveReady) => { markResolved = resolveReady; });
    const release = new Promise<void>((resolveRelease) => { releaseResolver = resolveRelease; });
    const resolving = database!.withTenantTransaction(TENANT_A, async (tx) => {
      const receipt = await service!.resolve(tx, {
        tenantId: TENANT_A, propertyNode: PROPERTY_A, reservationId: held.reservationId,
      });
      markResolved();
      await release;
      return receipt;
    });
    await resolved;
    let mutationFinished = false;
    const mutation = deploy!`UPDATE account SET status='frozen'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${held.accountId!}::uuid`
      .then(() => { mutationFinished = true; });
    await Bun.sleep(100);
    expect(mutationFinished).toBeFalse();
    releaseResolver();
    expect((await resolving).folioId).toBe(held.folioId!);
    await mutation;

    const raced = await seedGraph();
    let markLocked!: () => void;
    let releaseMutation!: () => void;
    const mutationLocked = new Promise<void>((resolveReady) => { markLocked = resolveReady; });
    const mutationRelease = new Promise<void>((resolveRelease) => { releaseMutation = resolveRelease; });
    const blocker = deploy!.begin(async (sql) => {
      await sql`SELECT id FROM account WHERE tenant_id=${TENANT_A}::uuid
        AND id=${raced.accountId!}::uuid FOR UPDATE`;
      markLocked();
      await mutationRelease;
      await sql`UPDATE account SET status='frozen' WHERE tenant_id=${TENANT_A}::uuid
        AND id=${raced.accountId!}::uuid`;
    });
    await mutationLocked;
    const racedResolve = resolve(raced);
    await Bun.sleep(100);
    releaseMutation();
    await blocker;
    await expect(racedResolve).rejects.toBeInstanceOf(PositiveTaxFolioEligibilityConflictError);
  }, 30_000);

  test("P6: resolver adds no schema authority or financial, audit, idempotency, document or fiscal effects", async () => {
    const graph = await seedGraph();
    const before = await artifactCounts();
    await resolve(graph);
    expect(await artifactCounts()).toEqual(before);
    const acl = await deploy!<Array<Record<string, boolean>>>`SELECT
      has_table_privilege('app_role','public.tax_attribution_reservation_binding','SELECT') lineage_select,
      has_table_privilege('app_role','public.tax_attribution_reservation_binding','INSERT') lineage_insert,
      has_table_privilege('app_role','public.folio','SELECT') folio_select,
      has_table_privilege('app_role','public.folio','UPDATE') folio_update,
      has_table_privilege('app_role','public.account','SELECT') account_select,
      has_table_privilege('app_role','public.account','UPDATE') account_update,
      has_function_privilege('app_role','public.lock_financial_rows(uuid,uuid[],uuid)','EXECUTE') lock_execute`;
    expect(acl).toEqual([{
      lineage_select: true, lineage_insert: false, folio_select: true, folio_update: false,
      account_select: true, account_update: false, lock_execute: true,
    }]);
  });
});
