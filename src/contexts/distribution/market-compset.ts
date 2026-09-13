/** Order472: explicitly confirmed external evidence, never operational inventory or rates. */
import { createHash } from "node:crypto";
import {
  createAuditEnvelope, IdempotencyConflictError, IdempotencyValidationError,
  PostgresIdempotency, recordFact,
  type EventBus, type ExtensionRegistry, type JsonValue, type Tx,
} from "../../kernel";
import { tryFilterMarketDiscoveryRegion, trySuggestMarketIdentity, type MarketDiscoveryRecord, type MarketDiscoveryRegion,
  type MarketDiscoveryCoordinates, type MarketIdentityMatchBasis } from "./market-discovery";
import { buildMarketSourcePlan, marketSourceRequestKey, MARKET_BATCH_SOURCE_IDS, type MarketSourcePolicy,
  type MarketSourcePlan, type PlannedMarketSourceRequest } from "./market-batches";
import type { MarketRegionalAdmission } from "./market-regional-admission";
import type { MarketRegionalArtifactCompleteness } from "./market-regional-artifact";

export const MARKET_COMPSET_EXTENSION_TYPE = "market_compset";
export const MARKET_COMPSET_READ_SCOPE = "distribution.market:read";
export const MARKET_COMPSET_WRITE_SCOPE = "distribution.market:write";
export const MARKET_COMPSET_LIMITS = Object.freeze({ maximumComparators: 500, maximumAdmissions: 16, maximumContentBytes: 8_388_608 });
export const MARKET_COMPSET_BRIDGE_LIMITS = Object.freeze({ propertyPageSize: 50, maximumCursorCharacters: 48,
  maximumPlannerComparators: 200, maximumSelectedRequests: 100, batchSize: 25, maximumSampleRequests: 10 });
const FORMAT = "yellow/market-compset/v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const WORLD = Object.freeze({ minimumLatitude: -90, maximumLatitude: 90, minimumLongitude: -180, maximumLongitude: 180 });

export interface MarketCompsetActor {
  readonly tenantId: string;
  readonly actorId: string;
  readonly propertyNode: string;
  readonly requestId: string;
  readonly scopes: readonly string[];
}
export type MarketCompsetPrincipal = Omit<MarketCompsetActor, "propertyNode">;
export interface MarketCompsetProperty { readonly id: string; readonly name: string; readonly timezone: string; readonly currency: string | null }
export interface MarketCompsetPropertyPage { readonly properties: readonly MarketCompsetProperty[]; readonly nextCursor: string | null }
export type MarketCompsetSnapshotReference = Pick<MarketCompsetReference, "logicalId" | "sha256">;
export interface MarketCompsetIdentityTarget {
  readonly recordId?: string; readonly publicUrl?: string; readonly name?: string; readonly coordinates?: MarketDiscoveryCoordinates;
}
export interface MarketCompsetIdentityCommand { readonly snapshot: MarketCompsetSnapshotReference; readonly target: MarketCompsetIdentityTarget }
export interface MarketCompsetIdentitySuggestions {
  readonly snapshot: MarketCompsetSnapshotReference;
  readonly requiresConfirmation: true;
  readonly ambiguous: boolean;
  readonly candidates: readonly (Pick<MarketCompsetEvidence, "reference" | "record" | "capturedAt" | "completeness"> & {
    readonly matchedBy: readonly MarketIdentityMatchBasis[];
  })[];
}
export type MarketCompsetPlanConditions = Pick<MarketSourcePolicy, "destination" | "lookaheadMonths" | "selectedSources" | "guests"
  | "pointOfSaleMarket" | "language" | "lengthsOfStayNights">;
export interface MarketCompsetPlanCommand {
  readonly expectedCompset: Pick<MarketCompsetVersion, "extensionId" | "version">;
  readonly comparatorIndexes: readonly number[];
  readonly conditions: MarketCompsetPlanConditions;
}
export interface MarketCompsetPlanPreview {
  readonly previewOnly: true;
  readonly executable: false;
  readonly compset: Pick<MarketCompsetVersion, "extensionId" | "version">;
  readonly conditions: MarketCompsetPlanConditions;
  readonly propertyTimezone: string;
  readonly currency: string;
  readonly comparatorMapping: readonly { readonly token: string; readonly index: number; readonly reference: MarketCompsetReference }[];
  readonly plan: Omit<MarketSourcePlan, "batches">;
  readonly sample: readonly Pick<PlannedMarketSourceRequest, "source" | "arrivalDate" | "checkoutDate" | "lengthOfStayNights" | "daysAhead" | "cadence">[];
}
export interface MarketCompsetReference {
  readonly logicalId: string;
  /** Selector into the server catalog, not a client-supplied integrity assertion. */
  readonly sha256: string;
  readonly sourceRecordId: string;
}
export interface MarketCompsetCommand {
  readonly expectedActiveVersion: number | null;
  readonly ownProperty: MarketCompsetReference;
  readonly comparators: readonly MarketCompsetReference[];
}
export interface MarketCompsetEvidence {
  readonly reference: MarketCompsetReference;
  readonly record: MarketDiscoveryRecord;
  readonly capturedAt: string;
  readonly coordinateMethod: "source-wkb-point";
  readonly completeness: MarketRegionalArtifactCompleteness;
}
export interface MarketCompsetContent {
  readonly format: typeof FORMAT;
  readonly propertyNode: string;
  readonly confirmedBy: string;
  readonly confirmedAt: string;
  readonly ownProperty: MarketCompsetEvidence;
  readonly comparators: readonly MarketCompsetEvidence[];
}
export interface MarketCompsetVersion {
  readonly extensionId: string;
  readonly version: number;
  readonly content: MarketCompsetContent;
}
export interface MarketCompsetConfirmation {
  /** A replay returns its original receipt, not a claim that this remains current. */
  readonly version: MarketCompsetVersion;
  readonly replayed: boolean;
}
export interface MarketCompsetDiscoverySnapshot {
  readonly logicalId: string;
  readonly sha256: string;
  readonly capturedAt: string;
  readonly region: MarketDiscoveryRegion;
  readonly completeness: MarketRegionalArtifactCompleteness;
  readonly records: readonly MarketDiscoveryRecord[];
}
export interface MarketCompsetDiscovery { readonly snapshots: readonly MarketCompsetDiscoverySnapshot[] }
export type MarketCompsetErrorCode = "invalid_input" | "forbidden" | "conflict" | "invalid_state" | "unavailable";
export type MarketCompsetResult<T> = Readonly<
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: Readonly<{ readonly code: MarketCompsetErrorCode; readonly message: string }> }
>;
export interface MarketCompsetDependencies {
  readonly registry: Pick<ExtensionRegistry, "createVersion">;
  readonly events: Pick<EventBus, "publish">;
  readonly idempotency?: Pick<PostgresIdempotency, "execute">;
  /** Application composition owns these admissions. Never construct from request objects. */
  readonly admissions: readonly MarketRegionalAdmission[];
}

type Plain = Record<string, unknown>;
class Failure extends Error { constructor(readonly code: MarketCompsetErrorCode) { super(code); } }
function fail(code: MarketCompsetErrorCode = "invalid_input"): never { throw new Failure(code); }
function resultError(code: MarketCompsetErrorCode): MarketCompsetResult<never> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message: "Market competitor-set operation could not complete." }) });
}
function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
function plain(value: unknown, keys: readonly string[]): Plain {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) return fail();
  const copy: Plain = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return fail();
    copy[key] = descriptor.value;
  }
  return copy;
}
function list(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) return fail();
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value as unknown;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > maximum
    || Reflect.ownKeys(value).length !== length + 1) return fail();
  const copy: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return fail();
    copy.push(descriptor.value);
  }
  return copy;
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.length || value.length > maximum * 2 || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value) || !value.isWellFormed() || [...value].length > maximum) return fail();
  return value;
}
function uuid(value: unknown): string { const string = text(value, 36); return UUID.test(string) ? string : fail(); }
function versionNumber(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 2_147_483_647 ? value : fail();
}
function instant(value: unknown): string {
  const string = text(value, 24);
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(string);
  if (!match || !Number.isFinite(Date.parse(string))) return fail();
  // Preserve the admitted source's spelling and instant; never reset evidence age.
  return new Date(string).toISOString() === `${match[1]}.${(match[2] ?? "").padEnd(3, "0")}Z` ? string : fail();
}
function reference(value: unknown): MarketCompsetReference {
  const row = plain(value, ["logicalId", "sha256", "sourceRecordId"]);
  const sha = text(row.sha256, 64);
  if (!SHA256.test(sha)) return fail();
  return Object.freeze({ logicalId: text(row.logicalId, 128), sha256: sha, sourceRecordId: text(row.sourceRecordId, 500) });
}
function command(value: unknown): MarketCompsetCommand {
  const row = plain(value, ["expectedActiveVersion", "ownProperty", "comparators"]);
  return Object.freeze({
    expectedActiveVersion: row.expectedActiveVersion === null ? null : versionNumber(row.expectedActiveVersion),
    ownProperty: reference(row.ownProperty),
    comparators: Object.freeze(list(row.comparators, MARKET_COMPSET_LIMITS.maximumComparators).map(reference)),
  });
}
function actorSnapshot(value: MarketCompsetActor): MarketCompsetActor {
  const row = plain(value, ["tenantId", "actorId", "propertyNode", "requestId", "scopes"]);
  return Object.freeze({ tenantId: uuid(row.tenantId), actorId: uuid(row.actorId), propertyNode: uuid(row.propertyNode),
    requestId: uuid(row.requestId), scopes: Object.freeze(list(row.scopes, 1_000).map(scope => text(scope, 256))) });
}
function principalSnapshot(value: MarketCompsetPrincipal): MarketCompsetPrincipal {
  const row = plain(value, ["tenantId", "actorId", "requestId", "scopes"]);
  return Object.freeze({ tenantId: uuid(row.tenantId), actorId: uuid(row.actorId), requestId: uuid(row.requestId),
    scopes: Object.freeze(list(row.scopes, 1_000).map(scope => text(scope, 256))) });
}
function snapshotReference(value: unknown): MarketCompsetSnapshotReference {
  const row = plain(value, ["logicalId", "sha256"]);
  const ref = reference({ ...row, sourceRecordId: "snapshot" });
  return Object.freeze({ logicalId: ref.logicalId, sha256: ref.sha256 });
}
function identityCommand(value: unknown): MarketCompsetIdentityCommand {
  const row = plain(value, ["snapshot", "target"]);
  if (typeof row.target !== "object" || row.target === null) fail();
  const keys = Reflect.ownKeys(row.target);
  if (!keys.length || keys.length > 4 || keys.some(key => typeof key !== "string"
    || !["recordId", "publicUrl", "name", "coordinates"].includes(key))) fail();
  const target = plain(row.target, keys as string[]);
  const copy: { recordId?: string; publicUrl?: string; name?: string; coordinates?: MarketDiscoveryCoordinates } = {};
  for (const key of ["recordId", "publicUrl", "name"] as const) if (Object.hasOwn(target, key)) copy[key] = text(target[key], 500);
  if (Object.hasOwn(target, "coordinates")) {
    const point = plain(target.coordinates, ["latitude", "longitude"]);
    if (typeof point.latitude !== "number" || typeof point.longitude !== "number") fail();
    copy.coordinates = Object.freeze({ latitude: point.latitude, longitude: point.longitude });
  }
  // Reuse the unchanged URL/coordinate/name validator without retaining input URLs.
  if (!trySuggestMarketIdentity([], { source: "overture", ...copy }).ok) fail();
  return frozen({ snapshot: snapshotReference(row.snapshot), target: copy });
}
function boundedInteger(value: unknown, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fail();
}
function planCommand(value: unknown): MarketCompsetPlanCommand {
  const row = plain(value, ["expectedCompset", "comparatorIndexes", "conditions"]);
  const expected = plain(row.expectedCompset, ["extensionId", "version"]);
  const indexes = list(row.comparatorIndexes, MARKET_COMPSET_BRIDGE_LIMITS.maximumPlannerComparators)
    .map(index => boundedInteger(index, 0, MARKET_COMPSET_LIMITS.maximumComparators - 1));
  if (!indexes.length || new Set(indexes).size !== indexes.length) fail();
  const input = plain(row.conditions, ["destination", "lookaheadMonths", "selectedSources", "guests", "pointOfSaleMarket", "language", "lengthsOfStayNights"]);
  if (input.lookaheadMonths !== 3 && input.lookaheadMonths !== 4) fail();
  const sources = list(input.selectedSources, MARKET_BATCH_SOURCE_IDS.length).map(source => {
    const found = MARKET_BATCH_SOURCE_IDS.find(candidate => candidate === source);
    return found ?? fail();
  });
  if (!sources.length || new Set(sources).size !== sources.length) fail();
  const guests = plain(input.guests, ["rooms", "adults", "childAges"]);
  const lengths = list(input.lengthsOfStayNights, 365).map(length => boundedInteger(length, 1, 365));
  if (!lengths.length || new Set(lengths).size !== lengths.length) fail();
  const conditions: MarketCompsetPlanConditions = frozen({ destination: text(input.destination, 256),
    lookaheadMonths: input.lookaheadMonths, selectedSources: sources.sort(),
    guests: { rooms: boundedInteger(guests.rooms, 1, 100), adults: boundedInteger(guests.adults, 1, 200),
      childAges: list(guests.childAges, 100).map(age => boundedInteger(age, 0, 25)).sort((a, b) => a - b) },
    pointOfSaleMarket: text(input.pointOfSaleMarket, 2).toUpperCase(),
    language: Intl.getCanonicalLocales(text(input.language, 35))[0] ?? fail(), lengthsOfStayNights: lengths.sort((a, b) => a - b) });
  // Reuse the planner's policy validator before await, without imposing a request
  // count using a hypothetical month. Actual horizon limits use the server date.
  marketSourceRequestKey({ ...conditions, tenantId: "validation", managedPropertyId: "validation", permissionScope: MARKET_COMPSET_READ_SCOPE,
    entitlement: "preview-only", propertyTimezone: "UTC", currency: "USD", competitorScope: ["validation"] },
  { source: sources[0]!, arrivalDate: "2000-01-01", lengthOfStayNights: lengths[0]! });
  return frozen({ expectedCompset: { extensionId: uuid(expected.extensionId), version: versionNumber(expected.version) },
    comparatorIndexes: indexes.sort((a, b) => a - b), conditions });
}
function propertyCursor(value: unknown): string | null {
  const row = plain(value, ["cursor"]);
  if (row.cursor === null) return null;
  const cursor = text(row.cursor, MARKET_COMPSET_BRIDGE_LIMITS.maximumCursorCharacters);
  if (!/^[A-Za-z0-9_-]{48}$/.test(cursor)) fail();
  const id = uuid(Buffer.from(cursor, "base64url").toString("utf8"));
  if (Buffer.from(id, "utf8").toString("base64url") !== cursor) fail();
  return id;
}
function completeness(value: unknown): MarketRegionalArtifactCompleteness {
  const row = plain(value, ["scope", "status", "sourceRows", "returnedRecords", "rejectedRows"]);
  if (row.scope !== "publisher-range-extract-all-places" || (row.status !== "complete" && row.status !== "incomplete")) return fail();
  for (const key of ["sourceRows", "returnedRecords", "rejectedRows"] as const) {
    if (typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0 || row[key] > 501) return fail();
  }
  const sourceRows = row.sourceRows as number;
  const returnedRecords = row.returnedRecords as number;
  const rejectedRows = row.rejectedRows as number;
  if (returnedRecords > 500 || returnedRecords + rejectedRows > sourceRows
    || (row.status === "complete" && returnedRecords + rejectedRows !== sourceRows)) return fail();
  return Object.freeze({ scope: row.scope, status: row.status, sourceRows, returnedRecords, rejectedRows });
}
function normalizedRecord(value: unknown): MarketDiscoveryRecord {
  const normalized = tryFilterMarketDiscoveryRegion([value], WORLD);
  if (!normalized.ok || normalized.value.length !== 1 || !normalized.value[0]) return fail();
  return normalized.value[0];
}
function evidence(value: unknown): MarketCompsetEvidence {
  const row = plain(value, ["reference", "record", "capturedAt", "coordinateMethod", "completeness"]);
  if (row.coordinateMethod !== "source-wkb-point") return fail();
  const ref = reference(row.reference);
  const record = normalizedRecord(row.record);
  if (record.provenance.recordId !== ref.sourceRecordId) return fail();
  return Object.freeze({ reference: ref, record, capturedAt: instant(row.capturedAt),
    coordinateMethod: row.coordinateMethod, completeness: completeness(row.completeness) });
}
function sourceIdentity(value: MarketCompsetEvidence): string {
  const { source, release, recordId } = value.record.provenance;
  return JSON.stringify([source, release, recordId]);
}
function uniqueEvidence(own: MarketCompsetEvidence, comparators: readonly MarketCompsetEvidence[]): void {
  const seen = new Set([sourceIdentity(own)]);
  for (const comparator of comparators) {
    const key = sourceIdentity(comparator);
    if (seen.has(key)) return fail();
    seen.add(key);
  }
}
function content(value: unknown, propertyNode: string): MarketCompsetContent {
  const row = plain(value, ["format", "propertyNode", "confirmedBy", "confirmedAt", "ownProperty", "comparators"]);
  if (row.format !== FORMAT || row.propertyNode !== propertyNode) return fail();
  const ownProperty = evidence(row.ownProperty);
  const comparators = list(row.comparators, MARKET_COMPSET_LIMITS.maximumComparators).map(evidence);
  uniqueEvidence(ownProperty, comparators);
  const result = frozen({ format: FORMAT as typeof FORMAT, propertyNode: uuid(row.propertyNode), confirmedBy: uuid(row.confirmedBy),
    confirmedAt: instant(row.confirmedAt), ownProperty, comparators });
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MARKET_COMPSET_LIMITS.maximumContentBytes) return fail();
  return result;
}
function version(value: unknown, propertyNode: string): MarketCompsetVersion {
  const row = plain(value, ["extensionId", "version", "content"]);
  return Object.freeze({ extensionId: uuid(row.extensionId), version: versionNumber(row.version), content: content(row.content, propertyNode) });
}

/** Pure strict command parser; references still need resolution against server admissions. */
export function tryParseMarketCompsetCommand(value: unknown): MarketCompsetResult<MarketCompsetCommand> {
  try { return Object.freeze({ ok: true, value: command(value) }); } catch { return resultError("invalid_input"); }
}
/** Historical evidence remains readable after catalog replacement, but is never silently refreshed. */
export function tryParseMarketCompsetContent(value: unknown, propertyNode: string): MarketCompsetResult<MarketCompsetContent> {
  try { return Object.freeze({ ok: true, value: content(value, uuid(propertyNode)) }); } catch { return resultError("invalid_state"); }
}

const STRING_SCHEMA = { type: "string" };
const REFERENCE_SCHEMA = { type: "object", additionalProperties: false, required: ["logicalId", "sha256", "sourceRecordId"],
  properties: { logicalId: STRING_SCHEMA, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, sourceRecordId: STRING_SCHEMA } };
const COMPLETENESS_SCHEMA = { type: "object", additionalProperties: false,
  required: ["scope", "status", "sourceRows", "returnedRecords", "rejectedRows"], properties: {
    scope: { enum: ["publisher-range-extract-all-places"] }, status: { enum: ["complete", "incomplete"] },
    sourceRows: { type: "integer", minimum: 0 }, returnedRecords: { type: "integer", minimum: 0 }, rejectedRows: { type: "integer", minimum: 0 },
  } };
const RECORD_SCHEMA = { type: "object", additionalProperties: false,
  required: ["provenance", "name", "coordinates", "address", "websites", "categories", "operatingStatus"], properties: {
    provenance: { type: "object", additionalProperties: false, required: ["source", "release", "schema", "recordId", "attribution"],
      properties: { source: STRING_SCHEMA, release: STRING_SCHEMA, schema: STRING_SCHEMA, recordId: STRING_SCHEMA, attribution: STRING_SCHEMA } },
    name: STRING_SCHEMA, coordinates: { type: "object", additionalProperties: false, required: ["latitude", "longitude"],
      properties: { latitude: { type: "number" }, longitude: { type: "number" } } },
    address: { type: ["string", "null"] }, websites: { type: "array", items: STRING_SCHEMA }, categories: { type: "array", items: STRING_SCHEMA },
    operatingStatus: { enum: ["unknown", "source-reported-open", "source-reported-closed"] },
  } };
const EVIDENCE_SCHEMA = { type: "object", additionalProperties: false,
  required: ["reference", "record", "capturedAt", "coordinateMethod", "completeness"], properties: {
    reference: REFERENCE_SCHEMA, record: RECORD_SCHEMA, capturedAt: STRING_SCHEMA,
    coordinateMethod: { enum: ["source-wkb-point"] }, completeness: COMPLETENESS_SCHEMA,
  } };
/** Registry-supported keywords only. Domain code additionally enforces bounds and relationships. */
export const MARKET_COMPSET_SCHEMA: Readonly<Record<string, unknown>> = frozen({
  $id: "yellow/market_compset/v1", type: "object", additionalProperties: false,
  required: ["format", "propertyNode", "confirmedBy", "confirmedAt", "ownProperty", "comparators"], properties: {
    format: { enum: [FORMAT] }, propertyNode: { type: "string", pattern: UUID.source },
    confirmedBy: { type: "string", pattern: UUID.source }, confirmedAt: STRING_SCHEMA,
    ownProperty: EVIDENCE_SCHEMA, comparators: { type: "array", items: EVIDENCE_SCHEMA },
  },
});

interface StoredRow { id: string; tenant_id: string; key: string; version: number; content: unknown; status: string }
type CatalogSnapshot = MarketCompsetDiscoverySnapshot;

export class MarketCompsetService {
  readonly #registry: MarketCompsetDependencies["registry"];
  readonly #events: MarketCompsetDependencies["events"];
  readonly #idempotency: Pick<PostgresIdempotency, "execute">;
  readonly #catalog: readonly CatalogSnapshot[] | null;

  constructor(dependencies: MarketCompsetDependencies) {
    this.#registry = dependencies.registry;
    this.#events = dependencies.events;
    this.#idempotency = dependencies.idempotency ?? new PostgresIdempotency();
    try {
      const admissions = list(dependencies.admissions, MARKET_COMPSET_LIMITS.maximumAdmissions) as readonly MarketRegionalAdmission[];
      if (!admissions.length) fail();
      const seen = new Set<string>();
      let totalRecords = 0;
      this.#catalog = Object.freeze(admissions.map(admission => {
        // Admission is an application capability, not raw input. Copy normalized data
        // so later mutation by composition/test code cannot alter an existing service.
        const identity = admission.identity;
        const ref = reference({ logicalId: identity.logicalId, sha256: identity.sha256, sourceRecordId: "catalog" });
        const key = JSON.stringify([ref.logicalId, ref.sha256]);
        if (seen.has(key) || admission.artifact.source.coordinateMethod !== "source-wkb-point") fail();
        seen.add(key);
        const records = tryFilterMarketDiscoveryRegion(admission.artifact.records, identity.region);
        if (!records.ok || records.value.length !== admission.artifact.records.length) fail();
        totalRecords += records.value.length;
        if (totalRecords > 500) fail();
        const bounded = completeness(admission.artifact.completeness);
        if (bounded.returnedRecords !== records.value.length) fail();
        return frozen({ logicalId: ref.logicalId, sha256: ref.sha256, region: { ...identity.region },
          capturedAt: instant(admission.artifact.source.capturedAt), completeness: bounded, records: records.value });
      }));
    } catch { this.#catalog = null; }
  }

  async #boundary<T>(tx: Tx, operation: () => Promise<T>): Promise<MarketCompsetResult<T>> {
    // Unique static-safe identifier: independent calls never shadow an outer savepoint.
    const name = `market_compset_${crypto.randomUUID().replaceAll("-", "")}`;
    await tx.unsafe(`SAVEPOINT ${name}`);
    try {
      const value = await operation();
      await tx.unsafe(`RELEASE SAVEPOINT ${name}`);
      return Object.freeze({ ok: true, value });
    } catch (error) {
      try {
        await tx.unsafe(`ROLLBACK TO SAVEPOINT ${name}`);
        await tx.unsafe(`RELEASE SAVEPOINT ${name}`);
      } catch {
        // Fatal settlement failure MUST escape: a caller that commits returned
        // Results must not commit an uncertain partial write. HTTP catches only
        // outside withTenantTransaction, which then performs full rollback.
        throw new Error("Market competitor-set transaction could not be settled");
      }
      // Bun wraps SQLSTATE as errno; code can instead be ERR_POSTGRES_SERVER_ERROR.
      const sqlState = typeof error === "object" && error !== null
        ? (Object.getOwnPropertyDescriptor(error, "errno")?.value ?? Object.getOwnPropertyDescriptor(error, "code")?.value) as unknown
        : undefined;
      return resultError(error instanceof Failure ? error.code : error instanceof IdempotencyConflictError ? "conflict"
        : error instanceof IdempotencyValidationError ? "invalid_input" : sqlState === "42501" ? "forbidden"
          : sqlState === "40001" || sqlState === "40P01" ? "conflict" : "unavailable");
    }
  }

  async #authorize(tx: Tx, actor: MarketCompsetActor, permission: string): Promise<void> {
    if (!actor.scopes.includes(permission)) fail("forbidden");
    // Migration0092 locks current active authority without broad table privileges.
    // Missing capability fails closed; there is no unlocked/fiscal fallback.
    const rows = await tx<Array<{ authorized: boolean }>>`
      SELECT public.assert_market_compset_authority(
        ${actor.tenantId}::uuid, ${actor.propertyNode}::uuid, ${actor.actorId}::uuid, ${permission}::text
      ) AS authorized
    `;
    if (rows.length !== 1 || rows[0]?.authorized !== true) fail("forbidden");
  }

  #resolve(ref: MarketCompsetReference): MarketCompsetEvidence {
    if (!this.#catalog) return fail("unavailable");
    const snapshot = this.#catalog.find(entry => entry.logicalId === ref.logicalId && entry.sha256 === ref.sha256);
    const record = snapshot?.records.find(entry => entry.provenance.recordId === ref.sourceRecordId);
    if (!snapshot || !record) return fail();
    return Object.freeze({ reference: ref, record, capturedAt: snapshot.capturedAt,
      coordinateMethod: "source-wkb-point", completeness: snapshot.completeness });
  }

  async #current(tx: Tx, actor: MarketCompsetActor): Promise<MarketCompsetVersion | null> {
    const key = `property:${actor.propertyNode}`;
    const rows = await tx<StoredRow[]>`
      SELECT id, tenant_id, key, version, content, status FROM extension
      WHERE tenant_id = ${actor.tenantId}::uuid AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = ${MARKET_COMPSET_EXTENSION_TYPE} AND key = ${key} AND status = 'active'
      LIMIT 2
    `;
    if (rows.length > 1) return fail("invalid_state");
    const row = rows[0];
    if (!row) return null;
    try {
      if (row.tenant_id !== actor.tenantId || row.key !== key || row.status !== "active") fail();
      return version({ extensionId: row.id, version: row.version, content: row.content }, actor.propertyNode);
    } catch { return fail("invalid_state"); }
  }

  async discovery(tx: Tx, context: MarketCompsetActor): Promise<MarketCompsetResult<MarketCompsetDiscovery>> {
    let actor: MarketCompsetActor;
    try { actor = actorSnapshot(context); } catch { return resultError("invalid_input"); }
    return this.#boundary(tx, async () => {
      await this.#authorize(tx, actor, MARKET_COMPSET_READ_SCOPE);
      if (!this.#catalog) return fail("unavailable");
      return Object.freeze({ snapshots: this.#catalog });
    });
  }

  async current(tx: Tx, context: MarketCompsetActor): Promise<MarketCompsetResult<MarketCompsetVersion | null>> {
    let actor: MarketCompsetActor;
    try { actor = actorSnapshot(context); } catch { return resultError("invalid_input"); }
    return this.#boundary(tx, async () => {
      await this.#authorize(tx, actor, MARKET_COMPSET_READ_SCOPE);
      return this.#current(tx, actor);
    });
  }

  async suggestIdentity(tx: Tx, context: MarketCompsetActor, input: unknown): Promise<MarketCompsetResult<MarketCompsetIdentitySuggestions>> {
    let actor: MarketCompsetActor; let parsed: MarketCompsetIdentityCommand;
    try { actor = actorSnapshot(context); parsed = identityCommand(input); } catch { return resultError("invalid_input"); }
    return this.#boundary(tx, async () => {
      await this.#authorize(tx, actor, MARKET_COMPSET_READ_SCOPE);
      if (!this.#catalog) fail("unavailable");
      const snapshot = this.#catalog.find(entry => entry.logicalId === parsed.snapshot.logicalId && entry.sha256 === parsed.snapshot.sha256);
      if (!snapshot) fail();
      const sources = new Set(snapshot.records.map(record => record.provenance.source));
      // The admitted Overture snapshot is single-source. Never select an arbitrary
      // first source if a future catalog introduces mixed identity namespaces.
      if (sources.size > 1) fail("invalid_state");
      const source = snapshot.records[0]?.provenance.source ?? "overture";
      const suggestions = trySuggestMarketIdentity(snapshot.records, { source, ...parsed.target });
      if (!suggestions.ok) fail();
      return frozen({ snapshot: parsed.snapshot, requiresConfirmation: true as const, ambiguous: suggestions.value.ambiguous,
        candidates: suggestions.value.suggestions.map(suggestion => ({
          reference: { ...parsed.snapshot, sourceRecordId: suggestion.record.provenance.recordId }, record: suggestion.record,
          matchedBy: suggestion.matchedBy, capturedAt: snapshot.capturedAt, completeness: snapshot.completeness,
        })) });
    });
  }

  async previewPlan(tx: Tx, context: MarketCompsetActor, input: unknown): Promise<MarketCompsetResult<MarketCompsetPlanPreview>> {
    let actor: MarketCompsetActor; let parsed: MarketCompsetPlanCommand;
    try { actor = actorSnapshot(context); parsed = planCommand(input); } catch { return resultError("invalid_input"); }
    return this.#boundary(tx, async () => {
      await this.#authorize(tx, actor, MARKET_COMPSET_READ_SCOPE);
      // Same lock and order as confirm/createVersion: expected state cannot race
      // confirmation while this transaction derives a preview from saved evidence.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`extension-version:${actor.tenantId}:${MARKET_COMPSET_EXTENSION_TYPE}:property:${actor.propertyNode}`}, 0))`;
      const current = await this.#current(tx, actor);
      if (!current || current.extensionId !== parsed.expectedCompset.extensionId || current.version !== parsed.expectedCompset.version) fail("conflict");
      const comparatorMapping = parsed.comparatorIndexes.map(index => {
        const selected = current.content.comparators[index];
        if (!selected) fail();
        // Token identity includes the saved version and own-property evidence;
        // labels never stand in for source identity or supplier-native property IDs.
        const token = `evidence:${createHash("sha256").update(JSON.stringify([
          actor.tenantId, actor.propertyNode, current.extensionId, current.version,
          current.content.ownProperty.reference, sourceIdentity(current.content.ownProperty),
          selected.reference, sourceIdentity(selected),
        ])).digest("hex")}`;
        return Object.freeze({ token, index, reference: selected.reference });
      });
      const rows = await tx<Array<{ timezone: string | null; currency: string | null; as_of_utc: string }>>`
        SELECT timezone, currency, to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS as_of_utc
        FROM org_node WHERE tenant_id=${actor.tenantId}::uuid AND tenant_id=current_setting('app.tenant_id',true)::uuid
          AND id=${actor.propertyNode}::uuid AND kind='property' LIMIT 2
      `;
      const metadata = rows[0];
      if (rows.length !== 1 || !metadata || typeof metadata.timezone !== "string" || !metadata.timezone
        || typeof metadata.currency !== "string" || !/^[A-Z]{3}$/.test(metadata.currency)) fail("invalid_state");
      let now: string;
      try {
        now = instant(metadata.as_of_utc);
        new Intl.DateTimeFormat("en", { timeZone: metadata.timezone }).format(0);
      } catch { return fail("invalid_state"); }
      let planned: MarketSourcePlan;
      try {
        planned = buildMarketSourcePlan({ ...parsed.conditions, tenantId: actor.tenantId, managedPropertyId: actor.propertyNode,
          permissionScope: MARKET_COMPSET_READ_SCOPE, entitlement: "preview-only", propertyTimezone: metadata.timezone,
          currency: metadata.currency, competitorScope: comparatorMapping.map(item => item.token) },
        { now, maxBatchSize: MARKET_COMPSET_BRIDGE_LIMITS.batchSize, maxRequestsThisRun: MARKET_COMPSET_BRIDGE_LIMITS.maximumSelectedRequests });
      } catch { return fail("invalid_input"); }
      const { batches, ...summary } = planned;
      return frozen({ previewOnly: true as const, executable: false as const, compset: parsed.expectedCompset, conditions: parsed.conditions,
        propertyTimezone: metadata.timezone, currency: metadata.currency, comparatorMapping, plan: summary,
        sample: batches.flatMap(batch => batch.requests).slice(0, MARKET_COMPSET_BRIDGE_LIMITS.maximumSampleRequests)
          .map(({ source, arrivalDate, checkoutDate, lengthOfStayNights, daysAhead, cadence }) =>
            ({ source, arrivalDate, checkoutDate, lengthOfStayNights, daysAhead, cadence })) });
    });
  }

  async properties(tx: Tx, context: MarketCompsetPrincipal, input: unknown): Promise<MarketCompsetResult<MarketCompsetPropertyPage>> {
    let principal: MarketCompsetPrincipal; let cursor: string | null;
    try { principal = principalSnapshot(context); cursor = propertyCursor(input); } catch { return resultError("invalid_input"); }
    return this.#boundary(tx, async () => {
      if (!principal.scopes.includes(MARKET_COMPSET_READ_SCOPE)) fail("forbidden");
      const active = await tx<Array<{ active: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM tenant t JOIN app_user a ON a.tenant_id=t.id
          WHERE t.id=${principal.tenantId}::uuid AND t.id=current_setting('app.tenant_id',true)::uuid
            AND session_user='yellow_runtime' AND current_user='app_role'
            AND t.status='active' AND a.id=${principal.actorId}::uuid AND a.status='active') AS active
      `;
      if (active.length !== 1 || active[0]?.active !== true) fail("forbidden");
      // Navigation-only snapshot, not a reusable grant. Repeat active predicates
      // in this SELECT; every selected-property operation still locks via0092.
      const rows = await tx<MarketCompsetProperty[]>`
        SELECT target.id, target.name, target.timezone, target.currency
        FROM org_node target
        JOIN tenant t ON t.id=target.tenant_id AND t.status='active'
        JOIN app_user a ON a.tenant_id=t.id AND a.id=${principal.actorId}::uuid AND a.status='active'
        WHERE target.tenant_id=${principal.tenantId}::uuid AND target.tenant_id=current_setting('app.tenant_id',true)::uuid
          AND target.kind='property' AND (${cursor}::uuid IS NULL OR target.id > ${cursor}::uuid)
          AND EXISTS(SELECT 1 FROM user_role ur JOIN role r ON r.tenant_id=ur.tenant_id AND r.id=ur.role_id
            JOIN role_permission rp ON rp.role_id=r.id AND rp.permission_code=${MARKET_COMPSET_READ_SCOPE}
            JOIN org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node AND scope.path @> target.path
            WHERE ur.tenant_id=target.tenant_id AND ur.user_id=a.id)
        ORDER BY target.id LIMIT 51
      `;
      if (rows.length > MARKET_COMPSET_BRIDGE_LIMITS.propertyPageSize + 1) fail("invalid_state");
      const properties: MarketCompsetProperty[] = [];
      let previous = cursor;
      try {
        for (const row of rows) {
          const id = uuid(row.id);
          if (previous !== null && id <= previous) fail();
          previous = id;
          const timezone = text(row.timezone, 128);
          new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
          if (row.currency !== null && (typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency))) fail();
          properties.push(Object.freeze({ id, name: text(row.name, 500), timezone, currency: row.currency }));
        }
      } catch { return fail("invalid_state"); }
      const page = properties.slice(0, MARKET_COMPSET_BRIDGE_LIMITS.propertyPageSize);
      const last = page.at(-1);
      return frozen({ properties: page, nextCursor: rows.length > page.length && last ? Buffer.from(last.id, "utf8").toString("base64url") : null });
    });
  }

  async confirm(tx: Tx, context: MarketCompsetActor, input: unknown, idempotencyKey: string): Promise<MarketCompsetResult<MarketCompsetConfirmation>> {
    let actor: MarketCompsetActor;
    let parsed: MarketCompsetCommand;
    try { actor = actorSnapshot(context); parsed = command(input); } catch { return resultError("invalid_input"); }
    return this.#boundary(tx, async () => {
      await this.#authorize(tx, actor, MARKET_COMPSET_WRITE_SCOPE);
      const receipt = await this.#idempotency.execute<JsonValue>(tx, {
        tenantId: actor.tenantId, operation: "distribution.market.compset.confirm", key: idempotencyKey,
        request: { actorId: actor.actorId, propertyNode: actor.propertyNode, command: parsed },
      }, async commandTx => {
        const key = `property:${actor.propertyNode}`;
        const lockKey = `extension-version:${actor.tenantId}:${MARKET_COMPSET_EXTENSION_TYPE}:${key}`;
        await commandTx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const previous = await this.#current(commandTx, actor);
        if ((previous?.version ?? null) !== parsed.expectedActiveVersion) return fail("conflict");
        const ownProperty = this.#resolve(parsed.ownProperty);
        const comparators = parsed.comparators.map(ref => this.#resolve(ref));
        uniqueEvidence(ownProperty, comparators);
        const times = await commandTx<Array<{ confirmed_at: string }>>`
          SELECT to_char(transaction_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS confirmed_at
        `;
        const nextContent = content({ format: FORMAT, propertyNode: actor.propertyNode, confirmedBy: actor.actorId,
          confirmedAt: times[0]?.confirmed_at, ownProperty, comparators }, actor.propertyNode);
        const envelope = createAuditEnvelope({ tenantId: actor.tenantId, actorId: actor.actorId, propertyNode: actor.propertyNode,
          requestId: actor.requestId, operation: "market_compset.drafted" });
        const created = await this.#registry.createVersion(commandTx, {
          type: MARKET_COMPSET_EXTENSION_TYPE, key, content: { ...nextContent }, status: "draft", envelope,
          factPayload: { property_node: actor.propertyNode, previous_active_version: previous?.version ?? null },
        });
        if (created.tenantId !== actor.tenantId || created.key !== key || created.type !== MARKET_COMPSET_EXTENSION_TYPE || created.status !== "draft") fail("invalid_state");
        if (previous) {
          const retired = await commandTx<Array<{ id: string }>>`
            UPDATE extension SET status = 'retired'
            WHERE tenant_id = ${actor.tenantId}::uuid AND tenant_id = current_setting('app.tenant_id', true)::uuid
              AND id = ${previous.extensionId}::uuid AND type = ${MARKET_COMPSET_EXTENSION_TYPE} AND key = ${key}
              AND version = ${previous.version} AND status = 'active' RETURNING id
          `;
          if (retired.length !== 1) return fail("conflict");
          await recordFact(commandTx, { entityType: "extension", entityId: previous.extensionId,
            envelope: { ...envelope, operation: "market_compset.retired" },
            payload: { property_node: actor.propertyNode, extension_version: previous.version, replaced_by_version: created.version } });
        }
        const activated = await commandTx<StoredRow[]>`
          UPDATE extension SET status = 'active'
          WHERE tenant_id = ${actor.tenantId}::uuid AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND id = ${created.id}::uuid AND type = ${MARKET_COMPSET_EXTENSION_TYPE} AND key = ${key}
            AND version = ${created.version} AND status = 'draft'
          RETURNING id, tenant_id, key, version, content, status
        `;
        if (activated.length !== 1 || !activated[0]) return fail("conflict");
        const confirmed = version({ extensionId: activated[0].id, version: activated[0].version, content: activated[0].content }, actor.propertyNode);
        const fact = await recordFact(commandTx, { entityType: "extension", entityId: created.id,
          envelope: { ...envelope, operation: "market_compset.confirmed" },
          payload: { property_node: actor.propertyNode, extension_version: created.version, previous_active_version: previous?.version ?? null,
            content_sha256: new Bun.CryptoHasher("sha256").update(JSON.stringify(confirmed.content)).digest("hex") } });
        await this.#events.publish(commandTx, { tenantId: actor.tenantId, propertyNode: actor.propertyNode,
          businessDate: fact.businessDate, aggregateType: "extension", aggregateId: created.id, eventType: "extension.activated",
          actorId: actor.actorId, correlationId: actor.requestId,
          payload: { type: MARKET_COMPSET_EXTENSION_TYPE, key, version: created.version } });
        return { status: 201, body: JSON.parse(JSON.stringify(confirmed)) as JsonValue };
      });
      let confirmed: MarketCompsetVersion;
      try { confirmed = version(receipt.body, actor.propertyNode); } catch { return fail("invalid_state"); }
      if (confirmed.content.confirmedBy !== actor.actorId) return fail("invalid_state");
      return Object.freeze({ version: confirmed, replayed: receipt.replayed });
    });
  }
}
