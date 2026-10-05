import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";
import type { ReservationDetail } from "../frontend/yellow/src/yellow-api";
import {
  createRoomMoveClient, eligibleRoomMoveDestinations, emptyRoomMoveRead, frozenRoomMoveRetry,
  reconcileRoomMove, roomMoveCanClose, roomMoveCanSubmit, roomMoveFailureDisposition,
  roomMoveStatusAfterClose, runRoomMoveAttempt,
  validateRoomMoveHistory, validateRoomMoveInventory, validateRoomMoveReceipt,
  type RoomMoveAttempt, type RoomMoveHistory, type RoomMoveReceipt,
} from "../frontend/yellow/src/reservation-room-move";
import { ReservationRoomMove } from "../frontend/yellow/src/workspaces/ReservationRoomMove";

const property = "10000000-0000-0000-0000-000000000001";
const reservation = "10000000-0000-0000-0000-000000000002";
const oldSegment = "10000000-0000-0000-0000-000000000003";
const newSegment = "10000000-0000-0000-0000-000000000004";
const type = "10000000-0000-0000-0000-000000000005";
const sourceUnit = "10000000-0000-0000-0000-000000000006";
const destinationUnit = "10000000-0000-0000-0000-000000000007";
const sourceSpace = "10000000-0000-0000-0000-000000000008";
const destinationSpace = "10000000-0000-0000-0000-000000000009";
const start = "2026-09-25T08:00:00.000Z";
const moved = "2026-09-25T09:00:00.123Z";
const end = "2026-09-27T08:00:00.000Z";
const period = Object.freeze({ from: start, to: end });
const attempt: RoomMoveAttempt = Object.freeze({ propertyId: property, reservationId: reservation,
  confirmationNo: "Y-711", segmentId: oldSegment, segmentSequence: 1, segmentUnitTypeId: type,
  sourceSpaceId: sourceSpace, destinationSpaceId: destinationSpace,
  request: Object.freeze({ expectedSellableUnitId: sourceUnit, expectedPeriod: period, destinationSellableUnitId: destinationUnit }),
  key: "order711-exact-room-move-001" });
const receipt: RoomMoveReceipt = Object.freeze({ reservationId: reservation, oldSegmentId: oldSegment,
  newSegmentId: newSegment, oldSequence: 1, newSequence: 2, fromSellableUnitId: sourceUnit,
  toSellableUnitId: destinationUnit, fromSpaceId: sourceSpace, toSpaceId: destinationSpace, movedAt: moved,
  beforePeriod: period, departedPeriod: { from: start, to: moved }, activePeriod: { from: moved, to: end }, financialJournalId: null });
const segment = (id: string, sequence: number, status: string, sellableUnitId: string, from: string, to: string, canMoveRoom: boolean) => ({
  segmentId: id, sequence, status, unitTypeId: type, sellableUnitId, period: { from, to },
  actions: { canChangeDeparture: false, canMoveRoom },
});
const historyRaw = { reservationId: reservation, confirmationNo: "Y-711", status: "in_house",
  segments: [segment(oldSegment, 1, "departed", sourceUnit, start, moved, false), segment(newSegment, 2, "in_house", destinationUnit, moved, end, true)] };
const detail = { reservation: { reservationId: reservation, confirmationNo: "Y-711", segments: [
  { segmentId: oldSegment, sequence: 1, status: "departed", unitTypeId: type, sellableUnitId: sourceUnit, from: start, to: moved },
  { segmentId: newSegment, sequence: 2, status: "in_house", unitTypeId: type, sellableUnitId: destinationUnit, from: moved, to: end },
] } } as ReservationDetail;
const response = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const receiptBody = { segment: receipt };

test("validates strict exact reservation history, segment order and inventory shape", () => {
  expect(validateRoomMoveHistory({ reservationId: reservation, confirmationNo: "Y-711", status: "in_house", segments: [segment(oldSegment, 1, "in_house", sourceUnit, start, end, true)] }, reservation, "Y-711").segments[0]?.actions.canMoveRoom).toBe(true);
  expect(() => validateRoomMoveHistory({ reservationId: reservation, confirmationNo: "Y-711", status: "in_house", segments: [{ ...segment(oldSegment, 1, "in_house", sourceUnit, start, end, true), other: true }] }, reservation, "Y-711")).toThrow();
  expect(() => validateRoomMoveHistory({ ...historyRaw, segments: [segment(oldSegment, 2, "in_house", sourceUnit, start, end, true), segment(newSegment, 1, "in_house", destinationUnit, start, end, true)] }, reservation, "Y-711")).toThrow();
  const inventory = { unitTypes: [{ id: type, code: "STD", name: "Standard" }], spaces: [{ id: sourceSpace, code: "101", status: "active" }, { id: destinationSpace, code: "102", status: "active" }], sellableUnits: [
    { id: sourceUnit, tenantId: property, propertyNode: property, unitTypeId: type, unitTypeCode: "STD", name: "101", status: "active", spaces: [{ spaceId: sourceSpace, code: "101", claimMode: "exclusive" }] },
    { id: destinationUnit, tenantId: property, propertyNode: property, unitTypeId: type, unitTypeCode: "STD", name: "102", status: "active", spaces: [{ spaceId: destinationSpace, code: "102", claimMode: "exclusive" }] },
  ] };
  expect(validateRoomMoveInventory(inventory).sellableUnits[0]?.spaces[0]?.claimMode).toBe("exclusive");
  const checked = validateRoomMoveInventory(inventory);
  const current = validateRoomMoveHistory({ reservationId: reservation, confirmationNo: "Y-711", status: "in_house", segments: [segment(oldSegment, 1, "in_house", sourceUnit, start, end, true)] }, reservation, "Y-711").segments[0]!;
  expect(eligibleRoomMoveDestinations(checked, current).map(({ id }) => id)).toEqual([destinationUnit]);
  const inactiveDestination = validateRoomMoveInventory({ ...inventory, spaces: inventory.spaces.map((space) => space.id === destinationSpace ? { ...space, status: "inactive" } : space) });
  expect(eligibleRoomMoveDestinations(inactiveDestination, current)).toEqual([]);
  const composite = validateRoomMoveInventory({ ...inventory, sellableUnits: inventory.sellableUnits.map((unit) => unit.id === destinationUnit
    ? { ...unit, spaces: [{ spaceId: destinationSpace, code: "102", claimMode: "exclusive" as const }, { spaceId: sourceSpace, code: "101", claimMode: "exclusive" as const }] } : unit) });
  expect(eligibleRoomMoveDestinations(composite, current)).toEqual([]);
});

test("room move client uses only the canonical read, inventory and idempotent move endpoints", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createRoomMoveClient(async () => "safe-token", async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).includes("reservation-segments")) return response(200, { reservation: { reservationId: reservation, confirmationNo: "Y-711", status: "in_house", segments: [segment(oldSegment, 1, "in_house", sourceUnit, start, end, true)] } });
    if (String(url).endsWith("/inventory")) return response(200, { unitTypes: [], spaces: [], sellableUnits: [] });
    return response(200, receiptBody);
  });
  await client.historyExact(property, reservation, "Y-711"); await client.inventory(property); await client.move(attempt);
  expect(calls.map(({ url }) => url)).toEqual([
    `/api/v1/properties/${property}/reservation-segments?confirmationNo=Y-711`,
    `/api/v1/properties/${property}/inventory`,
    `/api/v1/properties/${property}/reservations/${reservation}/segments/${oldSegment}/move`,
  ]);
  expect(calls[2]?.init.method).toBe("POST");
  expect((calls[2]?.init.headers as Record<string, string>)?.["idempotency-key"]).toBe(attempt.key);
  expect(JSON.parse(String(calls[2]?.init.body))).toEqual(attempt.request);
});

test("receipt validation binds exact source, destination, sequence, same-type period split and no journal", () => {
  expect(validateRoomMoveReceipt(receipt, attempt)).toEqual(receipt);
  for (const invalid of [
    { ...receipt, fromSellableUnitId: destinationUnit }, { ...receipt, toSellableUnitId: sourceUnit },
    { ...receipt, oldSequence: 2, newSequence: 3 }, { ...receipt, fromSpaceId: destinationSpace },
    { ...receipt, departedPeriod: { from: start, to: end } }, { ...receipt, financialJournalId: property },
  ]) expect(() => validateRoomMoveReceipt(invalid, attempt)).toThrow();
});

test("reconciliation requires receipt-owned exact old and new segment evidence in both fresh reads", () => {
  const validHistory = validateRoomMoveHistory(historyRaw, reservation, "Y-711");
  expect(reconcileRoomMove(receipt, validHistory, detail, attempt)).toBe(true);
  const wrongDetail = { reservation: { ...detail.reservation, segments: detail.reservation.segments.map((row) => row.segmentId === newSegment ? { ...row, sellableUnitId: sourceUnit } : row) } } as ReservationDetail;
  expect(reconcileRoomMove(receipt, validHistory, wrongDetail, attempt)).toBe(false);
  expect(reconcileRoomMove(receipt, { ...validHistory, reservationId: property }, detail, attempt)).toBe(false);
});

test("403 and 409 are definite initially, 5xx and transport failure are uncertain, token error sends nothing", async () => {
  for (const status of [400, 401, 403, 409]) {
    const client = createRoomMoveClient(async () => "token", async () => response(status, {}));
    await expect(client.move(attempt)).rejects.toMatchObject({ status, uncertain: false });
  }
  const five = createRoomMoveClient(async () => "token", async () => response(503, {}));
  await expect(five.move(attempt)).rejects.toMatchObject({ status: 503, uncertain: true });
  for (const status of [408, 429]) {
    const timed = createRoomMoveClient(async () => "token", async () => response(status, {}));
    await expect(timed.move(attempt)).rejects.toMatchObject({ status, uncertain: true });
  }
  let calls = 0;
  const auth = createRoomMoveClient(async () => { throw new Error("secret token detail"); }, async () => { calls += 1; return response(200, {}); });
  await expect(auth.move(attempt)).rejects.toMatchObject({ status: 401, uncertain: false });
  expect(calls).toBe(0);
  const network = createRoomMoveClient(async () => "token", async () => { throw new Error("private network detail"); });
  await expect(network.move(attempt)).rejects.toMatchObject({ uncertain: true });
});

test("attempt readback confirms same-key uncertain replay and rejects stale identity before POST", async () => {
  let count = 0; const keys: string[] = [];
  const client = createRoomMoveClient(async () => "token", async (url, init) => {
    if (init?.method === "POST") { keys.push((init.headers as Record<string, string>)["idempotency-key"]!); count += 1; return response(200, receiptBody); }
    return response(200, { reservation: { ...historyRaw, segments: historyRaw.segments } });
  });
  const ok = await runRoomMoveAttempt({ client, attempt, isCurrent: () => true, refreshDetail: async () => detail });
  expect(ok.receipt.newSegmentId).toBe(newSegment); expect(keys).toEqual([attempt.key]);
  let stale = false;
  const noPost = createRoomMoveClient(async () => { stale = true; return "token"; }, async (_url, init) => { if (init?.method === "POST") count += 1; return response(200, receiptBody); });
  await expect(runRoomMoveAttempt({ client: noPost, attempt, isCurrent: () => !stale, refreshDetail: async () => detail })).rejects.toMatchObject({ uncertain: false });
  expect(count).toBe(1);
});

test("uncertain POST retry reuses the frozen key and post-success readback permission failures remain uncertain", async () => {
  let posts = 0; const keys: string[] = [];
  const client = createRoomMoveClient(async () => "token", async (url, init) => {
    if (init?.method === "POST") {
      posts += 1; keys.push((init.headers as Record<string, string>)["idempotency-key"]!);
      return posts === 1 ? response(503, {}) : response(200, receiptBody);
    }
    return response(200, { reservation: historyRaw });
  });
  await expect(runRoomMoveAttempt({ client, attempt, isCurrent: () => true, refreshDetail: async () => detail })).rejects.toMatchObject({ uncertain: true });
  const recovered = await runRoomMoveAttempt({ client, attempt, isCurrent: () => true, refreshDetail: async () => detail });
  expect(recovered.receipt.newSegmentId).toBe(newSegment);
  expect(keys).toEqual([attempt.key, attempt.key]);

  const readbackDenied = createRoomMoveClient(async () => "token", async (_url, init) =>
    init?.method === "POST" ? response(200, receiptBody) : response(403, {}));
  await expect(runRoomMoveAttempt({ client: readbackDenied, attempt, isCurrent: () => true, refreshDetail: async () => detail }))
    .rejects.toMatchObject({ uncertain: true });
});

test("used view-state transitions clear failed refresh data, preserve uncertain retry identity/lock, and reopen completed panel", () => {
  const initial = { confirmed: true, history: validateRoomMoveHistory({ reservationId: reservation, confirmationNo: "Y-711", status: "in_house", segments: [segment(oldSegment, 1, "in_house", sourceUnit, start, end, true)] }, reservation, "Y-711"),
    inventory: validateRoomMoveInventory({ unitTypes: [], spaces: [], sellableUnits: [] }), status: "idle" as const, destinationId: destinationUnit };
  expect(roomMoveCanSubmit(initial)).toBe(true);
  const cleared = emptyRoomMoveRead();
  expect(roomMoveCanSubmit({ ...initial, ...cleared })).toBe(false); // A denied refresh cannot leave stale selectable inventory.

  const failedFirst = roomMoveFailureDisposition(false, true);
  expect(failedFirst).toEqual({ retainAttempt: true, keepParentLock: true, nextStatus: "uncertain" });
  const sameAttempt = frozenRoomMoveRetry(failedFirst.nextStatus, attempt);
  const retryUnauthorized = roomMoveFailureDisposition(failedFirst.retainAttempt, false);
  expect(frozenRoomMoveRetry(retryUnauthorized.nextStatus, sameAttempt)).toBe(attempt);
  expect(retryUnauthorized).toEqual({ retainAttempt: true, keepParentLock: true, nextStatus: "uncertain" });

  expect(roomMoveCanClose("done", false)).toBe(true);
  expect(roomMoveStatusAfterClose("done")).toBe("idle"); // Reopening begins a fresh lookup and can create a new attempt.
  expect(roomMoveCanClose("uncertain", false)).toBe(false);
  expect(frozenRoomMoveRetry("idle", attempt)).toBeNull();
});

test("rendered workbench requires explicit accessible move confirmation and exposes no readiness or finance control", async () => {
  const html = renderToStaticMarkup(createElement(ReservationRoomMove, {
    propertyId: property, reservationId: reservation, confirmationNo: "Y-711", getToken: async () => "token",
    timezone: "UTC", otherMutationBusy: false, onLockChange() {}, onRefreshDetail: async () => detail,
  }));
  expect(html).toContain("Move room");
  expect(html).not.toContain("name=\"confirmed\"");
  const component = Bun.file("frontend/yellow/src/workspaces/ReservationRoomMove.tsx");
  const source = await component.text();
  expect(source).toContain("frozenRoomMoveRetry(status, attempt.current)");
  expect(source).toContain("callbacks.current.onLockChange(true); // Synchronously lock parent actions before the first await.");
  expect(source).toContain("roomMoveFailureDisposition(preservingUnknownOutcome,");
  expect(source).toContain('data-lifecycle-recovery={status === "posting" || status === "uncertain" ? "true" : undefined}');
  expect(source).toContain("const cleared = emptyRoomMoveRead();");
  expect(source).toContain("setStatus((previous) => roomMoveStatusAfterClose(previous));");
  expect(source).toContain("unitTypeId === latest.unitTypeId");
  expect(source).not.toContain("useEffect(() => {\n    void execute");
});
