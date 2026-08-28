import { afterAll, beforeAll, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  VehicleRegisterConflictError,
  VehicleRegisterService,
  VehicleRegisterValidationError,
} from "../src/contexts/stay-operations";
import { Database } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_VEHICLE_REGISTER_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_VEHICLE_REGISTER === "1";
if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_VEHICLE_REGISTER_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000020501";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000020502";
const PROPERTY = "00000000-0000-0000-0000-000000020511";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000020512";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000020513";
const PARTY = "00000000-0000-0000-0000-000000020521";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000020522";
const RESERVATION = "00000000-0000-0000-0000-000000020531";
const OTHER_RESERVATION = "00000000-0000-0000-0000-000000020532";
const FOREIGN_RESERVATION = "00000000-0000-0000-0000-000000020533";

let deploy: SQL | undefined;
let database: Database | undefined;
let register: VehicleRegisterService | undefined;

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM public.vehicle WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.reservation WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.party WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.org_node WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
  await deploy`DELETE FROM public.tenant WHERE id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
}

async function insertVehicle(input: Readonly<{
  id: string;
  registration: string;
  reservationId?: string | null;
  partyId?: string | null;
  make?: string | null;
  model?: string | null;
  colour?: string | null;
  driverName?: string | null;
  enteredAt?: string | null;
  exitedAt?: string | null;
  notes?: string | null;
}>): Promise<void> {
  await deploy!`INSERT INTO public.vehicle(
      id,tenant_id,property_node,reservation_id,party_id,reg_no,make,model,colour,
      driver_name,entered_at,exited_at,notes
    ) VALUES(
      ${input.id}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,
      ${input.reservationId ?? null}::uuid,${input.partyId ?? null}::uuid,${input.registration},
      ${input.make ?? null},${input.model ?? null},${input.colour ?? null},
      ${input.driverName ?? null},${input.enteredAt ?? null}::timestamptz,
      ${input.exitedAt ?? null}::timestamptz,${input.notes ?? null}
    )`;
}

function input(overrides: Partial<Readonly<{
  tenantId: string;
  propertyNode: string;
  registration: string;
  cursor: string;
  limit: number;
}>> = {}) {
  return Object.freeze({ tenantId: TENANT, propertyNode: PROPERTY, ...overrides });
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 8, prepare: false });
  register = new VehicleRegisterService({ database });
  await cleanup();
  await deploy`INSERT INTO public.tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order205','Order 205','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order205-foreign','Order 205 Foreign','shared','active')`;
  await deploy`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order205'::ltree,'property','Order 205','UTC','USD'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order205.other'::ltree,'property','Order 205 Other','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order205_foreign'::ltree,'property','Order 205 Foreign','UTC','USD')`;
  await deploy`INSERT INTO public.party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Order 205 Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
  await deploy`INSERT INTO public.reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES
    (${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O205-A','reserved',${PARTY}::uuid,'direct','USD'),
    (${OTHER_RESERVATION}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'O205-B','reserved',${PARTY}::uuid,'direct','USD'),
    (${FOREIGN_RESERVATION}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'O205-F','reserved',${FOREIGN_PARTY}::uuid,'direct','USD')`;
});

beforeEach(async () => {
  if (!deploy) return;
  await deploy`DELETE FROM public.vehicle WHERE tenant_id IN (${TENANT}::uuid, ${FOREIGN_TENANT}::uuid)`;
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await deploy?.close({ timeout: 0 });
});

databaseDescribe("Order 205 governed vehicle-register read", () => {
  test("P1 returns minimized literal fields in deterministic registration/id pages", async () => {
    const first = "00000000-0000-0000-0000-000000020541";
    const second = "00000000-0000-0000-0000-000000020542";
    const third = "00000000-0000-0000-0000-000000020543";
    await insertVehicle({
      id: second, registration: "KA-01-AA-0001", reservationId: RESERVATION,
      partyId: PARTY, make: "Tata", model: "Nexon", colour: "Blue",
      driverName: "Asha", enteredAt: "2026-08-28T04:05:06.123456Z",
      exitedAt: "2026-08-28T05:06:07.654321Z", notes: "must never leave PostgreSQL",
    });
    await insertVehicle({ id: first, registration: "KA-01-AA-0001" });
    await insertVehicle({ id: third, registration: "ka-01-aa-0001" });

    const page1 = await register!.list(input({ limit: 1 }));
    expect(page1.vehicles).toEqual([{
      vehicleId: first, registration: "KA-01-AA-0001", make: null, model: null,
      colour: null, driverName: null, reservationId: null, partyId: null,
      enteredAt: null, exitedAt: null,
    }]);
    expect(page1.nextCursor).toBeString();
    const page2 = await register!.list(input({ cursor: page1.nextCursor!, limit: 1 }));
    expect(page2.vehicles).toEqual([{
      vehicleId: second, registration: "KA-01-AA-0001", make: "Tata", model: "Nexon",
      colour: "Blue", driverName: "Asha", reservationId: RESERVATION, partyId: PARTY,
      enteredAt: "2026-08-28T04:05:06.123456Z", exitedAt: "2026-08-28T05:06:07.654321Z",
    }]);
    const page3 = await register!.list(input({ cursor: page2.nextCursor!, limit: 1 }));
    expect(page3.vehicles.map((vehicle) => vehicle.vehicleId)).toEqual([third]);
    expect(page3.nextCursor).toBeNull();
    expect(Object.isFrozen(page1)).toBe(true);
    expect(Object.isFrozen(page1.vehicles)).toBe(true);
    expect(Object.isFrozen(page1.vehicles[0])).toBe(true);
    expect(JSON.stringify(page2)).not.toContain("notes");
    expect(JSON.stringify(page2)).not.toContain("parking");
    expect(JSON.stringify(page2)).not.toContain("must never leave PostgreSQL");
  });

  test("P1 registration lookup is exact, literal and case-sensitive", async () => {
    await insertVehicle({ id: crypto.randomUUID(), registration: "DL 01 AB*123" });
    await insertVehicle({ id: crypto.randomUUID(), registration: "dl 01 ab*123" });
    expect((await register!.list(input({ registration: "DL 01 AB*123" }))).vehicles)
      .toHaveLength(1);
    expect((await register!.list(input({ registration: "dl 01 ab*123" }))).vehicles)
      .toHaveLength(1);
    expect((await register!.list(input({ registration: "DL 01 AB%123" }))).vehicles)
      .toHaveLength(0);
    expect((await register!.list(input({ registration: " DL 01 AB*123 " }))).vehicles)
      .toHaveLength(0);
  });

  test("P2 rejects malformed shape, bounds and non-canonical or mismatched cursors", async () => {
    await expect(register!.list(input({ tenantId: "NOT-A-UUID" })))
      .rejects.toBeInstanceOf(VehicleRegisterValidationError);
    await expect(register!.list({ ...input(), extra: true } as never))
      .rejects.toBeInstanceOf(VehicleRegisterValidationError);
    for (const limit of [0, 101, 1.5, Number.NaN]) {
      await expect(register!.list(input({ limit })))
        .rejects.toBeInstanceOf(VehicleRegisterValidationError);
    }
    await expect(register!.list(input({ cursor: "not-a-canonical-cursor" })))
      .rejects.toBeInstanceOf(VehicleRegisterValidationError);

    await insertVehicle({ id: crypto.randomUUID(), registration: "CURSOR-A" });
    await insertVehicle({ id: crypto.randomUUID(), registration: "CURSOR-B" });
    const cursor = (await register!.list(input({ limit: 1 }))).nextCursor!;
    await expect(register!.list(input({ registration: "CURSOR-B", cursor })))
      .rejects.toBeInstanceOf(VehicleRegisterValidationError);
    await expect(register!.list(input({ cursor: `${cursor}A` })))
      .rejects.toBeInstanceOf(VehicleRegisterValidationError);
  });

  test("P2 conceals other tenants/properties and fails a hostile association closed", async () => {
    await deploy!`INSERT INTO public.vehicle(id,tenant_id,property_node,reg_no)
      VALUES(${crypto.randomUUID()}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'FOREIGN')`;
    expect((await register!.list(input())).vehicles).toHaveLength(0);
    expect((await register!.list(input({ propertyNode: FOREIGN_PROPERTY }))).vehicles).toHaveLength(0);

    const hostileReservationVehicle = crypto.randomUUID();
    await insertVehicle({
      id: hostileReservationVehicle, registration: "HOSTILE-RESERVATION",
      reservationId: OTHER_RESERVATION,
    });
    await expect(register!.list(input({ registration: "HOSTILE-RESERVATION" })))
      .rejects.toBeInstanceOf(VehicleRegisterConflictError);
    await deploy!`DELETE FROM public.vehicle WHERE id=${hostileReservationVehicle}::uuid`;

    const hostilePartyVehicle = crypto.randomUUID();
    await insertVehicle({
      id: hostilePartyVehicle, registration: "HOSTILE-PARTY", partyId: FOREIGN_PARTY,
    });
    const error = await register!.list(input({ registration: "HOSTILE-PARTY" }))
      .then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(VehicleRegisterConflictError);
    expect(String(error)).not.toContain(FOREIGN_PARTY);
  });

  test("P3 repeated reads are byte-equivalent and mutate no register or shared truth", async () => {
    await insertVehicle({
      id: crypto.randomUUID(), registration: "MUTATION-FREE", reservationId: RESERVATION,
      partyId: PARTY, enteredAt: "2026-08-28T08:09:10.000001Z",
    });
    const before = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(vehicle) ORDER BY vehicle.id) FROM public.vehicle
          WHERE tenant_id=${TENANT}::uuid) AS vehicles,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks
    `;
    const results = await Promise.all(Array.from({ length: 12 }, () => register!.list(input())));
    const bytes = JSON.stringify(results[0]);
    expect(results.every((result) => JSON.stringify(result) === bytes)).toBe(true);
    const after = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(vehicle) ORDER BY vehicle.id) FROM public.vehicle
          WHERE tenant_id=${TENANT}::uuid) AS vehicles,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks
    `;
    expect(after).toEqual(before);
    expect(bytes).not.toContain("onsite");
  });
});
