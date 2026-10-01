import type { TenantIdentity } from "../../kernel";
import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CHANNEL = /^[a-z][a-z0-9._-]{0,63}$/;

export const PUBLIC_BOOKING_PUBLISHER_SCOPES = Object.freeze([
  "inventory.availability:read", "rates.configuration:read", "inventory.holds:write",
  "reservations.booking:write", "crm.parties:read", "crm.parties:write",
] as const);

/** The small callable capability supplied by composition for the owned runtime pool. */
export interface PublicBookingRuntimeSql {
  <T extends Record<string, unknown>[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export interface PublicBookingSiteBinding {
  readonly siteId: string;
  readonly version: number;
  readonly active: true;
  readonly issuerId: string;
  readonly ratePlanIds: readonly string[];
  readonly channelCode: string;
}

export interface PublicBookingSiteContext {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly propertyName: string;
  readonly timeZone: string;
  readonly site: PublicBookingSiteBinding;
}

export interface AuthorizedPublicBookingSite extends PublicBookingSiteContext {
  readonly now: Date;
}

export interface PublishPublicBookingSiteBody {
  readonly expectedVersion: number;
  readonly active: boolean;
  readonly ratePlanIds: readonly string[];
  readonly channelCode: string;
}

export interface PublishedPublicBookingSite {
  readonly siteId: string;
  readonly version: number;
  readonly active: boolean;
  readonly ratePlanIds: readonly string[];
  readonly channelCode: string;
}

export class PublicBookingSiteError extends Error {
  readonly status = 403;
  constructor() { super("Booking site access is unavailable"); this.name = "PublicBookingSiteError"; }
}
export { PublicBookingSiteError as PublicBookingSiteAuthorityError };

export class PublicBookingSiteConflictError extends Error {
  readonly status = 409;
  constructor() { super("Booking site publication changed"); this.name = "PublicBookingSiteConflictError"; }
}

/** A trusted directory/authority response was malformed; callers should return a generic 503. */
export class PublicBookingSiteUnavailableError extends Error {
  readonly status = 503;
  constructor() { super("Booking site service is unavailable"); this.name = "PublicBookingSiteUnavailableError"; }
}

export class PublicBookingSiteValidationError extends Error {
  readonly status = 400;
  constructor() { super("Booking site publication input is invalid"); this.name = "PublicBookingSiteValidationError"; }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value: JsonRecord, expected: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) return false;
  const keys = (ownKeys as string[]).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]) &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor?.enumerable === true && descriptor.get === undefined && descriptor.set === undefined;
    });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length===0 || value.trim()!==value ||
      !/^(?:UTC|GMT|[A-Z][A-Za-z0-9_+-]*(?:\/[A-Z][A-Za-z0-9_+-]*)+)$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch { return false; }
}

function databaseCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { errno?: unknown; code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

function mapDatabaseError(error: unknown): never {
  switch (databaseCode(error)) {
    case "42501": throw new PublicBookingSiteError();
    case "40001": throw new PublicBookingSiteConflictError();
    case "22023": throw new PublicBookingSiteValidationError();
    default: throw new PublicBookingSiteUnavailableError();
  }
}

function validDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value);
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function snapshot(value: unknown, includeNow = false): PublicBookingSiteContext | null {
  if (!isRecord(value) || !hasExactKeys(value, includeNow
    ? ["tenantId", "propertyNode", "propertyName", "timeZone", "site", "now"]
    : ["tenantId", "propertyNode", "propertyName", "timeZone", "site"])) return null;
  const site = value.site;
  if (!isRecord(site) || !hasExactKeys(site, ["siteId", "version", "active", "issuerId", "channelCode", "ratePlanIds"])) return null;
  if (!isUuid(value.tenantId) || !isUuid(value.propertyNode) ||
      typeof value.propertyName !== "string" || value.propertyName.length === 0 || value.propertyName.trim() !== value.propertyName ||
      !isTimeZone(value.timeZone) ||
      !isUuid(site.siteId) || !Number.isSafeInteger(site.version) || (site.version as number) < 1 ||
      site.active !== true || !isUuid(site.issuerId) || typeof site.channelCode !== "string" || !CHANNEL.test(site.channelCode) ||
      !Array.isArray(site.ratePlanIds) || site.ratePlanIds.length < 1 || site.ratePlanIds.length > 16 ||
      !site.ratePlanIds.every(isUuid) || new Set(site.ratePlanIds).size !== site.ratePlanIds.length) return null;
  return Object.freeze({
    tenantId: value.tenantId,
    propertyNode: value.propertyNode,
    propertyName: value.propertyName,
    timeZone: value.timeZone,
    site: Object.freeze({
      siteId: site.siteId,
      version: site.version as number,
      active: true as const,
      issuerId: site.issuerId,
      ratePlanIds: Object.freeze([...site.ratePlanIds]),
      channelCode: site.channelCode,
    }),
  });
}

function validatePublicationBody(body: unknown): PublishPublicBookingSiteBody {
  if (!isRecord(body) || !hasExactKeys(body, ["expectedVersion", "active", "ratePlanIds", "channelCode"]) ||
      !Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 0 || (body.expectedVersion as number) > 2_147_483_646 ||
      typeof body.active !== "boolean" || !Array.isArray(body.ratePlanIds) || body.ratePlanIds.length < 1 || body.ratePlanIds.length > 16 ||
      !body.ratePlanIds.every(isUuid) || new Set(body.ratePlanIds).size !== body.ratePlanIds.length ||
      typeof body.channelCode !== "string" || !CHANNEL.test(body.channelCode)) throw new PublicBookingSiteValidationError();
  return Object.freeze({
    expectedVersion: body.expectedVersion as number,
    active: body.active,
    ratePlanIds: Object.freeze([...body.ratePlanIds] as string[]),
    channelCode: body.channelCode,
  });
}

function safePublishedSite(value: unknown): PublishedPublicBookingSite {
  if (!isRecord(value) || !hasExactKeys(value, ["siteId", "version", "active", "issuerId", "channelCode", "ratePlanIds"]) ||
      !isUuid(value.siteId) || !Number.isSafeInteger(value.version) || (value.version as number) < 1 ||
      typeof value.active !== "boolean" || !isUuid(value.issuerId) ||
      typeof value.channelCode !== "string" || !CHANNEL.test(value.channelCode) ||
      !Array.isArray(value.ratePlanIds) || value.ratePlanIds.length < 1 || value.ratePlanIds.length > 16 ||
      !value.ratePlanIds.every(isUuid) || new Set(value.ratePlanIds).size !== value.ratePlanIds.length) {
    throw new PublicBookingSiteUnavailableError();
  }
  return Object.freeze({
    siteId: value.siteId,
    version: value.version as number,
    active: value.active,
    ratePlanIds: Object.freeze([...value.ratePlanIds]),
    channelCode: value.channelCode,
  });
}

/** Database authority for resolving, rechecking and publishing one public booking site. */
export class PublicBookingSiteAuthority {
  async resolve(sql: PublicBookingRuntimeSql, siteId: string): Promise<PublicBookingSiteContext> {
    if (!isUuid(siteId)) throw new PublicBookingSiteError();
    let rows: { snapshot: unknown }[];
    try {
      rows = await sql<{ snapshot: unknown }[]>`SELECT public.resolve_public_booking_site(${siteId}::uuid) AS snapshot`;
    } catch (error) { mapDatabaseError(error); }
    if (!Array.isArray(rows) || rows.length !== 1) throw new PublicBookingSiteUnavailableError();
    if (rows[0]?.snapshot === null) throw new PublicBookingSiteError();
    const result = snapshot(rows[0]?.snapshot);
    if (!result) throw new PublicBookingSiteUnavailableError();
    if (result.site.siteId !== siteId) throw new PublicBookingSiteUnavailableError();
    return result;
  }

  async authorize(tx: Tx, siteId: string, version: number, ratePlanId?: string): Promise<AuthorizedPublicBookingSite> {
    if (!isUuid(siteId) || !Number.isSafeInteger(version) || version < 1 ||
        (ratePlanId !== undefined && !isUuid(ratePlanId))) throw new PublicBookingSiteError();
    let rows: { snapshot: unknown }[];
    try {
      rows = await tx<{ snapshot: unknown }[]>`SELECT public.assert_public_booking_site(
        ${siteId}::uuid,${version}::integer,${ratePlanId ?? null}::uuid) AS snapshot`;
    } catch (error) { mapDatabaseError(error); }
    if (!Array.isArray(rows) || rows.length !== 1 || !isRecord(rows[0]?.snapshot)) throw new PublicBookingSiteUnavailableError();
    const result = snapshot(rows[0]?.snapshot, true);
    const now = validDate((rows[0]?.snapshot as JsonRecord).now);
    if (!result || !now || result.site.siteId !== siteId || result.site.version !== version ||
        (ratePlanId !== undefined && !result.site.ratePlanIds.includes(ratePlanId))) throw new PublicBookingSiteUnavailableError();
    return Object.freeze({ ...result, now });
  }

  async publish(
    tx: Tx,
    identity: TenantIdentity,
    propertyNode: string,
    body: PublishPublicBookingSiteBody,
    requestId: string,
  ): Promise<PublishedPublicBookingSite> {
    if (!identity || !isUuid(identity.tenantId) || !isUuid(identity.actorId) || !isUuid(propertyNode) || !isUuid(requestId)) {
      throw new PublicBookingSiteError();
    }
    const scopes = identity.scopes;
    if (!Array.isArray(scopes) || PUBLIC_BOOKING_PUBLISHER_SCOPES.some((scope) => !scopes.includes(scope))) {
      throw new PublicBookingSiteError();
    }
    const input = validatePublicationBody(body);
    const plans = [...input.ratePlanIds].sort();
    let rows: { site: unknown }[];
    try {
      rows = await tx<{ site: unknown }[]>`SELECT public.publish_public_booking_site(
        ${identity.tenantId}::uuid,${propertyNode}::uuid,${identity.actorId}::uuid,
        ${input.expectedVersion}::integer,${input.active}::boolean,ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(plans)}::jsonb)::uuid),
        ${input.channelCode}::text,${requestId}::uuid) AS site`;
    } catch (error) { mapDatabaseError(error); }
    if (!Array.isArray(rows) || rows.length !== 1) throw new PublicBookingSiteUnavailableError();
    return safePublishedSite(rows[0]?.site);
  }
}
