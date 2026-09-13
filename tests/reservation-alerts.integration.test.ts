import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationAlertNotFoundError,
  ReservationAlertService,
  type CreateReservationAlertInput,
  type DeactivateReservationAlertInput,
} from "../src/contexts/reservations";
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

const DEPLOY_URL = process.env.YELLOW_RESERVATION_ALERTS_DEPLOY_URL;
const RUNTIME_URL = process.env.YELLOW_RESERVATION_ALERTS_RUNTIME_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_ALERTS === "1";
const TARGET_DATABASE = "yellow_order463_review_20260909";
if ((DEPLOY_URL && !RUNTIME_URL) || (!DEPLOY_URL && RUNTIME_URL) || (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL))) {
  throw new Error("Order 463 requires paired deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const run = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const TENANT_A = crypto.randomUUID();
const TENANT_B = crypto.randomUUID();
const PROPERTY_A = crypto.randomUUID();
const PROPERTY_A2 = crypto.randomUUID();
const PROPERTY_B = crypto.randomUUID();
const ACTOR_A = crypto.randomUUID();
const ACTOR_B = crypto.randomUUID();
const PARTY_A = crypto.randomUUID();
const PARTY_B = crypto.randomUUID();
const RESERVATION_A = crypto.randomUUID();
const RESERVATION_A2 = crypto.randomUUID();
const RESERVATION_B = crypto.randomUUID();
const WRONG_SUBJECT_ALERT = crypto.randomUUID();
const PROPERTY_A2_ALERT = crypto.randomUUID();
const TENANT_B_ALERT = crypto.randomUUID();

let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let alerts: ReservationAlertService | undefined;
let immutableReservationBaseline: unknown;
let concurrentAlertId = "";

function assertUrl(raw: string, user: "yellow_deploy" | "yellow_runtime"): void {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Order 463 database URL is invalid"); }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.port !== "55503" || decodeURIComponent(url.username) !== user ||
      decodeURIComponent(url.pathname.slice(1)) !== TARGET_DATABASE || url.password.length === 0 ||
      url.search !== "" || url.hash !== "") {
    throw new Error("Order 463 database URL is outside the admitted target");
  }
}

function envelope(propertyNode = PROPERTY_A, tenantId = TENANT_A, actorId = ACTOR_A) {
  return createAuditEnvelope({
    operation: "reservation.modified", actorId, tenantId, propertyNode, requestId: crypto.randomUUID(),
  });
}

function key(label: string): string {
  return `order463-${run}-${label}`;
}

function command(label: string, overrides: Partial<CreateReservationAlertInput> = {}): CreateReservationAlertInput {
  return {
    reservationId: RESERVATION_A,
    code: "VIP",
    message: "Meet at reception",
    showOn: "checkin",
    idempotencyKey: key(label),
    envelope: envelope(),
    ...overrides,
  };
}

function deactivate(
  label: string,
  alertId: string,
  overrides: Partial<DeactivateReservationAlertInput> = {},
): DeactivateReservationAlertInput {
  return {
    reservationId: RESERVATION_A,
    alertId,
    idempotencyKey: key(label),
    envelope: envelope(),
    ...overrides,
  };
}

async function create(service: ReservationAlertService, input: CreateReservationAlertInput) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.create(tx, input));
}

async function deactivateAlert(service: ReservationAlertService, input: DeactivateReservationAlertInput) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.deactivate(tx, input));
}

async function relevantCounts(): Promise<{ alerts: number; facts: number; events: number; claims: number }> {
  const rows = await admin!<Array<{ alerts: number; facts: number; events: number; claims: number }>>`
    SELECT
      (SELECT count(*)::int FROM alert WHERE tenant_id=${TENANT_A}::uuid) AS alerts,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT_A}::uuid
        AND entity_id IN (${RESERVATION_A}::uuid,${RESERVATION_A2}::uuid)) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT_A}::uuid
        AND aggregate_id IN (${RESERVATION_A}::uuid,${RESERVATION_A2}::uuid)) AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT_A}::uuid
        AND operation IN ('reservation.alert.create','reservation.alert.deactivate')) AS claims
  `;
  if (rows.length !== 1 || !rows[0]) throw new Error("Order 463 evidence count is unavailable");
  return rows[0];
}

async function immutableReservations(): Promise<unknown> {
  return admin!`
    SELECT id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency,
           notes,eta,etd,cancelled_at,cancel_reason,cancellation_no
    FROM reservation
    WHERE id IN (${RESERVATION_A}::uuid,${RESERVATION_A2}::uuid,${RESERVATION_B}::uuid)
    ORDER BY id
  `;
}

function stateOf(error: unknown): string | undefined {
  const value = error as { code?: unknown; errno?: unknown };
  return [value.errno, value.code].find((candidate): candidate is string =>
    typeof candidate === "string" && /^[0-9A-Z]{5}$/.test(candidate));
}

async function expectRuntimeDenied(operation: (tx: Tx) => Promise<unknown>): Promise<void> {
  let denial: unknown;
  try {
    await database!.withTenantTransaction(TENANT_A, operation);
  } catch (error) {
    denial = error;
  }
  expect(stateOf(denial)).toBe("42501");
}

class FailAfterPublishBus implements EventBus {
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    await this.delegate.publish(tx, event);
    throw new Error("Order 463 injected failure after reservation.modified publication");
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  assertUrl(DEPLOY_URL, "yellow_deploy");
  assertUrl(RUNTIME_URL, "yellow_runtime");
  admin = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 8, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 20, prepare: false });
  events = new PostgresEventBus(eventPool);
  alerts = new ReservationAlertService({ events, idempotency: new PostgresIdempotency() });

  const identity = await admin<Array<{ exact: boolean }>>`
    SELECT session_user='yellow_deploy' AND current_user='yellow_deploy'
       AND current_database()=${TARGET_DATABASE}
       AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=55503
       AND current_setting('server_version') LIKE '16.15%'
       AND (SELECT count(*) FROM schema_migration)=91
       AND (SELECT max(version) FROM schema_migration)=91 AS exact
  `;
  if (identity.length !== 1 || identity[0]?.exact !== true) {
    throw new Error("Order 463 database identity or migration frontier differs");
  }
  const empty = await admin<Array<{ fixtures: number }>>`
    SELECT
      (SELECT count(*) FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid))+
      (SELECT count(*) FROM org_node WHERE id IN (${PROPERTY_A}::uuid,${PROPERTY_A2}::uuid,${PROPERTY_B}::uuid))+
      (SELECT count(*) FROM app_user WHERE id IN (${ACTOR_A}::uuid,${ACTOR_B}::uuid))+
      (SELECT count(*) FROM party WHERE id IN (${PARTY_A}::uuid,${PARTY_B}::uuid))+
      (SELECT count(*) FROM reservation WHERE id IN (${RESERVATION_A}::uuid,${RESERVATION_A2}::uuid,${RESERVATION_B}::uuid))+
      (SELECT count(*) FROM alert WHERE id IN (${WRONG_SUBJECT_ALERT}::uuid,${PROPERTY_A2_ALERT}::uuid,${TENANT_B_ALERT}::uuid)) AS fixtures
  `;
  if (empty.length !== 1 || Number(empty[0]?.fixtures) !== 0) throw new Error("Order 463 fixture identity already exists");

  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,${`order463-${run}-a`},'Order 463 A','shared','active'),
    (${TENANT_B}::uuid,${`order463-${run}-b`},'Order 463 B','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,${`order463_${run}.a`}::ltree,'property','A','UTC','USD'),
    (${PROPERTY_A2}::uuid,${TENANT_A}::uuid,${`order463_${run}.a2`}::ltree,'property','A2','UTC','USD'),
    (${PROPERTY_B}::uuid,${TENANT_B}::uuid,${`order463_${run}.b`}::ltree,'property','B','UTC','USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name) VALUES
    (${ACTOR_A}::uuid,${TENANT_A}::uuid,${`alerts-${run}-a@order463.test`},'Alert operator A'),
    (${ACTOR_B}::uuid,${TENANT_B}::uuid,${`alerts-${run}-b@order463.test`},'Alert operator B')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY_A}::uuid,${TENANT_A}::uuid,'person','Guest A','active'),
    (${PARTY_B}::uuid,${TENANT_B}::uuid,'person','Guest B','active')`;
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency) VALUES
    (${RESERVATION_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,${`O463-${run}-A`},'reserved',${PARTY_A}::uuid,'direct','USD'),
    (${RESERVATION_A2}::uuid,${TENANT_A}::uuid,${PROPERTY_A2}::uuid,${`O463-${run}-A2`},'cancelled',${PARTY_A}::uuid,'direct','USD'),
    (${RESERVATION_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,${`O463-${run}-B`},'reserved',${PARTY_B}::uuid,'direct','USD')`;
  await admin`INSERT INTO alert(id,tenant_id,subject_type,subject_id,code,message,show_on,active) VALUES
    (${WRONG_SUBJECT_ALERT}::uuid,${TENANT_A}::uuid,'party',${PARTY_A}::uuid,'WRONG','Wrong subject','always',true),
    (${PROPERTY_A2_ALERT}::uuid,${TENANT_A}::uuid,'reservation',${RESERVATION_A2}::uuid,'A2','Other property','checkout',true),
    (${TENANT_B_ALERT}::uuid,${TENANT_B}::uuid,'reservation',${RESERVATION_B}::uuid,'B','Other tenant','always',true)`;
  immutableReservationBaseline = await immutableReservations();
}, 30_000);

afterAll(async () => {
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await admin?.close({ timeout: 0 });
});

databaseDescribe("Order 463 reservation alert service", () => {
  test("P0/P2: current authority is exact and RLS hides/blocks the foreign tenant", async () => {
    const authority = await admin!<Array<Record<string, boolean>>>`
      SELECT
        has_column_privilege('app_role','public.alert','tenant_id','INSERT')
          AND has_column_privilege('app_role','public.alert','subject_type','INSERT')
          AND has_column_privilege('app_role','public.alert','subject_id','INSERT')
          AND has_column_privilege('app_role','public.alert','code','INSERT')
          AND has_column_privilege('app_role','public.alert','message','INSERT')
          AND has_column_privilege('app_role','public.alert','show_on','INSERT')
          AND has_column_privilege('app_role','public.alert','active','INSERT') AS insert_exact,
        has_column_privilege('app_role','public.alert','active','UPDATE') AS update_active,
        has_column_privilege('app_role','public.alert','message','UPDATE') AS update_message,
        has_table_privilege('app_role','public.alert','DELETE') AS can_delete,
        has_table_privilege('app_role','public.alert','TRUNCATE') AS can_truncate
    `;
    expect(authority).toEqual([{
      insert_exact: true, update_active: true, update_message: false, can_delete: false, can_truncate: false,
    }]);
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) => tx<Array<{ id: string }>>`
      SELECT id FROM alert WHERE id IN (${WRONG_SUBJECT_ALERT}::uuid,${TENANT_B_ALERT}::uuid) ORDER BY id
    `);
    expect(visible).toEqual([{ id: WRONG_SUBJECT_ALERT }]);
    let denial: unknown;
    try {
      await database!.withTenantTransaction(TENANT_A, (tx) => tx`
        INSERT INTO alert(tenant_id,subject_type,subject_id,code,message,show_on,active)
        VALUES (${TENANT_B}::uuid,'reservation',${RESERVATION_B}::uuid,NULL,'denied','always',true)
      `);
    } catch (error) { denial = error; }
    expect(stateOf(denial)).toBe("42501");
    expect(await admin!`SELECT id FROM alert WHERE tenant_id=${TENANT_B}::uuid AND message='denied'`).toHaveLength(0);

    await expectRuntimeDenied((tx) => tx`UPDATE alert SET message='denied' WHERE id=${WRONG_SUBJECT_ALERT}::uuid`);
    await expectRuntimeDenied((tx) => tx`UPDATE alert SET tenant_id=${TENANT_B}::uuid WHERE id=${WRONG_SUBJECT_ALERT}::uuid`);
    await expectRuntimeDenied((tx) => tx`UPDATE alert SET subject_type='reservation' WHERE id=${WRONG_SUBJECT_ALERT}::uuid`);
    await expectRuntimeDenied((tx) => tx`UPDATE alert SET subject_id=${RESERVATION_A}::uuid WHERE id=${WRONG_SUBJECT_ALERT}::uuid`);
    await expectRuntimeDenied((tx) => tx`UPDATE alert SET id=${crypto.randomUUID()}::uuid WHERE id=${WRONG_SUBJECT_ALERT}::uuid`);
    await expectRuntimeDenied((tx) => tx`DELETE FROM alert WHERE id=${WRONG_SUBJECT_ALERT}::uuid`);
    await expectRuntimeDenied((tx) => tx`TRUNCATE TABLE alert`);
    expect(await admin!<Array<{
      tenant_id: string; subject_type: string; subject_id: string; code: string;
      message: string; show_on: string; active: boolean;
    }>>`
      SELECT tenant_id,subject_type,subject_id,code,message,show_on,active
      FROM alert WHERE id=${WRONG_SUBJECT_ALERT}::uuid
    `).toEqual([{
      tenant_id: TENANT_A, subject_type: "party", subject_id: PARTY_A,
      code: "WRONG", message: "Wrong subject", show_on: "always", active: true,
    }]);
  }, 30_000);

  test("P1/P3: simultaneous same-key create is one mutation plus one replay; changed request conflicts", async () => {
    const input = command("same-key-concurrent", { envelope: envelope() });
    const before = await relevantCounts();
    const results = await Promise.all([create(alerts!, input), create(alerts!, input)]);
    expect(results.map(({ replayed }) => replayed).sort()).toEqual([false, true]);
    expect(results[0]!.alert.id).toBe(results[1]!.alert.id);
    expect(results[0]!.alert).toEqual({
      id: results[0]!.alert.id, code: "VIP", message: "Meet at reception", showOn: "checkin", active: true,
    });
    concurrentAlertId = results[0]!.alert.id;
    expect(await create(alerts!, input)).toEqual({ ...results[0], replayed: true });
    await expect(create(alerts!, { ...input, message: "Changed request" }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
    const after = await relevantCounts();
    expect(after).toEqual({ alerts: before.alerts + 1, facts: before.facts + 1, events: before.events + 1, claims: before.claims + 1 });

    const evidence = await admin!<Array<{ fact_payload: Record<string, unknown>; event_payload: Record<string, unknown>; correlation_id: string }>>`
      SELECT fact.payload AS fact_payload,event.payload AS event_payload,event.correlation_id::text
      FROM fact_log fact JOIN outbox event
        ON event.tenant_id=fact.tenant_id AND event.aggregate_id=fact.entity_id
       AND event.correlation_id=${input.envelope.requestId}::uuid
      WHERE fact.tenant_id=${TENANT_A}::uuid AND fact.entity_id=${RESERVATION_A}::uuid
        AND fact.payload @> ${JSON.stringify({ request_id: input.envelope.requestId })}::text::jsonb
        AND fact.payload @> ${JSON.stringify({ diff: { alerts: { alertId: concurrentAlertId } } })}::text::jsonb
        AND event.payload @> ${JSON.stringify({ diff: { alerts: { alertId: concurrentAlertId } } })}::text::jsonb
    `;
    expect(evidence).toHaveLength(1);
    expect(Object.keys(evidence[0]!.fact_payload).sort()).toEqual(["diff", "request_id"]);
    expect(evidence[0]!.fact_payload.diff).toEqual({ alerts: { action: "create", alertId: concurrentAlertId, active: true } });
    expect(Object.keys(evidence[0]!.event_payload).sort()).toEqual(["diff", "reservation_id"]);
    expect(evidence[0]!.event_payload).toEqual({
      reservation_id: RESERVATION_A,
      diff: { alerts: { action: "create", alertId: concurrentAlertId, active: true } },
    });
    expect(evidence[0]!.correlation_id).toBe(input.envelope.requestId);
    expect(JSON.stringify(evidence)).not.toContain("Meet at reception");
    expect(JSON.stringify(evidence)).not.toContain("VIP");
  }, 30_000);

  test("P2: unique requests conceal wrong property, tenant, subject and alert ownership without claims", async () => {
    const before = await relevantCounts();
    const creates = [
      command("create-cross-property", { reservationId: RESERVATION_A2, envelope: envelope(PROPERTY_A) }),
      command("create-cross-tenant", { reservationId: RESERVATION_B, envelope: envelope(PROPERTY_A) }),
      command("create-wrong-property", { reservationId: RESERVATION_A, envelope: envelope(PROPERTY_A2) }),
    ];
    for (const input of creates) await expect(create(alerts!, input)).rejects.toBeInstanceOf(ReservationAlertNotFoundError);
    const deactivations = [
      deactivate("wrong-subject", WRONG_SUBJECT_ALERT),
      deactivate("other-property-alert", PROPERTY_A2_ALERT),
      deactivate("foreign-alert", TENANT_B_ALERT),
    ];
    for (const input of deactivations) {
      await expect(deactivateAlert(alerts!, input)).rejects.toBeInstanceOf(ReservationAlertNotFoundError);
    }
    expect(await relevantCounts()).toEqual(before);
  }, 30_000);

  test("P1/P3: competing deactivate keys yield one change, one no-op and replay exact results", async () => {
    const inputs = [deactivate("deactivate-concurrent-a", concurrentAlertId), deactivate("deactivate-concurrent-b", concurrentAlertId)];
    const before = await relevantCounts();
    const results = await Promise.all(inputs.map((input) => deactivateAlert(alerts!, input)));
    expect(results.map(({ changed }) => changed).sort()).toEqual([false, true]);
    expect(results.every(({ alert }) => alert.id === concurrentAlertId && alert.active === false)).toBe(true);
    expect(results.every(({ replayed }) => replayed === false)).toBe(true);
    for (let index = 0; index < inputs.length; index += 1) {
      expect(await deactivateAlert(alerts!, inputs[index]!)).toEqual({ ...results[index]!, replayed: true });
    }
    await expect(deactivateAlert(alerts!, { ...inputs[0]!, alertId: WRONG_SUBJECT_ALERT }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
    const after = await relevantCounts();
    expect(after).toEqual({ alerts: before.alerts, facts: before.facts + 1, events: before.events + 1, claims: before.claims + 2 });
    const changes = await admin!<Array<{ fact_payload: Record<string, unknown>; event_payload: Record<string, unknown> }>>`
      SELECT fact.payload AS fact_payload,event.payload AS event_payload
      FROM fact_log fact JOIN outbox event
        ON event.tenant_id=fact.tenant_id AND event.aggregate_id=fact.entity_id
       AND fact.payload @> jsonb_build_object('request_id',event.correlation_id::text)
      WHERE fact.tenant_id=${TENANT_A}::uuid AND fact.entity_id=${RESERVATION_A}::uuid
        AND fact.payload->'diff'->'alerts' @> ${JSON.stringify({ action: "deactivate", alertId: concurrentAlertId, active: false })}::text::jsonb
        AND event.payload->'diff'->'alerts' @> ${JSON.stringify({ action: "deactivate", alertId: concurrentAlertId, active: false })}::text::jsonb
    `;
    expect(changes).toHaveLength(1);
    expect(changes[0]!.fact_payload.diff).toEqual({ alerts: { action: "deactivate", alertId: concurrentAlertId, active: false } });
    expect(changes[0]!.event_payload).toEqual({
      reservation_id: RESERVATION_A,
      diff: { alerts: { action: "deactivate", alertId: concurrentAlertId, active: false } },
    });
  }, 30_000);

  test("P4: after-publish failures roll back alert, evidence and claim; the exact retry succeeds", async () => {
    const failing = new ReservationAlertService({
      events: new FailAfterPublishBus(events!), idempotency: new PostgresIdempotency(),
    });
    const createInput = command("rollback-create", { code: null, message: `Rollback ${run}`, showOn: "always" });
    const beforeCreate = await relevantCounts();
    await expect(create(failing, createInput)).rejects.toThrow("failure after reservation.modified publication");
    expect(await relevantCounts()).toEqual(beforeCreate);
    expect(await admin!`SELECT id FROM alert WHERE tenant_id=${TENANT_A}::uuid AND message=${createInput.message}`).toHaveLength(0);
    const recovered = await create(alerts!, createInput);
    expect(recovered).toMatchObject({ changed: true, replayed: false, alert: { active: true } });

    const deactivateInput = deactivate("rollback-deactivate", recovered.alert.id);
    const beforeDeactivate = await relevantCounts();
    await expect(deactivateAlert(failing, deactivateInput)).rejects.toThrow("failure after reservation.modified publication");
    expect(await relevantCounts()).toEqual(beforeDeactivate);
    expect(await admin!<Array<{ active: boolean }>>`SELECT active FROM alert WHERE id=${recovered.alert.id}::uuid`)
      .toEqual([{ active: true }]);
    expect(await deactivateAlert(alerts!, deactivateInput)).toMatchObject({ changed: true, replayed: false, alert: { active: false } });
  }, 30_000);

  test("P5: alert commands leave unrelated reservation and business rows immutable", async () => {
    expect(await immutableReservations()).toEqual(immutableReservationBaseline);
    const unrelated = await admin!<Array<{ guests: number; folios: number; occupancy: number; journals: number; documents: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation_guest WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) AS guests,
        (SELECT count(*)::int FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) AS folios,
        (SELECT count(*)::int FROM space_occupancy WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) AS occupancy,
        (SELECT count(*)::int FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) AS journals,
        (SELECT count(*)::int FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) AS documents
    `;
    expect(unrelated).toEqual([{ guests: 0, folios: 0, occupancy: 0, journals: 0, documents: 0 }]);
  });
});
