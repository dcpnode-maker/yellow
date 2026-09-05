import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationBoardService,
  ReservationBoardConflictError,
  ReservationBoardValidationError,
  type ReservationBoardInput,
} from "../src/contexts/reservations";
import { Database, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000016601";
const TENANT_OTHER = "00000000-0000-0000-0000-000000016630";
const PROPERTY = "00000000-0000-0000-0000-000000016602";
const PROPERTY_OTHER_TENANT = "00000000-0000-0000-0000-000000016631";
const RESERVATION_A = "00000000-0000-0000-0000-000000016611";
const RESERVATION_B = "00000000-0000-0000-0000-000000016612";
const TASK_A = "00000000-0000-0000-0000-000000016620";
const TASK_OTHER_PROPERTY = "00000000-0000-0000-0000-000000016621";
const TASK_OTHER_TENANT = "00000000-0000-0000-0000-000000016632";
const TRAVEL_ARRIVAL_A = "00000000-0000-0000-0000-000000016640";
const TRAVEL_DEPARTURE_A = "00000000-0000-0000-0000-000000016641";
const TRAVEL_ARRIVAL_B = "00000000-0000-0000-0000-000000016642";
const TRAVEL_DEPARTURE_FOREIGN = "00000000-0000-0000-0000-000000016643";
const CREATED = "2026-08-26T01:02:03.123456Z";
const DEPLOY_URL = process.env.YELLOW_RESERVATION_BOARD_DEPLOY_URL ?? process.env.YELLOW_RESERVATION_BOARD_URL;
const RUNTIME_URL = process.env.YELLOW_RESERVATION_BOARD_RUNTIME_URL ?? process.env.YELLOW_RESERVATION_BOARD_URL;
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let database: Database | undefined;

function input(overrides: Partial<ReservationBoardInput> = {}): ReservationBoardInput {
  return { tenantId: TENANT, propertyNode: PROPERTY, ...overrides };
}

function row(id: string) {
  return {
    id, confirmation_no: `Y-${id.slice(-3)}`, status: "reserved",
    primary_party: "00000000-0000-0000-0000-000000016604",
    visible_primary_party_id: "00000000-0000-0000-0000-000000016604", display_name: "Board Guest",
    stay_from: "2026-09-01T06:30:00.000000Z", stay_to: "2026-09-02T06:30:00.000000Z",
    unit_type_label: "Deluxe", sellable_unit_label: "Room 101", rate_plan_label: "BAR",
    adults: 2, children: 1, channel_code: "direct", currency: "INR", created_at: CREATED,
    arrival_direction: null, arrival_mode: null, arrival_carrier: null, arrival_service_no: null,
    arrival_scheduled_at: null, arrival_pickup_requested: null, arrival_pickup_task_id: null,
    visible_arrival_pickup_task_id: null,
    departure_direction: null, departure_mode: null, departure_carrier: null,
    departure_service_no: null, departure_scheduled_at: null,
  };
}

describe("Order 166 bounded reservation board", () => {
  test("hostile malformed filters, limits, ranges and cursors fail before SQL", async () => {
    const service = new ReservationBoardService();
    let calls = 0;
    const noSql = (() => { calls += 1; return Promise.resolve([]); }) as unknown as Tx;
    const invalid: unknown[] = [
      input({ tenantId: "bad" }), input({ propertyNode: "bad" }), input({ limit: 0 }), input({ limit: 101 }),
      input({ status: "guest-name" as never }), input({ from: new Date("2026-01-01") }),
      input({ from: new Date("2026-01-02"), to: new Date("2026-01-01") }),
      input({ from: new Date("2026-01-01"), to: new Date("2028-01-01") }), input({ after: "not-a-cursor" }),
      input({ after: btoa(JSON.stringify({ v: 1, createdAt: "2026-99-99T01:02:03.123456Z", id: RESERVATION_A }))
        .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") }),
      { ...input(), guestName: "PII" }, Object.create(input()),
    ];
    for (const candidate of invalid) {
      await expect(service.list(noSql, candidate as ReservationBoardInput))
        .rejects.toBeInstanceOf(ReservationBoardValidationError);
    }
    expect(calls).toBe(0);
  });

  test("tied timestamps use the UUID tie-breaker and emit one canonical opaque cursor", async () => {
    const service = new ReservationBoardService();
    const calls: unknown[][] = [];
    const tx = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push([strings, ...values]);
      return Promise.resolve([row(RESERVATION_B), row(RESERVATION_A)]);
    }) as unknown as Tx;
    const first = await service.list(tx, input({ limit: 1 }));
    expect(first.reservations.map(({ reservationId }) => reservationId)).toEqual([RESERVATION_B]);
    expect(first.nextCursor).toBe("eyJ2IjoxLCJjcmVhdGVkQXQiOiIyMDI2LTA4LTI2VDAxOjAyOjAzLjEyMzQ1NloiLCJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAxNjYxMiJ9");
    expect(Object.keys(first.reservations[0]!).sort()).toEqual([
      "adults", "channelCode", "children", "confirmationNo", "createdAt", "currency",
      "arrivalTravel", "departureTravel",
      "primaryGuestDisplayName", "ratePlanLabel", "reservationId", "sellableUnitLabel",
      "status", "stayFrom", "stayTo", "unitTypeLabel",
    ].sort());
    const second = await service.list(tx, input({ limit: 1, after: first.nextCursor! }));
    expect(second.nextCursor).toBe(first.nextCursor);
    expect(calls).toHaveLength(2);
    const sql = (calls[0]![0] as TemplateStringsArray).join("?");
    expect(sql).toContain("WITH page_reservations AS MATERIALIZED");
    expect(sql).toContain("LIMIT ?");
    expect(sql).not.toContain("OFFSET");
    expect(sql).not.toContain("contact_point");
    await expect(service.list(tx, input({ after: `${first.nextCursor}A` })))
      .rejects.toBeInstanceOf(ReservationBoardValidationError);
  });

  test("arrival projection is exact, arrival-only, deeply frozen and fail-closed on malformed stored truth", async () => {
    const service = new ReservationBoardService();
    const exact = {
      ...row(RESERVATION_A),
      arrival_direction: "arrival",
      arrival_mode: "flight",
      arrival_carrier: "Air India",
      arrival_service_no: "AI 141",
      arrival_scheduled_at: "2026-09-01T04:05:06.123456Z",
      arrival_pickup_requested: true,
      arrival_pickup_task_id: TASK_A,
      visible_arrival_pickup_task_id: TASK_A,
    };
    const list = (stored: Record<string, unknown>) => service.list((() => Promise.resolve([stored])) as unknown as Tx,
      input());
    const result = await list(exact);
    expect(result.reservations[0]!.arrivalTravel).toEqual({
      mode: "flight", carrier: "Air India", serviceNo: "AI 141",
      scheduledAt: "2026-09-01T04:05:06.123456Z", pickupRequested: true, pickupTaskLinked: true,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reservations)).toBe(true);
    expect(Object.isFrozen(result.reservations[0])).toBe(true);
    expect(Object.isFrozen(result.reservations[0]!.arrivalTravel)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(TASK_A);

    const invalid = [
      { arrival_direction: "departure" },
      { arrival_mode: "spaceship" },
      { arrival_carrier: " " },
      { arrival_service_no: "" },
      { arrival_scheduled_at: "2026-09-01T04:05:06.123Z" },
      { arrival_pickup_requested: "yes" },
      { visible_arrival_pickup_task_id: null },
    ];
    for (const override of invalid) {
      await expect(list({ ...exact, ...override })).rejects.toBeInstanceOf(ReservationBoardConflictError);
    }
    await expect(list({ ...row(RESERVATION_A), arrival_mode: "flight" }))
      .rejects.toBeInstanceOf(ReservationBoardConflictError);
  });

  test("departure projection is exact, departure-only, deeply frozen and fail-closed on malformed stored truth", async () => {
    const service = new ReservationBoardService();
    const exact = {
      ...row(RESERVATION_A),
      departure_direction: "departure",
      departure_mode: "ferry",
      departure_carrier: "Harbour Ferry",
      departure_service_no: "HF 72",
      departure_scheduled_at: "2026-09-03T08:09:10.654321Z",
    };
    const list = (stored: Record<string, unknown>) => service.list((() => Promise.resolve([stored])) as unknown as Tx,
      input());
    const result = await list(exact);
    expect(result.reservations[0]!.departureTravel).toEqual({
      mode: "ferry", carrier: "Harbour Ferry", serviceNo: "HF 72",
      scheduledAt: "2026-09-03T08:09:10.654321Z",
    });
    expect(Object.keys(result.reservations[0]!.departureTravel!).sort())
      .toEqual(["carrier", "mode", "scheduledAt", "serviceNo"]);
    expect(Object.isFrozen(result.reservations[0]!.departureTravel)).toBe(true);
    expect((await list({ ...row(RESERVATION_A), departure_direction: "departure" }))
      .reservations[0]!.departureTravel).toEqual({
      mode: null, carrier: null, serviceNo: null, scheduledAt: null,
    });

    const invalid = [
      { departure_direction: "arrival" },
      { departure_mode: "spaceship" },
      { departure_carrier: " " },
      { departure_service_no: "" },
      { departure_scheduled_at: "2026-09-03T08:09:10.654Z" },
    ];
    for (const override of invalid) {
      await expect(list({ ...exact, ...override })).rejects.toBeInstanceOf(ReservationBoardConflictError);
    }
    await expect(list({ ...row(RESERVATION_A), departure_mode: "ferry" }))
      .rejects.toBeInstanceOf(ReservationBoardConflictError);
  });
});

async function clean() {
  if (!admin) return;
  const tenants = [TENANT, TENANT_OTHER];
  for (const table of ["travel_detail", "task", "contact_point", "reservation_segment", "reservation",
    "sellable_unit", "rate_plan", "unit_type", "party", "org_node"]) {
    for (const tenant of tenants) await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [tenant]);
  }
  await admin`DELETE FROM tenant WHERE id IN (${TENANT}::uuid, ${TENANT_OTHER}::uuid)`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  admin = new SQL(DEPLOY_URL, { max: 2, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 2, prepare: false });
  await clean();
  await admin`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES (${TENANT}::uuid,'order166-board','Order 166','shared','active'),
      (${TENANT_OTHER}::uuid,'order206-board-foreign','Order 206 foreign','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order166_board','property','Board','UTC','USD'),
    ('00000000-0000-0000-0000-000000016603',${TENANT}::uuid,'order166_other','property','Other','UTC','USD'),
    (${PROPERTY_OTHER_TENANT}::uuid,${TENANT_OTHER}::uuid,'order206_foreign','property','Foreign','UTC','USD')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    ('00000000-0000-0000-0000-000000016604',${TENANT}::uuid,'person','Visible Guest','active')`;
  await admin`INSERT INTO contact_point(id,tenant_id,party_id,kind,value,is_primary) VALUES
    ('00000000-0000-0000-0000-000000016605',${TENANT}::uuid,'00000000-0000-0000-0000-000000016604','email','secret@example.test',true)`;
  await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
    ('00000000-0000-0000-0000-000000016606',${TENANT}::uuid,${PROPERTY}::uuid,'DLX','Deluxe','hotel')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    ('00000000-0000-0000-0000-000000016607',${TENANT}::uuid,'00000000-0000-0000-0000-000000016606','Room 101','active')`;
  await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status) VALUES
    ('00000000-0000-0000-0000-000000016608',${TENANT}::uuid,${PROPERTY}::uuid,'BAR','Best Available','USD','active')`;
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency,created_at) VALUES
    (${RESERVATION_A}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'Y-166-A','reserved','00000000-0000-0000-0000-000000016604','direct','USD',${CREATED}::timestamptz),
    (${RESERVATION_B}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'Y-166-B','cancelled','00000000-0000-0000-0000-000000016604','ota','USD',${CREATED}::timestamptz),
    ('00000000-0000-0000-0000-000000016613',${TENANT}::uuid,'00000000-0000-0000-0000-000000016603','Y-166-OTHER','reserved','00000000-0000-0000-0000-000000016604','direct','USD',${CREATED}::timestamptz)`;
  await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES
    ('00000000-0000-0000-0000-000000016614',${TENANT}::uuid,${RESERVATION_A}::uuid,1,'00000000-0000-0000-0000-000000016606','00000000-0000-0000-0000-000000016607',tstzrange('2026-09-01','2026-09-03','[)'),2,'[{"age":7}]','00000000-0000-0000-0000-000000016608','booked'),
    ('00000000-0000-0000-0000-000000016615',${TENANT}::uuid,${RESERVATION_B}::uuid,1,'00000000-0000-0000-0000-000000016606','00000000-0000-0000-0000-000000016607',tstzrange('2026-10-01','2026-10-02','[)'),1,'[]','00000000-0000-0000-0000-000000016608','cancelled')`;
  await admin`INSERT INTO task(id,tenant_id,property_node,kind,status,subject_type,subject_id,payload) VALUES
    (${TASK_A}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'trace','open','reservation',${RESERVATION_A}::uuid,'{"private":"same property task state"}'::jsonb),
    (${TASK_OTHER_PROPERTY}::uuid,${TENANT}::uuid,'00000000-0000-0000-0000-000000016603'::uuid,'trace','done','reservation',${RESERVATION_A}::uuid,'{"private":"wrong property"}'::jsonb),
    (${TASK_OTHER_TENANT}::uuid,${TENANT_OTHER}::uuid,${PROPERTY_OTHER_TENANT}::uuid,'trace','assigned',NULL,NULL,'{"private":"wrong tenant"}'::jsonb)`;
  await admin`INSERT INTO travel_detail(
      id,tenant_id,reservation_id,direction,mode,carrier,service_no,scheduled_at,pickup_requested,pickup_task_id,notes
    ) VALUES
    (${TRAVEL_ARRIVAL_A}::uuid,${TENANT}::uuid,${RESERVATION_A}::uuid,'arrival','flight','Air India','AI 141','2026-09-01 04:05:06.123456+00',true,${TASK_A}::uuid,'private arrival note'),
    (${TRAVEL_DEPARTURE_A}::uuid,${TENANT}::uuid,${RESERVATION_A}::uuid,'departure','ferry','Private Departure','SECRET-206','2026-09-03 08:09:10.654321+00',false,NULL,'private departure note'),
    (${TRAVEL_ARRIVAL_B}::uuid,${TENANT}::uuid,${RESERVATION_B}::uuid,'arrival','train',NULL,NULL,NULL,false,NULL,'private cancelled-arrival note'),
    (${TRAVEL_DEPARTURE_FOREIGN}::uuid,${TENANT_OTHER}::uuid,${RESERVATION_A}::uuid,'departure','flight','Foreign carrier','FOREIGN-207','2026-09-03 01:02:03.456789+00',true,${TASK_OTHER_TENANT}::uuid,'foreign note')`;
});

afterAll(async () => {
  await clean();
  await database?.close();
  await admin?.close();
});

databaseDescribe("Order 166 production-style PostgreSQL board proof", () => {
  test("tied cursor pages are complete, isolated, filtered, repeatable and mutation-free", async () => {
    const service = new ReservationBoardService();
    const counts = async () => (await admin!<Array<{ reservations: number; travel: number; tasks: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT}::uuid) AS reservations,
        (SELECT count(*)::int FROM travel_detail WHERE tenant_id=${TENANT}::uuid) AS travel,
        (SELECT count(*)::int FROM task WHERE tenant_id=${TENANT}::uuid) AS tasks
    `)[0]!;
    const before = await counts();
    const find = (boardInput: ReservationBoardInput) => database!.withTenantTransaction(TENANT, (tx) => service.list(tx, boardInput));
    const first = await find(input({ limit: 1 }));
    const second = await find(input({ limit: 1, after: first.nextCursor! }));
    const combined = [...first.reservations, ...second.reservations];
    expect(combined.map(({ reservationId }) => reservationId))
      .toEqual([RESERVATION_B, RESERVATION_A]);
    expect(combined.map(({ arrivalTravel }) => arrivalTravel)).toEqual([
      { mode: "train", carrier: null, serviceNo: null, scheduledAt: null,
        pickupRequested: false, pickupTaskLinked: false },
      { mode: "flight", carrier: "Air India", serviceNo: "AI 141",
        scheduledAt: "2026-09-01T04:05:06.123456Z", pickupRequested: true, pickupTaskLinked: true },
    ]);
    expect(combined.map(({ departureTravel }) => departureTravel)).toEqual([
      null,
      { mode: "ferry", carrier: "Private Departure", serviceNo: "SECRET-206",
        scheduledAt: "2026-09-03T08:09:10.654321Z" },
    ]);
    expect(await find(input({ limit: 1 }))).toEqual(first);
    expect((await find(input({ status: "cancelled" }))).reservations.map(({ reservationId }) => reservationId))
      .toEqual([RESERVATION_B]);
    expect((await find(input({ from: new Date("2026-09-02T00:00:00Z"), to: new Date("2026-09-04T00:00:00Z") })))
      .reservations.map(({ reservationId }) => reservationId)).toEqual([RESERVATION_A]);
    const disclosed = JSON.stringify(combined);
    for (const forbidden of ["secret@example.test", TRAVEL_ARRIVAL_A, TRAVEL_DEPARTURE_A,
      TRAVEL_DEPARTURE_FOREIGN, TASK_A, TASK_OTHER_TENANT, "private arrival note",
      "private departure note", "foreign note", "Foreign carrier", "FOREIGN-207",
      "same property task state", "done"]) {
      expect(disclosed).not.toContain(forbidden);
    }
    expect(Object.keys(combined[1]!.departureTravel!).sort())
      .toEqual(["carrier", "mode", "scheduledAt", "serviceNo"]);
    expect(await counts()).toEqual(before);

    await admin!`UPDATE travel_detail SET pickup_task_id=${TASK_OTHER_PROPERTY}::uuid
      WHERE id=${TRAVEL_ARRIVAL_A}::uuid`;
    await expect(find(input())).rejects.toBeInstanceOf(ReservationBoardConflictError);
    await admin!`UPDATE travel_detail SET pickup_task_id=${TASK_OTHER_TENANT}::uuid
      WHERE id=${TRAVEL_ARRIVAL_A}::uuid`;
    await expect(find(input())).rejects.toBeInstanceOf(ReservationBoardConflictError);
    await admin!`UPDATE travel_detail SET pickup_task_id=${TASK_A}::uuid
      WHERE id=${TRAVEL_ARRIVAL_A}::uuid`;
    expect(await find(input({ limit: 1 }))).toEqual(first);
    expect(await counts()).toEqual(before);
  });
});
