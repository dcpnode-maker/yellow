import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PIN = /^[1-9][0-9]{5}$/;
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);
const INPUT_KEYS = ["tenantId", "propertyNode"] as const;
const ROW_KEYS = [
  "tenant_id",
  "property_node",
  "country_code",
  "state_code",
  "address_line1",
  "locality",
  "pin",
] as const;

interface PropertyFiscalLocationRow {
  readonly tenant_id: string;
  readonly property_node: string;
  readonly country_code: string;
  readonly state_code: string;
  readonly address_line1: string;
  readonly locality: string;
  readonly pin: string;
}

export interface IndiaGstPropertyLocationInput {
  readonly tenantId: string;
  readonly propertyNode: string;
}

export interface IndiaGstPropertyLocationResult {
  readonly propertyNode: string;
  readonly countryCode: "IN";
  readonly stateCode: string;
  readonly addressLine1: string;
  readonly locality: string;
  readonly pin: string;
  readonly evidenceHash: string;
}

export class IndiaGstPropertyLocationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstPropertyLocationValidationError";
  }
}

export class IndiaGstPropertyLocationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstPropertyLocationNotFoundError";
  }
}

export class IndiaGstPropertyLocationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstPropertyLocationConflictError";
  }
}

function exactPlainInput(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) {
    throw new IndiaGstPropertyLocationValidationError(
      "India property fiscal-location input must be an exact plain object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...INPUT_KEYS].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaGstPropertyLocationValidationError(
      "India property fiscal-location input shape is invalid",
    );
  }
  return value as Record<string, unknown>;
}

function inputUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstPropertyLocationValidationError(
      `${subject} must be a canonical UUID`,
    );
  }
  return value;
}

function normalizeInput(value: unknown): IndiaGstPropertyLocationInput {
  const input = exactPlainInput(value);
  return Object.freeze({
    tenantId: inputUuid(input.tenantId, "tenantId"),
    propertyNode: inputUuid(input.propertyNode, "propertyNode"),
  });
}

function exactStoredRow(value: unknown): PropertyFiscalLocationRow {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) {
    throw new IndiaGstPropertyLocationConflictError(
      "stored property fiscal-location row is invalid",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...ROW_KEYS].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaGstPropertyLocationConflictError(
      "stored property fiscal-location row shape is invalid",
    );
  }
  return value as PropertyFiscalLocationRow;
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstPropertyLocationConflictError(`${subject} is invalid`);
  }
  return value;
}

function storedText(value: unknown, subject: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new IndiaGstPropertyLocationConflictError(`${subject} is not canonical`);
  }
  return value;
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstPropertyLocationInput,
): IndiaGstPropertyLocationResult {
  const row = exactStoredRow(candidate);
  const tenantId = storedUuid(row.tenant_id, "stored fiscal-location tenant id");
  const propertyNode = storedUuid(
    row.property_node,
    "stored fiscal-location property node",
  );
  if (tenantId !== input.tenantId || propertyNode !== input.propertyNode) {
    throw new IndiaGstPropertyLocationConflictError(
      "stored property fiscal location conflicts with the selected identity",
    );
  }
  if (row.country_code !== "IN") {
    throw new IndiaGstPropertyLocationConflictError(
      "stored property fiscal-location country is invalid",
    );
  }
  if (typeof row.state_code !== "string" || !GST_STATE_CODES.has(row.state_code)) {
    throw new IndiaGstPropertyLocationConflictError(
      "stored property fiscal-location state code is invalid",
    );
  }
  const addressLine1 = storedText(
    row.address_line1,
    "property fiscal-location address line1",
    100,
  );
  const locality = storedText(
    row.locality,
    "property fiscal-location locality",
    50,
  );
  if (typeof row.pin !== "string" || !PIN.test(row.pin)) {
    throw new IndiaGstPropertyLocationConflictError(
      "stored property fiscal-location PIN is invalid",
    );
  }

  const evidence = {
    tenantId,
    propertyNode,
    countryCode: "IN" as const,
    stateCode: row.state_code,
    addressLine1,
    locality,
    pin: row.pin,
  };
  const evidenceHash = new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(evidence))
    .digest("hex");
  return Object.freeze({
    propertyNode,
    countryCode: "IN",
    stateCode: row.state_code,
    addressLine1,
    locality,
    pin: row.pin,
    evidenceHash,
  });
}

async function readExactLocation(
  tx: Tx,
  input: IndiaGstPropertyLocationInput,
): Promise<IndiaGstPropertyLocationResult> {
  const rows = await tx<PropertyFiscalLocationRow[]>`
    SELECT location.tenant_id::text AS tenant_id,
           location.property_node::text AS property_node,
           location.country_code::text AS country_code,
           location.state_code,
           location.address_line1,
           location.locality,
           location.pin
      FROM public.property_fiscal_location AS location
      JOIN public.org_node AS property
        ON property.tenant_id = location.tenant_id
       AND property.id = location.property_node
       AND property.kind = 'property'
     WHERE location.tenant_id = ${input.tenantId}::uuid
       AND location.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND location.property_node = ${input.propertyNode}::uuid
       AND location.country_code = 'IN'::char(2)
     ORDER BY location.property_node
  `;
  if (rows.length === 0) {
    throw new IndiaGstPropertyLocationNotFoundError(
      "selected India property fiscal location is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new IndiaGstPropertyLocationConflictError(
      "selected India property fiscal location is ambiguous",
    );
  }
  return canonicalResult(rows[0], input);
}

export class IndiaGstPropertyLocationService {
  async resolve(
    tx: Tx,
    input: IndiaGstPropertyLocationInput,
  ): Promise<IndiaGstPropertyLocationResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstPropertyLocationValidationError(
        "tenant transaction is unavailable",
      );
    }
    return readExactLocation(tx, normalizeInput(input));
  }
}
