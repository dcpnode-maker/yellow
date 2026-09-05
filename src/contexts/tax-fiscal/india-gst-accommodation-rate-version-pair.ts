import { types as utilTypes } from "node:util";

import type { ExtensionInstance, Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/;

const CUTOVER_INSTANT = "2025-09-21T18:30:00.000000Z";
const PREDECESSOR_FROM = "2022-07-17T18:30:00.000000Z";
const SUCCESSOR_FROM = CUTOVER_INSTANT;
const PREDECESSOR_SOURCE_HASH =
  "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const NOTIFICATION_04_2022_SOURCE_HASH =
  "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SUCCESSOR_SOURCE_HASH =
  "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";

const INPUT_KEYS = ["propertyNode", "predecessorExtensionId", "successorExtensionId"] as const;
const PROPERTY_KEYS = ["tenant_id"] as const;
const EXTENSION_KEYS = ["id", "tenantId", "type", "key", "version", "content", "status"] as const;
const PERIOD_KEYS = ["extensionId", "ownerTenantId", "effectiveFromInstant", "effectiveToInstant"] as const;
const GST_ROOM_KEYS = ["code", "name", "mode", "slab_basis", "applies_to", "slabs"] as const;
const SLAB_KEYS = ["upto_minor", "rate", "itc_eligible"] as const;

type JsonRecord = Record<string, unknown>;
/** The service deliberately treats registry responses as untrusted boundary values. */
type VisibleRegistry = {
  readonly listVisible: (tenantId: string) => Promise<readonly unknown[]>;
  readonly readVisibleEffectivePeriod: (tenantId: string, extensionId: string) => Promise<unknown>;
};

export interface IndiaGstAccommodationRateVersionPairInput {
  readonly propertyNode: string;
  readonly predecessorExtensionId: string;
  readonly successorExtensionId: string;
}

export interface IndiaGstAccommodationRateSlabEvidence {
  readonly uptoMinor: number | null;
  readonly rate: number;
  readonly itcEligible: boolean;
}

export interface IndiaGstAccommodationRateVersionEvidence {
  readonly extensionId: string;
  readonly key: "in-gst-lodging";
  readonly version: 1 | 2;
  readonly status: "retired" | "active";
  readonly effectiveFromInstant: string;
  readonly effectiveToInstant: string | null;
  readonly content: Readonly<Record<string, unknown>>;
  readonly contentHash: string;
  readonly gstRoomSlabs: readonly [IndiaGstAccommodationRateSlabEvidence, IndiaGstAccommodationRateSlabEvidence];
}

export interface IndiaGstAccommodationRateVersionPairResult {
  readonly propertyNode: string;
  readonly predecessor: IndiaGstAccommodationRateVersionEvidence;
  readonly successor: IndiaGstAccommodationRateVersionEvidence;
  readonly cutoverInstant: typeof CUTOVER_INSTANT;
  readonly statutoryLowerBandDelta: Readonly<{
    readonly thresholdMinor: 750000;
    readonly predecessorRate: 0.12;
    readonly predecessorItcEligible: true;
    readonly successorRate: 0.05;
    readonly successorItcEligible: false;
    readonly predecessorHasNilBand: false;
    readonly successorHasNilBand: false;
  }>;
  readonly sourceHashes: Readonly<{
    readonly notification20_2019: typeof PREDECESSOR_SOURCE_HASH;
    readonly notification04_2022: typeof NOTIFICATION_04_2022_SOURCE_HASH;
    readonly notification15_2025: typeof SUCCESSOR_SOURCE_HASH;
  }>;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationRateVersionPairValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationRateVersionPairValidationError";
  }
}

export class IndiaGstAccommodationRateVersionPairNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationRateVersionPairNotFoundError";
  }
}

export class IndiaGstAccommodationRateVersionPairConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationRateVersionPairConflictError";
  }
}

function exactRecord(value: unknown, keys: readonly string[], subject: string, ErrorType: new (message: string) => Error): JsonRecord {
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

function uuid(value: unknown, subject: string, ErrorType: new (message: string) => Error): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new ErrorType(`${subject} must be a canonical UUID`);
  return value;
}

function validDate(year: number, month: number, day: number): boolean {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (monthDays[month - 1] ?? 0);
}

function instant(value: unknown, subject: string): string {
  if (typeof value !== "string") throw new IndiaGstAccommodationRateVersionPairConflictError(`${subject} is invalid`);
  const match = UTC_INSTANT.exec(value);
  if (!match || !validDate(Number(match[1]), Number(match[2]), Number(match[3]))
      || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) {
    throw new IndiaGstAccommodationRateVersionPairConflictError(`${subject} must be a canonical UTC instant`);
  }
  return value;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown, ancestors = new Set<object>(), depth = 0): { value: unknown; encoded: string } {
  if (depth > 64) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content is too deeply nested");
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { value, encoded: JSON.stringify(value) };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content contains a non-finite number");
    const normalized = Object.is(value, -0) ? 0 : value;
    return { value: normalized, encoded: JSON.stringify(normalized) };
  }
  if (typeof value !== "object" || ancestors.has(value) || utilTypes.isProxy(value)) {
    throw new IndiaGstAccommodationRateVersionPairConflictError("extension content is not canonical JSON");
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length !== 0) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content arrays must not contain symbol keys");
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content arrays must be dense");
      const items = value.map((item) => canonicalJson(item, ancestors, depth + 1));
      return { value: Object.freeze(items.map((item) => item.value)), encoded: `[${items.map((item) => item.encoded).join(",")}]` };
    }
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content objects must be plain records");
    if (Object.getOwnPropertySymbols(value).length !== 0) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content objects must not contain symbol keys");
    const output: JsonRecord = {};
    const fields: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor)) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content objects must contain data fields only");
      const item = canonicalJson(descriptor.value, ancestors, depth + 1);
      output[key] = item.value;
      fields.push(`${JSON.stringify(key)}:${item.encoded}`);
    }
    return { value: Object.freeze(output), encoded: `{${fields.join(",")}}` };
  } finally {
    ancestors.delete(value);
  }
}

function input(raw: unknown): IndiaGstAccommodationRateVersionPairInput {
  const value = exactRecord(raw, INPUT_KEYS, "rate-version pair input", IndiaGstAccommodationRateVersionPairValidationError);
  return Object.freeze({
    propertyNode: uuid(value.propertyNode, "propertyNode", IndiaGstAccommodationRateVersionPairValidationError),
    predecessorExtensionId: uuid(value.predecessorExtensionId, "predecessorExtensionId", IndiaGstAccommodationRateVersionPairValidationError),
    successorExtensionId: uuid(value.successorExtensionId, "successorExtensionId", IndiaGstAccommodationRateVersionPairValidationError),
  });
}

function propertyTenant(row: unknown): string {
  const value = exactRecord(row, PROPERTY_KEYS, "property evidence", IndiaGstAccommodationRateVersionPairConflictError);
  return uuid(value.tenant_id, "property tenant id", IndiaGstAccommodationRateVersionPairConflictError);
}

function visibleEntry(value: unknown, tenantId: string): ExtensionInstance {
  const row = exactRecord(value, EXTENSION_KEYS, "visible extension", IndiaGstAccommodationRateVersionPairConflictError);
  const id = uuid(row.id, "visible extension id", IndiaGstAccommodationRateVersionPairConflictError);
  const owner = row.tenantId === null ? null : uuid(row.tenantId, "visible extension owner tenant id", IndiaGstAccommodationRateVersionPairConflictError);
  if (owner !== null && owner !== tenantId) throw new IndiaGstAccommodationRateVersionPairConflictError("visible extension belongs to another tenant");
  if (typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1) throw new IndiaGstAccommodationRateVersionPairConflictError("visible extension version is invalid");
  if (typeof row.type !== "string" || typeof row.key !== "string" || typeof row.status !== "string") throw new IndiaGstAccommodationRateVersionPairConflictError("visible extension identity is invalid");
  return { id, tenantId: owner, type: row.type, key: row.key, version: row.version, content: row.content as Readonly<Record<string, unknown>>, status: row.status as ExtensionInstance["status"] };
}

function selectedExtension(value: ExtensionInstance): ExtensionInstance {
  if (value.type !== "tax_jurisdiction" || value.key !== "in-gst-lodging") throw new IndiaGstAccommodationRateVersionPairConflictError("visible extension is not the India lodging jurisdiction");
  if (value.status !== "retired" && value.status !== "active") throw new IndiaGstAccommodationRateVersionPairConflictError("visible extension status is invalid");
  return value;
}

function period(value: unknown, selected: ExtensionInstance): { readonly from: string; readonly to: string | null } {
  const row = exactRecord(value, PERIOD_KEYS, "extension effective period", IndiaGstAccommodationRateVersionPairConflictError);
  if (uuid(row.extensionId, "effective-period extension id", IndiaGstAccommodationRateVersionPairConflictError) !== selected.id) throw new IndiaGstAccommodationRateVersionPairConflictError("effective-period extension identity changed");
  const owner = row.ownerTenantId === null ? null : uuid(row.ownerTenantId, "effective-period owner tenant id", IndiaGstAccommodationRateVersionPairConflictError);
  if (owner !== selected.tenantId) throw new IndiaGstAccommodationRateVersionPairConflictError("effective-period owner identity changed");
  const from = instant(row.effectiveFromInstant, "effective-period lower bound");
  const to = row.effectiveToInstant === null ? null : instant(row.effectiveToInstant, "effective-period upper bound");
  if (to !== null && from >= to) throw new IndiaGstAccommodationRateVersionPairConflictError("effective period is not increasing");
  return { from, to };
}

function numberValue(value: unknown, subject: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new IndiaGstAccommodationRateVersionPairConflictError(`${subject} is invalid`);
  return value;
}

function gstSlabs(content: Readonly<Record<string, unknown>>, expectedRate: 0.12 | 0.05): readonly [IndiaGstAccommodationRateSlabEvidence, IndiaGstAccommodationRateSlabEvidence] {
  const contentKeys = Object.keys(content).sort();
  if (contentKeys.length !== 4 || contentKeys.some((key, index) => key !== ["country", "price_display", "rounding", "taxes"][index])) throw new IndiaGstAccommodationRateVersionPairConflictError("India lodging content shape is invalid");
  if (content.country !== "IN" || content.price_display !== "tax_exclusive" || content.rounding !== "document" || !Array.isArray(content.taxes)) throw new IndiaGstAccommodationRateVersionPairConflictError("India lodging content envelope is invalid");
  const matches = content.taxes.filter((tax) => typeof tax === "object" && tax !== null && !Array.isArray(tax) && (tax as JsonRecord).code === "GST_ROOM");
  if (matches.length !== 1) throw new IndiaGstAccommodationRateVersionPairConflictError("India lodging content must contain one GST_ROOM definition");
  const tax = exactRecord(matches[0], GST_ROOM_KEYS, "GST_ROOM definition", IndiaGstAccommodationRateVersionPairConflictError);
  if (tax.code !== "GST_ROOM" || tax.name !== "GST on accommodation" || tax.mode !== "slab_percent" || tax.slab_basis !== "transaction_value" || !Array.isArray(tax.applies_to) || tax.applies_to.length !== 1 || tax.applies_to[0] !== "room_revenue" || !Array.isArray(tax.slabs) || tax.slabs.length !== 2) throw new IndiaGstAccommodationRateVersionPairConflictError("GST_ROOM definition does not match the accommodation contract");
  const slabs = tax.slabs.map((slab, index) => {
    const row = exactRecord(slab, SLAB_KEYS, `GST_ROOM slab ${index}`, IndiaGstAccommodationRateVersionPairConflictError);
    const uptoMinor = row.upto_minor === null ? null : row.upto_minor;
    if (uptoMinor !== null && (typeof uptoMinor !== "number" || !Number.isSafeInteger(uptoMinor) || uptoMinor < 0)) throw new IndiaGstAccommodationRateVersionPairConflictError("GST_ROOM slab threshold is invalid");
    if (typeof row.itc_eligible !== "boolean") throw new IndiaGstAccommodationRateVersionPairConflictError("GST_ROOM slab ITC flag is invalid");
    return { uptoMinor, rate: numberValue(row.rate, "GST_ROOM slab rate"), itcEligible: row.itc_eligible };
  });
  const lower = slabs[0];
  const upper = slabs[1];
  if (!lower || !upper || lower.uptoMinor !== 750000 || lower.rate !== expectedRate || lower.itcEligible !== (expectedRate === 0.12) || upper.uptoMinor !== null || upper.rate !== 0.18 || upper.itcEligible !== true) throw new IndiaGstAccommodationRateVersionPairConflictError("GST_ROOM slabs do not match the governed India accommodation rates");
  return Object.freeze([Object.freeze(lower), Object.freeze(upper)] as const);
}

function evidence(selected: ExtensionInstance, bounds: { readonly from: string; readonly to: string | null }, expectedRate: 0.12 | 0.05): IndiaGstAccommodationRateVersionEvidence {
  const canonical = canonicalJson(selected.content);
  if (typeof canonical.value !== "object" || canonical.value === null || Array.isArray(canonical.value)) throw new IndiaGstAccommodationRateVersionPairConflictError("extension content is not an object");
  const content = canonical.value as Readonly<Record<string, unknown>>;
  const slabs = gstSlabs(content, expectedRate);
  return Object.freeze({ extensionId: selected.id, key: "in-gst-lodging" as const, version: selected.version as 1 | 2, status: selected.status as "retired" | "active", effectiveFromInstant: bounds.from, effectiveToInstant: bounds.to, content, contentHash: sha256(canonical.encoded), gstRoomSlabs: slabs });
}

function evidenceHash(tenantId: string, body: Omit<IndiaGstAccommodationRateVersionPairResult, "evidenceHash">, predecessorOwnerTenantId: string | null, successorOwnerTenantId: string | null): string {
  // Ownership is authority-bearing evidence but is deliberately retained only in
  // the hash preimage so serialized pair evidence cannot disclose tenant identity.
  const canonical = canonicalJson({ tenantId, predecessorOwnerTenantId, successorOwnerTenantId, ...body });
  return sha256(canonical.encoded);
}

export class IndiaGstAccommodationRateVersionPairService {
  readonly #registry: VisibleRegistry;

  constructor(registry: VisibleRegistry) {
    if (typeof registry !== "object" || registry === null || utilTypes.isProxy(registry)
        || typeof registry.listVisible !== "function"
        || typeof registry.readVisibleEffectivePeriod !== "function") {
      throw new IndiaGstAccommodationRateVersionPairValidationError("extension registry is unavailable");
    }
    this.#registry = registry;
  }

  async resolve(tx: Tx, raw: IndiaGstAccommodationRateVersionPairInput): Promise<IndiaGstAccommodationRateVersionPairResult> {
    if (typeof tx !== "function") throw new IndiaGstAccommodationRateVersionPairValidationError("tenant transaction is unavailable");
    const normalized = input(raw);
    if (normalized.predecessorExtensionId === normalized.successorExtensionId) throw new IndiaGstAccommodationRateVersionPairConflictError("predecessor and successor extension ids must differ");

    const propertyRows = await tx<Array<{ readonly tenant_id: string }>>`
      SELECT property.tenant_id::text AS tenant_id
        FROM public.org_node AS property
        JOIN public.tenant AS tenant ON tenant.id = property.tenant_id
       WHERE property.id = ${normalized.propertyNode}::uuid
         AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND property.kind = 'property'
         AND tenant.status = 'active'
    `;
    if (propertyRows.length === 0) throw new IndiaGstAccommodationRateVersionPairNotFoundError("selected property is unavailable");
    if (propertyRows.length !== 1 || !propertyRows[0]) throw new IndiaGstAccommodationRateVersionPairConflictError("selected property is ambiguous");
    const tenantId = propertyTenant(propertyRows[0]);

    let visible: readonly unknown[];
    try {
      visible = await this.#registry.listVisible(tenantId);
    } catch {
      throw new IndiaGstAccommodationRateVersionPairConflictError("visible extension registry is unavailable");
    }
    if (!Array.isArray(visible) || utilTypes.isProxy(visible)) {
      throw new IndiaGstAccommodationRateVersionPairConflictError(
        "visible extension registry returned an invalid collection",
      );
    }
    const candidates = visible.map((candidate) => visibleEntry(candidate, tenantId));
    const predecessorMatches = candidates.filter((candidate) => candidate.id === normalized.predecessorExtensionId);
    const successorMatches = candidates.filter((candidate) => candidate.id === normalized.successorExtensionId);
    if (predecessorMatches.length === 0 || successorMatches.length === 0) throw new IndiaGstAccommodationRateVersionPairNotFoundError("selected accommodation rate-version pair is unavailable");
    if (predecessorMatches.length !== 1 || successorMatches.length !== 1) throw new IndiaGstAccommodationRateVersionPairConflictError("selected accommodation rate-version pair is ambiguous");
    const predecessor = selectedExtension(predecessorMatches[0]!);
    const successor = selectedExtension(successorMatches[0]!);
    if (predecessor.status !== "retired" || successor.status !== "active" || predecessor.version !== 1 || successor.version !== 2 || predecessor.tenantId !== successor.tenantId || predecessor.type !== successor.type || predecessor.key !== successor.key) throw new IndiaGstAccommodationRateVersionPairConflictError("selected extensions are not the governed retired predecessor and active successor");

    let predecessorPeriod: unknown;
    let successorPeriod: unknown;
    try {
      predecessorPeriod = await this.#registry.readVisibleEffectivePeriod(tenantId, predecessor.id);
      successorPeriod = await this.#registry.readVisibleEffectivePeriod(tenantId, successor.id);
    } catch {
      throw new IndiaGstAccommodationRateVersionPairConflictError("selected extension effective period is unavailable");
    }
    const predecessorBounds = period(predecessorPeriod, predecessor);
    const successorBounds = period(successorPeriod, successor);
    if (predecessorBounds.from !== PREDECESSOR_FROM || predecessorBounds.to !== CUTOVER_INSTANT || successorBounds.from !== SUCCESSOR_FROM || successorBounds.to !== null) throw new IndiaGstAccommodationRateVersionPairConflictError("selected extension periods do not match the governed Kolkata cutover");

    const predecessorEvidence = evidence(predecessor, predecessorBounds, 0.12);
    const successorEvidence = evidence(successor, successorBounds, 0.05);
    const body = {
      propertyNode: normalized.propertyNode,
      predecessor: predecessorEvidence,
      successor: successorEvidence,
      cutoverInstant: CUTOVER_INSTANT as typeof CUTOVER_INSTANT,
      statutoryLowerBandDelta: Object.freeze({ thresholdMinor: 750000 as const, predecessorRate: 0.12 as const, predecessorItcEligible: true as const, successorRate: 0.05 as const, successorItcEligible: false as const, predecessorHasNilBand: false as const, successorHasNilBand: false as const }),
      sourceHashes: Object.freeze({ notification20_2019: PREDECESSOR_SOURCE_HASH as typeof PREDECESSOR_SOURCE_HASH, notification04_2022: NOTIFICATION_04_2022_SOURCE_HASH as typeof NOTIFICATION_04_2022_SOURCE_HASH, notification15_2025: SUCCESSOR_SOURCE_HASH as typeof SUCCESSOR_SOURCE_HASH }),
    };
    return Object.freeze({ ...body, evidenceHash: evidenceHash(tenantId, body, predecessor.tenantId, successor.tenantId) });
  }
}
