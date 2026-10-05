import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  TaxAttributionPersistenceConflictError,
  TaxAttributionPersistenceNotFoundError,
  TaxAttributionPersistenceService,
  TaxAttributionPersistenceValidationError,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
  type PositiveTaxAttributionSnapshotV1,
  type RecordTaxAttributionInput,
} from "../src/contexts/tax-fiscal";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_TAX_ATTRIBUTION_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_TAX_ATTRIBUTION === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 244 tax-attribution proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(24401);
const TENANT_B = id(24402);
const PROPERTY_A = id(24411);
const PROPERTY_A_OTHER = id(24412);
const PROPERTY_B = id(24413);
const MISSING_PROPERTY = id(24414);
const ACTOR_A = id(24421);
const ACTOR_A_INACTIVE = id(24422);
const ACTOR_B = id(24423);
const EXTENSION_ID = "11111111-1111-4111-8111-111111111111";
const JURISDICTION_OWNER = "22222222-2222-4222-8222-222222222222";
const CONTENT_HASH = "b".repeat(64);
const ASSIGNMENT_HASHES = ["c".repeat(64), "d".repeat(64)] as const;

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: TaxAttributionPersistenceService | undefined;

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 244 injected evidence failure");
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function snapshotInput(quoteHash = "a".repeat(64)): CreatePositiveTaxAttributionSnapshotInput {
  return {
    origin: { kind: "rate_quote", quoteHash },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: 20_000n,
      nights: 2,
      personNights: 4,
      roomNights: [
        { businessDate: "2026-08-28", amountMinor: 10_000n },
        { businessDate: "2026-08-29", amountMinor: 10_000n },
      ],
    },
    assignments: [
      {
        businessDate: "2026-08-28",
        jurisdictionKey: "in.gst.hotel",
        evidenceRef: `tax-assignment:${ASSIGNMENT_HASHES[0]}`,
      },
      {
        businessDate: "2026-08-29",
        jurisdictionKey: "in.gst.hotel",
        evidenceRef: `tax-assignment:${ASSIGNMENT_HASHES[1]}`,
      },
    ],
    jurisdiction: {
      extensionId: EXTENSION_ID,
      ownerTenantId: JURISDICTION_OWNER,
      key: "in.gst.hotel",
      version: 3,
      contentHash: CONTENT_HASH,
      evidenceRef: `tax-jurisdiction:${"e".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: "in.gst.hotel",
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 20_000n,
      baseTotalMinor: 20_000n,
      taxTotalMinor: 3_600n,
      grandTotalMinor: 23_600n,
      taxes: [{
        code: "GST_ROOM",
        name: "Room GST",
        taxMinor: 3_600n,
        components: [{
          lineId: "room",
          revenueGroup: "room_revenue",
          baseMinor: 20_000n,
          taxMinor: 3_600n,
          rateBasisPoints: 1_800,
        }],
      }],
    },
  };
}

function snapshot(quoteHash = "a".repeat(64)): PositiveTaxAttributionSnapshotV1 {
  return createPositiveTaxAttributionSnapshot(snapshotInput(quoteHash));
}

function envelope(
  requestId = crypto.randomUUID(),
  actorId = ACTOR_A,
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
) {
  return Object.freeze({
    actorId,
    tenantId,
    propertyNode,
    requestId,
    operation: "tax.attribution_recorded" as const,
  });
}

function input(
  value: PositiveTaxAttributionSnapshotV1,
  idempotencyKey: string,
  audit = envelope(),
): RecordTaxAttributionInput {
  return Object.freeze({
    tenantId: audit.tenantId,
    propertyNode: audit.propertyNode,
    snapshot: value,
    idempotencyKey,
    envelope: audit,
  });
}

function expectRecursivelyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child, seen);
}

async function record(value: RecordTaxAttributionInput, target = service!): ReturnType<TaxAttributionPersistenceService["record"]> {
  return database!.withTenantTransaction(value.tenantId, (tx) => target.record(tx, value));
}

async function get(tenantId: string, propertyNode: string, attributionId: string) {
  return database!.withTenantTransaction(tenantId, (tx) => service!.get(tx, {
    tenantId,
    propertyNode,
    attributionId,
  }));
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await deploy`DELETE FROM tax_attribution_snapshot WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM api_idempotency WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM outbox WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM fact_log WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM business_day WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM app_user WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM org_node WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tenant WHERE id=${tenantId}::uuid`;
  }
}

async function expectAppRoleDenied(statement: string): Promise<void> {
  const connection = await directRuntime!.reserve();
  try {
    await connection.unsafe("BEGIN");
    await connection`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
    await connection.unsafe("SET LOCAL ROLE app_role");
    await connection.unsafe("SAVEPOINT hostile_dml");
    try {
      await connection.unsafe(statement);
      throw new Error("expected app-role denial");
    } catch (error) {
      expect(error).toMatchObject({ errno: "42501" });
      await connection.unsafe("ROLLBACK TO SAVEPOINT hostile_dml");
    }
    await connection.unsafe("ROLLBACK");
  } finally {
    connection.release();
  }
}

async function containedFinancialState() {
  return deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT_A}::uuid) reservations,
    (SELECT count(*)::int FROM hold WHERE tenant_id=${TENANT_A}::uuid) holds,
    (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT_A}::uuid) occupancies,
    (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_A}::uuid) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT_A}::uuid) postings,
    (SELECT COALESCE(sum(octet_length(tax_detail::text)),0)::int FROM posting_line
      WHERE tenant_id=${TENANT_A}::uuid) tax_detail_bytes,
    (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT_A}::uuid) documents,
    (SELECT count(*)::int FROM document_series WHERE tenant_id=${TENANT_A}::uuid) series,
    (SELECT COALESCE(sum(next_no),0)::int FROM document_series
      WHERE tenant_id=${TENANT_A}::uuid) series_counter,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT_A}::uuid) submissions
  `;
}

databaseDescribe("Order 244 canonical tax-attribution persistence", () => {
  let containmentBefore: Array<Record<string, number>>;

  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 4, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 32, prepare: false });
    service = new TaxAttributionPersistenceService({
      events: new PostgresEventBus(eventPool),
      idempotency: new PostgresIdempotency(),
    });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order244-a','Order 244 A','shared','active'),
      (${TENANT_B}::uuid,'order244-b','Order 244 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order244a.property'::ltree,'property','Order 244 A','UTC','INR'),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order244a.other'::ltree,'property','Order 244 A Other','UTC','INR'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order244b.property'::ltree,'property','Order 244 B','UTC','INR')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor@order244-a.local','Actor A','active'),
      (${ACTOR_A_INACTIVE}::uuid,${TENANT_A}::uuid,'inactive@order244-a.local','Inactive A','disabled'),
      (${ACTOR_B}::uuid,${TENANT_B}::uuid,'actor@order244-b.local','Actor B','active')`;
    containmentBefore = await containedFinancialState();
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("P1 exposes only tenant-scoped read and the bounded owner-mediated capability", async () => {
    const security = await deploy!<Array<{ rls: boolean; app_select: boolean; app_insert: boolean; app_update: boolean; app_delete: boolean }>>`
      SELECT relrowsecurity AS rls,
             has_table_privilege('app_role','public.tax_attribution_snapshot','SELECT') AS app_select,
             has_table_privilege('app_role','public.tax_attribution_snapshot','INSERT') AS app_insert,
             has_table_privilege('app_role','public.tax_attribution_snapshot','UPDATE') AS app_update,
             has_table_privilege('app_role','public.tax_attribution_snapshot','DELETE') AS app_delete
      FROM pg_class WHERE oid='public.tax_attribution_snapshot'::regclass
    `;
    expect(security).toEqual([{ rls: true, app_select: true, app_insert: false, app_update: false, app_delete: false }]);
    await expectAppRoleDenied(`INSERT INTO public.tax_attribution_snapshot(
      tenant_id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot
    ) VALUES('${TENANT_A}','${PROPERTY_A}','${ACTOR_A}',1,'rate_quote','${"a".repeat(64)}','${"f".repeat(64)}','INR','{}')`);
    await expectAppRoleDenied(`UPDATE public.tax_attribution_snapshot SET currency='USD' WHERE tenant_id='${TENANT_A}'`);
    await expectAppRoleDenied(`DELETE FROM public.tax_attribution_snapshot WHERE tenant_id='${TENANT_A}'`);

    let capabilityDenial: unknown;
    try {
      await directRuntime!`SELECT * FROM public.record_tax_attribution_snapshot(
        ${TENANT_A}::uuid,${PROPERTY_A}::uuid,${ACTOR_A}::uuid,1,'rate_quote',
        ${"a".repeat(64)},${"f".repeat(64)},'INR','{}'::jsonb
      )`;
    } catch (error) {
      capabilityDenial = error;
    }
    expect(capabilityDenial).toMatchObject({ errno: "42501" });
  });

  test("P2 stores and reads exact parsed identity as recursively frozen truth", async () => {
    const canonical = snapshot();
    const receipt = await record(input(canonical, "order244-exact-roundtrip"));
    expect(receipt).toMatchObject({
      propertyNode: PROPERTY_A,
      schemaVersion: 1,
      originKind: "rate_quote",
      originQuoteHash: canonical.origin.quoteHash,
      snapshotHash: canonical.snapshotHash,
      currency: "INR",
      recordedBy: ACTOR_A,
      created: true,
      replayed: false,
    });
    const stored = await get(TENANT_A, PROPERTY_A, receipt.attributionId);
    expect(stored.snapshot).toEqual(canonical);
    expect(JSON.stringify(stored.snapshot)).toBe(JSON.stringify(canonical));
    expect(stored).toMatchObject({
      attributionId: receipt.attributionId,
      propertyNode: PROPERTY_A,
      originQuoteHash: canonical.origin.quoteHash,
      snapshotHash: canonical.snapshotHash,
      recordedBy: ACTOR_A,
      recordedAt: receipt.recordedAt,
    });
    expectRecursivelyFrozen(receipt);
    expectRecursivelyFrozen(stored);

    const evidence = await deploy!<Array<{ roots: number; facts: number; events: number; payload: Record<string, unknown> }>>`SELECT
      (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT_A}::uuid
        AND id=${receipt.attributionId}::uuid AND snapshot=${JSON.stringify(canonical)}::text::jsonb) roots,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
        AND entity_type='tax_attribution_snapshot' AND entity_id=${receipt.attributionId}::uuid
        AND fact_type='tax.attribution_recorded') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
        AND aggregate_id=${receipt.attributionId}::uuid AND aggregate_type='tax_attribution_snapshot'
        AND event_type='tax.attribution_recorded') events,
      (SELECT payload FROM outbox WHERE tenant_id=${TENANT_A}::uuid
        AND aggregate_id=${receipt.attributionId}::uuid AND aggregate_type='tax_attribution_snapshot'
        AND event_type='tax.attribution_recorded' LIMIT 1) payload
    `;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.roots).toBe(1);
    expect(evidence[0]!.facts).toBe(1);
    expect(evidence[0]!.events).toBe(1);
    expect(evidence[0]!.payload).toEqual({
      attribution_id: receipt.attributionId,
      property_node: PROPERTY_A,
      origin_kind: "rate_quote",
      origin_quote_hash: canonical.origin.quoteHash,
      snapshot_hash: canonical.snapshotHash,
      currency: "INR",
    });
    expect(Object.keys(evidence[0]!.payload).sort()).toEqual([
      "attribution_id", "currency", "origin_kind", "origin_quote_hash", "property_node", "snapshot_hash",
    ]);
  });

  test("P3 hostile snapshots and foreign tenant, property or actor authority write nothing", async () => {
    const before = await deploy!<Array<{ roots: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT_A}::uuid) roots,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid) events`;
    const tampered = JSON.parse(JSON.stringify(snapshot("1".repeat(64)))) as PositiveTaxAttributionSnapshotV1;
    (tampered as { currency: string }).currency = "USD";
    await expect(record(input(tampered, "order244-hostile-snapshot")))
      .rejects.toBeInstanceOf(TaxAttributionPersistenceValidationError);
    await expect(record(input(
      snapshot("2".repeat(64)),
      "order244-missing-property",
      envelope(undefined, ACTOR_A, TENANT_A, MISSING_PROPERTY),
    ))).rejects.toBeInstanceOf(TaxAttributionPersistenceNotFoundError);
    await expect(record(input(
      snapshot("3".repeat(64)),
      "order244-inactive-actor",
      envelope(undefined, ACTOR_A_INACTIVE),
    ))).rejects.toBeInstanceOf(TaxAttributionPersistenceNotFoundError);
    await expect(record(input(
      snapshot("4".repeat(64)),
      "order244-foreign-actor",
      envelope(undefined, ACTOR_B),
    ))).rejects.toBeInstanceOf(TaxAttributionPersistenceNotFoundError);
    expect(await deploy!<Array<{ roots: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT_A}::uuid) roots,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid) events`).toEqual(before);

    const tenantBValue = snapshot("5".repeat(64));
    const tenantBReceipt = await record(input(
      tenantBValue,
      "order244-tenant-b-root",
      envelope(undefined, ACTOR_B, TENANT_B, PROPERTY_B),
    ));
    await expect(get(TENANT_A, PROPERTY_A, tenantBReceipt.attributionId))
      .rejects.toBeInstanceOf(TaxAttributionPersistenceNotFoundError);
    await expect(get(TENANT_B, PROPERTY_B, id(24499)))
      .rejects.toBeInstanceOf(TaxAttributionPersistenceNotFoundError);
  });

  test("P4 replay and concurrent different keys converge while changed key reuse conflicts", async () => {
    const canonical = snapshot();
    const replay = await record(input(canonical, "order244-exact-roundtrip"));
    expect(replay).toMatchObject({ created: true, replayed: true });

    const concurrent = snapshot("6".repeat(64));
    const settled = await Promise.all(Array.from({ length: 16 }, (_, index) =>
      record(input(concurrent, `order244-converge-${String(index).padStart(2, "0")}`)),
    ));
    expect(new Set(settled.map(({ attributionId }) => attributionId)).size).toBe(1);
    expect(settled.filter(({ created }) => created)).toHaveLength(1);
    expect(settled.every(({ replayed }) => replayed === false)).toBe(true);
    const cardinality = await deploy!<Array<{ roots: number; facts: number; events: number }>>`SELECT
      (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT_A}::uuid
        AND snapshot_hash=${concurrent.snapshotHash}) roots,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
        AND entity_id=${settled[0]!.attributionId}::uuid AND fact_type='tax.attribution_recorded') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
        AND aggregate_id=${settled[0]!.attributionId}::uuid AND event_type='tax.attribution_recorded') events`;
    expect(cardinality).toEqual([{ roots: 1, facts: 1, events: 1 }]);

    await record(input(snapshot("7".repeat(64)), "order244-changed-reuse"));
    await expect(record(input(snapshot("8".repeat(64)), "order244-changed-reuse")))
      .rejects.toBeInstanceOf(TaxAttributionPersistenceConflictError);
  });

  test("P5 evidence failure rolls back root, fact, event and receipt before exact retry", async () => {
    const failing = new TaxAttributionPersistenceService({
      events: new FailAfterPublishBus(new PostgresEventBus(eventPool!)),
      idempotency: new PostgresIdempotency(),
    });
    const canonical = snapshot("9".repeat(64));
    const command = input(canonical, "order244-rollback-retry");
    const commandKeyHash = new Bun.CryptoHasher("sha256")
      .update(command.idempotencyKey)
      .digest("hex");
    await expect(record(command, failing)).rejects.toThrow("Order 244 injected evidence failure");
    const rolledBack = await deploy!<Array<{ roots: number; facts: number; events: number; receipts: number }>>`SELECT
      (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT_A}::uuid
        AND snapshot_hash=${canonical.snapshotHash}) roots,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
        AND payload->>'snapshot_hash'=${canonical.snapshotHash}) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
        AND payload->>'snapshot_hash'=${canonical.snapshotHash}) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid
        AND operation='tax.attribution_recorded' AND key_hash=${commandKeyHash}
        AND completed_at IS NOT NULL) receipts`;
    expect(rolledBack).toEqual([{ roots: 0, facts: 0, events: 0, receipts: 0 }]);
    expect(await record(command)).toMatchObject({ created: true, replayed: false });
  });

  test("P6 persistence leaves booking, ledger, tax detail, documents and submissions byte-exact", async () => {
    expect(await containedFinancialState()).toEqual(containmentBefore);
  });
});
