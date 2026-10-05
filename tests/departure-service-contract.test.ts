import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { normalizeDepartureServiceProposal, normalizeDepartureServiceAction } from "../src/contexts/stay-operations";

const id = "00000000-0000-0000-0000-000000059301";
const proposal = () => ({ serviceKind: "luggage_pickup", targetRoleId: id,
  schedule: { mode: "immediate", minutes: null, localAt: null, utcOffsetMinutes: null },
  expected: { segmentId: id, spaceId: id, departureAt: "2026-09-22T10:00:00.000Z" }, parentRequestId: null });
describe("departure-service strict command boundary", () => {
  test("migration refuses any predecessor other than the exact canonical frontier", () => {
    const migration = readFileSync(new URL("../migrations/0099_governed_departure_service_coordination.sql", import.meta.url), "utf8");
    expect(migration).toContain("count(*) FROM public.schema_migration) IS DISTINCT FROM 98::bigint");
    expect(migration).toContain("max(version) FROM public.schema_migration) IS DISTINCT FROM 98");
    expect(migration).toContain("requires canonical migration 98");
    expect(migration).toContain("CREATE POLICY tenant_isolation ON public.departure_service_request");
  });

  test("accepts immediate, bounded delay and explicit-offset local schedules", () => {
    expect(normalizeDepartureServiceProposal(proposal()).serviceKind).toBe("luggage_pickup");
    for (const minutes of [10,15,30,45]) expect(normalizeDepartureServiceProposal({ ...proposal(), schedule: {
      mode: "delay", minutes, localAt: null, utcOffsetMinutes: null,
    }}).schedule.minutes).toBe(minutes);
    expect(normalizeDepartureServiceProposal({ ...proposal(), schedule: {
      mode: "custom", minutes: null, localAt: "2026-09-22T15:00", utcOffsetMinutes: 330,
    }}).schedule.localAt).toBe("2026-09-22T15:00");
  });
  test("rejects free text, surplus authority, impossible action and schedule shapes", () => {
    for (const body of [{ ...proposal(), actorId: id }, { ...proposal(), serviceKind: "charge" },
      { ...proposal(), parentRequestId: id }, { ...proposal(), schedule: { mode: "delay", minutes: 5, localAt: null, utcOffsetMinutes: null } }]) {
      expect(() => normalizeDepartureServiceProposal(body)).toThrow();
    }
    expect(() => normalizeDepartureServiceAction("confirm", { expectedVersion: 1, staffPartyId: id, outcome: null })).toThrow();
    expect(() => normalizeDepartureServiceAction("complete", { expectedVersion: 1, staffPartyId: null, outcome: "damage confirmed" })).toThrow();
    expect(() => normalizeDepartureServiceAction("reopen", { expectedVersion: 1, staffPartyId: null, outcome: null })).toThrow();
    expect(normalizeDepartureServiceAction("assign", { expectedVersion: 2, staffPartyId: id, outcome: null }).staffPartyId).toBe(id);
  });
});
