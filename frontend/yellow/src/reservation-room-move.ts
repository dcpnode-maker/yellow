import type { ReservationDetail } from "./yellow-api";

export type RoomMovePeriod = Readonly<{ from: string; to: string }>;
export type RoomMoveSegment = Readonly<{
  segmentId: string; sequence: number; status: string; unitTypeId: string;
  sellableUnitId: string | null; period: RoomMovePeriod;
  actions: Readonly<{ canChangeDeparture: boolean; canMoveRoom: boolean }>;
}>;
export type RoomMoveHistory = Readonly<{
  reservationId: string; confirmationNo: string; status: string; segments: readonly RoomMoveSegment[];
}>;
export type RoomMoveInventory = Readonly<{
  unitTypes: readonly Readonly<{ id: string; code: string; name: string }>[];
  spaces: readonly Readonly<{ id: string; code: string; status: string }>[];
  sellableUnits: readonly Readonly<{
    id: string; unitTypeId: string; unitTypeCode: string; name: string; status: string;
    spaces: readonly Readonly<{ spaceId: string; code: string; claimMode: "exclusive" | "positional" }>[];
  }>[];
}>;
export type RoomMoveRequest = Readonly<{
  expectedSellableUnitId: string;
  expectedPeriod: RoomMovePeriod;
  destinationSellableUnitId: string;
}>;
export type RoomMoveReceipt = Readonly<{
  reservationId: string; oldSegmentId: string; newSegmentId: string;
  oldSequence: number; newSequence: number;
  fromSellableUnitId: string; toSellableUnitId: string;
  fromSpaceId: string; toSpaceId: string; movedAt: string;
  beforePeriod: RoomMovePeriod; departedPeriod: RoomMovePeriod; activePeriod: RoomMovePeriod;
  financialJournalId: null;
}>;
export type RoomMoveAttempt = Readonly<{
  propertyId: string; reservationId: string; confirmationNo: string;
  segmentId: string; segmentSequence: number; segmentUnitTypeId: string;
  sourceSpaceId: string; destinationSpaceId: string; request: RoomMoveRequest; key: string;
}>;
export type RoomMoveViewStatus = "idle" | "posting" | "uncertain" | "done";

export function frozenRoomMoveRetry(status: RoomMoveViewStatus, attempt: RoomMoveAttempt | null): RoomMoveAttempt | null {
  return status === "uncertain" ? attempt : null;
}
export function roomMoveFailureDisposition(wasUncertain: boolean, requestUncertain: boolean) {
  const retain = wasUncertain || requestUncertain;
  return Object.freeze({ retainAttempt: retain, keepParentLock: retain, nextStatus: retain ? "uncertain" as const : "idle" as const });
}
export function roomMoveStatusAfterClose(status: RoomMoveViewStatus): RoomMoveViewStatus {
  return status === "done" ? "idle" : status;
}
export function roomMoveCanClose(status: RoomMoveViewStatus, loading: boolean): boolean {
  return !loading && status !== "posting" && status !== "uncertain";
}
export function emptyRoomMoveRead(): Readonly<{ history: null; inventory: null; destinationId: ""; confirmed: false }> {
  return Object.freeze({ history: null, inventory: null, destinationId: "", confirmed: false });
}
export function roomMoveCanSubmit(input: Readonly<{ confirmed: boolean; history: RoomMoveHistory | null; inventory: RoomMoveInventory | null; status: RoomMoveViewStatus; destinationId: string }>): boolean {
  return input.confirmed && input.status === "idle" && input.history !== null && input.inventory !== null && input.destinationId.length > 0;
}

type Fetcher = typeof fetch;
type Token = () => Promise<string>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const offsetInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const keys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validPeriod = (value: unknown): value is RoomMovePeriod => isObject(value) &&
  keys(value, ["from", "to"]) && typeof value.from === "string" && offsetInstant.test(value.from) && Number.isFinite(Date.parse(value.from)) &&
  typeof value.to === "string" && offsetInstant.test(value.to) && Number.isFinite(Date.parse(value.to)) && Date.parse(value.from) < Date.parse(value.to);
const exactInstant = (left: string, right: string) => Date.parse(left) === Date.parse(right);
const safeMessage = (status: number) => status === 403
  ? "Room move access is not granted for this property or action. Contact an authorized administrator."
  : status === 409
    ? "The stay or destination changed. Refresh current stay and room configuration before a new move."
    : status >= 500
      ? "The room-move result is uncertain. Keep this exact request and retry it with its original key."
      : "The room-move request was not accepted. Review access and current stay details.";

export class RoomMoveRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean, readonly status?: number) {
    super(message); this.name = "RoomMoveRequestError";
  }
}

export function validateRoomMoveHistory(value: unknown, reservationId: string, confirmationNo: string): RoomMoveHistory {
  if (!isObject(value) || !keys(value, ["reservationId", "confirmationNo", "status", "segments"]) ||
      value.reservationId !== reservationId || value.confirmationNo !== confirmationNo ||
      typeof value.status !== "string" || !Array.isArray(value.segments) || value.segments.length === 0 || value.segments.length > 100) {
    throw new Error("Stay segment history did not match the opened reservation.");
  }
  const segments = value.segments.map((item) => {
    if (!isObject(item) || !keys(item, ["segmentId", "sequence", "status", "unitTypeId", "sellableUnitId", "period", "actions"]) ||
        typeof item.segmentId !== "string" || !uuid.test(item.segmentId) || !Number.isSafeInteger(item.sequence) ||
        typeof item.status !== "string" || typeof item.unitTypeId !== "string" || !uuid.test(item.unitTypeId) ||
        !(item.sellableUnitId === null || (typeof item.sellableUnitId === "string" && uuid.test(item.sellableUnitId))) ||
        !isObject(item.actions) || !keys(item.actions, ["canChangeDeparture", "canMoveRoom"]) ||
        typeof item.actions.canChangeDeparture !== "boolean" || typeof item.actions.canMoveRoom !== "boolean" || !validPeriod(item.period)) {
      throw new Error("Stay segment history contains invalid room-move evidence.");
    }
    return item as unknown as RoomMoveSegment;
  });
  if (segments[0]?.sequence !== 1) throw new Error("Stay segment history does not start at its original sequence.");
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index]!.sequence !== segments[index - 1]!.sequence + 1) throw new Error("Stay segment sequence is not continuous.");
  }
  return Object.freeze({ reservationId, confirmationNo, status: value.status, segments: Object.freeze(segments) });
}

export function validateRoomMoveInventory(value: unknown): RoomMoveInventory {
  if (!isObject(value) || !keys(value, ["unitTypes", "spaces", "sellableUnits"]) ||
      !Array.isArray(value.unitTypes) || !Array.isArray(value.spaces) || !Array.isArray(value.sellableUnits) || value.sellableUnits.length > 5000) {
    throw new Error("Room configuration is unavailable or malformed.");
  }
  const unitTypes = value.unitTypes.map((row) => {
    if (!isObject(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.code !== "string" || typeof row.name !== "string") throw new Error("Room configuration is malformed.");
    return Object.freeze({ id: row.id, code: row.code, name: row.name });
  });
  const spaces = value.spaces.map((row) => {
    if (!isObject(row) || typeof row.id !== "string" || !uuid.test(row.id) || typeof row.code !== "string" || typeof row.status !== "string") throw new Error("Room configuration is malformed.");
    return Object.freeze({ id: row.id, code: row.code, status: row.status });
  });
  const sellableUnits = value.sellableUnits.map((row) => {
    if (!isObject(row) || !keys(row, ["id", "tenantId", "propertyNode", "unitTypeId", "unitTypeCode", "name", "status", "spaces"]) ||
        typeof row.id !== "string" || !uuid.test(row.id) || typeof row.unitTypeId !== "string" || !uuid.test(row.unitTypeId) ||
        typeof row.unitTypeCode !== "string" || typeof row.name !== "string" || typeof row.status !== "string" || !Array.isArray(row.spaces)) throw new Error("Room configuration is malformed.");
    const claims = row.spaces.map((claim) => {
      if (!isObject(claim) || typeof claim.spaceId !== "string" || !uuid.test(claim.spaceId) || typeof claim.code !== "string" ||
          (claim.claimMode !== "exclusive" && claim.claimMode !== "positional")) throw new Error("Room configuration is malformed.");
      return Object.freeze({ spaceId: claim.spaceId, code: claim.code, claimMode: claim.claimMode });
    });
    return Object.freeze({ id: row.id, unitTypeId: row.unitTypeId, unitTypeCode: row.unitTypeCode, name: row.name, status: row.status, spaces: Object.freeze(claims) });
  });
  return Object.freeze({ unitTypes: Object.freeze(unitTypes), spaces: Object.freeze(spaces), sellableUnits: Object.freeze(sellableUnits) });
}

export function eligibleRoomMoveDestinations(inventory: RoomMoveInventory, latest: RoomMoveSegment): readonly RoomMoveInventory["sellableUnits"][number][] {
  const source = inventory.sellableUnits.find((unit) => unit.id === latest.sellableUnitId);
  const sourceClaim = source?.spaces.length === 1 && source.spaces[0]?.claimMode === "exclusive" ? source.spaces[0] : null;
  if (!sourceClaim || !latest.actions.canMoveRoom || latest.status !== "in_house") return [];
  return inventory.sellableUnits.filter((unit) => unit.status === "active" && unit.unitTypeId === latest.unitTypeId &&
    unit.id !== latest.sellableUnitId && unit.spaces.length === 1 && unit.spaces[0]?.claimMode === "exclusive" &&
    unit.spaces[0].spaceId !== sourceClaim.spaceId &&
    inventory.spaces.some((space) => space.id === unit.spaces[0]!.spaceId && space.status === "active"));
}

export function validateRoomMoveReceipt(value: unknown, attempt: RoomMoveAttempt): RoomMoveReceipt {
  if (!isObject(value) || !keys(value, ["reservationId", "oldSegmentId", "newSegmentId", "oldSequence", "newSequence", "fromSellableUnitId", "toSellableUnitId", "fromSpaceId", "toSpaceId", "movedAt", "beforePeriod", "departedPeriod", "activePeriod", "financialJournalId"]) ||
      value.reservationId !== attempt.reservationId || value.oldSegmentId !== attempt.segmentId ||
      typeof value.newSegmentId !== "string" || !uuid.test(value.newSegmentId) || value.newSegmentId === value.oldSegmentId ||
      value.oldSequence !== attempt.segmentSequence || !Number.isSafeInteger(value.oldSequence) ||
      value.newSequence !== (value.oldSequence as number) + 1 ||
      value.fromSellableUnitId !== attempt.request.expectedSellableUnitId || value.toSellableUnitId !== attempt.request.destinationSellableUnitId ||
      typeof value.fromSpaceId !== "string" || !uuid.test(value.fromSpaceId) || value.fromSpaceId !== attempt.sourceSpaceId ||
      typeof value.toSpaceId !== "string" || !uuid.test(value.toSpaceId) || value.toSpaceId !== attempt.destinationSpaceId || value.fromSpaceId === value.toSpaceId ||
      typeof value.movedAt !== "string" || !offsetInstant.test(value.movedAt) || !Number.isFinite(Date.parse(value.movedAt)) ||
      !validPeriod(value.beforePeriod) || !validPeriod(value.departedPeriod) || !validPeriod(value.activePeriod) || value.financialJournalId !== null) {
    throw new RoomMoveRequestError("The room-move receipt was incomplete or did not match the frozen request. Retry the exact request to reconcile it.", true);
  }
  const expected = attempt.request.expectedPeriod;
  const instant = Date.parse(value.movedAt as string);
  if (!exactPeriod(value.beforePeriod as RoomMovePeriod, expected) || instant <= Date.parse(expected.from) || instant >= Date.parse(expected.to) ||
      !exactPeriod(value.departedPeriod as RoomMovePeriod, { from: expected.from, to: value.movedAt as string }) ||
      !exactPeriod(value.activePeriod as RoomMovePeriod, { from: value.movedAt as string, to: expected.to })) {
    throw new RoomMoveRequestError("The room-move receipt periods did not match the frozen request. Retry the exact request to reconcile it.", true);
  }
  return value as unknown as RoomMoveReceipt;
}
function exactPeriod(left: RoomMovePeriod, right: RoomMovePeriod) { return exactInstant(left.from, right.from) && exactInstant(left.to, right.to); }

export function createRoomMoveClient(getToken: Token, fetcher: Fetcher = fetch) {
  const headers = async () => {
    let token: string;
    try { token = await getToken(); } catch { throw new RoomMoveRequestError("Your session could not be verified. Sign in again before continuing.", false, 401); }
    if (!token || typeof token !== "string") throw new RoomMoveRequestError("Your session could not be verified. Sign in again before continuing.", false, 401);
    return { authorization: `Bearer ${token}` };
  };
  const request = async (url: string, init: RequestInit = {}, isCurrent: () => boolean = () => true) => {
    if (!isCurrent()) throw new RoomMoveRequestError("This reservation or property is no longer active. No request was sent.", false);
    const auth = await headers();
    if (!isCurrent()) throw new RoomMoveRequestError("This reservation or property is no longer active. No request was sent.", false);
    let response: Response;
    try { response = await fetcher(url, { ...init, headers: { ...auth, ...(init.headers as Record<string, string> | undefined) }, cache: "no-store" }); }
    catch { throw new RoomMoveRequestError("The room-move request could not be confirmed because the connection was interrupted.", init.method === "POST"); }
    if (!response.ok || response.status !== 200) throw new RoomMoveRequestError(safeMessage(response.status),
      response.status >= 500 || (init.method === "POST" && (response.status === 408 || response.status === 429 || (response.status >= 200 && response.status < 300))), response.status);
    try { return await response.json() as unknown; }
    catch { throw new RoomMoveRequestError("The server response could not be verified. Retry the exact request to reconcile it.", init.method === "POST"); }
  };
  return Object.freeze({
    async historyExact(propertyId: string, reservationId: string, confirmationNo: string, isCurrent: () => boolean = () => true) {
      const data = await request(`/api/v1/properties/${propertyId}/reservation-segments?${new URLSearchParams({ confirmationNo })}`, {}, isCurrent);
      if (!isObject(data) || !isObject(data.reservation)) throw new Error("Stay segment history is unavailable.");
      return validateRoomMoveHistory(data.reservation, reservationId, confirmationNo);
    },
    async inventory(propertyId: string, isCurrent: () => boolean = () => true) { return validateRoomMoveInventory(await request(`/api/v1/properties/${propertyId}/inventory`, {}, isCurrent)); },
    async move(attempt: RoomMoveAttempt, isCurrent: () => boolean = () => true) {
      const data = await request(`/api/v1/properties/${attempt.propertyId}/reservations/${attempt.reservationId}/segments/${attempt.segmentId}/move`, {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": attempt.key }, body: JSON.stringify(attempt.request),
      }, isCurrent);
      if (!isObject(data) || !Object.hasOwn(data, "segment")) throw new RoomMoveRequestError("The room-move receipt was incomplete. Retry the exact request to reconcile it.", true);
      return validateRoomMoveReceipt(data.segment, attempt);
    },
  });
}

export function reconcileRoomMove(receipt: RoomMoveReceipt, history: RoomMoveHistory, detail: ReservationDetail, attempt: RoomMoveAttempt): boolean {
  if (history.reservationId !== attempt.reservationId || history.confirmationNo !== attempt.confirmationNo ||
      detail.reservation.reservationId !== attempt.reservationId || detail.reservation.confirmationNo !== attempt.confirmationNo) return false;
  const old = history.segments.find((segment) => segment.segmentId === receipt.oldSegmentId);
  const next = history.segments.find((segment) => segment.segmentId === receipt.newSegmentId);
  const oldDetail = detail.reservation.segments.find((segment) => segment.segmentId === receipt.oldSegmentId);
  const newDetail = detail.reservation.segments.find((segment) => segment.segmentId === receipt.newSegmentId);
  const oldOk = old?.status === "departed" && old.sequence === receipt.oldSequence && old.unitTypeId === next?.unitTypeId &&
    old.sellableUnitId === attempt.request.expectedSellableUnitId && exactPeriod(old.period, receipt.departedPeriod);
  const newOk = next?.status === "in_house" && next.sequence === receipt.newSequence && next.sequence === receipt.oldSequence + 1 &&
    next.unitTypeId === attempt.segmentUnitTypeId && old?.unitTypeId === attempt.segmentUnitTypeId &&
    next.sellableUnitId === attempt.request.destinationSellableUnitId && exactPeriod(next.period, receipt.activePeriod) &&
    history.segments.at(-1)?.segmentId === receipt.newSegmentId;
  return Boolean(oldOk && newOk && oldDetail?.status === "departed" && oldDetail.sequence === receipt.oldSequence &&
    oldDetail.unitTypeId === attempt.segmentUnitTypeId && oldDetail.sellableUnitId === attempt.request.expectedSellableUnitId &&
    exactInstant(oldDetail.from, receipt.departedPeriod.from) && exactInstant(oldDetail.to, receipt.departedPeriod.to) &&
    newDetail?.status === "in_house" && newDetail.sequence === receipt.newSequence && newDetail.unitTypeId === attempt.segmentUnitTypeId &&
    detail.reservation.segments.at(-1)?.segmentId === receipt.newSegmentId &&
    newDetail.sellableUnitId === attempt.request.destinationSellableUnitId && exactInstant(newDetail.from, receipt.activePeriod.from) &&
    exactInstant(newDetail.to, receipt.activePeriod.to));
}

export async function runRoomMoveAttempt(input: {
  client: ReturnType<typeof createRoomMoveClient>; attempt: RoomMoveAttempt;
  isCurrent: () => boolean; refreshDetail: () => Promise<ReservationDetail>;
}): Promise<Readonly<{ receipt: RoomMoveReceipt; history: RoomMoveHistory; detail: ReservationDetail }>> {
  const { client, attempt, isCurrent } = input;
  if (!isCurrent()) throw new RoomMoveRequestError("This reservation or property is no longer active. No room move was submitted.", false);
  const receipt = await client.move(attempt, isCurrent);
  if (!isCurrent()) throw new RoomMoveRequestError("The room-move response belongs to an inactive reservation. Keep this request key for reconciliation.", true);
  let history: RoomMoveHistory; let detail: ReservationDetail;
  try {
    [history, detail] = await Promise.all([
      client.historyExact(attempt.propertyId, attempt.reservationId, attempt.confirmationNo, isCurrent), input.refreshDetail(),
    ]);
  } catch {
    throw new RoomMoveRequestError("The room-move receipt was received, but fresh stay readback failed. Keep the original request key and retry to reconcile.", true);
  }
  if (!isCurrent()) throw new RoomMoveRequestError("Stay readback completed for an inactive reservation. Keep this request key for reconciliation.", true);
  if (!reconcileRoomMove(receipt, history, detail, attempt)) throw new RoomMoveRequestError("The refreshed stay and segment history do not yet agree with the move receipt. Retry the exact request to reconcile it.", true);
  return Object.freeze({ receipt, history, detail });
}
