import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  APPROVAL_STATUSES,
  ApprovalConflictError,
  ApprovalService,
  createAuditEnvelope,
  Database,
  isDeclaredApprovalTransition,
  PostgresEventBus,
  type ApprovalStatus,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_APPROVAL_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_APPROVAL === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000000002";
const PROPERTY_A = "00000000-0000-0000-0000-000000000012";
const REQUESTER = "00000000-0000-0000-0000-000000000960";
const APPROVER_A = "00000000-0000-0000-0000-000000000961";
const APPROVER_B = "00000000-0000-0000-0000-000000000962";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_APPROVAL_URL is required by the Order 025 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let service: ApprovalService | undefined;
const approvalIds = new Set<string>();

function envelope(actorId: string, operation: string) {
  return createAuditEnvelope({
    actorId,
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    requestId: crypto.randomUUID(),
    operation,
  });
}

async function requestApproval(requestedBy = REQUESTER) {
  const approval = await database!.withTenantTransaction(TENANT_A, (tx) => service!.request(tx, {
    kind: "order025-proof",
    subjectType: "task",
    subjectId: crypto.randomUUID(),
    requestedBy,
    payload: { reason: "proof" },
    envelope: envelope(requestedBy, "approval.requested"),
  }));
  approvalIds.add(approval.id);
  return approval;
}

async function decide(
  approvalId: string,
  decision: ApprovalStatus,
  actorId = APPROVER_A,
) {
  return database!.withTenantTransaction(TENANT_A, (tx) => service!.decide(tx, {
    approvalId,
    decision,
    decidedBy: decision === "approved" || decision === "rejected" ? actorId : undefined,
    envelope: envelope(actorId, "approval.decided"),
  }));
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });
  service = new ApprovalService(new PostgresEventBus(eventPool));
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name)
    VALUES
      (${APPROVER_A}::uuid, ${TENANT_A}::uuid, 'order025-a@yellow.test', 'Order 025 Approver A'),
      (${APPROVER_B}::uuid, ${TENANT_A}::uuid, 'order025-b@yellow.test', 'Order 025 Approver B')
    ON CONFLICT (id) DO NOTHING
  `;
});

afterAll(async () => {
  if (admin && approvalIds.size > 0) {
    const ids = [...approvalIds];
    await admin`DELETE FROM outbox WHERE aggregate_type = 'approval_request' AND aggregate_id IN ${admin(ids)}`;
    await admin`DELETE FROM fact_log WHERE entity_type = 'approval_request' AND entity_id IN ${admin(ids)}`;
    await admin`DELETE FROM approval_request WHERE id IN ${admin(ids)}`;
    await admin`DELETE FROM app_user WHERE id IN (${APPROVER_A}::uuid, ${APPROVER_B}::uuid)`;
    await admin.close();
  }
  await eventPool?.close();
  await database?.close();
});

databaseDescribe("Order 025 approval primitive", () => {
  test("P1: every declared transition succeeds end to end", async () => {
    const approved = await requestApproval();
    const rejected = await requestApproval();
    const expired = await requestApproval();

    expect((await decide(approved.id, "approved")).status).toBe("approved");
    expect((await decide(rejected.id, "rejected")).status).toBe("rejected");
    const expiredResult = await decide(expired.id, "expired");
    expect(expiredResult.status).toBe("expired");
    expect(expiredResult.decidedBy).toBeNull();
    expect(expiredResult.decidedAt).toBeInstanceOf(Date);
  });

  test("P2: every undeclared state pair is rejected and leaves the source unchanged", async () => {
    const undeclared = APPROVAL_STATUSES.flatMap((from) =>
      APPROVAL_STATUSES.flatMap((to) => isDeclaredApprovalTransition(from, to) ? [] : [{ from, to }])
    );
    expect(undeclared).toHaveLength(13);

    for (const { from, to } of undeclared) {
      const approval = await requestApproval();
      if (from !== "pending") await decide(approval.id, from, APPROVER_A);
      const attemptActor = from === "approved" || from === "rejected" ? APPROVER_B : APPROVER_A;
      await expect(decide(approval.id, to, attemptActor)).rejects.toThrow(
        new RegExp(`Illegal approval transition ${from} -> ${to}`),
      );
      const rows = await admin!<Array<{ status: ApprovalStatus }>>`
        SELECT status FROM approval_request WHERE id = ${approval.id}::uuid
      `;
      expect(rows).toEqual([{ status: from }]);
    }
  }, 30_000);

  test("P3: requester cannot approve or reject their own request", async () => {
    for (const decision of ["approved", "rejected"] as const) {
      const approval = await requestApproval();
      await expect(decide(approval.id, decision, REQUESTER)).rejects.toThrow("Self-approval is forbidden");
      const rows = await admin!<Array<{ status: ApprovalStatus; decided_by: string | null }>>`
        SELECT status, decided_by FROM approval_request WHERE id = ${approval.id}::uuid
      `;
      expect(rows).toEqual([{ status: "pending", decided_by: null }]);
    }
  });

  test("P4: mutable head is reconstructable from two append-only facts and two events", async () => {
    const approval = await requestApproval();
    const before = await admin!<Array<{ id: string; payload: Record<string, unknown> }>>`
      SELECT id, payload FROM fact_log
      WHERE entity_type = 'approval_request' AND entity_id = ${approval.id}::uuid
    `;
    expect(before).toHaveLength(1);
    await decide(approval.id, "approved");
    const facts = await admin!<Array<{ id: string; payload: Record<string, unknown> }>>`
      SELECT id, payload FROM fact_log
      WHERE entity_type = 'approval_request' AND entity_id = ${approval.id}::uuid
      ORDER BY recorded_at, id
    `;
    const events = await admin!<Array<{ event_type: string }>>`
      SELECT event_type FROM outbox
      WHERE aggregate_type = 'approval_request' AND aggregate_id = ${approval.id}::uuid
      ORDER BY seq
    `;
    expect(facts).toHaveLength(2);
    expect(facts.some(({ id, payload }) => id === before[0]!.id && JSON.stringify(payload) === JSON.stringify(before[0]!.payload))).toBe(true);
    expect(facts.map(({ payload }) => payload.status)).toEqual(["pending", "approved"]);
    expect(events).toEqual([{ event_type: "approval.requested" }, { event_type: "approval.decided" }]);
  });

  test("P5: tenant B cannot read or decide tenant A approval", async () => {
    const approval = await requestApproval();
    const visible = await database!.withTenantTransaction(TENANT_B, async (tx) => {
      const rows = await tx<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM approval_request WHERE id = ${approval.id}::uuid
      `;
      return rows[0]?.count;
    });
    expect(visible).toBe(0);
    await expect(database!.withTenantTransaction(TENANT_B, (tx) => service!.decide(tx, {
      approvalId: approval.id,
      decision: "approved",
      decidedBy: APPROVER_A,
      envelope: createAuditEnvelope({
        actorId: APPROVER_A,
        tenantId: TENANT_B,
        propertyNode: PROPERTY_A,
        requestId: crypto.randomUUID(),
        operation: "approval.decided",
      }),
    }))).rejects.toBeInstanceOf(ApprovalConflictError);
  });

  test("D-93: two concurrent decisions produce one winner, one terminal fact and event", async () => {
    const approval = await requestApproval();
    const contenderA = Database.connect(DATABASE_URL!, { maxConnections: 1 });
    const contenderB = Database.connect(DATABASE_URL!, { maxConnections: 1 });
    const decideWith = (contender: Database, decision: "approved" | "rejected", actorId: string) =>
      contender.withTenantTransaction(TENANT_A, (tx) => service!.decide(tx, {
        approvalId: approval.id,
        decision,
        decidedBy: actorId,
        envelope: envelope(actorId, "approval.decided"),
      }));
    const results = await Promise.allSettled([
      decideWith(contenderA, "approved", APPROVER_A),
      decideWith(contenderB, "rejected", APPROVER_B),
    ]);
    await contenderA.close();
    await contenderB.close();
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const counts = await admin!<Array<{ facts: number; events: number }>>`
      SELECT
        (SELECT count(*)::int FROM fact_log WHERE entity_type = 'approval_request' AND entity_id = ${approval.id}::uuid) AS facts,
        (SELECT count(*)::int FROM outbox WHERE aggregate_type = 'approval_request' AND aggregate_id = ${approval.id}::uuid) AS events
    `;
    expect(counts).toEqual([{ facts: 2, events: 2 }]);
  });
});
