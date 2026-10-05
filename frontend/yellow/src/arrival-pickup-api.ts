import { session } from "./yellow-api";
import type { ArrivalAttempt, PickupTask } from "./arrival-pickup";

export class ArrivalPickupRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean, readonly status = 0) { super(message); this.name = "ArrivalPickupRequestError"; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function send(path: string, method: "GET" | "PUT" | "POST", attempt?: ArrivalAttempt): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { authorization: `Bearer ${await session()}`, ...(attempt ? {"content-type":"application/json", "idempotency-key":attempt.key} : {}) },
      ...(attempt ? {body: JSON.stringify(attempt.body)} : {}),
    });
  } catch (cause) {
    throw new ArrivalPickupRequestError(cause instanceof Error ? cause.message : "The network result is unknown.", method !== "GET");
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as {detail?: string; title?: string};
    throw new ArrivalPickupRequestError(problem.detail ?? problem.title ?? "The pickup request failed.", method !== "GET" && (response.status >= 500 || response.status === 408 || response.status === 429), response.status);
  }
  try { return await response.json(); }
  catch { throw new ArrivalPickupRequestError("The server response could not be verified.", method !== "GET", response.status); }
}

export async function putArrivalTravel(attempt: ArrivalAttempt): Promise<void> {
  if (attempt.kind !== "travel") throw new Error("Expected an arrival travel attempt.");
  const value = await send(`/api/v1/properties/${attempt.propertyId}/reservations/${attempt.reservationId}/travel/arrival`, "PUT", attempt) as {travel?: {reservationId?: string; direction?: string; travel?: unknown}};
  if (value.travel?.reservationId !== attempt.reservationId || value.travel.direction !== "arrival" || !value.travel.travel) throw new ArrivalPickupRequestError("The travel receipt did not match this reservation.", true);
}

export async function loadArrivalPickupTask(propertyId: string, reservationId: string, taskId: string): Promise<PickupTask> {
  const value = await send(`/api/v1/properties/${propertyId}/reservations/${reservationId}/arrival-pickup-task/${taskId}`, "GET") as {pickupTask?: PickupTask};
  const task = value.pickupTask;
  const required = ["taskId","reservationId","confirmationNo","status","dueAt","priority","createdAt","completedAt","assigneePartyId","eligibleAction"];
  const expectedAction = task?.status === "open" && task.assigneePartyId === null ? "assign" :
    task?.status === "assigned" && task.assigneePartyId ? "start" :
    task?.status === "in_progress" && task.assigneePartyId ? "complete" : null;
  if (!task || task.taskId !== taskId || task.reservationId !== reservationId || typeof task.confirmationNo !== "string" ||
      Object.keys(task).sort().join("|") !== required.sort().join("|") ||
      !["open","assigned","in_progress","done","verified","cancelled"].includes(task.status) ||
      task.eligibleAction !== expectedAction ||
      (task.assigneePartyId !== null && (typeof task.assigneePartyId !== "string" || !UUID.test(task.assigneePartyId))) ||
      !Number.isFinite(task.priority) || typeof task.dueAt !== "string" || !Number.isFinite(Date.parse(task.dueAt)) ||
      typeof task.createdAt !== "string" || !Number.isFinite(Date.parse(task.createdAt)) ||
      (task.completedAt !== null && (typeof task.completedAt !== "string" || !Number.isFinite(Date.parse(task.completedAt))))) throw new Error("Linked pickup task evidence is incoherent.");
  return task;
}

export async function transitionArrivalPickupTask(attempt: ArrivalAttempt): Promise<void> {
  if (attempt.kind !== "task" || !attempt.taskId || !attempt.action) throw new Error("Expected a linked pickup task attempt.");
  const value = await send(`/api/v1/properties/${attempt.propertyId}/reservations/${attempt.reservationId}/arrival-pickup-task/${attempt.taskId}/${attempt.action}`, "POST", attempt) as {taskId?: string; reservationId?: string; taskStatus?: string};
  if (value.taskId !== attempt.taskId || value.reservationId !== attempt.reservationId || !value.taskStatus) throw new ArrivalPickupRequestError("The pickup task receipt did not match this reservation.", true);
}
