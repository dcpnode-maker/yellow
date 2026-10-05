export type PropertyOperatingMode = "hotel" | "str" | "both";

export type PropertyOperatingModeSnapshot = Readonly<{
  propertyNode: string;
  mode: PropertyOperatingMode | null;
  version: number;
  effectiveAt: string | null;
  effectiveBusinessDate: string | null;
  canWrite: boolean;
}>;

export type PropertyOperatingModeAttempt = Readonly<{
  expectedVersion: number;
  mode: PropertyOperatingMode;
  idempotencyKey: string;
  correlationId: string;
}>;

export type PropertyOperatingModeReceipt = Readonly<{
  propertyMode: PropertyOperatingModeSnapshot;
  changed: boolean;
  replayed: boolean;
}>;

export type PropertyOperatingModeActorScope = Readonly<{ tenantId: string; actorId: string }>;
export type PropertyOperatingModePendingDraft = Readonly<{
  selection: PropertyOperatingMode | null;
  attempt: PropertyOperatingModeAttempt | null;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MODES = new Set<PropertyOperatingMode>(["hotel", "str", "both"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPropertyOperatingMode(value: unknown): value is PropertyOperatingMode {
  return typeof value === "string" && MODES.has(value as PropertyOperatingMode);
}

export function isPropertyOperatingModeSnapshot(value: unknown, expectedPropertyNode: string): value is PropertyOperatingModeSnapshot {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "canWrite,effectiveAt,effectiveBusinessDate,mode,propertyNode,version") return false;
  if (typeof value.propertyNode !== "string" || !UUID.test(value.propertyNode) || value.propertyNode !== expectedPropertyNode ||
      !(value.mode === null || isPropertyOperatingMode(value.mode)) ||
      !Number.isInteger(value.version) || (value.version as number) < 0 || (value.version as number) > 2147483647 ||
      !(value.effectiveAt === null || isCanonicalInstant(value.effectiveAt)) ||
      !(value.effectiveBusinessDate === null || isCanonicalBusinessDate(value.effectiveBusinessDate)) ||
      typeof value.canWrite !== "boolean") return false;
  if (value.mode === null && (value.version !== 0 || value.effectiveAt !== null || value.effectiveBusinessDate !== null)) return false;
  if (value.mode !== null && (value.version === 0 || value.effectiveAt === null || value.effectiveBusinessDate === null)) return false;
  return true;
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isCanonicalBusinessDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isPropertyOperatingModeReceipt(value: unknown, expectedPropertyNode: string): value is PropertyOperatingModeReceipt {
  return isRecord(value) &&
    Object.keys(value).sort().join(",") === "changed,propertyMode,replayed" &&
    isPropertyOperatingModeSnapshot(value.propertyMode, expectedPropertyNode) &&
    typeof value.changed === "boolean" &&
    typeof value.replayed === "boolean";
}

export function createPropertyOperatingModeAttempt(
  expectedVersion: number,
  mode: PropertyOperatingMode,
  idempotencyKey: string,
  correlationId: string,
): PropertyOperatingModeAttempt {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || expectedVersion > 2147483647 ||
      !isPropertyOperatingMode(mode) || !UUID.test(idempotencyKey) || !UUID.test(correlationId)) {
    throw new TypeError("A valid version, operating mode, idempotency key, and correlation ID are required.");
  }
  return Object.freeze({ expectedVersion, mode, idempotencyKey, correlationId });
}

/** Resolve only when a later persisted version proves the exact requested mode is present. */
export function reconcilePropertyOperatingModeAttempt(
  attempt: PropertyOperatingModeAttempt,
  snapshot: PropertyOperatingModeSnapshot,
): "accepted" | "conflict" | "pending" {
  if (snapshot.version === attempt.expectedVersion + 1 && snapshot.mode === attempt.mode) return "accepted";
  if (snapshot.version > attempt.expectedVersion) return "conflict";
  return "pending";
}

export function samePropertyOperatingModeAttempt(
  left: PropertyOperatingModeAttempt,
  right: PropertyOperatingModeAttempt,
): boolean {
  return left.expectedVersion === right.expectedVersion &&
    left.mode === right.mode &&
    left.idempotencyKey === right.idempotencyKey &&
    left.correlationId === right.correlationId;
}

function isOperatingModeAttempt(value: unknown): value is PropertyOperatingModeAttempt {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "correlationId,expectedVersion,idempotencyKey,mode") return false;
  try {
    createPropertyOperatingModeAttempt(value.expectedVersion as number, value.mode as PropertyOperatingMode,
      value.idempotencyKey as string, value.correlationId as string);
    return true;
  } catch { return false; }
}

export function propertyOperatingModeDraftStorageKey(scope: PropertyOperatingModeActorScope, propertyNode: string): string {
  if (!UUID.test(scope.tenantId) || !UUID.test(scope.actorId) || !UUID.test(propertyNode)) throw new TypeError("A verified session scope and property are required.");
  return `yellow.property-mode.pending.v1.${scope.tenantId}.${scope.actorId}.${propertyNode}`;
}

export function readPropertyOperatingModeDraft(
  storage: Pick<Storage, "getItem">,
  scope: PropertyOperatingModeActorScope,
  propertyNode: string,
): PropertyOperatingModePendingDraft | null {
  let raw: string | null;
  try { raw = storage.getItem(propertyOperatingModeDraftStorageKey(scope, propertyNode)); } catch { throw new Error("Saved mode recovery is unavailable in this browser."); }
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || Object.keys(value).sort().join(",") !== "attempt,propertyNode,selection" || value.propertyNode !== propertyNode ||
        !(value.selection === null || isPropertyOperatingMode(value.selection)) || !(value.attempt === null || isOperatingModeAttempt(value.attempt)) ||
        (value.attempt !== null && value.selection !== value.attempt.mode)) return null;
    return Object.freeze({ selection: value.selection, attempt: value.attempt });
  } catch { return null; }
}

export function writePropertyOperatingModeDraft(
  storage: Pick<Storage, "setItem">,
  scope: PropertyOperatingModeActorScope,
  propertyNode: string,
  draft: PropertyOperatingModePendingDraft,
): void {
  if (!(draft.selection === null || isPropertyOperatingMode(draft.selection)) || !(draft.attempt === null || isOperatingModeAttempt(draft.attempt)) ||
      (draft.attempt !== null && draft.selection !== draft.attempt.mode))
    throw new TypeError("The pending mode draft is invalid.");
  const key = propertyOperatingModeDraftStorageKey(scope, propertyNode);
  try { storage.setItem(key, JSON.stringify({ propertyNode, selection: draft.selection, attempt: draft.attempt })); }
  catch { throw new Error("Yellow could not safely save this pending change in this browser. The request was not sent."); }
}

export function clearPropertyOperatingModeDraft(
  storage: Pick<Storage, "removeItem">,
  scope: PropertyOperatingModeActorScope,
  propertyNode: string,
): void {
  try { storage.removeItem(propertyOperatingModeDraftStorageKey(scope, propertyNode)); }
  catch { throw new Error("The saved mode draft could not be cleared in this browser."); }
}

/** Bind a successful HTTP receipt to the exact compare-and-set command sent. */
export function isPropertyOperatingModeReceiptForAttempt(
  value: unknown,
  expectedPropertyNode: string,
  attempt: PropertyOperatingModeAttempt,
): value is PropertyOperatingModeReceipt {
  if (!isPropertyOperatingModeReceipt(value, expectedPropertyNode)) return false;
  const { propertyMode, changed } = value;
  if (propertyMode.mode !== attempt.mode) return false;
  if (changed) return attempt.expectedVersion < 2147483647 && propertyMode.version === attempt.expectedVersion + 1;
  return propertyMode.version === attempt.expectedVersion;
}
