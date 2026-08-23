const RECORD_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const STABLE_KEY = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const OFFSET_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

type JsonObject = Record<string, unknown>;

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const CHANNEL_ROLES = Object.freeze([
  "ota", "str_ota", "metasearch", "b2b_wholesaler", "corporate", "direct", "other",
] as const);
const TOPICS = Object.freeze([
  "pricing", "inventory", "restriction", "promotion", "visibility", "ranking", "commission",
  "payment", "cancellation", "content", "review", "connectivity", "shopper_journey", "str",
  "compliance", "other",
] as const);
const EVIDENCE_STATES = Object.freeze([
  "verified", "observed", "contract_specific", "auth_gated", "inferred", "unknown", "deprecated",
] as const);
const SOURCE_TYPES = Object.freeze([
  "official_api", "official_partner", "official_help", "official_filing", "authorized_connector",
  "public_journey", "licensed_data", "secondary",
] as const);
const APPLICABILITY_SCOPES = Object.freeze([
  "global", "region", "market", "property_type", "account", "contract", "shopper_context",
] as const);
const ACCESS_CLASSES = Object.freeze([
  "shopper_observed", "partner_manual", "api_read_book", "supplier_api_write", "pull_or_ad_feed", "unknown",
] as const);
const AUTHORIZATION_CLASSES = Object.freeze([
  "public", "commercial_agreement", "account_permission", "certification", "unknown",
] as const);
const PERMITTED_USES = Object.freeze(["model_development", "product_design", "research", "retrieval"] as const);

export const OTA_INTEGRATION_PATTERNS = Object.freeze([
  "push_ari",
  "pull_quote_plus_change_notice",
  "metasearch_feed",
  "buyer_distribution",
  "channel_manager",
  "extranet",
  "reseller_distribution",
  "lead_marketplace",
  "none",
  "unknown",
] as const);

export const OTA_RESEARCH_AUTHORITY = Object.freeze({
  researchOnly: true as const,
  liveExecutionAuthority: false as const,
  tenantContractAuthority: false as const,
  adapterCapabilityAuthority: false as const,
});

export type OtaChannelRole = typeof CHANNEL_ROLES[number];
export type OtaKnowledgeTopic = typeof TOPICS[number];
export type OtaEvidenceState = typeof EVIDENCE_STATES[number];
export type OtaSourceType = typeof SOURCE_TYPES[number];
export type OtaApplicabilityScope = typeof APPLICABILITY_SCOPES[number];
export type OtaAccessClass = typeof ACCESS_CLASSES[number];
export type OtaIntegrationPattern = typeof OTA_INTEGRATION_PATTERNS[number];
export type OtaAuthorizationClass = typeof AUTHORIZATION_CLASSES[number];
export type OtaPermittedUse = typeof PERMITTED_USES[number];

export interface OtaKnowledgeRecord {
  readonly recordId: string;
  readonly schemaVersion: 1;
  readonly channel: Readonly<{ group: string; brand: string; role: OtaChannelRole }>;
  readonly topic: OtaKnowledgeTopic;
  readonly claim: string;
  readonly evidenceState: OtaEvidenceState;
  readonly source: Readonly<{
    type: OtaSourceType;
    title: string;
    url: string;
    retrievedAt: string;
  }>;
  readonly observedAt: string;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly reviewDueAt: string;
  readonly confidenceBasisPoints: number;
  readonly applicability: Readonly<{
    scope: OtaApplicabilityScope;
    regions: readonly string[];
    propertyTypes: readonly string[];
    shopperContextKeys: readonly string[];
  }>;
  readonly capability: Readonly<{
    accessClass: OtaAccessClass;
    integrationPattern: OtaIntegrationPattern;
    authorization: OtaAuthorizationClass;
    documentedRead: boolean;
    documentedWrite: boolean;
    certificationRequired: boolean;
    version: string | null;
    granularity: readonly string[];
    constraints: readonly string[];
    fallbacks: readonly string[];
  }>;
  readonly unknowns: readonly string[];
  readonly rights: Readonly<{
    permittedUses: readonly OtaPermittedUse[];
    containsPersonalData: false;
    containsContractData: false;
  }>;
  readonly authority: typeof OTA_RESEARCH_AUTHORITY;
}

export class OtaKnowledgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtaKnowledgeError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, subject: string): JsonObject {
  if (!isObject(value)) throw new OtaKnowledgeError(`${subject} must be an object`);
  return value;
}

function requireOnlyKeys(value: JsonObject, allowed: readonly string[], subject: string): void {
  const keys = Object.keys(value);
  const expected = new Set(allowed);
  if (keys.length !== allowed.length || keys.some((key) => !expected.has(key))) {
    throw new OtaKnowledgeError(`${subject} must contain exactly the supported fields`);
  }
}

function requireText(value: unknown, subject: string, maximum: number, minimum = 1): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || value.trim() !== value || CONTROL.test(value)) {
    throw new OtaKnowledgeError(`${subject} must be bounded trimmed text without control characters`);
  }
  return value;
}

function requireStableKey(value: unknown, subject: string, maximum = 128): string {
  const key = requireText(value, subject, maximum);
  if (!STABLE_KEY.test(key)) throw new OtaKnowledgeError(`${subject} must be a canonical lowercase key`);
  return key;
}

function requireEnum<const T extends readonly string[]>(value: unknown, allowed: T, subject: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    throw new OtaKnowledgeError(`${subject} is not supported`);
  }
  return value as T[number];
}

function requireBoolean(value: unknown, subject: string): boolean {
  if (typeof value !== "boolean") throw new OtaKnowledgeError(`${subject} must be boolean`);
  return value;
}

function requireNullableText(value: unknown, subject: string, maximum: number): string | null {
  return value === null ? null : requireText(value, subject, maximum);
}

function sortedTextSet(
  value: unknown,
  subject: string,
  maximumItems = 32,
  keyOnly = false,
): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new OtaKnowledgeError(`${subject} must be a bounded array`);
  }
  const normalized = value.map((item, index) => keyOnly
    ? requireStableKey(item, `${subject} ${index}`, 64)
    : requireText(item, `${subject} ${index}`, 200));
  if (new Set(normalized).size !== normalized.length) {
    throw new OtaKnowledgeError(`${subject} must not contain duplicates`);
  }
  return Object.freeze([...normalized].sort(compareCodePoints));
}

function canonicalOffsetInstant(value: unknown, subject: string): { value: string; epoch: number } {
  const raw = requireText(value, subject, 40);
  const match = raw.match(OFFSET_INSTANT);
  if (!match) throw new OtaKnowledgeError(`${subject} must be an offset-aware ISO instant`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, zone] = match;
  if (
    yearText === undefined || monthText === undefined || dayText === undefined
    || hourText === undefined || minuteText === undefined || secondText === undefined
    || zone === undefined
  ) {
    throw new OtaKnowledgeError(`${subject} must be an offset-aware ISO instant`);
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number((fractionText ?? "").padEnd(3, "0"));
  const localEpoch = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const local = new Date(localEpoch);
  if (
    local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day
    || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second
    || local.getUTCMilliseconds() !== millisecond
  ) {
    throw new OtaKnowledgeError(`${subject} contains an impossible calendar instant`);
  }
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new OtaKnowledgeError(`${subject} offset must be within plus or minus 14 hours`);
    }
    offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
  }
  const epoch = localEpoch - offsetMinutes * 60_000;
  if (!Number.isFinite(epoch)) throw new OtaKnowledgeError(`${subject} is outside the supported instant range`);
  const fraction = millisecond.toString().padStart(3, "0");
  return {
    value: `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}.${fraction}${zone}`,
    epoch,
  };
}

function requireHttpsUrl(value: unknown, subject: string): string {
  const raw = requireText(value, subject, 2_048);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new OtaKnowledgeError(`${subject} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.hash !== "") {
    throw new OtaKnowledgeError(`${subject} must be HTTPS without credentials or fragment`);
  }
  return parsed.toString();
}

function normalizeChannel(value: unknown): OtaKnowledgeRecord["channel"] {
  const source = requireObject(value, "channel");
  requireOnlyKeys(source, ["group", "brand", "role"], "channel");
  return Object.freeze({
    group: requireText(source.group, "channel.group", 120),
    brand: requireText(source.brand, "channel.brand", 120),
    role: requireEnum(source.role, CHANNEL_ROLES, "channel.role"),
  });
}

function normalizeSource(value: unknown): OtaKnowledgeRecord["source"] {
  const source = requireObject(value, "source");
  requireOnlyKeys(source, ["type", "title", "url", "retrievedAt"], "source");
  return Object.freeze({
    type: requireEnum(source.type, SOURCE_TYPES, "source.type"),
    title: requireText(source.title, "source.title", 240),
    url: requireHttpsUrl(source.url, "source.url"),
    retrievedAt: canonicalOffsetInstant(source.retrievedAt, "source.retrievedAt").value,
  });
}

function normalizeApplicability(value: unknown): OtaKnowledgeRecord["applicability"] {
  const source = requireObject(value, "applicability");
  requireOnlyKeys(source, ["scope", "regions", "propertyTypes", "shopperContextKeys"], "applicability");
  return Object.freeze({
    scope: requireEnum(source.scope, APPLICABILITY_SCOPES, "applicability.scope"),
    regions: sortedTextSet(source.regions, "applicability.regions"),
    propertyTypes: sortedTextSet(source.propertyTypes, "applicability.propertyTypes", 32, true),
    shopperContextKeys: sortedTextSet(source.shopperContextKeys, "applicability.shopperContextKeys", 32, true),
  });
}

function normalizeCapability(value: unknown): OtaKnowledgeRecord["capability"] {
  const source = requireObject(value, "capability");
  requireOnlyKeys(source, [
    "accessClass", "integrationPattern", "authorization", "documentedRead", "documentedWrite",
    "certificationRequired", "version", "granularity", "constraints", "fallbacks",
  ], "capability");
  return Object.freeze({
    accessClass: requireEnum(source.accessClass, ACCESS_CLASSES, "capability.accessClass"),
    integrationPattern: requireEnum(source.integrationPattern, OTA_INTEGRATION_PATTERNS, "capability.integrationPattern"),
    authorization: requireEnum(source.authorization, AUTHORIZATION_CLASSES, "capability.authorization"),
    documentedRead: requireBoolean(source.documentedRead, "capability.documentedRead"),
    documentedWrite: requireBoolean(source.documentedWrite, "capability.documentedWrite"),
    certificationRequired: requireBoolean(source.certificationRequired, "capability.certificationRequired"),
    version: requireNullableText(source.version, "capability.version", 80),
    granularity: sortedTextSet(source.granularity, "capability.granularity", 32, true),
    constraints: sortedTextSet(source.constraints, "capability.constraints"),
    fallbacks: sortedTextSet(source.fallbacks, "capability.fallbacks", 32, true),
  });
}

function normalizeRights(value: unknown): OtaKnowledgeRecord["rights"] {
  const source = requireObject(value, "rights");
  requireOnlyKeys(source, ["permittedUses", "containsPersonalData", "containsContractData"], "rights");
  if (source.containsPersonalData !== false || source.containsContractData !== false) {
    throw new OtaKnowledgeError("shared OTA research must not contain personal or tenant-contract data");
  }
  if (!Array.isArray(source.permittedUses) || source.permittedUses.length < 1 || source.permittedUses.length > 4) {
    throw new OtaKnowledgeError("rights.permittedUses must be a non-empty bounded array");
  }
  const permittedUses = source.permittedUses.map((item) => requireEnum(item, PERMITTED_USES, "rights.permittedUses"));
  if (new Set(permittedUses).size !== permittedUses.length) {
    throw new OtaKnowledgeError("rights.permittedUses must not contain duplicates");
  }
  return Object.freeze({
    permittedUses: Object.freeze([...permittedUses].sort(compareCodePoints)),
    containsPersonalData: false,
    containsContractData: false,
  });
}

function assertEvidenceSemantics(record: OtaKnowledgeRecord): void {
  const official = new Set<OtaSourceType>(["official_api", "official_partner", "official_help", "official_filing"]);
  const observed = new Set<OtaSourceType>(["authorized_connector", "public_journey"]);
  if (record.evidenceState === "verified" && !official.has(record.source.type)) {
    throw new OtaKnowledgeError("verified evidence requires an official primary source");
  }
  if (record.evidenceState === "observed" && !observed.has(record.source.type)) {
    throw new OtaKnowledgeError("observed evidence requires an authorized connector or public journey");
  }
  if (record.evidenceState === "inferred" && record.capability.documentedWrite) {
    throw new OtaKnowledgeError("inferred evidence cannot claim documented writes");
  }
  if (observed.has(record.source.type) && record.capability.accessClass === "supplier_api_write") {
    throw new OtaKnowledgeError("connector or public-journey evidence cannot claim supplier API writes");
  }
  if (record.capability.accessClass === "supplier_api_write"
    && (record.source.type !== "official_api" || record.evidenceState !== "verified")) {
    throw new OtaKnowledgeError("supplier API write claims require verified official API evidence");
  }
  if (record.capability.certificationRequired
    && (record.capability.authorization === "public" || record.capability.authorization === "unknown")) {
    throw new OtaKnowledgeError("certification-required evidence needs non-public authorization");
  }
  switch (record.capability.integrationPattern) {
    case "push_ari":
      if (
        record.source.type !== "official_api" || record.evidenceState !== "verified"
        || record.capability.accessClass !== "supplier_api_write"
        || record.capability.authorization === "public" || record.capability.authorization === "unknown"
        || record.capability.version === null
      ) {
        throw new OtaKnowledgeError("push_ari requires versioned verified official supplier-write evidence");
      }
      break;
    case "buyer_distribution":
      if (record.capability.accessClass !== "api_read_book" || !record.capability.documentedRead || record.capability.documentedWrite) {
        throw new OtaKnowledgeError("buyer_distribution is read/book access and cannot claim supplier writes");
      }
      break;
    case "lead_marketplace":
      if (record.capability.accessClass !== "partner_manual" || record.capability.documentedWrite) {
        throw new OtaKnowledgeError("lead_marketplace is manual lead evidence without booking or ARI writes");
      }
      break;
    case "none":
      if (record.capability.documentedWrite) throw new OtaKnowledgeError("none cannot claim documented writes");
      break;
    case "pull_quote_plus_change_notice":
    case "metasearch_feed":
    case "channel_manager":
    case "extranet":
    case "reseller_distribution":
    case "unknown":
      break;
  }
}

export function normalizeOtaKnowledgeRecord(value: unknown): OtaKnowledgeRecord {
  const source = requireObject(value, "OTA knowledge record");
  requireOnlyKeys(source, [
    "recordId", "schemaVersion", "channel", "topic", "claim", "evidenceState", "source", "observedAt",
    "effectiveFrom", "effectiveTo", "reviewDueAt", "confidenceBasisPoints", "applicability", "capability",
    "unknowns", "rights",
  ], "OTA knowledge record");
  const recordId = requireText(source.recordId, "recordId", 128);
  if (!RECORD_ID.test(recordId)) throw new OtaKnowledgeError("recordId must be a canonical lowercase identifier");
  if (source.schemaVersion !== 1) throw new OtaKnowledgeError("schemaVersion must be 1");
  if (!Number.isSafeInteger(source.confidenceBasisPoints)
    || (source.confidenceBasisPoints as number) < 0 || (source.confidenceBasisPoints as number) > 10_000) {
    throw new OtaKnowledgeError("confidenceBasisPoints must be an integer from 0 through 10000");
  }
  const observedAt = canonicalOffsetInstant(source.observedAt, "observedAt");
  const reviewDueAt = canonicalOffsetInstant(source.reviewDueAt, "reviewDueAt");
  if (reviewDueAt.epoch <= observedAt.epoch) throw new OtaKnowledgeError("reviewDueAt must be after observedAt");
  const effectiveFrom = source.effectiveFrom === null
    ? null
    : canonicalOffsetInstant(source.effectiveFrom, "effectiveFrom");
  const effectiveTo = source.effectiveTo === null
    ? null
    : canonicalOffsetInstant(source.effectiveTo, "effectiveTo");
  if (effectiveFrom && effectiveTo && effectiveTo.epoch <= effectiveFrom.epoch) {
    throw new OtaKnowledgeError("effectiveTo must be after effectiveFrom");
  }
  const record: OtaKnowledgeRecord = Object.freeze({
    recordId,
    schemaVersion: 1,
    channel: normalizeChannel(source.channel),
    topic: requireEnum(source.topic, TOPICS, "topic"),
    claim: requireText(source.claim, "claim", 2_000, 8),
    evidenceState: requireEnum(source.evidenceState, EVIDENCE_STATES, "evidenceState"),
    source: normalizeSource(source.source),
    observedAt: observedAt.value,
    effectiveFrom: effectiveFrom?.value ?? null,
    effectiveTo: effectiveTo?.value ?? null,
    reviewDueAt: reviewDueAt.value,
    confidenceBasisPoints: source.confidenceBasisPoints as number,
    applicability: normalizeApplicability(source.applicability),
    capability: normalizeCapability(source.capability),
    unknowns: sortedTextSet(source.unknowns, "unknowns"),
    rights: normalizeRights(source.rights),
    authority: OTA_RESEARCH_AUTHORITY,
  });
  assertEvidenceSemantics(record);
  return record;
}

function inputFromRecord(value: OtaKnowledgeRecord): JsonObject {
  return {
    recordId: value.recordId,
    schemaVersion: value.schemaVersion,
    channel: { ...value.channel },
    topic: value.topic,
    claim: value.claim,
    evidenceState: value.evidenceState,
    source: { ...value.source },
    observedAt: value.observedAt,
    effectiveFrom: value.effectiveFrom,
    effectiveTo: value.effectiveTo,
    reviewDueAt: value.reviewDueAt,
    confidenceBasisPoints: value.confidenceBasisPoints,
    applicability: {
      scope: value.applicability.scope,
      regions: [...value.applicability.regions],
      propertyTypes: [...value.applicability.propertyTypes],
      shopperContextKeys: [...value.applicability.shopperContextKeys],
    },
    capability: {
      accessClass: value.capability.accessClass,
      integrationPattern: value.capability.integrationPattern,
      authorization: value.capability.authorization,
      documentedRead: value.capability.documentedRead,
      documentedWrite: value.capability.documentedWrite,
      certificationRequired: value.capability.certificationRequired,
      version: value.capability.version,
      granularity: [...value.capability.granularity],
      constraints: [...value.capability.constraints],
      fallbacks: [...value.capability.fallbacks],
    },
    unknowns: [...value.unknowns],
    rights: {
      permittedUses: [...value.rights.permittedUses],
      containsPersonalData: value.rights.containsPersonalData,
      containsContractData: value.rights.containsContractData,
    },
  };
}

function recursivelyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(recursivelyFrozen);
}

function exactStructure(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => exactStructure(item, right[index]));
  }
  if (!isObject(left) || !isObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && exactStructure(left[key], right[key]));
}

export function canonicalOtaKnowledgeJson(value: OtaKnowledgeRecord): string {
  if (!recursivelyFrozen(value) || value.authority !== OTA_RESEARCH_AUTHORITY) {
    throw new OtaKnowledgeError("canonical JSON requires an immutable normalized OTA research record");
  }
  const canonical = normalizeOtaKnowledgeRecord(inputFromRecord(value));
  if (!exactStructure(value, canonical)) {
    throw new OtaKnowledgeError("OTA research record does not match the canonical normalized form");
  }
  return JSON.stringify(canonical);
}
