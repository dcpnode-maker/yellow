import { describe, expect, test } from "bun:test";

const app = Bun.file(new URL("../src/app.ts", import.meta.url));
const adapter = Bun.file(new URL("../src/http/operator.ts", import.meta.url));
const segments = Bun.file(new URL("../src/contexts/reservations/segments.ts", import.meta.url));
const client = Bun.file(new URL("../src/http/operator/operator.js", import.meta.url));
const capability = Bun.file(new URL(
  "../migrations/0033_governed_due_in_room_assignment.sql",
  import.meta.url,
));

describe("Order 231 intentional red: governed due-in room assignment", () => {
  test("the exact reservation-scoped candidate route exists", async () => {
    expect(await app.text()).toContain(
      "/api/v1/properties/:property/reservations/:reservation/due-in-room-assignment/candidates",
    );
  });

  test("the exact POST assignment route is bound to the operator adapter", async () => {
    const [appSource, adapterSource] = await Promise.all([app.text(), adapter.text()]);

    expect([
      appSource.includes(
        '.post("/api/v1/properties/:property/reservations/:reservation/due-in-room-assignment"',
      ),
      appSource.includes("operator.assignDueInRoom("),
      adapterSource.includes("async assignDueInRoom("),
    ]).toEqual([true, true, true]);
  });

  test("the governed segment methods and owner-mediated assignment capability exist", async () => {
    const [domainSource, capabilityExists] = await Promise.all([
      segments.text(),
      capability.exists(),
    ]);
    const capabilitySource = capabilityExists ? await capability.text() : "";

    expect([
      domainSource.includes("async findDueInRoomAssignmentCandidates("),
      domainSource.includes("async assignDueInRoom("),
      capabilitySource.includes("CREATE FUNCTION public.assign_due_in_room("),
    ]).toEqual([true, true, true]);
  });

  test("the exact room_assignment_missing blocker exposes its contextual action", async () => {
    const source = await client.text();

    expect([
      source.includes('blocker === "room_assignment_missing"'),
      source.includes("openDueInRoomAssignment"),
      source.includes("Assign room"),
    ]).toEqual([true, true, true]);
  });
});
