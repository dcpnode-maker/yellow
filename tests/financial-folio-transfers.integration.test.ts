import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ChargeCorrectionService,
  ChargeService,
  FolioService,
  FolioTransferConflictError,
  FolioTransferService,
  type FolioTransferInput,
  type OpenAdditionalFolioInput,
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

const URL = process.env.YELLOW_FOLIO_TRANSFERS_URL;
const ADMIN_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_FOLIO_TRANSFERS === "1" && (!URL || !ADMIN_URL)) {
  throw new Error("YELLOW_FOLIO_TRANSFERS_URL and YELLOW_DEPLOY_DATABASE_URL are required by the Order 188 proof");
}

const TENANT = "00000000-0000-0000-0000-000000018801";
const OTHER_TENANT = "00000000-0000-0000-0000-000000018802";
const PROPERTY = "00000000-0000-0000-0000-000000018811";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000018812";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000018813";
const ACTOR = "00000000-0000-0000-0000-000000018821";
const OTHER_ACTOR = "00000000-0000-0000-0000-000000018822";
const PARTY = "00000000-0000-0000-0000-000000018831";
const OTHER_PARTY = "00000000-0000-0000-0000-000000018832";

const MAIN_RESERVATION = "00000000-0000-0000-0000-000000018841";
const OTHER_RESERVATION = "00000000-0000-0000-0000-000000018842";
const WINDOW_RESERVATION = "00000000-0000-0000-0000-000000018843";
const RACE_RESERVATION = "00000000-0000-0000-0000-000000018844";
const ROLLBACK_RESERVATION = "00000000-0000-0000-0000-000000018845";
const ARBITRATION_RESERVATION = "00000000-0000-0000-0000-000000018846";
const OTHER_PROPERTY_RESERVATION = "00000000-0000-0000-0000-000000018847";
const FOREIGN_RESERVATION = "00000000-0000-0000-0000-000000018848";

const MAIN_ACCOUNT = "00000000-0000-0000-0000-000000018851";
const OTHER_ACCOUNT = "00000000-0000-0000-0000-000000018852";
const WINDOW_ACCOUNT = "00000000-0000-0000-0000-000000018853";
const RACE_ACCOUNT = "00000000-0000-0000-0000-000000018854";
const ROLLBACK_ACCOUNT = "00000000-0000-0000-0000-000000018855";
const ARBITRATION_ACCOUNT = "00000000-0000-0000-0000-000000018856";
const OTHER_PROPERTY_ACCOUNT = "00000000-0000-0000-0000-000000018857";
const FOREIGN_ACCOUNT = "00000000-0000-0000-0000-000000018858";
const REVENUE = "00000000-0000-0000-0000-000000018859";
const OTHER_REVENUE = "00000000-0000-0000-0000-000000018860";
const FOREIGN_REVENUE = "00000000-0000-0000-0000-000000018861";

const MAIN = Object.freeze([
  "00000000-0000-0000-0000-000000018871",
  "00000000-0000-0000-0000-000000018872",
  "00000000-0000-0000-0000-000000018873",
  "00000000-0000-0000-0000-000000018874",
]);
const OTHER_FOLIO = "00000000-0000-0000-0000-000000018875";
const WINDOW_SOURCE = "00000000-0000-0000-0000-000000018876";
const RACE = Object.freeze([
  "00000000-0000-0000-0000-000000018877",
  "00000000-0000-0000-0000-000000018878",
]);
const ROLLBACK = Object.freeze([
  "00000000-0000-0000-0000-000000018879",
  "00000000-0000-0000-0000-000000018880",
]);
const ARBITRATION = Object.freeze([
  "00000000-0000-0000-0000-000000018881",
  "00000000-0000-0000-0000-000000018882",
]);
const OTHER_PROPERTY_FOLIO = "00000000-0000-0000-0000-000000018883";
const FOREIGN_FOLIO = "00000000-0000-0000-0000-000000018884";

const ROOM = "O188ROOM";
const SPA = "O188SPA";
const ALCOHOL = "O188ALC";
const dbDescribe = URL && ADMIN_URL ? describe.serial : describe.skip;

let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let folios: FolioService | undefined;
let transfers: FolioTransferService | undefined;
let charges: ChargeService | undefined;
let corrections: ChargeCorrectionService | undefined;
let day = "";

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 188 injected publisher failure after outbox insertion");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

function journalEnvelope() {
  return createAuditEnvelope({ operation: "journal.posted", tenantId: TENANT,
    propertyNode: PROPERTY, actorId: ACTOR, requestId: crypto.randomUUID() });
}

function folioEnvelope() {
  return createAuditEnvelope({ operation: "folio.opened", tenantId: TENANT,
    propertyNode: PROPERTY, actorId: ACTOR, requestId: crypto.randomUUID() });
}

function serviceFor(bus: EventBus): FolioTransferService {
  const folioService = new FolioService({ events: bus, idempotency: new PostgresIdempotency() });
  return new FolioTransferService({ events: bus, idempotency: new PostgresIdempotency(), folios: folioService });
}

async function transaction<T>(operation: (tx: Tx) => Promise<T>, tenantId = TENANT): Promise<T> {
  return database!.withTenantTransaction(tenantId, operation);
}

async function post(folioId: string, txCode: string, amountMinor: string, key: string) {
  return transaction((tx) => charges!.postCharge(tx, {
    tenantId: TENANT, folioId, txCode, amountMinor, quantity: "1.000",
    idempotencyKey: key, envelope: journalEnvelope(),
  }));
}

async function correct(folioId: string, journalId: string, key: string) {
  return transaction((tx) => corrections!.reverseCharge(tx, {
    tenantId: TENANT, folioId, reversesJournalId: journalId,
    reason: "Correct the governed charge without deleting history", postSealAuthorized: false,
    idempotencyKey: key, envelope: journalEnvelope(),
  }));
}

async function familyGeneration(sourceFolioId: string): Promise<string> {
  const family = await admin!<Array<{ id: string; window_no: number; balance_minor: string }>>`
    WITH source AS (SELECT tenant_id,reservation_id FROM folio WHERE id=${sourceFolioId}::uuid)
    SELECT folio.id,folio.window_no,COALESCE(balance.balance_minor,0)::text balance_minor
      FROM source JOIN folio ON folio.tenant_id=source.tenant_id
       AND folio.reservation_id=source.reservation_id
      LEFT JOIN folio_balance balance ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
     ORDER BY folio.window_no,folio.id`;
  const canonical = family.map((folio) => `${folio.id}:${folio.window_no}:${folio.balance_minor}`).join("|");
  return new Bun.CryptoHasher("md5").update(canonical).digest("hex");
}

async function transferRequest(sourceFolioId: string, destinationFolioId: string,
  groupIds: readonly string[], key = `order188-transfer-${crypto.randomUUID()}`,
  reason = "Route the whole governed group to its requested folio") {
  const base: FolioTransferInput = {
    tenantId: TENANT, sourceFolioId, destinationFolioId, groupIds,
    reason, generation: await familyGeneration(sourceFolioId), previewRevision: "",
    idempotencyKey: key, envelope: journalEnvelope(),
  };
  const preview = await transaction((tx) => transfers!.preview(tx, base));
  return Object.freeze({ ...base, previewRevision: preview.previewRevision });
}

async function commit(request: FolioTransferInput, service = transfers!) {
  return transaction((tx) => service.transfer(tx, request));
}

async function openAdditional(name: string, key: string, service = folios!) {
  const request: OpenAdditionalFolioInput = {
    tenantId: TENANT, reservationId: WINDOW_RESERVATION, sourceFolioId: WINDOW_SOURCE,
    name, idempotencyKey: key, envelope: folioEnvelope(),
  };
  return transaction((tx) => service.openAdditional(tx, request));
}

async function transferArtifacts() {
  return (await admin!<Array<{ journals: number; lines: number; facts: number; events: number; keys: number }>>`
    SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid AND kind='transfer') journals,
      (SELECT count(*)::int FROM posting_line line JOIN journal header
        ON header.tenant_id=line.tenant_id AND header.id=line.journal_id
        WHERE line.tenant_id=${TENANT}::uuid AND header.kind='transfer') lines,
      (SELECT count(*)::int FROM fact_log fact WHERE fact.tenant_id=${TENANT}::uuid
        AND fact.fact_type='journal.posted' AND fact.entity_id IN (SELECT id FROM journal
          WHERE tenant_id=${TENANT}::uuid AND kind='transfer')) facts,
      (SELECT count(*)::int FROM outbox event WHERE event.tenant_id=${TENANT}::uuid
        AND event.event_type='journal.posted' AND event.aggregate_id IN (SELECT id FROM journal
          WHERE tenant_id=${TENANT}::uuid AND kind='transfer')) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid
        AND operation='financials.folio.transfer') keys`)[0]!;
}

async function expectSqlState(action: () => Promise<unknown>, state: string | readonly string[]): Promise<void> {
  try {
    await action();
  } catch (error) {
    const actual = (error as { errno?: string; code?: string }).errno ?? (error as { code?: string }).code;
    expect(Array.isArray(state) ? state : [state]).toContain(actual);
    return;
  }
  throw new Error(`Expected SQLSTATE ${Array.isArray(state) ? state.join("/") : state}`);
}

async function clean(): Promise<void> {
  if (!admin) return;
  for (const table of ["api_idempotency", "outbox", "fact_log", "posting_line", "journal",
    "tx_code_route", "business_day", "folio", "account", "document_series", "reservation_guest",
    "reservation", "app_user", "party_role", "party", "org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT, OTHER_TENANT]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${OTHER_TENANT}::uuid)`;
  await admin`DELETE FROM tx_code WHERE code IN (${ROOM},${SPA},${ALCOHOL})`;
}

async function seed(): Promise<void> {
  await clean();
  day = (await admin!<Array<{ business_date: string }>>`
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS business_date`)[0]!.business_date;
  await admin!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order188-a','Order 188 A','shared','active'),
    (${OTHER_TENANT}::uuid,'order188-b','Order 188 B','shared','active')`;
  await admin!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order188_a','property','Order 188 A','UTC','INR'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order188_other','property','Order 188 Other','UTC','CAD'),
    (${FOREIGN_PROPERTY}::uuid,${OTHER_TENANT}::uuid,'order188_foreign','property','Order 188 Foreign','UTC','INR')`;
  await admin!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'actor@order188.test','Order 188 Actor','active'),
    (${OTHER_ACTOR}::uuid,${OTHER_TENANT}::uuid,'other@order188.test','Order 188 Other','active')`;
  await admin!`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Order 188 Guest','active'),
    (${OTHER_PARTY}::uuid,${OTHER_TENANT}::uuid,'person','Order 188 Foreign','active')`;
  await admin!`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${PARTY}::uuid,'guest'),
    (${OTHER_TENANT}::uuid,${OTHER_PARTY}::uuid,'guest')`;
  await admin!`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency) VALUES
    (${MAIN_RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O188-MAIN','in_house',${PARTY}::uuid,'direct','INR'),
    (${OTHER_RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O188-OTHER','in_house',${PARTY}::uuid,'direct','INR'),
    (${WINDOW_RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O188-WINDOW','in_house',${PARTY}::uuid,'direct','INR'),
    (${RACE_RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O188-RACE','in_house',${PARTY}::uuid,'direct','INR'),
    (${ROLLBACK_RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O188-ROLLBACK','in_house',${PARTY}::uuid,'direct','INR'),
    (${ARBITRATION_RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O188-ARBITRATE','in_house',${PARTY}::uuid,'direct','INR'),
    (${OTHER_PROPERTY_RESERVATION}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'O188-PROP','in_house',${PARTY}::uuid,'direct','CAD'),
    (${FOREIGN_RESERVATION}::uuid,${OTHER_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'O188-FOREIGN','in_house',${OTHER_PARTY}::uuid,'direct','INR')`;
  await admin!`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
    (${MAIN_ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Main guest','INR','open'),
    (${OTHER_ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Other guest','INR','open'),
    (${WINDOW_ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Window guest','INR','open'),
    (${RACE_ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Race guest','INR','open'),
    (${ROLLBACK_ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Rollback guest','INR','open'),
    (${ARBITRATION_ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${PARTY}::uuid,'Arbitration guest','INR','open'),
    (${OTHER_PROPERTY_ACCOUNT}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'guest',${PARTY}::uuid,'Other property guest','CAD','open'),
    (${FOREIGN_ACCOUNT}::uuid,${OTHER_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'guest',${OTHER_PARTY}::uuid,'Foreign guest','INR','open'),
    (${REVENUE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'revenue',NULL,'Revenue','INR','open'),
    (${OTHER_REVENUE}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'revenue',NULL,'Other revenue','CAD','open'),
    (${FOREIGN_REVENUE}::uuid,${OTHER_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'revenue',NULL,'Foreign revenue','INR','open')`;
  await admin!`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status) VALUES
    (${MAIN[0]}::uuid,${TENANT}::uuid,${MAIN_ACCOUNT}::uuid,${MAIN_RESERVATION}::uuid,'O188-M1',1,'Primary','open'),
    (${MAIN[1]}::uuid,${TENANT}::uuid,${MAIN_ACCOUNT}::uuid,${MAIN_RESERVATION}::uuid,'O188-M2',2,'Business','open'),
    (${MAIN[2]}::uuid,${TENANT}::uuid,${MAIN_ACCOUNT}::uuid,${MAIN_RESERVATION}::uuid,'O188-M3',3,'Personal','open'),
    (${MAIN[3]}::uuid,${TENANT}::uuid,${MAIN_ACCOUNT}::uuid,${MAIN_RESERVATION}::uuid,'O188-M4',4,'Corrections','open'),
    (${OTHER_FOLIO}::uuid,${TENANT}::uuid,${OTHER_ACCOUNT}::uuid,${OTHER_RESERVATION}::uuid,'O188-O1',1,'Other','open'),
    (${WINDOW_SOURCE}::uuid,${TENANT}::uuid,${WINDOW_ACCOUNT}::uuid,${WINDOW_RESERVATION}::uuid,'O188-W1',1,'Primary','open'),
    (${RACE[0]}::uuid,${TENANT}::uuid,${RACE_ACCOUNT}::uuid,${RACE_RESERVATION}::uuid,'O188-R1',1,'Primary','open'),
    (${RACE[1]}::uuid,${TENANT}::uuid,${RACE_ACCOUNT}::uuid,${RACE_RESERVATION}::uuid,'O188-R2',2,'Destination','open'),
    (${ROLLBACK[0]}::uuid,${TENANT}::uuid,${ROLLBACK_ACCOUNT}::uuid,${ROLLBACK_RESERVATION}::uuid,'O188-B1',1,'Primary','open'),
    (${ROLLBACK[1]}::uuid,${TENANT}::uuid,${ROLLBACK_ACCOUNT}::uuid,${ROLLBACK_RESERVATION}::uuid,'O188-B2',2,'Destination','open'),
    (${ARBITRATION[0]}::uuid,${TENANT}::uuid,${ARBITRATION_ACCOUNT}::uuid,${ARBITRATION_RESERVATION}::uuid,'O188-A1',1,'Primary','open'),
    (${ARBITRATION[1]}::uuid,${TENANT}::uuid,${ARBITRATION_ACCOUNT}::uuid,${ARBITRATION_RESERVATION}::uuid,'O188-A2',2,'Destination','open'),
    (${OTHER_PROPERTY_FOLIO}::uuid,${TENANT}::uuid,${OTHER_PROPERTY_ACCOUNT}::uuid,${OTHER_PROPERTY_RESERVATION}::uuid,'O188-P1',1,'Other property','open'),
    (${FOREIGN_FOLIO}::uuid,${OTHER_TENANT}::uuid,${FOREIGN_ACCOUNT}::uuid,${FOREIGN_RESERVATION}::uuid,'O188-F1',1,'Foreign','open')`;
  await admin!`INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,'folio','O188-',100,false),
    (${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'folio','O188P-',1,false),
    (${OTHER_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'folio','O188F-',1,false)`;
  await admin!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
    (${ROOM},'Order 188 room','revenue','Rooms','guest','revenue'),
    (${SPA},'Order 188 spa','revenue','Spa','guest','revenue'),
    (${ALCOHOL},'Order 188 alcohol','revenue','Food and beverage','guest','revenue')`;
  await admin!`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,'INR',${ROOM},${REVENUE}::uuid),
    (${TENANT}::uuid,${PROPERTY}::uuid,'INR',${SPA},${REVENUE}::uuid),
    (${TENANT}::uuid,${PROPERTY}::uuid,'INR',${ALCOHOL},${REVENUE}::uuid),
    (${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'CAD',${ROOM},${OTHER_REVENUE}::uuid),
    (${OTHER_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'INR',${ROOM},${FOREIGN_REVENUE}::uuid)`;
  await admin!`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES
    (${TENANT}::uuid,${PROPERTY}::uuid,${day}::date),
    (${TENANT}::uuid,${OTHER_PROPERTY}::uuid,${day}::date),
    (${OTHER_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,${day}::date)`;
}

beforeAll(async () => {
  if (!URL) return;
  admin = new SQL(ADMIN_URL!, { max: 50, prepare: false });
  eventPool = new SQL(URL, { max: 50, prepare: false });
  database = Database.connect(URL, { maxConnections: 60, prepare: false });
  events = new PostgresEventBus(eventPool);
  folios = new FolioService({ events, idempotency: new PostgresIdempotency() });
  transfers = new FolioTransferService({ events, idempotency: new PostgresIdempotency(), folios });
  charges = new ChargeService({ events, idempotency: new PostgresIdempotency() });
  corrections = new ChargeCorrectionService({ events, idempotency: new PostgresIdempotency() });
}, 30_000);

beforeEach(async () => { if (URL) await seed(); }, 30_000);
afterAll(async () => { await clean(); await database?.close(); await eventPool?.close(); await admin?.close(); }, 60_000);

dbDescribe("Order 188 fresh-PostgreSQL multi-window and immutable routing proof", () => {
  test("P2: twenty concurrent additional-window commands serialize to the exact gap-free cap", async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      openAdditional(`Window ${String(index + 2).padStart(2, "0")}`, `order188-window-${index}`)));
    const accepted = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof openAdditional>>> =>
      result.status === "fulfilled").map((result) => result.value);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(accepted).toHaveLength(19);
    expect(rejected).toHaveLength(1);
    expect(accepted.map((result) => result.windowNo).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 19 }, (_, index) => index + 2));
    expect(accepted.map((result) => Number(result.folioNo.slice("O188-".length))).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 19 }, (_, index) => index + 100));
    expect(new Set(accepted.map((result) => result.folioId)).size).toBe(19);
    const rows = await admin!<Array<{ window_no: number; folio_no: string }>>`
      SELECT window_no,folio_no FROM folio WHERE tenant_id=${TENANT}::uuid
       AND reservation_id=${WINDOW_RESERVATION}::uuid ORDER BY window_no`;
    expect(rows.map((row) => row.window_no)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect((await admin!<Array<{ next_no: string }>>`SELECT next_no::text FROM document_series
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND kind='folio'`)[0]!.next_no).toBe("119");
  }, 60_000);

  test("P2: additional-window replay is exact, changed content conflicts and publisher rollback leaves no gap", async () => {
    const exact = await openAdditional("Business", "order188-window-replay");
    expect(await openAdditional("Business", "order188-window-replay")).toEqual({ ...exact, replayed: true });
    await expect(openAdditional("Personal", "order188-window-replay"))
      .rejects.toBeInstanceOf(IdempotencyConflictError);

    const next = (await admin!<Array<{ next_no: string }>>`SELECT next_no::text FROM document_series
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND kind='folio'`)[0]!.next_no;
    const failingFolios = new FolioService({ events: new FailAfterPublishBus(events!),
      idempotency: new PostgresIdempotency() });
    await expect(openAdditional("Rollback", "order188-window-rollback", failingFolios))
      .rejects.toThrow("injected publisher failure");
    expect((await admin!<Array<{ count: number }>>`SELECT count(*)::int count FROM folio
      WHERE tenant_id=${TENANT}::uuid AND reservation_id=${WINDOW_RESERVATION}::uuid`)[0]!.count).toBe(2);
    expect((await admin!<Array<{ next_no: string }>>`SELECT next_no::text FROM document_series
      WHERE tenant_id=${TENANT}::uuid AND property_node=${PROPERTY}::uuid AND kind='folio'`)[0]!.next_no).toBe(next);
    expect(await openAdditional("Rollback", "order188-window-rollback")).toMatchObject({
      folioNo: `O188-${next}`, windowNo: 3, changed: true, replayed: false,
    });
  }, 30_000);

  test("P3: room, spa/alcohol and corrected pairs route whole with balanced immutable zero-net truth", async () => {
    const room = await post(MAIN[0]!, ROOM, "10000", "order188-main-room");
    const spa = await post(MAIN[0]!, SPA, "3000", "order188-main-spa");
    const alcohol = await post(MAIN[0]!, ALCOHOL, "2000", "order188-main-alcohol");
    const corrected = await post(MAIN[0]!, ROOM, "500", "order188-main-corrected");
    const reversal = await correct(MAIN[0]!, corrected.journalId, "order188-main-correction");
    const immutableBefore = await admin!<Array<{ digest: string; count: number }>>`
      SELECT md5(string_agg(row_to_json(snapshot)::text,'|' ORDER BY snapshot.id)) digest,count(*)::int count
      FROM (SELECT id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,
                   business_date,currency,folio_transfer_root_line_id FROM posting_line
            WHERE tenant_id=${TENANT}::uuid AND journal_id IN (${corrected.journalId}::uuid,${reversal.journalId}::uuid)) snapshot`;

    await commit(await transferRequest(MAIN[0]!, MAIN[1]!, [room.journalId], "order188-route-room"));
    await commit(await transferRequest(MAIN[0]!, MAIN[2]!, [spa.journalId, alcohol.journalId], "order188-route-personal"));
    await commit(await transferRequest(MAIN[0]!, MAIN[3]!, [corrected.journalId], "order188-route-corrected"));

    const balances = await admin!<Array<{ id: string; balance_minor: string }>>`
      SELECT folio.id,COALESCE(balance.balance_minor,0)::text balance_minor FROM folio
      LEFT JOIN folio_balance balance ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
      WHERE folio.tenant_id=${TENANT}::uuid AND folio.reservation_id=${MAIN_RESERVATION}::uuid
      ORDER BY folio.window_no`;
    expect(balances).toEqual([
      { id: MAIN[0]!, balance_minor: "0" }, { id: MAIN[1]!, balance_minor: "10000" },
      { id: MAIN[2]!, balance_minor: "5000" }, { id: MAIN[3]!, balance_minor: "0" },
    ]);
    expect(balances.reduce((sum, row) => sum + BigInt(row.balance_minor), 0n)).toBe(15000n);
    const transferJournals = await admin!<Array<{ id: string; balance: string; lines: number }>>`
      SELECT header.id,sum(line.amount_minor)::text balance,count(*)::int lines
      FROM journal header JOIN posting_line line ON line.tenant_id=header.tenant_id AND line.journal_id=header.id
      WHERE header.tenant_id=${TENANT}::uuid AND header.kind='transfer' GROUP BY header.id ORDER BY header.id`;
    expect(transferJournals).toHaveLength(3);
    expect(transferJournals.every((journal) => journal.balance === "0" && journal.lines >= 2)).toBeTrue();
    const immutableAfter = await admin!<Array<{ digest: string; count: number }>>`
      SELECT md5(string_agg(row_to_json(snapshot)::text,'|' ORDER BY snapshot.id)) digest,count(*)::int count
      FROM (SELECT id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,
                   business_date,currency,folio_transfer_root_line_id FROM posting_line
            WHERE tenant_id=${TENANT}::uuid AND journal_id IN (${corrected.journalId}::uuid,${reversal.journalId}::uuid)) snapshot`;
    expect(immutableAfter).toEqual(immutableBefore);
    const correctedLineage = await admin!<Array<{ roots: number; lines: number }>>`
      SELECT count(DISTINCT folio_transfer_root_line_id)::int roots,count(*)::int lines FROM posting_line
      WHERE tenant_id=${TENANT}::uuid AND journal_id IN (SELECT id FROM journal
        WHERE tenant_id=${TENANT}::uuid AND kind='transfer') AND folio_transfer_root_line_id IN (
          SELECT id FROM posting_line WHERE tenant_id=${TENANT}::uuid
            AND journal_id IN (${corrected.journalId}::uuid,${reversal.journalId}::uuid) AND seq=1)`;
    expect(correctedLineage).toEqual([{ roots: 2, lines: 4 }]);
  }, 30_000);

  test("P4: rerouting preserves typed history and exact replay while a changed body conflicts", async () => {
    const charge = await post(MAIN[0]!, ROOM, "7000", "order188-reroute-charge");
    const firstRequest = await transferRequest(MAIN[0]!, MAIN[1]!, [charge.journalId], "order188-reroute-one");
    const first = await commit(firstRequest);
    expect(await commit(firstRequest)).toEqual({ ...first, replayed: true });
    await expect(commit({ ...firstRequest, reason: "Changed route body" }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
    await commit(await transferRequest(MAIN[1]!, MAIN[2]!, [charge.journalId], "order188-reroute-two"));
    const roots = await admin!<Array<{ root: string; lines: number; journals: number; allocation: string }>>`
      WITH root AS (SELECT id FROM posting_line WHERE tenant_id=${TENANT}::uuid
        AND journal_id=${charge.journalId}::uuid AND seq=1), allocation AS (
        SELECT candidate.folio_id,sum(candidate.amount_minor)::text amount
        FROM posting_line candidate,root WHERE candidate.tenant_id=${TENANT}::uuid
          AND candidate.account_id=${MAIN_ACCOUNT}::uuid
          AND COALESCE(candidate.folio_transfer_root_line_id,candidate.id)=root.id
        GROUP BY candidate.folio_id HAVING sum(candidate.amount_minor)<>0)
      SELECT root.id root,
        (SELECT count(*)::int FROM posting_line line WHERE line.tenant_id=${TENANT}::uuid
          AND line.folio_transfer_root_line_id=root.id) lines,
        (SELECT count(DISTINCT journal_id)::int FROM posting_line line WHERE line.tenant_id=${TENANT}::uuid
          AND line.folio_transfer_root_line_id=root.id) journals,
        (SELECT folio_id::text||':'||amount FROM allocation) allocation FROM root`;
    expect(roots).toEqual([{ root: expect.any(String), lines: 4, journals: 2, allocation: `${MAIN[2]}:7000` }]);
  }, 30_000);

  test("P4: a twenty-way same-group race has exactly one durable winner", async () => {
    const charge = await post(RACE[0]!, ROOM, "4321", "order188-race-charge");
    const generation = await familyGeneration(RACE[0]!);
    const bases = Array.from({ length: 20 }, (_, index): FolioTransferInput => ({
      tenantId: TENANT, sourceFolioId: RACE[0]!, destinationFolioId: RACE[1]!,
      groupIds: [charge.journalId], reason: "Twenty-way governed route",
      generation, previewRevision: "", idempotencyKey: `order188-race-${index}`,
      envelope: journalEnvelope(),
    }));
    const requests = await Promise.all(bases.map(async (base) => {
      const preview = await transaction((tx) => transfers!.preview(tx, base));
      return { ...base, previewRevision: preview.previewRevision };
    }));
    const settled = await Promise.allSettled(requests.map((request) => commit(request)));
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(19);
    const artifacts = await transferArtifacts();
    expect(artifacts.journals).toBe(1);
    expect(artifacts.lines).toBe(2);
    expect(artifacts.keys).toBe(1);
    const destination = (await admin!<Array<{ balance: string }>>`SELECT balance_minor::text balance
      FROM folio_balance WHERE tenant_id=${TENANT}::uuid AND folio_id=${RACE[1]}::uuid`)[0]!;
    expect(destination.balance).toBe("4321");
  }, 60_000);

  test("P4: publisher failure rolls journal, lineage, fact, outbox and idempotency back before retry", async () => {
    const charge = await post(ROLLBACK[0]!, SPA, "8765", "order188-rollback-charge");
    const request = await transferRequest(ROLLBACK[0]!, ROLLBACK[1]!, [charge.journalId], "order188-transfer-rollback");
    const before = await transferArtifacts();
    await expect(commit(request, serviceFor(new FailAfterPublishBus(events!))))
      .rejects.toThrow("injected publisher failure");
    expect(await transferArtifacts()).toEqual(before);
    expect(await commit(request)).toMatchObject({ destinationFolioId: ROLLBACK[1], replayed: false });
  }, 30_000);

  test("P4: transfer versus correction arbitration permits one coherent outcome", async () => {
    const charge = await post(ARBITRATION[0]!, ROOM, "2468", "order188-arbitration-charge");
    const request = await transferRequest(ARBITRATION[0]!, ARBITRATION[1]!, [charge.journalId], "order188-arbitration-transfer");
    const correctionInput = {
      tenantId: TENANT, folioId: ARBITRATION[0]!, reversesJournalId: charge.journalId,
      reason: "Race correction against immutable routing", postSealAuthorized: false,
      idempotencyKey: "order188-arbitration-correction", envelope: journalEnvelope(),
    } as const;
    const settled = await Promise.allSettled([
      commit(request),
      transaction((tx) => corrections!.reverseCharge(tx, correctionInput)),
    ]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);
    const facts = await admin!<Array<{ transfers: number; corrections: number }>>`
      SELECT
        (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid AND kind='transfer') transfers,
        (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid AND reverses=${charge.journalId}::uuid) corrections`;
    expect(facts[0]!.transfers + facts[0]!.corrections).toBe(1);
    const balance = (await admin!<Array<{ amount: string }>>`SELECT sum(amount_minor)::text amount FROM posting_line
      WHERE tenant_id=${TENANT}::uuid AND account_id=${ARBITRATION_ACCOUNT}::uuid`)[0]!.amount;
    expect(["0", "2468"]).toContain(balance);
  }, 30_000);

  test("P5: sealed, closed and every hostile boundary plus forged/raw lineage leave zero mutation", async () => {
    const charge = await post(MAIN[0]!, ROOM, "1111", "order188-hostile-charge");
    const root = (await admin!<Array<{ id: string }>>`SELECT id FROM posting_line WHERE tenant_id=${TENANT}::uuid
      AND journal_id=${charge.journalId}::uuid AND seq=1`)[0]!.id;
    const capability = (destination: string, tenantId = TENANT, actor = ACTOR, roots = [root]) =>
      transaction((tx) => tx.unsafe(
        "SELECT * FROM public.create_folio_transfer($1::uuid,$2::uuid,$3::uuid,$4::uuid[],$5::uuid,$6)",
        [tenantId, MAIN[0], destination, `{${roots.join(",")}}`, actor, "Hostile boundary proof"],
      ));
    const before = await transferArtifacts();

    await admin!`UPDATE business_day SET sealed_at=statement_timestamp() WHERE tenant_id=${TENANT}::uuid
      AND property_node=${PROPERTY}::uuid AND business_date=${day}::date`;
    await expectSqlState(() => capability(MAIN[1]!), "P0011");
    await admin!`UPDATE business_day SET sealed_at=NULL WHERE tenant_id=${TENANT}::uuid
      AND property_node=${PROPERTY}::uuid AND business_date=${day}::date`;
    await admin!`UPDATE folio SET status='closed' WHERE tenant_id=${TENANT}::uuid AND id=${MAIN[1]}::uuid`;
    await expectSqlState(() => capability(MAIN[1]!), "55000");
    await admin!`UPDATE folio SET status='open' WHERE tenant_id=${TENANT}::uuid AND id=${MAIN[1]}::uuid`;

    await expectSqlState(() => capability(OTHER_FOLIO), "55000");
    await expectSqlState(() => capability(OTHER_PROPERTY_FOLIO), "55000");
    await expectSqlState(() => capability(FOREIGN_FOLIO), "55000");
    await expectSqlState(() => capability(MAIN[1]!, OTHER_TENANT), "42501");
    await expectSqlState(() => capability(MAIN[1]!, TENANT, OTHER_ACTOR), "55000");
    await expectSqlState(() => capability(MAIN[1]!, TENANT, ACTOR, [crypto.randomUUID()]), "55000");

    await expectSqlState(() => admin!.unsafe(
      "SELECT * FROM public.create_folio_transfer($1::uuid,$2::uuid,$3::uuid,$4::uuid[],$5::uuid,$6)",
      [TENANT, MAIN[0], MAIN[1], `{${root}}`, ACTOR, "Forged owner call"],
    ), "42501");
    await expectSqlState(() => transaction((tx) => tx.unsafe(
      "UPDATE posting_line SET folio_transfer_root_line_id=$1::uuid WHERE tenant_id=$2::uuid AND id=$3::uuid",
      [root, TENANT, root],
    )), "42501");

    expect(await transferArtifacts()).toEqual(before);
    expect((await admin!<Array<{ count: number }>>`SELECT count(*)::int count FROM posting_line
      WHERE tenant_id=${TENANT}::uuid AND folio_transfer_root_line_id IS NOT NULL`)[0]!.count).toBe(0);
  }, 30_000);
});
