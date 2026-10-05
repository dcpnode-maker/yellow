import { departureInstantFromLocal, propertyLocalMinute, sameRecordedInstant } from "./reservation-departure-change";

export type TravelMode = "flight" | "train" | "bus" | "car" | "ferry" | "other";
export type TravelTuple = Readonly<{ mode: string | null; carrier: string | null; serviceNo: string | null; scheduledAt: string | null; pickupRequested: boolean }>;
export type ArrivalTravel = Readonly<{ travelId: string; mode: string | null; carrier: string | null; serviceNo: string | null; scheduledAt: string | null; pickupRequested: boolean; pickupTaskId: string | null }>;
export type PickupTask = Readonly<{ taskId: string; reservationId: string; confirmationNo: string; status: "open" | "assigned" | "in_progress" | "done" | "verified" | "cancelled"; dueAt: string; priority: number; createdAt: string; completedAt: string | null; assigneePartyId: string | null; eligibleAction: "assign" | "start" | "complete" | null }>;
export type TaskAction = "assign" | "start" | "complete";
export type ArrivalAttempt = Readonly<{
  propertyId: string; reservationId: string; confirmationNo: string; kind: "travel" | "task";
  key: string; taskId: string | null; action: TaskAction | null;
  body: Readonly<Record<string, unknown>>;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: string, max: number): string | null => {
  const trimmed = value.trim();
  if (Array.from(trimmed).length > max) throw new Error(`Travel text must be at most ${max} characters.`);
  return trimmed || null;
};
export function arrivalDraftToTuple(draft: Readonly<{mode: TravelMode | ""; carrier: string; serviceNo: string; localTime: string; pickupRequested: boolean}>, timezone: string): TravelTuple {
  let scheduledAt: string | null = null;
  if (draft.localTime) {
    try { scheduledAt = departureInstantFromLocal(draft.localTime, timezone); }
    catch (cause) {
      if (cause instanceof Error) throw new Error(cause.message.replaceAll("departure", "arrival"));
      throw cause;
    }
  }
  const value: TravelTuple = {
    mode: draft.mode || null,
    carrier: text(draft.carrier, 120), serviceNo: text(draft.serviceNo, 64),
    scheduledAt,
    pickupRequested: draft.pickupRequested,
  };
  if (!value.mode && !value.carrier && !value.serviceNo && !value.scheduledAt && !value.pickupRequested) throw new Error("Record at least one travel detail or pickup intent.");
  return Object.freeze(value);
}
export function tupleFromTravel(travel: ArrivalTravel | null): TravelTuple | null {
  return travel ? Object.freeze({mode: travel.mode as TravelMode | null, carrier: travel.carrier, serviceNo: travel.serviceNo, scheduledAt: travel.scheduledAt, pickupRequested: travel.pickupRequested}) : null;
}
export function travelTupleMatches(left: TravelTuple | null, right: TravelTuple | null): boolean {
  if (!left || !right) return left === right;
  return left.mode === right.mode && left.carrier === right.carrier && left.serviceNo === right.serviceNo &&
    (left.scheduledAt === null || right.scheduledAt === null ? left.scheduledAt === right.scheduledAt : sameRecordedInstant(left.scheduledAt, right.scheduledAt)) &&
    left.pickupRequested === right.pickupRequested;
}
export function prepareTravelAttempt(propertyId: string, reservationId: string, confirmationNo: string, current: ArrivalTravel | null, proposed: TravelTuple, key: string): ArrivalAttempt {
  if (current?.pickupTaskId) throw new Error("Pickup task is already linked; travel changes are unavailable.");
  const expected = tupleFromTravel(current);
  if (travelTupleMatches(expected, proposed)) throw new Error("Choose a travel or pickup change before saving.");
  return Object.freeze({propertyId, reservationId, confirmationNo, kind: "travel", taskId: null, action: null, key, body: Object.freeze({expected, travel: proposed})});
}
export function prepareTaskAttempt(propertyId: string, reservationId: string, confirmationNo: string, task: PickupTask, staffPartyId: string | null, key: string): ArrivalAttempt {
  if (task.reservationId !== reservationId || task.confirmationNo !== confirmationNo) throw new Error("Pickup task does not match this reservation.");
  const action = task.eligibleAction;
  if (!action) throw new Error("No pickup task action is currently available.");
  let body: Readonly<Record<string, unknown>>;
  if (action === "assign") {
    if (task.status !== "open" || task.assigneePartyId !== null || !staffPartyId || !UUID.test(staffPartyId)) throw new Error("Select an active staff profile for this open pickup task.");
    body = {expectedTaskStatus: "open", expectedAssigneePartyId: null, staffPartyId};
  } else {
    if (task.status !== (action === "start" ? "assigned" : "in_progress") || !task.assigneePartyId || !UUID.test(task.assigneePartyId)) throw new Error("The pickup task state is no longer actionable.");
    body = {expectedTaskStatus: task.status, expectedAssigneePartyId: task.assigneePartyId};
  }
  return Object.freeze({propertyId, reservationId, confirmationNo, kind: "task", key, taskId: task.taskId, action, body: Object.freeze(body)});
}
export function attemptApplied(attempt: ArrivalAttempt, travel: ArrivalTravel | null, task: PickupTask | null): boolean {
  if (attempt.kind === "travel") return travelTupleMatches(tupleFromTravel(travel), attempt.body.travel as TravelTuple);
  if (!task || task.taskId !== attempt.taskId || task.reservationId !== attempt.reservationId || task.confirmationNo !== attempt.confirmationNo) return false;
  const target = attempt.action === "assign" ? "assigned" : attempt.action === "start" ? "in_progress" : "done";
  return task.status === target && task.assigneePartyId === (attempt.action === "assign" ? attempt.body.staffPartyId : attempt.body.expectedAssigneePartyId);
}
export function arrivalLocalMinute(travel: ArrivalTravel | null, timezone: string): string { return travel?.scheduledAt ? propertyLocalMinute(travel.scheduledAt, timezone) : ""; }
export function readArrivalAttempt(propertyId: string, reservationId: string): ArrivalAttempt | null {
  try {
    const raw = sessionStorage.getItem(`yellow-arrival-pickup:${propertyId}:${reservationId}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as ArrivalAttempt;
    const body = value.body as Record<string, unknown> | null;
    const exact = (candidate: unknown, keys: readonly string[]) => !!candidate && typeof candidate === "object" && !Array.isArray(candidate) && Object.keys(candidate).sort().join("|") === [...keys].sort().join("|");
    const tuple = (candidate: unknown) => {
      if (!exact(candidate, ["mode","carrier","serviceNo","scheduledAt","pickupRequested"])) return false;
      const item = candidate as TravelTuple;
      const boundedText = (value: unknown, max: number) => value === null || typeof value === "string" && value.trim() === value && value.length > 0 && Array.from(value).length <= max;
      const instant = item.scheduledAt === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(item.scheduledAt) && Number.isFinite(Date.parse(item.scheduledAt));
      return (item.mode === null || ["flight","train","bus","car","ferry","other"].includes(item.mode)) && boundedText(item.carrier,120) && boundedText(item.serviceNo,64) && instant && typeof item.pickupRequested === "boolean";
    };
    if (value.propertyId !== propertyId || value.reservationId !== reservationId || !UUID.test(value.key) ||
        typeof value.confirmationNo !== "string" || !value.confirmationNo.trim() || !body) return null;
    if (value.kind === "travel") return value.taskId === null && value.action === null && exact(body,["expected","travel"]) &&
      (body.expected === null || tuple(body.expected)) && tuple(body.travel) ? value : null;
    if (value.kind !== "task" || !value.taskId || !UUID.test(value.taskId)) return null;
    if (value.action === "assign") return exact(body,["expectedTaskStatus","expectedAssigneePartyId","staffPartyId"]) && body.expectedTaskStatus === "open" && body.expectedAssigneePartyId === null && typeof body.staffPartyId === "string" && UUID.test(body.staffPartyId) ? value : null;
    if (value.action === "start" || value.action === "complete") return exact(body,["expectedTaskStatus","expectedAssigneePartyId"]) && body.expectedTaskStatus === (value.action === "start" ? "assigned" : "in_progress") && typeof body.expectedAssigneePartyId === "string" && UUID.test(body.expectedAssigneePartyId) ? value : null;
    return null;
  } catch { return null; }
}
export function writeArrivalAttempt(attempt: ArrivalAttempt): void { sessionStorage.setItem(`yellow-arrival-pickup:${attempt.propertyId}:${attempt.reservationId}`, JSON.stringify(attempt)); }
export function clearArrivalAttempt(attempt: ArrivalAttempt): void { sessionStorage.removeItem(`yellow-arrival-pickup:${attempt.propertyId}:${attempt.reservationId}`); }
