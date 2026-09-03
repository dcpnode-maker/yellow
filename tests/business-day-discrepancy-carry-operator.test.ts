import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BusinessDayDiscrepancyCarryOperatorService,
  BusinessDayDiscrepancyCarryOperatorValidationError,
} from "../src/contexts/financials";
import { PostgresIdempotency, type EventBus, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000038701";
const PROPERTY = "00000000-0000-0000-0000-000000038711";
const ACTOR = "00000000-0000-0000-0000-000000038721";
const DISCREPANCY = "00000000-0000-0000-0000-000000038731";
const events = {
  publish: async () => undefined,
  consumeBatch: async () => Object.freeze([]),
} as unknown as EventBus;
const service = new BusinessDayDiscrepancyCarryOperatorService({ events, idempotency: new PostgresIdempotency() });
const noQuery = (() => { throw new Error("validation reached PostgreSQL"); }) as unknown as Tx;

function audit(operation: string) {
  return { tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, requestId: crypto.randomUUID(), operation };
}

describe("Order 387 discrepancy-carry operator domain", () => {
  test("browser request shape cannot assert target date or authority hashes", async () => {
    await expect(service.requestApproval(noQuery, {
      tenantId: TENANT, propertyNode: PROPERTY, sourceBusinessDate: "2026-09-02",
      discrepancyId: DISCREPANCY, reason: "Carry for investigation", idempotencyKey: "order387-request",
      envelope: audit("approval.requested"),
      targetBusinessDate: "2026-09-03", requestHash: "0".repeat(64),
    } as never)).rejects.toBeInstanceOf(BusinessDayDiscrepancyCarryOperatorValidationError);
  });

  test("reason is normalized, trimmed and bounded by UTF-8 bytes before SQL", async () => {
    for (const reason of ["", " padded", "x".repeat(501), "é".repeat(251), "line\nbreak", "e\u0301"]) {
      await expect(service.requestApproval(noQuery, {
        tenantId: TENANT, propertyNode: PROPERTY, sourceBusinessDate: "2026-09-02",
        discrepancyId: DISCREPANCY, reason, idempotencyKey: "order387-request", envelope: audit("approval.requested"),
      })).rejects.toBeInstanceOf(BusinessDayDiscrepancyCarryOperatorValidationError);
    }
  });

  test("inbox cursor and bounds fail before executing a query", async () => {
    for (const input of [
      { tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, after: "not+base64url" },
      { tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, limit: 0 },
      { tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, limit: 101 },
      { tenantId: TENANT, propertyNode: PROPERTY, actorId: ACTOR, limit: 1.5 },
    ]) await expect(service.listApprovals(noQuery, input)).rejects.toBeInstanceOf(BusinessDayDiscrepancyCarryOperatorValidationError);
  });

  test("decision and carry accept opaque approval identity but no pasted evidence", async () => {
    await expect(service.decideApproval(noQuery, {
      tenantId: TENANT, propertyNode: PROPERTY, approvalId: crypto.randomUUID(), decision: "approved",
      idempotencyKey: "order387-decision", envelope: audit("approval.decided"), requestHash: "0".repeat(64),
    } as never)).rejects.toBeInstanceOf(BusinessDayDiscrepancyCarryOperatorValidationError);
    await expect(service.carry(noQuery, {
      tenantId: TENANT, propertyNode: PROPERTY, approvalId: crypto.randomUUID(),
      idempotencyKey: "order387-consume", envelope: audit("discrepancy.carried"), expectedRequestHash: "0".repeat(64),
    } as never)).rejects.toBeInstanceOf(BusinessDayDiscrepancyCarryOperatorValidationError);
  });

  test("source keeps PostgreSQL authority, keyset bounds and privacy exclusions load-bearing", () => {
    const source = readFileSync(resolve(import.meta.dir, "../src/contexts/financials/business-day-discrepancy-carry-operator.ts"), "utf8");
    expect(source).toContain("FOR UPDATE OF approval");
    expect(source).toContain("prepare_business_day_discrepancy_carry");
    expect(source).toContain("transaction_timestamp()>=approval.created_at");
    expect(source).toContain("LIMIT ${limit + 1}");
    expect(source).toContain("ORDER BY approval.created_at DESC,approval.id DESC");
    expect(source).toContain("day.sealed_at IS NULL");
    const listSource = source.slice(source.indexOf("async listApprovals"), source.indexOf("async decideApproval"));
    expect(listSource).not.toContain("approval.payload->>");
    const view = source.match(/export interface CarryApprovalOperatorView \{([\s\S]*?)\n\}/)?.[1];
    expect(view).toBeString();
    expect(view).not.toMatch(/payload|requestHash|discrepancyStateHash|email|permission/i);
  });
});
