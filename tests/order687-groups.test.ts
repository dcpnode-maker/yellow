import { describe, expect, test } from "bun:test";
import { createAuditEnvelope, type EventBus, type PostgresIdempotency, type Tx } from "../src/kernel";
import {
  GroupReservationConflictError, GroupReservationService, GroupReservationValidationError, groupName,
} from "../src/contexts/reservations";

const tenantId = "00000000-0000-0000-0000-000000068701";
const propertyNode = "00000000-0000-0000-0000-000000068702";
const actorId = "00000000-0000-0000-0000-000000068703";
const requestId = "00000000-0000-0000-0000-000000068704";
const groupId = "00000000-0000-0000-0000-000000068705";
const reservationId = "00000000-0000-0000-0000-000000068706";
const envelope = (operation: string) => createAuditEnvelope({ tenantId, propertyNode, actorId, requestId, operation });

function fixture(rows: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const tx = ((strings: TemplateStringsArray) => {
    const sql = strings.join("?"); calls.push(sql);
    if (sql.includes("INSERT INTO api_idempotency")) return Promise.resolve([{ claimed: true }]);
    if (sql.includes("INSERT INTO reservation_group")) return Promise.resolve([{ id: groupId,
      kind: "linked", code: `GRP-${groupId.replaceAll("-", "").toUpperCase()}`, name: "Patel party",
      status: "tentative", member_count: 0 }]);
    if (sql.includes("FROM reservation_group") && sql.includes("kind = 'linked'")) return Promise.resolve([{ id: groupId }]);
    if (sql.includes("FROM reservation WHERE") && sql.includes("FOR UPDATE")) return Promise.resolve([{ id: reservationId, status: "reserved", group_id: null, ...rows }]);
    if (sql.includes("UPDATE reservation SET group_id")) return Promise.resolve([{ id: reservationId }]);
    if (sql.includes("INSERT INTO fact_log")) return Promise.resolve([{ id: requestId, tenant_id: tenantId,
      entity_type: "reservation", entity_id: reservationId, fact_type: "reservation.group_linked",
      valid_from: new Date(), recorded_at: new Date(), business_date: "2026-09-24", actor_id: actorId,
      payload: {}, supersedes: null }]);
    return Promise.resolve([]);
  }) as unknown as Tx;
  const events = { async publish() { calls.push("PUBLISH"); return {} as never; } } as unknown as EventBus;
  const idempotency = { async execute(_tx: Tx, _input: unknown, command: (tx: Tx) => Promise<unknown>) {
    const result = await command(tx) as { body: object }; return { ...result, replayed: false };
  } } as PostgresIdempotency;
  return { service: new GroupReservationService({ events, idempotency, idFactory: () => groupId }), tx, calls };
}

describe("Order687 linked group command boundary", () => {
  test("name normalization rejects empty/control/overlong values", () => {
    expect(groupName("  Patel party  ")).toBe("Patel party");
    expect(() => groupName(" ")).toThrow(GroupReservationValidationError);
    expect(() => groupName("Patel\u0000party")).toThrow(GroupReservationValidationError);
    expect(() => groupName("a".repeat(121))).toThrow(GroupReservationValidationError);
  });
  test("create persists linked group with generated code then fact/event inside idempotent command", async () => {
    const f = fixture();
    const result = await f.service.create(f.tx, { name: "Patel party", idempotencyKey: "order687-create-key", envelope: envelope("group.created") });
    expect(result.group).toMatchObject({ groupId, kind: "linked", memberCount: 0, roomsHeldByGroup: false });
    expect(f.calls.find((sql) => sql.includes("INSERT INTO reservation_group"))).toContain("'linked'");
    expect(f.calls.find((sql) => sql.includes("INSERT INTO reservation_group"))).not.toContain("block_allotment");
    expect(f.calls.some((sql) => sql.includes("INSERT INTO fact_log"))).toBe(true);
    expect(f.calls.at(-1)).toBe("PUBLISH");
  });
  test("attach CAS requires empty membership and writes fact/event, without occupancy or journal SQL", async () => {
    const f = fixture();
    const result = await f.service.attach(f.tx, { groupId, reservationId, expectedGroupId: null,
      idempotencyKey: "order687-attach-key", envelope: envelope("reservation.group_linked") });
    expect(result).toMatchObject({ groupId, reservationId, changed: true });
    expect(f.calls.find((sql) => sql.includes("UPDATE reservation SET group_id"))).toContain("group_id IS NULL");
    expect(f.calls.some((sql) => /occupancy|journal|block_allotment/i.test(sql))).toBe(false);
    expect(f.calls.at(-1)).toBe("PUBLISH");
  });
  test("already-grouped and checked-in reservations fail before update", async () => {
    for (const row of [{ group_id: groupId }, { status: "in_house" }]) {
      const f = fixture(row);
      await expect(f.service.attach(f.tx, { groupId, reservationId, expectedGroupId: null,
        idempotencyKey: "order687-attach-key", envelope: envelope("reservation.group_linked") })).rejects.toThrow(GroupReservationConflictError);
      expect(f.calls.some((sql) => sql.includes("UPDATE reservation SET group_id"))).toBe(false);
    }
  });
  test("read-only group search validates query before SQL and parameterizes literal matching", async () => {
    const f = fixture();
    for (const query of ["x", " ", "a\u0000b", "Needle\n", "x".repeat(101)]) {
      await expect(f.service.list(f.tx, { tenantId, propertyNode, limit: 50, cursor: null, query }))
        .rejects.toThrow(GroupReservationValidationError);
    }
    expect(f.calls).toEqual([]);
    await f.service.list(f.tx, { tenantId, propertyNode, limit: 50, cursor: null, query: "%_" });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toContain("strpos(lower(g.name), lower(?::text))");
    expect(f.calls[0]).not.toContain("%_");
  });
});
