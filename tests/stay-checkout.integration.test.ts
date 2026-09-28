import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  CheckoutConflictError,
  CheckoutNotFoundError,
  CheckoutService,
  CheckoutValidationError,
} from "../src/contexts/stay-operations";
import { FolioSettlementService } from "../src/contexts/financials";
import { ReservationSegmentService } from "../src/contexts/reservations";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  type ConsumeBatchOptions,
  type ConsumeBatchResult,
  type EventBus,
  type EventHandler,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_CHECKOUT_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_CHECKOUT === "1";
if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_CHECKOUT_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000020401";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000020402";
const PROPERTY = "00000000-0000-0000-0000-000000020411";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000020412";
const ACTOR = "00000000-0000-0000-0000-000000020421";
const PARTY = "00000000-0000-0000-0000-000000020431";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000020432";
const UNIT_TYPE = "00000000-0000-0000-0000-000000020441";
const RATE_PLAN = "00000000-0000-0000-0000-000000020442";
const REVENUE = "00000000-0000-0000-0000-000000020443";
const FOREIGN_RESERVATION = "00000000-0000-0000-0000-000000020451";
const TX_CODE = "O204PROOF";

type FolioFixture = Readonly<{
  status: "open" | "settled" | "closed";
  balanceMinor?: number;
}>;

interface CaseOptions {
  readonly reservationStatus?: string;
  readonly segmentCount?: number;
  readonly roomCount?: number;
  readonly occupancy?: boolean;
  readonly lateDeparture?: boolean;
  readonly folios?: readonly FolioFixture[];
}

interface CaseFixture {
  readonly reservationId: string;
  readonly segmentId: string | null;
  readonly spaceId: string | null;
  readonly accountId: string | null;
  readonly folioIds: readonly string[];
  readonly periodStart: string;
  readonly periodEnd: string;
}

let deploy: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let checkout: CheckoutService | undefined;
let settlements: FolioSettlementService | undefined;
let segments: ReservationSegmentService | undefined;
let businessDate = "";
let periodStart = "";
let futureEnd = "";
let pastEnd = "";
let serial = 0;

class FailingEventBus implements EventBus {
  readonly #delegate: EventBus;
  readonly #eventType: string;

  constructor(delegate: EventBus, eventType: string) {
    this.#delegate = delegate;
    this.#eventType = eventType;
  }

  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    if (event.eventType === this.#eventType) {
      return Promise.reject(new Error(`injected ${this.#eventType} failure`));
    }
    return this.#delegate.publish(tx, event);
  }

  consumeBatch(
    consumer: string,
    handler: EventHandler,
    options?: ConsumeBatchOptions,
  ): Promise<ConsumeBatchResult> {
    return this.#delegate.consumeBatch(consumer, handler, options);
  }
}

function commandInput(
  reservationId: string,
  idempotencyKey: string,
  authority: Readonly<{ tenantId?: string; propertyNode?: string; actorId?: string; requestId?: string }> = {},
) {
  const tenantId = authority.tenantId ?? TENANT;
  const propertyNode = authority.propertyNode ?? PROPERTY;
  return Object.freeze({
    tenantId,
    propertyNode,
    reservationId,
    idempotencyKey,
    envelope: createAuditEnvelope({
      tenantId,
      propertyNode,
      actorId: authority.actorId ?? ACTOR,
      requestId: authority.requestId ?? crypto.randomUUID(),
      operation: "reservation.checked_out",
    }),
  });
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "api_idempotency", "outbox", "fact_log", "posting_line", "journal", "business_day",
    "folio", "account", "space_occupancy", "reservation_segment", "reservation",
    "sellable_unit_space", "sellable_unit", "rate_plan", "unit_type", "space",
    "app_user", "party_role", "party", "org_node",
  ]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid, $2::uuid)`, [TENANT, FOREIGN_TENANT]);
  }
  await deploy`DELETE FROM public.tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.tx_code WHERE code = ${TX_CODE}`;
}

async function createCase(options: CaseOptions = {}): Promise<CaseFixture> {
  const caseNo = ++serial;
  const reservationId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const segmentIds: string[] = [];
  const spaceIds: string[] = [];
  const folioIds: string[] = [];
  const segmentCount = options.segmentCount ?? 1;
  const roomCount = options.roomCount ?? 1;
  const rangeEnd = options.lateDeparture ? pastEnd : futureEnd;
  const folios = options.folios ?? Object.freeze<FolioFixture[]>([{ status: "settled" }]);

  await deploy!`INSERT INTO public.reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(
      ${reservationId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${`O204-${caseNo}`},
      ${options.reservationStatus ?? "in_house"},${PARTY}::uuid,'direct','USD'
    )`;

  for (let index = 0; index < segmentCount; index += 1) {
    const sellableId = crypto.randomUUID();
    const segmentId = crypto.randomUUID();
    segmentIds.push(segmentId);
    await deploy!`INSERT INTO public.sellable_unit(id,tenant_id,unit_type_id,name,status)
      VALUES(${sellableId}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,${`O204 Sellable ${caseNo}-${index}`},'active')`;
    await deploy!`INSERT INTO public.reservation_segment(
        id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status
      ) VALUES(
        ${segmentId}::uuid,${TENANT}::uuid,${reservationId}::uuid,${index + 1},${UNIT_TYPE}::uuid,
        ${sellableId}::uuid,tstzrange(${periodStart}::timestamptz,${rangeEnd}::timestamptz,'[)'),
        ${RATE_PLAN}::uuid,'in_house'
      )`;
    if (index === 0) {
      for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
        const spaceId = crypto.randomUUID();
        spaceIds.push(spaceId);
        await deploy!`INSERT INTO public.space(id,tenant_id,property_node,code,profile_key,capacity,status)
          VALUES(${spaceId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${`R${caseNo}-${roomIndex + 1}`},
            'order204-room',2,'active')`;
        await deploy!`INSERT INTO public.sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode)
          VALUES(${TENANT}::uuid,${sellableId}::uuid,${spaceId}::uuid,'exclusive')`;
      }
    }
  }

  if (segmentCount === 1 && roomCount === 1 && (options.occupancy ?? true)) {
    await database!.withTenantTransaction(TENANT, async (tx) => {
      await tx`SELECT public.record_occupancy(
        ${TENANT}::uuid,${spaceIds[0]!}::uuid,
        tstzrange(${periodStart}::timestamptz,${rangeEnd}::timestamptz,'[)'),
        ${segmentIds[0]!}::uuid,'segment',true
      )`;
    });
  }

  if (folios.length > 0) {
    await deploy!`INSERT INTO public.account(id,tenant_id,property_node,role,party_id,name,currency,status)
      VALUES(${accountId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,
        ${`O204 Guest ${caseNo}`},'USD','open')`;
  }
  for (const [index, specification] of folios.entries()) {
    const folioId = crypto.randomUUID();
    folioIds.push(folioId);
    await deploy!`INSERT INTO public.folio(
        id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
      ) VALUES(${folioId}::uuid,${TENANT}::uuid,${accountId}::uuid,${reservationId}::uuid,
        ${`O204-F${caseNo}-${index + 1}`},${index + 1},${`Window ${index + 1}`},${specification.status})`;
    const amount = specification.balanceMinor ?? 0;
    if (amount !== 0) {
      const journalId = crypto.randomUUID();
      await deploy!.begin(async (tx) => {
        await tx`INSERT INTO public.journal(
            id,tenant_id,property_node,business_date,kind,description,currency,source,created_by
          ) VALUES(${journalId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date,'charge',
            'Order 204 checkout proof','USD','{"interface":"order204-proof"}'::jsonb,${ACTOR}::uuid)`;
        await tx`INSERT INTO public.posting_line(
            id,tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,business_date
          ) VALUES
          (${crypto.randomUUID()}::uuid,${TENANT}::uuid,${journalId}::uuid,1,${accountId}::uuid,
            ${folioId}::uuid,${TX_CODE},'Guest balance',${amount},1.000,${businessDate}::date),
          (${crypto.randomUUID()}::uuid,${TENANT}::uuid,${journalId}::uuid,2,${REVENUE}::uuid,
            NULL,${TX_CODE},'Revenue',${-amount},1.000,${businessDate}::date)`;
      });
    }
  }
  return Object.freeze({
    reservationId,
    segmentId: segmentIds.length === 1 ? segmentIds[0]! : null,
    spaceId: spaceIds.length === 1 ? spaceIds[0]! : null,
    accountId: folios.length > 0 ? accountId : null,
    folioIds: Object.freeze(folioIds),
    periodStart,
    periodEnd: rangeEnd,
  });
}

async function snapshot(fixture: CaseFixture): Promise<unknown> {
  return deploy!`
    SELECT
      (SELECT jsonb_build_object('status',status) FROM public.reservation WHERE id=${fixture.reservationId}::uuid) AS reservation,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'status',status,'period',period::text) ORDER BY id),'[]'::jsonb)
         FROM public.reservation_segment WHERE reservation_id=${fixture.reservationId}::uuid) AS segments,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'period',period::text) ORDER BY id),'[]'::jsonb)
         FROM public.space_occupancy WHERE slot_ref=${fixture.segmentId ?? crypto.randomUUID()}::uuid) AS occupancies,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'status',status) ORDER BY id),'[]'::jsonb)
         FROM public.folio WHERE reservation_id=${fixture.reservationId}::uuid) AS folios,
      (SELECT count(*)::int FROM public.journal WHERE tenant_id=${TENANT}::uuid AND
         (${fixture.accountId}::uuid IS NULL OR id IN (SELECT journal_id FROM public.posting_line WHERE account_id=${fixture.accountId}::uuid))) AS journals,
      (SELECT count(*)::int FROM public.posting_line WHERE tenant_id=${TENANT}::uuid AND
         (${fixture.accountId}::uuid IS NULL OR account_id=${fixture.accountId}::uuid OR journal_id IN
           (SELECT journal_id FROM public.posting_line WHERE account_id=${fixture.accountId}::uuid))) AS postings,
      (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid AND entity_id IN
         (${fixture.reservationId}::uuid,${fixture.segmentId ?? crypto.randomUUID()}::uuid)) AS facts,
      (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid AND aggregate_id IN
         (${fixture.reservationId}::uuid,${fixture.segmentId ?? crypto.randomUUID()}::uuid,${fixture.spaceId ?? crypto.randomUUID()}::uuid)) AS events,
      (SELECT count(*)::int FROM public.api_idempotency WHERE tenant_id=${TENANT}::uuid AND response_body->>'reservationId'=${fixture.reservationId}) AS idempotency
  `;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 16, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 48, prepare: false });
  events = new PostgresEventBus(eventPool);
  checkout = new CheckoutService({ database, events, idempotency: new PostgresIdempotency() });
  settlements = new FolioSettlementService({
    database,
    events,
    idempotency: new PostgresIdempotency(),
  });
  segments = new ReservationSegmentService({ events, idempotency: new PostgresIdempotency() });
  await cleanup();
  const clock = (await deploy<Array<{ now: Date; date: string }>>`
    SELECT transaction_timestamp() AS now, (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS date
  `)[0]!;
  businessDate = clock.date;
  periodStart = new Date(clock.now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  futureEnd = new Date(clock.now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  pastEnd = new Date(clock.now.getTime() - 60 * 60 * 1000).toISOString();
  await deploy`INSERT INTO public.tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order204','Order 204','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order204-foreign','Order 204 Foreign','shared','active')`;
  await deploy`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order204'::ltree,'property','Order 204','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order204_foreign'::ltree,'property','Foreign','UTC','USD')`;
  await deploy`INSERT INTO public.app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'operator@order204.test','Order 204 Operator','active')`;
  await deploy`INSERT INTO public.party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Order 204 Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
  await deploy`INSERT INTO public.party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${PARTY}::uuid,'guest'),
    (${FOREIGN_TENANT}::uuid,${FOREIGN_PARTY}::uuid,'guest')`;
  await deploy`INSERT INTO public.unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
    (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O204','Order 204','order204-room')`;
  await deploy`INSERT INTO public.rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive) VALUES
    (${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O204','Order 204','USD',false)`;
  await deploy`INSERT INTO public.account(id,tenant_id,property_node,role,name,currency,status) VALUES
    (${REVENUE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'revenue','Order 204 Revenue','USD','open')`;
  await deploy`INSERT INTO public.business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date)`;
  await deploy`INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    (${TX_CODE},'Order 204 proof','revenue','Rooms','guest','revenue')`;
  await deploy`INSERT INTO public.reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(${FOREIGN_RESERVATION}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,
      'O204-FOREIGN','in_house',${FOREIGN_PARTY}::uuid,'direct','USD')`;
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await deploy?.close({ timeout: 0 });
});

databaseDescribe("Order 204 governed checkout command", () => {
  test("P1 legal checkout releases the exact room and never lengthens either supported departure state", async () => {
    for (const specification of [
      { status: "in_house", late: false },
      { status: "due_out", late: true },
    ] as const) {
      const fixture = await createCase({ reservationStatus: specification.status, lateDeparture: specification.late });
      const beforeFinancial = (await snapshot(fixture) as unknown[])[0];
      const input = commandInput(fixture.reservationId, `order204-legal-${specification.status}`, { requestId: crypto.randomUUID() });
      const result = await checkout!.checkout(input);
      expect(result).toMatchObject({
        reservationId: fixture.reservationId,
        previousReservationStatus: specification.status,
        reservationStatus: "checked_out",
        segmentId: fixture.segmentId,
        segmentStatus: "departed",
        assignedSpaceId: fixture.spaceId,
        previousSegmentPeriod: { from: fixture.periodStart, to: fixture.periodEnd },
        releasedClaimCount: 1,
        folioWindowCount: 1,
        replayed: false,
      });
      expect(result.segmentPeriod.from).toBe(fixture.periodStart);
      expect(new Date(result.segmentPeriod.to).getTime()).toBeLessThanOrEqual(new Date(fixture.periodEnd).getTime());
      if (specification.late) expect(result.segmentPeriod.to).toBe(fixture.periodEnd);
      else expect(result.segmentPeriod.to).toBe(result.checkedOutAt);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.segmentPeriod)).toBe(true);

      const rows = await deploy!<Array<{
        reservation_status: string; segment_status: string; segment_end: Date; occupancies: number;
        reservation_facts: number; release_facts: number; checkout_events: number; release_events: number;
      }>>`
        SELECT reservation.status AS reservation_status, segment.status AS segment_status,
          upper(segment.period) AS segment_end,
          (SELECT count(*)::int FROM public.space_occupancy WHERE slot_ref=segment.id) AS occupancies,
          (SELECT count(*)::int FROM public.fact_log WHERE entity_id=reservation.id AND fact_type='reservation.checked_out') AS reservation_facts,
          (SELECT count(*)::int FROM public.fact_log WHERE entity_id=segment.id AND fact_type='occupancy.released') AS release_facts,
          (SELECT count(*)::int FROM public.outbox WHERE aggregate_id=reservation.id AND event_type='reservation.checked_out') AS checkout_events,
          (SELECT count(*)::int FROM public.outbox WHERE correlation_id=${input.envelope.requestId}::uuid AND event_type='occupancy.released') AS release_events
        FROM public.reservation
        JOIN public.reservation_segment AS segment ON segment.reservation_id=reservation.id
        WHERE reservation.id=${fixture.reservationId}::uuid
      `;
      expect(rows[0]).toMatchObject({
        reservation_status: "checked_out", segment_status: "departed", occupancies: 0,
        reservation_facts: 1, release_facts: 1, checkout_events: 1, release_events: 1,
      });
      expect(rows[0]!.segment_end.toISOString()).toBe(result.segmentPeriod.to);
      const after = (await snapshot(fixture) as unknown[])[0] as Record<string, unknown>;
      expect(after.folios).toEqual((beforeFinancial as Record<string, unknown>).folios);
      expect(after.journals).toEqual((beforeFinancial as Record<string, unknown>).journals);
      expect(after.postings).toEqual((beforeFinancial as Record<string, unknown>).postings);
    }
  });

  test("P2 every readiness deficiency fails atomically with the fixed actionable blocker", async () => {
    const cases = [
      [await createCase({ reservationStatus: "reserved" }), "reservation_not_departure_state"],
      [await createCase({ segmentCount: 0 }), "current_segment_missing_or_ambiguous"],
      [await createCase({ roomCount: 0 }), "physical_room_missing_or_ambiguous"],
      [await createCase({ occupancy: false }), "occupancy_missing_or_ambiguous"],
      [await createCase({ folios: Object.freeze([]) }), "folio_window_missing"],
      [await createCase({ folios: Object.freeze([{ status: "open" }]) }), "folio_window_unsettled"],
      [await createCase({ folios: Object.freeze([{ status: "settled", balanceMinor: 500 }]) }), "folio_window_nonzero"],
    ] as const;
    for (const [fixture, blocker] of cases) {
      const before = await snapshot(fixture);
      try {
        await checkout!.checkout(commandInput(fixture.reservationId, `order204-block-${blocker}`));
        throw new Error("checkout unexpectedly succeeded");
      } catch (error) {
        expect(error).toBeInstanceOf(CheckoutConflictError);
        expect((error as CheckoutConflictError).blockers).toContain(blocker);
      }
      expect(await snapshot(fixture)).toEqual(before);
    }
  });

  test("P3 exact replay, changed-request conflict, and twenty contenders converge once", async () => {
    const replayFixture = await createCase();
    const exact = commandInput(replayFixture.reservationId, "order204-exact-replay", { requestId: crypto.randomUUID() });
    expect((await checkout!.checkout(exact)).replayed).toBe(false);
    expect((await checkout!.checkout(exact)).replayed).toBe(true);
    await expect(checkout!.checkout(commandInput(
      replayFixture.reservationId, "order204-exact-replay", { requestId: crypto.randomUUID() },
    ))).rejects.toBeInstanceOf(IdempotencyConflictError);

    const convergence = await createCase();
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => checkout!.checkout(
      commandInput(convergence.reservationId, `order204-converge-${String(index).padStart(2, "0")}`),
    )));
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(19);
    const proof = await deploy!<Array<{ facts: number; events: number; occupancies: number }>>`
      SELECT
        (SELECT count(*)::int FROM public.fact_log WHERE entity_id=${convergence.reservationId}::uuid AND fact_type='reservation.checked_out') AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE aggregate_id=${convergence.reservationId}::uuid AND event_type='reservation.checked_out') AS events,
        (SELECT count(*)::int FROM public.space_occupancy WHERE slot_ref=${convergence.segmentId}::uuid) AS occupancies
    `;
    expect(proof[0]).toMatchObject({ facts: 1, events: 1, occupancies: 0 });
    expect((await deploy!<Array<{ status: string }>>`
      SELECT status FROM public.reservation WHERE id=${convergence.reservationId}::uuid
    `)[0]?.status).toBe("checked_out");
  });

  test("P4 outbox failure rolls back release, states, facts and idempotency, then the same key retries", async () => {
    for (const failedEvent of ["occupancy.released", "reservation.checked_out"] as const) {
      const fixture = await createCase();
      const before = await snapshot(fixture);
      const exact = commandInput(fixture.reservationId, `order204-rollback-${failedEvent}`, { requestId: crypto.randomUUID() });
      const failing = new CheckoutService({
        database: database!,
        events: new FailingEventBus(events!, failedEvent),
        idempotency: new PostgresIdempotency(),
      });
      await expect(failing.checkout(exact)).rejects.toThrow(`injected ${failedEvent} failure`);
      expect(await snapshot(fixture)).toEqual(before);
      expect((await checkout!.checkout(exact)).replayed).toBe(false);
    }
  });

  test("P4 settlement and departure-change races serialize to coherent governed truth", async () => {
    const financial = await createCase({ folios: Object.freeze([{ status: "open" }]) });
    const checkoutInput = commandInput(financial.reservationId, "order204-financial-race");
    const [checkoutAttempt, settlementAttempt] = await Promise.allSettled([
      checkout!.checkout(checkoutInput),
      settlements!.settle({
        tenantId: TENANT,
        folioId: financial.folioIds[0]!,
        idempotencyKey: "order204-settlement-race",
        envelope: createAuditEnvelope({
          tenantId: TENANT,
          propertyNode: PROPERTY,
          actorId: ACTOR,
          requestId: crypto.randomUUID(),
          operation: "folio.settled",
        }),
      }),
    ]);
    expect(settlementAttempt.status).toBe("fulfilled");
    if (checkoutAttempt.status === "rejected") {
      expect(checkoutAttempt.reason).toBeInstanceOf(CheckoutConflictError);
      expect((await checkout!.checkout(checkoutInput)).reservationStatus).toBe("checked_out");
    } else {
      expect(checkoutAttempt.value.reservationStatus).toBe("checked_out");
    }
    expect((await deploy!<Array<{ status: string }>>`
      SELECT status FROM public.folio WHERE id=${financial.folioIds[0]!}::uuid
    `)[0]?.status).toBe("settled");

    const changed = await createCase();
    const changedCheckout = commandInput(changed.reservationId, "order204-segment-race");
    const newDeparture = new Date(new Date(changed.periodEnd).getTime() - 12 * 60 * 60 * 1000).toISOString();
    const [checkoutRace, changeRace] = await Promise.allSettled([
      checkout!.checkout(changedCheckout),
      database!.withTenantTransaction(TENANT, (tx) => segments!.changeDeparture(tx, {
        reservationId: changed.reservationId,
        segmentId: changed.segmentId!,
        expectedPeriod: { from: changed.periodStart, to: changed.periodEnd },
        newDeparture,
        idempotencyKey: "order204-change-race",
        envelope: createAuditEnvelope({
          tenantId: TENANT,
          propertyNode: PROPERTY,
          actorId: ACTOR,
          requestId: crypto.randomUUID(),
          operation: "reservation.modified",
        }),
      })),
    ]);
    expect([checkoutRace.status, changeRace.status]).toContain("fulfilled");
    if (checkoutRace.status === "rejected") {
      expect((await checkout!.checkout(changedCheckout)).reservationStatus).toBe("checked_out");
    }
    const coherent = (await deploy!<Array<{
      reservation_status: string; segment_status: string; occupancies: number; from_at: Date; to_at: Date;
    }>>`
      SELECT reservation.status AS reservation_status, segment.status AS segment_status,
        lower(segment.period) AS from_at, upper(segment.period) AS to_at,
        (SELECT count(*)::int FROM public.space_occupancy WHERE slot_ref=segment.id) AS occupancies
      FROM public.reservation
      JOIN public.reservation_segment AS segment ON segment.reservation_id=reservation.id
      WHERE reservation.id=${changed.reservationId}::uuid
    `)[0]!;
    expect(coherent).toMatchObject({ reservation_status: "checked_out", segment_status: "departed", occupancies: 0 });
    expect(coherent.from_at.toISOString()).toBe(changed.periodStart);
    expect(coherent.to_at.getTime()).toBeLessThanOrEqual(new Date(changed.periodEnd).getTime());
  });

  test("P5 malformed and foreign authority is concealed and byte-for-byte mutation-free", async () => {
    const fixture = await createCase();
    const before = await snapshot(fixture);
    await expect(checkout!.checkout({ ...commandInput(fixture.reservationId, "order204-malformed"), reservationId: "NOT-A-UUID" }))
      .rejects.toBeInstanceOf(CheckoutValidationError);
    await expect(checkout!.checkout(commandInput(FOREIGN_RESERVATION, "order204-foreign-target")))
      .rejects.toBeInstanceOf(CheckoutNotFoundError);
    await expect(checkout!.checkout(commandInput(fixture.reservationId, "order204-foreign-property", { propertyNode: FOREIGN_PROPERTY })))
      .rejects.toBeInstanceOf(CheckoutNotFoundError);
    await expect(checkout!.checkout(commandInput(fixture.reservationId, "order204-foreign-actor", { actorId: crypto.randomUUID() })))
      .rejects.toBeInstanceOf(CheckoutNotFoundError);
    expect(await snapshot(fixture)).toEqual(before);
  });
});
