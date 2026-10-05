/** Draft-only source evidence. These records never confer Yellow property ownership. */

export const PROPERTY_PROFILE_EVIDENCE_LIMITS = Object.freeze({
  maxObservations: 64,
  maxIdentities: 128,
  maxStringCharacters: 2_048,
  maxAliasesPerObservation: 64,
  maxAmenitiesPerObservation: 64,
  maxImagesPerObservation: 64,
} as const);

export interface PropertyListingIdentity {
  readonly provider: string;
  readonly accountNamespace: string | null;
  readonly externalId: string;
}

export interface ProfileEvidenceSource {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly httpStatus: number;
  readonly capturedAt: string;
  readonly sourceUpdatedAt: string | null;
  readonly contentSha256: string;
}

export interface PropertyAmenityEvidence {
  readonly canonicalKey: "wireless_internet" | "air_conditioning" | "free_parking" | "pool" | "kitchen" | null;
  readonly name: string;
  readonly value: boolean | null;
  readonly scope: "unknown";
  readonly sourcePath: string;
}

export interface PropertyImageEvidence {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly rightsStatus: "unknown";
  readonly sourcePath: string;
}

export interface PropertyProfileObservation {
  readonly source: ProfileEvidenceSource;
  readonly identity: PropertyListingIdentity;
  /** Only source-declared same-entity identifiers belong here. */
  readonly explicitAliases: readonly PropertyListingIdentity[];
  readonly name: string | null;
  readonly address: string | null;
  readonly amenities: readonly PropertyAmenityEvidence[];
  readonly images: readonly PropertyImageEvidence[];
  readonly sourcePath: string;
}

export interface PropertyProfileFieldEvidence<T> {
  readonly value: T;
  readonly observedAt: string;
  readonly sourceUpdatedAt: string | null;
  readonly sourceUrl: string;
  readonly contentSha256: string;
  readonly sourcePath: string;
}

export interface PropertyFieldClaim<T> extends PropertyProfileFieldEvidence<T> {
  readonly identity: PropertyListingIdentity;
}

export interface PropertyAmenityClaim extends PropertyProfileFieldEvidence<boolean | null> {
  readonly identity: PropertyListingIdentity;
  readonly canonicalKey: PropertyAmenityEvidence["canonicalKey"];
  readonly name: string;
  readonly scope: "unknown";
}

export interface PropertyProfileConflict {
  readonly field: "name" | "address" | "amenity";
  readonly key: string;
  readonly values: readonly unknown[];
  readonly evidence: readonly Readonly<{
    value: unknown;
    observedAt: string;
    sourceUrl: string;
    contentSha256: string;
    sourcePath: string;
  }>[];
}

export interface PropertyProfileDraft {
  readonly schemaVersion: "yellow.property-profile-evidence-draft/v1";
  readonly authority: "unverified-source-candidate";
  readonly identities: readonly PropertyListingIdentity[];
  readonly observations: readonly PropertyProfileObservation[];
  readonly selected: Readonly<{
    name: PropertyProfileFieldEvidence<string> | null;
    address: PropertyProfileFieldEvidence<string> | null;
  }>;
  readonly selectedAmenities: readonly PropertyAmenityClaim[];
  readonly amenityEvidence: readonly PropertyAmenityClaim[];
  readonly imageEvidence: readonly PropertyFieldClaim<Readonly<{
    url: string;
    width: number | null;
    height: number | null;
    rightsStatus: "unknown";
  }>>[];
  readonly conflicts: readonly PropertyProfileConflict[];
}

export type PropertyProfileEvidenceIssueCode =
  | "invalid-input"
  | "observation-limit"
  | "invalid-source"
  | "invalid-identity"
  | "invalid-evidence";

export interface PropertyProfileEvidenceIssue {
  readonly code: PropertyProfileEvidenceIssueCode;
  readonly observationIndex: number | null;
  readonly path: string;
}

export interface PropertyProfileEvidenceResult {
  readonly drafts: readonly PropertyProfileDraft[];
  readonly issues: readonly PropertyProfileEvidenceIssue[];
}

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const INVALID_URL_WHITESPACE = /[\u0000-\u0020\u007F]/u;

export type SafeInputSnapshot =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false }>;

/** Copy JSON-like input without invoking accessors; cycles, exotic prototypes and
 * accessor properties are rejected before any property value or prototype read. */
export function snapshotUntrustedJsonInput(value: unknown, maxNodes = 20_000): SafeInputSnapshot {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > 100_000) return Object.freeze({ ok: false });
  const active = new WeakSet<object>();
  let count = 0;
  const copy = (item: unknown, depth: number): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") return Number.isFinite(item) ? item : failSnapshot();
    if (typeof item !== "object" || item === null || depth > 32) return failSnapshot();
    count += 1;
    if (count > maxNodes) return failSnapshot();
    const descriptors = Object.getOwnPropertyDescriptors(item);
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = (descriptors as Record<PropertyKey, PropertyDescriptor>)[key]!;
      if (!("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return failSnapshot();
    }
    const isArray = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return failSnapshot();
    if (active.has(item)) return failSnapshot();
    active.add(item);
    try {
      if (isArray) {
        const length = descriptors.length?.value;
        if (typeof length !== "number" || !Number.isSafeInteger(length) || length > maxNodes) return failSnapshot();
        const result: unknown[] = [];
        for (let index = 0; index < length; index += 1) {
          const descriptor = descriptors[String(index)];
          if (descriptor === undefined || !descriptor.enumerable) return failSnapshot();
          result.push(copy(descriptor.value, depth + 1));
        }
        const allowed = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
        if (Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !allowed.has(key))) return failSnapshot();
        return result;
      }
      const result = Object.create(null) as Record<string, unknown>;
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== "string") return failSnapshot();
        const descriptor = (descriptors as Record<PropertyKey, PropertyDescriptor>)[key]!;
        if (!descriptor.enumerable) return failSnapshot();
        result[key] = copy(descriptor.value, depth + 1);
      }
      return result;
    } finally {
      active.delete(item);
    }
  };
  try {
    return Object.freeze({ ok: true, value: copy(value, 0) });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function failSnapshot(): never { throw new TypeError("invalid untrusted input"); }

const SECRET_QUERY_KEY = /(?:token|auth|secret|signature|^sig$|^key$|session|cookie|password|credential|bearer|jwt)/iu;

/** Shared URL guard for every externally supplied public-evidence URL. */
export function safePublicHttpsUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length === 0
      || value.trim() !== value
      || value.length > PROPERTY_PROFILE_EVIDENCE_LIMITS.maxStringCharacters
      || CONTROL.test(value) || INVALID_URL_WHITESPACE.test(value)) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
    if (url.protocol !== "https:" || url.username !== "" || url.password !== ""
        || hostname.length === 0 || hostname === "localhost" || hostname.endsWith(".localhost")
        || hostname.endsWith(".local") || hostname.endsWith(".internal")
        || !hostname.includes(".") || /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname)
        || hostname.startsWith("[") || hostname.includes("%")
        || [...url.searchParams.keys()].some(key => SECRET_QUERY_KEY.test(key))
        || [...new URLSearchParams(url.hash.slice(1)).keys()].some(key => SECRET_QUERY_KEY.test(key))
        || SECRET_QUERY_KEY.test(url.hash.slice(1).split(/[=&]/u, 1)[0] ?? "")) return null;
    return url;
  } catch { return null; }
}

function plain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
    && value.trim().length > 0
    && value.length <= PROPERTY_PROFILE_EVIDENCE_LIMITS.maxStringCharacters
    && !CONTROL.test(value);
}

export function isValidUtcEvidenceInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z$/u.exec(value);
  if (!match || !UTC_INSTANT.test(value)) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1]!
    && hour <= 23 && minute <= 59 && second <= 59;
}

function chronologyKey(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/u.exec(value);
  return match ? match[1] + "." + (match[2] ?? "").padEnd(6, "0") + "Z" : value;
}

function parseIdentity(value: unknown): PropertyListingIdentity | null {
  if (!plain(value)) return null;
  const provider = value.provider;
  const accountNamespace = value.accountNamespace;
  const externalId = value.externalId;
  if (!safeString(provider) || !(accountNamespace === null || safeString(accountNamespace))
      || !safeString(externalId) || !safeIdentityExternalId(externalId)) return null;
  return Object.freeze({ provider, accountNamespace, externalId });
}

function safeIdentityExternalId(value: string): boolean {
  if (/^(?:javascript|data|vbscript):/iu.test(value)) return false;
  if (/^https?:/iu.test(value)) return safePublicHttpsUrl(value) !== null;
  return true;
}

function identityKey(value: PropertyListingIdentity): string {
  return JSON.stringify([value.provider, value.accountNamespace, value.externalId]);
}

function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

function observationKey(value: PropertyProfileObservation): string {
  return JSON.stringify(value);
}

function amenityEvidenceKey(item: PropertyAmenityEvidence): string {
  return item.canonicalKey ?? "unmapped:" + item.name.normalize("NFKC").trim().toLowerCase();
}

function fieldEvidence<T>(value: T, observation: PropertyProfileObservation, path: string): PropertyProfileFieldEvidence<T> {
  return Object.freeze({
    value,
    observedAt: observation.source.capturedAt,
    sourceUpdatedAt: observation.source.sourceUpdatedAt,
    sourceUrl: observation.source.finalUrl,
    contentSha256: observation.source.contentSha256,
    sourcePath: path,
  });
}

function makeIssue(code: PropertyProfileEvidenceIssueCode, observationIndex: number | null, path: string): PropertyProfileEvidenceIssue {
  return Object.freeze({ code, observationIndex, path });
}

export function canonicalPropertyAmenityKey(name: unknown): PropertyAmenityEvidence["canonicalKey"] {
  if (typeof name !== "string") return null;
  const normalized = name.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/gu, " ");
  switch (normalized) {
    case "wi fi":
    case "wifi":
    case "wireless internet":
    case "free wi fi":
    case "free wifi":
      return "wireless_internet";
    case "air conditioning":
    case "airconditioned":
    case "air conditioning available":
      return "air_conditioning";
    case "free parking":
      return "free_parking";
    case "pool":
    case "swimming pool":
      return "pool";
    case "kitchen":
      return "kitchen";
    default:
      return null;
  }
}

function valueConflict(
  field: PropertyProfileConflict["field"],
  key: string,
  evidence: readonly PropertyProfileConflict["evidence"][number][],
): PropertyProfileConflict | null {
  const distinct = new Map<string, unknown>();
  for (const item of evidence) distinct.set(JSON.stringify(item.value), item.value);
  if (distinct.size < 2) return null;
  return Object.freeze({
    field, key, values: Object.freeze([...distinct.values()]), evidence: Object.freeze([...evidence]),
  });
}

/** Validate and deep-copy untrusted observations; disconnected identities stay separate. */
export function composePropertyProfileEvidence(input: unknown): PropertyProfileEvidenceResult {
  const snapshot = snapshotUntrustedJsonInput(input);
  if (!snapshot.ok || !plain(snapshot.value)) {
    return Object.freeze({ drafts: Object.freeze([]), issues: Object.freeze([makeIssue("invalid-input", null, "observations")]) });
  }
  const data = snapshot.value;
  const inputObservations = data.observations;
  if (!Array.isArray(inputObservations)) {
    return Object.freeze({ drafts: Object.freeze([]), issues: Object.freeze([makeIssue("invalid-input", null, "observations")]) });
  }
  if (inputObservations.length === 0 || inputObservations.length > PROPERTY_PROFILE_EVIDENCE_LIMITS.maxObservations) {
    return Object.freeze({ drafts: Object.freeze([]), issues: Object.freeze([makeIssue("observation-limit", null, "observations")]) });
  }

  const issues: PropertyProfileEvidenceIssue[] = [];
  const observations: PropertyProfileObservation[] = [];
  for (let index = 0; index < inputObservations.length; index += 1) {
    const raw = inputObservations[index];
    const path = "observations[" + index + "]";
    if (!plain(raw) || !plain(raw.source)) { issues.push(makeIssue("invalid-source", index, path)); continue; }
    const src = raw.source;
    const parsedIdentity = parseIdentity(raw.identity);
    if (!safeString(src.sourceUrl) || safePublicHttpsUrl(src.sourceUrl) === null
        || !safeString(src.finalUrl) || safePublicHttpsUrl(src.finalUrl) === null
        || typeof src.httpStatus !== "number" || !Number.isInteger(src.httpStatus) || src.httpStatus < 100 || src.httpStatus > 599
        || !isValidUtcEvidenceInstant(src.capturedAt) || !(src.sourceUpdatedAt === null || isValidUtcEvidenceInstant(src.sourceUpdatedAt))
        || typeof src.contentSha256 !== "string" || !SHA256.test(src.contentSha256)) {
      issues.push(makeIssue("invalid-source", index, path + ".source")); continue;
    }
    if (!parsedIdentity) { issues.push(makeIssue("invalid-identity", index, path + ".identity")); continue; }
    if (!Array.isArray(raw.explicitAliases) || raw.explicitAliases.length > PROPERTY_PROFILE_EVIDENCE_LIMITS.maxAliasesPerObservation
        || !Array.isArray(raw.amenities) || raw.amenities.length > PROPERTY_PROFILE_EVIDENCE_LIMITS.maxAmenitiesPerObservation
        || !Array.isArray(raw.images) || raw.images.length > PROPERTY_PROFILE_EVIDENCE_LIMITS.maxImagesPerObservation
      || !safeString(raw.sourcePath)) {
      issues.push(makeIssue("invalid-evidence", index, path)); continue;
    }
    const aliases: PropertyListingIdentity[] = [];
    const amenities: PropertyAmenityEvidence[] = [];
    const images: PropertyImageEvidence[] = [];
    let invalid = false;
    for (const item of raw.explicitAliases) {
      const alias = parseIdentity(item);
      if (!alias) { invalid = true; break; }
      aliases.push(alias);
    }
    if (!invalid) for (const item of raw.amenities) {
      if (!plain(item) || !safeString(item.name)
          || !(item.value === true || item.value === false || item.value === null)
          || item.scope !== "unknown"
          || !safeString(item.sourcePath)) { invalid = true; break; }
      const expectedKey = canonicalPropertyAmenityKey(item.name);
      if (!(item.canonicalKey === null || item.canonicalKey === expectedKey)) { invalid = true; break; }
      amenities.push(Object.freeze({
        canonicalKey: expectedKey, name: item.name, value: item.value, scope: "unknown", sourcePath: item.sourcePath,
      }));
    }
    if (!invalid) for (const item of raw.images) {
      if (!plain(item) || !safeString(item.url) || safePublicHttpsUrl(item.url) === null
          || item.rightsStatus !== "unknown" || !safeString(item.sourcePath)
          || !(item.width === null || (Number.isSafeInteger(item.width) && (item.width as number) > 0))
          || !(item.height === null || (Number.isSafeInteger(item.height) && (item.height as number) > 0))) { invalid = true; break; }
      images.push(Object.freeze({
        url: item.url, width: item.width as number | null, height: item.height as number | null,
        rightsStatus: "unknown",
        sourcePath: item.sourcePath,
      }));
    }
    if (invalid || !(raw.name === null || safeString(raw.name)) || !(raw.address === null || safeString(raw.address))) {
      issues.push(makeIssue("invalid-evidence", index, path)); continue;
    }
    observations.push(Object.freeze({
      source: Object.freeze({
        sourceUrl: src.sourceUrl, finalUrl: src.finalUrl, httpStatus: src.httpStatus,
        capturedAt: src.capturedAt, sourceUpdatedAt: src.sourceUpdatedAt,
        contentSha256: src.contentSha256,
      }),
      identity: Object.freeze({ ...parsedIdentity }),
      explicitAliases: Object.freeze(aliases),
      name: raw.name,
      address: raw.address,
      amenities: Object.freeze(amenities),
      images: Object.freeze(images),
      sourcePath: raw.sourcePath,
    }));
  }
  if (issues.length > 0 || observations.length !== inputObservations.length) {
    return Object.freeze({ drafts: Object.freeze([]), issues: Object.freeze(issues) });
  }

  const parent = new Map<string, string>();
  const identityByKey = new Map<string, PropertyListingIdentity>();
  const find = (key: string): string => {
    const current = parent.get(key);
    if (current === undefined || current === key) { parent.set(key, key); return key; }
    const root = find(current); parent.set(key, root); return root;
  };
  const union = (a: PropertyListingIdentity, b: PropertyListingIdentity): void => {
    const aKey = identityKey(a); const bKey = identityKey(b);
    identityByKey.set(aKey, a); identityByKey.set(bKey, b);
    const aRoot = find(aKey); const bRoot = find(bKey);
    if (aRoot !== bRoot) {
      const first = compareText(aRoot, bRoot) <= 0 ? aRoot : bRoot;
      const second = first === aRoot ? bRoot : aRoot;
      parent.set(second, first);
    }
  };
  for (const observation of observations) {
    const key = identityKey(observation.identity);
    identityByKey.set(key, observation.identity); find(key);
    for (const alias of observation.explicitAliases) union(observation.identity, alias);
  }
  const allIdentities = [...identityByKey.values()].sort((a, b) => compareText(identityKey(a), identityKey(b)));
  if (allIdentities.length > PROPERTY_PROFILE_EVIDENCE_LIMITS.maxIdentities) {
    return Object.freeze({ drafts: Object.freeze([]), issues: Object.freeze([makeIssue("invalid-evidence", null, "identities")]) });
  }
  const groups = new Map<string, PropertyListingIdentity[]>();
  for (const item of allIdentities) {
    const root = find(identityKey(item));
    const group = groups.get(root) ?? [];
    group.push(item); groups.set(root, group);
  }
  const orderedObservations = [...observations].sort((a, b) =>
    compareText(chronologyKey(a.source.capturedAt), chronologyKey(b.source.capturedAt))
      || compareText(observationKey(a), observationKey(b)));
  const orderedGroups = [...groups.values()].sort((a, b) => compareText(identityKey(a[0]!), identityKey(b[0]!)));
  const drafts = orderedGroups.map(group => {
    const groupKeySet = new Set(group.map(identityKey));
    const relevant = orderedObservations.filter(item => groupKeySet.has(identityKey(item.identity)));
    const newestFirst = [...relevant].sort((a, b) =>
      compareText(chronologyKey(b.source.capturedAt), chronologyKey(a.source.capturedAt))
      || compareText(observationKey(a), observationKey(b)));
    const selected = (field: "name" | "address"): PropertyProfileFieldEvidence<string> | null => {
      const found = newestFirst.find(item => item[field] !== null);
      if (found === undefined) return null;
      const value = found[field];
      return value === null ? null : fieldEvidence(value, found, found.sourcePath + "." + field);
    };
    const amenityEvidence: PropertyAmenityClaim[] = [];
    const imageEvidence: PropertyFieldClaim<Readonly<{
      url: string; width: number | null; height: number | null; rightsStatus: "unknown";
    }>>[] = [];
    for (const observation of relevant) {
      for (const item of observation.amenities) amenityEvidence.push(Object.freeze({
        ...fieldEvidence(item.value, observation, item.sourcePath),
        identity: observation.identity,
        canonicalKey: item.canonicalKey,
        name: item.name,
        scope: "unknown",
      }));
      for (const item of observation.images) imageEvidence.push(Object.freeze({
        ...fieldEvidence(Object.freeze({
          url: item.url, width: item.width, height: item.height, rightsStatus: item.rightsStatus,
        }), observation, item.sourcePath),
        identity: observation.identity,
      }));
    }
    const newestAmenityByKey = new Map<string, PropertyAmenityClaim>();
    for (const observation of newestFirst) for (const item of observation.amenities) {
      const key = amenityEvidenceKey(item);
      if (newestAmenityByKey.has(key)) continue;
      newestAmenityByKey.set(key, Object.freeze({
        ...fieldEvidence(item.value, observation, item.sourcePath),
        identity: observation.identity,
        canonicalKey: item.canonicalKey,
        name: item.name,
        scope: "unknown",
      }));
    }
    const conflicts: PropertyProfileConflict[] = [];
    for (const field of ["name", "address"] as const) {
      const claims = relevant.filter(item => item[field] !== null).map(item => Object.freeze({
        value: item[field], observedAt: item.source.capturedAt, sourceUrl: item.source.finalUrl,
        contentSha256: item.source.contentSha256, sourcePath: item.sourcePath + "." + field,
      }));
      const conflict = valueConflict(field, field, claims);
      if (conflict) conflicts.push(conflict);
    }
    const claimsByAmenity = new Map<string, PropertyProfileConflict["evidence"][number][]>();
    for (const observation of relevant) for (const item of observation.amenities) {
      const claim = Object.freeze({
        value: item.value, observedAt: observation.source.capturedAt, sourceUrl: observation.source.finalUrl,
        contentSha256: observation.source.contentSha256, sourcePath: item.sourcePath,
      });
      const key = amenityEvidenceKey(item);
      const claims = claimsByAmenity.get(key) ?? [];
      claims.push(claim); claimsByAmenity.set(key, claims);
    }
    for (const [key, claims] of claimsByAmenity) {
      const conflict = valueConflict("amenity", key, claims);
      if (conflict) conflicts.push(conflict);
    }
    return Object.freeze({
      schemaVersion: "yellow.property-profile-evidence-draft/v1" as const,
      authority: "unverified-source-candidate" as const,
      identities: Object.freeze([...group].sort((a, b) => compareText(identityKey(a), identityKey(b)))),
      observations: Object.freeze(relevant),
      selected: Object.freeze({ name: selected("name"), address: selected("address") }),
      selectedAmenities: Object.freeze([...newestAmenityByKey]
        .sort(([a], [b]) => compareText(a, b)).map(([, claim]) => claim)),
      amenityEvidence: Object.freeze(amenityEvidence),
      imageEvidence: Object.freeze(imageEvidence),
      conflicts: Object.freeze(conflicts),
    });
  });
  return Object.freeze({ drafts: Object.freeze(drafts), issues: Object.freeze([]) });
}
