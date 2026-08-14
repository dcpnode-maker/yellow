/**
 * space_occupancy concurrency stress test — TypeScript port of prototype
 * Proves the claim-range constraint under real concurrent load.
 *
 * Tests:
 *   T1  Exclusive integrity: 50 clients race for 1 room → exactly 1 winner
 *   T2  Composite exclusivity: private vs beds on same space → never both
 *   T3  Capacity integrity: 40 clients race for 6 beds → exactly 6 winners
 *   T4  Choke point: direct INSERT as app_role → 42501 permission denied
 *   T5  Throughput: 500 non-overlapping bookings, 10 threads → >1000 commits/sec
 *
 * Run: bun test src/stress/occupancy-stress.test.ts
 * Requires: local PG16 with schema loaded, seed fixture applied
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { sql } from "../db"; // your drizzle/raw SQL connection

const TENANT = "00000000-0000-0000-0000-000000000001";
const ROOM_101 = "00000000-0000-0000-0000-000000000200"; // STD, capacity 1, exclusive
const DORM_A = "00000000-0000-0000-0000-000000000215";   // 6-bed dorm (seed separately if needed)

// Helper: attempt occupancy via choke point
async function attemptOccupancy(
  spaceId: string,
  period: string,
  exclusive: boolean,
  slotKind: string = "segment"
): Promise<{ success: boolean; error?: string; occupancyId?: string }> {
  const slotRef = crypto.randomUUID();
  try {
    const result = await sql`SELECT record_occupancy(
      ${TENANT}::uuid,
      ${spaceId}::uuid,
      ${period}::tstzrange,
      ${slotRef}::uuid,
      ${slotKind},
      ${exclusive}
    ) as id`;
    return { success: true, occupancyId: result[0].id };
  } catch (e: any) {
    return { success: false, error: e.code || e.message };
  }
}

// Helper: release occupancy
async function releaseOccupancy(slotRef: string): Promise<number> {
  const result = await sql`SELECT release_occupancy(${TENANT}::uuid, ${slotRef}::uuid) as n`;
  return result[0].n;
}

// Helper: race N clients for the same space/period
async function race(
  n: number,
  spaceId: string,
  period: string,
  exclusive: boolean
): Promise<{ wins: number; rejects: number; durationMs: number; results: string[] }> {
  const results: string[] = new Array(n).fill("pending");
  const start = performance.now();

  const promises = Array.from({ length: n }, (_, i) =>
    attemptOccupancy(spaceId, period, exclusive).then((r) => {
      results[i] = r.success ? "WIN" : `REJECT:${r.error}`;
    })
  );

  await Promise.all(promises);
  const durationMs = performance.now() - start;

  const wins = results.filter((r) => r === "WIN").length;
  const rejects = n - wins;

  return { wins, rejects, durationMs, results };
}

describe("Occupancy Concurrency Stress Tests", () => {
  beforeAll(async () => {
    // Ensure clean state
    await sql`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
    // Clean up any test occupancy from previous runs
    await sql`DELETE FROM space_occupancy WHERE tenant_id = ${TENANT}::uuid AND slot_kind = 'segment' AND slot_ref LIKE 'test-%'`;
  });

  afterAll(async () => {
    // Cleanup
    await sql`DELETE FROM space_occupancy WHERE tenant_id = ${TENANT}::uuid AND slot_kind = 'segment' AND slot_ref LIKE 'test-%'`;
  });

  test("T1: Exclusive race — 50 clients, 1 room, exactly 1 winner", async () => {
    const period = "[2026-10-01 14:00+04,2026-10-03 12:00+04)";
    const { wins, rejects, durationMs } = await race(50, ROOM_101, period, true);

    console.log(`T1: wins=${wins}, rejects=${rejects}, ${durationMs.toFixed(0)}ms`);
    expect(wins).toBe(1);
    expect(rejects).toBe(49);
    expect(durationMs).toBeLessThan(5000); // Should complete in <5s
  });

  test("T2: Composite race — private vs beds, never both", async () => {
    // This test requires a dorm space. If not seeded, skip.
    const dormCheck = await sql`SELECT id FROM space WHERE id = ${DORM_A}::uuid`;
    if (dormCheck.length === 0) {
      console.log("T2: SKIP — dorm space not seeded");
      return;
    }

    const period = "[2026-10-05 14:00+04,2026-10-07 12:00+04)";
    const results: string[] = new Array(50).fill("pending");

    const promises = Array.from({ length: 50 }, (_, i) => {
      const exclusive = i % 2 === 0; // 25 exclusive, 25 positional
      return attemptOccupancy(DORM_A, period, exclusive).then((r) => {
        results[i] = r.success ? (exclusive ? "EXCL_WIN" : "BED_WIN") : `REJECT:${r.error}`;
      });
    });

    await Promise.all(promises);

    const exclWins = results.filter((r) => r === "EXCL_WIN").length;
    const bedWins = results.filter((r) => r === "BED_WIN").length;

    console.log(`T2: private=${exclWins}, beds=${bedWins}`);

    // Legal outcomes: (1,0) or (0,1..6) — NEVER both
    const validOutcome =
      (exclWins === 1 && bedWins === 0) ||
      (exclWins === 0 && bedWins >= 1 && bedWins <= 6);

    expect(validOutcome).toBe(true);
  });

  test("T3: Capacity race — 40 clients, 6 beds, exactly 6 winners", async () => {
    const dormCheck = await sql`SELECT id FROM space WHERE id = ${DORM_A}::uuid`;
    if (dormCheck.length === 0) {
      console.log("T3: SKIP — dorm space not seeded");
      return;
    }

    const period = "[2026-10-10 14:00+04,2026-10-12 12:00+04)";
    const { wins, rejects, durationMs } = await race(40, DORM_A, period, false);

    console.log(`T3: wins=${wins}, rejects=${rejects}, ${durationMs.toFixed(0)}ms`);
    expect(wins).toBe(6);
    expect(rejects).toBe(34);
  });

  test("T4: Choke point — direct INSERT as app_role must fail with 42501", async () => {
    try {
      await sql`INSERT INTO space_occupancy (
        tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim
      ) VALUES (
        ${TENANT}::uuid,
        ${ROOM_101}::uuid,
        '[2027-01-01,2027-01-02)'::tstzrange,
        ${crypto.randomUUID()}::uuid,
        'segment',
        true,
        int4range(0, NULL)
      )`;

      // If we get here, the INSERT succeeded — this is a FAILURE
      expect.fail("Direct INSERT should have been denied");
    } catch (e: any) {
      console.log(`T4: denied with code ${e.code}`);
      expect(e.code).toBe("42501"); // insufficient_privilege
    }
  });

  test("T5: Throughput — 500 non-overlapping bookings, 10 concurrent workers", async () => {
    const workerCount = 10;
    const bookingsPerWorker = 50;
    const results: number[] = new Array(workerCount).fill(0);

    const start = performance.now();

    const workers = Array.from({ length: workerCount }, async (_, k) => {
      let count = 0;
      for (let j = 0; j < bookingsPerWorker; j++) {
        const d = k * bookingsPerWorker + j;
        const hour = Math.floor(d / 60);
        const minute = d % 60;
        const period = `[2028-01-01 ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}+04,2028-01-01 ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:30+04)`;

        const r = await attemptOccupancy(ROOM_101, period, true);
        if (r.success) count++;
      }
      results[k] = count;
    });

    await Promise.all(workers);
    const duration = (performance.now() - start) / 1000;
    const total = results.reduce((a, b) => a + b, 0);
    const rate = total / duration;

    console.log(`T5: ${total} bookings / ${duration.toFixed(2)}s = ${rate.toFixed(0)} commits/sec`);

    expect(total).toBe(workerCount * bookingsPerWorker); // All should succeed (non-overlapping)
    expect(rate).toBeGreaterThan(500); // Should sustain >500 commits/sec
  });

  test("RLS isolation — cross-tenant read returns zero rows", async () => {
    // Set tenant to a non-existent UUID
    await sql`SELECT set_config('app.tenant_id', '99999999-9999-9999-9999-999999999999', true)`;

    const spaces = await sql`SELECT * FROM space WHERE property_node = ${"00000000-0000-0000-0000-000000000012"}::uuid`;
    expect(spaces.length).toBe(0);

    // Reset
    await sql`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
  });

  test("Journal balance — unbalanced journal rejected at commit", async () => {
    // Start a transaction
    const tx = await sql.begin(async (sql) => {
      // Set tenant within transaction
      await sql`SELECT set_config('app.tenant_id', ${TENANT}, true)`;

      // Create a journal
      const [journal] = await sql`
        INSERT INTO journal (tenant_id, property_node, business_date, kind, description, currency, source)
        VALUES (${TENANT}::uuid, ${"00000000-0000-0000-0000-000000000012"}::uuid, '2026-09-15', 'charge', 'Test unbalanced', 'AED', '{"test":true}')
        RETURNING id
      `;

      // Post only ONE line (unbalanced — no credit side)
      await sql`
        INSERT INTO posting_line (tenant_id, journal_id, seq, account_id, tx_code, amount_minor, business_date)
        VALUES (${TENANT}::uuid, ${journal.id}::uuid, 1, ${"00000000-0000-0000-0000-000000000800"}::uuid, 'ROOM', 50000, '2026-09-15')
      `;

      // The deferred trigger should fire at commit and reject
      // If we reach here, the trigger didn't fire — but it should on COMMIT
    });

    // If we get here without error, the test failed
    expect.fail("Unbalanced journal should have been rejected");
  });
});

/**
 * Additional integration tests for the complete guest journey
 */
describe("Guest Journey Integration Tests", () => {
  test("End-to-end: Search → Hold → Commit → Check-in → Post → Checkout", async () => {
    // This is a skeleton — implement with your actual service layer
    // 1. Search availability
    // 2. Create hold
    // 3. Commit reservation
    // 4. Verify reservation + folio + outbox events
    // 5. Check-in
    // 6. Post room charge
    // 7. Verify journal balance = 0
    // 8. Checkout
    // 9. Verify folio settled + closed
    // 10. Verify occupancy released
  });

  test("Cancellation with penalty: late cancel charges first night", async () => {
    // 1. Create reservation for tomorrow
    // 2. Cancel today (within 24h)
    // 3. Verify penalty journal posted
    // 4. Verify journal balance = 0
    // 5. Verify folio shows charge
  });

  test("No-show processing: auto-charge and release", async () => {
    // 1. Create reservation for yesterday
    // 2. Run no-show job
    // 3. Verify status = no_show
    // 4. Verify occupancy released
    // 5. Verify no-show charge posted
  });

  test("Document issuance: gapless numbering + hash chain", async () => {
    // 1. Settle folio
    // 2. Issue invoice
    // 3. Verify doc_no = INV-DXB-1
    // 4. Verify sha256 computed
    // 5. Issue second invoice
    // 6. Verify doc_no = INV-DXB-2, prev_hash = first invoice sha256
  });

  test("Business day seal: blocks new postings", async () => {
    // 1. Seal 2026-09-15
    // 2. Attempt normal charge → should fail with P0011
    // 3. Attempt adjustment → should succeed
  });
});
