import { ApprovalService, type EventBus, type Tx } from "../src/kernel";
import { expect, test } from "bun:test";

const TENANT = "00000000-0000-0000-0000-000000000001";
const PROPERTY = "00000000-0000-0000-0000-000000000012";
const REQUESTER = "00000000-0000-0000-0000-000000000960";
const SUBJECT = "00000000-0000-0000-0000-000000000961";
const APPROVAL_ID = "00000000-0000-0000-0000-000000000963";

function envelope() {
  return { tenantId: TENANT, propertyNode: PROPERTY, actorId: REQUESTER,
    requestId: "00000000-0000-0000-0000-000000000962", operation: "approval.requested" } as const;
}

function fakeService(rejectExpiry = false) {
  const inserted: string[] = [];
  const bound: unknown[][] = [];
  const approvalId = APPROVAL_ID;
  const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.raw.join("");
    inserted.push(sql);
    bound.push(values);
    if (sql.includes("create_approval_request_with_options") && rejectExpiry) throw new Error("approval valid_until must be later than transaction_timestamp (22023)");
    if (sql.includes("INSERT INTO approval_request") || sql.includes("create_approval_request_with_options")) return [{ id: approvalId, tenant_id: TENANT,
      kind: "native_test", subject_type: "folio", subject_id: SUBJECT, requested_by: REQUESTER,
      payload: { reason: "test" }, status: "pending", decided_by: null, decided_at: null,
      created_at: new Date("2026-09-05T00:00:00.000Z") }];
    return [{ id: "00000000-0000-0000-0000-000000000964", tenant_id: TENANT,
      entity_type: "approval_request", entity_id: approvalId, fact_type: "approval.requested",
      valid_from: new Date(), recorded_at: new Date(), business_date: "2026-09-05",
      actor_id: REQUESTER, payload: { reason: "test" }, supersedes: null }];
  }) as unknown as Tx;
  const events: EventBus = { publish: async () => ({ } as never), consumeBatch: async () => ({ consumer: "test", examined: 0, processed: 0, lastSeq: 0 }) };
  return { service: new ApprovalService(events), tx, inserted, bound };
}

test("legacy request keeps the original insert and fact payload path", async () => {
  const { service, tx, inserted } = fakeService();
  await service.request(tx, { kind: "native_test", subjectType: "folio", subjectId: SUBJECT,
    requestedBy: REQUESTER, payload: { reason: "test" }, envelope: envelope() });
  expect(inserted[0]).toContain("tenant_id, kind, subject_type, subject_id, requested_by, payload");
  expect(inserted[0]).not.toContain("valid_until");
});

test("supplied identity and expiry use the extended insert path", async () => {
  const { service, tx, inserted, bound } = fakeService();
  const approval = await service.request(tx, { kind: "native_test", subjectType: "folio", subjectId: SUBJECT,
    requestedBy: REQUESTER, payload: { reason: "test" }, envelope: envelope(), approvalId: APPROVAL_ID,
    validUntil: new Date("2099-01-01T00:00:00.000Z") });
  expect(approval.id).toBe("00000000-0000-0000-0000-000000000963");
  expect(inserted[0]).toContain("create_approval_request_with_options");
  expect(bound[0]).toContain(APPROVAL_ID);
  expect(bound[0]).toContain("2099-01-01T00:00:00.000Z");
});

test("supports server-generated identity with explicit expiry", async () => {
  const { service, tx, bound } = fakeService();
  const approval = await service.request(tx, { kind: "native_test", subjectType: "folio", subjectId: SUBJECT,
    requestedBy: REQUESTER, payload: { reason: "test" }, envelope: envelope(),
    validUntil: new Date("2099-01-01T00:00:00.000Z") });
  expect(approval.id).toBe(APPROVAL_ID);
  expect(bound[0]).toContain(null);
  expect(bound[0]).toContain("2099-01-01T00:00:00.000Z");
});

test("supports preallocated identity without expiry", async () => {
  const { service, tx, bound } = fakeService();
  const approval = await service.request(tx, { kind: "native_test", subjectType: "folio", subjectId: SUBJECT,
    requestedBy: REQUESTER, payload: { reason: "test" }, envelope: envelope(), approvalId: APPROVAL_ID });
  expect(approval.id).toBe(APPROVAL_ID);
  expect(bound[0]).toContain(APPROVAL_ID);
  expect(bound[0]).toContain(null);
});

test.each([
  ["approvalId", { approvalId: "not-a-uuid" }],
  ["validUntil", { validUntil: new Date("invalid") }],
] as const)("rejects invalid %s before SQL", async (_name, options) => {
  const { service, tx, inserted } = fakeService();
  await expect(service.request(tx, { kind: "native_test", subjectType: "folio", subjectId: SUBJECT,
    requestedBy: REQUESTER, payload: { reason: "test" }, envelope: envelope(), ...options })).rejects.toThrow();
  expect(inserted).toHaveLength(0);
});

test("rejects an expiry at or before PostgreSQL transaction time", async () => {
  const { service, tx } = fakeService(true);
  await expect(service.request(tx, { kind: "native_test", subjectType: "folio", subjectId: SUBJECT,
    requestedBy: REQUESTER, payload: { reason: "test" }, envelope: envelope(), approvalId: APPROVAL_ID,
    validUntil: new Date("2000-01-01T00:00:00.000Z") })).rejects.toThrow(/valid_until.*transaction_timestamp/);
});
