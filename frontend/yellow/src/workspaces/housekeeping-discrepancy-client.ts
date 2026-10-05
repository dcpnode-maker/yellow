export type HousekeepingDiscrepancyRoom = Readonly<{
  spaceId: string;
  code: string;
  floor: string;
}>;

export type HousekeepingDiscrepancy = Readonly<{
  spaceId: string;
  spaceCode: string;
  floor: string | null;
  kind: "sleep" | "skip" | "person";
  reported: string;
  systemState: string;
  reportedBy: string;
  reportedAt: string;
}>;

export type HousekeepingDiscrepancyReport = Readonly<{
  spaceId: string;
  observedPresence: "occupied" | "vacant";
  observedPersons: number | null;
}>;

export type HousekeepingDiscrepancyReceipt = Readonly<{
  discrepancy: HousekeepingDiscrepancy | null;
  created: boolean;
  replayed: boolean;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const KEYS = (value: unknown, expected: readonly string[]): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());

export class HousekeepingDiscrepancyRequestError extends Error {
  constructor(message: string, readonly status: number | null, readonly uncertain: boolean) {
    super(message);
    this.name = "HousekeepingDiscrepancyRequestError";
  }
}

function canonicalInstant(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

export function validateHousekeepingDiscrepancy(value: unknown): HousekeepingDiscrepancy {
  if (!KEYS(value, ["spaceId", "spaceCode", "floor", "kind", "reported", "systemState", "reportedBy", "reportedAt"]) ||
      typeof value.spaceId !== "string" || !UUID.test(value.spaceId) ||
      typeof value.spaceCode !== "string" || value.spaceCode.length < 1 || value.spaceCode.length > 120 ||
      /[\x00-\x1f\x7f]/u.test(value.spaceCode) ||
      (value.floor !== null && (typeof value.floor !== "string" || value.floor.length > 120 || /[\x00-\x1f\x7f]/u.test(value.floor))) ||
      !["sleep", "skip", "person"].includes(String(value.kind)) ||
      typeof value.reported !== "string" || typeof value.systemState !== "string" ||
      typeof value.reportedBy !== "string" || !UUID.test(value.reportedBy) || !canonicalInstant(value.reportedAt)) {
    throw new HousekeepingDiscrepancyRequestError("The discrepancy evidence was invalid.", null, true);
  }
  const kind = value.kind as HousekeepingDiscrepancy["kind"];
  const report = /^(?:occupied|vacant|persons:(?:[1-9]|[1-9][0-9]))$/u;
  const system = /^(?:occupied|vacant|persons:(?:[1-9]|[1-9][0-9]{0,2}))$/u;
  const coherent = kind === "sleep" ? value.reported === "occupied" && value.systemState === "vacant"
    : kind === "skip" ? value.reported === "vacant" && value.systemState === "occupied"
      : report.test(value.reported) && system.test(value.systemState) && value.reported.startsWith("persons:") &&
        value.systemState.startsWith("persons:") && value.reported !== value.systemState;
  if (!coherent || !report.test(value.reported) || !system.test(value.systemState)) {
    throw new HousekeepingDiscrepancyRequestError("The discrepancy evidence was incoherent.", null, true);
  }
  return Object.freeze({
    spaceId: value.spaceId, spaceCode: value.spaceCode, floor: value.floor as string | null,
    kind, reported: value.reported, systemState: value.systemState,
    reportedBy: value.reportedBy, reportedAt: value.reportedAt,
  });
}

export function validateHousekeepingDiscrepancyList(value: unknown): readonly HousekeepingDiscrepancy[] {
  if (!KEYS(value, ["discrepancies"]) || !Array.isArray(value.discrepancies) || value.discrepancies.length > 100) {
    throw new HousekeepingDiscrepancyRequestError("The unresolved discrepancy list was invalid.", null, true);
  }
  const rows = value.discrepancies.map(validateHousekeepingDiscrepancy);
  if (new Set(rows.map((row) => row.spaceId)).size !== rows.length) {
    throw new HousekeepingDiscrepancyRequestError("The unresolved discrepancy list repeated a room.", null, true);
  }
  return Object.freeze(rows);
}

function validateReport(value: unknown): HousekeepingDiscrepancyReceipt {
  if (!KEYS(value, ["discrepancy", "created", "replayed"]) || typeof value.created !== "boolean" ||
      typeof value.replayed !== "boolean" || (value.discrepancy !== null && value.discrepancy === undefined)) {
    throw new HousekeepingDiscrepancyRequestError("The report receipt was invalid.", null, true);
  }
  const discrepancy = value.discrepancy === null ? null : validateHousekeepingDiscrepancy(value.discrepancy);
  if ((discrepancy === null && value.created) || (discrepancy !== null && discrepancy.spaceId.length === 0)) {
    throw new HousekeepingDiscrepancyRequestError("The report receipt was incoherent.", null, true);
  }
  return Object.freeze({ discrepancy, created: value.created, replayed: value.replayed });
}

export type HousekeepingDiscrepancyClient = Readonly<{
  list(propertyId: string): Promise<readonly HousekeepingDiscrepancy[]>;
  report(propertyId: string, draft: HousekeepingDiscrepancyReport, key: string, isCurrent?: () => boolean): Promise<HousekeepingDiscrepancyReceipt>;
}>;

export function validateHousekeepingDiscrepancyReport(value: unknown): HousekeepingDiscrepancyReport {
  if (!KEYS(value, ["spaceId", "observedPresence", "observedPersons"]) ||
      typeof value.spaceId !== "string" || !UUID.test(value.spaceId) ||
      (value.observedPresence !== "occupied" && value.observedPresence !== "vacant") ||
      (value.observedPresence === "occupied" && (!Number.isInteger(value.observedPersons) || Number(value.observedPersons) < 1 || Number(value.observedPersons) > 99)) ||
      (value.observedPresence === "vacant" && value.observedPersons !== null)) {
    throw new HousekeepingDiscrepancyRequestError("Choose an exact room and a valid physical observation.", null, false);
  }
  return Object.freeze({
    spaceId: value.spaceId,
    observedPresence: value.observedPresence,
    observedPersons: value.observedPersons as number | null,
  });
}

export function createHousekeepingDiscrepancyClient(
  getToken: () => Promise<string>,
  fetcher: typeof fetch = fetch,
): HousekeepingDiscrepancyClient {
  const request = async (propertyId: string, method: "GET" | "POST", draft?: HousekeepingDiscrepancyReport, key?: string, isCurrent: () => boolean = () => true) => {
    let token: string;
    try { token = await getToken(); }
    catch { throw new HousekeepingDiscrepancyRequestError("A valid operator session is required.", 401, false); }
    if (!isCurrent()) throw new HousekeepingDiscrepancyRequestError("The property changed before the report was sent.", null, false);
    let response: Response;
    try {
      response = await fetcher(`/api/v1/properties/${encodeURIComponent(propertyId)}/housekeeping/discrepancies`, {
        method,
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`,
          ...(draft ? { "content-type": "application/json" } : {}),
          ...(key ? { "idempotency-key": key } : {}),
        },
        ...(draft ? { body: JSON.stringify(draft) } : {}),
      });
    } catch {
      throw new HousekeepingDiscrepancyRequestError("The discrepancy request was interrupted.", null, method === "POST");
    }
    if (!response.ok) {
      const uncertain = method === "POST" && response.status >= 500;
      throw new HousekeepingDiscrepancyRequestError(
        response.status === 403 ? "Discrepancy access is not granted."
          : response.status === 404 ? "The property or exact room is unavailable."
            : response.status === 409 ? "Discrepancy truth changed. Refresh and review before trying again."
              : `Discrepancy request failed (${response.status}).`, response.status, uncertain,
      );
    }
    if (response.status !== (method === "GET" ? 200 : 201)) {
      throw new HousekeepingDiscrepancyRequestError("The discrepancy service returned an unexpected response status.", response.status, method === "POST");
    }
    try { return await response.json() as unknown; }
    catch { throw new HousekeepingDiscrepancyRequestError("The discrepancy response could not be read.", response.status, method === "POST"); }
  };
  return Object.freeze({
    async list(propertyId) {
      return validateHousekeepingDiscrepancyList(await request(propertyId, "GET"));
    },
    async report(propertyId, draft, key, isCurrent = () => true) {
      const normalized = validateHousekeepingDiscrepancyReport(draft);
      if (key.length < 8 || key.length > 200 || !/^[\x21-\x7e]+$/u.test(key)) {
        throw new HousekeepingDiscrepancyRequestError("The report request key was invalid.", null, false);
      }
      return validateReport(await request(propertyId, "POST", normalized, key, isCurrent));
    },
  });
}

export type HousekeepingDiscrepancyAttempt = Readonly<{
  propertyId: string;
  draft: HousekeepingDiscrepancyReport;
  key: string;
}>;

export function acquireHousekeepingDiscrepancyFlight(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export async function runHousekeepingDiscrepancyAttempt(input: Readonly<{
  client: HousekeepingDiscrepancyClient;
  attempt: HousekeepingDiscrepancyAttempt;
  isCurrent: () => boolean;
  onRefresh: () => Promise<void>;
}>): Promise<Readonly<{ receipt: HousekeepingDiscrepancyReceipt; rows: readonly HousekeepingDiscrepancy[] }>> {
  const { client, attempt, isCurrent, onRefresh } = input;
  const receipt = await client.report(attempt.propertyId, attempt.draft, attempt.key, isCurrent);
  if (!isCurrent()) throw new HousekeepingDiscrepancyRequestError("The property changed before the report could be reconciled.", null, true);
  if (receipt.discrepancy) {
    const expectedKind = attempt.draft.observedPresence === "vacant" ? "skip"
      : receipt.discrepancy.kind === "person" ? "person" : "sleep";
    const expectedReported = expectedKind === "person" ? `persons:${attempt.draft.observedPersons}`
      : attempt.draft.observedPresence;
    if (receipt.discrepancy.spaceId !== attempt.draft.spaceId || receipt.discrepancy.kind !== expectedKind ||
        receipt.discrepancy.reported !== expectedReported) {
      throw new HousekeepingDiscrepancyRequestError("The receipt did not match the submitted room observation. Recheck this exact request.", null, true);
    }
  }
  let rows: readonly HousekeepingDiscrepancy[];
  try {
    [rows] = await Promise.all([client.list(attempt.propertyId), onRefresh()]);
  } catch (cause) {
    throw new HousekeepingDiscrepancyRequestError(
      "The report result could not be confirmed against refreshed discrepancy and room condition truth.",
      cause instanceof HousekeepingDiscrepancyRequestError ? cause.status : null,
      true,
    );
  }
  if (!isCurrent()) throw new HousekeepingDiscrepancyRequestError("The property changed before the report could be reconciled.", null, true);
  if (receipt.discrepancy && !rows.some((row) =>
    row.spaceId === receipt.discrepancy!.spaceId && row.kind === receipt.discrepancy!.kind &&
    row.reported === receipt.discrepancy!.reported && row.systemState === receipt.discrepancy!.systemState &&
    row.reportedBy === receipt.discrepancy!.reportedBy && row.reportedAt === receipt.discrepancy!.reportedAt &&
    row.spaceCode === receipt.discrepancy!.spaceCode && row.floor === receipt.discrepancy!.floor)) {
    throw new HousekeepingDiscrepancyRequestError("The report receipt is not yet present in the unresolved list. Recheck this exact request.", null, true);
  }
  return Object.freeze({ receipt, rows });
}
