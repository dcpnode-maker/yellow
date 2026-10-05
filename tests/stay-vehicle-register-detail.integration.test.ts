import { afterAll, beforeAll, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  VehicleRegisterConflictError,
  VehicleRegisterNotFoundError,
  VehicleRegisterService,
  VehicleRegisterValidationError,
} from "../src/contexts/stay-operations";
import { Database } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_VEHICLE_REGISTER_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_VEHICLE_REGISTER_DETAIL === "1";
if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_VEHICLE_REGISTER_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000021601";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000021602";
const PROPERTY = "00000000-0000-0000-0000-000000021611";
const OTHER_PROPERTY = "00000000-0000-0000-0000-000000021612";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000021613";
const PARTY = "00000000-0000-0000-0000-000000021621";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000021622";
const RESERVATION = "00000000-0000-0000-0000-000000021631";
const OTHER_RESERVATION = "00000000-0000-0000-0000-000000021632";
const VEHICLE = "00000000-0000-0000-0000-000000021641";

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

function input(vehicleId = VEHICLE) {
  return Object.freeze({ tenantId: TENANT, propertyNode: PROPERTY, vehicleId });
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 8, prepare: false });
  register = new VehicleRegisterService({ database });
  await cleanup();
  await deploy`INSERT INTO public.tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order216','Order 216','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order216-foreign','Order 216 Foreign','shared','active')`;
  await deploy`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order216'::ltree,'property','Order 216','UTC','USD'),
    (${OTHER_PROPERTY}::uuid,${TENANT}::uuid,'order216.other'::ltree,'property','Order 216 Other','UTC','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order216_foreign'::ltree,'property','Order 216 Foreign','UTC','USD')`;
  await deploy`INSERT INTO public.party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Order 216 Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
  await deploy`INSERT INTO public.reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency
    ) VALUES
    (${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O216-A','reserved',${PARTY}::uuid,'direct','USD'),
    (${OTHER_RESERVATION}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'O216-B','reserved',${PARTY}::uuid,'direct','USD')`;
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

databaseDescribe("Order 216 vehicle-register exact detail", () => {
  test("P1 returns only the frozen canonical Order205 row and preserves literal microseconds", async () => {
    await deploy!`INSERT INTO public.vehicle(
        id,tenant_id,property_node,reservation_id,party_id,reg_no,make,model,colour,
        driver_name,entered_at,exited_at,notes
      ) VALUES(
        ${VEHICLE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${PARTY}::uuid,
        ' MH 12 Ab* 1234 ','Tata','Nexon','Blue','Asha',
        '2026-08-28T04:05:06.123456Z'::timestamptz,'2026-08-28T05:06:07.654321Z'::timestamptz,
        'must never cross the detail boundary'
      )`;

    const detail = await register!.get(input());
    expect(detail).toEqual({
      vehicleId: VEHICLE,
      registration: " MH 12 Ab* 1234 ",
      make: "Tata",
      model: "Nexon",
      colour: "Blue",
      driverName: "Asha",
      reservationId: RESERVATION,
      partyId: PARTY,
      enteredAt: "2026-08-28T04:05:06.123456Z",
      exitedAt: "2026-08-28T05:06:07.654321Z",
    });
    expect(Object.keys(detail).sort()).toEqual([
      "colour", "driverName", "enteredAt", "exitedAt", "make", "model", "partyId",
      "registration", "reservationId", "vehicleId",
    ]);
    expect(Object.isFrozen(detail)).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/notes|parking|onsite|must never/i);
  });

  test("P2 rejects malformed input and conceals absent, foreign and wrong-property identities", async () => {
    await deploy!`INSERT INTO public.vehicle(id,tenant_id,property_node,reg_no) VALUES
      (${VEHICLE}::uuid,${TENANT}::uuid,${OTHER_PROPERTY}::uuid,'OTHER-PROPERTY'),
      (${crypto.randomUUID()}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'FOREIGN')`;

    for (const malformed of [
      { ...input(), tenantId: "NOT-A-UUID" },
      { ...input(), propertyNode: "NOT-A-UUID" },
      { ...input(), vehicleId: "NOT-A-UUID" },
      { ...input(), extra: true },
    ]) {
      await expect(register!.get(malformed as never)).rejects.toBeInstanceOf(VehicleRegisterValidationError);
    }
    await expect(register!.get(input())).rejects.toBeInstanceOf(VehicleRegisterNotFoundError);
    await expect(register!.get({ ...input(), propertyNode: FOREIGN_PROPERTY }))
      .rejects.toBeInstanceOf(VehicleRegisterNotFoundError);
    await expect(register!.get(input(crypto.randomUUID())))
      .rejects.toBeInstanceOf(VehicleRegisterNotFoundError);
  });

  test("P2 fails hostile reservation and Party associations closed without disclosing identifiers", async () => {
    await deploy!`INSERT INTO public.vehicle(
        id,tenant_id,property_node,reservation_id,party_id,reg_no
      ) VALUES(
        ${VEHICLE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${OTHER_RESERVATION}::uuid,null,'HOSTILE-RESERVATION'
      )`;
    let error = await register!.get(input()).then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(VehicleRegisterConflictError);
    expect(String(error)).not.toContain(OTHER_RESERVATION);

    await deploy!`DELETE FROM public.vehicle WHERE id=${VEHICLE}::uuid`;
    await deploy!`INSERT INTO public.vehicle(
        id,tenant_id,property_node,reservation_id,party_id,reg_no
      ) VALUES(
        ${VEHICLE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,null,${FOREIGN_PARTY}::uuid,'HOSTILE-PARTY'
      )`;
    error = await register!.get(input()).then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(VehicleRegisterConflictError);
    expect(String(error)).not.toContain(FOREIGN_PARTY);
  });

  test("P1/P3 repeated reads are byte-equivalent and mutate no shared truth", async () => {
    await deploy!`INSERT INTO public.vehicle(
        id,tenant_id,property_node,reservation_id,party_id,reg_no,entered_at
      ) VALUES(
        ${VEHICLE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${PARTY}::uuid,
        'MUTATION-FREE','2026-08-28T08:09:10.000001Z'::timestamptz
      )`;
    const before = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(vehicle) ORDER BY vehicle.id) FROM public.vehicle
          WHERE tenant_id=${TENANT}::uuid) AS vehicles,
        (SELECT count(*)::int FROM public.reservation WHERE tenant_id=${TENANT}::uuid) AS reservations,
        (SELECT count(*)::int FROM public.party WHERE tenant_id=${TENANT}::uuid) AS parties,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks
    `;
    const results = await Promise.all(Array.from({ length: 12 }, () => register!.get(input())));
    const bytes = JSON.stringify(results[0]);
    expect(results.every((result) => JSON.stringify(result) === bytes)).toBe(true);
    const after = await deploy!`
      SELECT
        (SELECT jsonb_agg(to_jsonb(vehicle) ORDER BY vehicle.id) FROM public.vehicle
          WHERE tenant_id=${TENANT}::uuid) AS vehicles,
        (SELECT count(*)::int FROM public.reservation WHERE tenant_id=${TENANT}::uuid) AS reservations,
        (SELECT count(*)::int FROM public.party WHERE tenant_id=${TENANT}::uuid) AS parties,
        (SELECT count(*)::int FROM public.space_occupancy WHERE tenant_id=${TENANT}::uuid) AS occupancies,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid) AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid) AS events,
        (SELECT count(*)::int FROM public.task WHERE tenant_id=${TENANT}::uuid) AS tasks
    `;
    expect(after).toEqual(before);
    expect(bytes).not.toMatch(/notes|parking|onsite/i);
  });
});
