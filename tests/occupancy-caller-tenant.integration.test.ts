import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL, type ReservedSQL } from "bun";

import { Database } from "../src/kernel";

const URL = process.env.YELLOW_OCCUPANCY_CALLER_TENANT_URL;
if (process.env.YELLOW_REQUIRE_OCCUPANCY_CALLER_TENANT === "1" && !URL) {
  throw new Error("YELLOW_OCCUPANCY_CALLER_TENANT_URL is required by the Order 126 proof");
}

const TENANT_A = "00000000-0000-0000-0000-000000012601";
const TENANT_B = "00000000-0000-0000-0000-000000012602";
const PROPERTY_A = "00000000-0000-0000-0000-000000012611";
const PROPERTY_B = "00000000-0000-0000-0000-000000012612";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000012613";
const SPACE_A = "00000000-0000-0000-0000-000000012621";
const SPACE_B = "00000000-0000-0000-0000-000000012622";
const SPACE_DORM = "00000000-0000-0000-0000-000000012623";
const SPACE_INACTIVE = "00000000-0000-0000-0000-000000012624";
const SPACE_WRONG_PROPERTY = "00000000-0000-0000-0000-000000012625";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000012631";
const UNIT_TYPE_B = "00000000-0000-0000-0000-000000012632";
const UNIT_TYPE_DORM = "00000000-0000-0000-0000-000000012633";
const SELLABLE_A = "00000000-0000-0000-0000-000000012641";
const SELLABLE_B = "00000000-0000-0000-0000-000000012642";
const SELLABLE_DORM_EXCLUSIVE = "00000000-0000-0000-0000-000000012643";
const SELLABLE_DORM_POSITIONAL = "00000000-0000-0000-0000-000000012644";
const SELLABLE_INACTIVE = "00000000-0000-0000-0000-000000012645";
const SELLABLE_WRONG_PROPERTY = "00000000-0000-0000-0000-000000012646";
const FOREIGN_SLOT_A = "00000000-0000-0000-0000-000000012651";
const VICTIM_SLOT_B = "00000000-0000-0000-0000-000000012652";
const STALE_SLOT_A = "00000000-0000-0000-0000-000000012653";
const INACTIVE_SLOT_A = "00000000-0000-0000-0000-000000012654";
const WRONG_PROPERTY_SLOT_A = "00000000-0000-0000-0000-000000012655";
const PARTY_A = "00000000-0000-0000-0000-000000012656";
const RATE_A = "00000000-0000-0000-0000-000000012657";
const RESERVATION_A = "00000000-0000-0000-0000-000000012658";
const SEGMENT_A = "00000000-0000-0000-0000-000000012659";
const OOO_A = "00000000-0000-0000-0000-000000012660";
const CANCELLED_SEGMENT_A = "00000000-0000-0000-0000-000000012661";
const HOSTILE_PERIOD = "[2026-09-01 00:00:00+00,2026-09-02 00:00:00+00)";
const VICTIM_PERIOD = "[2026-09-03 00:00:00+00,2026-09-04 00:00:00+00)";
const SEGMENT_PERIOD = "[2026-10-20 00:00:00+00,2026-10-21 00:00:00+00)";
const OOO_PERIOD = "[2026-10-22 00:00:00+00,2026-10-23 00:00:00+00)";
const CANCELLED_SEGMENT_PERIOD = "[2026-10-24 00:00:00+00,2026-10-25 00:00:00+00)";
const EXCLUSIVE_RACE_PERIOD = "[2026-11-01 00:00:00+00,2026-11-02 00:00:00+00)";
const POSITIONAL_RACE_PERIOD = "[2026-11-03 00:00:00+00,2026-11-04 00:00:00+00)";
const MODE_CONFLICT_PERIOD = "[2026-11-05 00:00:00+00,2026-11-06 00:00:00+00)";

function fixtureUuid(value: number): string {
  return `00000000-0000-0000-0000-${value.toString().padStart(12, "0")}`;
}

const EXCLUSIVE_RACE_SLOTS = Object.freeze(Array.from({ length: 50 }, (_, index) => fixtureUuid(126700 + index)));
const POSITIONAL_RACE_SLOTS = Object.freeze(Array.from({ length: 40 }, (_, index) => fixtureUuid(126800 + index)));
const MODE_EXCLUSIVE_SLOT = fixtureUuid(126900);
const MODE_POSITIONAL_SLOT = fixtureUuid(126901);

const databaseDescribe = URL ? describe.serial : describe.skip;
const admin = URL ? new SQL(URL, { max: 1 }) : undefined;
const database = URL ? Database.connect(URL, { maxConnections: 60 }) : undefined;

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { errno?: unknown; code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

async function captureState(operation: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await operation();
  } catch (error) {
    return sqlState(error);
  }
  return undefined;
}

async function asAppWithoutTenant(operation: (connection: ReservedSQL) => Promise<unknown>) {
  const connection = await admin!.reserve();
  try {
    await connection.unsafe("BEGIN");
    await connection.unsafe("SET LOCAL ROLE app_role");
    const state = await captureState(() => operation(connection));
    await connection.unsafe("ROLLBACK");
    return state;
  } finally {
    connection.release();
  }
}

async function attemptClaim(input: {
  slot: string;
  space: string;
  period: string;
  kind?: "hold" | "segment" | "ooo";
  exclusive: boolean;
}): Promise<{ state?: string; id?: string }> {
  try {
    const rows = await database!.withTenantTransaction(TENANT_A, (tx) => tx<Array<{ id: string }>>`
      SELECT public.record_occupancy(
        ${TENANT_A}::uuid, ${input.space}::uuid, ${input.period}::tstzrange,
        ${input.slot}::uuid, ${input.kind ?? "hold"}, ${input.exclusive}
      ) AS id
    `);
    return { id: rows[0]?.id };
  } catch (error) {
    return { state: sqlState(error) };
  }
}

async function counts(): Promise<{ hostile: number; victim: number }> {
  const rows = await admin!<Array<{ hostile: number; victim: number }>>`
    SELECT
      count(*) FILTER (
        WHERE tenant_id = ${TENANT_B}::uuid
          AND slot_ref = ${FOREIGN_SLOT_A}::uuid
      )::int AS hostile,
      count(*) FILTER (
        WHERE tenant_id = ${TENANT_B}::uuid
          AND slot_ref = ${VICTIM_SLOT_B}::uuid
      )::int AS victim
    FROM public.space_occupancy
  `;
  return rows[0]!;
}

async function cleanupClaims(): Promise<void> {
  const claims = await admin!<Array<{ tenantId: string; slotRef: string }>>`
    SELECT DISTINCT tenant_id::text AS "tenantId", slot_ref::text AS "slotRef"
      FROM public.space_occupancy
     WHERE tenant_id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)
     ORDER BY tenant_id::text, slot_ref::text
  `;
  for (const claim of claims) {
    await admin!`SELECT public.release_occupancy(${claim.tenantId}::uuid, ${claim.slotRef}::uuid)`;
  }
}

beforeAll(async () => {
  if (!admin) return;
  await admin.unsafe(`
    INSERT INTO public.tenant (id, slug, name) VALUES
      ('${TENANT_A}', 'order126-a', 'Order 126 A'),
      ('${TENANT_B}', 'order126-b', 'Order 126 B');
    INSERT INTO public.org_node
      (id, tenant_id, path, kind, name, timezone, currency) VALUES
      ('${PROPERTY_A}', '${TENANT_A}', 'order126_a', 'property', 'Order 126 A', 'UTC', 'USD'),
      ('${PROPERTY_B}', '${TENANT_B}', 'order126_b', 'property', 'Order 126 B', 'UTC', 'USD'),
      ('${PROPERTY_A2}', '${TENANT_A}', 'order126_a2', 'property', 'Order 126 A2', 'UTC', 'USD');
    INSERT INTO public.space
      (id, tenant_id, property_node, code, profile_key, capacity, status) VALUES
      ('${SPACE_A}', '${TENANT_A}', '${PROPERTY_A}', '126-A', 'room', 1, 'active'),
      ('${SPACE_B}', '${TENANT_B}', '${PROPERTY_B}', '126-B', 'room', 1, 'active'),
      ('${SPACE_DORM}', '${TENANT_A}', '${PROPERTY_A}', '126-DORM', 'dorm', 6, 'active'),
      ('${SPACE_INACTIVE}', '${TENANT_A}', '${PROPERTY_A}', '126-OFF', 'room', 1, 'inactive'),
      ('${SPACE_WRONG_PROPERTY}', '${TENANT_A}', '${PROPERTY_A2}', '126-A2', 'room', 1, 'active');
    INSERT INTO public.unit_type
      (id, tenant_id, property_node, code, name, profile_key) VALUES
      ('${UNIT_TYPE_A}', '${TENANT_A}', '${PROPERTY_A}', '126-A', 'Order 126 A', 'room'),
      ('${UNIT_TYPE_B}', '${TENANT_B}', '${PROPERTY_B}', '126-B', 'Order 126 B', 'room'),
      ('${UNIT_TYPE_DORM}', '${TENANT_A}', '${PROPERTY_A}', '126-D', 'Order 126 Dorm', 'dorm');
    INSERT INTO public.sellable_unit (id, tenant_id, unit_type_id, name) VALUES
      ('${SELLABLE_A}', '${TENANT_A}', '${UNIT_TYPE_A}', 'Order 126 A'),
      ('${SELLABLE_B}', '${TENANT_B}', '${UNIT_TYPE_B}', 'Order 126 B'),
      ('${SELLABLE_DORM_EXCLUSIVE}', '${TENANT_A}', '${UNIT_TYPE_DORM}', 'Order 126 Dorm Private'),
      ('${SELLABLE_DORM_POSITIONAL}', '${TENANT_A}', '${UNIT_TYPE_DORM}', 'Order 126 Dorm Bed'),
      ('${SELLABLE_INACTIVE}', '${TENANT_A}', '${UNIT_TYPE_A}', 'Order 126 Inactive'),
      ('${SELLABLE_WRONG_PROPERTY}', '${TENANT_A}', '${UNIT_TYPE_A}', 'Order 126 Wrong Property');
    INSERT INTO public.sellable_unit_space
      (tenant_id, sellable_unit_id, space_id, claim_mode) VALUES
      ('${TENANT_A}', '${SELLABLE_A}', '${SPACE_A}', 'exclusive'),
      ('${TENANT_B}', '${SELLABLE_B}', '${SPACE_B}', 'exclusive'),
      ('${TENANT_A}', '${SELLABLE_DORM_EXCLUSIVE}', '${SPACE_DORM}', 'exclusive'),
      ('${TENANT_A}', '${SELLABLE_DORM_POSITIONAL}', '${SPACE_DORM}', 'positional'),
      ('${TENANT_A}', '${SELLABLE_INACTIVE}', '${SPACE_INACTIVE}', 'exclusive'),
      ('${TENANT_A}', '${SELLABLE_WRONG_PROPERTY}', '${SPACE_WRONG_PROPERTY}', 'exclusive');
    INSERT INTO public.hold
      (id, tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at, status) VALUES
      ('${FOREIGN_SLOT_A}', '${TENANT_A}', '${PROPERTY_A}', '${SELLABLE_A}', '${HOSTILE_PERIOD}',
       'cart', '{}', '2026-09-05 00:00:00+00', 'active'),
      ('${VICTIM_SLOT_B}', '${TENANT_B}', '${PROPERTY_B}', '${SELLABLE_B}', '${VICTIM_PERIOD}',
       'cart', '{}', '2026-09-05 00:00:00+00', 'active'),
      ('${STALE_SLOT_A}', '${TENANT_A}', '${PROPERTY_A}', '${SELLABLE_A}', '${HOSTILE_PERIOD}',
       'cart', '{}', '2027-01-01 00:00:00+00', 'released'),
      ('${INACTIVE_SLOT_A}', '${TENANT_A}', '${PROPERTY_A}', '${SELLABLE_INACTIVE}', '${HOSTILE_PERIOD}',
       'cart', '{}', '2027-01-01 00:00:00+00', 'active'),
      ('${WRONG_PROPERTY_SLOT_A}', '${TENANT_A}', '${PROPERTY_A}', '${SELLABLE_WRONG_PROPERTY}', '${HOSTILE_PERIOD}',
       'cart', '{}', '2027-01-01 00:00:00+00', 'active');
    INSERT INTO public.party (id, tenant_id, kind, display_name)
    VALUES ('${PARTY_A}', '${TENANT_A}', 'person', 'Order 126 typed parent');
    INSERT INTO public.rate_plan (id, tenant_id, property_node, code, name, currency)
    VALUES ('${RATE_A}', '${TENANT_A}', '${PROPERTY_A}', 'O126', 'Order 126', 'USD');
    INSERT INTO public.reservation
      (id, tenant_id, property_node, confirmation_no, primary_party, currency)
    VALUES ('${RESERVATION_A}', '${TENANT_A}', '${PROPERTY_A}', 'O126', '${PARTY_A}', 'USD');
    INSERT INTO public.reservation_segment
      (id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period, rate_plan_id, status)
    VALUES
      ('${SEGMENT_A}', '${TENANT_A}', '${RESERVATION_A}', 1, '${UNIT_TYPE_A}', '${SELLABLE_A}',
       '${SEGMENT_PERIOD}', '${RATE_A}', 'booked'),
      ('${CANCELLED_SEGMENT_A}', '${TENANT_A}', '${RESERVATION_A}', 2, '${UNIT_TYPE_A}', '${SELLABLE_A}',
       '${CANCELLED_SEGMENT_PERIOD}', '${RATE_A}', 'cancelled');
    INSERT INTO public.ooo_oos (id, tenant_id, space_id, kind, period, reason)
    VALUES ('${OOO_A}', '${TENANT_A}', '${SPACE_A}', 'ooo', '${OOO_PERIOD}', 'Order 126 typed parent');
    SELECT public.record_occupancy(
      '${TENANT_B}', '${SPACE_B}', '${VICTIM_PERIOD}', '${VICTIM_SLOT_B}', 'hold', true
    );
  `);

  for (const slot of EXCLUSIVE_RACE_SLOTS) {
    await admin`
      INSERT INTO public.hold
        (id, tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at, status)
      VALUES (${slot}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
              ${SELLABLE_DORM_EXCLUSIVE}::uuid, ${EXCLUSIVE_RACE_PERIOD}::tstzrange,
              'cart', '{}'::jsonb, '2027-01-01T00:00:00Z'::timestamptz, 'active')
    `;
  }
  for (const slot of POSITIONAL_RACE_SLOTS) {
    await admin`
      INSERT INTO public.hold
        (id, tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at, status)
      VALUES (${slot}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
              ${SELLABLE_DORM_POSITIONAL}::uuid, ${POSITIONAL_RACE_PERIOD}::tstzrange,
              'cart', '{}'::jsonb, '2027-01-01T00:00:00Z'::timestamptz, 'active')
    `;
  }
  await admin`
    INSERT INTO public.hold
      (id, tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at, status)
    VALUES
      (${MODE_EXCLUSIVE_SLOT}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
       ${SELLABLE_DORM_EXCLUSIVE}::uuid, ${MODE_CONFLICT_PERIOD}::tstzrange,
       'cart', '{}'::jsonb, '2027-01-01T00:00:00Z'::timestamptz, 'active'),
      (${MODE_POSITIONAL_SLOT}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
       ${SELLABLE_DORM_POSITIONAL}::uuid, ${MODE_CONFLICT_PERIOD}::tstzrange,
       'cart', '{}'::jsonb, '2027-01-01T00:00:00Z'::timestamptz, 'active')
  `;
});

afterAll(async () => {
  if (admin) {
    await cleanupClaims().catch(() => undefined);
    await admin.unsafe(`
      DELETE FROM public.reservation_segment WHERE id IN ('${SEGMENT_A}', '${CANCELLED_SEGMENT_A}');
      DELETE FROM public.reservation WHERE id = '${RESERVATION_A}';
      DELETE FROM public.rate_plan WHERE id = '${RATE_A}';
      DELETE FROM public.party WHERE id = '${PARTY_A}';
      DELETE FROM public.ooo_oos WHERE id = '${OOO_A}';
      DELETE FROM public.hold WHERE tenant_id IN ('${TENANT_A}', '${TENANT_B}');
      DELETE FROM public.sellable_unit_space
       WHERE sellable_unit_id IN (
         '${SELLABLE_A}', '${SELLABLE_B}', '${SELLABLE_DORM_EXCLUSIVE}',
         '${SELLABLE_DORM_POSITIONAL}', '${SELLABLE_INACTIVE}', '${SELLABLE_WRONG_PROPERTY}'
       );
      DELETE FROM public.sellable_unit WHERE id IN (
        '${SELLABLE_A}', '${SELLABLE_B}', '${SELLABLE_DORM_EXCLUSIVE}',
        '${SELLABLE_DORM_POSITIONAL}', '${SELLABLE_INACTIVE}', '${SELLABLE_WRONG_PROPERTY}'
      );
      DELETE FROM public.unit_type WHERE id IN ('${UNIT_TYPE_A}', '${UNIT_TYPE_B}', '${UNIT_TYPE_DORM}');
      DELETE FROM public.space WHERE id IN (
        '${SPACE_A}', '${SPACE_B}', '${SPACE_DORM}', '${SPACE_INACTIVE}', '${SPACE_WRONG_PROPERTY}'
      );
      DELETE FROM public.org_node WHERE id IN ('${PROPERTY_A}', '${PROPERTY_B}', '${PROPERTY_A2}');
      DELETE FROM public.tenant WHERE id IN ('${TENANT_A}', '${TENANT_B}');
    `).catch(() => undefined);
  }
  await database?.close();
  await admin?.close();
});

databaseDescribe("Order 126 occupancy caller tenant binding", () => {
  test("P0: app_role tenant A cannot record or release tenant B occupancy", async () => {
    const before = await counts();
    const recordState = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.record_occupancy(
        ${TENANT_B}::uuid, ${SPACE_B}::uuid, ${HOSTILE_PERIOD}::tstzrange,
        ${FOREIGN_SLOT_A}::uuid, 'hold', true
      )
    `));
    const afterRecord = await counts();
    const releaseState = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.release_occupancy(${TENANT_B}::uuid, ${VICTIM_SLOT_B}::uuid)
    `));
    const afterRelease = await counts();

    const directDmlState = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      DELETE FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_B}::uuid AND slot_ref = ${VICTIM_SLOT_B}::uuid
    `));
    const controls = await admin!<Array<{
      appCanRecord: boolean;
      appCanRelease: boolean;
      appCanLogin: boolean;
      publicCanRecord: boolean;
      publicCanRelease: boolean;
      recordPath: string;
      releasePath: string;
    }>>`
      SELECT
        has_function_privilege(
          'app_role', 'public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)', 'EXECUTE'
        ) AS "appCanRecord",
        has_function_privilege(
          'app_role', 'public.release_occupancy(uuid,uuid)', 'EXECUTE'
        ) AS "appCanRelease",
        (SELECT rolcanlogin FROM pg_catalog.pg_roles WHERE rolname = 'app_role') AS "appCanLogin",
        has_function_privilege(
          'public', 'public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)', 'EXECUTE'
        ) AS "publicCanRecord",
        has_function_privilege(
          'public', 'public.release_occupancy(uuid,uuid)', 'EXECUTE'
        ) AS "publicCanRelease",
        (SELECT array_to_string(proconfig, ',') FROM pg_catalog.pg_proc
          WHERE oid = 'public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)'::regprocedure
        ) AS "recordPath",
        (SELECT array_to_string(proconfig, ',') FROM pg_catalog.pg_proc
          WHERE oid = 'public.release_occupancy(uuid,uuid)'::regprocedure
        ) AS "releasePath"
    `;

    expect({
      before,
      recordState,
      afterRecord,
      releaseState,
      afterRelease,
      directDmlState,
      controls: controls[0],
    }).toEqual({
      before: { hostile: 0, victim: 1 },
      recordState: "42501",
      afterRecord: { hostile: 0, victim: 1 },
      releaseState: "42501",
      afterRelease: { hostile: 0, victim: 1 },
      directDmlState: "42501",
      controls: {
        appCanRecord: true,
        appCanRelease: true,
        appCanLogin: false,
        publicCanRecord: false,
        publicCanRelease: false,
        recordPath: "search_path=pg_catalog, public, pg_temp",
        releasePath: "search_path=pg_catalog, public, pg_temp",
      },
    });
  });

  test("P1: record rejects missing/mismatched authority and every invalid typed parent before mutation", async () => {
    const before = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM public.space_occupancy WHERE tenant_id = ${TENANT_A}::uuid
    `;
    const missingContext = await asAppWithoutTenant((connection) => connection`
      SELECT public.record_occupancy(
        ${TENANT_A}::uuid, ${SPACE_A}::uuid, ${HOSTILE_PERIOD}::tstzrange,
        ${FOREIGN_SLOT_A}::uuid, 'hold', true
      )
    `);
    const mismatch = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.record_occupancy(
        ${TENANT_B}::uuid, ${SPACE_B}::uuid, ${VICTIM_PERIOD}::tstzrange,
        ${VICTIM_SLOT_B}::uuid, 'hold', true
      )
    `));
    const invalidParents = await Promise.all([
      attemptClaim({ slot: INACTIVE_SLOT_A, space: SPACE_INACTIVE, period: HOSTILE_PERIOD, exclusive: true }),
      attemptClaim({ slot: WRONG_PROPERTY_SLOT_A, space: SPACE_WRONG_PROPERTY, period: HOSTILE_PERIOD, exclusive: true }),
      attemptClaim({ slot: fixtureUuid(126999), space: SPACE_A, period: HOSTILE_PERIOD, exclusive: true }),
      attemptClaim({ slot: STALE_SLOT_A, space: SPACE_A, period: HOSTILE_PERIOD, exclusive: true }),
    ]);
    const wrongPairings = await Promise.all([
      attemptClaim({ slot: FOREIGN_SLOT_A, space: SPACE_A, period: HOSTILE_PERIOD, kind: "segment", exclusive: true }),
      attemptClaim({ slot: FOREIGN_SLOT_A, space: SPACE_A, period: HOSTILE_PERIOD, kind: "ooo", exclusive: true }),
      attemptClaim({ slot: SEGMENT_A, space: SPACE_A, period: SEGMENT_PERIOD, kind: "hold", exclusive: true }),
      attemptClaim({ slot: SEGMENT_A, space: SPACE_A, period: SEGMENT_PERIOD, kind: "ooo", exclusive: true }),
      attemptClaim({ slot: OOO_A, space: SPACE_A, period: OOO_PERIOD, kind: "hold", exclusive: true }),
      attemptClaim({ slot: OOO_A, space: SPACE_A, period: OOO_PERIOD, kind: "segment", exclusive: true }),
    ]);
    const emptyPeriod = await attemptClaim({
      slot: FOREIGN_SLOT_A, space: SPACE_A, period: "empty", exclusive: true,
    });
    const unboundedPeriod = await attemptClaim({
      slot: FOREIGN_SLOT_A, space: SPACE_A,
      period: "[2026-09-01 00:00:00+00,)", exclusive: true,
    });
    const after = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM public.space_occupancy WHERE tenant_id = ${TENANT_A}::uuid
    `;

    expect({
      missingContext,
      mismatch,
      invalidParents: invalidParents.map(({ state }) => state),
      wrongPairings: wrongPairings.map(({ state }) => state),
      emptyPeriod: emptyPeriod.state,
      unboundedPeriod: unboundedPeriod.state,
      before,
      after,
    }).toEqual({
      missingContext: "42501",
      mismatch: "42501",
      invalidParents: ["P0003", "P0003", "P0003", "P0003"],
      wrongPairings: ["P0003", "P0003", "P0003", "P0003", "P0003", "P0003"],
      emptyPeriod: "22023",
      unboundedPeriod: "22023",
      before: [{ count: 0 }],
      after: [{ count: 0 }],
    });
  });

  test("P1: an exact same-tenant cancelled segment is stale and cannot create occupancy", async () => {
    let observed: {
      readonly state?: string;
      readonly before: number;
      readonly after: number;
      readonly parentStatus: string;
    } | undefined;
    try {
      const before = await admin!<Array<{ count: number }>>`
        SELECT count(*)::int AS count
          FROM public.space_occupancy
         WHERE tenant_id = ${TENANT_A}::uuid
           AND slot_ref = ${CANCELLED_SEGMENT_A}::uuid
      `;
      const attempt = await attemptClaim({
        slot: CANCELLED_SEGMENT_A,
        space: SPACE_A,
        period: CANCELLED_SEGMENT_PERIOD,
        kind: "segment",
        exclusive: true,
      });
      const after = await admin!<Array<{ count: number }>>`
        SELECT count(*)::int AS count
          FROM public.space_occupancy
         WHERE tenant_id = ${TENANT_A}::uuid
           AND slot_ref = ${CANCELLED_SEGMENT_A}::uuid
      `;
      const parent = await admin!<Array<{ status: string }>>`
        SELECT status
          FROM public.reservation_segment
         WHERE tenant_id = ${TENANT_A}::uuid
           AND id = ${CANCELLED_SEGMENT_A}::uuid
      `;
      observed = {
        state: attempt.state,
        before: before[0]!.count,
        after: after[0]!.count,
        parentStatus: parent[0]!.status,
      };
    } finally {
      await admin!`
        DELETE FROM public.space_occupancy
         WHERE tenant_id = ${TENANT_A}::uuid
           AND slot_ref = ${CANCELLED_SEGMENT_A}::uuid
      `;
    }

    expect(observed).toEqual({
      state: "P0003",
      before: 0,
      after: 0,
      parentStatus: "cancelled",
    });
  });

  test("P1/P2: release validates authority, typed parent and live transition before exact deletion", async () => {
    const recorded = await attemptClaim({
      slot: FOREIGN_SLOT_A, space: SPACE_A, period: HOSTILE_PERIOD, exclusive: true,
    });
    expect(recorded).toEqual({ id: expect.any(String) });

    const missingContext = await asAppWithoutTenant((connection) => connection`
      SELECT public.release_occupancy(${TENANT_A}::uuid, ${FOREIGN_SLOT_A}::uuid)
    `);
    const mismatch = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.release_occupancy(${TENANT_B}::uuid, ${FOREIGN_SLOT_A}::uuid)
    `));
    const unknown = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.release_occupancy(${TENANT_A}::uuid, ${fixtureUuid(126998)}::uuid)
    `));

    await admin!`UPDATE public.hold SET status = 'released' WHERE id = ${FOREIGN_SLOT_A}::uuid`;
    const stale = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.release_occupancy(${TENANT_A}::uuid, ${FOREIGN_SLOT_A}::uuid)
    `));
    await admin!`DELETE FROM public.hold WHERE id = ${FOREIGN_SLOT_A}::uuid`;
    await admin!`
      INSERT INTO public.ooo_oos (id, tenant_id, space_id, kind, period, reason)
      VALUES (${FOREIGN_SLOT_A}::uuid, ${TENANT_A}::uuid, ${SPACE_A}::uuid, 'ooo',
              ${HOSTILE_PERIOD}::tstzrange, 'Order 126 wrong-kind release fixture')
    `;
    const wrongKind = await captureState(() => database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.release_occupancy(${TENANT_A}::uuid, ${FOREIGN_SLOT_A}::uuid)
    `));
    await admin!`DELETE FROM public.ooo_oos WHERE id = ${FOREIGN_SLOT_A}::uuid`;
    await admin!`
      INSERT INTO public.hold
        (id, tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at, status)
      VALUES (${FOREIGN_SLOT_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
              ${SELLABLE_A}::uuid, ${HOSTILE_PERIOD}::tstzrange, 'cart', '{}'::jsonb,
              '2027-01-01T00:00:00Z'::timestamptz, 'active')
    `;
    const beforeRelease = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_A}::uuid AND slot_ref = ${FOREIGN_SLOT_A}::uuid
    `;
    const released = await database!.withTenantTransaction(TENANT_A, (tx) => tx<Array<{ count: number }>>`
      SELECT public.release_occupancy(${TENANT_A}::uuid, ${FOREIGN_SLOT_A}::uuid) AS count
    `);
    const afterRelease = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_A}::uuid AND slot_ref = ${FOREIGN_SLOT_A}::uuid
    `;

    expect({ missingContext, mismatch, unknown, stale, wrongKind, beforeRelease, released, afterRelease }).toEqual({
      missingContext: "42501",
      mismatch: "42501",
      unknown: "P0003",
      stale: "P0003",
      wrongKind: "P0003",
      beforeRelease: [{ count: 1 }],
      released: [{ count: 1 }],
      afterRelease: [{ count: 0 }],
    });
  });

  test("P2: exclusive and positional typed claims remain mutually exclusive", async () => {
    const positional = await attemptClaim({
      slot: MODE_POSITIONAL_SLOT, space: SPACE_DORM, period: MODE_CONFLICT_PERIOD, exclusive: false,
    });
    const exclusive = await attemptClaim({
      slot: MODE_EXCLUSIVE_SLOT, space: SPACE_DORM, period: MODE_CONFLICT_PERIOD, exclusive: true,
    });
    const truth = await admin!<Array<{ exclusive: boolean; count: number }>>`
      SELECT exclusive, count(*)::int AS count
        FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_A}::uuid AND space_id = ${SPACE_DORM}::uuid
         AND period = ${MODE_CONFLICT_PERIOD}::tstzrange
       GROUP BY exclusive ORDER BY exclusive
    `;
    expect({ positional, exclusive, truth }).toEqual({
      positional: { id: expect.any(String) },
      exclusive: { state: "23P01" },
      truth: [{ exclusive: false, count: 1 }],
    });
    await database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.release_occupancy(${TENANT_A}::uuid, ${MODE_POSITIONAL_SLOT}::uuid)
    `);
  });

  test("P2: real 50-client exclusive race has exactly one authoritative winner", async () => {
    const results = await Promise.all(EXCLUSIVE_RACE_SLOTS.map((slot) => attemptClaim({
      slot, space: SPACE_DORM, period: EXCLUSIVE_RACE_PERIOD, exclusive: true,
    })));
    const wins = results.filter(({ id }) => id !== undefined);
    const rejects = results.filter(({ state }) => state === "23P01");
    const truth = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_A}::uuid AND space_id = ${SPACE_DORM}::uuid
         AND period = ${EXCLUSIVE_RACE_PERIOD}::tstzrange
    `;
    expect({ wins: wins.length, rejects: rejects.length, truth }).toEqual({
      wins: 1, rejects: 49, truth: [{ count: 1 }],
    });
    const winner = await admin!<Array<{ slot: string }>>`
      SELECT slot_ref::text AS slot FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_A}::uuid AND period = ${EXCLUSIVE_RACE_PERIOD}::tstzrange
    `;
    await database!.withTenantTransaction(TENANT_A, (tx) => tx`
      SELECT public.release_occupancy(${TENANT_A}::uuid, ${winner[0]!.slot}::uuid)
    `);
  }, 30_000);

  test("P2: real 40-client positional race exhausts exact six-bed capacity", async () => {
    const results = await Promise.all(POSITIONAL_RACE_SLOTS.map((slot) => attemptClaim({
      slot, space: SPACE_DORM, period: POSITIONAL_RACE_PERIOD, exclusive: false,
    })));
    const wins = results.filter(({ id }) => id !== undefined);
    const rejects = results.filter(({ state }) => state === "P0002");
    const truth = await admin!<Array<{ count: number; positions: number[] }>>`
      SELECT count(*)::int AS count,
             pg_catalog.array_agg(lower(claim) ORDER BY lower(claim)) AS positions
        FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_A}::uuid AND space_id = ${SPACE_DORM}::uuid
         AND period = ${POSITIONAL_RACE_PERIOD}::tstzrange
    `;
    const normalizedTruth = truth.map(({ count, positions }) => ({ count, positions: Array.from(positions) }));
    expect({ wins: wins.length, rejects: rejects.length, truth: normalizedTruth }).toEqual({
      wins: 6, rejects: 34, truth: [{ count: 6, positions: [0, 1, 2, 3, 4, 5] }],
    });
    const winners = await admin!<Array<{ slot: string }>>`
      SELECT slot_ref::text AS slot FROM public.space_occupancy
       WHERE tenant_id = ${TENANT_A}::uuid AND period = ${POSITIONAL_RACE_PERIOD}::tstzrange
    `;
    for (const winner of winners) {
      await database!.withTenantTransaction(TENANT_A, (tx) => tx`
        SELECT public.release_occupancy(${TENANT_A}::uuid, ${winner.slot}::uuid)
      `);
    }
  }, 30_000);
});
