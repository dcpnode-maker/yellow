import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import { FolioSettlementService } from "../src/contexts/financials";
import {
  CHECKOUT_READINESS_BLOCKERS,
  CheckoutReadinessNotFoundError,
  CheckoutReadinessService,
  CheckoutReadinessValidationError,
  type CheckoutReadiness,
} from "../src/contexts/stay-operations";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_CHECKOUT_READINESS_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_CHECKOUT_READINESS === "1";
if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_CHECKOUT_READINESS_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000020301";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000020302";
const PROPERTY = "00000000-0000-0000-0000-000000020311";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000020312";
const ACTOR = "00000000-0000-0000-0000-000000020321";
const PARTY = "00000000-0000-0000-0000-000000020331";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000020332";
const UNIT_TYPE = "00000000-0000-0000-0000-000000020341";
const RATE_PLAN = "00000000-0000-0000-0000-000000020342";
const REVENUE = "00000000-0000-0000-0000-000000020343";
const FOREIGN_RESERVATION = "00000000-0000-0000-0000-000000020351";
const TX_CODE = "O203PROOF";
const PERIOD_START = "2026-08-27T10:00:00.000Z";
const PERIOD_END = "2026-08-29T10:00:00.000Z";

type FolioFixture = Readonly<{
  status: "open" | "settled" | "closed";
  balanceMinor?: number;
  windowNo?: number;
  name?: string | null;
  folioNo?: string | null;
}>;

interface CaseOptions {
  readonly reservationStatus?: string;
  readonly segmentCount?: number;
  readonly roomCount?: number;
  readonly occupancy?: boolean;
  readonly folios?: readonly FolioFixture[];
}

interface CaseFixture {
  readonly reservationId: string;
  readonly segmentId: string | null;
  readonly spaceId: string | null;
  readonly occupancyId: string | null;
  readonly folioIds: readonly string[];
}

let deploy: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let readiness: CheckoutReadinessService | undefined;
let settlements: FolioSettlementService | undefined;
let businessDate = "";
let serial = 0;

function input(reservationId: string, authority: Readonly<{
  tenantId?: string;
  propertyNode?: string;
}> = {}) {
  return Object.freeze({
    tenantId: authority.tenantId ?? TENANT,
    propertyNode: authority.propertyNode ?? PROPERTY,
    reservationId,
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
    await deploy.unsafe(
      `DELETE FROM ${table} WHERE tenant_id IN ($1::uuid, $2::uuid)`,
      [TENANT, FOREIGN_TENANT],
    );
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
  const shouldOccupy = options.occupancy ?? true;
  const folios: readonly FolioFixture[] = options.folios ??
    Object.freeze<FolioFixture[]>([{ status: "settled" }]);

  await deploy!`INSERT INTO public.reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(
      ${reservationId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${`O203-${caseNo}`},
      ${options.reservationStatus ?? "in_house"},${PARTY}::uuid,'direct','USD'
    )`;

  for (let index = 0; index < segmentCount; index += 1) {
    const sellableId = crypto.randomUUID();
    const segmentId = crypto.randomUUID();
    segmentIds.push(segmentId);
    await deploy!`INSERT INTO public.sellable_unit(id,tenant_id,unit_type_id,name,status)
      VALUES(${sellableId}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,${`O203 Sellable ${caseNo}-${index}`},'active')`;
    await deploy!`INSERT INTO public.reservation_segment(
        id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status
      ) VALUES(
        ${segmentId}::uuid,${TENANT}::uuid,${reservationId}::uuid,${index + 1},${UNIT_TYPE}::uuid,
        ${sellableId}::uuid,tstzrange(${PERIOD_START}::timestamptz,${PERIOD_END}::timestamptz,'[)'),
        ${RATE_PLAN}::uuid,'in_house'
      )`;
    if (index === 0) {
      for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
        const spaceId = crypto.randomUUID();
        spaceIds.push(spaceId);
        await deploy!`INSERT INTO public.space(
            id,tenant_id,property_node,code,profile_key,capacity,status
          ) VALUES(
            ${spaceId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${`R${caseNo}-${roomIndex + 1}`},
            'order203-room',2,'active'
          )`;
        await deploy!`INSERT INTO public.sellable_unit_space(
            tenant_id,sellable_unit_id,space_id,claim_mode
          ) VALUES(${TENANT}::uuid,${sellableId}::uuid,${spaceId}::uuid,'exclusive')`;
      }
    }
  }

  let occupancyId: string | null = null;
  if (segmentCount === 1 && roomCount === 1 && shouldOccupy) {
    occupancyId = (await database!.withTenantTransaction(TENANT, async (tx) => (await tx<Array<{ id: string }>>`
      SELECT public.record_occupancy(
        ${TENANT}::uuid,${spaceIds[0]!}::uuid,
        tstzrange(${PERIOD_START}::timestamptz,${PERIOD_END}::timestamptz,'[)'),
        ${segmentIds[0]!}::uuid,'segment',true
      ) AS id
    `)[0]!.id));
  }

  if (folios.length > 0) {
    await deploy!`INSERT INTO public.account(
        id,tenant_id,property_node,role,party_id,name,currency,status
      ) VALUES(
        ${accountId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,
        ${`O203 Guest ${caseNo}`},'USD','open'
      )`;
  }
  for (const [index, specification] of folios.entries()) {
    const folioId = crypto.randomUUID();
    folioIds.push(folioId);
    await deploy!`INSERT INTO public.folio(
        id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
      ) VALUES(
        ${folioId}::uuid,${TENANT}::uuid,${accountId}::uuid,${reservationId}::uuid,
        ${specification.folioNo ?? `O203-F${caseNo}-${index + 1}`},${specification.windowNo ?? index + 1},
        ${specification.name ?? `Window ${index + 1}`},${specification.status}
      )`;
    const amount = specification.balanceMinor ?? 0;
    if (amount !== 0) {
      const journalId = crypto.randomUUID();
      await deploy!.begin(async (tx) => {
        await tx`INSERT INTO public.journal(
            id,tenant_id,property_node,business_date,kind,description,currency,source,created_by
          ) VALUES(
            ${journalId}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date,'charge',
            'Order 203 readiness proof','USD','{"interface":"order203-proof"}'::jsonb,${ACTOR}::uuid
          )`;
        await tx`INSERT INTO public.posting_line(
            id,tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
            amount_minor,quantity,business_date
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
    occupancyId,
    folioIds: Object.freeze(folioIds),
  });
}

async function readSnapshot(fixture: CaseFixture): Promise<unknown> {
  return deploy!`
    SELECT
      (SELECT to_jsonb(reservation) FROM public.reservation WHERE id=${fixture.reservationId}::uuid) AS reservation,
      (SELECT COALESCE(jsonb_agg(to_jsonb(segment) ORDER BY segment.id),'[]'::jsonb)
         FROM public.reservation_segment AS segment WHERE segment.reservation_id=${fixture.reservationId}::uuid) AS segments,
      (SELECT COALESCE(jsonb_agg(to_jsonb(occupancy) ORDER BY occupancy.id),'[]'::jsonb)
         FROM public.space_occupancy AS occupancy WHERE occupancy.slot_ref=${fixture.segmentId ?? crypto.randomUUID()}::uuid) AS occupancies,
      (SELECT COALESCE(jsonb_agg(to_jsonb(folio) ORDER BY folio.id),'[]'::jsonb)
         FROM public.folio WHERE reservation_id=${fixture.reservationId}::uuid) AS folios,
      (SELECT count(*)::int FROM public.account WHERE tenant_id=${TENANT}::uuid) AS accounts,
      (SELECT count(*)::int FROM public.journal WHERE tenant_id=${TENANT}::uuid) AS journals,
      (SELECT count(*)::int FROM public.posting_line WHERE tenant_id=${TENANT}::uuid) AS postings,
      (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
      (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
      (SELECT count(*)::int FROM public.api_idempotency WHERE tenant_id=${TENANT}::uuid) AS idempotency
  `;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 16, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 48, prepare: false });
  readiness = new CheckoutReadinessService({ database });
  settlements = new FolioSettlementService({
    database,
    events: new PostgresEventBus(eventPool),
    idempotency: new PostgresIdempotency(),
  });
  await cleanup();
  businessDate = (await deploy<Array<{ date: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS date
  `)[0]!.date;
  await deploy`INSERT INTO public.tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order203','Order 203','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order203-foreign','Order 203 Foreign','shared','active')`;
  await deploy`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order203'::ltree,'property','Order 203','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order203_foreign'::ltree,'property','Foreign','UTC','USD')`;
  await deploy`INSERT INTO public.app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'operator@order203.test','Order 203 Operator','active')`;
  await deploy`INSERT INTO public.party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Order 203 Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
  await deploy`INSERT INTO public.party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${PARTY}::uuid,'guest'),
    (${FOREIGN_TENANT}::uuid,${FOREIGN_PARTY}::uuid,'guest')`;
  await deploy`INSERT INTO public.unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
    (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O203','Order 203','order203-room')`;
  await deploy`INSERT INTO public.rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive) VALUES
    (${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O203','Order 203','USD',false)`;
  await deploy`INSERT INTO public.account(id,tenant_id,property_node,role,name,currency,status) VALUES
    (${REVENUE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'revenue','Order 203 Revenue','USD','open')`;
  await deploy`INSERT INTO public.business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${businessDate}::date)`;
  await deploy`INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    (${TX_CODE},'Order 203 proof','revenue','Rooms','guest','revenue')`;
  await deploy`INSERT INTO public.reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES(
      ${FOREIGN_RESERVATION}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,
      'O203-FOREIGN','in_house',${FOREIGN_PARTY}::uuid,'direct','USD'
    )`;
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await deploy?.close({ timeout: 0 });
});

databaseDescribe("Order 203 governed departure readiness snapshot", () => {
  test("P1 exact ready snapshot is deeply frozen and orders every folio window", async () => {
    const fixture = await createCase({ folios: Object.freeze([
      { status: "closed", windowNo: 3, name: "Third", folioNo: null },
      { status: "settled", windowNo: 1, name: "First" },
      { status: "settled", windowNo: 2, name: "Second" },
    ]) });
    const result = await readiness!.read(input(fixture.reservationId));
    expect(result).toMatchObject({
      reservationId: fixture.reservationId,
      reservationStatus: "in_house",
      ready: true,
      blockers: [],
      segment: { segmentId: fixture.segmentId, periodStart: PERIOD_START, periodEnd: PERIOD_END },
      room: { spaceId: fixture.spaceId },
      occupancy: { occupancyId: fixture.occupancyId, periodStart: PERIOD_START, periodEnd: PERIOD_END },
    });
    expect(result.folios.map((folio) => [folio.windowNo, folio.folioId])).toEqual(
      [...result.folios].sort((left, right) => left.windowNo - right.windowNo || left.folioId.localeCompare(right.folioId))
        .map((folio) => [folio.windowNo, folio.folioId]),
    );
    expect(result.folios.map((folio) => folio.balanceMinor)).toEqual(["0", "0", "0"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.blockers)).toBe(true);
    expect(Object.isFrozen(result.segment)).toBe(true);
    expect(Object.isFrozen(result.room)).toBe(true);
    expect(Object.isFrozen(result.occupancy)).toBe(true);
    expect(Object.isFrozen(result.folios)).toBe(true);
    expect(result.folios.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Order 203 Guest");
  });

  test("P2 exercises every fixed blocker and preserves exact order for combined failures", async () => {
    const wrongState = await createCase({ reservationStatus: "reserved" });
    expect((await readiness!.read(input(wrongState.reservationId))).blockers)
      .toEqual(["reservation_not_departure_state"]);

    const noSegment = await createCase({ segmentCount: 0 });
    expect((await readiness!.read(input(noSegment.reservationId))).blockers).toEqual([
      "current_segment_missing_or_ambiguous",
      "physical_room_missing_or_ambiguous",
      "occupancy_missing_or_ambiguous",
    ]);
    const twoSegments = await createCase({ segmentCount: 2 });
    expect((await readiness!.read(input(twoSegments.reservationId))).blockers).toEqual([
      "current_segment_missing_or_ambiguous",
      "physical_room_missing_or_ambiguous",
      "occupancy_missing_or_ambiguous",
    ]);
    const noRoom = await createCase({ roomCount: 0 });
    expect((await readiness!.read(input(noRoom.reservationId))).blockers).toEqual([
      "physical_room_missing_or_ambiguous", "occupancy_missing_or_ambiguous",
    ]);
    const twoRooms = await createCase({ roomCount: 2, occupancy: false });
    expect((await readiness!.read(input(twoRooms.reservationId))).blockers).toEqual([
      "physical_room_missing_or_ambiguous", "occupancy_missing_or_ambiguous",
    ]);
    const noOccupancy = await createCase({ occupancy: false });
    expect((await readiness!.read(input(noOccupancy.reservationId))).blockers)
      .toEqual(["occupancy_missing_or_ambiguous"]);
    const noFolio = await createCase({ folios: Object.freeze([]) });
    expect((await readiness!.read(input(noFolio.reservationId))).blockers)
      .toEqual(["folio_window_missing"]);
    const openZero = await createCase({ folios: Object.freeze([{ status: "open" }]) });
    expect((await readiness!.read(input(openZero.reservationId))).blockers)
      .toEqual(["folio_window_unsettled"]);
    const settledNonzero = await createCase({
      folios: Object.freeze([{ status: "settled", balanceMinor: 500 }]),
    });
    expect((await readiness!.read(input(settledNonzero.reservationId))).blockers)
      .toEqual(["folio_window_nonzero"]);

    const combined = await createCase({
      reservationStatus: "cancelled", segmentCount: 0,
      folios: Object.freeze([{ status: "open", balanceMinor: 700 }]),
    });
    expect((await readiness!.read(input(combined.reservationId))).blockers)
      .toEqual(CHECKOUT_READINESS_BLOCKERS.filter((blocker) => blocker !== "folio_window_missing"));
  });

  test("P3 every read is byte-for-byte mutation-free", async () => {
    const fixture = await createCase();
    const before = await readSnapshot(fixture);
    for (let index = 0; index < 10; index += 1) {
      expect((await readiness!.read(input(fixture.reservationId))).ready).toBe(true);
    }
    expect(await readSnapshot(fixture)).toEqual(before);
  });

  test("P3 a real settlement race yields only coherent pre- or post-transition snapshots", async () => {
    const fixture = await createCase({ folios: Object.freeze([{ status: "open" }]) });
    const reads = Array.from({ length: 30 }, () => readiness!.read(input(fixture.reservationId)));
    const settlement = settlements!.settle({
      tenantId: TENANT,
      folioId: fixture.folioIds[0]!,
      idempotencyKey: "order203-read-settlement-race",
      envelope: createAuditEnvelope({
        tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR,
        requestId: crypto.randomUUID(), operation: "folio.settled",
      }),
    });
    const [results, settled] = await Promise.all([Promise.all(reads), settlement]);
    expect(settled.status).toBe("settled");
    for (const result of results) {
      const coherentBefore = !result.ready && result.blockers.length === 1 &&
        result.blockers[0] === "folio_window_unsettled" && result.folios[0]?.status === "open";
      const coherentAfter = result.ready && result.blockers.length === 0 &&
        result.folios[0]?.status === "settled";
      expect(coherentBefore || coherentAfter).toBe(true);
    }
    expect((await readiness!.read(input(fixture.reservationId))).ready).toBe(true);
  });

  test("P4 malformed and foreign tenant/property/reservation targets conceal without writes", async () => {
    const fixture = await createCase();
    const before = await readSnapshot(fixture);
    await expect(readiness!.read({ ...input(fixture.reservationId), reservationId: "NOT-A-UUID" }))
      .rejects.toBeInstanceOf(CheckoutReadinessValidationError);
    await expect(readiness!.read(input(FOREIGN_RESERVATION)))
      .rejects.toBeInstanceOf(CheckoutReadinessNotFoundError);
    await expect(readiness!.read(input(fixture.reservationId, { propertyNode: FOREIGN_PROPERTY })))
      .rejects.toBeInstanceOf(CheckoutReadinessNotFoundError);
    await expect(readiness!.read(input(crypto.randomUUID())))
      .rejects.toBeInstanceOf(CheckoutReadinessNotFoundError);
    expect(await readSnapshot(fixture)).toEqual(before);
  });
});
