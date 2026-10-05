import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { ReservationBoardService } from "../src/contexts/reservations";
import { Database } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000055701";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000055702";
const PARTY = "00000000-0000-0000-0000-000000055703";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000055704";
const KOLKATA = "00000000-0000-0000-0000-000000055710";
const NEW_YORK = "00000000-0000-0000-0000-000000055720";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000055730";

const DEPLOY_URL = process.env.YELLOW_OPERATIONAL_STATE_DEPLOY_URL;
const RUNTIME_URL = process.env.YELLOW_OPERATIONAL_STATE_RUNTIME_URL;
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

type StoredStatus = "due_in" | "due_out" | "in_house" | "checked_out";
type ExpectedState = StoredStatus | "checked_in_today" | "stayover" | "checked_out_today";
type Scenario = Readonly<{
  code: string;
  status: StoredStatus;
  segmentStatus: "booked" | "in_house" | "departed";
  startDay: number;
  startTime: string;
  endDay: number;
  endTime: string;
  factType?: "reservation.checked_in" | "reservation.checked_out";
  factDay?: number;
  expected: ExpectedState;
}>;

const scenarios: readonly Scenario[] = Object.freeze([
  { code: "due-in-early", status: "due_in", segmentStatus: "booked", startDay: 0, startTime: "00:05", endDay: 1, endTime: "11:00", expected: "due_in" },
  { code: "due-out-late", status: "due_out", segmentStatus: "in_house", startDay: -1, startTime: "15:00", endDay: 0, endTime: "23:55", expected: "due_out" },
  { code: "checked-in-early", status: "in_house", segmentStatus: "in_house", startDay: 0, startTime: "00:05", endDay: 1, endTime: "11:00", factType: "reservation.checked_in", factDay: 0, expected: "checked_in_today" },
  { code: "checked-in-late", status: "in_house", segmentStatus: "in_house", startDay: 0, startTime: "23:55", endDay: 1, endTime: "11:00", factType: "reservation.checked_in", factDay: 0, expected: "checked_in_today" },
  { code: "same-day-no-fact", status: "in_house", segmentStatus: "in_house", startDay: 0, startTime: "00:05", endDay: 1, endTime: "11:00", expected: "in_house" },
  { code: "overnight-stayover", status: "in_house", segmentStatus: "in_house", startDay: -1, startTime: "23:55", endDay: 1, endTime: "11:00", factType: "reservation.checked_in", factDay: -1, expected: "stayover" },
  { code: "checked-out-today", status: "checked_out", segmentStatus: "departed", startDay: -1, startTime: "15:00", endDay: 0, endTime: "08:00", factType: "reservation.checked_out", factDay: 0, expected: "checked_out_today" },
  { code: "checked-out-history", status: "checked_out", segmentStatus: "departed", startDay: -2, startTime: "15:00", endDay: -1, endTime: "08:00", factType: "reservation.checked_out", factDay: -1, expected: "checked_out" },
]);

const properties = Object.freeze([
  { id: KOLKATA, timezone: "Asia/Kolkata", path: "order557_kolkata", prefix: "KOL" },
  { id: NEW_YORK, timezone: "America/New_York", path: "order557_new_york", prefix: "NYC" },
]);

let deploy: SQL | undefined;
let runtime: Database | undefined;

function deterministicId(propertyIndex: number, scenarioIndex: number, kind: "reservation" | "segment"): string {
  const suffix = 100 + propertyIndex * 20 + scenarioIndex * 2 + (kind === "segment" ? 1 : 0);
  return `00000000-0000-0000-0000-${String(557000 + suffix).padStart(12, "0")}`;
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

async function cleanup() {
  if (!deploy) return;
  for (const tenant of [TENANT, FOREIGN_TENANT]) {
    for (const table of ["fact_log", "reservation_segment", "reservation", "sellable_unit", "rate_plan", "unit_type", "party", "org_node"]) {
      await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [tenant]);
    }
  }
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 2, prepare: false });
  runtime = Database.connect(RUNTIME_URL, { maxConnections: 2, prepare: false });
  await cleanup();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order557-state-matrix','Order 557 state matrix','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order557-state-foreign','Order 557 foreign','shared','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','State Matrix Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Matrix Guest','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${KOLKATA}::uuid,${TENANT}::uuid,'order557_kolkata','property','Kolkata Matrix','Asia/Kolkata','INR'),
    (${NEW_YORK}::uuid,${TENANT}::uuid,'order557_new_york','property','New York Matrix','America/New_York','USD'),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order557_foreign','property','Foreign Matrix','UTC','USD')`;

  for (const [propertyIndex, property] of properties.entries()) {
    const unitType = deterministicId(propertyIndex, 17, "reservation");
    const unit = deterministicId(propertyIndex, 17, "segment");
    const ratePlan = deterministicId(propertyIndex, 18, "reservation");
    await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key)
      VALUES (${unitType}::uuid,${TENANT}::uuid,${property.id}::uuid,${property.prefix},${`${property.prefix} Room`},'hotel')`;
    await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
      VALUES (${unit}::uuid,${TENANT}::uuid,${unitType}::uuid,${`${property.prefix} 101`},'active')`;
    await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,status)
      VALUES (${ratePlan}::uuid,${TENANT}::uuid,${property.id}::uuid,'BAR',${`${property.prefix} BAR`},${propertyIndex === 0 ? "INR" : "USD"},'active')`;

    for (const [scenarioIndex, scenario] of scenarios.entries()) {
      const reservationId = deterministicId(propertyIndex, scenarioIndex, "reservation");
      const segmentId = deterministicId(propertyIndex, scenarioIndex, "segment");
      const confirmation = `${property.prefix}-${scenario.code}`;
      await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
        VALUES (${reservationId}::uuid,${TENANT}::uuid,${property.id}::uuid,${confirmation},${scenario.status},${PARTY}::uuid,'direct',${propertyIndex === 0 ? "INR" : "USD"})`;
      await deploy`INSERT INTO reservation_segment(
        id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status
      ) SELECT ${segmentId}::uuid,${TENANT}::uuid,${reservationId}::uuid,1,${unitType}::uuid,${unit}::uuid,
        tstzrange(
          (((transaction_timestamp() AT TIME ZONE ${property.timezone})::date + ${scenario.startDay}::int + ${scenario.startTime}::time) AT TIME ZONE ${property.timezone}),
          (((transaction_timestamp() AT TIME ZONE ${property.timezone})::date + ${scenario.endDay}::int + ${scenario.endTime}::time) AT TIME ZONE ${property.timezone}),
          '[)'
        ),2,'[]'::jsonb,${ratePlan}::uuid,${scenario.segmentStatus}`;
      if (scenario.factType && scenario.factDay !== undefined) {
        await deploy`INSERT INTO fact_log(
          tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload
        ) VALUES (
          ${TENANT}::uuid,'reservation',${reservationId}::uuid,${scenario.factType},transaction_timestamp(),
          ((transaction_timestamp() AT TIME ZONE ${property.timezone})::date + ${scenario.factDay}::int),
          ${PARTY}::uuid,'{}'::jsonb
        )`;
      }
    }
  }
});

afterAll(async () => {
  await cleanup();
  await runtime?.close();
  await deploy?.close();
});

databaseDescribe("Order 557 reservation operational-state matrix", () => {
  test("reconciles source status, lifecycle facts, local dates and projected state in two timezones", async () => {
    const service = new ReservationBoardService();
    const before = (await deploy!<Array<{ reservations: number; segments: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT}::uuid) reservations,
        (SELECT count(*)::int FROM reservation_segment WHERE tenant_id=${TENANT}::uuid) segments,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) facts
    `)[0]!;

    for (const property of properties) {
      const board = await runtime!.withTenantTransaction(TENANT, (tx) => service.list(tx, {
        tenantId: TENANT,
        propertyNode: property.id,
        limit: 100,
      }));
      expect(board.reservations).toHaveLength(scenarios.length);
      const projected = new Map(board.reservations.map((row) => [row.confirmationNo, row]));
      const sources = await deploy!<Array<{
        confirmation_no: string;
        status: string;
        local_start: string;
        local_end: string;
        local_today: string;
        facts: Array<{ type: string; businessDate: string }>;
      }>>`
        SELECT reservation.confirmation_no,reservation.status,
          (lower(segment.period) AT TIME ZONE property.timezone)::date::text local_start,
          (upper(segment.period) AT TIME ZONE property.timezone)::date::text local_end,
          (transaction_timestamp() AT TIME ZONE property.timezone)::date::text local_today,
          coalesce((SELECT jsonb_agg(jsonb_build_object('type',fact.fact_type,'businessDate',fact.business_date::text)
            ORDER BY fact.business_date,fact.id) FROM fact_log fact
            WHERE fact.tenant_id=reservation.tenant_id AND fact.entity_type='reservation'
              AND fact.entity_id=reservation.id AND NOT EXISTS (
                SELECT 1 FROM fact_log successor WHERE successor.tenant_id=fact.tenant_id
                  AND successor.supersedes=fact.id
              )), '[]'::jsonb) facts
        FROM reservation
        JOIN reservation_segment segment ON segment.tenant_id=reservation.tenant_id AND segment.reservation_id=reservation.id
        JOIN org_node property ON property.tenant_id=reservation.tenant_id AND property.id=reservation.property_node
        WHERE reservation.tenant_id=${TENANT}::uuid AND reservation.property_node=${property.id}::uuid
        ORDER BY reservation.confirmation_no
      `;
      expect(sources).toHaveLength(scenarios.length);

      for (const scenario of scenarios) {
        const confirmation = `${property.prefix}-${scenario.code}`;
        const source = sources.find((row) => row.confirmation_no === confirmation)!;
        const result = projected.get(confirmation)!;
        expect(source.status).toBe(scenario.status);
        expect(result.status).toBe(scenario.status);
        expect(result.operationalState).toBe(scenario.expected);
        expect(source.local_today).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        expect(source.local_start).toBe(shiftDate(source.local_today, scenario.startDay));
        expect(source.local_end).toBe(shiftDate(source.local_today, scenario.endDay));
        if (scenario.factType) {
          expect(source.facts).toContainEqual({
            type: scenario.factType,
            businessDate: shiftDate(source.local_today, scenario.factDay!),
          });
        } else {
          expect(source.facts).toEqual([]);
        }
      }
    }

    const concealed = await runtime!.withTenantTransaction(FOREIGN_TENANT, (tx) => service.list(tx, {
      tenantId: TENANT,
      propertyNode: KOLKATA,
      limit: 100,
    }));
    expect(concealed.reservations).toEqual([]);
    const after = (await deploy!<Array<{ reservations: number; segments: number; facts: number }>>`
      SELECT
        (SELECT count(*)::int FROM reservation WHERE tenant_id=${TENANT}::uuid) reservations,
        (SELECT count(*)::int FROM reservation_segment WHERE tenant_id=${TENANT}::uuid) segments,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) facts
    `)[0]!;
    expect(after).toEqual(before);
  });
});
