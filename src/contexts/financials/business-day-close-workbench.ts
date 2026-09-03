import type { Database, Tx } from "../../kernel";
import { BusinessDayCloseReadinessUnavailableError, loadBusinessDayCloseReadinessEvidence, type BusinessDayCloseReadiness } from "./business-day-close-readiness";

export const MAX_OPEN_DAYS = 366 as const;
export const MAX_CARRY_CANDIDATES = 500 as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface BusinessDayCloseWorkbenchInput { readonly tenantId: string; readonly propertyNode: string; readonly businessDate: string; readonly actorId: string }
export interface BusinessDayCloseWorkbenchEntryInput { readonly tenantId: string; readonly propertyNode: string; readonly actorId: string }
export interface BusinessDayCloseWorkbenchEntry { readonly businessDate: string }
export interface BusinessDayCloseWorkbenchDay { readonly businessDate: string; readonly openedAt: string; readonly isCurrent: boolean }
export interface BusinessDayCloseWorkbenchCarryCandidate { readonly discrepancyId: string; readonly spaceId: string; readonly spaceCode: string; readonly reportedBusinessDate: string }
export interface BusinessDayCloseWorkbench { readonly tenantId: string; readonly propertyNode: string; readonly businessDate: string; readonly capturedAt: string; readonly currentOpenBusinessDate: string; readonly openDays: readonly BusinessDayCloseWorkbenchDay[]; readonly readiness: BusinessDayCloseReadiness; readonly carryCandidates: readonly BusinessDayCloseWorkbenchCarryCandidate[] }
export interface BusinessDayCloseWorkbenchServiceOptions { readonly database: Database }
export class BusinessDayCloseWorkbenchValidationError extends Error { constructor(message: string) { super(message); this.name = "BusinessDayCloseWorkbenchValidationError"; } }
export class BusinessDayCloseWorkbenchUnavailableError extends Error { constructor() { super("Business-day close workbench is unavailable"); this.name = "BusinessDayCloseWorkbenchUnavailableError"; } }

function normalize(input: BusinessDayCloseWorkbenchInput): Readonly<BusinessDayCloseWorkbenchInput> {
  if (typeof input !== "object" || input === null || Array.isArray(input) || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) || Object.getOwnPropertySymbols(input).length !== 0) throw new BusinessDayCloseWorkbenchValidationError("business-day close workbench input must be a plain object");
  const keys = ["tenantId", "propertyNode", "businessDate", "actorId"];
  if (Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) throw new BusinessDayCloseWorkbenchValidationError("business-day close workbench input shape is invalid");
  for (const key of ["tenantId", "propertyNode", "actorId"] as const) if (typeof input[key] !== "string" || !UUID.test(input[key])) throw new BusinessDayCloseWorkbenchValidationError(`${key} must be a lowercase UUID`);
  if (typeof input.businessDate !== "string" || !DATE.test(input.businessDate)) throw new BusinessDayCloseWorkbenchValidationError("businessDate must be canonical YYYY-MM-DD");
  const parsed = new Date(`${input.businessDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== input.businessDate) throw new BusinessDayCloseWorkbenchValidationError("businessDate must be a real canonical date");
  return Object.freeze({ ...input });
}
function normalizeEntry(input: BusinessDayCloseWorkbenchEntryInput): Readonly<BusinessDayCloseWorkbenchEntryInput> {
  if (typeof input !== "object" || input === null || Array.isArray(input) || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) || Object.getOwnPropertySymbols(input).length !== 0) throw new BusinessDayCloseWorkbenchValidationError("business-day close workbench entry input must be a plain object");
  const keys = ["tenantId", "propertyNode", "actorId"];
  if (Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) throw new BusinessDayCloseWorkbenchValidationError("business-day close workbench entry input shape is invalid");
  for (const key of keys as readonly (keyof BusinessDayCloseWorkbenchEntryInput)[]) if (typeof input[key] !== "string" || !UUID.test(input[key])) throw new BusinessDayCloseWorkbenchValidationError(`${key} must be a lowercase UUID`);
  return Object.freeze({ ...input });
}
function text(value: unknown, field: string, pattern?: RegExp): string { if (typeof value !== "string" || (pattern && !pattern.test(value))) throw new Error(`Database returned invalid ${field}`); return value; }
function instant(value: unknown, field: string): string { const rendered = value instanceof Date ? value.toISOString() : text(value, field); const parsed = new Date(rendered); if (!Number.isFinite(parsed.valueOf())) throw new Error(`Database returned invalid ${field}`); return parsed.toISOString(); }
function count(value: unknown, field: string): number { const parsed = typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN; if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Database returned invalid ${field}`); return parsed; }
function array(value: unknown, field: string): readonly Record<string, unknown>[] { const decoded = typeof value === "string" ? JSON.parse(value) : value; if (!Array.isArray(decoded) || decoded.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) throw new Error(`Database returned invalid ${field}`); return decoded as readonly Record<string, unknown>[]; }
function exactObject(value: Record<string, unknown>, keys: readonly string[], field: string): void { if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error(`Database returned invalid ${field}`); }

export async function loadBusinessDayCloseWorkbench(tx: Tx, input: BusinessDayCloseWorkbenchInput): Promise<BusinessDayCloseWorkbench> {
  const target = normalize(input);
  let evidence;
  try { evidence = await loadBusinessDayCloseReadinessEvidence(tx, target); } catch (error) { if (error instanceof BusinessDayCloseReadinessUnavailableError) throw new BusinessDayCloseWorkbenchUnavailableError(); throw error; }
  const openDayCount = count(evidence.openDayCount, "open-day count");
  const candidateCount = count(evidence.carryCandidateCount, "carry-candidate count");
  const unsafeCount = count(evidence.unsafeCarryCandidateCount, "unsafe carry-candidate count");
  if (openDayCount === 0 || openDayCount > MAX_OPEN_DAYS || candidateCount > MAX_CARRY_CANDIDATES || unsafeCount > 0) throw new BusinessDayCloseWorkbenchUnavailableError();
  const rawDays = array(evidence.openDays, "open days");
  if (rawDays.length !== openDayCount) throw new Error("Database returned incoherent open-day count");
  const days = rawDays.map((row) => { exactObject(row, ["businessDate", "openedAt"], "open day"); return { businessDate: text(row.businessDate, "open business date", DATE), openedAt: instant(row.openedAt, "open-day instant") }; });
  for (let index = 1; index < days.length; index++) if (days[index - 1]!.businessDate >= days[index]!.businessDate) throw new Error("Database returned unordered or duplicate open days");
  const currentOpenBusinessDate = days.at(-1)!.businessDate;
  if (!days.some((day) => day.businessDate === target.businessDate)) throw new BusinessDayCloseWorkbenchUnavailableError();
  const openDays = Object.freeze(days.map((day) => Object.freeze({ ...day, isCurrent: day.businessDate === currentOpenBusinessDate })));
  const rawCandidates = array(evidence.carryCandidates, "carry candidates");
  if (rawCandidates.length !== candidateCount || (target.businessDate === currentOpenBusinessDate && candidateCount !== 0)) throw new Error("Database returned incoherent carry candidates");
  const carryCandidates = Object.freeze(rawCandidates.map((row) => { exactObject(row, ["discrepancyId", "spaceId", "spaceCode", "reportedBusinessDate"], "carry candidate"); const reportedBusinessDate = text(row.reportedBusinessDate, "reported business date", DATE); if (reportedBusinessDate !== target.businessDate) throw new BusinessDayCloseWorkbenchUnavailableError(); return Object.freeze({ discrepancyId: text(row.discrepancyId, "discrepancy id", UUID), spaceId: text(row.spaceId, "space id", UUID), spaceCode: text(row.spaceCode, "space code"), reportedBusinessDate }); }));
  return Object.freeze({ tenantId: target.tenantId, propertyNode: target.propertyNode, businessDate: target.businessDate, capturedAt: evidence.readiness.capturedAt, currentOpenBusinessDate, openDays, readiness: evidence.readiness, carryCandidates });
}

export async function loadBusinessDayCloseWorkbenchEntry(tx: Tx, input: BusinessDayCloseWorkbenchEntryInput): Promise<BusinessDayCloseWorkbenchEntry> {
  const target = normalizeEntry(input);
  const rows = await tx<Array<{ business_date: unknown }>>`
    SELECT to_char(MIN(day.business_date), 'YYYY-MM-DD') AS business_date
    FROM tenant
    JOIN app_user AS actor
      ON actor.tenant_id = tenant.id
     AND actor.id = ${target.actorId}::uuid
     AND actor.status = 'active'
    JOIN org_node AS property
      ON property.tenant_id = tenant.id
     AND property.id = ${target.propertyNode}::uuid
     AND property.kind = 'property'
    JOIN user_role AS grant_role
      ON grant_role.tenant_id = tenant.id
     AND grant_role.user_id = actor.id
    JOIN role AS granted_role
      ON granted_role.tenant_id = tenant.id
     AND granted_role.id = grant_role.role_id
    JOIN role_permission AS grant_permission
      ON grant_permission.role_id = granted_role.id
     AND grant_permission.permission_code = 'financials.business-days:read'
    JOIN org_node AS grant_node
      ON grant_node.tenant_id = tenant.id
     AND grant_node.id = grant_role.scope_node
     AND property.path <@ grant_node.path
    JOIN business_day AS day
      ON day.tenant_id = tenant.id
     AND day.property_node = property.id
     AND day.sealed_at IS NULL
    WHERE tenant.id = ${target.tenantId}::uuid
      AND tenant.status = 'active'
  `;
  if (rows.length !== 1 || rows[0]?.business_date === null || rows[0]?.business_date === undefined) throw new BusinessDayCloseWorkbenchUnavailableError();
  return Object.freeze({ businessDate: text(rows[0].business_date, "entry business date", DATE) });
}

export class BusinessDayCloseWorkbenchService {
  readonly #database: Database;
  constructor(options: BusinessDayCloseWorkbenchServiceOptions) { this.#database = options.database; }
  async read(input: BusinessDayCloseWorkbenchInput): Promise<BusinessDayCloseWorkbench> { const target = normalize(input); return this.#database.withTenantTransaction(target.tenantId, (tx) => loadBusinessDayCloseWorkbench(tx, target)); }
}
