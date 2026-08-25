import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const DATABASE_URL = process.env.YELLOW_REFEREE_TYPED_PARENT_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_REFEREE_TYPED_PARENT === "1";
const P0_SHA = "52e295544dc67af172e1050cc8ea56f5cf6e7889";
const OLD_REFEREE_SHA256 = "3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1";
const BASELINE_SHA256 = "fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923";
const T_A = "00000000-0000-0000-0000-000000000001";
const T_B = "00000000-0000-0000-0000-000000000002";
const PROPERTY = "00000000-0000-0000-0000-000000000012";
const WRONG_PROPERTY = "00000000-0000-0000-0000-000000000010";
const PARTY = "00000000-0000-0000-0000-00000000d0cf";
const RATE_PLAN = "00000000-0000-0000-0000-000000000600";
const ROOM = "00000000-0000-0000-0000-000000000200";
const ROOM_UNIT_TYPE = "00000000-0000-0000-0000-000000000300";
const ROOM_SELLABLE = "00000000-0000-0000-0000-000000000400";
const DORM = "00000000-0000-0000-0000-00000000d0c1";
const DORM_UNIT_TYPE = "00000000-0000-0000-0000-00000000d0c0";
const DORM_POSITIONAL = "00000000-0000-0000-0000-00000000d0c2";
const PERIOD = "[2026-09-20 10:00:00+00,2026-09-22 08:00:00+00)";
const LOSER_PERIOD = "[2037-01-01 10:00:00+00,2037-01-03 08:00:00+00)";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_REFEREE_TYPED_PARENT_URL is required by the Order 130 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;

function fixedId(value: number): string {
  return `00000000-0000-0000-0000-${value.toString().padStart(12, "0")}`;
}

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { errno?: unknown; code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  if (typeof candidate.code === "string") return candidate.code;
  return undefined;
}

async function gitBlob(ref: string, path: string): Promise<string> {
  const child = Bun.spawn(["git", "show", `${ref}:${path}`], {
    cwd: process.cwd(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) throw new Error(`git show ${ref}:${path} failed: ${stderr.trim()}`);
  return stdout.replaceAll("\r\n", "\n");
}

function maskSpan(source: string, start: string, end: string, label: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`protected referee marker missing: ${start} .. ${end}`);
  return `${source.slice(0, from)}<ORDER130:${label}>\n${source.slice(to)}`;
}

function maskAllowedRefereeRegions(input: string): string {
  let source = input.replaceAll("\r\n", "\n");
  const periodLine = 'PERIOD = "[2026-09-20 14:00+04,2026-09-22 12:00+04)"\n';
  const constantsAt = source.indexOf(periodLine);
  const resultsAt = source.indexOf("results = []", constantsAt);
  if (constantsAt < 0 || resultsAt < 0) throw new Error("protected referee constants markers missing");
  const constantsEnd = constantsAt + periodLine.length;
  source = `${source.slice(0, constantsEnd)}<ORDER130:constants>\n${source.slice(resultsAt)}`;
  source = maskSpan(source, "def record(", "# R1 / TC-12.1", "record");
  source = maskSpan(source, "# R3 / TC-12.3", "caps = []", "tc12.3-cleanup");
  source = maskSpan(source, "def burst(", "t0 = time.perf_counter()", "burst");
  return source;
}

function assertRaceContract(source: string): void {
  const required = [
    "range(50)",
    "sum(wins) == 1",
    "range(6)",
    "range(40)",
    "sum(caps) == 6",
    "range(8)",
    "target=burst, args=(50, outs)",
    'e.pgcode == "42501"',
    "done > 0",
    "if dt <= 0:",
  ];
  for (const literal of required) {
    if (!source.includes(literal)) throw new Error(`protected race contract missing: ${literal}`);
  }
  const tc12 = new Set((source.match(/check\("(TC-12\.[1-5])"/g) ?? [])
    .map((match) => match.slice(7, -1)));
  if (tc12.size !== 5) {
    throw new Error("protected referee must retain all five TC-12 checks");
  }
}

async function sha256(path: string): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

async function artifactCounts(reservationId: string, segmentId: string) {
  const rows = await admin!<Array<{
    reservations: number;
    segments: number;
    guests: number;
    occupancies: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM reservation WHERE id=${reservationId}::uuid) AS reservations,
      (SELECT count(*)::int FROM reservation_segment WHERE id=${segmentId}::uuid) AS segments,
      (SELECT count(*)::int FROM reservation_guest WHERE reservation_id=${reservationId}::uuid) AS guests,
      (SELECT count(*)::int FROM space_occupancy WHERE slot_ref=${segmentId}::uuid) AS occupancies
  `;
  return rows[0]!;
}

type InvalidParent = Readonly<{
  label: string;
  reservation?: boolean;
  segment?: boolean;
  recordTenant?: string;
  reservationTenant?: string;
  segmentTenant?: string;
  property?: string;
  unitType?: string;
  sellable?: string;
  segmentPeriod?: string;
  claimPeriod?: string;
}>;

async function rejectInvalidParent(input: InvalidParent, sequence: number): Promise<void> {
  const reservationId = fixedId(130_100 + sequence * 2);
  const segmentId = fixedId(130_101 + sequence * 2);
  const reservationTenant = input.reservationTenant ?? T_A;
  const segmentTenant = input.segmentTenant ?? T_A;
  let error: unknown;
  try {
    await admin!.begin(async (tx) => {
      if (input.reservation !== false) {
        await tx.unsafe(`
          INSERT INTO reservation
            (id,tenant_id,property_node,confirmation_no,status,primary_party,currency)
          VALUES ('${reservationId}','${reservationTenant}','${input.property ?? PROPERTY}',
            'O130-INVALID-${sequence}','reserved','${PARTY}','AED')
        `);
      }
      if (input.segment !== false) {
        await tx.unsafe(`
          INSERT INTO reservation_segment
            (id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
          VALUES ('${segmentId}','${segmentTenant}','${reservationId}',1,
            '${input.unitType ?? ROOM_UNIT_TYPE}','${input.sellable ?? ROOM_SELLABLE}',
            '${input.segmentPeriod ?? LOSER_PERIOD}'::tstzrange,'${RATE_PLAN}','booked')
        `);
      }
      await tx.unsafe(`
        SELECT record_occupancy('${input.recordTenant ?? T_A}','${ROOM}',
          '${input.claimPeriod ?? LOSER_PERIOD}'::tstzrange,'${segmentId}','segment',true)
      `);
    });
  } catch (caught) {
    error = caught;
  }
  expect(error, input.label).toBeDefined();
  expect(sqlState(error), input.label).toBe("P0003");
  expect((error as Error).message, input.label).toContain("occupancy typed parent is invalid or stale");
  expect(await artifactCounts(reservationId, segmentId), input.label).toEqual({
    reservations: 0,
    segments: 0,
    guests: 0,
    occupancies: 0,
  });
}

async function commitParentChain(reservationId: string, segmentId: string): Promise<void> {
  await admin!.begin(async (tx) => {
    await tx.unsafe(`
      INSERT INTO reservation
        (id,tenant_id,property_node,confirmation_no,status,primary_party,currency)
      VALUES ('${reservationId}','${T_A}','${PROPERTY}','O130-${reservationId}',
        'reserved','${PARTY}','AED')
    `);
    await tx.unsafe(`
      INSERT INTO reservation_segment
        (id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
      VALUES ('${segmentId}','${T_A}','${reservationId}',1,'${ROOM_UNIT_TYPE}',
        '${ROOM_SELLABLE}','${LOSER_PERIOD}'::tstzrange,'${RATE_PLAN}','booked')
    `);
    await tx.unsafe(`
      SELECT record_occupancy('${T_A}','${ROOM}','${LOSER_PERIOD}'::tstzrange,
        '${segmentId}','segment',true)
    `);
    await tx.unsafe(`
      INSERT INTO reservation_guest (tenant_id,reservation_id,party_id,role)
      VALUES ('${T_A}','${reservationId}','${PARTY}','primary')
    `);
  });
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 12 });
  const fixture = await admin<Array<{ guests: number; mappings: number; wrong_property: number }>>`
    SELECT
      (SELECT count(*)::int FROM party WHERE id=${PARTY}::uuid AND tenant_id=${T_A}::uuid) AS guests,
      (SELECT count(*)::int FROM sellable_unit_space
        WHERE tenant_id=${T_A}::uuid AND space_id=${DORM}::uuid
          AND claim_mode IN ('exclusive','positional')) AS mappings,
      (SELECT count(*)::int FROM unit_type
        WHERE id=${DORM_UNIT_TYPE}::uuid AND property_node<>${PROPERTY}::uuid) AS wrong_property
  `;
  expect(fixture[0]).toEqual({ guests: 1, mappings: 2, wrong_property: 0 });

  await admin.unsafe(`
    CREATE TABLE order130_parent_observation (
      segment_id uuid PRIMARY KEY,
      reservation_id uuid NOT NULL,
      observed_tenant uuid NOT NULL,
      property_node uuid NOT NULL,
      space_id uuid NOT NULL,
      sellable_unit_id uuid NOT NULL,
      unit_type_id uuid NOT NULL,
      period tstzrange NOT NULL,
      exclusive boolean NOT NULL,
      cleaned boolean NOT NULL DEFAULT false
    )
  `);
  await admin.unsafe(`
    CREATE FUNCTION order130_require_segment_parent() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE v_parent_valid boolean;
    BEGIN
      IF NEW.slot_kind = 'segment' THEN
        SELECT true INTO v_parent_valid
          FROM reservation_segment rs
          JOIN reservation r ON r.id=rs.reservation_id AND r.tenant_id=rs.tenant_id
          JOIN sellable_unit su ON su.id=rs.sellable_unit_id AND su.tenant_id=rs.tenant_id
                               AND su.unit_type_id=rs.unit_type_id AND su.status='active'
          JOIN unit_type ut ON ut.id=rs.unit_type_id AND ut.tenant_id=rs.tenant_id
                           AND ut.property_node=r.property_node
          JOIN sellable_unit_space sus ON sus.sellable_unit_id=su.id
                                      AND sus.tenant_id=su.tenant_id
                                      AND sus.space_id=NEW.space_id
                                      AND sus.claim_mode=CASE WHEN NEW.exclusive
                                          THEN 'exclusive' ELSE 'positional' END
          JOIN space s ON s.id=sus.space_id AND s.tenant_id=sus.tenant_id
                      AND s.property_node=r.property_node AND s.status='active'
         WHERE rs.id=NEW.slot_ref AND rs.tenant_id=NEW.tenant_id
           AND rs.status IN ('booked','in_house','cancelled') AND rs.period=NEW.period;
        IF v_parent_valid IS DISTINCT FROM true THEN
          RAISE EXCEPTION 'occupancy typed parent is invalid or stale' USING ERRCODE='P0003';
        END IF;
        INSERT INTO order130_parent_observation
          (segment_id,reservation_id,observed_tenant,property_node,space_id,
           sellable_unit_id,unit_type_id,period,exclusive)
        SELECT rs.id,rs.reservation_id,rs.tenant_id,r.property_node,NEW.space_id,
               rs.sellable_unit_id,rs.unit_type_id,rs.period,NEW.exclusive
          FROM reservation_segment rs JOIN reservation r ON r.id=rs.reservation_id
         WHERE rs.id=NEW.slot_ref;
      END IF;
      RETURN NEW;
    END
    $$
  `);
  await admin.unsafe(`
    CREATE FUNCTION order130_observe_cleanup() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.slot_kind='segment' THEN
        UPDATE order130_parent_observation SET cleaned=true WHERE segment_id=OLD.slot_ref;
      END IF;
      RETURN OLD;
    END
    $$
  `);
  await admin.unsafe(`
    CREATE TRIGGER order130_require_segment_parent BEFORE INSERT ON space_occupancy
    FOR EACH ROW EXECUTE FUNCTION order130_require_segment_parent()
  `);
  await admin.unsafe(`
    CREATE TRIGGER order130_observe_cleanup AFTER DELETE ON space_occupancy
    FOR EACH ROW EXECUTE FUNCTION order130_observe_cleanup()
  `);
});

afterAll(async () => {
  if (admin) {
    await admin.unsafe("DROP TRIGGER IF EXISTS order130_require_segment_parent ON space_occupancy");
    await admin.unsafe("DROP TRIGGER IF EXISTS order130_observe_cleanup ON space_occupancy");
    await admin.unsafe("DROP FUNCTION IF EXISTS order130_require_segment_parent()");
    await admin.unsafe("DROP FUNCTION IF EXISTS order130_observe_cleanup()");
    await admin.unsafe("DROP TABLE IF EXISTS order130_parent_observation");
    await admin.close();
  }
}, 30_000);

describe("Order 130 protected referee provenance", () => {
  test("P3: only preregistered referee regions differ from the exact P0 parent", async () => {
    expect(await sha256("migrations/0001_init.sql")).toBe(BASELINE_SHA256);
    const oldSource = await gitBlob(P0_SHA, "tests/run_invariants.py");
    expect(new Bun.CryptoHasher("sha256").update(oldSource).digest("hex")).toBe(OLD_REFEREE_SHA256);
    const currentSource = (await Bun.file("tests/run_invariants.py").text()).replaceAll("\r\n", "\n");
    expect(maskAllowedRefereeRegions(currentSource)).toBe(maskAllowedRefereeRegions(oldSource));
    assertRaceContract(currentSource);

    const weakened = currentSource.replace("sum(wins) == 1", "sum(wins) >= 0");
    expect(() => assertRaceContract(weakened)).toThrow("sum(wins) == 1");
  });
});

databaseDescribe("Order 130 authoritative referee parents", () => {
  test("P1: guarded protected referee passes 11/11 with exact committed parent chains", async () => {
    await admin!.close();
    admin = undefined;
    const child = Bun.spawn(["python", "tests/run_invariants.py", "order130"], {
      cwd: process.cwd(),
      env: { ...process.env, YELLOW_DSN: DATABASE_URL!, PYTHONIOENCODING: "utf-8" },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    admin = new SQL(DATABASE_URL!, { max: 12 });
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
    expect(stdout).toContain("RESULT: 11 passed, 0 failed of 11");
    expect(stdout).toContain("TC-12.1  50-thread exclusive race → exactly 1 winner  winners=1");
    expect(stdout).toContain("TC-12.3  40 threads for 6 beds → exactly 6  claims=6");
    expect(stdout).toContain("TC-12.4  direct INSERT blocked (42501)  code=42501");
    const throughput = stdout.match(/TC-12\.5\s+concurrent commit throughput\s+(\d+) commits in ([0-9.]+)s/);
    expect(throughput).not.toBeNull();
    const throughputCommits = Number(throughput![1]);
    const elapsed = Number(throughput![2]);
    expect(throughputCommits).toBeGreaterThan(0);
    expect(elapsed).toBeGreaterThan(0);

    const proof = (await admin!<Array<{
      room: number;
      cleaned_mix: number;
      mix_exclusive: number;
      mix_positional: number;
      capacity: number;
      throughput: number;
      active_observations: number;
      exact_active_chains: number;
      reservations: number;
      segments: number;
      guests: number;
      occupancies: number;
      orphan_artifacts: number;
    }>>`
      SELECT
        count(*) FILTER (WHERE space_id=${ROOM}::uuid AND period=${PERIOD}::tstzrange
          AND NOT cleaned)::int AS room,
        count(*) FILTER (WHERE space_id=${DORM}::uuid AND period=${PERIOD}::tstzrange
          AND cleaned)::int AS cleaned_mix,
        count(*) FILTER (WHERE space_id=${DORM}::uuid AND period=${PERIOD}::tstzrange
          AND cleaned AND exclusive)::int AS mix_exclusive,
        count(*) FILTER (WHERE space_id=${DORM}::uuid AND period=${PERIOD}::tstzrange
          AND cleaned AND NOT exclusive)::int AS mix_positional,
        count(*) FILTER (WHERE space_id=${DORM}::uuid AND period=${PERIOD}::tstzrange
          AND NOT cleaned)::int AS capacity,
        count(*) FILTER (WHERE space_id=${DORM}::uuid
          AND lower(period)>='2027-02-01'::timestamptz
          AND lower(period)<'2027-03-01'::timestamptz AND NOT cleaned)::int AS throughput,
        count(*) FILTER (WHERE NOT cleaned)::int AS active_observations,
        count(*) FILTER (WHERE NOT cleaned AND EXISTS (
          SELECT 1 FROM reservation_segment rs
          JOIN reservation r ON r.id=rs.reservation_id AND r.tenant_id=rs.tenant_id
          JOIN reservation_guest rg ON rg.reservation_id=r.id AND rg.tenant_id=r.tenant_id
                                   AND rg.party_id=${PARTY}::uuid AND rg.role='primary'
          JOIN sellable_unit su ON su.id=rs.sellable_unit_id AND su.tenant_id=rs.tenant_id
                               AND su.unit_type_id=rs.unit_type_id
          JOIN sellable_unit_space sus ON sus.sellable_unit_id=su.id
                                      AND sus.tenant_id=su.tenant_id
                                      AND sus.space_id=order130_parent_observation.space_id
                                      AND sus.claim_mode=CASE
                                          WHEN order130_parent_observation.exclusive
                                          THEN 'exclusive' ELSE 'positional' END
          JOIN space_occupancy so ON so.slot_ref=rs.id AND so.tenant_id=rs.tenant_id
                                 AND so.space_id=order130_parent_observation.space_id
                                 AND so.period=rs.period
                                 AND so.exclusive=order130_parent_observation.exclusive
          WHERE rs.id=order130_parent_observation.segment_id
            AND r.property_node=order130_parent_observation.property_node
            AND rs.sellable_unit_id=order130_parent_observation.sellable_unit_id
            AND rs.unit_type_id=order130_parent_observation.unit_type_id
            AND rs.period=order130_parent_observation.period
        ))::int AS exact_active_chains,
        (SELECT count(*)::int FROM reservation WHERE confirmation_no LIKE 'TC12-%') AS reservations,
        (SELECT count(*)::int FROM reservation_segment rs JOIN reservation r
          ON r.id=rs.reservation_id WHERE r.confirmation_no LIKE 'TC12-%') AS segments,
        (SELECT count(*)::int FROM reservation_guest rg JOIN reservation r
          ON r.id=rg.reservation_id WHERE r.confirmation_no LIKE 'TC12-%') AS guests,
        (SELECT count(*)::int FROM space_occupancy so JOIN reservation_segment rs
          ON rs.id=so.slot_ref JOIN reservation r ON r.id=rs.reservation_id
          WHERE r.confirmation_no LIKE 'TC12-%') AS occupancies,
        ((SELECT count(*) FROM reservation r WHERE r.confirmation_no LIKE 'TC12-%'
            AND NOT EXISTS (SELECT 1 FROM reservation_segment rs WHERE rs.reservation_id=r.id))
         + (SELECT count(*) FROM reservation_segment rs JOIN reservation r ON r.id=rs.reservation_id
            WHERE r.confirmation_no LIKE 'TC12-%' AND (
              NOT EXISTS (SELECT 1 FROM reservation_guest rg WHERE rg.reservation_id=r.id)
              OR NOT EXISTS (SELECT 1 FROM space_occupancy so WHERE so.slot_ref=rs.id)))
         + (SELECT count(*) FROM reservation_guest rg JOIN reservation r ON r.id=rg.reservation_id
            WHERE r.confirmation_no LIKE 'TC12-%' AND rg.tenant_id<>r.tenant_id))::int AS orphan_artifacts
      FROM order130_parent_observation
    `)[0]!;
    const active = 1 + 6 + throughputCommits;
    expect(proof.room).toBe(1);
    expect(proof.cleaned_mix).toBeGreaterThan(0);
    expect(proof.mix_exclusive > 0 && proof.mix_positional > 0).toBeFalse();
    expect(proof.capacity).toBe(6);
    expect(proof.throughput).toBe(throughputCommits);
    expect(proof.active_observations).toBe(active);
    expect(proof.exact_active_chains).toBe(active);
    expect(proof.reservations).toBe(active);
    expect(proof.segments).toBe(active);
    expect(proof.guests).toBe(active);
    expect(proof.occupancies).toBe(active);
    expect(proof.orphan_artifacts).toBe(0);
  }, 60_000);

  test("P2: every missing or mismatched authoritative parent fails closed without artifacts", async () => {
    const cases: readonly InvalidParent[] = [
      { label: "omitted reservation", reservation: false, segment: false },
      { label: "omitted segment", segment: false },
      { label: "wrong tenant", recordTenant: T_B },
      { label: "wrong property", property: WRONG_PROPERTY },
      { label: "wrong sellable mapping", sellable: DORM_POSITIONAL, unitType: DORM_UNIT_TYPE },
      { label: "wrong unit type", unitType: DORM_UNIT_TYPE },
      { label: "wrong period", claimPeriod: "[2037-02-01 10:00:00+00,2037-02-03 08:00:00+00)" },
    ];
    for (const [index, item] of cases.entries()) await rejectInvalidParent(item, index);
  });

  test("P2: a forced exclusion loser rolls back all parents, guest and occupancy", async () => {
    const winnerReservation = fixedId(130_300);
    const winnerSegment = fixedId(130_301);
    const loserReservation = fixedId(130_302);
    const loserSegment = fixedId(130_303);
    await commitParentChain(winnerReservation, winnerSegment);
    let error: unknown;
    try {
      await commitParentChain(loserReservation, loserSegment);
    } catch (caught) {
      error = caught;
    }
    expect(sqlState(error)).toBe("23P01");
    expect(await artifactCounts(winnerReservation, winnerSegment)).toEqual({
      reservations: 1, segments: 1, guests: 1, occupancies: 1,
    });
    expect(await artifactCounts(loserReservation, loserSegment)).toEqual({
      reservations: 0, segments: 0, guests: 0, occupancies: 0,
    });
    await admin!.unsafe(`
      DELETE FROM space_occupancy WHERE slot_ref='${winnerSegment}';
      DELETE FROM reservation_guest WHERE reservation_id='${winnerReservation}';
      DELETE FROM reservation_segment WHERE id='${winnerSegment}';
      DELETE FROM reservation WHERE id='${winnerReservation}';
    `);
  });

  test("P2: bypassing record_occupancy cannot satisfy the full-chain postcondition", async () => {
    const reservationId = fixedId(130_400);
    const segmentId = fixedId(130_401);
    let postcondition = true;
    try {
      await admin!.begin(async (tx) => {
        await tx.unsafe(`
          INSERT INTO reservation
            (id,tenant_id,property_node,confirmation_no,status,primary_party,currency)
          VALUES ('${reservationId}','${T_A}','${PROPERTY}','O130-BYPASS',
            'reserved','${PARTY}','AED');
          INSERT INTO reservation_segment
            (id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
          VALUES ('${segmentId}','${T_A}','${reservationId}',1,'${ROOM_UNIT_TYPE}',
            '${ROOM_SELLABLE}','[2038-01-01,2038-01-03)'::tstzrange,'${RATE_PLAN}','booked');
          INSERT INTO reservation_guest (tenant_id,reservation_id,party_id,role)
          VALUES ('${T_A}','${reservationId}','${PARTY}','primary')
        `);
        const rows = await tx<Array<{ complete: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM reservation r
            JOIN reservation_segment rs ON rs.reservation_id=r.id
            JOIN reservation_guest rg ON rg.reservation_id=r.id
            JOIN space_occupancy so ON so.slot_ref=rs.id
            WHERE r.id=${reservationId}::uuid AND rs.id=${segmentId}::uuid
          ) AS complete
        `;
        postcondition = rows[0]!.complete;
        throw new Error("rollback bypass fixture");
      });
    } catch (error) {
      expect((error as Error).message).toContain("rollback bypass fixture");
    }
    expect(postcondition).toBeFalse();
    expect(await artifactCounts(reservationId, segmentId)).toEqual({
      reservations: 0, segments: 0, guests: 0, occupancies: 0,
    });
  });
});
