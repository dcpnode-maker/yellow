import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { LocalLoginLimitedError, LocalLoginService, type LocalLoginInput } from "../contexts/identity";
import {
  PartyDuplicateReviewRequiredError,
  PartyProfileService,
  PartyProfileValidationError,
  type PartyContactInput,
  type PartyKind,
  type PartyRole,
} from "../contexts/crm";
import {
  ChargeCorrectionAuthorizationError,
  ChargeCorrectionConflictError,
  ChargeCorrectionNotFoundError,
  ChargeCorrectionService,
  ChargeCorrectionValidationError,
  ChargeConflictError,
  ChargeNotFoundError,
  ChargeService,
  ChargeValidationError,
  FolioConflictError,
  FolioNotFoundError,
  FolioService,
  FolioTransferConflictError,
  FolioTransferNotFoundError,
  FolioTransferService,
  FolioTransferValidationError,
  FolioStatementNotFoundError,
  FolioStatementService,
  FolioStatementValidationError,
  FolioValidationError,
  HostedDepositConflictError,
  HostedDepositNotFoundError,
  HostedDepositService,
  HostedDepositValidationError,
} from "../contexts/financials";
import {
  AvailabilityService,
  AvailabilityProjectionService,
  HoldConflictError,
  HoldService,
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryPolicyService,
  InventoryService,
  InventoryValidationError,
  OperationalBlockConflictError,
  OperationalBlockService,
  RestrictionService,
  type CreateSellableUnitInput,
  type CreateSpaceInput,
  type CreateUnitTypeInput,
  type RestrictionDraft,
  type RestrictionKind,
  type SearchAvailabilityInput,
  type RebuildAvailabilityProjectionInput,
} from "../contexts/inventory";
import {
  RATE_MODEL_CATALOGUE,
  RateAuthoringError,
  RateConfigurationService,
  RateConflictError,
  RateEvaluationError,
  RateIntentError,
  RateIntentService,
  RateModelService,
  RateNotFoundError,
  RatePricingService,
  RatePublicationConflictError,
  RatePublicationError,
  RatePublicationNotFoundError,
  RatePublicationService,
  RateQuoteConflictError,
  RateQuoteError,
  RateQuoteNotFoundError,
  RateQuoteService,
  RateTargetService,
  RateValidationError,
  compileRateAuthoringCommand,
  type CreatePolicyInput,
  type CreateRatePriceInput,
  type CreateRatePlanInput,
  type CanonicalRateAuthoringCommand,
  type PolicyKind,
  type RateModelDraft,
  type RatePlanRelease,
  type RatePricingInput,
  type RateTargetDraft,
} from "../contexts/rates";
import {
  ReservationCommitService,
  ReservationConflictError,
  ReservationGuestConflictError,
  ReservationGuestNotFoundError,
  ReservationGuestService,
  ReservationGuestValidationError,
  ReservationApprovalRequiredError,
  ReservationLifecycleConflictError,
  ReservationLifecycleNotFoundError,
  ReservationLifecycleService,
  ReservationLifecycleValidationError,
  ReservationSegmentService,
  ReservationBoardConflictError,
  ReservationBoardService,
  ReservationBoardValidationError,
  ReservationDetailConflictError,
  ReservationDetailNotFoundError,
  ReservationDetailService,
  ReservationDetailValidationError,
  RESERVATION_STATUSES,
  ReservationNotFoundError,
  ReservationOfferSearchService,
  ReservationOfferSearchTooBroadError,
  ReservationOfferValidationError,
  ReservationValidationError,
  type ReservationOfferSearchInput,
  type ReservationOfferSearchResult,
  type RequestedReservationGuest,
  type ReservationMutableFields,
  type ExpectedSegmentPeriod,
} from "../contexts/reservations";
import {
  createAuditEnvelope,
  IdempotencyConflictError,
  IdempotencyValidationError,
  PostgresIdempotency,
  type JsonValue,
  type TenantRequestContext,
  type Tx,
} from "../kernel";
import {
  DEFAULT_OPERATOR_RUNTIME_STATUS,
  PROJECT_BUILD_SNAPSHOT,
  type OperatorRuntimeStatus,
} from "../project-status";

const AVAILABILITY_SCOPE = "inventory.availability:read";
const CONFIGURATION_READ_SCOPE = "inventory.configuration:read";
const CONFIGURATION_WRITE_SCOPE = "inventory.configuration:write";
const RESTRICTION_READ_SCOPE = "inventory.restriction:read";
const RESTRICTION_WRITE_SCOPE = "inventory.restriction:write";
const RATE_READ_SCOPE = "rates.configuration:read";
const RATE_WRITE_SCOPE = "rates.configuration:write";
const PRICING_READ_SCOPE = "rates.pricing:read";
const PRICING_WRITE_SCOPE = "rates.pricing:write";
const BLOCK_READ_SCOPE = "inventory.blocks:read";
const BLOCK_WRITE_SCOPE = "inventory.blocks:write";
const POLICY_READ_SCOPE = "inventory.policy:read";
const POLICY_WRITE_SCOPE = "inventory.policy:write";
const HOLD_READ_SCOPE = "inventory.holds:read";
const HOLD_WRITE_SCOPE = "inventory.holds:write";
const OFFLINE_LEASE_READ_SCOPE = "inventory.offline_leases:read";
const OFFLINE_LEASE_WRITE_SCOPE = "inventory.offline_leases:write";
const RESERVATION_WRITE_SCOPE = "reservations.booking:write";
const RESERVATION_GUEST_READ_SCOPE = "reservations.guests:read";
const RESERVATION_GUEST_WRITE_SCOPE = "reservations.guests:write";
const RESERVATION_LIFECYCLE_READ_SCOPE = "reservations.lifecycle:read";
const RESERVATION_LIFECYCLE_WRITE_SCOPE = "reservations.lifecycle:write";
const RESERVATION_SEGMENT_READ_SCOPE = "reservations.segments:read";
const RESERVATION_SEGMENT_WRITE_SCOPE = "reservations.segments:write";
const PARTY_READ_SCOPE = "crm.parties:read";
const PARTY_WRITE_SCOPE = "crm.parties:write";
const FOLIO_READ_SCOPE = "financials.folios:read";
const FOLIO_OPEN_SCOPE = "financials.folios:open";
const FOLIO_TRANSFER_SCOPE = "financials.transfers:write";
const CHARGE_WRITE_SCOPE = "financials.charges:write";
const ADJUSTMENT_WRITE_SCOPE = "financials.adjustments:write";
const ADJUSTMENT_POST_SEAL_SCOPE = "financials.adjustments:post-seal";
const PAYMENT_READ_SCOPE = "financials.payments:read";
const PAYMENT_WRITE_SCOPE = "financials.payments:write";
const DEPOSIT_APPLY_SCOPE = "financials.deposits:apply";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key));
}

const POSITIVE_INT64 = /^[1-9][0-9]*$/;
const INT64_MAX = 9_223_372_036_854_775_807n;
const CHARGE_TX_CODE = /^[A-Z0-9][A-Z0-9._-]{0,31}$/;
const CHARGE_QUANTITY = /^(?:0\.[0-9]{1,3}|[1-9][0-9]{0,6}(?:\.[0-9]{1,3})?)$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const FOLIO_REFERENCE = /^[A-Z0-9][A-Z0-9._\/-]{0,63}$/;

function statementQuery(request: Request): { after?: string; limit?: number } | null {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some((key) => key !== "after" && key !== "limit") ||
      query.getAll("after").length > 1 || query.getAll("limit").length > 1) return null;
  const after = query.get("after");
  const rawLimit = query.get("limit");
  if (after !== null && (after.length < 1 || after.length > 512 || !/^[A-Za-z0-9_-]+$/.test(after))) return null;
  if (rawLimit !== null && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit)) return null;
  return Object.freeze({
    ...(after === null ? {} : { after }),
    ...(rawLimit === null ? {} : { limit: Number(rawLimit) }),
  });
}

interface ChargeDraft {
  readonly txCode: string;
  readonly amountMinor: string;
  readonly quantity?: string;
  readonly idempotencyKey: string;
}

interface CorrectionDraft {
  readonly reversesJournalId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

const FOLIO_TRANSFER_FIELDS = ["sourceFolioId", "destinationFolioId", "newWindowName", "groupIds", "reason", "generation", "previewRevision"] as const;
const FOLIO_TRANSFER_REVISION = /^[A-Za-z0-9_-]{1,512}$/;

interface FolioTransferDraft {
  readonly sourceFolioId: string;
  readonly destinationFolioId?: string;
  readonly newWindowName?: string;
  readonly groupIds: readonly string[];
  readonly reason: string;
  readonly generation: string;
  readonly previewRevision: string;
}

function parseFolioTransfer(body: unknown): FolioTransferDraft | null {
  if (!isObject(body) || !exactKeys(body, [...FOLIO_TRANSFER_FIELDS])) return null;
  const originId = body[FOLIO_TRANSFER_FIELDS[0]];
  const destinationId = body[FOLIO_TRANSFER_FIELDS[1]];
  const destinationName = body[FOLIO_TRANSFER_FIELDS[2]];
  const groups = body[FOLIO_TRANSFER_FIELDS[3]];
  const reason = body[FOLIO_TRANSFER_FIELDS[4]];
  const generation = body[FOLIO_TRANSFER_FIELDS[5]];
  const revision = body[FOLIO_TRANSFER_FIELDS[6]];
  if (typeof originId !== "string" || !UUID.test(originId) ||
      (destinationId !== null && (typeof destinationId !== "string" || !UUID.test(destinationId))) ||
      (destinationName !== null && (typeof destinationName !== "string" ||
        destinationName !== destinationName.trim() || destinationName.length < 1 || destinationName.length > 80)) ||
      (destinationId === null) === (destinationName === null) ||
      !Array.isArray(groups) || groups.length < 1 || groups.length > 50 ||
      groups.some((id) => typeof id !== "string" || !UUID.test(id)) || new Set(groups).size !== groups.length ||
      typeof reason !== "string" || reason !== reason.trim() || reason.length < 1 || reason.length > 500 ||
      typeof generation !== "string" || !FOLIO_TRANSFER_REVISION.test(generation) ||
      typeof revision !== "string" || (revision.length > 0 && !FOLIO_TRANSFER_REVISION.test(revision))) return null;
  return Object.freeze({
    [FOLIO_TRANSFER_FIELDS[0]]: originId,
    ...(destinationId === null ? {} : { [FOLIO_TRANSFER_FIELDS[1]]: destinationId }),
    ...(destinationName === null ? {} : { [FOLIO_TRANSFER_FIELDS[2]]: destinationName }),
    [FOLIO_TRANSFER_FIELDS[3]]: Object.freeze([...groups] as string[]),
    [FOLIO_TRANSFER_FIELDS[4]]: reason,
    [FOLIO_TRANSFER_FIELDS[5]]: generation,
    [FOLIO_TRANSFER_FIELDS[6]]: revision,
  }) as unknown as FolioTransferDraft;
}

function parseCharge(request: Request, body: unknown): ChargeDraft | null {
  if (!isObject(body) || !exactKeys(body, ["txCode", "amountMinor"], ["quantity"]) ||
      typeof body.txCode !== "string" || !CHARGE_TX_CODE.test(body.txCode) ||
      typeof body.amountMinor !== "string" || !POSITIVE_INT64.test(body.amountMinor) ||
      BigInt(body.amountMinor) > INT64_MAX ||
      (body.quantity !== undefined &&
        (typeof body.quantity !== "string" || !CHARGE_QUANTITY.test(body.quantity) ||
          !/[1-9]/.test(body.quantity)))) return null;
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) return null;
  return Object.freeze({
    txCode: body.txCode,
    amountMinor: body.amountMinor,
    ...(body.quantity === undefined ? {} : { quantity: body.quantity }),
    idempotencyKey,
  });
}

function parseCorrection(request: Request, body: unknown): CorrectionDraft | null {
  if (!isObject(body) || !exactKeys(body, ["reversesJournalId", "reason"]) ||
      typeof body.reversesJournalId !== "string" || !UUID.test(body.reversesJournalId) ||
      typeof body.reason !== "string" || body.reason.length < 1 || body.reason.length > 500 ||
      body.reason.trim() !== body.reason || /[\u0000-\u001f\u007f]/.test(body.reason)) return null;
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) return null;
  return Object.freeze({
    reversesJournalId: body.reversesJournalId,
    reason: body.reason,
    idempotencyKey,
  });
}

function correlationId(request: Request): string {
  const candidate = request.headers.get("x-correlation-id");
  return candidate && UUID.test(candidate) ? candidate : crypto.randomUUID();
}

function apiResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  const correlation = correlationId(request);
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-correlation-id": correlation,
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}

function apiError(
  request: Request,
  status: number,
  type: string,
  title: string,
  detail: string,
  evidence: Readonly<Record<string, unknown>> = {},
  extraHeaders: HeadersInit = {},
): Response {
  const correlation = correlationId(request);
  return Response.json({ type, title, status, detail, ...evidence, correlation_id: correlation }, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-correlation-id": correlation,
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}

function hasAvailabilityScope(context: TenantRequestContext): context is TenantRequestContext & {
  identity: { actorId: string; scopes: readonly string[] };
} {
  return hasScope(context, AVAILABILITY_SCOPE);
}

function hasScope(context: TenantRequestContext, scope: string): context is TenantRequestContext & {
  identity: { actorId: string; scopes: readonly string[] };
} {
  return typeof context.identity.actorId === "string" && context.identity.scopes?.includes(scope) === true;
}

function parseInstant(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = ISO_INSTANT.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText,
    secondText = "00", fractionText = "", rawOffset,
    offsetSign, offsetHourText = "00", offsetMinuteText = "00"] = match;
  if (!yearText || !monthText || !dayText || !hourText || !minuteText || !rawOffset) return null;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fractionText.padEnd(3, "0") || "0");
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 ||
      minute > 59 || second > 59 || offsetHour > 14 || offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0)) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const signedOffsetMinutes = rawOffset === "Z"
    ? 0
    : (offsetSign === "-" ? -1 : 1) * (offsetHour * 60 + offsetMinute);
  const local = new Date(parsed.getTime() + signedOffsetMinutes * 60_000);
  return local.getUTCFullYear() === year && local.getUTCMonth() + 1 === month &&
      local.getUTCDate() === day && local.getUTCHours() === hour &&
      local.getUTCMinutes() === minute && local.getUTCSeconds() === second &&
      local.getUTCMilliseconds() === millisecond
    ? parsed
    : null;
}

function parseLocalDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = LOCAL_DATE.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  if (!yearText || !monthText || !dayText) return null;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ? value
    : null;
}

function parseSearch(body: unknown): Omit<SearchAvailabilityInput, "propertyNode"> | null {
  if (!isObject(body) || !exactKeys(body, ["from", "to"], ["partySize", "ratePlanId", "channelCode"])) {
    return null;
  }
  const from = parseInstant(body.from);
  const to = parseInstant(body.to);
  if (!from || !to) return null;
  if (body.partySize !== undefined && typeof body.partySize !== "number") return null;
  if (body.ratePlanId !== undefined && typeof body.ratePlanId !== "string") return null;
  if (body.channelCode !== undefined && typeof body.channelCode !== "string") return null;
  return {
    from,
    to,
    ...(body.partySize === undefined ? {} : { partySize: body.partySize }),
    ...(body.ratePlanId === undefined ? {} : { ratePlanId: body.ratePlanId }),
    ...(body.channelCode === undefined ? {} : { channelCode: body.channelCode }),
  };
}

const OFFER_COMMERCIAL_FIELDS = Object.freeze([
  ["company_party_id", "companyPartyId"],
  ["market_group_code", "marketGroupCode"],
  ["market_code", "marketCode"],
  ["source_party_id", "sourcePartyId"],
  ["source_code", "sourceCode"],
  ["channel_code", "channelCode"],
  ["segment_code", "segmentCode"],
  ["agent_party_id", "agentPartyId"],
  ["campaign_code", "campaignCode"],
] as const);

function isCanonicalOfferSearch(body: unknown): boolean {
  return isObject(body) && [
    "stay", "party", "unit_types", "rate_plans", "attributes", "channel", "currency",
    "selected_promotion_codes", "commercial",
  ].some((key) => Object.hasOwn(body, key));
}

function parseOfferSearch(body: unknown): Omit<ReservationOfferSearchInput, "propertyNode"> | null {
  if (!isObject(body) || !exactKeys(body, ["stay", "party", "channel"], [
    "unit_types", "rate_plans", "attributes", "currency", "selected_promotion_codes", "commercial",
  ]) || !isObject(body.stay) || !exactKeys(body.stay, ["from", "to"]) ||
      !isObject(body.party) || !exactKeys(body.party, ["adults", "children"]) ||
      typeof body.party.adults !== "number" || !Array.isArray(body.party.children) ||
      typeof body.channel !== "string") return null;
  const stayStart = parseInstant(body.stay.from);
  const stayEnd = parseInstant(body.stay.to);
  if (!stayStart || !stayEnd) return null;
  const childAges: number[] = [];
  for (const child of body.party.children) {
    if (!isObject(child) || !exactKeys(child, ["age"]) || typeof child.age !== "number") return null;
    childAges.push(child.age);
  }
  const stringArray = (value: unknown): readonly string[] | null =>
    Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
  const unitTypeCodes = body.unit_types === undefined ? undefined : stringArray(body.unit_types);
  const ratePlanCodes = body.rate_plans === undefined ? undefined : stringArray(body.rate_plans);
  const selectedPromotionCodes = body.selected_promotion_codes === undefined
    ? undefined
    : stringArray(body.selected_promotion_codes);
  if (unitTypeCodes === null || ratePlanCodes === null || selectedPromotionCodes === null) return null;
  let attributes: ReservationOfferSearchInput["attributes"];
  if (body.attributes !== undefined) {
    if (!isObject(body.attributes) || !exactKeys(body.attributes, ["gender_policy"]) ||
        (body.attributes.gender_policy !== "any" && body.attributes.gender_policy !== "female" &&
         body.attributes.gender_policy !== "male")) return null;
    attributes = { genderPolicy: body.attributes.gender_policy };
  }
  let commercial: Record<string, string> | undefined;
  if (body.commercial !== undefined) {
    if (!isObject(body.commercial) || !exactKeys(body.commercial, [], OFFER_COMMERCIAL_FIELDS.map(([external]) => external))) {
      return null;
    }
    commercial = {};
    for (const [external, internal] of OFFER_COMMERCIAL_FIELDS) {
      const value = body.commercial[external];
      if (value === undefined) continue;
      if (typeof value !== "string") return null;
      commercial[internal] = value;
    }
  }
  if (body.currency !== undefined && typeof body.currency !== "string") return null;
  return {
    stayStart,
    stayEnd,
    guests: { adults: body.party.adults, childAges },
    ...(unitTypeCodes === undefined ? {} : { unitTypeCodes }),
    ...(ratePlanCodes === undefined ? {} : { ratePlanCodes }),
    ...(attributes === undefined ? {} : { attributes }),
    channelCode: body.channel,
    ...(body.currency === undefined ? {} : { currency: body.currency }),
    ...(selectedPromotionCodes === undefined ? {} : { selectedPromotionCodes }),
    ...(commercial === undefined ? {} : { commercial }),
  };
}

function parseProjectionRebuild(body: unknown): Omit<RebuildAvailabilityProjectionInput, "propertyNode"> | null {
  if (!isObject(body) || !exactKeys(body, ["fromDate", "toDate"])) return null;
  const fromDate = parseLocalDate(body.fromDate);
  const toDate = parseLocalDate(body.toDate);
  return fromDate && toDate ? { fromDate, toDate } : null;
}

function parseHold(body: unknown): { sellableUnitId: string; from: Date; to: Date; holderReference: string } | null {
  if (!isObject(body) || !exactKeys(body, ["sellableUnitId", "from", "to", "holderReference"]) ||
      typeof body.sellableUnitId !== "string" || !UUID.test(body.sellableUnitId) ||
      typeof body.holderReference !== "string" || body.holderReference !== body.holderReference.trim() ||
      !/^[^\u0000-\u001f\u007f]{1,120}$/u.test(body.holderReference)) return null;
  const from = parseInstant(body.from);
  const to = parseInstant(body.to);
  return from && to && from < to ? { sellableUnitId: body.sellableUnitId, from, to, holderReference: body.holderReference } : null;
}

type ReservationCommitDraft = Readonly<{
  propertyNode: string;
  primaryPartyId: string;
  ratePlanId: string;
  adults: number;
  childAges: readonly number[];
  channelCode: string;
} & (
  { holdId: string } |
  { direct: { sellableUnitId: string; from: Date; to: Date } }
)>;

function parseReservationCommit(body: unknown): ReservationCommitDraft | null {
  if (!isObject(body) || !exactKeys(body, [
    "propertyNode", "primaryPartyId", "ratePlanId", "adults", "childAges", "channelCode",
  ], ["holdId", "direct"]) ||
      typeof body.propertyNode !== "string" || !UUID.test(body.propertyNode) ||
      typeof body.primaryPartyId !== "string" || !UUID.test(body.primaryPartyId) ||
      typeof body.ratePlanId !== "string" || !UUID.test(body.ratePlanId) ||
      typeof body.adults !== "number" || !Number.isSafeInteger(body.adults) ||
      !Array.isArray(body.childAges) || body.childAges.length > 30 ||
      body.childAges.some((age) => typeof age !== "number" || !Number.isSafeInteger(age)) ||
      typeof body.channelCode !== "string" ||
      (body.holdId === undefined) === (body.direct === undefined)) return null;
  const common = {
    propertyNode: body.propertyNode,
    primaryPartyId: body.primaryPartyId,
    ratePlanId: body.ratePlanId,
    adults: body.adults,
    childAges: Object.freeze([...body.childAges] as number[]),
    channelCode: body.channelCode,
  };
  if (body.holdId !== undefined) {
    return typeof body.holdId === "string" && UUID.test(body.holdId)
      ? Object.freeze({ ...common, holdId: body.holdId })
      : null;
  }
  if (!isObject(body.direct) || !exactKeys(body.direct, ["sellableUnitId", "from", "to"]) ||
      typeof body.direct.sellableUnitId !== "string" || !UUID.test(body.direct.sellableUnitId)) return null;
  const from = parseInstant(body.direct.from);
  const to = parseInstant(body.direct.to);
  return from && to && from < to
    ? Object.freeze({ ...common, direct: Object.freeze({ sellableUnitId: body.direct.sellableUnitId, from, to }) })
    : null;
}

function parseReservationGuests(body: unknown): {
  primarySharePct: string | null;
  guests: readonly RequestedReservationGuest[];
} | null {
  if (!isObject(body) || !exactKeys(body, ["primarySharePct", "guests"]) ||
      (body.primarySharePct !== null && typeof body.primarySharePct !== "string") ||
      !Array.isArray(body.guests) || body.guests.length > 99) return null;
  const guests: RequestedReservationGuest[] = [];
  for (const guest of body.guests) {
    if (!isObject(guest) || !exactKeys(guest, ["partyId", "role", "sharePct"]) ||
        typeof guest.partyId !== "string" || !UUID.test(guest.partyId) ||
        (guest.role !== "accompanying" && guest.role !== "sharer") ||
        (guest.sharePct !== null && typeof guest.sharePct !== "string")) return null;
    guests.push(Object.freeze({
      partyId: guest.partyId,
      role: guest.role,
      sharePct: guest.sharePct,
    }));
  }
  return Object.freeze({
    primarySharePct: body.primarySharePct,
    guests: Object.freeze(guests),
  });
}

function confirmationQuery(request: Request): string | null {
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some((key) => key !== "confirmationNo") ||
      query.getAll("confirmationNo").length !== 1) return null;
  const confirmationNo = query.get("confirmationNo");
  return confirmationNo !== null && /^[\x21-\x7e]{1,120}$/.test(confirmationNo)
    ? confirmationNo
    : null;
}

function reservationBoardQuery(request: Request): {
  status?: (typeof RESERVATION_STATUSES)[number];
  from?: Date;
  to?: Date;
  after?: string;
  limit?: number;
} | null {
  const query = new URL(request.url).searchParams;
  const allowed = ["status", "from", "to", "after", "limit"];
  if ([...query.keys()].some((key) => !allowed.includes(key)) ||
      allowed.some((key) => query.getAll(key).length > 1)) return null;
  const rawStatus = query.get("status");
  const status = rawStatus === null
    ? undefined
    : RESERVATION_STATUSES.find((candidate) => candidate === rawStatus);
  if (rawStatus !== null && status === undefined) return null;
  const rawFrom = query.get("from");
  const rawTo = query.get("to");
  if ((rawFrom === null) !== (rawTo === null)) return null;
  const from = rawFrom === null ? undefined : parseInstant(rawFrom);
  const to = rawTo === null ? undefined : parseInstant(rawTo);
  if ((rawFrom !== null && !from) || (rawTo !== null && !to) ||
      (from && to && (from >= to || to.getTime() - from.getTime() > 366 * 86_400_000))) return null;
  const after = query.get("after");
  if (after !== null && !/^[A-Za-z0-9_-]{1,512}$/.test(after)) return null;
  const rawLimit = query.get("limit");
  if (rawLimit !== null && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit)) return null;
  return Object.freeze({
    ...(status === undefined ? {} : { status }),
    ...(from === undefined || from === null ? {} : { from }),
    ...(to === undefined || to === null ? {} : { to }),
    ...(after === null ? {} : { after }),
    ...(rawLimit === null ? {} : { limit: Number(rawLimit) }),
  });
}

function parsePartySearch(body: unknown): { query: string; limit?: number } | null {
  if (!isObject(body) || !exactKeys(body, ["query"], ["limit"]) ||
      typeof body.query !== "string" ||
      (body.limit !== undefined &&
        (typeof body.limit !== "number" || !Number.isSafeInteger(body.limit) || body.limit < 1 || body.limit > 50))) {
    return null;
  }
  return Object.freeze({ query: body.query, ...(body.limit === undefined ? {} : { limit: body.limit }) });
}

const PARTY_KINDS: readonly PartyKind[] = ["person", "org"];
const PARTY_ROLES: readonly PartyRole[] = [
  "guest", "company", "agent", "source", "vendor", "owner", "staff", "contact",
];
const PARTY_CONTACT_KINDS = ["email", "phone", "whatsapp"] as const;

interface PartyCreateDraft {
  readonly kind: PartyKind;
  readonly displayName: string;
  readonly legalName?: string | null;
  readonly roles: readonly PartyRole[];
  readonly contacts: readonly PartyContactInput[];
  readonly acknowledgedDuplicatePartyIds: readonly string[];
}

function parsePartyCreate(body: unknown): PartyCreateDraft | null {
  if (!isObject(body) || !exactKeys(body, [
    "kind", "displayName", "roles", "contacts", "acknowledgedDuplicatePartyIds",
  ], ["legalName"]) ||
      typeof body.kind !== "string" || !PARTY_KINDS.includes(body.kind as PartyKind) ||
      typeof body.displayName !== "string" ||
      (body.legalName !== undefined && body.legalName !== null && typeof body.legalName !== "string") ||
      !Array.isArray(body.roles) || body.roles.length < 1 || body.roles.length > PARTY_ROLES.length ||
      body.roles.some((role) => typeof role !== "string" || !PARTY_ROLES.includes(role as PartyRole)) ||
      !Array.isArray(body.contacts) || body.contacts.length > 6 ||
      !Array.isArray(body.acknowledgedDuplicatePartyIds) || body.acknowledgedDuplicatePartyIds.length > 50 ||
      body.acknowledgedDuplicatePartyIds.some((id) => typeof id !== "string" || !UUID.test(id))) return null;
  const contacts: PartyContactInput[] = [];
  for (const contact of body.contacts) {
    if (!isObject(contact) || !exactKeys(contact, ["kind", "value"], ["isPrimary"]) ||
        typeof contact.kind !== "string" ||
        !PARTY_CONTACT_KINDS.includes(contact.kind as typeof PARTY_CONTACT_KINDS[number]) ||
        typeof contact.value !== "string" ||
        (contact.isPrimary !== undefined && typeof contact.isPrimary !== "boolean")) return null;
    contacts.push(Object.freeze({
      kind: contact.kind as typeof PARTY_CONTACT_KINDS[number],
      value: contact.value,
      ...(contact.isPrimary === undefined ? {} : { isPrimary: contact.isPrimary }),
    }));
  }
  return Object.freeze({
    kind: body.kind as PartyKind,
    displayName: body.displayName,
    ...(body.legalName === undefined ? {} : { legalName: body.legalName as string | null }),
    roles: Object.freeze([...(body.roles as PartyRole[])]),
    contacts: Object.freeze(contacts),
    acknowledgedDuplicatePartyIds: Object.freeze([...(body.acknowledgedDuplicatePartyIds as string[])]),
  });
}

const RESERVATION_MUTABLE_FIELDS = Object.freeze([
  "notes", "eta", "etd", "marketCode", "sourceCode", "originCode",
] as const);

function parseReservationMutation(body: unknown): {
  expected: ReservationMutableFields;
  changes: ReservationMutableFields;
} | null {
  if (!isObject(body) || !exactKeys(body, ["expected", "changes"]) ||
      !isObject(body.expected) || !isObject(body.changes)) return null;
  const expected = body.expected;
  const changes = body.changes;
  const allowed = new Set<string>(RESERVATION_MUTABLE_FIELDS);
  const expectedKeys = Object.keys(expected).sort();
  const changeKeys = Object.keys(changes).sort();
  if (expectedKeys.length === 0 || expectedKeys.some((key) => !allowed.has(key)) ||
      expectedKeys.length !== changeKeys.length || expectedKeys.some((key, index) => key !== changeKeys[index])) return null;
  if (expectedKeys.some((key) => expected[key] !== null && typeof expected[key] !== "string") ||
      changeKeys.some((key) => changes[key] !== null && typeof changes[key] !== "string")) return null;
  return Object.freeze({ expected: Object.freeze({ ...expected }), changes: Object.freeze({ ...changes }) });
}

function parseReservationCancellation(body: unknown): { reason: string; approvalId?: string } | null {
  if (!isObject(body) || !exactKeys(body, ["reason"], ["approvalId"]) ||
      typeof body.reason !== "string" ||
      (body.approvalId !== undefined && (typeof body.approvalId !== "string" || !UUID.test(body.approvalId)))) return null;
  return Object.freeze({ reason: body.reason, ...(body.approvalId === undefined ? {} : { approvalId: body.approvalId }) });
}

function parseExpectedSegmentPeriod(value: unknown): ExpectedSegmentPeriod | null {
  if (!isObject(value) || !exactKeys(value, ["from", "to"]) ||
      typeof value.from !== "string" || typeof value.to !== "string") return null;
  const from = parseInstant(value.from);
  const to = parseInstant(value.to);
  return from && to && from < to
    ? Object.freeze({ from: value.from, to: value.to })
    : null;
}

function parseSegmentDeparture(body: unknown): {
  expectedPeriod: ExpectedSegmentPeriod;
  newDeparture: string;
} | null {
  if (!isObject(body) || !exactKeys(body, ["expectedPeriod", "newDeparture"]) ||
      typeof body.newDeparture !== "string" || !parseInstant(body.newDeparture)) return null;
  const expectedPeriod = parseExpectedSegmentPeriod(body.expectedPeriod);
  return expectedPeriod ? Object.freeze({ expectedPeriod, newDeparture: body.newDeparture }) : null;
}

function parseSegmentMove(body: unknown): {
  expectedSellableUnitId: string;
  expectedPeriod: ExpectedSegmentPeriod;
  destinationSellableUnitId: string;
} | null {
  if (!isObject(body) || !exactKeys(body, [
    "expectedSellableUnitId", "expectedPeriod", "destinationSellableUnitId",
  ]) || typeof body.expectedSellableUnitId !== "string" ||
      !UUID.test(body.expectedSellableUnitId) ||
      typeof body.destinationSellableUnitId !== "string" ||
      !UUID.test(body.destinationSellableUnitId)) return null;
  const expectedPeriod = parseExpectedSegmentPeriod(body.expectedPeriod);
  return expectedPeriod ? Object.freeze({
    expectedSellableUnitId: body.expectedSellableUnitId,
    expectedPeriod,
    destinationSellableUnitId: body.destinationSellableUnitId,
  }) : null;
}

function parseOfflineLease(body: unknown): {
  sellableUnitId: string;
  from: Date;
  to: Date;
  deviceId: string;
  deviceLabel?: string;
  leaseHours: number;
} | null {
  if (!isObject(body) ||
      !exactKeys(body, ["sellableUnitId", "from", "to", "deviceId", "leaseHours"], ["deviceLabel"]) ||
      typeof body.sellableUnitId !== "string" || !UUID.test(body.sellableUnitId) ||
      typeof body.deviceId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.deviceId) ||
      typeof body.leaseHours !== "number" || !Number.isInteger(body.leaseHours) ||
      body.leaseHours < 1 || body.leaseHours > 168 ||
      (body.deviceLabel !== undefined &&
        (typeof body.deviceLabel !== "string" || body.deviceLabel !== body.deviceLabel.trim() ||
          !/^[^\u0000-\u001f\u007f]{1,120}$/u.test(body.deviceLabel)))) return null;
  const from = parseInstant(body.from);
  const to = parseInstant(body.to);
  return from && to && from < to ? {
    sellableUnitId: body.sellableUnitId,
    from,
    to,
    deviceId: body.deviceId,
    ...(body.deviceLabel === undefined ? {} : { deviceLabel: body.deviceLabel }),
    leaseHours: body.leaseHours,
  } : null;
}

interface PropertyRow {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string | null;
}

async function listGrantedProperties(context: TenantRequestContext & {
  identity: { actorId: string; scopes: readonly string[] };
}, permissionCode = AVAILABILITY_SCOPE): Promise<PropertyRow[]> {
  return context.tx<PropertyRow[]>`
    SELECT DISTINCT target.id, target.name, target.timezone, target.currency
    FROM user_role
    JOIN role
      ON role.id = user_role.role_id
     AND role.tenant_id = user_role.tenant_id
    JOIN role_permission
      ON role_permission.role_id = role.id
     AND role_permission.permission_code = ${permissionCode}
    JOIN org_node AS grant_node
      ON grant_node.id = user_role.scope_node
     AND grant_node.tenant_id = user_role.tenant_id
    JOIN org_node AS target
      ON target.tenant_id = user_role.tenant_id
     AND target.kind = 'property'
     AND target.path <@ grant_node.path
    WHERE user_role.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND user_role.user_id = ${context.identity.actorId}::uuid
    ORDER BY target.name, target.id
  `;
}

type InventoryOperations = Pick<InventoryService,
  "createUnitType" | "createSpace" | "createSellableUnit" |
  "getUnitType" | "listUnitTypes" | "listSpaces" | "listSellableUnits"
>;

interface BulkRoomDraft {
  readonly code: string;
  readonly name?: string;
  readonly floor?: string;
}

function parseBulkRooms(body: unknown): { unitTypeId: string; rooms: readonly BulkRoomDraft[] } | null {
  if (!isObject(body) || !exactKeys(body, ["unitTypeId", "rooms"]) ||
      typeof body.unitTypeId !== "string" || !UUID.test(body.unitTypeId) ||
      !Array.isArray(body.rooms) || body.rooms.length < 1 || body.rooms.length > 200) return null;
  const rooms: BulkRoomDraft[] = [];
  const codes = new Set<string>();
  for (const item of body.rooms) {
    if (!isObject(item) || !exactKeys(item, ["code"], ["name", "floor"]) ||
        typeof item.code !== "string" ||
        (item.name !== undefined && typeof item.name !== "string") ||
        (item.floor !== undefined && typeof item.floor !== "string")) return null;
    if (item.name !== undefined &&
        (item.name !== item.name.trim() || item.name.length < 1 || item.name.length > 200)) return null;
    if (item.floor !== undefined &&
        (item.floor !== item.floor.trim() || item.floor.length < 1 || item.floor.length > 64)) return null;
    if (codes.has(item.code)) return null;
    codes.add(item.code);
    rooms.push({
      code: item.code,
      ...(item.name === undefined ? {} : { name: item.name }),
      ...(item.floor === undefined ? {} : { floor: item.floor }),
    });
  }
  return { unitTypeId: body.unitTypeId, rooms };
}

type RestrictionOperations = Pick<RestrictionService, "list" | "createBatch">;
const RESTRICTION_KINDS: readonly RestrictionKind[] = [
  "closed", "cta", "ctd", "min_los", "max_los", "min_adv", "max_adv",
];

function parseRestrictionBatch(body: unknown): readonly RestrictionDraft[] | null {
  if (!isObject(body) || !exactKeys(body, ["restrictions"]) || !Array.isArray(body.restrictions)) return null;
  const restrictions: RestrictionDraft[] = [];
  for (const item of body.restrictions) {
    if (!isObject(item) || !exactKeys(item, ["kind", "stayStart", "stayEnd"], [
      "value", "unitTypeId", "ratePlanId", "channelCode",
    ])) return null;
    if (typeof item.kind !== "string" || !RESTRICTION_KINDS.includes(item.kind as RestrictionKind) ||
        typeof item.stayStart !== "string" || typeof item.stayEnd !== "string") return null;
    if (item.value !== undefined && item.value !== null && typeof item.value !== "number") return null;
    if (item.unitTypeId !== undefined && item.unitTypeId !== null && typeof item.unitTypeId !== "string") return null;
    if (item.ratePlanId !== undefined && item.ratePlanId !== null && typeof item.ratePlanId !== "string") return null;
    if (item.channelCode !== undefined && item.channelCode !== null && typeof item.channelCode !== "string") return null;
    restrictions.push({
      kind: item.kind as RestrictionKind,
      stayStart: item.stayStart,
      stayEnd: item.stayEnd,
      ...(item.value === undefined ? {} : { value: item.value as number | null }),
      ...(item.unitTypeId === undefined ? {} : { unitTypeId: item.unitTypeId as string | null }),
      ...(item.ratePlanId === undefined ? {} : { ratePlanId: item.ratePlanId as string | null }),
      ...(item.channelCode === undefined ? {} : { channelCode: item.channelCode as string | null }),
    });
  }
  return restrictions;
}

type RateOperations = Pick<RateConfigurationService,
  "listPolicies" | "listRatePlans" | "createPolicy" | "createRatePlan"
>;

type PricingOperations = Pick<RatePricingService, "create" | "findCurrent" | "supersede">;
interface RateBuilderOperations {
  readonly models: Pick<RateModelService, "createDraftVersion" | "listDraftVersions">;
  readonly targets: Pick<RateTargetService, "createDraftVersion" | "listDraftVersions">;
  readonly publication: Pick<RatePublicationService,
    "createDraftVersion" | "simulateDraft" | "requestPublicationApproval" |
    "listPublicationApprovals" | "decidePublicationApproval" |
    "publishDraft" | "createUndoDraftVersion" | "listReleaseVersions"
  >;
  readonly quote: Pick<RateQuoteService, "resolve">;
  readonly intent?: Pick<RateIntentService, "interpret">;
}

type RatePublicationApprovalView = Awaited<ReturnType<RatePublicationService["listPublicationApprovals"]>>["approvals"][number];

const RELEASE_POLICY_FIELDS = Object.freeze([
  ["cancellation", "cancellationPolicyId"],
  ["deposit", "depositPolicyId"],
  ["guarantee", "guaranteePolicyId"],
  ["no_show", "noShowPolicyId"],
] as const);

function releasePolicyEvidence(release: RatePlanRelease) {
  const policy = release.compositionSpec.policy;
  return Object.freeze(RELEASE_POLICY_FIELDS.flatMap(([kind, field]) => {
    const policyId = policy[field];
    return policyId ? [Object.freeze({
    kind,
    policyId,
    evidenceRef: `rate-release:${release.id}:${kind}:${policyId}`,
    })] : [];
  }));
}

function bindRateBuilderPreviewCells(
  release: RatePlanRelease,
  previewCells: readonly unknown[],
): readonly Readonly<Record<string, unknown>>[] | null {
  if (previewCells.length < 1 || previewCells.length > 500) return null;
  const policyEvidence = releasePolicyEvidence(release);
  const bound: Readonly<Record<string, unknown>>[] = [];
  for (const cell of previewCells) {
    if (!isObject(cell) || Object.prototype.hasOwnProperty.call(cell, "policyEvidence")) return null;
    bound.push(Object.freeze({ ...cell, policyEvidence }));
  }
  return Object.freeze(bound);
}

type BlockOperations = Pick<OperationalBlockService, "listActive" | "open" | "close">;
type PolicyOperations = Pick<InventoryPolicyService, "get" | "setOosSellability">;
type HoldOperations = Pick<HoldService,
  "listActive" | "place" | "release" |
  "listActiveOfflineLeases" | "placeOfflineLease" | "releaseOfflineLease"
>;
type ReservationOperations = Pick<ReservationCommitService, "commitHeld" | "commitDirect">;
type ReservationOfferOperations = Pick<ReservationOfferSearchService, "search">;
type ReservationGuestOperations = Pick<ReservationGuestService, "findByConfirmation" | "replace">;
type ReservationLifecycleOperations = Pick<ReservationLifecycleService, "findByConfirmation" | "modify" | "cancel" | "reinstate">;
type ReservationSegmentOperations = Pick<ReservationSegmentService, "findByConfirmation" | "changeDeparture" | "moveRoom">;
type ReservationBoardOperations = Pick<ReservationBoardService, "list">;
type ReservationDetailOperations = Pick<ReservationDetailService, "findById">;
type PartyOperations = Pick<PartyProfileService, "search" | "create">;
type FolioStatementOperations = Pick<FolioStatementService, "get">;
type ChargeOperations = Pick<ChargeService, "postCharge">;
type ChargeCorrectionOperations = Pick<ChargeCorrectionService, "reverseCharge">;
type FolioOperations = Pick<FolioService, "openPrimary" | "openAdditional">;
type FolioTransferOperations = Pick<FolioTransferService, "preview" | "transfer">;
type HostedDepositOperations = Pick<HostedDepositService, "create" | "apply" | "statusForOperator">;

const MAX_MONEY = 9_223_372_036_854_775_807n;

function parseAmount(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value)) return null;
  const amount = BigInt(value);
  return amount <= MAX_MONEY ? amount : null;
}

function parsePricingValue(value: unknown): RatePricingInput | null {
  if (!isObject(value) || !exactKeys(value, ["occupancy"], ["extraAdultMinor", "extraChildren"]) ||
      !Array.isArray(value.occupancy) || value.occupancy.length === 0) return null;
  const occupancy: Record<string, bigint> = {};
  for (const tier of value.occupancy) {
    if (!isObject(tier) || !exactKeys(tier, ["adults", "amountMinor"]) ||
        !Number.isInteger(tier.adults) || (tier.adults as number) < 1 || (tier.adults as number) > 100 ||
        occupancy[String(tier.adults)] !== undefined) return null;
    const amount = parseAmount(tier.amountMinor);
    if (amount === null) return null;
    occupancy[String(tier.adults)] = amount;
  }
  const extraAdultMinor = value.extraAdultMinor === undefined ? undefined : parseAmount(value.extraAdultMinor);
  if (extraAdultMinor === null) return null;
  const rawChildren = value.extraChildren ?? [];
  if (!Array.isArray(rawChildren)) return null;
  const extraChildren: Array<{ maxAge: number; amountMinor: bigint }> = [];
  for (const child of rawChildren) {
    if (!isObject(child) || !exactKeys(child, ["maxAge", "amountMinor"]) || !Number.isInteger(child.maxAge)) return null;
    const amountMinor = parseAmount(child.amountMinor);
    if (amountMinor === null) return null;
    extraChildren.push({ maxAge: child.maxAge as number, amountMinor });
  }
  return { occupancy, ...(extraAdultMinor === undefined ? {} : { extraAdultMinor }),
    ...(value.extraChildren === undefined ? {} : { extraChildren }) };
}

function parsePricing(body: unknown): Omit<CreateRatePriceInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["ratePlanId", "unitTypeId", "stayStart", "stayEnd", "pricing"], ["dowMask"]) ||
      typeof body.ratePlanId !== "string" || typeof body.unitTypeId !== "string" ||
      typeof body.stayStart !== "string" || typeof body.stayEnd !== "string" ||
      (body.dowMask !== undefined && !Number.isInteger(body.dowMask))) return null;
  const pricing = parsePricingValue(body.pricing);
  if (!pricing) return null;
  return { ratePlanId: body.ratePlanId, unitTypeId: body.unitTypeId, stayStart: body.stayStart,
    stayEnd: body.stayEnd, ...(body.dowMask === undefined ? {} : { dowMask: body.dowMask as number }), pricing };
}

function ratePriceJson(price: Awaited<ReturnType<RatePricingService["findCurrent"]>>): JsonValue {
  return {
    id: price.id, tenantId: price.tenantId, propertyNode: price.propertyNode,
    ratePlanId: price.ratePlanId, unitTypeId: price.unitTypeId,
    stayStart: price.stayStart, stayEnd: price.stayEnd, dowMask: price.dowMask,
    currency: price.currency,
    pricing: {
      occupancy: Object.fromEntries(Object.entries(price.pricing.occupancy).map(([tier, amount]) => [tier, amount.toString()])),
      extraAdultMinor: price.pricing.extraAdultMinor?.toString() ?? null,
      extraChildren: price.pricing.extraChildren.map(({ maxAge, amountMinor }) => ({ maxAge, amountMinor: amountMinor.toString() })),
    },
    recordedAt: price.recordedAt.toISOString(), supersededBy: price.supersededBy,
  };
}

function canonicalJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalJson(item)]));
  }
  return value;
}

function parsePolicy(body: unknown): Omit<CreatePolicyInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["kind", "name", "content"]) ||
      typeof body.kind !== "string" || !(["cancellation", "deposit", "guarantee", "no_show"] as const)
        .includes(body.kind as PolicyKind) ||
      typeof body.name !== "string" || !isObject(body.content)) return null;
  return { kind: body.kind as PolicyKind, name: body.name, content: body.content };
}

function parseRatePlan(body: unknown): Omit<CreateRatePlanInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["code", "name", "currency"], [
    "taxInclusive", "cancellationPolicyId", "guaranteePolicyId", "depositPolicyId", "marketCode", "sourceCode",
  ]) || typeof body.code !== "string" || typeof body.name !== "string" || typeof body.currency !== "string") return null;
  if (body.taxInclusive !== undefined && typeof body.taxInclusive !== "boolean") return null;
  for (const key of ["cancellationPolicyId", "guaranteePolicyId", "depositPolicyId", "marketCode", "sourceCode"] as const) {
    if (body[key] !== undefined && body[key] !== null && typeof body[key] !== "string") return null;
  }
  return {
    code: body.code,
    name: body.name,
    currency: body.currency,
    ...(body.taxInclusive === undefined ? {} : { taxInclusive: body.taxInclusive }),
    ...(body.cancellationPolicyId === undefined ? {} : { cancellationPolicyId: body.cancellationPolicyId as string | null }),
    ...(body.guaranteePolicyId === undefined ? {} : { guaranteePolicyId: body.guaranteePolicyId as string | null }),
    ...(body.depositPolicyId === undefined ? {} : { depositPolicyId: body.depositPolicyId as string | null }),
    ...(body.marketCode === undefined ? {} : { marketCode: body.marketCode as string | null }),
    ...(body.sourceCode === undefined ? {} : { sourceCode: body.sourceCode as string | null }),
  };
}

function parseUnitType(body: unknown): Omit<CreateUnitTypeInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["code", "name", "profileKey"], [
    "baseOccupancy", "maxOccupancy", "attrs", "sortOrder",
  ])) return null;
  if (typeof body.code !== "string" || typeof body.name !== "string" || typeof body.profileKey !== "string") return null;
  if (body.baseOccupancy !== undefined && typeof body.baseOccupancy !== "number") return null;
  if (body.maxOccupancy !== undefined && typeof body.maxOccupancy !== "number") return null;
  if (body.sortOrder !== undefined && typeof body.sortOrder !== "number") return null;
  if (body.attrs !== undefined && !isObject(body.attrs)) return null;
  return {
    code: body.code,
    name: body.name,
    profileKey: body.profileKey,
    ...(body.baseOccupancy === undefined ? {} : { baseOccupancy: body.baseOccupancy }),
    ...(body.maxOccupancy === undefined ? {} : { maxOccupancy: body.maxOccupancy }),
    ...(body.attrs === undefined ? {} : { attrs: body.attrs }),
    ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
  };
}

function parseSpace(body: unknown): Omit<CreateSpaceInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["code", "profileKey"], [
    "capacity", "maxOccupancy", "floor", "areaSqm", "genderPolicy", "attrs",
  ])) return null;
  if (typeof body.code !== "string" || typeof body.profileKey !== "string") return null;
  if (body.capacity !== undefined && typeof body.capacity !== "number") return null;
  if (body.maxOccupancy !== undefined && body.maxOccupancy !== null && typeof body.maxOccupancy !== "number") return null;
  if (body.floor !== undefined && body.floor !== null && typeof body.floor !== "string") return null;
  if (body.areaSqm !== undefined && body.areaSqm !== null && typeof body.areaSqm !== "number") return null;
  if (body.genderPolicy !== undefined && body.genderPolicy !== null &&
      body.genderPolicy !== "any" && body.genderPolicy !== "female" && body.genderPolicy !== "male") return null;
  if (body.attrs !== undefined && !isObject(body.attrs)) return null;
  return {
    code: body.code,
    profileKey: body.profileKey,
    ...(body.capacity === undefined ? {} : { capacity: body.capacity }),
    ...(body.maxOccupancy === undefined ? {} : { maxOccupancy: body.maxOccupancy }),
    ...(body.floor === undefined ? {} : { floor: body.floor }),
    ...(body.areaSqm === undefined ? {} : { areaSqm: body.areaSqm }),
    ...(body.genderPolicy === undefined ? {} : { genderPolicy: body.genderPolicy }),
    ...(body.attrs === undefined ? {} : { attrs: body.attrs }),
  };
}

function parseSellableUnit(body: unknown): Omit<CreateSellableUnitInput, "envelope"> | null {
  if (!isObject(body) || !exactKeys(body, ["unitTypeId", "name", "spaces"]) ||
      typeof body.unitTypeId !== "string" || typeof body.name !== "string" || !Array.isArray(body.spaces)) return null;
  const spaces: Array<{ spaceId: string; claimMode: "exclusive" | "positional" }> = [];
  for (const item of body.spaces) {
    if (!isObject(item) || !exactKeys(item, ["spaceId", "claimMode"]) ||
        typeof item.spaceId !== "string" || (item.claimMode !== "exclusive" && item.claimMode !== "positional")) return null;
    spaces.push({ spaceId: item.spaceId, claimMode: item.claimMode });
  }
  return { unitTypeId: body.unitTypeId, name: body.name, spaces };
}

function parseOperationalBlock(body: unknown): { spaceId: string; kind: "ooo" | "oos";
  from: Date; to: Date; reason: string } | null {
  if (!isObject(body) || !exactKeys(body, ["spaceId", "kind", "from", "to", "reason"]) ||
      typeof body.spaceId !== "string" || (body.kind !== "ooo" && body.kind !== "oos") ||
      typeof body.reason !== "string") return null;
  const from = parseInstant(body.from);
  const to = parseInstant(body.to);
  if (!from || !to) return null;
  return { spaceId: body.spaceId, kind: body.kind, from, to, reason: body.reason };
}

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function rateBuilderJsonValue(value: unknown): JsonValue {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(rateBuilderJsonValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, rateBuilderJsonValue(entry)])) as JsonValue;
  }
  return value as JsonValue;
}

function reservationOfferHttpResult(result: ReservationOfferSearchResult): JsonValue {
  return rateBuilderJsonValue({
    options: result.options.map((offer) => ({
      option_ref: offer.optionRef,
      state: offer.state,
      reason: offer.reason,
      bookable: offer.bookable,
      promise: offer.promise,
      commit_arbitration_required: offer.commitArbitrationRequired,
      sellable_unit: offer.sellableUnit,
      unit_type: {
        id: offer.unitType.id,
        code: offer.unitType.code,
        name: offer.unitType.name,
        profile_key: offer.unitType.profileKey,
        max_occupancy: offer.unitType.maxOccupancy,
      },
      rate_plan: {
        id: offer.ratePlan.id,
        code: offer.ratePlan.code,
        name: offer.ratePlan.name,
        currency: offer.ratePlan.currency,
        tax_inclusive: offer.ratePlan.taxInclusive,
      },
      release: {
        id: offer.release.id,
        version: offer.release.version,
        content_hash: offer.release.contentHash,
      },
      stay: {
        from: offer.stay.from,
        to: offer.stay.to,
        local_from: offer.stay.localFrom,
        local_to: offer.stay.localTo,
      },
      party: { adults: offer.party.adults, child_ages: offer.party.childAges },
      per_night: offer.perNight.map((night) => ({ date: night.date, amount_minor: night.amountMinor })),
      total: offer.total === null ? null : {
        amount_minor: offer.total.amountMinor,
        currency: offer.total.currency,
        kind: offer.total.kind,
      },
      taxes: offer.taxes.map((tax) => ({
        night_date: tax.nightDate,
        jurisdiction_key: tax.jurisdictionKey,
        evidence_ref: tax.evidenceRef,
      })),
      tax_assignment_state: offer.taxAssignmentState,
      policies: Object.fromEntries(Object.entries(offer.policies).map(([kind, policy]) => [
        kind,
        policy === null ? null : { policy_id: policy.policyId, evidence_ref: policy.evidenceRef },
      ])),
      package: offer.package,
      selected_promotion_codes: offer.selectedPromotionCodes,
      applied_promotion_codes: offer.appliedPromotionCodes,
      refund_treatment: offer.refundTreatment,
      restrictions_applied: offer.restrictionsApplied,
      operational_blocks_applied: offer.operationalBlocksApplied.map((block) => ({
        id: block.id,
        space_id: block.spaceId,
        kind: block.kind,
        reason: block.reason,
        blocks: block.blocks,
      })),
      available_count: offer.availableCount,
      evidence: {
        quote_hash: offer.evidence.quoteHash,
        availability_ref: offer.evidence.availabilityRef,
        booking_instant: offer.evidence.bookingInstant,
      },
    })),
    issues: result.issues.map((issue) => ({
      sellable_unit_id: issue.sellableUnitId,
      unit_type_code: issue.unitTypeCode,
      rate_plan_id: issue.ratePlanId,
      rate_plan_code: issue.ratePlanCode,
      reason: issue.reason,
    })),
    summary: {
      inventory_options: result.summary.inventoryOptions,
      candidate_pairs: result.summary.candidatePairs,
      evaluated_pairs: result.summary.evaluatedPairs,
      bookable: result.summary.bookable,
      blocked: result.summary.blocked,
      unpriced: result.summary.unpriced,
      conflicted: result.summary.conflicted,
      publication_unavailable: result.summary.publicationUnavailable,
      pricing_evidence_unavailable: result.summary.pricingEvidenceUnavailable,
      work_limit: result.summary.workLimit,
    },
  });
}

function parseRateApprovalPage(request: Request): { after?: string; limit?: number } | null {
  const query = new URL(request.url).searchParams;
  const allowed = new Set(["after", "limit"]);
  if ([...query.keys()].some((key) => !allowed.has(key)) ||
      [...allowed].some((key) => query.getAll(key).length > 1)) return null;
  const after = query.get("after");
  const rawLimit = query.get("limit");
  if (after !== null && !/^[A-Za-z0-9_-]{1,512}$/.test(after)) return null;
  if (rawLimit !== null && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit)) return null;
  return {
    ...(after === null ? {} : { after }),
    ...(rawLimit === null ? {} : { limit: Number(rawLimit) }),
  };
}

function rateApprovalJson(approval: RatePublicationApprovalView, actorId: string): JsonValue {
  const canDecide = approval.status === "pending" && approval.requestedBy.id !== actorId;
  const canPublish = approval.status === "approved" && approval.decidedBy?.id === actorId &&
    approval.releaseStatus === "draft" && approval.releaseIsLatest;
  return rateBuilderJsonValue({
    id: approval.id,
    releaseId: approval.releaseId,
    releaseVersion: approval.releaseVersion,
    releaseStatus: approval.releaseStatus,
    releaseIsLatest: approval.releaseIsLatest,
    status: approval.status,
    requestedBy: approval.requestedBy,
    decidedBy: approval.decidedBy,
    createdAt: approval.createdAt,
    decidedAt: approval.decidedAt,
    canDecide,
    canPublish,
  });
}

function releaseAuthoringCommand(
  release: RatePlanRelease,
  modelDrafts: readonly RateModelDraft[],
  targetDrafts: readonly RateTargetDraft[],
): CanonicalRateAuthoringCommand {
  const matchingModels = modelDrafts.filter(({ id, extensionVersion }) =>
    id === release.modelDraftId && extensionVersion === release.modelDraftVersion
  );
  const matchingTargets = targetDrafts.filter(({ id, extensionVersion }) =>
    id === release.targetDraftId && extensionVersion === release.targetDraftVersion
  );
  if (matchingModels.length !== 1 || matchingTargets.length !== 1) {
    throw new RatePublicationNotFoundError("Stored rate release references were not found exactly once");
  }
  const model = matchingModels[0]!;
  const target = matchingTargets[0]!;
  const sameScope = model.tenantId === release.tenantId && target.tenantId === release.tenantId &&
    model.propertyNode === release.propertyNode && target.propertyNode === release.propertyNode &&
    model.ratePlanId === release.ratePlanId && target.ratePlanId === release.ratePlanId;
  if (!sameScope || model.authoringMode !== target.authoringMode ||
      model.modelKey !== release.evaluatorSpec.modelKey) {
    throw new RatePublicationError("Stored rate release references do not reconstruct one canonical command");
  }
  return compileRateAuthoringCommand(rateBuilderJsonValue({
    authoringMode: model.authoringMode,
    ratePlanId: release.ratePlanId,
    model: {
      key: model.modelKey,
      version: model.modelVersion,
      componentModelKeys: model.componentModelKeys,
    },
    target: { rules: target.rules },
    evaluator: release.evaluatorSpec,
    composition: release.compositionSpec,
    rmsBinding: release.rmsBinding,
  }));
}

function releasesWithAuthoringCommands(
  releases: readonly RatePlanRelease[],
  modelDrafts: readonly RateModelDraft[],
  targetDrafts: readonly RateTargetDraft[],
) {
  return Object.freeze(releases.map((release) => Object.freeze({
    ...release,
    authoringCommand: releaseAuthoringCommand(release, modelDrafts, targetDrafts),
  })));
}

export class OperatorHttpApi {
  readonly #login: LocalLoginService;
  readonly #availability: Pick<AvailabilityService, "search">;
  readonly #inventory?: InventoryOperations;
  readonly #idempotency: PostgresIdempotency;
  readonly #restrictions?: RestrictionOperations;
  readonly #rates?: RateOperations;
  readonly #pricing?: PricingOperations;
  readonly #blocks?: BlockOperations;
  readonly #policy?: PolicyOperations;
  readonly #holds?: HoldOperations;
  readonly #projection?: Pick<AvailabilityProjectionService, "status" | "replaceHorizon">;
  readonly #runtimeStatus: OperatorRuntimeStatus;
  readonly #rateBuilder?: RateBuilderOperations;
  readonly #reservations?: ReservationOperations;
  readonly #reservationOffers?: ReservationOfferOperations;
  readonly #reservationGuests?: ReservationGuestOperations;
  readonly #reservationLifecycle?: ReservationLifecycleOperations;
  readonly #reservationSegments?: ReservationSegmentOperations;
  readonly #reservationBoard?: ReservationBoardOperations;
  readonly #reservationDetail?: ReservationDetailOperations;
  readonly #parties?: PartyOperations;
  readonly #folioStatements?: FolioStatementOperations;
  readonly #charges?: ChargeOperations;
  readonly #chargeCorrections?: ChargeCorrectionOperations;
  readonly #folios?: FolioOperations;
  readonly #folioTransfers?: FolioTransferOperations;
  readonly #hostedDeposits?: HostedDepositOperations;

  constructor(
    login: LocalLoginService,
    availability: Pick<AvailabilityService, "search"> = new AvailabilityService(),
    inventory?: InventoryOperations,
    idempotency = new PostgresIdempotency(),
    restrictions?: RestrictionOperations,
    rates?: RateOperations,
    pricing?: PricingOperations,
    blocks?: BlockOperations,
    policy?: PolicyOperations,
    holds?: HoldOperations,
    projection?: Pick<AvailabilityProjectionService, "status" | "replaceHorizon">,
    runtimeStatus: OperatorRuntimeStatus = DEFAULT_OPERATOR_RUNTIME_STATUS,
    rateBuilder?: RateBuilderOperations,
    reservations?: ReservationOperations,
    reservationOffers?: ReservationOfferOperations,
    reservationGuests?: ReservationGuestOperations,
    reservationLifecycle?: ReservationLifecycleOperations,
    reservationSegments?: ReservationSegmentOperations,
    parties?: PartyOperations,
    folioStatements?: FolioStatementOperations,
    charges?: ChargeOperations,
    reservationBoard?: ReservationBoardOperations,
    reservationDetail?: ReservationDetailOperations,
    folios?: FolioOperations,
    chargeCorrections?: ChargeCorrectionOperations,
    folioTransfers?: FolioTransferOperations,
    hostedDeposits?: HostedDepositOperations,
  ) {
    this.#login = login;
    this.#availability = availability;
    this.#inventory = inventory;
    this.#idempotency = idempotency;
    this.#restrictions = restrictions;
    this.#rates = rates;
    this.#pricing = pricing;
    this.#blocks = blocks;
    this.#policy = policy;
    this.#holds = holds;
    this.#projection = projection;
    this.#runtimeStatus = runtimeStatus;
    this.#rateBuilder = rateBuilder;
    this.#reservations = reservations;
    this.#reservationOffers = reservationOffers;
    this.#reservationGuests = reservationGuests;
    this.#reservationLifecycle = reservationLifecycle;
    this.#reservationSegments = reservationSegments;
    this.#parties = parties;
    this.#folioStatements = folioStatements;
    this.#charges = charges;
    this.#reservationBoard = reservationBoard;
    this.#reservationDetail = reservationDetail;
    this.#folios = folios;
    this.#chargeCorrections = chargeCorrections;
    this.#folioTransfers = folioTransfers;
    this.#hostedDeposits = hostedDeposits;
  }

  unavailable(request: Request): Response {
    return apiError(request, 503, "service/unavailable", "Service unavailable", "Operator service is temporarily unavailable");
  }

  unauthorized(request: Request): Response {
    return apiError(request, 401, "auth/unauthorized", "Authentication required", "A valid bearer token is required");
  }

  failure(request: Request, error: unknown): Response {
    if (error instanceof FolioValidationError || error instanceof FolioStatementValidationError ||
        error instanceof ChargeValidationError || error instanceof ChargeCorrectionValidationError ||
        error instanceof FolioTransferValidationError || error instanceof HostedDepositValidationError) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Financial input is invalid");
    }
    if (error instanceof FolioNotFoundError || error instanceof FolioStatementNotFoundError ||
        error instanceof ChargeNotFoundError || error instanceof ChargeCorrectionNotFoundError ||
        error instanceof FolioTransferNotFoundError || error instanceof HostedDepositNotFoundError) {
      return apiError(request, 404, "financials/not_found", "Not found", "The requested folio or charge configuration was not found");
    }
    if (error instanceof FolioConflictError) {
      return apiError(request, 409, "financials/conflict", "Conflict", "The primary folio conflicts with current financial state");
    }
    if (error instanceof FolioTransferConflictError) {
      return apiError(request, 409, "financials/conflict", "Conflict", "The folio transfer conflicts with current financial state");
    }
    if (error instanceof HostedDepositConflictError) {
      return apiError(request, 409, "financials/conflict", "Conflict", "The hosted deposit conflicts with current financial state");
    }
    if (error instanceof ChargeConflictError) {
      return apiError(request, 409, "financials/conflict", "Conflict", "The charge conflicts with current financial state");
    }
    if (error instanceof ChargeCorrectionConflictError) {
      return apiError(request, 409, "financials/conflict", "Conflict", "The correction conflicts with current financial state");
    }
    if (error instanceof ChargeCorrectionAuthorizationError) {
      return apiError(request, 403, "auth/scope_missing", "Forbidden", "Financial adjustment access is not granted");
    }
    if (error instanceof PartyDuplicateReviewRequiredError) {
      return apiError(request, 409, "profiles/duplicate_review_required", "Duplicate review required",
        "Review every current possible duplicate before creating a distinct Party",
        { candidates: jsonValue(error.candidates) });
    }
    if (error instanceof ReservationApprovalRequiredError) {
      return apiError(request, 409, "reservations/approval_required", "Approval required", "Cancellation requires an approved supervisor waiver");
    }
    if (error instanceof ReservationLifecycleConflictError) {
      return apiError(request, 409, "reservations/lifecycle_conflict", "Conflict", "Reservation lifecycle conflicts with existing state");
    }
    if (error instanceof ReservationGuestConflictError) {
      return apiError(request, 409, "reservations/conflict", "Conflict", "Reservation guest allocation conflicts with existing state");
    }
    if (error instanceof ReservationBoardConflictError || error instanceof ReservationDetailConflictError) {
      return apiError(request, 409, "reservations/read_conflict", "Conflict", "Stored reservation data is incoherent");
    }
    if (error instanceof ReservationConflictError) {
      return apiError(request, 409, "conflict/occupancy", "Inventory conflict", "Requested inventory is no longer available");
    }
    if (error instanceof IdempotencyConflictError || error instanceof InventoryConflictError ||
        error instanceof OperationalBlockConflictError || error instanceof HoldConflictError) {
      const type = error instanceof IdempotencyConflictError ? "request/idempotency_conflict" : "inventory/conflict";
      return apiError(request, 409, type, "Conflict", "The inventory request conflicts with existing state");
    }
    if (error instanceof RateConflictError || error instanceof RatePublicationConflictError ||
        error instanceof RateQuoteConflictError) {
      return apiError(request, 409, "rates/conflict", "Conflict", "The rate configuration conflicts with existing state");
    }
    if (error instanceof IdempotencyValidationError || error instanceof InventoryValidationError) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Inventory input is invalid");
    }
    if (error instanceof PartyProfileValidationError) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Party profile input is invalid");
    }
    if (error instanceof ReservationValidationError || error instanceof ReservationOfferValidationError ||
        error instanceof ReservationGuestValidationError || error instanceof ReservationLifecycleValidationError ||
        error instanceof ReservationBoardValidationError || error instanceof ReservationDetailValidationError) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Reservation input is invalid");
    }
    if (error instanceof InventoryNotFoundError) {
      return apiError(request, 404, "inventory/not_found", "Not found", "Referenced inventory was not found");
    }
    if (error instanceof ReservationNotFoundError || error instanceof ReservationGuestNotFoundError ||
        error instanceof ReservationLifecycleNotFoundError || error instanceof ReservationDetailNotFoundError) {
      return apiError(request, 404, "reservations/not_found", "Not found", "Referenced reservation input was not found");
    }
    if (error instanceof RateValidationError || error instanceof RateAuthoringError || error instanceof RateIntentError ||
        (error instanceof RatePublicationError && !(error instanceof RatePublicationNotFoundError)) ||
        (error instanceof RateQuoteError && !(error instanceof RateQuoteNotFoundError))) {
      return apiError(request, 400, "request/invalid", "Invalid request", "Rate configuration input is invalid");
    }
    if (error instanceof RateNotFoundError || error instanceof RatePublicationNotFoundError ||
        error instanceof RateQuoteNotFoundError) {
      return apiError(request, 404, "rates/not_found", "Not found", "Referenced rate configuration was not found");
    }
    return this.unavailable(request);
  }

  async login(request: Request, body: unknown, sourceKey = "unknown"): Promise<Response> {
    const hasValidShape = isObject(body) && exactKeys(body, ["tenant", "email", "password"]);
    const input = hasValidShape
      ? body as unknown as LocalLoginInput
      : { tenant: "", email: "", password: "" };
    try {
      const result = await this.#login.authenticate(input, sourceKey);
      if (!hasValidShape || !result) {
        return apiError(request, 401, "auth/invalid_credentials", "Authentication failed", "Invalid credentials");
      }
      return apiResponse(request, result);
    } catch (error) {
      if (error instanceof LocalLoginLimitedError) {
        return apiError(
          request,
          429,
          "auth/temporarily_limited",
          "Authentication temporarily limited",
          "Try again later",
          {},
          { "retry-after": String(error.retryAfterSeconds) },
        );
      }
      return apiError(request, 503, "service/unavailable", "Service unavailable", "Authentication is temporarily unavailable");
    }
  }

  async properties(context: TenantRequestContext): Promise<Response> {
    if (!hasAvailabilityScope(context)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Availability access is not granted");
    }
    try {
      return apiResponse(context.request, { properties: await listGrantedProperties(context) });
    } catch {
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Property access is temporarily unavailable");
    }
  }

  async systemStatus(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasAvailabilityScope(context)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Project status access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const grants = await listGrantedProperties(context);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const rows = await context.tx<Array<{
      checked_at: Date;
      database_name: string;
      tenant_context: boolean;
    }>>`
      SELECT
        transaction_timestamp() AS checked_at,
        current_database() AS database_name,
        current_setting('app.tenant_id', true) = ${context.tenantId} AS tenant_context
    `;
    const database = rows[0];
    if (!database) throw new Error("PostgreSQL status probe returned no row");
    return apiResponse(context.request, {
      snapshot: PROJECT_BUILD_SNAPSHOT,
      live: {
        app: {
          state: "operational",
          checkedAt: new Date().toISOString(),
          processStartedAt: this.#runtimeStatus.processStartedAt,
        },
        database: {
          state: "operational",
          checkedAt: database.checked_at.toISOString(),
          tenantContext: database.tenant_context,
          database: database.database_name,
        },
        workers: {
          holdExpiry: this.#runtimeStatus.holdExpiryWorkerEnabled ? "configured" : "disabled",
          availabilityProjection: this.#runtimeStatus.availabilityProjectionWorkerEnabled ? "configured" : "disabled",
        },
        valkey: {
          state: "not_connected",
          detail: "Valkey is present in local Compose but is not an application dependency yet.",
        },
        ci: {
          state: "not_connected",
          detail: "External CI is not queried by the local runtime; use the linked GitHub pull request evidence.",
        },
      },
    });
  }

  async folioStatement(
    context: TenantRequestContext,
    propertyNode: string,
    reference: string,
  ): Promise<Response> {
    if (!hasScope(context, FOLIO_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Folio statement access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!UUID.test(reference) && !FOLIO_REFERENCE.test(reference)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Folio reference is invalid");
    }
    const grants = await listGrantedProperties(context, FOLIO_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const query = statementQuery(context.request);
    if (!query) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Folio statement query is invalid");
    }
    if (!this.#folioStatements) return this.unavailable(context.request);
    const adjustmentWriteGranted = hasScope(context, ADJUSTMENT_WRITE_SCOPE) &&
      (await listGrantedProperties(context, ADJUSTMENT_WRITE_SCOPE)).some(({ id }) => id === propertyNode);
    const postSealGranted = adjustmentWriteGranted && hasScope(context, ADJUSTMENT_POST_SEAL_SCOPE) &&
      (await listGrantedProperties(context, ADJUSTMENT_POST_SEAL_SCOPE)).some(({ id }) => id === propertyNode);
    const statement = await this.#folioStatements.get(context.tx, {
      tenantId: context.tenantId,
      propertyNode,
      reference,
      ...query,
      canCorrectCharge: adjustmentWriteGranted,
      canPostSealAdjustment: postSealGranted,
    });
    return apiResponse(context.request, canonicalJson(jsonValue(statement)));
  }

  async openPrimaryFolio(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, FOLIO_OPEN_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Primary folio creation is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(reservationId) || !isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Primary folio input is invalid");
    }
    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Primary folio input is invalid");
    }
    const grants = await listGrantedProperties(context, FOLIO_OPEN_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    if (!this.#folios) return this.unavailable(context.request);
    const requestId = correlationId(context.request);
    const result = await this.#folios.openPrimary(context.tx, {
      tenantId: context.tenantId,
      reservationId,
      idempotencyKey,
      envelope: createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: "folio.opened",
      }),
    });
    const response = {
      folioId: result.folioId,
      reservationId: result.reservationId,
      folioNo: result.folioNo,
      windowNo: result.windowNo,
      changed: result.changed,
      replayed: false,
    };
    return apiResponse(context.request, canonicalJson(jsonValue(response)), result.changed ? 201 : 200, {
      "idempotency-replayed": String(result.replayed),
      "x-correlation-id": requestId,
    });
  }

  async openAdditionalFolio(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, FOLIO_OPEN_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Folio window creation is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(reservationId) || !isObject(body) ||
        !exactKeys(body, ["sourceFolioId", "name"]) || typeof body.sourceFolioId !== "string" ||
        !UUID.test(body.sourceFolioId) || typeof body.name !== "string" || body.name !== body.name.trim() ||
        body.name.length < 1 || body.name.length > 80) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Additional folio input is invalid");
    }
    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Additional folio input is invalid");
    }
    const grants = await listGrantedProperties(context, FOLIO_OPEN_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    if (!this.#folios) return this.unavailable(context.request);
    const requestId = correlationId(context.request);
    const result = await this.#folios.openAdditional(context.tx, {
      tenantId: context.tenantId,
      reservationId,
      sourceFolioId: body.sourceFolioId,
      name: body.name,
      idempotencyKey,
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "folio.opened" }),
    });
    return apiResponse(context.request, canonicalJson(jsonValue(result)), 201, {
      "idempotency-replayed": String(result.replayed), "x-correlation-id": requestId,
    });
  }

  async previewFolioTransfer(
    context: TenantRequestContext,
    propertyNode: string,
    folioId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, FOLIO_TRANSFER_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Folio transfer access is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(folioId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or folio identifier is invalid");
    }
    const input = parseFolioTransfer(body);
    if (!input || input.sourceFolioId !== folioId) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Folio transfer input is invalid");
    }
    const grants = await listGrantedProperties(context, FOLIO_TRANSFER_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    if (!this.#folioTransfers) return this.unavailable(context.request);
    const requestId = correlationId(context.request);
    const result = await this.#folioTransfers.preview(context.tx, {
      tenantId: context.tenantId, ...input, idempotencyKey: `folio-transfer-preview:${requestId}`,
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "journal.posted" }),
    });
    return apiResponse(context.request, canonicalJson(jsonValue(result)));
  }

  async transferFolioGroups(
    context: TenantRequestContext,
    propertyNode: string,
    folioId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, FOLIO_TRANSFER_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Folio transfer access is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(folioId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or folio identifier is invalid");
    }
    const input = parseFolioTransfer(body);
    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (!input || input.sourceFolioId !== folioId || input.previewRevision.length === 0 ||
        !idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Folio transfer input is invalid");
    }
    const grants = await listGrantedProperties(context, FOLIO_TRANSFER_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    if (!this.#folioTransfers) return this.unavailable(context.request);
    const requestId = correlationId(context.request);
    const result = await this.#folioTransfers.transfer(context.tx, {
      tenantId: context.tenantId, ...input, idempotencyKey,
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "journal.posted" }),
    });
    return apiResponse(context.request, canonicalJson(jsonValue(result)), 201, {
      "idempotency-replayed": String(result.replayed), "x-correlation-id": requestId,
    });
  }

  async createHostedDeposit(
    context: TenantRequestContext,
    propertyNode: string,
    folioId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, PAYMENT_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Payment creation is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(folioId) || !isObject(body) ||
        !exactKeys(body, ["instrumentId", "amountMinor"]) || typeof body.instrumentId !== "string" ||
        !UUID.test(body.instrumentId) || typeof body.amountMinor !== "string" ||
        !POSITIVE_INT64.test(body.amountMinor) || BigInt(body.amountMinor) > INT64_MAX) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Hosted deposit input is invalid");
    }
    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Hosted deposit input is invalid");
    }
    const grants = await listGrantedProperties(context, PAYMENT_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    if (!this.#hostedDeposits) return this.unavailable(context.request);
    const requestId = correlationId(context.request);
    const result = await this.#hostedDeposits.create({ tenantId: context.tenantId, folioId,
      instrumentId: body.instrumentId, amountMinor: body.amountMinor, idempotencyKey,
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "deposit.requested" }) });
    return apiResponse(context.request, canonicalJson(jsonValue(result)), 201, { "x-correlation-id": requestId });
  }

  async applyHostedDeposit(
    context: TenantRequestContext,
    propertyNode: string,
    requestIdValue: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, DEPOSIT_APPLY_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Deposit application is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(requestIdValue) || !isObject(body) ||
        !exactKeys(body, ["amountMinor"]) || typeof body.amountMinor !== "string" ||
        !POSITIVE_INT64.test(body.amountMinor) || BigInt(body.amountMinor) > INT64_MAX) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Deposit application input is invalid");
    }
    const idempotencyKey = context.request.headers.get("idempotency-key");
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Deposit application input is invalid");
    }
    const grants = await listGrantedProperties(context, DEPOSIT_APPLY_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    if (!this.#hostedDeposits) return this.unavailable(context.request);
    const correlation = correlationId(context.request);
    const result = await this.#hostedDeposits.apply({ tenantId: context.tenantId,
      hostedRequestId: requestIdValue, amountMinor: body.amountMinor, idempotencyKey,
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId: correlation, operation: "deposit.applied" }) });
    return apiResponse(context.request, canonicalJson(jsonValue(result)), result.replayed ? 200 : 201,
      { "idempotency-replayed": String(result.replayed), "x-correlation-id": correlation });
  }

  async hostedDepositReadAuthority(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, PAYMENT_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Payment access is not granted");
    }
    const grants = await listGrantedProperties(context, PAYMENT_READ_SCOPE);
    if (!UUID.test(propertyNode) || !grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, { authorized: true });
  }

  async hostedDepositStatus(
    context: TenantRequestContext,
    propertyNode: string,
    requestIdValue: string,
  ): Promise<Response> {
    if (!hasScope(context, PAYMENT_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Payment access is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(requestIdValue)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Hosted deposit identity is invalid");
    }
    const grants = await listGrantedProperties(context, PAYMENT_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    if (!this.#hostedDeposits) return this.unavailable(context.request);
    const result = await this.#hostedDeposits.statusForOperator(context.tenantId, requestIdValue);
    if (result.propertyNode !== propertyNode) {
      return apiError(context.request, 404, "resource/not_found", "Not found", "Hosted deposit was not found");
    }
    return apiResponse(context.request, canonicalJson(jsonValue(result)));
  }

  async postFolioCharge(
    context: TenantRequestContext,
    propertyNode: string,
    folioId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, CHARGE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Folio charge posting is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(folioId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or folio identifier is invalid");
    }
    const grants = await listGrantedProperties(context, CHARGE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const input = parseCharge(context.request, body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Folio charge input is invalid");
    }
    if (!this.#charges) return this.unavailable(context.request);
    const requestId = correlationId(context.request);
    const result = await this.#charges.postCharge(context.tx, {
      tenantId: context.tenantId,
      folioId,
      txCode: input.txCode,
      amountMinor: input.amountMinor,
      ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
      idempotencyKey: input.idempotencyKey,
      envelope: createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: "journal.posted",
      }),
    });
    return apiResponse(context.request, canonicalJson(jsonValue(result)), 201, {
      "idempotency-replayed": String(result.replayed),
      "x-correlation-id": requestId,
    });
  }

  async correctFolioCharge(
    context: TenantRequestContext,
    propertyNode: string,
    folioId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, ADJUSTMENT_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Financial adjustment access is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(folioId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or folio identifier is invalid");
    }
    const grants = await listGrantedProperties(context, ADJUSTMENT_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const input = parseCorrection(context.request, body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Folio correction input is invalid");
    }
    if (!this.#chargeCorrections) return this.unavailable(context.request);
    const postSealAuthorized = hasScope(context, ADJUSTMENT_POST_SEAL_SCOPE) &&
      (await listGrantedProperties(context, ADJUSTMENT_POST_SEAL_SCOPE)).some(({ id }) => id === propertyNode);
    const requestId = correlationId(context.request);
    const result = await this.#chargeCorrections.reverseCharge(context.tx, {
      tenantId: context.tenantId,
      folioId,
      reversesJournalId: input.reversesJournalId,
      reason: input.reason,
      postSealAuthorized,
      idempotencyKey: input.idempotencyKey,
      envelope: createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: "journal.posted",
      }),
    });
    return apiResponse(context.request, canonicalJson(jsonValue(result)), 201, {
      "idempotency-replayed": String(result.replayed),
      "x-correlation-id": requestId,
    });
  }

  async search(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    if (!hasAvailabilityScope(context)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Availability access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const canonical = isCanonicalOfferSearch(body);
    const offerInput = canonical ? parseOfferSearch(body) : null;
    const legacyInput = canonical ? null : parseSearch(body);
    if ((canonical && !offerInput) || (!canonical && !legacyInput)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Availability search input is invalid");
    }

    try {
      const grants = await listGrantedProperties(context);
      if (!grants.some(({ id }) => id === propertyNode)) {
        return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
      }
      if (canonical) {
        if (!offerInput) {
          return apiError(context.request, 400, "request/invalid", "Invalid request", "Availability search input is invalid");
        }
        if (!this.#reservationOffers) return this.unavailable(context.request);
        const result = await this.#reservationOffers.search(context.tx, { propertyNode, ...offerInput });
        return apiResponse(context.request, reservationOfferHttpResult(result));
      }
      if (!legacyInput) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Availability search input is invalid");
      }
      const options = await this.#availability.search(context.tx, { propertyNode, ...legacyInput });
      return apiResponse(context.request, { options });
    } catch (error) {
      if (error instanceof InventoryValidationError || error instanceof ReservationOfferValidationError ||
          error instanceof ReservationOfferSearchTooBroadError) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Availability search input is invalid");
      }
      if (error instanceof RateEvaluationError &&
          error.message === "booking window must be 0 to 730 property-local days") {
        return apiError(
          context.request,
          400,
          "request/booking_window",
          "Stay dates unavailable",
          "Choose stay dates within the next 730 property-local days",
        );
      }
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Availability is temporarily unavailable");
    }
  }

  async inventory(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, CONFIGURATION_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#inventory) return this.unavailable(context.request);
    try {
      const grants = await listGrantedProperties(context, CONFIGURATION_READ_SCOPE);
      if (!grants.some(({ id }) => id === propertyNode)) {
        return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
      }
      const [unitTypes, spaces, sellableUnits] = await Promise.all([
        this.#inventory.listUnitTypes(context.tx, propertyNode),
        this.#inventory.listSpaces(context.tx, propertyNode),
        this.#inventory.listSellableUnits(context.tx, propertyNode),
      ]);
      return apiResponse(context.request, { unitTypes, spaces, sellableUnits });
    } catch (error) {
      if (error instanceof InventoryValidationError) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Inventory request is invalid");
      }
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Inventory is temporarily unavailable");
    }
  }

  async availabilityProjection(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, CONFIGURATION_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#projection) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, await this.#projection.status(context.tx, propertyNode));
  }

  async rebuildAvailabilityProjection(
    context: TenantRequestContext,
    propertyNode: string,
    body: unknown,
  ): Promise<Response> {
    const input = parseProjectionRebuild(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Projection range is invalid");
    if (!hasScope(context, CONFIGURATION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#projection) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.projection.rebuild",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => {
      await this.#projection!.replaceHorizon(tx, { propertyNode, ...input });
      return { status: 200, body: jsonValue(await this.#projection!.status(tx, propertyNode)) };
    });
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async createUnitType(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseUnitType(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Unit type input is invalid");
    return this.#create(context, propertyNode, body, "operator.inventory.unit_type.create", "unit_type.created",
      (tx, envelope) => this.#inventory!.createUnitType(tx, { ...input, envelope }));
  }

  async createSpace(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseSpace(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Space input is invalid");
    return this.#create(context, propertyNode, body, "operator.inventory.space.create", "space.created",
      (tx, envelope) => this.#inventory!.createSpace(tx, { ...input, envelope }));
  }

  async createSellableUnit(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseSellableUnit(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Sellable unit input is invalid");
    return this.#create(context, propertyNode, body, "operator.inventory.sellable_unit.create", "sellable_unit.created",
      (tx, envelope) => this.#inventory!.createSellableUnit(tx, { ...input, envelope }));
  }

  async createBulkRooms(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseBulkRooms(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Bulk room input is invalid");
    }
    if (!hasScope(context, CONFIGURATION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#inventory) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.rooms.bulk",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => {
      const unitType = await this.#inventory!.getUnitType(tx, propertyNode, input.unitTypeId);
      if (unitType.profileKey !== "hotel") {
        throw new InventoryValidationError("Bulk room creation requires a hotel room type");
      }
      const rooms = [];
      for (const room of input.rooms) {
        const space = await this.#inventory!.createSpace(tx, {
          code: room.code,
          profileKey: unitType.profileKey,
          capacity: 1,
          maxOccupancy: unitType.maxOccupancy,
          ...(room.floor === undefined ? {} : { floor: room.floor }),
          envelope: createAuditEnvelope({
            actorId: context.identity.actorId,
            tenantId: context.tenantId,
            propertyNode,
            requestId,
            operation: "space.created",
          }),
        });
        const sellableUnit = await this.#inventory!.createSellableUnit(tx, {
          unitTypeId: unitType.id,
          name: room.name ?? `Room ${room.code}`,
          spaces: [{ spaceId: space.id, claimMode: "exclusive" }],
          envelope: createAuditEnvelope({
            actorId: context.identity.actorId,
            tenantId: context.tenantId,
            propertyNode,
            requestId,
            operation: "sellable_unit.created",
          }),
        });
        rooms.push({ space, sellableUnit });
      }
      return { status: 201, body: { rooms: jsonValue(rooms) } };
    });
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async operationalBlocks(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, BLOCK_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Operational-block access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#blocks) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, BLOCK_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, { operationalBlocks: jsonValue(await this.#blocks.listActive(context.tx, propertyNode)) });
  }

  async openOperationalBlock(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseOperationalBlock(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Operational-block input is invalid");
    if (!hasScope(context, BLOCK_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Operational-block changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(input.spaceId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or space identifier is invalid");
    }
    if (!this.#blocks) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, BLOCK_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.blocks.open",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => ({ status: 201, body: { operationalBlock: jsonValue(await this.#blocks!.open(tx, {
      ...input, envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "ooo.opened" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async closeOperationalBlock(context: TenantRequestContext, propertyNode: string, blockId: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Operational-block close input must be empty");
    }
    if (!hasScope(context, BLOCK_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Operational-block changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(blockId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or block identifier is invalid");
    }
    if (!this.#blocks) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, BLOCK_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.blocks.close",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, blockId, body },
    }, async (tx) => ({ status: 200, body: { operationalBlock: jsonValue(await this.#blocks!.close(tx, {
      blockId, envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "ooo.closed" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async inventoryPolicy(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, POLICY_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory-policy access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#policy) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, POLICY_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, { inventoryPolicy: await this.#policy.get(context.tx, propertyNode) });
  }

  async activeHolds(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, HOLD_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Cart-hold access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, HOLD_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, { holds: jsonValue(await this.#holds.listActive(context.tx, propertyNode)) });
  }

  async placeHold(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseHold(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Cart-hold input is invalid");
    if (!hasScope(context, HOLD_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Cart-hold changes are not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, HOLD_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.holds.place",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => ({ status: 201, body: { hold: jsonValue(await this.#holds!.place(tx, {
      sellableUnitId: input.sellableUnitId, from: input.from, to: input.to, ttlSeconds: 600,
      holder: { reference: input.holderReference },
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "hold.created" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async commitReservation(context: TenantRequestContext, body: unknown): Promise<Response> {
    const input = parseReservationCommit(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Reservation commit input is invalid");
    }
    if (!hasScope(context, RESERVATION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation creation is not granted");
    }
    if (!this.#reservations) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === input.propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const common = {
      primaryPartyId: input.primaryPartyId,
      ratePlanId: input.ratePlanId,
      adults: input.adults,
      childAges: input.childAges,
      channelCode: input.channelCode,
      idempotencyKey: context.request.headers.get("idempotency-key") ?? "",
      envelope: createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode: input.propertyNode,
        requestId,
        operation: "reservation.confirmed",
      }),
    };
    const result = "holdId" in input
      ? await this.#reservations.commitHeld(context.tx, { ...common, holdId: input.holdId })
      : await this.#reservations.commitDirect(context.tx, { ...common, ...input.direct });
    const { replayed, ...reservation } = result;
    return apiResponse(context.request, canonicalJson({ reservation: jsonValue(reservation) }), 201, {
      "idempotency-replayed": String(replayed),
      "x-correlation-id": requestId,
    });
  }

  async partyProfiles(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const input = parsePartySearch(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Party search query is invalid");
    }
    if (!hasScope(context, PARTY_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Party profile access is not granted");
    }
    if (!this.#parties) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PARTY_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const profiles = await this.#parties.search(context.tx, {
      tenantId: context.tenantId,
      query: input.query,
      ...(input.limit === undefined ? {} : { limit: input.limit }),
    });
    return apiResponse(context.request, canonicalJson({ profiles: jsonValue(profiles) }));
  }

  async createPartyProfile(
    context: TenantRequestContext,
    propertyNode: string,
    body: unknown,
  ): Promise<Response> {
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const input = parsePartyCreate(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Party profile input is invalid");
    }
    if (!hasScope(context, PARTY_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Party profile creation is not granted");
    }
    if (!this.#parties) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PARTY_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#parties.create(context.tx, {
      ...input,
      idempotencyKey: context.request.headers.get("idempotency-key") ?? "",
      envelope: createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: "party.created",
      }),
    });
    return apiResponse(context.request, canonicalJson({ party: jsonValue(outcome.party) }), 201, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async reservationGuests(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const confirmationNo = confirmationQuery(context.request);
    if (!confirmationNo) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Confirmation query is invalid");
    }
    if (!hasScope(context, RESERVATION_GUEST_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation guest access is not granted");
    }
    if (!this.#reservationGuests) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_GUEST_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const reservation = await this.#reservationGuests.findByConfirmation(context.tx, {
      tenantId: context.tenantId,
      propertyNode,
      confirmationNo,
    });
    return apiResponse(context.request, canonicalJson({ reservation: jsonValue(reservation) }));
  }

  async replaceReservationGuests(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
    body: unknown,
  ): Promise<Response> {
    if (!UUID.test(propertyNode) || !UUID.test(reservationId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or reservation identifier is invalid");
    }
    const input = parseReservationGuests(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Reservation guest input is invalid");
    }
    if (!hasScope(context, RESERVATION_GUEST_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation guest changes are not granted");
    }
    if (!this.#reservationGuests) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_GUEST_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const result = await this.#reservationGuests.replace(context.tx, {
      reservationId,
      primarySharePct: input.primarySharePct,
      guests: input.guests,
      idempotencyKey: context.request.headers.get("idempotency-key") ?? "",
      envelope: createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: "reservation.modified",
      }),
    });
    const { replayed, ...reservation } = result;
    return apiResponse(context.request, canonicalJson({ reservation: jsonValue(reservation) }), 200, {
      "idempotency-replayed": String(replayed),
      "x-correlation-id": requestId,
    });
  }

  async reservationBoard(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const query = reservationBoardQuery(context.request);
    if (!query) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Reservation board query is invalid");
    }
    if (!hasScope(context, RESERVATION_LIFECYCLE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation access is not granted");
    }
    if (!this.#reservationBoard) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_LIFECYCLE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const page = await this.#reservationBoard.list(context.tx, {
      tenantId: context.tenantId,
      propertyNode,
      ...query,
    });
    return apiResponse(context.request, canonicalJson(jsonValue(page)));
  }

  async reservationDetail(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
  ): Promise<Response> {
    if (!UUID.test(propertyNode) || !UUID.test(reservationId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or reservation identifier is invalid");
    }
    const query = new URL(context.request.url).searchParams;
    if ([...query.keys()].length > 0) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Reservation detail query must be empty");
    }
    if (!hasScope(context, RESERVATION_LIFECYCLE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation access is not granted");
    }
    if (!this.#reservationDetail) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_LIFECYCLE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 404, "reservations/not_found", "Not found", "Referenced reservation input was not found");
    }
    const reservation = await this.#reservationDetail.findById(context.tx, {
      tenantId: context.tenantId,
      propertyNode,
      reservationId,
    });
    const hasFolioOpenScope = hasScope(context, FOLIO_OPEN_SCOPE);
    const folioOpenGrants = hasFolioOpenScope
      ? await listGrantedProperties(context, FOLIO_OPEN_SCOPE)
      : [];
    const canOpenPrimaryFolio = hasFolioOpenScope &&
      folioOpenGrants.some(({ id }) => id === propertyNode) &&
      reservation.folios.length === 0 &&
      (reservation.status === "reserved" || reservation.status === "due_in" ||
        reservation.status === "in_house" || reservation.status === "due_out");
    const actions = Object.freeze({
      canModify: reservation.status === "reserved" || reservation.status === "due_in" ||
        reservation.status === "in_house" || reservation.status === "due_out",
      canCancel: reservation.status === "reserved" || reservation.status === "due_in",
      canReinstate: reservation.status === "cancelled" || reservation.status === "no_show",
      canOpenPrimaryFolio,
    });
    return apiResponse(context.request, canonicalJson({ reservation: jsonValue(reservation), actions }));
  }

  async reservationLifecycle(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const confirmationNo = confirmationQuery(context.request);
    if (!confirmationNo) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Confirmation query is invalid");
    }
    if (!hasScope(context, RESERVATION_LIFECYCLE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation lifecycle access is not granted");
    }
    if (!this.#reservationLifecycle) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_LIFECYCLE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const reservation = await this.#reservationLifecycle.findByConfirmation(context.tx, {
      tenantId: context.tenantId,
      propertyNode,
      confirmationNo,
    });
    return apiResponse(context.request, canonicalJson({ reservation: jsonValue(reservation) }));
  }

  async modifyReservation(context: TenantRequestContext, propertyNode: string, reservationId: string, body: unknown): Promise<Response> {
    const input = parseReservationMutation(body);
    return this.runReservationLifecycleMutation(context, propertyNode, reservationId, input, "reservation.modified", async (service, envelope) =>
      service.modify(context.tx, {
        reservationId, expected: input!.expected, changes: input!.changes,
        idempotencyKey: context.request.headers.get("idempotency-key") ?? "", envelope,
      })
    );
  }

  async reservationSegments(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    const confirmationNo = confirmationQuery(context.request);
    if (!confirmationNo) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Confirmation query is invalid");
    }
    if (!hasScope(context, RESERVATION_SEGMENT_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation segment access is not granted");
    }
    if (!this.#reservationSegments) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_SEGMENT_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const reservation = await this.#reservationSegments.findByConfirmation(context.tx, {
      tenantId: context.tenantId,
      propertyNode,
      confirmationNo,
    });
    return apiResponse(context.request, canonicalJson({ reservation: jsonValue(reservation) }));
  }

  async changeReservationDeparture(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
    segmentId: string,
    body: unknown,
  ): Promise<Response> {
    const input = parseSegmentDeparture(body);
    return this.runReservationSegmentMutation(
      context, propertyNode, reservationId, segmentId, input, "reservation.modified",
      (service, envelope) => service.changeDeparture(context.tx, {
        reservationId,
        segmentId,
        expectedPeriod: input!.expectedPeriod,
        newDeparture: input!.newDeparture,
        idempotencyKey: context.request.headers.get("idempotency-key") ?? "",
        envelope,
      }),
    );
  }

  async moveReservationRoom(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
    segmentId: string,
    body: unknown,
  ): Promise<Response> {
    const input = parseSegmentMove(body);
    return this.runReservationSegmentMutation(
      context, propertyNode, reservationId, segmentId, input, "segment.moved",
      (service, envelope) => service.moveRoom(context.tx, {
        reservationId,
        segmentId,
        expectedSellableUnitId: input!.expectedSellableUnitId,
        expectedPeriod: input!.expectedPeriod,
        destinationSellableUnitId: input!.destinationSellableUnitId,
        idempotencyKey: context.request.headers.get("idempotency-key") ?? "",
        envelope,
      }),
    );
  }

  private async runReservationSegmentMutation(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
    segmentId: string,
    input: object | null,
    operation: "reservation.modified" | "segment.moved",
    execute: (service: ReservationSegmentOperations, envelope: ReturnType<typeof createAuditEnvelope>) => Promise<unknown>,
  ): Promise<Response> {
    if (!UUID.test(propertyNode) || !UUID.test(reservationId) || !UUID.test(segmentId) || !input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Reservation segment input is invalid");
    }
    if (!hasScope(context, RESERVATION_SEGMENT_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation segment changes are not granted");
    }
    if (!this.#reservationSegments) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_SEGMENT_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const result = await execute(this.#reservationSegments, createAuditEnvelope({
      actorId: context.identity.actorId,
      tenantId: context.tenantId,
      propertyNode,
      requestId,
      operation,
    })) as Record<string, unknown>;
    const { replayed, ...segment } = result;
    return apiResponse(context.request, canonicalJson({ segment: jsonValue(segment) }), 200, {
      "idempotency-replayed": String(replayed),
      "x-correlation-id": requestId,
    });
  }

  async cancelReservation(context: TenantRequestContext, propertyNode: string, reservationId: string, body: unknown): Promise<Response> {
    const input = parseReservationCancellation(body);
    return this.runReservationLifecycleMutation(context, propertyNode, reservationId, input, "reservation.cancelled", async (service, envelope) =>
      service.cancel(context.tx, {
        reservationId, reason: input!.reason, ...(input!.approvalId === undefined ? {} : { approvalId: input!.approvalId }),
        idempotencyKey: context.request.headers.get("idempotency-key") ?? "", envelope,
      })
    );
  }

  async reinstateReservation(context: TenantRequestContext, propertyNode: string, reservationId: string, body: unknown): Promise<Response> {
    const input = isObject(body) && exactKeys(body, []) ? Object.freeze({}) : null;
    return this.runReservationLifecycleMutation(context, propertyNode, reservationId, input, "reservation.reinstated", async (service, envelope) =>
      service.reinstate(context.tx, {
        reservationId, idempotencyKey: context.request.headers.get("idempotency-key") ?? "", envelope,
      })
    );
  }

  private async runReservationLifecycleMutation(
    context: TenantRequestContext,
    propertyNode: string,
    reservationId: string,
    input: object | null,
    operation: "reservation.modified" | "reservation.cancelled" | "reservation.reinstated",
    execute: (service: ReservationLifecycleOperations, envelope: ReturnType<typeof createAuditEnvelope>) => Promise<unknown>,
  ): Promise<Response> {
    if (!UUID.test(propertyNode) || !UUID.test(reservationId) || !input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Reservation lifecycle input is invalid");
    }
    if (!hasScope(context, RESERVATION_LIFECYCLE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Reservation lifecycle changes are not granted");
    }
    if (!this.#reservationLifecycle) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESERVATION_LIFECYCLE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const result = await execute(this.#reservationLifecycle, createAuditEnvelope({
      actorId: context.identity.actorId, tenantId: context.tenantId, propertyNode, requestId, operation,
    })) as Record<string, unknown>;
    const { replayed, ...reservation } = result;
    return apiResponse(context.request, canonicalJson({ reservation: jsonValue(reservation) }), 200, {
      "idempotency-replayed": String(replayed), "x-correlation-id": requestId,
    });
  }

  async releaseHold(context: TenantRequestContext, propertyNode: string, holdId: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Cart-hold release input must be empty");
    }
    if (!hasScope(context, HOLD_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Cart-hold changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(holdId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or hold identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, HOLD_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.holds.release",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, holdId, body },
    }, async (tx) => ({ status: 200, body: { hold: jsonValue(await this.#holds!.release(tx, {
      holdId, envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "hold.released" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async activeOfflineLeases(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, OFFLINE_LEASE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Offline-capacity access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, OFFLINE_LEASE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    return apiResponse(context.request, {
      offlineLeases: jsonValue(await this.#holds.listActiveOfflineLeases(context.tx, propertyNode)),
    });
  }

  async placeOfflineLease(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseOfflineLease(body);
    if (!input) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Offline-capacity input is invalid");
    }
    if (!hasScope(context, OFFLINE_LEASE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Offline-capacity changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, OFFLINE_LEASE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.offline_leases.place",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => {
      const options = await this.#availability.search(tx, {
        propertyNode,
        from: input.from,
        to: input.to,
        partySize: 1,
      });
      const exact = options.find(({ sellableUnitId }) => sellableUnitId === input.sellableUnitId);
      if (!exact?.bookable) {
        throw new HoldConflictError("Requested offline capacity is not currently bookable");
      }
      return {
        status: 201,
        body: { offlineLease: jsonValue(await this.#holds!.placeOfflineLease(tx, {
        sellableUnitId: input.sellableUnitId,
        from: input.from,
        to: input.to,
        ttlSeconds: input.leaseHours * 3_600,
        deviceId: input.deviceId,
        ...(input.deviceLabel === undefined ? {} : { deviceLabel: input.deviceLabel }),
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode,
          requestId,
          operation: "hold.created",
        }),
        })) },
      };
    });
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async releaseOfflineLease(
    context: TenantRequestContext,
    propertyNode: string,
    leaseId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Offline-capacity release input must be empty");
    }
    if (!hasScope(context, OFFLINE_LEASE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Offline-capacity changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(leaseId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or lease identifier is invalid");
    }
    if (!this.#holds) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, OFFLINE_LEASE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.offline_leases.release",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, leaseId, body },
    }, async (tx) => ({
      status: 200,
      body: { offlineLease: jsonValue(await this.#holds!.releaseOfflineLease(tx, {
        holdId: leaseId,
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode,
          requestId,
          operation: "hold.released",
        }),
      })) },
    }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async setOosSellability(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["oosSellability"]) ||
        (body.oosSellability !== "blocked" && body.oosSellability !== "allowed")) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "OOS sellability input is invalid");
    }
    if (!hasScope(context, POLICY_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory-policy changes are not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#policy) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, POLICY_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.inventory.policy.oos_sellability",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => ({ status: 200, body: { inventoryPolicy: jsonValue(await this.#policy!.setOosSellability(tx, {
      value: body.oosSellability as "blocked" | "allowed",
      envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
        propertyNode, requestId, operation: "inventory.policy.changed" }),
    })) } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async restrictions(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, RESTRICTION_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Restriction access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#restrictions) return this.unavailable(context.request);
    try {
      const grants = await listGrantedProperties(context, RESTRICTION_READ_SCOPE);
      if (!grants.some(({ id }) => id === propertyNode)) {
        return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
      }
      return apiResponse(context.request, { restrictions: await this.#restrictions.list(context.tx, propertyNode) });
    } catch (error) {
      if (error instanceof InventoryValidationError) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Restriction request is invalid");
      }
      return apiError(context.request, 503, "service/unavailable", "Service unavailable", "Restrictions are temporarily unavailable");
    }
  }

  async createRestrictions(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const restrictions = parseRestrictionBatch(body);
    if (!restrictions) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Restriction input is invalid");
    }
    if (!hasScope(context, RESTRICTION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Restriction changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#restrictions) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RESTRICTION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.inventory.restriction.create",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => ({
      status: 201,
      body: { restrictions: jsonValue(await this.#restrictions!.createBatch(tx, {
        restrictions,
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode,
          requestId,
          operation: "restriction.created",
        }),
      })) },
    }));
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async rateConfiguration(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, RATE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration access is not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#rates) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const [policies, ratePlans] = await Promise.all([
      this.#rates.listPolicies(context.tx),
      this.#rates.listRatePlans(context.tx, propertyNode),
    ]);
    return apiResponse(context.request, { policies, ratePlans });
  }

  async createPolicy(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parsePolicy(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Policy input is invalid");
    return this.#createRate(context, propertyNode, body, "operator.rates.policy.create", "policy.created",
      async (tx, envelope) => ({ policy: jsonValue(await this.#rates!.createPolicy(tx, { ...input, envelope })) }));
  }

  async createRatePlan(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parseRatePlan(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate plan input is invalid");
    return this.#createRate(context, propertyNode, body, "operator.rates.rate_plan.create", "rate_plan.created",
      async (tx, envelope) => ({ ratePlan: jsonValue(await this.#rates!.createRatePlan(tx, { ...input, envelope })) }));
  }

  async rateBuilder(context: TenantRequestContext, propertyNode: string, ratePlanId: string): Promise<Response> {
    if (!hasScope(context, RATE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration access is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePlanId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or rate-plan identifier is invalid");
    }
    if (!this.#rateBuilder) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const [modelDrafts, targetDrafts, releases] = await Promise.all([
      this.#rateBuilder.models.listDraftVersions(context.tx, propertyNode, ratePlanId),
      this.#rateBuilder.targets.listDraftVersions(context.tx, propertyNode, ratePlanId),
      this.#rateBuilder.publication.listReleaseVersions(context.tx, propertyNode, ratePlanId),
    ]);
    return apiResponse(context.request, rateBuilderJsonValue({
      catalogue: RATE_MODEL_CATALOGUE,
      modelDrafts,
      targetDrafts,
      releases: releasesWithAuthoringCommands(releases, modelDrafts, targetDrafts),
    }));
  }

  async createRateBuilderDraft(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, RATE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePlanId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or rate-plan identifier is invalid");
    }
    if (!this.#rateBuilder) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const command = compileRateAuthoringCommand(body);
    if (command.ratePlanId !== ratePlanId) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate-plan route and command do not match");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.rates.release.draft",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, ratePlanId, body },
    }, async (tx) => {
      const modelDraft = await this.#rateBuilder!.models.createDraftVersion(tx, {
        ratePlanId: command.ratePlanId,
        modelKey: command.model.key,
        modelVersion: command.model.version,
        authoringMode: command.authoringMode,
        componentModelKeys: command.model.componentModelKeys,
        envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_plan_model.drafted" }),
      });
      const targetDraft = await this.#rateBuilder!.targets.createDraftVersion(tx, {
        ratePlanId: command.ratePlanId,
        authoringMode: command.authoringMode,
        rules: command.target.rules,
        envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_plan_target.drafted" }),
      });
      const release = await this.#rateBuilder!.publication.createDraftVersion(tx, {
        ratePlanId: command.ratePlanId,
        modelDraftVersion: modelDraft.extensionVersion,
        targetDraftVersion: targetDraft.extensionVersion,
        evaluatorSpec: command.evaluator,
        compositionSpec: command.composition,
        rmsBinding: command.rmsBinding,
        envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_plan_release.drafted" }),
      });
      return { status: 201, body: rateBuilderJsonValue({ modelDraft, targetDraft, release }) };
    });
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async interpretRateBuilderIntent(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    body: unknown,
  ): Promise<Response> {
    if (!hasScope(context, RATE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration access is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePlanId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or rate-plan identifier is invalid");
    }
    if (!isObject(body) || !exactKeys(body, ["intent", "currentCommand"]) || typeof body.intent !== "string") {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate intent input is invalid");
    }
    if (!this.#rateBuilder?.intent) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    let current;
    try {
      current = compileRateAuthoringCommand(body.currentCommand);
    } catch {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate intent input is invalid");
    }
    if (current.ratePlanId !== ratePlanId) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate-plan route and command do not match");
    }
    try {
      await this.#rateBuilder.models.listDraftVersions(context.tx, propertyNode, ratePlanId);
      const interpretation = await this.#rateBuilder.intent.interpret({
        intent: body.intent,
        currentCommand: body.currentCommand,
      });
      return apiResponse(context.request, rateBuilderJsonValue({ interpretation }));
    } catch (error) {
      if (error instanceof RateIntentError || error instanceof RateAuthoringError) {
        return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate intent input is invalid");
      }
      throw error;
    }
  }

  async resolveRateBuilderQuote(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [
      "sellableUnitId", "stayStart", "stayEnd", "guests", "selectedPromotionCodes", "commercial", "channelCode",
    ]) || typeof body.sellableUnitId !== "string" || !UUID.test(body.sellableUnitId) ||
      !isObject(body.guests) || !exactKeys(body.guests, ["adults", "childAges"]) ||
      typeof body.guests.adults !== "number" || !Array.isArray(body.guests.childAges) ||
      !Array.isArray(body.selectedPromotionCodes) || !isObject(body.commercial) ||
      typeof body.channelCode !== "string") {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate quote input is invalid");
    }
    const stayStart = parseInstant(body.stayStart);
    const stayEnd = parseInstant(body.stayEnd);
    if (!stayStart || !stayEnd || stayStart >= stayEnd || !UUID.test(propertyNode) || !UUID.test(ratePlanId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate quote scope or stay is invalid");
    }
    if (!hasScope(context, RATE_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration access is not granted");
    }
    if (!this.#rateBuilder) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const quote = await this.#rateBuilder.quote.resolve(context.tx, {
      propertyNode,
      ratePlanId,
      sellableUnitId: body.sellableUnitId,
      stayStart,
      stayEnd,
      guests: { adults: body.guests.adults, childAges: body.guests.childAges as number[] },
      selectedPromotionCodes: body.selectedPromotionCodes as string[],
      commercial: body.commercial,
      channelCode: body.channelCode,
    });
    return apiResponse(context.request, rateBuilderJsonValue({ quote }));
  }

  async simulateRateBuilderDraft(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    releaseId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["previewCells"]) || !Array.isArray(body.previewCells)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate preview input is invalid");
    }
    const authorized = await this.#requireRateBuilder(context, propertyNode, ratePlanId, releaseId, RATE_READ_SCOPE);
    if (authorized instanceof Response) return authorized;
    const previewCells = bindRateBuilderPreviewCells(authorized.release, body.previewCells);
    if (!previewCells) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate preview cells are invalid or contain caller policy evidence");
    }
    const simulation = await this.#rateBuilder!.publication.simulateDraft(context.tx, {
      releaseId,
      previewCells,
    });
    return apiResponse(context.request, rateBuilderJsonValue({ simulation }));
  }

  async requestRateBuilderApproval(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    releaseId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["previewCells"]) || !Array.isArray(body.previewCells)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate approval input is invalid");
    }
    const authorized = await this.#requireRateBuilder(context, propertyNode, ratePlanId, releaseId, RATE_WRITE_SCOPE);
    if (authorized instanceof Response) return authorized;
    const previewCells = bindRateBuilderPreviewCells(authorized.release, body.previewCells);
    if (!previewCells) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate approval cells are invalid or contain caller policy evidence");
    }
    return this.#runRateBuilderWrite(context, authorized.actorId, propertyNode, { ratePlanId, releaseId, body }, "operator.rates.release.approval_request", async (tx, requestId) =>
      this.#rateBuilder!.publication.requestPublicationApproval(tx, {
        releaseId,
        previewCells,
        requestedBy: authorized.actorId,
        envelope: createAuditEnvelope({ actorId: authorized.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_plan_release.approval_requested" }),
      })
    );
  }

  async rateBuilderApprovals(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
  ): Promise<Response> {
    if (!hasScope(context, RATE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePlanId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or rate-plan identifier is invalid");
    }
    const pageInput = parseRateApprovalPage(context.request);
    if (!pageInput) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Approval page query is invalid");
    }
    if (!this.#rateBuilder) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const page = await this.#rateBuilder.publication.listPublicationApprovals(context.tx, {
      propertyNode,
      ratePlanId,
      ...pageInput,
    });
    return apiResponse(context.request, {
      approvals: page.approvals.map((approval) => rateApprovalJson(approval, context.identity.actorId)),
      nextCursor: page.nextCursor,
    });
  }

  async decideRateBuilderApproval(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    approvalId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["decision"]) ||
        (body.decision !== "approved" && body.decision !== "rejected")) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Approval decision input is invalid");
    }
    if (!hasScope(context, RATE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePlanId) || !UUID.test(approvalId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property, rate-plan or approval identifier is invalid");
    }
    if (!this.#rateBuilder) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const actorId = context.identity.actorId;
    return this.#runRateBuilderWrite(
      context,
      actorId,
      propertyNode,
      { ratePlanId, approvalId, body },
      "operator.rates.release.approval_decision",
      async (tx, requestId) => ({ approval: rateApprovalJson(
        await this.#rateBuilder!.publication.decidePublicationApproval(tx, {
          propertyNode,
          ratePlanId,
          approvalId,
          decision: body.decision as "approved" | "rejected",
          decidedBy: actorId,
          envelope: createAuditEnvelope({ actorId, tenantId: context.tenantId,
            propertyNode, requestId, operation: "rate_plan_release.approval_decided" }),
        }),
        actorId,
      ) }),
      200,
    );
  }

  async publishRateBuilderDraft(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    releaseId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["approvalId", "previewCells"]) ||
        typeof body.approvalId !== "string" || !UUID.test(body.approvalId) || !Array.isArray(body.previewCells)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate publication input is invalid");
    }
    const authorized = await this.#requireRateBuilder(context, propertyNode, ratePlanId, releaseId, RATE_WRITE_SCOPE);
    if (authorized instanceof Response) return authorized;
    const previewCells = bindRateBuilderPreviewCells(authorized.release, body.previewCells);
    if (!previewCells) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate publication cells are invalid or contain caller policy evidence");
    }
    return this.#runRateBuilderWrite(context, authorized.actorId, propertyNode, { ratePlanId, releaseId, body }, "operator.rates.release.publish", async (tx, requestId) =>
      this.#rateBuilder!.publication.publishDraft(tx, {
        releaseId,
        approvalId: body.approvalId as string,
        previewCells,
        envelope: createAuditEnvelope({ actorId: authorized.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_plan_release.published" }),
      })
    );
  }

  async createRateBuilderUndo(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    sourceReleaseId: string,
    body: unknown,
  ): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, [])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate undo input must be empty");
    }
    const authorized = await this.#requireRateBuilder(context, propertyNode, ratePlanId, sourceReleaseId, RATE_WRITE_SCOPE);
    if (authorized instanceof Response) return authorized;
    return this.#runRateBuilderWrite(context, authorized.actorId, propertyNode, { ratePlanId, sourceReleaseId, body }, "operator.rates.release.undo", async (tx, requestId) =>
      this.#rateBuilder!.publication.createUndoDraftVersion(tx, {
        sourceReleaseId,
        envelope: createAuditEnvelope({ actorId: authorized.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_plan_release.undo_drafted" }),
      })
    );
  }

  async #requireRateBuilder(
    context: TenantRequestContext,
    propertyNode: string,
    ratePlanId: string,
    releaseId: string,
    scope: typeof RATE_READ_SCOPE | typeof RATE_WRITE_SCOPE,
  ): Promise<Readonly<{ actorId: string; release: RatePlanRelease }> | Response> {
    if (!hasScope(context, scope)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration access is not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePlanId) || !UUID.test(releaseId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property, rate-plan or release identifier is invalid");
    }
    if (!this.#rateBuilder) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, scope);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const releases = await this.#rateBuilder.publication.listReleaseVersions(context.tx, propertyNode, ratePlanId);
    const release = releases.find(({ id }) => id === releaseId);
    if (!release) {
      return apiError(context.request, 404, "rates/not_found", "Not found", "Referenced rate release was not found");
    }
    return Object.freeze({ actorId: context.identity.actorId, release });
  }

  async #runRateBuilderWrite(
    context: TenantRequestContext,
    actorId: string,
    propertyNode: string,
    requestBody: unknown,
    operation: string,
    command: (tx: Tx, requestId: string, actorId: string) => Promise<unknown>,
    successStatus = 201,
  ): Promise<Response> {
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation,
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body: requestBody },
    }, async (tx) => ({ status: successStatus, body: rateBuilderJsonValue(await command(tx, requestId, actorId)) }));
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async currentRatePrice(context: TenantRequestContext, propertyNode: string): Promise<Response> {
    if (!hasScope(context, PRICING_READ_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate pricing access is not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#pricing) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PRICING_READ_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const query = new URL(context.request.url).searchParams;
    const price = await this.#pricing.findCurrent(context.tx, {
      propertyNode,
      ratePlanId: query.get("ratePlanId") ?? "",
      unitTypeId: query.get("unitTypeId") ?? "",
      stayDate: query.get("stayDate") ?? "",
    });
    return apiResponse(context.request, { ratePrice: ratePriceJson(price) });
  }

  async createRatePrice(context: TenantRequestContext, propertyNode: string, body: unknown): Promise<Response> {
    const input = parsePricing(body);
    if (!input) return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate pricing input is invalid");
    if (!hasScope(context, PRICING_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate pricing changes are not granted");
    }
    if (!UUID.test(propertyNode)) return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    if (!this.#pricing) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PRICING_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: "operator.rates.price.create",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body },
    }, async (tx) => ({
      status: 201,
      body: { ratePrice: ratePriceJson(await this.#pricing!.create(tx, {
        ...input,
        envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_price.created" }),
      })) },
    }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async supersedeRatePrice(context: TenantRequestContext, propertyNode: string, ratePriceId: string, body: unknown): Promise<Response> {
    if (!isObject(body) || !exactKeys(body, ["pricing"])) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate correction input is invalid");
    }
    const correctedPricing = parsePricingValue(body.pricing);
    if (!correctedPricing) return apiError(context.request, 400, "request/invalid", "Invalid request", "Rate correction input is invalid");
    if (!hasScope(context, PRICING_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate pricing changes are not granted");
    }
    if (!UUID.test(propertyNode) || !UUID.test(ratePriceId)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property or rate-price identifier is invalid");
    }
    if (!this.#pricing) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, PRICING_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId, operation: "operator.rates.price.supersede",
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, ratePriceId, body },
    }, async (tx) => ({ status: 201, body: {
      ratePrice: ratePriceJson(await this.#pricing!.supersede(tx, {
        ratePriceId, pricing: correctedPricing,
        envelope: createAuditEnvelope({ actorId: context.identity.actorId, tenantId: context.tenantId,
          propertyNode, requestId, operation: "rate_price.superseded" }),
      })),
    } }));
    return apiResponse(context.request, canonicalJson(outcome.body), outcome.status, {
      "idempotency-replayed": String(outcome.replayed), "x-correlation-id": requestId,
    });
  }

  async #createRate(
    context: TenantRequestContext,
    propertyNode: string,
    requestBody: unknown,
    idempotencyOperation: string,
    auditOperation: "policy.created" | "rate_plan.created",
    command: (tx: Tx, envelope: ReturnType<typeof createAuditEnvelope>) => Promise<JsonValue>,
  ): Promise<Response> {
    if (!hasScope(context, RATE_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Rate configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#rates) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, RATE_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: idempotencyOperation,
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body: requestBody },
    }, async (tx) => ({
      status: 201,
      body: await command(tx, createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: auditOperation,
      })),
    }));
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }

  async #create(
    context: TenantRequestContext,
    propertyNode: string,
    requestBody: unknown,
    idempotencyOperation: string,
    auditOperation: string,
    command: (tx: Tx, envelope: ReturnType<typeof createAuditEnvelope>) => Promise<unknown>,
  ): Promise<Response> {
    if (!hasScope(context, CONFIGURATION_WRITE_SCOPE)) {
      return apiError(context.request, 403, "auth/scope_missing", "Forbidden", "Inventory configuration changes are not granted");
    }
    if (!UUID.test(propertyNode)) {
      return apiError(context.request, 400, "request/invalid", "Invalid request", "Property identifier is invalid");
    }
    if (!this.#inventory) return this.unavailable(context.request);
    const grants = await listGrantedProperties(context, CONFIGURATION_WRITE_SCOPE);
    if (!grants.some(({ id }) => id === propertyNode)) {
      return apiError(context.request, 403, "auth/property_forbidden", "Forbidden", "Property access is not granted");
    }
    const requestId = correlationId(context.request);
    const outcome = await this.#idempotency.execute(context.tx, {
      tenantId: context.tenantId,
      operation: idempotencyOperation,
      key: context.request.headers.get("idempotency-key") ?? "",
      request: { actorId: context.identity.actorId, propertyNode, body: requestBody },
    }, async (tx) => ({
      status: 201,
      body: jsonValue(await command(tx, createAuditEnvelope({
        actorId: context.identity.actorId,
        tenantId: context.tenantId,
        propertyNode,
        requestId,
        operation: auditOperation,
      }))),
    }));
    return apiResponse(context.request, outcome.body, outcome.status, {
      "idempotency-replayed": String(outcome.replayed),
      "x-correlation-id": requestId,
    });
  }
}

const ASSET_URLS = {
  html: new URL("./operator/index.html", import.meta.url),
  css: new URL("./operator/operator.css", import.meta.url),
  js: new URL("./operator/operator.js", import.meta.url),
  depositCss: new URL("./operator/operator-deposits.css", import.meta.url),
  depositJs: new URL("./operator/operator-deposits.js", import.meta.url),
} as const;

export interface OperatorLocalReviewCredentials {
  readonly tenant: string;
  readonly email: string;
  readonly password: string;
}

function assetResponse(url: URL, contentType: string): Response {
  return new Response(Bun.file(url), {
    headers: { "cache-control": "no-cache", "content-type": contentType },
  });
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function localReviewHtml(credentials: OperatorLocalReviewCredentials): Response {
  let html = readFileSync(fileURLToPath(ASSET_URLS.html), "utf8");
  const fields = [
    ['<input name="tenant" autocomplete="organization" required maxlength="63" placeholder="yellow-demo">', credentials.tenant],
    ['<input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="operator@yellow.local">', credentials.email],
    ['<input name="password" type="password" autocomplete="current-password" required maxlength="1024">', credentials.password],
  ] as const;
  for (const [input, value] of fields) {
    if (html.split(input).length !== 2) throw new Error("operator sign-in field contract changed");
    html = html.replace(input, `${input.slice(0, -1)} value="${escapeHtmlAttribute(value)}">`);
  }
  return new Response(html, {
    headers: { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" },
  });
}

export const operatorAssets = Object.freeze({
  html(credentials?: OperatorLocalReviewCredentials): Response {
    return credentials ? localReviewHtml(credentials) : assetResponse(ASSET_URLS.html, "text/html; charset=utf-8");
  },
  css(): Response { return assetResponse(ASSET_URLS.css, "text/css; charset=utf-8"); },
  js(): Response { return assetResponse(ASSET_URLS.js, "text/javascript; charset=utf-8"); },
  depositCss(): Response { return assetResponse(ASSET_URLS.depositCss, "text/css; charset=utf-8"); },
  depositJs(): Response { return assetResponse(ASSET_URLS.depositJs, "text/javascript; charset=utf-8"); },
});
