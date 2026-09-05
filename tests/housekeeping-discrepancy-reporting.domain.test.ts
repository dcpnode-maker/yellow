import { describe, expect, test } from "bun:test";

import {
  HousekeepingDiscrepancyConflictError,
  HousekeepingDiscrepancyService,
  HousekeepingDiscrepancyValidationError,
  type HousekeepingDiscrepancyReportInput,
} from "../src/contexts/housekeeping";

const TENANT = "00000000-0000-0000-0000-000000023501";
const PROPERTY = "00000000-0000-0000-0000-000000023502";
const ROOM = "00000000-0000-0000-0000-000000023503";
const ACTOR = "00000000-0000-0000-0000-000000023504";
const REQUEST = "00000000-0000-0000-0000-000000023505";
const DISCREPANCY = "00000000-0000-0000-0000-000000023506";

function input(overrides: Partial<HousekeepingDiscrepancyReportInput> = {}): HousekeepingDiscrepancyReportInput {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    spaceId: ROOM,
    observedPresence: "occupied",
    observedPersons: 2,
    idempotencyKey: "order235-room-observation",
    envelope: {
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode: PROPERTY,
      requestId: REQUEST,
      operation: "discrepancy.reported",
    },
    ...overrides,
  };
}

function unreachable(): HousekeepingDiscrepancyService {
  return new HousekeepingDiscrepancyService({
    database: { withTenantTransaction: async () => { throw new Error("database reached"); } } as never,
    events: {} as never,
    idempotency: {} as never,
  });
}

function capabilityService(row: Readonly<Record<string, unknown>>): HousekeepingDiscrepancyService {
  const tx = async () => [row];
  return new HousekeepingDiscrepancyService({
    database: {
      withTenantTransaction: async (_tenant: string, command: (transaction: unknown) => Promise<unknown>) =>
        command(tx),
    } as never,
    events: { publish: async () => { throw new Error("event publication reached"); } } as never,
    idempotency: {
      execute: async (_tx: unknown, _request: unknown, command: (transaction: unknown) => Promise<unknown>) => {
        const result = await command(tx) as { status: number; body: unknown };
        return { ...result, replayed: false };
      },
    } as never,
  });
}

describe("Order 235 housekeeping discrepancy domain", () => {
  test("rejects surplus or incoherent caller observations before database access", async () => {
    const service = unreachable();
    await expect(service.report({ ...input(), systemState: "vacant" } as never))
      .rejects.toBeInstanceOf(HousekeepingDiscrepancyValidationError);
    await expect(service.report(input({ observedPresence: "vacant", observedPersons: 1 })))
      .rejects.toBeInstanceOf(HousekeepingDiscrepancyValidationError);
    await expect(service.report(input({ observedPresence: "occupied", observedPersons: 0 })))
      .rejects.toBeInstanceOf(HousekeepingDiscrepancyValidationError);
    await expect(service.report(input({
      envelope: { ...input().envelope, operation: "task.created" } as never,
    }))).rejects.toBeInstanceOf(HousekeepingDiscrepancyValidationError);
    await expect(service.listOpen({ tenantId: "NOT-A-UUID", propertyNode: PROPERTY }))
      .rejects.toBeInstanceOf(HousekeepingDiscrepancyValidationError);
  });

  test("returns the governed match no-op without inventing a discrepancy or audit event", async () => {
    const service = capabilityService({
      discrepancy_id: null,
      room_id: ROOM,
      room_code: "101",
      room_floor: "1",
      discrepancy_kind: null,
      reported_value: null,
      system_value: null,
      reporter_id: null,
      discrepancy_reported_at: null,
      created: false,
    });
    await expect(service.report(input())).resolves.toEqual({
      discrepancy: null,
      created: false,
      replayed: false,
    });
  });

  test("returns exact immutable evidence for a convergent open discrepancy", async () => {
    const service = capabilityService({
      discrepancy_id: DISCREPANCY,
      room_id: ROOM,
      room_code: "101",
      room_floor: "1",
      discrepancy_kind: "sleep",
      reported_value: "occupied",
      system_value: "vacant",
      reporter_id: ACTOR,
      discrepancy_reported_at: "2026-08-28T00:00:00.000Z",
      created: false,
    });
    const result = await service.report(input());
    expect(result).toEqual({
      discrepancy: {
        discrepancyId: DISCREPANCY,
        spaceId: ROOM,
        code: "101",
        floor: "1",
        kind: "sleep",
        reported: "occupied",
        systemState: "vacant",
        reportedBy: ACTOR,
        reportedAt: "2026-08-28T00:00:00.000Z",
      },
      created: false,
      replayed: false,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.discrepancy)).toBe(true);
  });

  test("fails closed when the bounded unresolved read would exceed 100 rows", async () => {
    const row = {
      discrepancy_id: DISCREPANCY,
      room_id: ROOM,
      room_code: "101",
      room_floor: "1",
      discrepancy_kind: "sleep",
      reported_value: "occupied",
      system_value: "vacant",
      reporter_id: ACTOR,
      discrepancy_reported_at: "2026-08-28T00:00:00.000Z",
    };
    const service = new HousekeepingDiscrepancyService({
      database: {
        withTenantTransaction: async (_tenant: string, command: (transaction: unknown) => Promise<unknown>) =>
          command(async () => Array.from({ length: 101 }, () => row)),
      } as never,
      events: {} as never,
      idempotency: {} as never,
    });
    await expect(service.listOpen({ tenantId: TENANT, propertyNode: PROPERTY }))
      .rejects.toBeInstanceOf(HousekeepingDiscrepancyConflictError);
  });
});
