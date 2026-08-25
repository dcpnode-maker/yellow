import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  ReservationBoardService,
  ReservationBoardValidationError,
  type ReservationBoardInput,
} from "../src/contexts/reservations";
import { Database, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000016601";
const PROPERTY = "00000000-0000-0000-0000-000000016602";
const RESERVATION_A = "00000000-0000-0000-0000-000000016611";
const RESERVATION_B = "00000000-0000-0000-0000-000000016612";
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
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Object.keys(first.reservations[0]!).sort()).toEqual([
      "adults", "channelCode", "children", "confirmationNo", "createdAt", "currency",
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
});

async function clean() {
  if (!admin) return;
  for (const table of ["contact_point", "reservation_segment", "reservation", "sellable_unit", "rate_plan", "unit_type", "party", "org_node"]) {
    await admin.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [TENANT]);
  }
  await admin`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  admin = new SQL(DEPLOY_URL, { max: 2, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 2, prepare: false });
  await clean();
  await admin`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES (${TENANT}::uuid,'order166-board','Order 166','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order166_board','property','Board','UTC','USD'),
    ('00000000-0000-0000-0000-000000016603',${TENANT}::uuid,'order166_other','property','Other','UTC','USD')`;
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
});

afterAll(async () => {
  await clean();
  await database?.close();
  await admin?.close();
});

databaseDescribe("Order 166 production-style PostgreSQL board proof", () => {
  test("tied cursor pages are complete, isolated, filtered, repeatable and mutation-free", async () => {
    const service = new ReservationBoardService();
    const count = async () => (await admin!<Array<{ n: number }>>`SELECT count(*)::int n FROM reservation WHERE tenant_id=${TENANT}::uuid`)[0]!.n;
    const before = await count();
    const find = (boardInput: ReservationBoardInput) => database!.withTenantTransaction(TENANT, (tx) => service.list(tx, boardInput));
    const first = await find(input({ limit: 1 }));
    const second = await find(input({ limit: 1, after: first.nextCursor! }));
    expect([...first.reservations, ...second.reservations].map(({ reservationId }) => reservationId))
      .toEqual([RESERVATION_B, RESERVATION_A]);
    expect(await find(input({ limit: 1 }))).toEqual(first);
    expect((await find(input({ status: "cancelled" }))).reservations.map(({ reservationId }) => reservationId))
      .toEqual([RESERVATION_B]);
    expect((await find(input({ from: new Date("2026-09-02T00:00:00Z"), to: new Date("2026-09-04T00:00:00Z") })))
      .reservations.map(({ reservationId }) => reservationId)).toEqual([RESERVATION_A]);
    expect(JSON.stringify(first)).not.toContain("secret@example.test");
    expect(await count()).toBe(before);
  });
});
