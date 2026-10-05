import type {
  ReservationOfferSearchInput,
  ReservationOfferSearchResult,
} from "../contexts/reservations";
import type { JsonValue } from "../kernel";

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const BODY_READ_TIMEOUT_MS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENVELOPE_KEYS = ["searches"];
const SEARCH_KEYS = ["property_id", "search"];

type OfferSearch = Omit<ReservationOfferSearchInput, "propertyNode">;

export class StaffCrsSearchError extends Error {
  readonly status: 400 | 403 | 503;
  readonly code: string;
  readonly detail: string;

  constructor(status: 400 | 403 | 503, code: string, detail: string) {
    super(detail);
    this.name = "StaffCrsSearchError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export interface StaffCrsGrantedProperty {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
}

export interface StaffCrsSearchDependencies {
  readonly hasAvailabilityScope: boolean;
  readonly parseCanonicalSearch: (value: unknown) => OfferSearch | null;
  readonly listGrantedProperties: () => Promise<readonly StaffCrsGrantedProperty[]>;
  readonly searchOffers: ((input: ReservationOfferSearchInput) => Promise<ReservationOfferSearchResult>) | null;
  readonly serializeOffers: (result: ReservationOfferSearchResult) => JsonValue;
}

function invalid(detail = "CRS availability search input is invalid"): StaffCrsSearchError {
  return new StaffCrsSearchError(400, "request/invalid", detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function snapshotSearch(value: OfferSearch): OfferSearch {
  if (!value || !(value.stayStart instanceof Date) || !(value.stayEnd instanceof Date) ||
      !Number.isFinite(value.stayStart.getTime()) || !Number.isFinite(value.stayEnd.getTime()) ||
      !value.guests || !Array.isArray(value.guests.childAges)) {
    throw invalid();
  }

  const snapshot: OfferSearch = {
    stayStart: new Date(value.stayStart.getTime()),
    stayEnd: new Date(value.stayEnd.getTime()),
    guests: Object.freeze({
      adults: value.guests.adults,
      childAges: Object.freeze([...value.guests.childAges]),
    }),
    channelCode: value.channelCode,
    ...(value.unitTypeCodes === undefined
      ? {}
      : { unitTypeCodes: Object.freeze([...value.unitTypeCodes]) }),
    ...(value.ratePlanCodes === undefined
      ? {}
      : { ratePlanCodes: Object.freeze([...value.ratePlanCodes]) }),
    ...(value.attributes === undefined
      ? {}
      : { attributes: Object.freeze({ ...value.attributes }) }),
    ...(value.currency === undefined ? {} : { currency: value.currency }),
    ...(value.selectedPromotionCodes === undefined
      ? {}
      : { selectedPromotionCodes: Object.freeze([...value.selectedPromotionCodes]) }),
    ...(value.commercial === undefined
      ? {}
      : { commercial: Object.freeze({ ...value.commercial }) }),
  };
  return Object.freeze(snapshot);
}

function abortError(): StaffCrsSearchError {
  return invalid("CRS availability request body could not be read");
}

/** Reads and decodes at most 64 KiB of raw UTF-8 JSON from the request stream. */
export async function readCrsSearchJson(
  request: Request,
  options: Readonly<{ timeoutMs?: number }> = {},
): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? BODY_READ_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > BODY_READ_TIMEOUT_MS) {
    throw invalid("CRS request body timeout is invalid");
  }
  const contentType = request.headers.get("content-type");
  if (contentType === null || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType.trim())) {
    if (request.body) void request.body.cancel().catch(() => undefined);
    throw invalid("CRS availability request body must use application/json");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_REQUEST_BYTES) {
    if (request.body) void request.body.cancel().catch(() => undefined);
    throw new StaffCrsSearchError(400, "request/too_large", "CRS search request exceeds 64 KiB");
  }
  if (!request.body) throw invalid("CRS availability request body is required");
  if (request.signal.aborted) throw abortError();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const expiresAt = performance.now() + timeoutMs;
  let emptyChunks = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  let complete = false;

  const abort = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortError());
    request.signal.addEventListener("abort", onAbort, { once: true });
  });
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(abortError()), timeoutMs);
  });

  try {
    for (;;) {
      // A synchronous producer can starve timer callbacks with read microtasks.
      // Check the monotonic clock as well as racing the pending read's timer.
      if (request.signal.aborted || performance.now() >= expiresAt) throw abortError();
      let part: Awaited<ReturnType<typeof reader.read>>;
      try {
        part = await Promise.race([reader.read(), abort, deadline]);
      } catch {
        throw abortError();
      }
      if (request.signal.aborted || performance.now() >= expiresAt) throw abortError();
      if (part.done) {
        complete = true;
        break;
      }
      const chunk = part.value;
      if (!(chunk instanceof Uint8Array)) throw invalid("CRS availability request body is invalid");
      if (chunk.byteLength === 0) {
        // Empty chunks consume no request budget; bound consecutive no-progress
        // reads and never retain them in the body buffer.
        if (++emptyChunks > 1024) throw abortError();
        continue;
      }
      emptyChunks = 0;
      if (byteLength + chunk.byteLength > MAX_REQUEST_BYTES) {
        throw new StaffCrsSearchError(400, "request/too_large", "CRS search request exceeds 64 KiB");
      }
      byteLength += chunk.byteLength;
      chunks.push(chunk.slice());
    }
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (onAbort) request.signal.removeEventListener("abort", onAbort);
    if (!complete) void reader.cancel().catch(() => undefined);
    try {
      reader.releaseLock();
    } catch {
      // A pending read can keep the stream locked until cancellation settles.
    }
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalid("CRS availability request body must be valid UTF-8 JSON");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw invalid("CRS availability request body must be valid JSON");
  }
}

/** Validates, authorizes, then serially evaluates a complete multi-property request. */
export async function searchStaffCrsOffers(
  body: unknown,
  dependencies: StaffCrsSearchDependencies,
): Promise<JsonValue> {
  if (!dependencies.hasAvailabilityScope) {
    throw new StaffCrsSearchError(403, "auth/forbidden", "Availability access is not granted");
  }
  if (!isRecord(body) || !exactKeys(body, ENVELOPE_KEYS) || !Array.isArray(body.searches) ||
      body.searches.length < 1 || body.searches.length > 4) throw invalid();

  const requested: Array<{ propertyId: string; normalizedId: string; search: OfferSearch }> = [];
  const seen = new Set<string>();
  for (const entry of body.searches) {
    if (!isRecord(entry) || !exactKeys(entry, SEARCH_KEYS) || typeof entry.property_id !== "string" ||
        !UUID.test(entry.property_id)) throw invalid();
    const normalizedId = entry.property_id.toLowerCase();
    if (seen.has(normalizedId)) throw invalid("Property identifiers must be distinct");
    seen.add(normalizedId);

    let parsed: OfferSearch | null;
    try {
      parsed = dependencies.parseCanonicalSearch(entry.search);
    } catch {
      throw invalid();
    }
    if (!parsed) throw invalid();
    requested.push({
      propertyId: entry.property_id,
      normalizedId,
      search: snapshotSearch(parsed),
    });
  }

  const grants = await dependencies.listGrantedProperties();
  const grantById = new Map<string, StaffCrsGrantedProperty>();
  for (const grant of grants) {
    if (typeof grant.id === "string" && UUID.test(grant.id) &&
        typeof grant.name === "string" && typeof grant.timezone === "string") {
      const snapshot = Object.freeze({ id: grant.id, name: grant.name, timezone: grant.timezone });
      grantById.set(snapshot.id.toLowerCase(), snapshot);
    }
  }
  const selected: Array<{ property: StaffCrsGrantedProperty; search: OfferSearch }> = [];
  for (const request of requested) {
    const property = grantById.get(request.normalizedId);
    if (!property) {
      throw new StaffCrsSearchError(403, "auth/forbidden", "Property access is not granted");
    }
    selected.push({ property, search: request.search });
  }

  if (!dependencies.searchOffers) {
    throw new StaffCrsSearchError(503, "service/unavailable", "Offer search is temporarily unavailable");
  }

  const properties: JsonValue[] = [];
  for (const { property, search } of selected) {
    const result = await dependencies.searchOffers({ propertyNode: property.id, ...search });
    const serialized = dependencies.serializeOffers(result);
    properties.push({
      property_id: property.id,
      property_name: property.name,
      time_zone: property.timezone,
      result: serialized,
    });
  }

  const response: JsonValue = { properties };
  let serializedResponse: string | undefined;
  try {
    serializedResponse = JSON.stringify(response);
  } catch {
    throw new StaffCrsSearchError(400, "request/response_too_large", "Narrow the search to reduce its response size");
  }
  if (serializedResponse === undefined || new TextEncoder().encode(serializedResponse).byteLength > MAX_RESPONSE_BYTES) {
    throw new StaffCrsSearchError(400, "request/response_too_large", "Narrow the search to reduce its response size");
  }
  return response;
}
