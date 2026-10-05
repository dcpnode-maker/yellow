import {
  IdempotencyConflictError,
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import type { CartHold, HoldService } from "../inventory";
import type { RateQuote, RateQuoteService, ResolveRateQuoteInput } from "../rates";
import {
  createPositiveTaxAttributionSnapshot,
  TaxAttributionSnapshotError,
  type PositiveTaxAttributionSnapshotV1,
} from "./attribution";
import {
  TaxAttributionPersistenceConflictError,
  TaxAttributionPersistenceNotFoundError,
  TaxAttributionPersistenceService,
  TaxAttributionPersistenceValidationError,
} from "./persistence";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CURRENCY = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const HOTEL_CODE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const BOUND_EVENT = "tax.attribution_bound";
const ENTITY_TYPE = "tax_attribution_hold_binding";
const CART_HOLD_TTL_SECONDS = 600;
const COMMERCIAL_KEYS = Object.freeze([
  "companyPartyId",
  "marketGroupCode",
  "marketCode",
  "sourcePartyId",
  "sourceCode",
  "channelCode",
  "segmentCode",
  "agentPartyId",
  "campaignCode",
] as const);
const QUOTE_INPUT_KEYS = Object.freeze([
  "propertyNode",
  "ratePlanId",
  "sellableUnitId",
  "stayStart",
  "stayEnd",
  "guests",
  "selectedPromotionCodes",
  "commercial",
  "channelCode",
] as const);
const QUOTE_RESULT_KEYS = Object.freeze([
  "tenantId",
  "propertyNode",
  "ratePlanId",
  "releaseId",
  "releaseVersion",
  "releaseContentHash",
  "modelDraftId",
  "modelDraftVersion",
  "targetDraftId",
  "targetDraftVersion",
  "sellableUnitId",
  "unitTypeId",
  "bookingInstant",
  "propertyTimeZone",
  "stayStartDate",
  "stayEndDate",
  "availabilityOption",
  "occupancyEvidence",
  "taxAssignmentState",
  "taxAssignments",
  "taxPreview",
  "result",
  "quoteHash",
] as const);

export interface PlaceQuotedTaxHoldInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly quote: ResolveRateQuoteInput;
  readonly ttlSeconds: number;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface QuotedTaxHoldBindingReceipt extends Readonly<Record<string, JsonValue>> {
  readonly bindingId: string;
  readonly propertyNode: string;
  readonly holdId: string;
  readonly attributionId: string;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly currency: string;
  readonly boundBy: string;
  readonly boundAt: string;
  readonly created: boolean;
  readonly replayed: boolean;
}

export interface QuotedTaxHoldBindingServiceOptions {
  readonly quotes: Pick<RateQuoteService, "resolve">;
  readonly holds: Pick<HoldService, "place">;
  readonly attributions: Pick<TaxAttributionPersistenceService, "record">;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedPlaceInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly quote: ResolveRateQuoteInput;
  readonly ttlSeconds: 600;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface BindingRow {
  readonly binding_id: string;
  readonly property_node: string;
  readonly hold_id: string;
  readonly attribution_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly bound_by: string;
  readonly bound_at: Date | string;
  readonly created: boolean;
}

interface BindingBody extends QuotedTaxHoldBindingReceipt {}

export class QuotedTaxHoldBindingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotedTaxHoldBindingValidationError";
  }
}

export class QuotedTaxHoldBindingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotedTaxHoldBindingNotFoundError";
  }
}

export class QuotedTaxHoldBindingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotedTaxHoldBindingConflictError";
  }
}

function plainRecord(value: unknown, expectedKeys: readonly string[], subject: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} must be a plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true)) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function optionalPlainRecord(value: unknown, allowedKeys: readonly string[], subject: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} must be a plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  const allowed = new Set(allowedKeys);
  if (keys.some((key) => !allowed.has(key)) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true)) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function denseArray(value: unknown, maximum: number, subject: string): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 || value.length > maximum) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} must be a bounded canonical array`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const names = Object.keys(descriptors).filter((name) => name !== "length");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || lengthDescriptor.value !== value.length ||
      lengthDescriptor.enumerable || lengthDescriptor.configurable ||
      names.length !== value.length || names.some((name, index) => name !== String(index)) ||
      names.some((name) => descriptors[name]!.get !== undefined ||
        descriptors[name]!.set !== undefined || descriptors[name]!.enumerable !== true) ||
      Object.getOwnPropertyNames(value).length !== value.length + 1) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} must be dense and contain only data items`);
  }
  return value;
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} must be a UUID`);
  }
  return value;
}

function finiteDate(value: unknown, subject: string): Date {
  if (!(value instanceof Date) || Object.getPrototypeOf(value) !== Date.prototype ||
      Object.getOwnPropertyNames(value).length !== 0 || Object.getOwnPropertySymbols(value).length !== 0 ||
      !Number.isFinite(value.getTime())) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} must be a finite canonical Date`);
  }
  return new Date(value.getTime());
}

function integer(value: unknown, minimum: number, maximum: number, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new QuotedTaxHoldBindingValidationError(`${subject} is outside its integer bounds`);
  }
  return value as number;
}

function normalizeCommercial(value: unknown, channelCode: string): ResolveRateQuoteInput["commercial"] {
  const source = optionalPlainRecord(value, COMMERCIAL_KEYS, "quote.commercial");
  const result: Record<string, string> = {};
  for (const key of COMMERCIAL_KEYS) {
    const candidate = source[key];
    if (candidate === undefined) continue;
    if (typeof candidate !== "string") {
      throw new QuotedTaxHoldBindingValidationError(`quote.commercial.${key} must be text`);
    }
    if (key === "companyPartyId" || key === "sourcePartyId" || key === "agentPartyId") {
      result[key] = uuid(candidate, `quote.commercial.${key}`);
    } else if (key === "channelCode") {
      if (!CHANNEL.test(candidate) || candidate !== channelCode) {
        throw new QuotedTaxHoldBindingValidationError(
          "quote.commercial.channelCode must match quote.channelCode",
        );
      }
      result[key] = candidate;
    } else {
      if (!HOTEL_CODE.test(candidate)) {
        throw new QuotedTaxHoldBindingValidationError(
          `quote.commercial.${key} must be a canonical uppercase code`,
        );
      }
      result[key] = candidate;
    }
  }
  return Object.freeze(result);
}

function normalizeQuoteInput(value: unknown, propertyNode: string): ResolveRateQuoteInput {
  const source = plainRecord(value, QUOTE_INPUT_KEYS, "quote input");
  const channelCode = source.channelCode;
  if (typeof channelCode !== "string" || !CHANNEL.test(channelCode)) {
    throw new QuotedTaxHoldBindingValidationError("quote.channelCode must be a canonical lowercase code");
  }
  const guests = plainRecord(source.guests, ["adults", "childAges"], "quote.guests");
  const childAges = denseArray(guests.childAges, 30, "quote.guests.childAges")
    .map((age, index) => integer(age, 0, 17, `quote.guests.childAges[${index}]`));
  const promotions = denseArray(source.selectedPromotionCodes, 50, "quote.selectedPromotionCodes")
    .map((code, index) => {
      if (typeof code !== "string" || !HOTEL_CODE.test(code)) {
        throw new QuotedTaxHoldBindingValidationError(
          `quote.selectedPromotionCodes[${index}] must be a canonical hotel code`,
        );
      }
      return code;
    });
  if (new Set(promotions).size !== promotions.length) {
    throw new QuotedTaxHoldBindingValidationError("quote.selectedPromotionCodes must be unique");
  }
  const stayStart = finiteDate(source.stayStart, "quote.stayStart");
  const stayEnd = finiteDate(source.stayEnd, "quote.stayEnd");
  if (stayStart >= stayEnd) {
    throw new QuotedTaxHoldBindingValidationError("quote stay must be half-open and increasing");
  }
  const quoteProperty = uuid(source.propertyNode, "quote.propertyNode");
  if (quoteProperty !== propertyNode) {
    throw new QuotedTaxHoldBindingValidationError("quote property must match the command property");
  }
  return Object.freeze({
    propertyNode: quoteProperty,
    ratePlanId: uuid(source.ratePlanId, "quote.ratePlanId"),
    sellableUnitId: uuid(source.sellableUnitId, "quote.sellableUnitId"),
    stayStart,
    stayEnd,
    guests: Object.freeze({
      adults: integer(guests.adults, 1, 99, "quote.guests.adults"),
      childAges: Object.freeze(childAges),
    }),
    selectedPromotionCodes: Object.freeze(promotions),
    commercial: normalizeCommercial(source.commercial, channelCode),
    channelCode,
  });
}

function normalizeEnvelope(value: unknown, tenantId: string, propertyNode: string): AuditEnvelope {
  const source = plainRecord(
    value,
    ["actorId", "tenantId", "propertyNode", "requestId", "operation"],
    "envelope",
  );
  if (uuid(source.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(source.propertyNode, "envelope.propertyNode") !== propertyNode ||
      source.operation !== BOUND_EVENT) {
    throw new QuotedTaxHoldBindingValidationError(
      `audit envelope must match the command and operation ${BOUND_EVENT}`,
    );
  }
  return Object.freeze({
    actorId: uuid(source.actorId, "envelope.actorId"),
    tenantId,
    propertyNode,
    requestId: uuid(source.requestId, "envelope.requestId"),
    operation: BOUND_EVENT,
  });
}

function normalizeInput(value: unknown): NormalizedPlaceInput {
  const source = plainRecord(
    value,
    ["tenantId", "propertyNode", "quote", "ttlSeconds", "idempotencyKey", "envelope"],
    "quoted-tax hold input",
  );
  const tenantId = uuid(source.tenantId, "tenantId");
  const propertyNode = uuid(source.propertyNode, "propertyNode");
  if (source.ttlSeconds !== CART_HOLD_TTL_SECONDS) {
    throw new QuotedTaxHoldBindingValidationError("ttlSeconds must be exactly 600");
  }
  if (typeof source.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(source.idempotencyKey)) {
    throw new QuotedTaxHoldBindingValidationError(
      "idempotencyKey must contain 8 to 200 visible ASCII characters",
    );
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    quote: normalizeQuoteInput(source.quote, propertyNode),
    ttlSeconds: CART_HOLD_TTL_SECONDS,
    idempotencyKey: source.idempotencyKey,
    envelope: normalizeEnvelope(source.envelope, tenantId, propertyNode),
  });
}

function inspectEvidenceGraph(value: unknown, ancestors = new Set<object>(), depth = 0): void {
  if (depth > 64) throw new QuotedTaxHoldBindingConflictError("Live quote evidence is too deeply nested");
  if (value === null || typeof value === "boolean" || typeof value === "bigint") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new QuotedTaxHoldBindingConflictError("Live quote evidence is invalid");
    return;
  }
  if (typeof value === "string") {
    if (value.length > 65_536) throw new QuotedTaxHoldBindingConflictError("Live quote evidence is oversized");
    return;
  }
  if (typeof value !== "object" || value === null || value instanceof Date ||
      Object.getOwnPropertySymbols(value).length !== 0 || ancestors.has(value)) {
    throw new QuotedTaxHoldBindingConflictError("Live quote evidence must be an acyclic data graph");
  }
  const prototype = Object.getPrototypeOf(value);
  if ((Array.isArray(value) && prototype !== Array.prototype) ||
      (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)) {
    throw new QuotedTaxHoldBindingConflictError("Live quote evidence must use canonical data objects");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).filter((key) => key !== "length");
  const lengthDescriptor = Array.isArray(value)
    ? Object.getOwnPropertyDescriptor(value, "length")
    : undefined;
  if (Object.getOwnPropertyNames(value).some((key) => key !== "length" && !keys.includes(key)) ||
      keys.some((key) => descriptors[key]!.get !== undefined || descriptors[key]!.set !== undefined ||
        descriptors[key]!.enumerable !== true) ||
      (Array.isArray(value) && (!lengthDescriptor || lengthDescriptor.value !== value.length ||
        lengthDescriptor.enumerable || lengthDescriptor.configurable))) {
    throw new QuotedTaxHoldBindingConflictError("Live quote evidence must contain data properties only");
  }
  if (Array.isArray(value) &&
      (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) {
    throw new QuotedTaxHoldBindingConflictError("Live quote evidence arrays must be dense");
  }
  ancestors.add(value);
  try {
    for (const key of keys) inspectEvidenceGraph(descriptors[key]!.value, ancestors, depth + 1);
  } finally {
    ancestors.delete(value);
  }
}

function exactInstant(value: unknown, subject: string): string {
  if (typeof value !== "string") {
    throw new QuotedTaxHoldBindingConflictError(`${subject} is not an exact instant`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new QuotedTaxHoldBindingConflictError(`${subject} is not an exact instant`);
  }
  return value;
}

function exactBoundInstant(value: Date | string): string {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new QuotedTaxHoldBindingConflictError("Binding capability returned an invalid instant");
  }
  return parsed.toISOString();
}

function canonicalLiveQuote(
  value: unknown,
  input: NormalizedPlaceInput,
): { readonly quote: RateQuote; readonly snapshot: PositiveTaxAttributionSnapshotV1 } {
  inspectEvidenceGraph(value);
  const source = plainRecord(value, QUOTE_RESULT_KEYS, "live quote") as unknown as RateQuote;
  if (source.tenantId !== input.tenantId || source.propertyNode !== input.propertyNode ||
      source.ratePlanId !== input.quote.ratePlanId || source.sellableUnitId !== input.quote.sellableUnitId ||
      source.availabilityOption.sellableUnitId !== input.quote.sellableUnitId ||
      source.result.availabilityEvidence.sellableUnitId !== input.quote.sellableUnitId ||
      source.availabilityOption.unitTypeId !== source.unitTypeId ||
      source.result.guests.adults !== input.quote.guests.adults ||
      source.result.guests.childAges.length !== input.quote.guests.childAges.length ||
      source.result.guests.childAges.some((age, index) => age !== input.quote.guests.childAges[index])) {
    throw new QuotedTaxHoldBindingConflictError("Live quote scope does not match the command");
  }
  if (!UUID.test(source.releaseId) || !UUID.test(source.modelDraftId) || !UUID.test(source.targetDraftId) ||
      !UUID.test(source.unitTypeId) || !Number.isSafeInteger(source.releaseVersion) || source.releaseVersion < 1 ||
      !Number.isSafeInteger(source.modelDraftVersion) || source.modelDraftVersion < 1 ||
      !Number.isSafeInteger(source.targetDraftVersion) || source.targetDraftVersion < 1 ||
      !SHA256.test(source.releaseContentHash) || !SHA256.test(source.quoteHash) ||
      !CURRENCY.test(source.result.currency) || !DATE.test(source.stayStartDate) ||
      !DATE.test(source.stayEndDate) || typeof source.propertyTimeZone !== "string" ||
      source.propertyTimeZone.length < 1 || source.propertyTimeZone.length > 256) {
    throw new QuotedTaxHoldBindingConflictError("Live quote metadata is incomplete");
  }
  exactInstant(source.bookingInstant, "Live quote bookingInstant");
  const taxPreview = source.taxPreview;
  if (!source.availabilityOption.bookable || !source.result.availabilityEvidence.bookable ||
      source.result.state !== "quoted" || source.taxAssignmentState !== "configured" ||
      taxPreview.state !== "calculated") {
    throw new QuotedTaxHoldBindingConflictError(
      "Live quote must be bookable, quoted and carry calculated tax",
    );
  }
  if (typeof source.result.roomAmountMinor !== "bigint" || source.result.roomAmountMinor <= 0n ||
      source.result.preTaxSubtotalMinor !== source.result.roomAmountMinor ||
      source.result.rateEvaluations.length < 1 || source.result.rateEvaluations.length > 366 ||
      taxPreview.assignments.length !== source.result.rateEvaluations.length ||
      source.taxAssignments.length !== taxPreview.assignments.length) {
    throw new QuotedTaxHoldBindingConflictError("Live quote tax attribution is incomplete");
  }
  const roomNights = source.result.rateEvaluations.map((night, index) => {
    const amount = night.evaluationResult.amountMinor;
    const assignment = taxPreview.assignments[index];
    const quoteAssignment = source.taxAssignments[index];
    if (night.evaluationResult.state !== "priced" || typeof amount !== "bigint" || amount <= 0n ||
        !DATE.test(night.nightDate) || !assignment || !quoteAssignment ||
        night.evaluationContext.bookingInstant !== source.bookingInstant ||
        night.evaluationContext.stayStartInstant !== input.quote.stayStart.toISOString() ||
        night.evaluationContext.stayEndInstant !== input.quote.stayEnd.toISOString() ||
        assignment.nightDate !== night.nightDate || quoteAssignment.nightDate !== night.nightDate ||
        typeof assignment.jurisdictionKey !== "string" || typeof assignment.evidenceRef !== "string" ||
        assignment.jurisdictionKey !== taxPreview.jurisdiction.key ||
        assignment.jurisdictionKey !== quoteAssignment.jurisdictionKey ||
        assignment.evidenceRef !== quoteAssignment.evidenceRef) {
      throw new QuotedTaxHoldBindingConflictError("Live quote room-night tax evidence is incomplete");
    }
    return Object.freeze({ businessDate: night.nightDate, amountMinor: amount });
  });
  const assignments = taxPreview.assignments.map((assignment) => Object.freeze({
    businessDate: assignment.nightDate,
    jurisdictionKey: assignment.jurisdictionKey!,
    evidenceRef: assignment.evidenceRef!,
  }));
  const nights = roomNights.length;
  const personNights = (source.result.guests.adults + source.result.guests.childAges.length) * nights;
  if (!Number.isSafeInteger(personNights) || personNights < 1) {
    throw new QuotedTaxHoldBindingConflictError("Live quote person-night evidence is invalid");
  }
  let snapshot: PositiveTaxAttributionSnapshotV1;
  try {
    snapshot = createPositiveTaxAttributionSnapshot({
      origin: Object.freeze({ kind: "rate_quote", quoteHash: source.quoteHash }),
      currency: source.result.currency,
      line: Object.freeze({
        lineId: "room",
        revenueGroup: "room_revenue",
        amountMinor: source.result.roomAmountMinor,
        nights,
        personNights,
        roomNights: Object.freeze(roomNights),
      }),
      assignments: Object.freeze(assignments),
      jurisdiction: Object.freeze({
        extensionId: taxPreview.jurisdiction.extensionId,
        ownerTenantId: taxPreview.jurisdiction.ownerTenantId,
        key: taxPreview.jurisdiction.key,
        version: taxPreview.jurisdiction.version,
        contentHash: taxPreview.jurisdiction.contentHash,
        evidenceRef: taxPreview.jurisdiction.evidenceRef,
      }),
      evaluation: taxPreview.evaluation,
    });
  } catch (error) {
    if (error instanceof TaxAttributionSnapshotError) {
      throw new QuotedTaxHoldBindingConflictError("Live quote could not produce canonical tax attribution");
    }
    throw error;
  }
  return Object.freeze({ quote: source, snapshot });
}

function requestEvidence(input: NormalizedPlaceInput): Readonly<Record<string, JsonValue>> {
  const commercial: Record<string, JsonValue> = {};
  for (const key of COMMERCIAL_KEYS) {
    const value = input.quote.commercial[key];
    if (value !== undefined) commercial[key] = value;
  }
  return Object.freeze({
    actorId: input.envelope.actorId,
    propertyNode: input.propertyNode,
    ratePlanId: input.quote.ratePlanId,
    sellableUnitId: input.quote.sellableUnitId,
    stayStart: input.quote.stayStart.toISOString(),
    stayEnd: input.quote.stayEnd.toISOString(),
    adults: input.quote.guests.adults,
    childAges: input.quote.guests.childAges,
    selectedPromotionCodes: input.quote.selectedPromotionCodes,
    commercial: Object.freeze(commercial),
    channelCode: input.quote.channelCode,
    ttlSeconds: input.ttlSeconds,
  });
}

function receipt(row: BindingRow): BindingBody {
  if (!UUID.test(row.binding_id) || !UUID.test(row.property_node) || !UUID.test(row.hold_id) ||
      !UUID.test(row.attribution_id) || !UUID.test(row.bound_by) ||
      !SHA256.test(row.origin_quote_hash) || !SHA256.test(row.snapshot_hash) ||
      !CURRENCY.test(row.currency) || typeof row.created !== "boolean") {
    throw new QuotedTaxHoldBindingConflictError("Binding capability returned invalid evidence");
  }
  return Object.freeze({
    bindingId: row.binding_id,
    propertyNode: row.property_node,
    holdId: row.hold_id,
    attributionId: row.attribution_id,
    quoteHash: row.origin_quote_hash,
    snapshotHash: row.snapshot_hash,
    currency: row.currency,
    boundBy: row.bound_by,
    boundAt: exactBoundInstant(row.bound_at),
    created: row.created,
    replayed: false,
  });
}

function payload(body: BindingBody): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    binding_id: body.bindingId,
    property_node: body.propertyNode,
    hold_id: body.holdId,
    attribution_id: body.attributionId,
    origin_quote_hash: body.quoteHash,
    snapshot_hash: body.snapshotHash,
    currency: body.currency,
  });
}

function subEnvelope(input: NormalizedPlaceInput, operation: string): AuditEnvelope {
  return Object.freeze({
    actorId: input.envelope.actorId,
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    requestId: input.envelope.requestId,
    operation,
  });
}

function errorName(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error &&
      typeof error.name === "string" ? error.name : "";
}

function translate(error: unknown): never {
  if (error instanceof QuotedTaxHoldBindingValidationError ||
      error instanceof QuotedTaxHoldBindingNotFoundError ||
      error instanceof QuotedTaxHoldBindingConflictError) throw error;
  if (error instanceof IdempotencyConflictError) {
    throw new QuotedTaxHoldBindingConflictError(error.message);
  }
  if (error instanceof TaxAttributionPersistenceValidationError ||
      error instanceof TaxAttributionPersistenceConflictError) {
    throw new QuotedTaxHoldBindingConflictError("Tax-attribution state is invalid or changed concurrently");
  }
  if (error instanceof TaxAttributionPersistenceNotFoundError) {
    throw new QuotedTaxHoldBindingNotFoundError(
      "Tax-attribution target was not found in the active tenant property",
    );
  }
  const name = errorName(error);
  if (name === "RateQuoteNotFoundError" || name === "InventoryNotFoundError") {
    throw new QuotedTaxHoldBindingNotFoundError(
      "Quoted-tax hold target was not found in the active tenant property",
    );
  }
  if (name === "RateQuoteError" || name === "RateQuoteConflictError" ||
      name === "HoldConflictError" || name === "InventoryConflictError") {
    throw new QuotedTaxHoldBindingConflictError("Quoted-tax hold state is unavailable or changed");
  }
  if (name === "InventoryValidationError") {
    throw new QuotedTaxHoldBindingValidationError("Quoted-tax hold input is invalid");
  }
  const state = (error as { errno?: unknown; code?: unknown }).errno ??
    (error as { errno?: unknown; code?: unknown }).code;
  if (state === "42501" || state === "55000") {
    throw new QuotedTaxHoldBindingNotFoundError(
      "Quoted-tax hold target was not found in the active tenant property",
    );
  }
  if (state === "22023") {
    throw new QuotedTaxHoldBindingValidationError("Quoted-tax hold input is invalid");
  }
  if (state === "23P01" || state === "23505" || state === "23514" ||
      state === "40001" || state === "40P01") {
    throw new QuotedTaxHoldBindingConflictError(
      "Quoted-tax hold state is unavailable or changed concurrently",
    );
  }
  throw error;
}

export class QuotedTaxHoldBindingService {
  readonly #quotes: Pick<RateQuoteService, "resolve">;
  readonly #holds: Pick<HoldService, "place">;
  readonly #attributions: Pick<TaxAttributionPersistenceService, "record">;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: QuotedTaxHoldBindingServiceOptions) {
    this.#quotes = options.quotes;
    this.#holds = options.holds;
    this.#attributions = options.attributions;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async place(tx: Tx, value: PlaceQuotedTaxHoldInput): Promise<QuotedTaxHoldBindingReceipt> {
    const input = normalizeInput(value);
    try {
      const outcome = await this.#idempotency.execute<BindingBody>(tx, {
        tenantId: input.tenantId,
        operation: BOUND_EVENT,
        key: input.idempotencyKey,
        request: requestEvidence(input),
      }, async (commandTx) => {
        const publicationLock = `rate-plan-release:${input.tenantId}:${input.quote.ratePlanId}`;
        await commandTx`SELECT pg_advisory_xact_lock(hashtextextended(${publicationLock}, 0))`;
        const live = canonicalLiveQuote(
          await this.#quotes.resolve(commandTx, input.quote),
          input,
        );
        const snapshotLock = `quoted-tax-snapshot:${input.tenantId}:${live.snapshot.snapshotHash}`;
        await commandTx`SELECT pg_advisory_xact_lock(hashtextextended(${snapshotLock}, 0))`;

        const existing = await commandTx<BindingRow[]>`
          SELECT id AS binding_id, property_node, hold_id, attribution_id,
                 origin_quote_hash, snapshot_hash, currency::text, bound_by, bound_at,
                 false AS created
          FROM public.tax_attribution_hold_binding
          WHERE tenant_id = ${input.tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND property_node = ${input.propertyNode}::uuid
            AND snapshot_hash = ${live.snapshot.snapshotHash}
        `;
        if (existing.length > 1) {
          throw new QuotedTaxHoldBindingConflictError("Canonical snapshot has multiple hold bindings");
        }
        const prior = existing[0];
        if (prior) {
          const body = receipt(prior);
          if (body.propertyNode !== input.propertyNode || body.quoteHash !== live.quote.quoteHash ||
              body.snapshotHash !== live.snapshot.snapshotHash || body.boundBy !== input.envelope.actorId) {
            throw new QuotedTaxHoldBindingConflictError(
              "Existing quoted-tax hold binding does not match the command",
            );
          }
          return { status: 200, body };
        }

        const hold: CartHold = await this.#holds.place(commandTx, {
          sellableUnitId: input.quote.sellableUnitId,
          from: input.quote.stayStart,
          to: input.quote.stayEnd,
          ttlSeconds: input.ttlSeconds,
          holder: Object.freeze({
            kind: "quoted_tax",
            rate_plan_id: input.quote.ratePlanId,
            quote_hash: live.quote.quoteHash,
            snapshot_hash: live.snapshot.snapshotHash,
          }),
          envelope: subEnvelope(input, "hold.created"),
        });
        if (hold.tenantId !== input.tenantId || hold.propertyNode !== input.propertyNode ||
            hold.sellableUnitId !== input.quote.sellableUnitId || hold.kind !== "cart" ||
            hold.status !== "active" || hold.from.getTime() !== input.quote.stayStart.getTime() ||
            hold.to.getTime() !== input.quote.stayEnd.getTime()) {
          throw new QuotedTaxHoldBindingConflictError("Hold service returned mismatched evidence");
        }
        const attribution = await this.#attributions.record(commandTx, {
          tenantId: input.tenantId,
          propertyNode: input.propertyNode,
          snapshot: live.snapshot,
          idempotencyKey: `quoted-tax-attribution:${live.snapshot.snapshotHash}`,
          envelope: subEnvelope(input, "tax.attribution_recorded"),
        });
        if (attribution.propertyNode !== input.propertyNode ||
            attribution.originQuoteHash !== live.quote.quoteHash ||
            attribution.snapshotHash !== live.snapshot.snapshotHash ||
            attribution.currency !== live.snapshot.currency) {
          throw new QuotedTaxHoldBindingConflictError(
            "Tax-attribution persistence returned mismatched evidence",
          );
        }
        const rows = await commandTx<BindingRow[]>`
          SELECT binding_id, property_node, hold_id, attribution_id,
                 origin_quote_hash, snapshot_hash, currency::text, bound_by, bound_at, created
          FROM public.record_tax_attribution_hold_binding(
            ${input.tenantId}::uuid,
            ${input.propertyNode}::uuid,
            ${input.envelope.actorId}::uuid,
            ${hold.id}::uuid,
            ${attribution.attributionId}::uuid
          )
        `;
        const row = rows[0];
        if (rows.length !== 1 || !row) {
          throw new QuotedTaxHoldBindingConflictError(
            "Binding capability did not return one evidence row",
          );
        }
        const body = receipt(row);
        if (!body.created || body.propertyNode !== input.propertyNode || body.holdId !== hold.id ||
            body.attributionId !== attribution.attributionId || body.quoteHash !== live.quote.quoteHash ||
            body.snapshotHash !== live.snapshot.snapshotHash || body.currency !== live.snapshot.currency ||
            body.boundBy !== input.envelope.actorId) {
          throw new QuotedTaxHoldBindingConflictError("Binding capability returned mismatched evidence");
        }
        const eventPayload = payload(body);
        const fact = await recordFact(commandTx, {
          entityType: ENTITY_TYPE,
          entityId: body.bindingId,
          envelope: input.envelope,
          payload: eventPayload,
        });
        await this.#events.publish(commandTx, {
          tenantId: input.tenantId,
          propertyNode: input.propertyNode,
          businessDate: fact.businessDate,
          aggregateType: ENTITY_TYPE,
          aggregateId: body.bindingId,
          eventType: "tax.attribution_bound",
          actorId: input.envelope.actorId,
          correlationId: input.envelope.requestId,
          payload: eventPayload,
        });
        return { status: 201, body };
      });
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }
}
