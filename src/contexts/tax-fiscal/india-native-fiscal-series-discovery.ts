import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import {
  deriveIndiaFinancialYearStart,
  validateIndiaNativeFiscalPrefix,
  IndiaNativeFiscalSeriesAuthorizationError,
  IndiaNativeFiscalSeriesDatabaseError,
  IndiaNativeFiscalSeriesValidationError,
  type IndiaNativeFiscalSeriesConfigurationResult,
} from "./india-native-fiscal-invoice";

export interface IndiaNativeFiscalSeriesDiscoveryInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly supplierRegistrationId: string;
  readonly documentKind: "invoice" | "credit_note" | "debit_note";
  readonly actorId: string;
}
export type IndiaNativeFiscalSeriesDiscoveryResult = Readonly<Omit<IndiaNativeFiscalSeriesConfigurationResult, "replayed">>;

const INPUT_KEYS = ["tenantId", "propertyNode", "supplierRegistrationId", "documentKind", "actorId"] as const;
const SERIES_KEYS = ["series_id", "tenant_id", "property_node", "supplier_registration_id",
  "document_kind", "prefix", "financial_year_start", "next_no"] as const;
const PROTECTED_KEYS = ["supplier_available", "current_financial_year_start", ...SERIES_KEYS] as const;
const ROW_KEYS = ["authority_allowed", ...PROTECTED_KEYS] as const;
const DRIVER_METADATA = new Set(["count", "columns", "columnTypes", "command", "lastInsertRowid", "affectedRows"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Data = Readonly<Record<string, unknown>>;

function uuid(value: unknown): value is string { return typeof value === "string" && value.length === 36 && UUID.test(value); }

/** Read only own data; neither input nor driver accessors/proxies are evaluated. */
function record(value: unknown, expected: readonly string[]): Data | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expected.length || keys.some(key => typeof key !== "string" || !expected.includes(key))) return null;
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of expected) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) return null;
      copy[key] = descriptor.value;
    }
    return Object.freeze(copy);
  } catch { return null; }
}

export function snapshotIndiaNativeFiscalSeriesDiscoveryInput(value: unknown): Readonly<IndiaNativeFiscalSeriesDiscoveryInput> | null {
  const input = record(value, INPUT_KEYS);
  if (!input || !uuid(input.tenantId) || !uuid(input.propertyNode) || !uuid(input.supplierRegistrationId) || !uuid(input.actorId) ||
      (input.documentKind !== "invoice" && input.documentKind !== "credit_note" && input.documentKind !== "debit_note")) return null;
  return Object.freeze({ tenantId: input.tenantId, propertyNode: input.propertyNode,
    supplierRegistrationId: input.supplierRegistrationId, documentKind: input.documentKind, actorId: input.actorId });
}

/** Bun's observed SQL-array prototype adds only a data constructor above Array. */
function rowContainer(value: unknown): Data | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || !Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype) {
      if (prototype === null || utilTypes.isProxy(prototype) || Object.getPrototypeOf(prototype) !== Array.prototype) return null;
      const keys = Reflect.ownKeys(prototype);
      const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
      if (keys.length !== 1 || keys[0] !== "constructor" || !constructor || !("value" in constructor) ||
          typeof constructor.value !== "function" || constructor.enumerable !== false) return null;
    }
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !("value" in length) || length.value !== 1) return null;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || (key !== "length" && key !== "0" && !DRIVER_METADATA.has(key))) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return null;
    }
    const first = Object.getOwnPropertyDescriptor(value, "0");
    return first && "value" in first && first.enumerable === true ? record(first.value, ROW_KEYS) : null;
  } catch { return null; }
}

function unavailable(): never { throw new IndiaNativeFiscalSeriesDatabaseError("Fiscal-series discovery is unavailable"); }
function denied(): never { throw new IndiaNativeFiscalSeriesAuthorizationError("Fiscal-series discovery access is not granted"); }
function financialYear(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10 || !/^(?!0000)[0-9]{4}-04-01$/.test(value)) return false;
  try { return deriveIndiaFinancialYearStart(value) === value; } catch { return false; }
}
function positiveInt64(value: unknown): value is string {
  return typeof value === "string" && value.length <= 19 && value.trim() === value && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n;
}
function permissionFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null || utilTypes.isProxy(error)) return false;
  return ["errno", "sqlState", "code"].some(key => {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    return descriptor !== undefined && "value" in descriptor && descriptor.value === "42501";
  });
}
function result(value: unknown, input: Readonly<IndiaNativeFiscalSeriesDiscoveryInput>): IndiaNativeFiscalSeriesDiscoveryResult | null {
  const row = rowContainer(value);
  if (!row || typeof row.authority_allowed !== "boolean") return unavailable();
  if (!row.authority_allowed) {
    if (PROTECTED_KEYS.some(key => row[key] !== null)) return unavailable();
    return denied();
  }
  if (!financialYear(row.current_financial_year_start) || row.supplier_available !== true) return unavailable();
  if (SERIES_KEYS.every(key => row[key] === null)) return null;
  if (!uuid(row.series_id) || row.tenant_id !== input.tenantId || row.property_node !== input.propertyNode ||
      row.supplier_registration_id !== input.supplierRegistrationId || row.document_kind !== input.documentKind ||
      row.financial_year_start !== row.current_financial_year_start || typeof row.prefix !== "string" || row.prefix.length > 12 ||
      row.prefix.trim() !== row.prefix || !positiveInt64(row.next_no)) return unavailable();
  try { validateIndiaNativeFiscalPrefix(row.prefix, row.current_financial_year_start); } catch { return unavailable(); }
  return Object.freeze({ seriesId: row.series_id, tenantId: input.tenantId, propertyNode: input.propertyNode,
    supplierRegistrationId: input.supplierRegistrationId, documentKind: input.documentKind,
    prefix: row.prefix, financialYearStart: row.current_financial_year_start, nextNo: row.next_no });
}

export class IndiaNativeFiscalSeriesDiscoveryService {
  async read(tx: Tx, value: unknown): Promise<IndiaNativeFiscalSeriesDiscoveryResult | null> {
    const input = snapshotIndiaNativeFiscalSeriesDiscoveryInput(value);
    if (!input || typeof tx !== "function" || utilTypes.isProxy(tx)) {
      throw new IndiaNativeFiscalSeriesValidationError("Fiscal-series discovery input is invalid");
    }
    let returned: unknown;
    try {
      returned = await tx`
        WITH input AS (
          SELECT ${input.tenantId}::uuid AS tenant_id, ${input.propertyNode}::uuid AS property_node,
            ${input.supplierRegistrationId}::uuid AS supplier_registration_id,
            ${input.documentKind}::text AS document_kind, ${input.actorId}::uuid AS actor_id
        ), authority AS MATERIALIZED (
          SELECT input.*, CASE WHEN session_user = 'yellow_runtime' AND current_user = 'app_role'
            AND pg_catalog.current_setting('role', true) = 'app_role'
            AND pg_catalog.current_setting('app.tenant_id', true) = input.tenant_id::text
          THEN EXISTS (
            SELECT 1 FROM public.tenant t
            JOIN public.app_user a ON a.tenant_id=t.id AND a.id=input.actor_id AND a.status='active'
            JOIN public.org_node p ON p.tenant_id=t.id AND p.id=input.property_node AND p.kind='property' AND p.currency='INR'
            JOIN public.user_role ur ON ur.tenant_id=a.tenant_id AND ur.user_id=a.id
            JOIN public.role r ON r.tenant_id=ur.tenant_id AND r.id=ur.role_id
            JOIN public.role_permission rp ON rp.role_id=r.id AND rp.permission_code='tax-fiscal.series:configure'
            JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
              AND grant_node.path @> p.path
            WHERE t.id=input.tenant_id AND t.status='active'
          ) ELSE false END AS authority_allowed FROM input
        ), property_date AS MATERIALIZED (
          SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE p.timezone)::date AS business_date
          FROM authority JOIN public.org_node p ON p.tenant_id=authority.tenant_id AND p.id=authority.property_node
          WHERE authority.authority_allowed
        ), availability AS MATERIALIZED (
          SELECT scope.*, CASE WHEN scope.authority_allowed THEN EXISTS (
            SELECT 1 FROM public.property_fiscal_registration registration
            JOIN public.india_gst_supplier_registration_status_snapshot registration_status
              ON registration_status.tenant_id=registration.tenant_id
              AND registration_status.supplier_registration_id=registration.id
              AND registration_status.status_as_of=property_date.business_date
              AND registration_status.gst_registration_status='active'
            WHERE registration.tenant_id=scope.tenant_id AND registration.id=scope.supplier_registration_id
              AND registration.property_node=scope.property_node AND registration.scheme='in-gstin' AND registration.currency='INR'
          ) ELSE NULL END AS supplier_available,
          CASE WHEN scope.authority_allowed THEN pg_catalog.make_date(
            pg_catalog.date_part('year',property_date.business_date)::integer
              -CASE WHEN pg_catalog.date_part('month',property_date.business_date)<4 THEN 1 ELSE 0 END,4,1)
          ELSE NULL END AS current_financial_year_start
          FROM authority scope LEFT JOIN property_date ON true
        )
        SELECT scope.authority_allowed, scope.supplier_available, scope.current_financial_year_start::text,
          found.series_id, found.tenant_id, found.property_node, found.supplier_registration_id,
          found.document_kind, found.prefix, found.financial_year_start, found.next_no
        FROM availability scope LEFT JOIN LATERAL (
          SELECT series.id AS series_id, series.tenant_id, series.property_node, series.supplier_registration_id,
            series.kind AS document_kind, series.prefix, series.financial_year_start::text, series.next_no::text
          FROM public.document_series series
          WHERE scope.authority_allowed AND scope.supplier_available AND series.tenant_id=scope.tenant_id
            AND series.property_node=scope.property_node AND series.supplier_registration_id=scope.supplier_registration_id
            AND series.kind=scope.document_kind AND series.financial_year_start=scope.current_financial_year_start AND series.fiscal
            AND series.kind IN ('invoice','credit_note','debit_note')
          LIMIT 2
        ) found ON true
      `;
    } catch (error) {
      if (permissionFailure(error)) return denied();
      return unavailable();
    }
    return result(returned, input);
  }
}
