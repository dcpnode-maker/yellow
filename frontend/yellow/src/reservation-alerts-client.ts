import type { ReservationDetail } from "./yellow-api";

export type ReservationAlert = ReservationDetail["reservation"]["alerts"][number];
export type ReservationAlertShowOn = "checkin" | "checkout" | "always";
export type ReservationAlertDraft = Readonly<{ code: string; message: string; showOn: ReservationAlertShowOn }>;
export type CreateReservationAlertBody = Readonly<{ code: string | null; message: string; showOn: ReservationAlertShowOn }>;

export type ReservationAlertAttempt = Readonly<{
  operation: "create";
  propertyId: string;
  reservationId: string;
  confirmationNo: string;
  body: CreateReservationAlertBody;
  key: string;
}> | Readonly<{
  operation: "deactivate";
  propertyId: string;
  reservationId: string;
  confirmationNo: string;
  alert: ReservationAlert;
  key: string;
}>;

export type ReservationAlertReceipt = Readonly<{
  id: string;
  code: string | null;
  message: string;
  showOn: ReservationAlertShowOn;
  active: boolean;
  changed: boolean;
  replayed: boolean;
}>;

export type ReservationAlertFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHOW_ON = new Set<ReservationAlertShowOn>(["checkin", "checkout", "always"]);
const ownKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class ReservationAlertRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean, readonly status?: number) {
    super(message);
    this.name = "ReservationAlertRequestError";
  }
}

const safeStatusMessage = (status: number) => status === 401 || status === 403
  ? "Alert changes are not authorized for this session or property. Verify access before trying again."
  : status === 409
    ? "The alert or reservation changed. Refresh the reservation before starting a new alert action."
    : status >= 500
      ? "Yellow could not confirm the alert request. Keep this exact request and reconcile it."
      : "The alert request was not accepted. Review the reservation and try again.";

export function normalizeReservationAlertDraft(draft: ReservationAlertDraft): CreateReservationAlertBody | null {
  const message = draft.message.trim();
  const code = draft.code.trim();
  const codePoints = Array.from(code).length;
  const messagePoints = Array.from(message).length;
  if (!message || messagePoints > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(message) ||
      codePoints > 64 || /[\u0000-\u001f\u007f-\u009f]/u.test(code) || !SHOW_ON.has(draft.showOn)) return null;
  return Object.freeze({ code: code || null, message, showOn: draft.showOn });
}

export function prepareCreateAlertAttemptFromBody(input: Readonly<{
  propertyId: string;
  reservationId: string;
  confirmationNo: string;
  body: CreateReservationAlertBody;
  key: string;
}>): ReservationAlertAttempt | null {
  const body = input.body;
  const normalized = typeof body?.message === "string" &&
    normalizeReservationAlertDraft({ code: body.code ?? "", message: body.message, showOn: body.showOn });
  if (!UUID.test(input.propertyId) || !UUID.test(input.reservationId) || !input.confirmationNo.trim() ||
      !/^[\x21-\x7e]{8,200}$/u.test(input.key) || !normalized || normalized.message !== body.message ||
      normalized.code !== body.code || normalized.showOn !== body.showOn || !Object.isFrozen(body)) return null;
  return Object.freeze({ operation: "create", propertyId: input.propertyId, reservationId: input.reservationId,
    confirmationNo: input.confirmationNo, body, key: input.key });
}

export function prepareCreateAlertAttempt(input: Readonly<{
  propertyId: string;
  reservationId: string;
  confirmationNo: string;
  draft: ReservationAlertDraft;
  key: string;
}>): ReservationAlertAttempt | null {
  const body = normalizeReservationAlertDraft(input.draft);
  if (!body) return null;
  return prepareCreateAlertAttemptFromBody({ ...input, body });
}

export function admitReservationAlertCommand(gate: { current: boolean }, eligible: boolean): boolean {
  if (gate.current || !eligible) return false;
  gate.current = true;
  return true;
}

export function prepareDeactivateAlertAttempt(input: Readonly<{
  propertyId: string;
  reservationId: string;
  confirmationNo: string;
  alert: ReservationAlert;
  key: string;
}>): ReservationAlertAttempt | null {
  const alert = input.alert;
  if (!UUID.test(input.propertyId) || !UUID.test(input.reservationId) || !input.confirmationNo.trim() ||
      !UUID.test(alert.alertId) || !alert.active || typeof alert.message !== "string" ||
      (alert.code !== null && typeof alert.code !== "string") || !SHOW_ON.has(alert.showOn as ReservationAlertShowOn) ||
      !/^[\x21-\x7e]{8,200}$/u.test(input.key)) return null;
  return Object.freeze({ operation: "deactivate", propertyId: input.propertyId, reservationId: input.reservationId,
    confirmationNo: input.confirmationNo, alert: Object.freeze({ ...alert }), key: input.key });
}

export function validateReservationAlertReceipt(value: unknown, attempt: ReservationAlertAttempt): ReservationAlertReceipt {
  if (!isRecord(value) || !ownKeys(value, ["alert", "changed", "replayed"]) || !isRecord(value.alert) ||
      !ownKeys(value.alert, ["id", "code", "message", "showOn", "active"]) || typeof value.changed !== "boolean" ||
      typeof value.replayed !== "boolean") {
    throw new ReservationAlertRequestError("The alert receipt is incomplete. Reconcile the original request.", true);
  }
  const alert = value.alert;
  if (typeof alert.id !== "string" || !UUID.test(alert.id) ||
      (alert.code !== null && typeof alert.code !== "string") || typeof alert.message !== "string" ||
      typeof alert.showOn !== "string" || !SHOW_ON.has(alert.showOn as ReservationAlertShowOn) || typeof alert.active !== "boolean") {
    throw new ReservationAlertRequestError("The alert receipt is invalid. Reconcile the original request.", true);
  }
  if (attempt.operation === "create") {
    if (value.changed !== true || alert.code !== attempt.body.code || alert.message !== attempt.body.message ||
        alert.showOn !== attempt.body.showOn || alert.active !== true) {
      throw new ReservationAlertRequestError("The alert receipt does not match the reviewed note. Reconcile the original request.", true);
    }
  } else if (alert.id !== attempt.alert.alertId || alert.code !== attempt.alert.code || alert.message !== attempt.alert.message ||
      alert.showOn !== attempt.alert.showOn || alert.active !== false) {
    throw new ReservationAlertRequestError("The alert receipt does not match the selected alert. Reconcile the original request.", true);
  }
  return Object.freeze({ id: alert.id, code: alert.code, message: alert.message, showOn: alert.showOn as ReservationAlertShowOn,
    active: alert.active, changed: value.changed, replayed: value.replayed });
}

export function matchesReservationAlertReadback(detail: unknown, attempt: ReservationAlertAttempt,
  receipt: ReservationAlertReceipt): boolean {
  if (!isRecord(detail) || !isRecord(detail.reservation) || detail.reservation.reservationId !== attempt.reservationId ||
      detail.reservation.confirmationNo !== attempt.confirmationNo || !Array.isArray(detail.reservation.alerts)) return false;
  const row = detail.reservation.alerts.find((item) => isRecord(item) && item.alertId === receipt.id);
  return isRecord(row) && row.alertId === receipt.id && row.code === receipt.code && row.message === receipt.message &&
    row.showOn === receipt.showOn && row.active === receipt.active;
}

export function createReservationAlertsClient(getToken: () => Promise<string>, fetcher: ReservationAlertFetcher = fetch) {
  return Object.freeze({
    async execute(attempt: ReservationAlertAttempt, isCurrent: () => boolean = () => true): Promise<ReservationAlertReceipt> {
      if (!isCurrent()) throw new ReservationAlertRequestError("The open reservation changed. No alert request was sent.", false);
      let token: string;
      try { token = await getToken(); }
      catch { throw new ReservationAlertRequestError("Your session could not be verified. Sign in again before continuing.", false, 401); }
      if (typeof token !== "string" || !token) throw new ReservationAlertRequestError("Your session could not be verified. Sign in again before continuing.", false, 401);
      if (!isCurrent()) throw new ReservationAlertRequestError("The open reservation changed. No alert request was sent.", false);
      const url = `/api/v1/properties/${encodeURIComponent(attempt.propertyId)}/reservations/${encodeURIComponent(attempt.reservationId)}/alerts` +
        (attempt.operation === "deactivate" ? `/${encodeURIComponent(attempt.alert.alertId)}/deactivate` : "");
      let response: Response;
      try {
        response = await fetcher(url, { method: "POST", cache: "no-store", headers: {
          authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": attempt.key,
        }, body: JSON.stringify(attempt.operation === "create" ? attempt.body : {}) });
      } catch {
        throw new ReservationAlertRequestError("The connection ended before Yellow could confirm the alert request. Reconcile the original request.", true);
      }
      if (!isCurrent()) throw new ReservationAlertRequestError("The alert response belongs to a reservation that is no longer open. Reconcile its original request.", true);
      if (response.status !== 200) {
        const ambiguous = response.status === 408 || response.status === 425 || response.status === 429 ||
          response.status >= 500 || (response.status >= 200 && response.status < 300);
        throw new ReservationAlertRequestError(safeStatusMessage(response.status), ambiguous, response.status);
      }
      let body: unknown;
      try { body = await response.json() as unknown; }
      catch { throw new ReservationAlertRequestError("The alert response could not be verified. Reconcile the original request.", true, response.status); }
      return validateReservationAlertReceipt(body, attempt);
    },
  });
}

export function reservationAlertOutcomeUncertain(previouslyUncertain: boolean, error: unknown): boolean {
  return previouslyUncertain || (error instanceof ReservationAlertRequestError && error.uncertain);
}

export async function runReservationAlertAttempt(input: Readonly<{
  client: ReturnType<typeof createReservationAlertsClient>;
  attempt: ReservationAlertAttempt;
  isCurrent: () => boolean;
  refreshDetail: () => Promise<ReservationDetail>;
}>): Promise<Readonly<{ receipt: ReservationAlertReceipt; detail: ReservationDetail }>> {
  const { client, attempt, isCurrent } = input;
  if (!isCurrent()) throw new ReservationAlertRequestError("The open reservation changed. No alert request was sent.", false);
  const receipt = await client.execute(attempt, isCurrent);
  if (!isCurrent()) throw new ReservationAlertRequestError("The alert receipt belongs to a reservation that is no longer open. Reconcile the original request.", true);
  let detail: ReservationDetail;
  try { detail = await input.refreshDetail(); }
  catch { throw new ReservationAlertRequestError("Yellow received the alert receipt, but current reservation details could not be verified. Reconcile the original request.", true); }
  if (!isCurrent()) throw new ReservationAlertRequestError("Reservation readback completed after the reservation changed. Reconcile the original request.", true);
  if (!matchesReservationAlertReadback(detail, attempt, receipt)) {
    throw new ReservationAlertRequestError("The refreshed reservation does not yet agree with the alert receipt. Reconcile the original request.", true);
  }
  return Object.freeze({ receipt, detail });
}
