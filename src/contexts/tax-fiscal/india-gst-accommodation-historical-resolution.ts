import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstAccommodationRateVersionPairService,
  type IndiaGstAccommodationRateVersionEvidence,
  type IndiaGstAccommodationRateVersionPairResult,
} from "./india-gst-accommodation-rate-version-pair";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/;

const PREDECESSOR_EXTENSION_ID = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR_EXTENSION_ID = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const JURISDICTION_KEY = "in-gst-lodging";

const INPUT_KEYS = ["propertyNode", "businessDate"] as const;
const PROPERTY_DAY_KEYS = [
  "tenant_id",
  "property_timezone",
  "business_day_from_instant",
  "business_day_to_instant",
] as const;
const ASSIGNMENT_KEYS = ["jurisdiction_key", "effective_from", "effective_to"] as const;

type JsonRecord = Record<string, unknown>;
type VisibleRegistry = ConstructorParameters<typeof IndiaGstAccommodationRateVersionPairService>[0];

interface PropertyDayRow {
  readonly tenant_id: string;
  readonly property_timezone: string;
  readonly business_day_from_instant: string;
  readonly business_day_to_instant: string;
}

interface AssignmentRow {
  readonly jurisdiction_key: string;
  readonly effective_from: string | null;
  readonly effective_to: string | null;
}

export interface IndiaGstAccommodationHistoricalResolutionInput {
  readonly propertyNode: string;
  readonly businessDate: string;
}

export interface IndiaGstAccommodationHistoricalPropertyEvidence {
  readonly propertyNode: string;
  readonly propertyTimezone: string;
}

export interface IndiaGstAccommodationHistoricalBusinessDayEvidence {
  readonly businessDate: string;
  readonly fromInstant: string;
  readonly toInstant: string;
}

export interface IndiaGstAccommodationHistoricalAssignmentEvidence {
  readonly jurisdictionKey: "in-gst-lodging";
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

export interface IndiaGstAccommodationHistoricalResolutionResult {
  readonly property: IndiaGstAccommodationHistoricalPropertyEvidence;
  readonly businessDay: IndiaGstAccommodationHistoricalBusinessDayEvidence;
  readonly assignment: IndiaGstAccommodationHistoricalAssignmentEvidence;
  readonly selectedExtension: IndiaGstAccommodationRateVersionEvidence;
  readonly rateVersionPair: IndiaGstAccommodationRateVersionPairResult;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationHistoricalResolutionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationHistoricalResolutionValidationError";
  }
}

export class IndiaGstAccommodationHistoricalResolutionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationHistoricalResolutionNotFoundError";
  }
}

export class IndiaGstAccommodationHistoricalResolutionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationHistoricalResolutionConflictError";
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  subject: string,
  ErrorType: new (message: string) => Error,
): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new ErrorType(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined
        || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new ErrorType(`${subject} shape is invalid`);
  }
  return value as JsonRecord;
}

function canonicalUuid(value: unknown, subject: string, ErrorType: new (message: string) => Error): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new ErrorType(`${subject} must be a canonical UUID`);
  return value;
}

function validDate(year: number, month: number, day: number): boolean {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (monthDays[month - 1] ?? 0);
}

function date(value: unknown, subject: string, ErrorType: new (message: string) => Error): string {
  if (typeof value !== "string") throw new ErrorType(`${subject} must be YYYY-MM-DD`);
  const match = DATE.exec(value);
  if (!match || !validDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    throw new ErrorType(`${subject} must be a calendar date`);
  }
  return value;
}

function instant(value: unknown, subject: string): string {
  if (typeof value !== "string") throw new IndiaGstAccommodationHistoricalResolutionConflictError(`${subject} is invalid`);
  const match = INSTANT.exec(value);
  if (!match || !validDate(Number(match[1]), Number(match[2]), Number(match[3]))
      || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) {
    throw new IndiaGstAccommodationHistoricalResolutionConflictError(`${subject} must be a canonical UTC instant`);
  }
  return value;
}

function input(raw: unknown): IndiaGstAccommodationHistoricalResolutionInput {
  const value = exactRecord(
    raw,
    INPUT_KEYS,
    "historical accommodation-resolution input",
    IndiaGstAccommodationHistoricalResolutionValidationError,
  );
  return Object.freeze({
    propertyNode: canonicalUuid(
      value.propertyNode,
      "propertyNode",
      IndiaGstAccommodationHistoricalResolutionValidationError,
    ),
    businessDate: date(
      value.businessDate,
      "businessDate",
      IndiaGstAccommodationHistoricalResolutionValidationError,
    ),
  });
}

function propertyDay(row: unknown): {
  readonly tenantId: string;
  readonly propertyTimezone: string;
  readonly fromInstant: string;
  readonly toInstant: string;
} {
  const value = exactRecord(
    row,
    PROPERTY_DAY_KEYS,
    "property-day evidence",
    IndiaGstAccommodationHistoricalResolutionConflictError,
  );
  const propertyTimezone = value.property_timezone;
  if (typeof propertyTimezone !== "string" || propertyTimezone.length === 0
      || propertyTimezone.trim() !== propertyTimezone) {
    throw new IndiaGstAccommodationHistoricalResolutionConflictError("property timezone is invalid");
  }
  const fromInstant = instant(value.business_day_from_instant, "property-day lower bound");
  const toInstant = instant(value.business_day_to_instant, "property-day upper bound");
  if (fromInstant >= toInstant) {
    throw new IndiaGstAccommodationHistoricalResolutionConflictError("property-day bounds are not increasing");
  }
  return Object.freeze({
    tenantId: canonicalUuid(
      value.tenant_id,
      "property tenant id",
      IndiaGstAccommodationHistoricalResolutionConflictError,
    ),
    propertyTimezone,
    fromInstant,
    toInstant,
  });
}

function assignment(row: unknown, businessDate: string): IndiaGstAccommodationHistoricalAssignmentEvidence {
  const value = exactRecord(
    row,
    ASSIGNMENT_KEYS,
    "tax assignment evidence",
    IndiaGstAccommodationHistoricalResolutionConflictError,
  );
  if (value.jurisdiction_key !== JURISDICTION_KEY) {
    throw new IndiaGstAccommodationHistoricalResolutionConflictError("tax assignment is not India lodging");
  }
  const effectiveFrom = value.effective_from === null
    ? null
    : date(value.effective_from, "tax assignment lower bound", IndiaGstAccommodationHistoricalResolutionConflictError);
  const effectiveTo = value.effective_to === null
    ? null
    : date(value.effective_to, "tax assignment upper bound", IndiaGstAccommodationHistoricalResolutionConflictError);
  if ((effectiveFrom !== null && effectiveFrom > businessDate)
      || (effectiveTo !== null && effectiveTo <= businessDate)
      || (effectiveFrom !== null && effectiveTo !== null && effectiveFrom >= effectiveTo)) {
    throw new IndiaGstAccommodationHistoricalResolutionConflictError("tax assignment does not contain the business date");
  }
  return Object.freeze({
    jurisdictionKey: JURISDICTION_KEY,
    effectiveFrom,
    effectiveTo,
  });
}

function canonicalJson(value: unknown, ancestors = new Set<object>(), depth = 0): string {
  if (depth > 64) throw new IndiaGstAccommodationHistoricalResolutionConflictError("resolution evidence is too deeply nested");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new IndiaGstAccommodationHistoricalResolutionConflictError("resolution evidence contains a non-finite number");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object" || utilTypes.isProxy(value) || ancestors.has(value)) {
    throw new IndiaGstAccommodationHistoricalResolutionConflictError("resolution evidence is not canonical JSON");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length !== 0) throw new IndiaGstAccommodationHistoricalResolutionConflictError("resolution evidence arrays must not contain symbol keys");
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) throw new IndiaGstAccommodationHistoricalResolutionConflictError("resolution evidence arrays must be dense");
      return `[${value.map((item) => canonicalJson(item, ancestors, depth + 1)).join(",")}]`;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null
        || Object.getOwnPropertySymbols(value).length !== 0) {
      throw new IndiaGstAccommodationHistoricalResolutionConflictError("resolution evidence objects must be plain records");
    }
    return `{${Object.keys(value).sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || descriptor.enumerable !== true || !("value" in descriptor)) {
        throw new IndiaGstAccommodationHistoricalResolutionConflictError("resolution evidence objects must contain data fields only");
      }
      return `${JSON.stringify(key)}:${canonicalJson(descriptor.value, ancestors, depth + 1)}`;
    }).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function evidenceHash(tenantId: string, body: Omit<IndiaGstAccommodationHistoricalResolutionResult, "evidenceHash">): string {
  // Tenant identity is authority-bearing input to the preimage only; the public
  // evidence object never returns it.
  return new Bun.CryptoHasher("sha256").update(canonicalJson({ tenantId, ...body })).digest("hex");
}

function selectedVersion(
  pair: IndiaGstAccommodationRateVersionPairResult,
  fromInstant: string,
  toInstant: string,
): IndiaGstAccommodationRateVersionEvidence {
  const matches = [pair.predecessor, pair.successor].filter((candidate) =>
    candidate.effectiveFromInstant <= fromInstant
      && (candidate.effectiveToInstant === null || candidate.effectiveToInstant >= toInstant),
  );
  if (matches.length !== 1 || !matches[0]) {
    throw new IndiaGstAccommodationHistoricalResolutionConflictError(
      "no single governed accommodation version contains the whole property day",
    );
  }
  return matches[0];
}

export class IndiaGstAccommodationHistoricalResolutionService {
  readonly #pair: IndiaGstAccommodationRateVersionPairService;

  constructor(registry: VisibleRegistry) {
    try {
      this.#pair = new IndiaGstAccommodationRateVersionPairService(registry);
    } catch {
      throw new IndiaGstAccommodationHistoricalResolutionValidationError("extension registry is unavailable");
    }
  }

  async resolve(
    tx: Tx,
    raw: IndiaGstAccommodationHistoricalResolutionInput,
  ): Promise<IndiaGstAccommodationHistoricalResolutionResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstAccommodationHistoricalResolutionValidationError("tenant transaction is unavailable");
    }
    const normalized = input(raw);
    const propertyRows = await tx<PropertyDayRow[]>`
      SELECT property.tenant_id::text AS tenant_id,
             property.timezone AS property_timezone,
             to_char((${normalized.businessDate}::date::timestamp AT TIME ZONE property.timezone)
               AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS business_day_from_instant,
             to_char(((((${normalized.businessDate}::date + 1)::date)::timestamp
               AT TIME ZONE property.timezone) AT TIME ZONE 'UTC'),
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS business_day_to_instant
        FROM public.org_node AS property
        JOIN public.tenant AS tenant ON tenant.id = property.tenant_id
       WHERE property.id = ${normalized.propertyNode}::uuid
         AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND property.kind = 'property'
         AND tenant.status = 'active'
    `;
    if (propertyRows.length === 0) {
      throw new IndiaGstAccommodationHistoricalResolutionNotFoundError("selected property is unavailable");
    }
    if (propertyRows.length !== 1 || !propertyRows[0]) {
      throw new IndiaGstAccommodationHistoricalResolutionConflictError("selected property is ambiguous");
    }
    const propertyDayEvidence = propertyDay(propertyRows[0]);

    const assignmentRows = await tx<AssignmentRow[]>`
      SELECT jurisdiction_key,
             lower(effective)::text AS effective_from,
             upper(effective)::text AS effective_to
        FROM public.tax_assignment
       WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
         AND property_node = ${normalized.propertyNode}::uuid
         AND jurisdiction_key = ${JURISDICTION_KEY}
         AND effective @> ${normalized.businessDate}::date
       ORDER BY lower(effective), upper(effective)
    `;
    if (assignmentRows.length === 0) {
      throw new IndiaGstAccommodationHistoricalResolutionNotFoundError("India lodging tax assignment is unavailable");
    }
    if (assignmentRows.length !== 1 || !assignmentRows[0]) {
      throw new IndiaGstAccommodationHistoricalResolutionConflictError("India lodging tax assignment is ambiguous");
    }
    const assignmentEvidence = assignment(assignmentRows[0], normalized.businessDate);

    let rateVersionPair: IndiaGstAccommodationRateVersionPairResult;
    try {
      rateVersionPair = await this.#pair.resolve(tx, {
        propertyNode: normalized.propertyNode,
        predecessorExtensionId: PREDECESSOR_EXTENSION_ID,
        successorExtensionId: SUCCESSOR_EXTENSION_ID,
      });
    } catch {
      throw new IndiaGstAccommodationHistoricalResolutionConflictError(
        "governed India lodging rate history is unavailable or invalid",
      );
    }
    const selectedExtension = selectedVersion(
      rateVersionPair,
      propertyDayEvidence.fromInstant,
      propertyDayEvidence.toInstant,
    );
    const property = Object.freeze({
      propertyNode: normalized.propertyNode,
      propertyTimezone: propertyDayEvidence.propertyTimezone,
    });
    const businessDay = Object.freeze({
      businessDate: normalized.businessDate,
      fromInstant: propertyDayEvidence.fromInstant,
      toInstant: propertyDayEvidence.toInstant,
    });
    const body = Object.freeze({
      property,
      businessDay,
      assignment: assignmentEvidence,
      selectedExtension,
      rateVersionPair,
    });
    return Object.freeze({
      ...body,
      evidenceHash: evidenceHash(propertyDayEvidence.tenantId, body),
    });
  }
}
