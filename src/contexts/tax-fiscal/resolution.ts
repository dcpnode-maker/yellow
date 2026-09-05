import type {
  ExtensionInstance,
  ExtensionRegistry,
  Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/;
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const MAX_CONTENT_DEPTH = 64;
const MAX_CONTENT_NODES = 10_000;
const MAX_CANONICAL_BYTES = 1_048_576;

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

interface CanonicalState {
  nodes: number;
  bytes: number;
  readonly ancestors: Set<object>;
}

interface CanonicalValue {
  readonly value: unknown;
  readonly encoded: string;
}

type VisibleExtensionRegistry = Pick<ExtensionRegistry, "listVisible" | "readVisibleEffectivePeriod">;
type VisibleExtensionEffectivePeriod = Awaited<
  ReturnType<VisibleExtensionRegistry["readVisibleEffectivePeriod"]>
>;

export interface ResolveTaxJurisdictionInput {
  readonly propertyNode: string;
  readonly businessDate: string;
}

export interface TaxAssignmentResolutionEvidence {
  readonly jurisdictionKey: string;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly evidenceRef: string;
}

export interface TaxJurisdictionResolutionEvidence {
  readonly extensionId: string;
  readonly ownerTenantId: string | null;
  readonly key: string;
  readonly version: number;
  readonly content: Readonly<Record<string, unknown>>;
  readonly contentHash: string;
  readonly effectiveFromInstant: string | null;
  readonly effectiveToInstant: string | null;
  readonly evidenceRef: string;
}

export interface UnassignedTaxJurisdictionResolution {
  readonly state: "unassigned";
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly propertyTimezone: string;
  readonly businessDayFromInstant: string;
  readonly businessDayToInstant: string;
}

export interface ResolvedTaxJurisdictionResolution {
  readonly state: "resolved";
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly propertyTimezone: string;
  readonly businessDayFromInstant: string;
  readonly businessDayToInstant: string;
  readonly assignment: TaxAssignmentResolutionEvidence;
  readonly jurisdiction: TaxJurisdictionResolutionEvidence;
}

export type TaxJurisdictionResolutionResult =
  | UnassignedTaxJurisdictionResolution
  | ResolvedTaxJurisdictionResolution;

function fail(message: string): never {
  throw new Error(`Tax jurisdiction resolution failed: ${message}`);
}

function requirePlainRecord(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${subject} must be a plain record`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`${subject} must be a plain record`);
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    fail(`${subject} must not contain symbol keys`);
  }
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[], subject: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${subject} has unexpected fields`);
  }
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      fail(`${subject} must contain data fields only`);
    }
  }
}

function requireUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) fail(`${subject} must be a canonical UUID`);
  return value;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function requireDate(value: unknown, subject: string): string {
  if (typeof value !== "string") fail(`${subject} must be YYYY-MM-DD`);
  const match = DATE.exec(value);
  if (!match) fail(`${subject} must be YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) fail(`${subject} is not a calendar date`);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > (daysInMonth[month - 1] ?? 0)) fail(`${subject} is not a calendar date`);
  return value;
}

function requireCanonicalUtcInstant(value: unknown, subject: string): string {
  if (typeof value !== "string") fail(`${subject} must be a canonical UTC instant`);
  const match = UTC_INSTANT.exec(value);
  if (!match) fail(`${subject} must be a canonical UTC instant`);
  requireDate(`${match[1]}-${match[2]}-${match[3]}`, subject);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) {
    fail(`${subject} must be a canonical UTC instant`);
  }
  return value;
}

function normalizePropertyDay(row: PropertyDayRow) {
  requirePlainRecord(row, "property-day evidence");
  requireExactKeys(row, ["tenant_id", "property_timezone", "business_day_from_instant",
    "business_day_to_instant"], "property-day evidence");
  const tenantId = requireUuid(row.tenant_id, "database tenant id");
  if (typeof row.property_timezone !== "string" || row.property_timezone.length === 0
      || row.property_timezone.trim() !== row.property_timezone) {
    fail("property timezone is invalid");
  }
  const businessDayFromInstant = requireCanonicalUtcInstant(
    row.business_day_from_instant, "business-day lower bound");
  const businessDayToInstant = requireCanonicalUtcInstant(
    row.business_day_to_instant, "business-day upper bound");
  if (businessDayFromInstant >= businessDayToInstant) {
    fail("business-day bounds are not an increasing period");
  }
  return { tenantId, propertyTimezone: row.property_timezone,
    businessDayFromInstant, businessDayToInstant };
}

function requireJurisdictionKey(value: unknown, subject: string): string {
  if (typeof value !== "string" || !JURISDICTION_KEY.test(value)) {
    fail(`${subject} must be a stable lowercase key`);
  }
  return value;
}

function requireVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    fail("extension version is invalid");
  }
  return value;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function addCanonicalBytes(state: CanonicalState, encoded: string): void {
  state.bytes += new TextEncoder().encode(encoded).byteLength;
  if (state.bytes > MAX_CANONICAL_BYTES) fail("extension content is too large");
}

function copyCanonicalJson(value: unknown, state: CanonicalState, depth = 0): CanonicalValue {
  if (depth > MAX_CONTENT_DEPTH) fail("extension content is too deeply nested");
  state.nodes += 1;
  if (state.nodes > MAX_CONTENT_NODES) fail("extension content contains too many values");

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    const encoded = JSON.stringify(value);
    addCanonicalBytes(state, encoded);
    return { value, encoded };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("extension content numbers must be finite");
    const encoded = JSON.stringify(value);
    addCanonicalBytes(state, encoded);
    return { value: Object.is(value, -0) ? 0 : value, encoded };
  }
  if (typeof value !== "object") fail("extension content must contain only JSON values");
  if (state.ancestors.has(value)) fail("extension content must not contain cycles");

  state.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length !== 0) {
        fail("extension content arrays must not contain symbol keys");
      }
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
        fail("extension content arrays must be dense and contain no named properties");
      }
      const copied: unknown[] = [];
      const encodedItems: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          fail("extension content arrays must contain data elements only");
        }
        const item = copyCanonicalJson(descriptor.value, state, depth + 1);
        copied.push(item.value);
        encodedItems.push(item.encoded);
      }
      const encoded = `[${encodedItems.join(",")}]`;
      addCanonicalBytes(state, "[]" + ",".repeat(Math.max(0, encodedItems.length - 1)));
      return { value: Object.freeze(copied), encoded };
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("extension content objects must be plain records");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      fail("extension content objects must not contain symbol keys");
    }
    const copied: Record<string, unknown> = {};
    const encodedFields: string[] = [];
    for (const key of Object.keys(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        fail("extension content objects must contain data fields only");
      }
      const item = copyCanonicalJson(descriptor.value, state, depth + 1);
      Object.defineProperty(copied, key, {
        configurable: true,
        enumerable: true,
        value: item.value,
        writable: true,
      });
      const encodedKey = JSON.stringify(key);
      addCanonicalBytes(state, encodedKey);
      encodedFields.push(`${encodedKey}:${item.encoded}`);
    }
    const encoded = `{${encodedFields.join(",")}}`;
    addCanonicalBytes(state, "{}" + ":,".repeat(Math.max(0, encodedFields.length - 1)) + (encodedFields.length > 0 ? ":" : ""));
    return { value: Object.freeze(copied), encoded };
  } finally {
    state.ancestors.delete(value);
  }
}

function canonicalContent(value: unknown): { readonly content: Readonly<Record<string, unknown>>; readonly encoded: string } {
  requirePlainRecord(value, "extension content");
  const copied = copyCanonicalJson(value, { nodes: 0, bytes: 0, ancestors: new Set<object>() });
  return { content: copied.value as Readonly<Record<string, unknown>>, encoded: copied.encoded };
}

function evidenceRef(kind: "tax-assignment" | "tax-jurisdiction", value: unknown): string {
  const canonical = copyCanonicalJson(value, { nodes: 0, bytes: 0, ancestors: new Set<object>() });
  return `${kind}:${sha256(canonical.encoded)}`;
}

function normalizeInput(input: ResolveTaxJurisdictionInput): ResolveTaxJurisdictionInput {
  requirePlainRecord(input, "input");
  requireExactKeys(input, ["propertyNode", "businessDate"], "input");
  return Object.freeze({
    propertyNode: requireUuid(input.propertyNode, "propertyNode"),
    businessDate: requireDate(input.businessDate, "businessDate"),
  });
}

function normalizeAssignment(row: AssignmentRow, businessDate: string): Omit<TaxAssignmentResolutionEvidence, "evidenceRef"> {
  requirePlainRecord(row, "stored assignment");
  const jurisdictionKey = requireJurisdictionKey(row.jurisdiction_key, "stored jurisdiction key");
  const effectiveFrom = row.effective_from === null
    ? null
    : requireDate(row.effective_from, "stored assignment lower bound");
  const effectiveTo = row.effective_to === null
    ? null
    : requireDate(row.effective_to, "stored assignment upper bound");
  if ((effectiveFrom !== null && effectiveFrom > businessDate)
      || (effectiveTo !== null && effectiveTo <= businessDate)
      || (effectiveFrom !== null && effectiveTo !== null && effectiveFrom >= effectiveTo)) {
    fail("stored assignment bounds do not contain the business date");
  }
  return { jurisdictionKey, effectiveFrom, effectiveTo };
}

function normalizeExtension(
  extension: ExtensionInstance,
  tenantId: string,
  jurisdictionKey: string,
): Omit<TaxJurisdictionResolutionEvidence, "evidenceRef" | "effectiveFromInstant" | "effectiveToInstant"> {
  requirePlainRecord(extension, "visible extension");
  const extensionId = requireUuid(extension.id, "extension id");
  const ownerTenantId = extension.tenantId === null
    ? null
    : requireUuid(extension.tenantId, "extension owner tenant id");
  if (ownerTenantId !== null && ownerTenantId !== tenantId) {
    fail("visible extension belongs to another tenant");
  }
  if (extension.type !== "tax_jurisdiction" || extension.status !== "active") {
    fail("visible extension match is not active tax jurisdiction content");
  }
  const key = requireJurisdictionKey(extension.key, "extension key");
  if (key !== jurisdictionKey) fail("visible extension key changed during resolution");
  const version = requireVersion(extension.version);
  const { content, encoded } = canonicalContent(extension.content);
  return { extensionId, ownerTenantId, key, version, content, contentHash: sha256(encoded) };
}


function normalizeEffectivePeriod(
  period: VisibleExtensionEffectivePeriod,
  selected: Omit<TaxJurisdictionResolutionEvidence, "evidenceRef" | "effectiveFromInstant" | "effectiveToInstant">,
): Pick<TaxJurisdictionResolutionEvidence, "effectiveFromInstant" | "effectiveToInstant"> {
  requirePlainRecord(period, "visible extension effective period");
  requireExactKeys(period, [
    "extensionId",
    "ownerTenantId",
    "effectiveFromInstant",
    "effectiveToInstant",
  ], "visible extension effective period");
  const extensionId = requireUuid(period.extensionId, "effective-period extension id");
  const ownerTenantId = period.ownerTenantId === null
    ? null
    : requireUuid(period.ownerTenantId, "effective-period owner tenant id");
  if (extensionId !== selected.extensionId || ownerTenantId !== selected.ownerTenantId) {
    fail("extension identity changed while reading its effective period");
  }
  const effectiveFromInstant = period.effectiveFromInstant === null
    ? null
    : requireCanonicalUtcInstant(period.effectiveFromInstant, "extension effective lower bound");
  const effectiveToInstant = period.effectiveToInstant === null
    ? null
    : requireCanonicalUtcInstant(period.effectiveToInstant, "extension effective upper bound");
  if (effectiveFromInstant !== null && effectiveToInstant !== null
      && effectiveFromInstant >= effectiveToInstant) {
    fail("extension effective bounds are not an increasing period");
  }
  return { effectiveFromInstant, effectiveToInstant };
}

function requireWholeBusinessDayContainment(
  period: Pick<TaxJurisdictionResolutionEvidence, "effectiveFromInstant" | "effectiveToInstant">,
  businessDayFromInstant: string,
  businessDayToInstant: string,
): void {
  if (period.effectiveFromInstant !== null
      && period.effectiveFromInstant > businessDayFromInstant) {
    fail("extension effective period does not contain the whole property business day");
  }
  if (period.effectiveToInstant !== null
      && period.effectiveToInstant < businessDayToInstant) {
    fail("extension effective period does not contain the whole property business day");
  }
}

export class TaxJurisdictionResolutionService {
  readonly #registry: VisibleExtensionRegistry;

  constructor(registry: VisibleExtensionRegistry) {
    if (typeof registry !== "object" || registry === null
        || typeof registry.listVisible !== "function"
        || typeof registry.readVisibleEffectivePeriod !== "function") {
      fail("extension registry is unavailable");
    }
    this.#registry = registry;
  }

  async resolve(tx: Tx, input: ResolveTaxJurisdictionInput): Promise<TaxJurisdictionResolutionResult> {
    if (typeof tx !== "function") fail("tenant transaction is unavailable");
    const normalized = normalizeInput(input);

    const propertyRows = await tx<PropertyDayRow[]>`
      SELECT property.tenant_id::text AS tenant_id,
             property.timezone AS property_timezone,
             to_char((${normalized.businessDate}::date::timestamp AT TIME ZONE property.timezone)
               AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS business_day_from_instant,
             to_char(((((${normalized.businessDate}::date + 1)::date)::timestamp
               AT TIME ZONE property.timezone) AT TIME ZONE 'UTC'),
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS business_day_to_instant
      FROM org_node AS property
      JOIN tenant ON tenant.id = property.tenant_id
      WHERE property.id = ${normalized.propertyNode}::uuid
        AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property.kind = 'property'
        AND tenant.status = 'active'
    `;
    if (propertyRows.length !== 1) fail("property is unavailable");
    const { tenantId, propertyTimezone, businessDayFromInstant, businessDayToInstant } =
      normalizePropertyDay(propertyRows[0]!);

    const assignmentRows = await tx<AssignmentRow[]>`
      SELECT jurisdiction_key,
             lower(effective)::text AS effective_from,
             upper(effective)::text AS effective_to
      FROM tax_assignment
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${normalized.propertyNode}::uuid
        AND effective @> ${normalized.businessDate}::date
      ORDER BY lower(effective), upper(effective), jurisdiction_key
    `;
    if (assignmentRows.length > 1) fail("multiple assignments contain the business date");
    const assignmentRow = assignmentRows[0];
    if (!assignmentRow) {
      return Object.freeze({
        state: "unassigned",
        tenantId,
        propertyNode: normalized.propertyNode,
        businessDate: normalized.businessDate,
        propertyTimezone,
        businessDayFromInstant,
        businessDayToInstant,
      });
    }

    const assignmentValue = normalizeAssignment(assignmentRow, normalized.businessDate);
    const assignment = Object.freeze({
      ...assignmentValue,
      evidenceRef: evidenceRef("tax-assignment", {
        tenantId,
        propertyNode: normalized.propertyNode,
        businessDate: normalized.businessDate,
        propertyTimezone,
        businessDayFromInstant,
        businessDayToInstant,
        ...assignmentValue,
      }),
    });

    const visible = await this.#registry.listVisible(tenantId);
    if (!Array.isArray(visible)) fail("extension registry returned an invalid collection");
    const activeMatches = visible.filter((candidate): candidate is ExtensionInstance => {
      if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
        fail("extension registry returned an invalid entry");
      }
      return candidate.type === "tax_jurisdiction"
        && candidate.key === assignment.jurisdictionKey
        && candidate.status === "active";
    });
    if (activeMatches.length !== 1) {
      fail(activeMatches.length === 0
        ? "active jurisdiction extension is unavailable"
        : "multiple active jurisdiction extensions are visible");
    }

    const jurisdictionValue = normalizeExtension(
      activeMatches[0]!,
      tenantId,
      assignment.jurisdictionKey,
    );
    const effectivePeriod = normalizeEffectivePeriod(
      await this.#registry.readVisibleEffectivePeriod(tenantId, jurisdictionValue.extensionId),
      jurisdictionValue,
    );
    requireWholeBusinessDayContainment(
      effectivePeriod,
      businessDayFromInstant,
      businessDayToInstant,
    );
    const jurisdiction = Object.freeze({
      ...jurisdictionValue,
      ...effectivePeriod,
      evidenceRef: evidenceRef("tax-jurisdiction", {
        extensionId: jurisdictionValue.extensionId,
        ownerTenantId: jurisdictionValue.ownerTenantId,
        key: jurisdictionValue.key,
        version: jurisdictionValue.version,
        contentHash: jurisdictionValue.contentHash,
        propertyTimezone,
        businessDayFromInstant,
        businessDayToInstant,
        ...effectivePeriod,
      }),
    });

    return Object.freeze({
      state: "resolved",
      tenantId,
      propertyNode: normalized.propertyNode,
      businessDate: normalized.businessDate,
      propertyTimezone,
      businessDayFromInstant,
      businessDayToInstant,
      assignment,
      jurisdiction,
    });
  }
}
