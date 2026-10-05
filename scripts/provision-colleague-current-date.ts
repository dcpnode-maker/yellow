import { SQL, type ReservedSQL } from "bun";

import { SEED_TENANT } from "./seed";
import { uuidV5 } from "./lib/uuid-v5";
import { REVIEW_EMAIL, REVIEW_ROLE_NAME } from "./seed-review";

/**
 * Isolated, synthetic-only operating property for colleague review.
 *
 * This intentionally does not call runReviewSeed, modify its fixtures, or use
 * any imported guest/contact/payment data.  It is one atomic transaction: a
 * partial run rolls back, and an existing property must match its expected
 * cardinality before it is accepted as an idempotent replay.
 */
export const COLLEAGUE_SCENARIO_KEY = "yellow-colleague-current-date-v1";
export const COLLEAGUE_PROPERTY_PATH = "yellow_demo.colleague_current";
export const COLLEAGUE_PROPERTY_NAME = "Yellow House Mumbai";

export type ColleagueScenarioResult = Readonly<{
  propertyId: string;
  businessDate: string;
  rooms: number;
  arrivals: number;
  departures: number;
  inHouse: number;
  future: number;
  history: number;
}>;

type ScenarioReservation = Readonly<{
  name: string;
  confirmation: string;
  roomIndex: number;
  status: "due_in" | "due_out" | "in_house" | "reserved" | "checked_out";
  segmentStatus: "booked" | "in_house" | "departed";
  fromOffset: number;
  toOffset: number;
  repeat?: boolean;
}>;

const ROOM_TYPES = Object.freeze([
  { code: "COSY", name: "Cosy King", base: 2, maximum: 2, rooms: 6 },
  { code: "PREM", name: "Premium King", base: 2, maximum: 3, rooms: 8 },
  { code: "FAM", name: "Family Studio", base: 3, maximum: 4, rooms: 6 },
  { code: "SUITE", name: "Terrace Suite", base: 2, maximum: 3, rooms: 4 },
] as const);

const RESERVATIONS: readonly ScenarioReservation[] = Object.freeze([
  { name: "Ananya Deshmukh", confirmation: "YHM-26001", roomIndex: 0, status: "due_in", segmentStatus: "booked", fromOffset: 0, toOffset: 2, repeat: true },
  { name: "Dev Malhotra", confirmation: "YHM-26002", roomIndex: 1, status: "due_in", segmentStatus: "booked", fromOffset: 0, toOffset: 1 },
  { name: "Mira Banerjee", confirmation: "YHM-26003", roomIndex: 2, status: "due_in", segmentStatus: "booked", fromOffset: 0, toOffset: 3 },
  { name: "Ishaan Kapoor", confirmation: "YHM-26004", roomIndex: 3, status: "due_in", segmentStatus: "booked", fromOffset: 0, toOffset: 2 },
  { name: "Naina Pillai", confirmation: "YHM-26005", roomIndex: 4, status: "due_in", segmentStatus: "booked", fromOffset: 0, toOffset: 4 },
  { name: "Arjun Sethi", confirmation: "YHM-26006", roomIndex: 5, status: "due_out", segmentStatus: "in_house", fromOffset: -2, toOffset: 0 },
  { name: "Zoya Merchant", confirmation: "YHM-26007", roomIndex: 6, status: "due_out", segmentStatus: "in_house", fromOffset: -1, toOffset: 0 },
  { name: "Kabir Shah", confirmation: "YHM-26008", roomIndex: 7, status: "due_out", segmentStatus: "in_house", fromOffset: -3, toOffset: 0 },
  { name: "Ananya Deshmukh", confirmation: "YHM-26009", roomIndex: 8, status: "in_house", segmentStatus: "in_house", fromOffset: -1, toOffset: 2, repeat: true },
  { name: "Rhea Nair", confirmation: "YHM-26010", roomIndex: 9, status: "in_house", segmentStatus: "in_house", fromOffset: -2, toOffset: 1 },
  { name: "Vihaan Bose", confirmation: "YHM-26011", roomIndex: 10, status: "in_house", segmentStatus: "in_house", fromOffset: -4, toOffset: 2 },
  { name: "Tara Khanna", confirmation: "YHM-26012", roomIndex: 11, status: "in_house", segmentStatus: "in_house", fromOffset: -1, toOffset: 4 },
  { name: "Neil Fernandes", confirmation: "YHM-26013", roomIndex: 12, status: "in_house", segmentStatus: "in_house", fromOffset: -6, toOffset: 1 },
  { name: "Sara Menon", confirmation: "YHM-26014", roomIndex: 13, status: "in_house", segmentStatus: "in_house", fromOffset: -2, toOffset: 5 },
  { name: "Aarohi Jain", confirmation: "YHM-26015", roomIndex: 14, status: "in_house", segmentStatus: "in_house", fromOffset: -1, toOffset: 3 },
  { name: "Harsh Vora", confirmation: "YHM-26016", roomIndex: 15, status: "reserved", segmentStatus: "booked", fromOffset: 2, toOffset: 4 },
  { name: "Leela Krishnan", confirmation: "YHM-26017", roomIndex: 16, status: "reserved", segmentStatus: "booked", fromOffset: 3, toOffset: 6 },
  { name: "Omar Siddiqui", confirmation: "YHM-26018", roomIndex: 17, status: "reserved", segmentStatus: "booked", fromOffset: 5, toOffset: 7 },
  { name: "Pooja Bhat", confirmation: "YHM-26019", roomIndex: 18, status: "reserved", segmentStatus: "booked", fromOffset: 7, toOffset: 9 },
  { name: "Ananya Deshmukh", confirmation: "YHM-25001", roomIndex: 19, status: "checked_out", segmentStatus: "departed", fromOffset: -91, toOffset: -88, repeat: true },
  { name: "Kunal Arora", confirmation: "YHM-25002", roomIndex: 20, status: "checked_out", segmentStatus: "departed", fromOffset: -42, toOffset: -40 },
] as const);

function localDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value: item }) => [type, item]));
  const year = value.year;
  const month = value.month;
  const day = value.day;
  if (!year || !month || !day) throw new Error("property-local business date is unavailable");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

async function id(suffix: string): Promise<string> {
  return uuidV5(SEED_TENANT.id, `${COLLEAGUE_SCENARIO_KEY}/${suffix}`);
}

async function withTransaction<T>(pool: SQL, operation: (tx: ReservedSQL) => Promise<T>): Promise<T> {
  const tx = await pool.reserve();
  let open = false;
  try {
    await tx.unsafe("BEGIN");
    open = true;
    await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
    const result = await operation(tx);
    await tx.unsafe("COMMIT");
    open = false;
    return result;
  } catch (error) {
    if (open) await tx.unsafe("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}

async function auditScenarioWrite(
  tx: ReservedSQL,
  input: Readonly<{
    suffix: string;
    businessDate: string;
    propertyId: string;
    actorId: string;
    entityType: string;
    entityId: string;
    aggregateId?: string;
    factType: string;
    aggregateType: string;
    eventType: string;
    payload: Record<string, unknown>;
  }>,
): Promise<void> {
  const correlationId = await id("correlation");
  const payload = { scenario: COLLEAGUE_SCENARIO_KEY, ...input.payload };
  await tx`INSERT INTO fact_log (id, tenant_id, entity_type, entity_id, fact_type, valid_from, business_date, actor_id, payload)
    VALUES (${await id(`fact/${input.suffix}`)}::uuid, ${SEED_TENANT.id}::uuid, ${input.entityType}, ${input.entityId}::uuid,
      ${input.factType}, transaction_timestamp(), ${input.businessDate}::date, ${input.actorId}::uuid,
      ${JSON.stringify(payload)}::text::jsonb)`;
  await tx`INSERT INTO outbox (id, tenant_id, property_node, business_date, aggregate_type, aggregate_id, event_type, actor_id, correlation_id, payload)
    VALUES (${await id(`event/${input.suffix}`)}::uuid, ${SEED_TENANT.id}::uuid, ${input.propertyId}::uuid, ${input.businessDate}::date,
      ${input.aggregateType}, ${(input.aggregateId ?? input.entityId)}::uuid, ${input.eventType}, ${input.actorId}::uuid, ${correlationId}::uuid,
      ${JSON.stringify(payload)}::text::jsonb)`;
}

export async function provisionColleagueCurrentDateScenario(options: Readonly<{ databaseUrl: string; businessDate?: string }>): Promise<ColleagueScenarioResult> {
  if (!options.databaseUrl) throw new Error("databaseUrl is required");
  const businessDate = options.businessDate ?? localDate("Asia/Kolkata");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new Error("businessDate must use YYYY-MM-DD");
  const propertyId = await id("property");
  const pool = new SQL(options.databaseUrl, { max: 1, prepare: false });
  try {
    return await withTransaction(pool, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${COLLEAGUE_SCENARIO_KEY}, 486))`;
      const expectedPropertyConfig = { synthetic: true, scenario: COLLEAGUE_SCENARIO_KEY, contact_free: true, business_date: businessDate };
      const existing = await tx<Array<{ id: string; name: string; timezone: string; currency: string; config_exact: boolean }>>`
        SELECT id, name, timezone, currency::text AS currency,
          config = ${JSON.stringify(expectedPropertyConfig)}::text::jsonb AS config_exact
        FROM org_node
        WHERE id=${propertyId}::uuid OR (tenant_id=${SEED_TENANT.id}::uuid AND path=${COLLEAGUE_PROPERTY_PATH}::ltree)
        ORDER BY id FOR UPDATE`;
      if (existing.length > 0) {
        if (existing.length !== 1 || existing[0]?.id !== propertyId || existing[0].name !== COLLEAGUE_PROPERTY_NAME ||
            existing[0].timezone !== "Asia/Kolkata" || existing[0].currency !== "INR" || !existing[0].config_exact) {
          throw new Error("colleague scenario property collides with non-canonical data");
        }
        const counts = await tx<Array<{ rooms: number; unit_types: number; sellable_units: number; rate_plans: number; arrivals: number; departures: number; in_house: number; future: number; history: number; grants: number; occupancy: number; ooo: number; drawers: number; conditions: number; tasks: number; facts: number; events: number }>>`
          SELECT
            (SELECT count(*)::int FROM space WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid) AS rooms,
            (SELECT count(*)::int FROM unit_type WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid) AS unit_types,
            (SELECT count(*)::int FROM sellable_unit su JOIN unit_type ut ON ut.id=su.unit_type_id AND ut.tenant_id=su.tenant_id WHERE ut.tenant_id=${SEED_TENANT.id}::uuid AND ut.property_node=${propertyId}::uuid) AS sellable_units,
            (SELECT count(*)::int FROM rate_plan WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND code='BAR') AS rate_plans,
            (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND status='due_in') AS arrivals,
            (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND status='due_out') AS departures,
            (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND status='in_house') AS in_house,
            (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND status='reserved') AS future,
            (SELECT count(*)::int FROM reservation WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND status='checked_out') AS history,
            (SELECT count(*)::int FROM user_role WHERE tenant_id=${SEED_TENANT.id}::uuid AND scope_node=${propertyId}::uuid) AS grants,
            (SELECT count(*)::int FROM space_occupancy so JOIN space s ON s.id=so.space_id AND s.tenant_id=so.tenant_id WHERE so.tenant_id=${SEED_TENANT.id}::uuid AND s.property_node=${propertyId}::uuid) AS occupancy,
            (SELECT count(*)::int FROM ooo_oos o JOIN space s ON s.id=o.space_id AND s.tenant_id=o.tenant_id WHERE o.tenant_id=${SEED_TENANT.id}::uuid AND s.property_node=${propertyId}::uuid AND o.kind='ooo') AS ooo,
            (SELECT count(*)::int FROM cash_drawer WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND code='FRONT-DESK-1') AS drawers,
            (SELECT count(*)::int FROM unit_condition c JOIN space s ON s.id=c.space_id AND s.tenant_id=c.tenant_id WHERE c.tenant_id=${SEED_TENANT.id}::uuid AND s.property_node=${propertyId}::uuid) AS conditions,
            (SELECT count(*)::int FROM task WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid AND kind='housekeeping') AS tasks,
            (SELECT count(*)::int FROM fact_log WHERE tenant_id=${SEED_TENANT.id}::uuid AND payload @> ${JSON.stringify({ scenario: COLLEAGUE_SCENARIO_KEY })}::text::jsonb) AS facts,
            (SELECT count(*)::int FROM outbox WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${propertyId}::uuid) AS events`;
        const row = counts[0];
        if (!row || row.rooms !== 24 || row.unit_types !== 4 || row.sellable_units !== 24 || row.rate_plans !== 1 ||
            row.arrivals !== 5 || row.departures !== 3 || row.in_house !== 7 || row.future !== 4 || row.history !== 2 ||
            row.grants !== 1 || row.occupancy !== 20 || row.ooo !== 1 || row.drawers !== 1 || row.conditions !== 24 ||
            row.tasks !== 12 || row.facts !== 132 || row.events !== 132) {
          throw new Error("colleague scenario existing cardinality is not canonical");
        }
        return Object.freeze({ propertyId, businessDate, rooms: row.rooms, arrivals: row.arrivals, departures: row.departures, inHouse: row.in_house, future: row.future, history: row.history });
      }

      const identity = await tx<Array<{ user_id: string; role_id: string }>>`
        SELECT u.id AS user_id, r.id AS role_id FROM app_user u JOIN role r ON r.tenant_id=u.tenant_id
        WHERE u.tenant_id=${SEED_TENANT.id}::uuid AND u.email=${REVIEW_EMAIL} AND u.status='active' AND r.name=${REVIEW_ROLE_NAME}`;
      const actor = identity[0];
      if (!actor || identity.length !== 1) throw new Error("canonical review operator and role must exist before colleague scenario provision");

      await tx`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
        VALUES (${propertyId}::uuid, ${SEED_TENANT.id}::uuid, ${COLLEAGUE_PROPERTY_PATH}::ltree, 'property',
          ${COLLEAGUE_PROPERTY_NAME}, 'Asia/Kolkata', 'INR',
          ${JSON.stringify(expectedPropertyConfig)}::text::jsonb)`;
      await tx`INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
        VALUES (${SEED_TENANT.id}::uuid, ${actor.user_id}::uuid, ${actor.role_id}::uuid, ${propertyId}::uuid)`;
      await auditScenarioWrite(tx, { suffix: "property", businessDate, propertyId, actorId: actor.user_id,
        entityType: "property", entityId: propertyId, factType: "scenario.property.provisioned",
        aggregateType: "property", eventType: "scenario.property.provisioned",
        payload: { synthetic: true, scenario: COLLEAGUE_SCENARIO_KEY } });

      const rooms: Array<{ spaceId: string; unitTypeId: string; code: string }> = [];
      let roomNumber = 401;
      for (const type of ROOM_TYPES) {
        const unitTypeId = await id(`unit-type/${type.code}`);
        await tx`INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy, attrs, sort_order)
          VALUES (${unitTypeId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyId}::uuid, ${type.code}, ${type.name}, 'hotel', ${type.base}, ${type.maximum},
            ${JSON.stringify({ synthetic: true, scenario: COLLEAGUE_SCENARIO_KEY })}::text::jsonb, ${ROOM_TYPES.indexOf(type) + 1})`;
        await auditScenarioWrite(tx, { suffix: `unit-type/${type.code}`, businessDate, propertyId, actorId: actor.user_id,
          entityType: "unit_type", entityId: unitTypeId, factType: "unit_type.created", aggregateType: "unit_type", eventType: "unit_type.created",
          payload: { unit_type_id: unitTypeId, code: type.code } });
        for (let index = 0; index < type.rooms; index += 1) {
          const code = String(roomNumber++);
          const spaceId = await id(`space/${code}`);
          const sellableId = await id(`sellable/${code}`);
          await tx`INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity, floor, attrs, status)
            VALUES (${spaceId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyId}::uuid, ${code}, 'hotel', 1, ${code.slice(0, 1)},
              ${JSON.stringify({ synthetic: true, scenario: COLLEAGUE_SCENARIO_KEY })}::text::jsonb, 'active')`;
          await auditScenarioWrite(tx, { suffix: `space/${code}`, businessDate, propertyId, actorId: actor.user_id,
            entityType: "space", entityId: spaceId, factType: "space.created", aggregateType: "space", eventType: "space.created",
            payload: { space_id: spaceId, code, capacity: 1 } });
          await tx`INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status)
            VALUES (${sellableId}::uuid, ${SEED_TENANT.id}::uuid, ${unitTypeId}::uuid, ${`${type.name} ${code}`}, 'active')`;
          await tx`INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
            VALUES (${SEED_TENANT.id}::uuid, ${sellableId}::uuid, ${spaceId}::uuid, 'exclusive')`;
          await auditScenarioWrite(tx, { suffix: `sellable/${code}`, businessDate, propertyId, actorId: actor.user_id,
            entityType: "sellable_unit", entityId: sellableId, factType: "sellable_unit.created", aggregateType: "sellable_unit", eventType: "sellable_unit.created",
            payload: { sellable_unit_id: sellableId, unit_type_id: unitTypeId, space_claims: [{ space_id: spaceId, claim_mode: "exclusive" }] } });
          rooms.push({ spaceId, unitTypeId, code });
        }
      }
      const ratePlanId = await id("rate-plan/BAR");
      await tx`INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, tax_inclusive, status)
        VALUES (${ratePlanId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyId}::uuid, 'BAR', 'Best Available Rate', 'INR', true, 'active')`;

      for (const [index, stay] of RESERVATIONS.entries()) {
        const partyId = await id(`party/${stay.repeat ? "ananya" : index}`);
        const reservationId = await id(`reservation/${stay.confirmation}`);
        const segmentId = await id(`segment/${stay.confirmation}`);
        const room = rooms[stay.roomIndex];
        if (!room) throw new Error(`scenario room ${stay.roomIndex} is missing`);
        const partyExists = await tx<Array<{ id: string }>>`SELECT id FROM party WHERE id=${partyId}::uuid`;
        if (partyExists.length === 0) {
          await tx`INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
            VALUES (${partyId}::uuid, ${SEED_TENANT.id}::uuid, 'person', ${stay.name}, ${stay.name},
              ${JSON.stringify({ synthetic: true, contact_free: true, scenario: COLLEAGUE_SCENARIO_KEY })}::text::jsonb, 'active')`;
          await tx`INSERT INTO party_role (tenant_id, party_id, role, detail)
            VALUES (${SEED_TENANT.id}::uuid, ${partyId}::uuid, 'guest', ${JSON.stringify({ synthetic: true })}::text::jsonb)`;
        }
        const from = addDays(businessDate, stay.fromOffset);
        const to = addDays(businessDate, stay.toOffset);
        await tx`INSERT INTO reservation (id, tenant_id, property_node, confirmation_no, status, primary_party, channel_code, market_code, source_code, currency, notes)
          VALUES (${reservationId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyId}::uuid, ${stay.confirmation}, ${stay.status}, ${partyId}::uuid,
            'direct', 'leisure', 'website', 'INR', 'Synthetic colleague operating scenario')`;
        await tx`INSERT INTO reservation_segment (id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period, adults, children, rate_plan_id, status)
          VALUES (${segmentId}::uuid, ${SEED_TENANT.id}::uuid, ${reservationId}::uuid, 1, ${room.unitTypeId}::uuid, ${await id(`sellable/${room.code}`)}::uuid,
            tstzrange(${`${from}T15:00:00+05:30`}::timestamptz, ${`${to}T11:00:00+05:30`}::timestamptz, '[)'), 2, '[]'::jsonb, ${ratePlanId}::uuid, ${stay.segmentStatus})`;
        await tx`INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role) VALUES (${SEED_TENANT.id}::uuid, ${reservationId}::uuid, ${partyId}::uuid, 'primary')`;
        await auditScenarioWrite(tx, { suffix: `reservation/${stay.confirmation}`, businessDate, propertyId, actorId: actor.user_id,
          entityType: "reservation", entityId: reservationId, factType: "reservation.scenario_seeded", aggregateType: "reservation", eventType: "reservation.scenario_seeded",
          payload: { synthetic: true, status: stay.status } });
        if (stay.status !== "checked_out") {
        const occupancyRows = await tx<Array<{ id: string }>>`SELECT record_occupancy(${SEED_TENANT.id}::uuid, ${room.spaceId}::uuid,
          tstzrange(${`${from}T15:00:00+05:30`}::timestamptz, ${`${to}T11:00:00+05:30`}::timestamptz, '[)'), ${segmentId}::uuid, 'segment', true) AS id`;
        const occupancyId = occupancyRows[0]?.id;
        if (!occupancyId) throw new Error(`occupancy was not returned for ${stay.confirmation}`);
        const period = `["${from}T15:00:00+05:30","${to}T11:00:00+05:30")`;
        await auditScenarioWrite(tx, { suffix: `occupancy/${stay.confirmation}`, businessDate, propertyId, actorId: actor.user_id,
          entityType: "reservation", entityId: reservationId, factType: "occupancy.recorded", aggregateType: "space_occupancy", eventType: "occupancy.recorded",
          aggregateId: occupancyId,
          payload: { occupancy_id: occupancyId, reservation_id: reservationId, segment_id: segmentId, slot_kind: "segment", space_id: room.spaceId, period, exclusive: true } });
        }
      }

      const conditions = ["clean", "inspected", "dirty", "pickup"] as const;
      for (const [index, room] of rooms.entries()) {
        const condition = conditions[index % conditions.length]!;
        await tx`INSERT INTO unit_condition (tenant_id, space_id, condition, updated_by)
          VALUES (${SEED_TENANT.id}::uuid, ${room.spaceId}::uuid, ${condition}, ${actor.user_id}::uuid)`;
        await auditScenarioWrite(tx, { suffix: `condition/${room.code}`, businessDate, propertyId, actorId: actor.user_id,
          entityType: "unit_condition", entityId: room.spaceId, factType: "unit_condition.initialized", aggregateType: "unit_condition", eventType: "unit_condition.initialized",
          payload: { space_id: room.spaceId, condition } });
        if (condition === "dirty" || condition === "pickup") {
          const taskId = await id(`task/${room.code}`);
          await tx`INSERT INTO task (id, tenant_id, property_node, kind, status, subject_type, subject_id, department, due_at, priority, credits, payload)
            VALUES (${taskId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyId}::uuid, 'housekeeping',
              ${condition === "pickup" ? "assigned" : "open"}, 'space', ${room.spaceId}::uuid, 'housekeeping', transaction_timestamp(),
              ${condition === "pickup" ? 1 : 2}, 1, ${JSON.stringify({ synthetic: true, room: room.code, task: `${condition}_turnaround` })}::text::jsonb)`;
          await auditScenarioWrite(tx, { suffix: `task/${room.code}`, businessDate, propertyId, actorId: actor.user_id,
            entityType: "task", entityId: taskId, factType: "task.created", aggregateType: "task", eventType: "task.created",
            payload: { task_id: taskId, kind: "housekeeping", space_id: room.spaceId, condition } });
        }
      }
      const oooId = await id("ooo/424");
      const oooRoom = rooms[23];
      if (!oooRoom) throw new Error("OOO room is missing");
      await tx`INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason)
        VALUES (${oooId}::uuid, ${SEED_TENANT.id}::uuid, ${oooRoom.spaceId}::uuid, 'ooo',
          tstzrange(${`${businessDate}T00:00:00+05:30`}::timestamptz, ${`${addDays(businessDate, 3)}T00:00:00+05:30`}::timestamptz, '[)'), 'Synthetic maintenance scenario')`;
      const oooOccupancyRows = await tx<Array<{ id: string }>>`SELECT record_occupancy(${SEED_TENANT.id}::uuid, ${oooRoom.spaceId}::uuid,
        tstzrange(${`${businessDate}T00:00:00+05:30`}::timestamptz, ${`${addDays(businessDate, 3)}T00:00:00+05:30`}::timestamptz, '[)'), ${oooId}::uuid, 'ooo', true) AS id`;
      const oooOccupancyId = oooOccupancyRows[0]?.id;
      if (!oooOccupancyId) throw new Error("OOO occupancy was not returned");
      const oooPeriod = `["${businessDate}T00:00:00+05:30","${addDays(businessDate, 3)}T00:00:00+05:30")`;
      await auditScenarioWrite(tx, { suffix: "ooo/424", businessDate, propertyId, actorId: actor.user_id,
        entityType: "ooo_oos", entityId: oooId, factType: "ooo.opened", aggregateType: "ooo_oos", eventType: "ooo.opened",
        payload: { block_id: oooId, kind: "ooo", space_id: oooRoom.spaceId, period: oooPeriod, reason: "Synthetic maintenance scenario" } });
      await auditScenarioWrite(tx, { suffix: "occupancy/ooo/424", businessDate, propertyId, actorId: actor.user_id,
        entityType: "ooo_oos", entityId: oooId, factType: "occupancy.recorded", aggregateType: "space_occupancy", eventType: "occupancy.recorded",
        aggregateId: oooOccupancyId,
        payload: { occupancy_id: oooOccupancyId, block_id: oooId, slot_kind: "ooo", space_id: oooRoom.spaceId, period: oooPeriod, exclusive: true } });

      const cashAccountId = await id("account/cash");
      const drawerId = await id("drawer/front-desk");
      await tx`INSERT INTO account (id, tenant_id, property_node, role, name, currency, status)
        VALUES (${cashAccountId}::uuid, ${SEED_TENANT.id}::uuid, ${propertyId}::uuid, 'cash', 'Front Desk Cash', 'INR', 'open')`;
      await tx`INSERT INTO cash_drawer (tenant_id, id, property_node, account_id, code, name, currency, active)
        VALUES (${SEED_TENANT.id}::uuid, ${drawerId}::uuid, ${propertyId}::uuid, ${cashAccountId}::uuid, 'FRONT-DESK-1', 'Front Desk 1', 'INR', true)`;
      await auditScenarioWrite(tx, { suffix: "drawer/front-desk", businessDate, propertyId, actorId: actor.user_id,
        entityType: "cash_drawer", entityId: drawerId, factType: "cash_drawer.created", aggregateType: "cash_drawer", eventType: "cash_drawer.created",
        payload: { drawer_id: drawerId, code: "FRONT-DESK-1", currency: "INR" } });
      for (const denomination of [100n, 500n, 1000n, 2000n]) {
        await tx`INSERT INTO cash_drawer_denomination (tenant_id, drawer_id, unit_minor, active)
          VALUES (${SEED_TENANT.id}::uuid, ${drawerId}::uuid, ${denomination}, true)`;
      }
      return Object.freeze({ propertyId, businessDate, rooms: 24, arrivals: 5, departures: 3, inHouse: 7, future: 4, history: 2 });
    });
  } finally {
    await pool.close({ timeout: 0 });
  }
}

if (import.meta.main || process.env.YELLOW_RUN_COLLEAGUE_SCENARIO === "1") {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_DEPLOY_DATABASE_URL or DATABASE_URL is required");
  await provisionColleagueCurrentDateScenario({ databaseUrl });
}
