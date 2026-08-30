import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import { HoldService } from "../src/contexts/inventory";
import {
  RateQuoteService,
  deriveRateEvaluationContext,
  evaluateRateModel,
  normalizeRateCompositionSpec,
  normalizeRateEvaluatorSpec,
  type ResolveRateQuoteInput,
} from "../src/contexts/rates";
import {
  QuotedTaxHoldBindingService,
  TaxAttributionPersistenceService,
  type TaxJurisdictionResolutionResult,
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
const RUNTIME_URL = process.env.YELLOW_QUOTED_TAX_HOLD_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_QUOTED_TAX_HOLD === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 248 quoted-tax hold proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(24801);
const TENANT_B = id(24802);
const PROPERTY_A = id(24811);
const PROPERTY_A_OTHER = id(24812);
const PROPERTY_B = id(24813);
const ACTOR_A = id(24821);
const ACTOR_B = id(24822);
const UNIT_TYPE = id(24831);
const SPACE = id(24832);
const SELLABLE = id(24833);
const RATE_PLAN = id(24841);
const RELEASE = id(24842);
const MODEL = id(24843);
const TARGET = id(24844);
const EXTENSION = id(24845);
const DAY_MS = 86_400_000;

const TAX_CONTENT = Object.freeze({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "line",
  taxes: Object.freeze([Object.freeze({
    code: "GST_ROOM",
    name: "GST on accommodation",
    mode: "percent",
    rate: 0.18,
    applies_to: Object.freeze(["room_revenue"]),
  })]),
});

type QuoteMode = "valid" | "unbookable" | "partial_tax" | "wrong_property" | "wrong_sellable";

let deploy: SQL | undefined;
let directRuntime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let holds: HoldService | undefined;
let attributions: TaxAttributionPersistenceService | undefined;
let service: QuotedTaxHoldBindingService | undefined;
let quoteMode: QuoteMode = "valid";
let quoteCalls = 0;
let containmentBefore: Record<string, number> | undefined;

function dateAt(index: number): string {
  return new Date(Date.UTC(2027, 0, 10) + index * DAY_MS).toISOString().slice(0, 10);
}

function quoteInput(offset = 0): ResolveRateQuoteInput {
  const start = new Date(Date.UTC(2027, 0, 10 + offset, 15));
  return Object.freeze({
    propertyNode: PROPERTY_A,
    ratePlanId: RATE_PLAN,
    sellableUnitId: SELLABLE,
    stayStart: start,
    stayEnd: new Date(start.getTime() + DAY_MS),
    guests: Object.freeze({ adults: 2, childAges: Object.freeze([]) }),
    selectedPromotionCodes: Object.freeze([]),
    commercial: Object.freeze({}),
    channelCode: "direct",
  });
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
    operation: "tax.attribution_bound" as const,
  });
}

function command(offset: number, idempotencyKey: string, audit = envelope()) {
  return Object.freeze({
    tenantId: audit.tenantId,
    propertyNode: audit.propertyNode,
    quote: quoteInput(offset),
    ttlSeconds: 600,
    idempotencyKey,
    envelope: audit,
  });
}

function releaseSpec() {
  const evaluatorSpec = normalizeRateEvaluatorSpec({
    modelKey: "calendar",
    currency: "INR",
    base: {
      kind: "calendar",
      cells: Array.from({ length: 40 }, (_, index) => ({
        stayDate: dateAt(index),
        state: "open",
        amountMinor: 100_000n + BigInt(index),
      })),
    },
    gate: {},
    rules: [],
  });
  const compositionSpec = normalizeRateCompositionSpec({
    currency: "INR",
    guestEligibility: {
      minAdults: 1,
      maxAdults: 6,
      minChildren: 0,
      maxChildren: 4,
      minTotalGuests: 1,
      maxTotalGuests: 8,
    },
    package: null,
    promotions: [],
    policy: {
      cancellationPolicyId: null,
      depositPolicyId: null,
      guaranteePolicyId: null,
      noShowPolicyId: null,
      refundTreatment: "policy",
    },
    distribution: { mode: "all", channelCodes: [] },
  });
  return Object.freeze({
    id: RELEASE,
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    ratePlanId: RATE_PLAN,
    modelDraftId: MODEL,
    modelDraftVersion: 1,
    targetDraftId: TARGET,
    targetDraftVersion: 1,
    evaluatorSpec,
    compositionSpec,
    rmsBinding: null,
    contentHash: "b".repeat(64),
    extensionVersion: 1,
    status: "active",
    undoOfVersion: null,
  });
}

function quoteHarness() {
  const release = releaseSpec();
  const publication = {
    async getActiveRelease() { return release; },
    async evaluateReleaseNight(_tx: Tx, _releaseId: string, input: Readonly<Record<string, unknown>>) {
      const evaluationContext = deriveRateEvaluationContext({
        propertyTimeZone: input.propertyTimeZone,
        bookingInstant: input.bookingInstant,
        stayStartInstant: input.stayStartInstant,
        stayEndInstant: input.stayEndInstant,
        nightDate: input.nightDate,
      });
      return Object.freeze({
        release,
        targetResolution: null,
        evaluationContext,
        result: evaluateRateModel(release.evaluatorSpec, evaluationContext),
      });
    },
  };
  const availability = {
    async search() {
      const bookable = quoteMode !== "unbookable";
      return [Object.freeze({
        sellableUnitId: SELLABLE,
        sellableUnitName: "Order 248 Room",
        unitTypeId: UNIT_TYPE,
        unitTypeCode: "ROOM",
        unitTypeName: "Room",
        profileKey: "hotel",
        maxOccupancy: 4,
        availableCount: bookable ? 1 : 0,
        bookable,
        restrictionsApplied: Object.freeze([]),
        operationalBlocksApplied: Object.freeze([]),
      })];
    },
  };
  const resolver = {
    async resolve(_tx: Tx, input: Readonly<{ propertyNode: string; businessDate: string }>): Promise<TaxJurisdictionResolutionResult> {
      if (quoteMode === "partial_tax") {
        return Object.freeze({
          state: "unassigned",
          tenantId: TENANT_A,
          propertyNode: PROPERTY_A,
          businessDate: input.businessDate,
        });
      }
      return Object.freeze({
        state: "resolved",
        tenantId: TENANT_A,
        propertyNode: PROPERTY_A,
        businessDate: input.businessDate,
        assignment: Object.freeze({
          jurisdictionKey: "in.gst.hotel",
          effectiveFrom: "2030-01-01",
          effectiveTo: null,
          evidenceRef: `tax-assignment:${new Bun.CryptoHasher("sha256").update(input.businessDate).digest("hex")}`,
        }),
        jurisdiction: Object.freeze({
          extensionId: EXTENSION,
          ownerTenantId: TENANT_A,
          key: "in.gst.hotel",
          version: 1,
          content: TAX_CONTENT,
          contentHash: "c".repeat(64),
          effectiveFromInstant: "2030-01-01T00:00:00.000000Z",
          effectiveToInstant: null,
          evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
        }),
      });
    },
  };
  const actual = new RateQuoteService(
    publication as never,
    resolver as never,
    availability as never,
    { async occupancySignal() { return null; } } as never,
  );
  return Object.freeze({
    async resolve(tx: Tx, input: ResolveRateQuoteInput) {
      quoteCalls += 1;
      const result = await actual.resolve(tx, input);
      if (quoteMode === "wrong_property") return Object.freeze({ ...result, propertyNode: PROPERTY_A_OTHER });
      if (quoteMode === "wrong_sellable") return Object.freeze({ ...result, sellableUnitId: id(24899) });
      return result;
    },
  });
}

function createService(bus: EventBus = events!) {
  const holdService = new HoldService(bus);
  const attributionService = new TaxAttributionPersistenceService({
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
  return new QuotedTaxHoldBindingService({
    quotes: quoteHarness(),
    holds: holdService,
    attributions: attributionService,
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
}

class FailBoundEventBus implements EventBus {
  constructor(readonly delegate: EventBus) {}

  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    const published = await this.delegate.publish(tx, event);
    if (event.eventType === "tax.attribution_bound") {
      throw new Error("Order 248 injected bound-event failure");
    }
    return published;
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

async function place(value: ReturnType<typeof command>, target = service!) {
  return database!.withTenantTransaction(value.tenantId, (tx) => target.place(tx, value));
}

async function appRoleDenied(statement: string): Promise<void> {
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

async function artifactCounts(offset: number) {
  const input = quoteInput(offset);
  return deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM hold WHERE tenant_id=${TENANT_A}::uuid
      AND period=tstzrange(${input.stayStart.toISOString()}::timestamptz,${input.stayEnd.toISOString()}::timestamptz,'[)')) holds,
    (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${TENANT_A}::uuid
      AND period=tstzrange(${input.stayStart.toISOString()}::timestamptz,${input.stayEnd.toISOString()}::timestamptz,'[)')) occupancies,
    (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT_A}::uuid
      AND property_node=${PROPERTY_A}::uuid) attributions,
    (SELECT count(*)::int FROM tax_attribution_hold_binding WHERE tenant_id=${TENANT_A}::uuid
      AND period=tstzrange(${input.stayStart.toISOString()}::timestamptz,${input.stayEnd.toISOString()}::timestamptz,'[)')) bindings
  `;
}

async function containmentCounts(): Promise<Record<string, number>> {
  const rows = await deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT_A}::uuid) reservations,
    (SELECT count(*)::int FROM reservation_segment WHERE tenant_id=${TENANT_A}::uuid) segments,
    (SELECT count(*)::int FROM folio WHERE tenant_id=${TENANT_A}::uuid) folios,
    (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT_A}::uuid) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT_A}::uuid) postings,
    (SELECT COALESCE(sum(octet_length(tax_detail::text)),0)::int FROM posting_line
      WHERE tenant_id=${TENANT_A}::uuid) tax_detail_bytes,
    (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT_A}::uuid) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT_A}::uuid) submissions
  `;
  if (!rows[0]) throw new Error("containment query returned no row");
  return rows[0];
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await deploy`DELETE FROM tax_attribution_hold_binding WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM space_occupancy WHERE tenant_id=${tenantId}::uuid`;
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
    await deploy`DELETE FROM app_user WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM org_node WHERE tenant_id=${tenantId}::uuid`;
    await deploy`DELETE FROM tenant WHERE id=${tenantId}::uuid`;
  }
}

databaseDescribe("Order 248 authoritative quoted-tax cart-hold binding", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    directRuntime = new SQL(RUNTIME_URL!, { max: 8, prepare: false });
    eventPool = new SQL(RUNTIME_URL!, { max: 24, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 48, prepare: false });
    events = new PostgresEventBus(eventPool);
    holds = new HoldService(events);
    attributions = new TaxAttributionPersistenceService({
      events,
      idempotency: new PostgresIdempotency(),
    });
    service = createService();
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order248-a','Order 248 A','shared','active'),
      (${TENANT_B}::uuid,'order248-b','Order 248 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order248a.property'::ltree,'property','Order 248 A','UTC','INR'),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order248a.other'::ltree,'property','Order 248 Other','UTC','INR'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order248b.property'::ltree,'property','Order 248 B','UTC','INR')`;
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor@order248-a.local','Actor A','active'),
      (${ACTOR_B}::uuid,${TENANT_B}::uuid,'actor@order248-b.local','Actor B','active')`;
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES
      (${UNIT_TYPE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O248','Order 248 Room','hotel',4)`;
    await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity) VALUES
      (${SPACE}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O248-101','hotel',1)`;
    await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
      (${SELLABLE}::uuid,${TENANT_A}::uuid,${UNIT_TYPE}::uuid,'Order 248 Sellable','active')`;
    await deploy`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
      (${TENANT_A}::uuid,${SELLABLE}::uuid,${SPACE}::uuid,'exclusive')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES
      (${RATE_PLAN}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O248-RATE','Order 248 Rate','INR',false,'active')`;
    containmentBefore = await containmentCounts();
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await eventPool?.close({ timeout: 0 });
    await directRuntime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("P1: the tenant-leading append-only root, RLS and owner capability expose least authority", async () => {
    const rows = await deploy!<Array<Record<string, unknown>>>`SELECT
      c.relrowsecurity AS rls,
      has_table_privilege('app_role','public.tax_attribution_hold_binding','SELECT') AS app_select,
      has_table_privilege('app_role','public.tax_attribution_hold_binding','INSERT') AS app_insert,
      has_table_privilege('app_role','public.tax_attribution_hold_binding','UPDATE') AS app_update,
      has_table_privilege('app_role','public.tax_attribution_hold_binding','DELETE') AS app_delete,
      p.prosecdef AS security_definer,
      p.proconfig AS config,
      has_function_privilege('app_role','public.record_tax_attribution_hold_binding(uuid,uuid,uuid,uuid,uuid)','EXECUTE') AS app_execute,
      has_function_privilege('yellow_runtime','public.record_tax_attribution_hold_binding(uuid,uuid,uuid,uuid,uuid)','EXECUTE') AS runtime_execute
    FROM pg_class c
    CROSS JOIN pg_proc p
    WHERE c.oid='public.tax_attribution_hold_binding'::regclass
      AND p.oid='public.record_tax_attribution_hold_binding(uuid,uuid,uuid,uuid,uuid)'::regprocedure`;
    expect(rows).toEqual([{
      rls: true,
      app_select: true,
      app_insert: false,
      app_update: false,
      app_delete: false,
      security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      app_execute: true,
      runtime_execute: false,
    }]);
    await appRoleDenied(`INSERT INTO public.tax_attribution_hold_binding(
      tenant_id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,
      origin_quote_hash,snapshot_hash,currency
    ) VALUES('${TENANT_A}','${PROPERTY_A}','${ACTOR_A}','${id(24880)}','${id(24881)}',
      '${SELLABLE}',tstzrange('2030-01-10','2030-01-11','[)'),'${"a".repeat(64)}','${"b".repeat(64)}','INR')`);
    await appRoleDenied(`UPDATE public.tax_attribution_hold_binding SET currency='USD' WHERE tenant_id='${TENANT_A}'`);
    await appRoleDenied(`DELETE FROM public.tax_attribution_hold_binding WHERE tenant_id='${TENANT_A}'`);

    let denied: unknown;
    try {
      await directRuntime!`SELECT * FROM public.record_tax_attribution_hold_binding(
        ${TENANT_A}::uuid,${PROPERTY_A}::uuid,${ACTOR_A}::uuid,${id(24880)}::uuid,${id(24881)}::uuid)`;
    } catch (error) { denied = error; }
    expect(denied).toMatchObject({ errno: "42501" });
  });

  test("P2: one fresh bookable quoted/calculated result atomically creates the existing hold, attribution and minimized binding evidence", async () => {
    quoteMode = "valid";
    const callsBefore = quoteCalls;
    const receipt = await place(command(0, "order248-success-once"));
    expect(quoteCalls).toBe(callsBefore + 1);
    expect(receipt).toMatchObject({
      propertyNode: PROPERTY_A,
      quoteHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      snapshotHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      currency: "INR",
      created: true,
      replayed: false,
    });
    const holdId = String(receipt.holdId);
    const attributionId = String(receipt.attributionId);
    const bindingId = String(receipt.bindingId);
    const evidence = await deploy!.unsafe<Array<{
      holds: number; claims: number; attributions: number; bindings: number;
      facts: number; events: number; payload: Record<string, unknown>;
    }>>(`SELECT
      (SELECT count(*)::int FROM hold WHERE tenant_id=$1::uuid AND id=$2::uuid
        AND kind='cart' AND status='active') holds,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=$1::uuid
        AND slot_kind='hold' AND slot_ref=$2::uuid) claims,
      (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=$1::uuid
        AND id=$3::uuid) attributions,
      (SELECT count(*)::int FROM tax_attribution_hold_binding WHERE tenant_id=$1::uuid
        AND id=$4::uuid AND hold_id=$2::uuid
        AND attribution_id=$3::uuid) bindings,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=$1::uuid
        AND entity_type='tax_attribution_hold_binding' AND entity_id=$4::uuid
        AND fact_type='tax.attribution_bound') facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=$1::uuid
        AND aggregate_type='tax_attribution_hold_binding' AND aggregate_id=$4::uuid
        AND event_type='tax.attribution_bound') events,
      (SELECT payload FROM outbox WHERE tenant_id=$1::uuid
        AND aggregate_id=$4::uuid AND event_type='tax.attribution_bound' LIMIT 1) payload`, [
      TENANT_A,
      holdId,
      attributionId,
      bindingId,
    ]);
    expect(evidence[0]).toMatchObject({ holds: 1, claims: 1, attributions: 1, bindings: 1, facts: 1, events: 1 });
    expect(evidence[0]!.payload).toEqual({
      binding_id: receipt.bindingId,
      property_node: PROPERTY_A,
      hold_id: receipt.holdId,
      attribution_id: receipt.attributionId,
      origin_quote_hash: receipt.quoteHash,
      snapshot_hash: receipt.snapshotHash,
      currency: "INR",
    });
  });

  test("P3: hostile shape, caller evidence, foreign authority and incomplete live quote truth write nothing", async () => {
    const before = await artifactCounts(5);
    const valid = command(5, "order248-hostile-base") as unknown as Record<string, unknown>;
    const hostile: unknown[] = [
      { ...valid, callerSnapshot: {} },
      Object.defineProperty({ ...valid }, "quote", { enumerable: true, get() { return quoteInput(5); } }),
      (() => { const cyclic = { ...valid } as Record<string, unknown>; cyclic.quote = cyclic; return cyclic; })(),
    ];
    for (const value of hostile) await expect(place(value as never)).rejects.toThrow();

    await expect(place(command(5, "order248-foreign-property", envelope(undefined, ACTOR_A, TENANT_A, PROPERTY_A_OTHER))))
      .rejects.toThrow();
    await expect(place(command(5, "order248-foreign-actor", envelope(undefined, ACTOR_B))))
      .rejects.toThrow();
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.place(
      tx,
      command(5, "order248-foreign-tenant") as never,
    ))).rejects.toThrow();

    for (const mode of ["unbookable", "partial_tax", "wrong_property", "wrong_sellable"] as const) {
      quoteMode = mode;
      await expect(place(command(5, `order248-${mode}`))).rejects.toThrow();
    }
    quoteMode = "valid";
    expect(await artifactCounts(5)).toEqual(before);
  });

  test("P4: exact replay and same/different-key races converge on one complete binding", async () => {
    const exact = command(10, "order248-exact-replay");
    const first = await place(exact);
    const replay = await place(exact);
    expect(replay).toMatchObject({
      bindingId: first.bindingId,
      holdId: first.holdId,
      attributionId: first.attributionId,
      replayed: true,
    });
    const sameKey = await Promise.all(Array.from({ length: 12 }, () => place(command(11, "order248-same-key-race"))));
    expect(new Set(sameKey.map(({ bindingId }) => bindingId)).size).toBe(1);
    expect(new Set(sameKey.map(({ holdId }) => holdId)).size).toBe(1);
    expect(new Set(sameKey.map(({ attributionId }) => attributionId)).size).toBe(1);
    expect((await artifactCounts(11))[0]).toMatchObject({ holds: 1, occupancies: 1, bindings: 1 });

    const contenders = await Promise.allSettled(Array.from({ length: 12 }, (_, index) =>
      place(command(12, `order248-different-key-${String(index).padStart(2, "0")}`)),
    ));
    const fulfilled = contenders.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    expect(fulfilled.length).toBeGreaterThan(0);
    expect(contenders).toHaveLength(12);
    expect(new Set(fulfilled.map(({ bindingId }) => bindingId)).size).toBe(1);
    expect(new Set(fulfilled.map(({ holdId }) => holdId)).size).toBe(1);
    expect(new Set(fulfilled.map(({ attributionId }) => attributionId)).size).toBe(1);
    expect((await artifactCounts(12))[0]).toMatchObject({ holds: 1, occupancies: 1, bindings: 1 });
  }, 45_000);

  test("P5: publication/occupancy races terminate and bound-event failure rolls every artifact back before exact retry", async () => {
    const failing = createService(new FailBoundEventBus(events!));
    const rollback = command(20, "order248-rollback-retry");
    await expect(place(rollback, failing)).rejects.toThrow("Order 248 injected bound-event failure");
    expect((await artifactCounts(20))[0]).toMatchObject({ holds: 0, occupancies: 0, bindings: 0 });
    const retried = await place(rollback);
    expect(retried).toMatchObject({ created: true, replayed: false });
    expect((await artifactCounts(20))[0]).toMatchObject({ holds: 1, occupancies: 1, bindings: 1 });

    const noDeadlock = await Promise.race([
      Promise.allSettled(Array.from({ length: 8 }, (_, index) =>
        place(command(21, `order248-no-deadlock-${index}`)),
      )),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 10_000)),
    ]);
    expect(noDeadlock).not.toBe("timeout");
    if (noDeadlock === "timeout") throw new Error("Order248 contention did not terminate");
    const fulfilled = noDeadlock.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    expect(fulfilled.length).toBeGreaterThan(0);
    expect(noDeadlock).toHaveLength(8);
    expect(new Set(fulfilled.map(({ bindingId }) => bindingId)).size).toBe(1);
    expect((await artifactCounts(21))[0]).toMatchObject({ holds: 1, occupancies: 1, bindings: 1 });
  }, 45_000);

  test("P6: releasing the cart hold preserves binding history and all reservation/financial/fiscal state", async () => {
    const receipt = await place(command(30, "order248-retention"));
    await database!.withTenantTransaction(TENANT_A, (tx) => holds!.release(tx, {
      holdId: receipt.holdId,
      envelope: Object.freeze({
        actorId: ACTOR_A,
        tenantId: TENANT_A,
        propertyNode: PROPERTY_A,
        requestId: crypto.randomUUID(),
        operation: "hold.released" as const,
      }),
    }));
    const retained = await deploy!<Array<{ status: string; claims: number; bindings: number }>>`SELECT
      h.status,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=h.tenant_id
        AND slot_kind='hold' AND slot_ref=h.id) claims,
      (SELECT count(*)::int FROM tax_attribution_hold_binding WHERE tenant_id=h.tenant_id
        AND hold_id=h.id AND id=${receipt.bindingId}::uuid) bindings
    FROM hold h WHERE h.tenant_id=${TENANT_A}::uuid AND h.id=${receipt.holdId}::uuid`;
    expect(retained).toEqual([{ status: "released", claims: 0, bindings: 1 }]);
    expect(await containmentCounts()).toEqual(containmentBefore!);
  });
});
