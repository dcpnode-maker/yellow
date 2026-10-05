import { collectReservationBoardPages } from "./reservation-board";
import type {
  VoiceLanguage,
  ReservationQueryContext,
  OperationalLane,
  OperationalStateIntent,
  WorkspaceIntent,
  KpiIntent,
  FolioBillWindowTransferIntent,
} from "./voice";
import type { MovementQuery } from "./today-workspace";

const SHOWCASE_PROPERTIES = new Set(["6081b544-22a1-534f-a86d-bb1ae0519e14", "01e4e102-c54f-5205-9542-d84d103084f8"]);
let propertyId = "";
export function configureYellowApi(nextPropertyId: string): void { propertyId = nextPropertyId; }

function browserLanguageSuggestion(): VoiceLanguage | null {
  const languages = typeof navigator === "undefined" ? [] : navigator.languages ?? [];
  const match = languages.find((language) => /^(hi|mr|kn|te)(-|$)/i.test(language));
  if (!match) return null;
  if (/^hi/i.test(match)) return "Hindi";
  if (/^mr/i.test(match)) return "Marathi";
  if (/^kn/i.test(match)) return "Kannada";
  return "Telugu";
}


const statuses = ["due_in", "due_out", "in_house"] as const;
type Status = (typeof statuses)[number];
const pageSearch = new URLSearchParams(window.location.search);
const focusedLane = statuses.find((status) => status === pageSearch.get("lane"));
const requestedGuestSearch = pageSearch
  .get("guest")
  ?.trim();
const requestedFinanceReservation = pageSearch.get("reservation")?.trim() ?? null;
const initialGuestSearch =
  requestedGuestSearch && requestedGuestSearch.length >= 2
    ? requestedGuestSearch
    : "";
type Stay = Readonly<{
  reservationId: string;
  primaryPartyId?: string;
  confirmationNo: string;
  primaryGuestDisplayName?: string;
  primaryPartyName?: string;
  status: string;
  operationalState?: string;
  stayFrom?: string;
  stayTo?: string;
  sellableUnitLabel?: string;
  unitTypeLabel?: string;
  ratePlanLabel?: string;
  channelCode?: string;
  sourceCode?: string;
  marketCode?: string;
  adults?: number;
  children?: number;
  arrivalTravel?: Readonly<{ scheduledAt?: string | null; mode?: string | null; carrier?: string | null; serviceNo?: string | null; pickupRequested?: boolean }> | null;
  departureTravel?: Readonly<{ scheduledAt?: string | null; mode?: string | null; carrier?: string | null; serviceNo?: string | null; pickupRequested?: boolean }> | null;
}>;
const nameOf = (stay: Stay): string => stay.primaryGuestDisplayName ?? stay.primaryPartyName ?? stay.confirmationNo;
type Lane = Readonly<{ reservations?: readonly Stay[] }>;
type Property = Readonly<{ id: string; name: string; timezone: string }>;
type GroupBlockAllotmentRow = Readonly<{
  unitTypeId: string;
  unitTypeCode: string;
  unitTypeName: string;
  stayDate: string;
  blocked: number;
  pickedUp: number;
  remaining: number;
  rateOverride: unknown | null;
}>;
type GroupBlockRoomingListRow = Readonly<{
  reservationId: string;
  confirmationNo: string;
  primaryGuestDisplayName: string;
  status: string;
  unitTypeCode: string | null;
  unitTypeName: string | null;
  stayFrom: string;
  stayTo: string;
  pickedUpNights: number;
}>;
type GroupBlockSummary = Readonly<{
  groupId: string;
  code: string;
  name: string | null;
  status: string;
  statusDeductsInventory: boolean;
  accountPartyId: string | null;
  accountPartyName: string | null;
  cutoffDate: string | null;
  elastic: boolean;
  washSchedule: unknown | null;
  masterFolioId: string | null;
  masterFolioNo: string | null;
  masterFolioStatus: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  blockedRooms: number;
  pickedUpRooms: number;
  remainingRooms: number;
  pickupPercent: number;
  cutoffState: "future" | "due_today" | "past_due" | "not_set";
  allotment: readonly GroupBlockAllotmentRow[];
  roomingList: readonly GroupBlockRoomingListRow[];
}>;
type GroupBlockWorkbench = Readonly<{ groups: readonly GroupBlockSummary[] }>;
type ReservationActions = Readonly<{
  canModify: boolean;
  canCancel: boolean;
  canReinstate: boolean;
  canOpenPrimaryFolio: boolean;
  canManageAlerts: boolean;
}>;
type ReservationDetail = Readonly<{
  reservation: Readonly<{
    reservationId: string;
    primaryPartyId: string;
    confirmationNo: string;
    status: string;
    bookerPartyId: string | null;
    groupId: string | null;
    channelCode: string | null;
    marketCode: string | null;
    sourceCode: string | null;
    originCode: string | null;
    currency: string;
    guaranteePolicyId: string | null;
    eta: string | null;
    etd: string | null;
    notes: string | null;
    createdAt: string;
    cancelledAt: string | null;
    cancelReason: string | null;
    cancellationNo: string | null;
    guests: readonly Readonly<{ partyId: string; displayName: string; role: string; sharePct: string | null }>[];
    segments: readonly Readonly<{
      segmentId: string;
      sequence: number;
      unitTypeId: string;
      sellableUnitId: string | null;
      from: string;
      to: string;
      adults: number;
      childAges: readonly number[];
      ratePlanId: string;
      priceOverride: unknown | null;
      status: "booked" | "in_house" | "departed" | "cancelled";
    }>[];
    folios: readonly Readonly<{
      folioId: string;
      accountId: string;
      folioNo: string | null;
      name: string | null;
      status: string;
      windowNo: number;
    }>[];
    alerts: readonly Readonly<{ alertId: string; code: string | null; message: string; showOn: string; active: boolean }>[];
    travel: readonly Readonly<{ travelId: string; direction: "arrival" | "departure"; mode: string | null; carrier: string | null; serviceNo: string | null; scheduledAt: string | null; pickupRequested: boolean; pickupTaskId: string | null; notes: string | null }>[];
    history: readonly Readonly<{ factId: string; factType: string; businessDate: string; recordedAt: string; validFrom: string; validTo: string | null }>[];
  }>;
  actions: ReservationActions;
}>;
type CheckInReadiness = Readonly<{
  canCheckIn: boolean;
  blockers: readonly string[];
  roomCondition: string | null;
  primaryFolioId: string | null;
  identityGate: Readonly<{ satisfied: boolean }>;
}>;

function checkInBlockerCopy(blocker: string): Readonly<{ title: string; detail: string; tone: "attention" | "neutral" }> {
  switch (blocker) {
    case "dirty_room_override_unauthorized":
      return Object.freeze({
        title: "Room needs Housekeeping",
        detail: "The assigned room is not yet ready. Yellow can coordinate cleaning and inspection without bypassing the room-status control.",
        tone: "attention",
      });
    case "primary_folio_not_open":
      return Object.freeze({
        title: "Primary folio needs opening",
        detail: "Open the guest's billing window, then Yellow will refresh readiness automatically.",
        tone: "attention",
      });
    case "room_assignment_missing":
      return Object.freeze({
        title: "Room assignment needed",
        detail: "Choose from the current eligible rooms in Yellow's guided arrival flow.",
        tone: "attention",
      });
    case "identity_evidence_missing":
      return Object.freeze({
        title: "Guest identity needs review",
        detail: "Complete the required identity or statutory evidence before check-in.",
        tone: "attention",
      });
    default:
      return Object.freeze({
        title: blocker.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase()),
        detail: "Yellow will recheck this requirement against the live hotel record before check-in.",
        tone: "neutral",
      });
  }
}
type DueInRoomCandidate = Readonly<{
  sellableUnitId: string;
  sellableUnitName: string;
  spaceId: string;
  spaceCode: string;
  floor: string | null;
  roomCondition: "dirty" | "pickup" | "clean" | "inspected" | null;
}>;
type DueInRoomCandidateResult = Readonly<{
  candidates: readonly DueInRoomCandidate[];
}>;
type ArrivalCleaningCandidate = Readonly<{
  reservationId: string;
  spaceId: string;
  spaceCode: string;
  roomCondition: "dirty" | "pickup";
  dueAt: string;
  existingTaskId: string | null;
}>;
type ArrivalCleaningCandidateResult = Readonly<{
  canCreate: boolean;
  candidate: ArrivalCleaningCandidate;
}>;
type ArrivalCleaningTaskResult = Readonly<{
  taskId: string;
  reservationId: string;
  spaceId: string;
  roomCondition: "dirty" | "pickup";
  attendantPartyId: string;
  dueAt: string;
  created: boolean;
  replayed: boolean;
}>;
type DueInRoomAssignmentInput = Readonly<{
  segmentId: string;
  expectedReservationStatus: "due_in";
  expectedSegmentStatus: "booked";
  expectedUnitTypeId: string;
  expectedSellableUnitId: null;
  expectedPeriod: Readonly<{ from: string; to: string }>;
  sellableUnitId: string;
}>;
type CheckoutReadiness = Readonly<{
  ready: boolean;
  blockers: readonly string[];
  reservationStatus: string;
  room: Readonly<{ spaceCode: string }> | null;
  folios: readonly Readonly<{
    folioNo: string | null;
    windowNo: number;
    name: string | null;
    status: string;
    currency: string;
    balanceMinor: string;
  }>[];
}>;

export type DepartureServiceKind = "luggage_pickup" | "minibar_check" | "room_inspection" | "escalation";
export type DepartureServiceTiming = Readonly<{
  mode: "immediate" | "delay" | "custom";
  minutes: 10 | 15 | 30 | 45 | null;
  localAt: string | null;
  utcOffsetMinutes: number | null;
}>;
export type DepartureServiceRequest = Readonly<{
  requestId: string;
  reservationId: string;
  segmentId: string;
  spaceId: string;
  serviceKind: DepartureServiceKind;
  parentRequestId: string | null;
  targetRoleId: string | null;
  targetRoleName: string | null;
  proposalStatus: "pending" | "confirmed" | "withdrawn";
  version: number;
  expiresAt: string;
  departureAt: string;
  dueAt: string | null;
  dueLocal: string | null;
  timezone: string;
  taskId: string | null;
  taskStatus: "open" | "assigned" | "in_progress" | "done" | null;
  assigneePartyId: string | null;
  outcome: "clear" | "finding_reported" | "unable_to_complete" | null;
  completedAt: string | null;
  eligibleActions: readonly string[];
}>;
export type DepartureServiceOverview = Readonly<{
  reservationId: string;
  reservationStatus: string;
  timezone: string;
  evidence: Readonly<{ segmentId: string; spaceId: string; departureAt: string }> | null;
  roles: readonly Readonly<{ roleId: string; name: string }>[];
  staff: readonly Readonly<{ partyId: string; name: string }>[];
  requests: readonly DepartureServiceRequest[];
}>;
type PartyProfile = Readonly<{
  partyId: string;
  displayName: string;
  legalName: string | null;
  kind: string;
  status: string;
  roles: readonly string[];
  contacts: readonly Readonly<{ kind: string; hint: string }>[];
}>;
type ReservationGuestRole = "primary" | "accompanying" | "sharer";
type ReservationGuestDraft = Readonly<{
  partyId: string;
  displayName: string;
  role: Exclude<ReservationGuestRole, "primary">;
  sharePct: string | null;
}>;
type ReservationGuestReplacement = Readonly<{
  primarySharePct: string | null;
  guests: readonly Readonly<{
    partyId: string;
    role: Exclude<ReservationGuestRole, "primary">;
    sharePct: string | null;
  }>[];
}>;
type ReservationOffer = Readonly<{
  optionRef: string;
  sellableUnitId: string;
  sellableUnitName: string;
  unitTypeCode: string;
  ratePlanId: string;
  ratePlanCode: string;
  availableCount: number;
  promise: false;
  commitArbitrationRequired: true;
  stay: Readonly<{ from: string; to: string }>;
  total: Readonly<{ amountMinor: string; currency: string; kind: string }>;
}>;
type CreatedReservation = Readonly<{
  reservationId: string;
  confirmationNo: string;
  status: string;
}>;
type ReservationCreateEvidence = Readonly<{
  primaryPartyId: string;
  offer: ReservationOffer;
  adults: number;
  childAges: readonly number[];
  channelCode: string;
}>;
type DuplicatePartyEvidence = Readonly<{
  normalizedName: string;
  displayName: string;
  partyIds: readonly string[];
}>;
type ReservationMutableFields = Readonly<Partial<Record<keyof ReservationOperationalFields, string | null>>>;
type ReservationLifecycleMutationResult = Readonly<{
  reservationId: string;
  status: string;
  diff: Readonly<Record<string, Readonly<{ before: string | null; after: string | null }>>>;
  replayed: boolean;
}>;
type CancellationPolicyDecision = Readonly<{
  evidence: "none" | "frozen_policy" | "legacy_unfrozen";
  policy_id: string | null;
  content_hash: string | null;
  rule_before_hours: number | null;
  penalty: Readonly<{ basis: "nights" | "percent"; value: number }> | null;
}>;
type CancelReservationReceipt = Readonly<{
  reservationId: string;
  previousStatus: "reserved" | "due_in";
  status: "cancelled";
  cancellationNo: string;
  cancelledAt: string;
  releasedClaimCount: number;
  policyDecision: CancellationPolicyDecision;
  approvalId: string | null;
  penaltyJournalId: null;
  replayed: boolean;
}>;
type ReinstateReservationReceipt = Readonly<{
  reservationId: string;
  previousStatus: "cancelled" | "no_show";
  status: "reserved";
  reclaimedClaimCount: number;
  replayed: boolean;
}>;
type ReservationLifecycleReceipt = CancelReservationReceipt | ReinstateReservationReceipt;

class ReservationCommandRequestError extends Error {
  constructor(
    message: string,
    readonly uncertain: boolean,
    readonly status = 0,
  ) {
    super(message);
    this.name = "ReservationCommandRequestError";
  }
}

class ReservationLifecycleRequestError extends Error {
  constructor(
    message: string,
    readonly uncertain: boolean,
    readonly status = 0,
  ) {
    super(message);
    this.name = "ReservationLifecycleRequestError";
  }
}

const RESERVATION_ACTION_KEYS = [
  "canCancel", "canManageAlerts", "canModify", "canOpenPrimaryFolio", "canReinstate",
] as const;
const CANCEL_RECEIPT_KEYS = [
  "approvalId", "cancellationNo", "cancelledAt", "penaltyJournalId", "policyDecision",
  "previousStatus", "releasedClaimCount", "reservationId", "status",
] as const;
const REINSTATE_RECEIPT_KEYS = [
  "previousStatus", "reclaimedClaimCount", "reservationId", "status",
] as const;
const CANCELLATION_POLICY_KEYS = [
  "content_hash", "evidence", "penalty", "policy_id", "rule_before_hours",
] as const;
const CANCELLATION_PENALTY_KEYS = ["basis", "value"] as const;
const RESERVATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function validateReservationActions(value: unknown): ReservationActions {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, RESERVATION_ACTION_KEYS)) {
    throw new Error("The reservation action evidence was incoherent.");
  }
  const actions = value as Record<(typeof RESERVATION_ACTION_KEYS)[number], unknown>;
  if (RESERVATION_ACTION_KEYS.some((key) => typeof actions[key] !== "boolean")) {
    throw new Error("The reservation action evidence was incoherent.");
  }
  return Object.freeze({
    canModify: actions.canModify as boolean,
    canCancel: actions.canCancel as boolean,
    canReinstate: actions.canReinstate as boolean,
    canOpenPrimaryFolio: actions.canOpenPrimaryFolio as boolean,
    canManageAlerts: actions.canManageAlerts as boolean,
  });
}

function validNonNegativeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateCancellationPolicyDecision(value: unknown): CancellationPolicyDecision {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, CANCELLATION_POLICY_KEYS)) {
    throw new Error("invalid cancellation policy evidence");
  }
  const policy = value as Record<(typeof CANCELLATION_POLICY_KEYS)[number], unknown>;
  if (policy.evidence !== "none" && policy.evidence !== "frozen_policy" && policy.evidence !== "legacy_unfrozen") {
    throw new Error("invalid cancellation policy evidence");
  }
  if (policy.policy_id !== null && (typeof policy.policy_id !== "string" || !RESERVATION_UUID.test(policy.policy_id))) {
    throw new Error("invalid cancellation policy evidence");
  }
  if (policy.content_hash !== null && (typeof policy.content_hash !== "string" || !/^[0-9a-f]{64}$/iu.test(policy.content_hash))) {
    throw new Error("invalid cancellation policy evidence");
  }
  if (policy.rule_before_hours !== null && !validNonNegativeCount(policy.rule_before_hours)) {
    throw new Error("invalid cancellation policy evidence");
  }
  let penalty: CancellationPolicyDecision["penalty"] = null;
  if (policy.penalty !== null) {
    if (!policy.penalty || typeof policy.penalty !== "object" || Array.isArray(policy.penalty) ||
        !hasExactKeys(policy.penalty, CANCELLATION_PENALTY_KEYS)) {
      throw new Error("invalid cancellation policy evidence");
    }
    const item = policy.penalty as Record<(typeof CANCELLATION_PENALTY_KEYS)[number], unknown>;
    if ((item.basis !== "nights" && item.basis !== "percent") ||
        typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0) {
      throw new Error("invalid cancellation policy evidence");
    }
    penalty = Object.freeze({ basis: item.basis, value: item.value });
  }
  return Object.freeze({
    evidence: policy.evidence,
    policy_id: policy.policy_id as string | null,
    content_hash: policy.content_hash as string | null,
    rule_before_hours: policy.rule_before_hours as number | null,
    penalty,
  });
}

function idempotencyReplayEvidence(value: string | null): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("invalid idempotency replay evidence");
}

function validateCancelReservationReceipt(
  value: unknown,
  expectedReservationId: string,
  replayHeader: string | null,
): CancelReservationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, ["reservation"])) {
    throw new Error("invalid cancellation receipt envelope");
  }
  const reservation = (value as { reservation?: unknown }).reservation;
  if (!reservation || typeof reservation !== "object" || Array.isArray(reservation) ||
      !hasExactKeys(reservation, CANCEL_RECEIPT_KEYS)) {
    throw new Error("invalid cancellation receipt");
  }
  const receipt = reservation as Record<(typeof CANCEL_RECEIPT_KEYS)[number], unknown>;
  const expectedCancellationNo = `C-${expectedReservationId.replaceAll("-", "").toUpperCase()}`;
  if (!RESERVATION_UUID.test(expectedReservationId) || receipt.reservationId !== expectedReservationId ||
      (receipt.previousStatus !== "reserved" && receipt.previousStatus !== "due_in") ||
      receipt.status !== "cancelled" || receipt.cancellationNo !== expectedCancellationNo ||
      !isCanonicalInstant(receipt.cancelledAt) || !validNonNegativeCount(receipt.releasedClaimCount) ||
      (receipt.approvalId !== null && (typeof receipt.approvalId !== "string" || !RESERVATION_UUID.test(receipt.approvalId))) ||
      receipt.penaltyJournalId !== null) {
    throw new Error("invalid cancellation receipt");
  }
  return Object.freeze({
    reservationId: expectedReservationId,
    previousStatus: receipt.previousStatus,
    status: "cancelled",
    cancellationNo: receipt.cancellationNo,
    cancelledAt: receipt.cancelledAt,
    releasedClaimCount: receipt.releasedClaimCount,
    policyDecision: validateCancellationPolicyDecision(receipt.policyDecision),
    approvalId: receipt.approvalId,
    penaltyJournalId: null,
    replayed: idempotencyReplayEvidence(replayHeader),
  });
}

function validateReinstateReservationReceipt(
  value: unknown,
  expectedReservationId: string,
  replayHeader: string | null,
): ReinstateReservationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, ["reservation"])) {
    throw new Error("invalid reinstatement receipt envelope");
  }
  const reservation = (value as { reservation?: unknown }).reservation;
  if (!reservation || typeof reservation !== "object" || Array.isArray(reservation) ||
      !hasExactKeys(reservation, REINSTATE_RECEIPT_KEYS)) {
    throw new Error("invalid reinstatement receipt");
  }
  const receipt = reservation as Record<(typeof REINSTATE_RECEIPT_KEYS)[number], unknown>;
  if (!RESERVATION_UUID.test(expectedReservationId) || receipt.reservationId !== expectedReservationId ||
      (receipt.previousStatus !== "cancelled" && receipt.previousStatus !== "no_show") ||
      receipt.status !== "reserved" || !validNonNegativeCount(receipt.reclaimedClaimCount)) {
    throw new Error("invalid reinstatement receipt");
  }
  return Object.freeze({
    reservationId: expectedReservationId,
    previousStatus: receipt.previousStatus,
    status: "reserved",
    reclaimedClaimCount: receipt.reclaimedClaimCount,
    replayed: idempotencyReplayEvidence(replayHeader),
  });
}

function duplicatePartyEvidence(profiles: readonly PartyProfile[]): readonly DuplicatePartyEvidence[] {
  const groups = new Map<string, PartyProfile[]>();
  for (const profile of profiles) {
    const normalizedName = profile.displayName.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    if (!normalizedName) continue;
    groups.set(normalizedName, [...(groups.get(normalizedName) ?? []), profile]);
  }
  return Object.freeze([...groups.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([normalizedName, matches]) => Object.freeze({
      normalizedName,
      displayName: matches[0]!.displayName,
      partyIds: Object.freeze(matches.map(({ partyId }) => partyId).sort()),
    }))
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName)));
}

function reservationMatchesCreateReceipt(
  detail: ReservationDetail | undefined,
  receipt: CreatedReservation,
  evidence: ReservationCreateEvidence,
): boolean {
  if (!detail) return false;
  const reservation = detail.reservation;
  if (
    reservation.reservationId !== receipt.reservationId ||
    reservation.confirmationNo !== receipt.confirmationNo ||
    reservation.status !== receipt.status ||
    reservation.primaryPartyId !== evidence.primaryPartyId ||
    reservation.channelCode !== evidence.channelCode
  ) return false;
  return reservation.segments.some((segment) =>
    segment.sellableUnitId === evidence.offer.sellableUnitId &&
    segment.ratePlanId === evidence.offer.ratePlanId &&
    segment.from === evidence.offer.stay.from &&
    segment.to === evidence.offer.stay.to &&
    segment.adults === evidence.adults &&
    JSON.stringify(segment.childAges) === JSON.stringify(evidence.childAges));
}

function sameReservationOffer(left: ReservationOffer, right: ReservationOffer): boolean {
  return left.optionRef === right.optionRef &&
    left.sellableUnitId === right.sellableUnitId &&
    left.ratePlanId === right.ratePlanId &&
    left.promise === right.promise &&
    left.commitArbitrationRequired === right.commitArbitrationRequired &&
    left.stay.from === right.stay.from &&
    left.stay.to === right.stay.to &&
    left.total.amountMinor === right.total.amountMinor &&
    left.total.currency === right.total.currency &&
    left.total.kind === right.total.kind;
}
type HousekeepingCondition = Readonly<{
  spaceId: string;
  code: string;
  floor: string;
  condition: string;
  updatedAt: string;
}>;
type HousekeepingTaskAction = "start" | "complete" | "verify";
type HousekeepingTask = Readonly<{
  taskId: string;
  spaceId: string;
  spaceCode: string;
  floor: string | null;
  roomCondition: "clean" | "dirty" | "pickup" | "inspected";
  roomUpdatedAt: string;
  taskStatus: "assigned" | "in_progress" | "done" | "verified";
  priority: number;
  assigned: boolean;
  dueAt: string | null;
  completedAt: string | null;
  allowedActions: readonly HousekeepingTaskAction[];
}>;
type HousekeepingTransitionReceipt = Readonly<{
  taskId: string;
  taskStatus: "assigned" | "in_progress" | "done" | "verified";
  spaceId: string;
  roomCondition: "clean" | "dirty" | "pickup" | "inspected";
  roomUpdatedAt: string;
  completedAt: string | null;
  action: HousekeepingTaskAction;
  allowedActions: readonly HousekeepingTaskAction[];
  replayed: boolean;
}>;
type HousekeepingActionProposal = Readonly<{
  task: HousekeepingTask;
  action: HousekeepingTaskAction;
  key: string;
}>;
type OperationalBlock = Readonly<{
  id: string;
  kind: "ooo" | "oos";
}>;
type PropertyRestriction = Readonly<{ id: string }>;
type InventoryPolicySummary = Readonly<{ oosSellability: "blocked" | "allowed" }>;
type CommercialSnapshot = Readonly<{
  policies: readonly Readonly<{ id: string; kind: string; name: string }>[];
  ratePlans: readonly Readonly<{
    id: string;
    code: string;
    name: string;
    currency: string;
    taxInclusive: boolean;
    marketCode: string | null;
    sourceCode: string | null;
    status: string;
  }>[];
  inventory: Readonly<{
    unitTypes: readonly Readonly<{ id: string; code: string; name: string }>[];
    spaces: readonly Readonly<{ id: string; code: string }>[];
    sellableUnits: readonly Readonly<{ id: string; name: string }>[];
  }>;
}>;
type PropertySettingsSnapshot = Readonly<{
  commercial: CommercialSnapshot;
  performance: OperatingPerformance;
  operationalBlocks: readonly OperationalBlock[];
  restrictions: readonly PropertyRestriction[];
  inventoryPolicy: InventoryPolicySummary;
}>;
type PerformanceMetric = Readonly<{
  roomNights: number;
  roomsAvailable: number;
  occupancyBasisPoints: number;
  roomRevenueMinor: string;
  adrMinor: string;
  revparMinor: string;
}>;
type OperatingPerformance = Readonly<{
  property: Readonly<{ name: string; businessDate: string; currency: string }>;
  today: PerformanceMetric;
  todayComparison: Readonly<{ actual: PerformanceMetric; lastYear: PerformanceMetric; forecast: PerformanceMetric; budget: PerformanceMetric }>;
  periods: readonly Readonly<{
    key: "mtd" | "qtd" | "ytd";
    label: "MTD" | "QTD" | "YTD";
    actual: PerformanceMetric;
    lastYear: PerformanceMetric;
    forecast: PerformanceMetric;
    budget: PerformanceMetric;
  }>[];
  otb: readonly Readonly<{
    date: string;
    roomsAvailable: number;
    roomsSold: number;
    occupancyBasisPoints: number;
    roomRevenueMinor: string;
  }>[];
}>;
type CashierSnapshot = Readonly<{
  drawers: readonly Readonly<{
    drawerId: string;
    code: string;
    name: string;
    currency: string;
    canOpen: boolean;
    canCount: boolean;
    canClose: boolean;
    supervised: boolean;
    session: Readonly<{ status: string }> | null;
  }>[];
}>;
type FolioChargeOption = Readonly<{
  code: string;
  name: string;
  usaliLine: string;
}>;
type FolioTransferGroup = Readonly<{
  id: string;
  memberCount: number;
  eligible: boolean;
  reason: string | null;
  currentWindowId: string;
}>;
type FolioTransferMemberEffect = Readonly<{
  rootLineId: string;
  groupId: string;
  amountMinor: string;
  sourceEffectMinor: string;
  destinationEffectMinor: string;
  txCode: string;
  description: string | null;
  quantity: string;
}>;
type FolioTransferPreview = Readonly<{
  sourceFolioId: string;
  destinationFolioId: string | null;
  destinationName: string | null;
  destinationWindowNo: number;
  currency: string;
  sourceBeforeMinor: string;
  sourceAfterMinor: string;
  destinationBeforeMinor: string;
  destinationAfterMinor: string;
  stayTotalMinor: string;
  unchangedStayTotalMinor: string;
  memberEffects: readonly FolioTransferMemberEffect[];
  generation: string;
  previewRevision: string;
}>;
type FolioTransferReceipt = FolioTransferPreview & Readonly<{
  journalId: string;
  businessDate: string;
  replayed: boolean;
}>;
type FolioTransferDraft = Readonly<{
  sourceFolioId: string;
  destinationFolioId: string | null;
  newWindowName: string | null;
  groupIds: readonly string[];
  reason: string;
  generation: string;
  previewRevision: string;
}>;
type FolioTransferAttempt = Readonly<{
  draft: FolioTransferDraft;
  preview: FolioTransferPreview;
  idempotencyKey: string;
}>;
type FolioChargeGroup = "Rooms" | "Food & beverage" | "Wellness" | "Guest services" | "Other";

function CashierGroupIcon({ group }: Readonly<{ group: FolioChargeGroup | "All" }>) {
  return (
    <svg className="cashier-group-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {group === "All" ? <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></> : null}
      {group === "Rooms" ? <><path d="M4 18V8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V18" /><path d="M4 14h16M7 14v-3h4v3M3 18h18" /></> : null}
      {group === "Food & beverage" ? <><path d="M7 3v8a3 3 0 0 0 3 3V3M7 7h3M8.5 14v7" /><path d="M16 3v18M16 3c3 2 3 7 0 9" /></> : null}
      {group === "Wellness" ? <><path d="M12 21c4-3 7-6.2 7-11a4 4 0 0 0-7-2.6A4 4 0 0 0 5 10c0 4.8 3 8 7 11Z" /><path d="M9 12h6M12 9v6" /></> : null}
      {group === "Guest services" ? <><path d="M5 19h14M7 19v-3a5 5 0 0 1 10 0v3M12 11V8" /><circle cx="12" cy="5.5" r="1.5" /></> : null}
      {group === "Other" ? <><circle cx="6" cy="12" r="1.25" /><circle cx="12" cy="12" r="1.25" /><circle cx="18" cy="12" r="1.25" /></> : null}
    </svg>
  );
}

function folioChargeGroup(option: FolioChargeOption): FolioChargeGroup {
  const searchable = `${option.code} ${option.name} ${option.usaliLine}`.toLocaleLowerCase();
  if (/room|accommodation|lodging/u.test(searchable)) return "Rooms";
  if (/food|beverage|drink|bar|alcohol|restaurant|dessert|f&b/u.test(searchable)) return "Food & beverage";
  if (/spa|wellness|massage|salon|fitness/u.test(searchable)) return "Wellness";
  if (/laundry|transport|transfer|parking|telephone|guest service/u.test(searchable)) return "Guest services";
  return "Other";
}

function statusTone(status: string): string {
  if (status === "in_house" || status === "open" || status === "ready") return "positive";
  if (status === "due_in" || status === "due_out" || status === "pending") return "attention";
  if (status === "checked_out" || status === "closed") return "neutral";
  return "neutral";
}
type FolioStatement = Readonly<{
  reservationId: string | null;
  folio: Readonly<{
    id: string;
    reference: string | null;
    name: string | null;
    windowNo: number;
    status: string;
    currency: string;
  }>;
  siblingWindows: readonly Readonly<{
    id: string;
    windowNo: number;
    reference: string | null;
    name: string | null;
    status: string;
    balanceMinor: string;
  }>[];
  balanceMinor: string;
  stayTotalMinor: string;
  generation: string;
  rows: readonly Readonly<{
    lineId: string;
    journalId: string;
    kind: string;
    businessDate: string;
    description: string | null;
    quantity: string;
    amountMinor: string;
    runningBalanceMinor: string;
    txCode: string;
    transferGroup: FolioTransferGroup;
  }>[];
  chargeOptions: readonly FolioChargeOption[];
  chargeAvailability: Readonly<{ allowed: boolean; reason: string | null }>;
}>;
type HostedDepositState = "ready" | "processing" | "captured" | "declined" | "expired" | "revoked";
type HostedDepositStatus = Readonly<{
  requestId: string; operationId: string; propertyNode: string; propertyName: string; folioId: string;
  folioReference: string; amountMinor: string; currency: string; generation: number; expiresAt: string;
  state: HostedDepositState; capturedMinor: string; appliedMinor: string; remainingMinor: string;
}>;
type HostedDepositInstrument = Readonly<{
  instrumentId: string; kind: "card_network_token" | "upi_vpa"; brand: string | null;
  last4: string | null; expiry: string | null; psp: string | null;
}>;
type HostedDepositWorkbench = Readonly<{
  propertyNode: string; folioId: string; deposits: readonly HostedDepositStatus[]; instruments: readonly HostedDepositInstrument[];
}>;
type HostedDepositLink = Readonly<{
  requestId: string; operationId: string; bearer?: string; expiresAt: string; amountMinor: string;
  currency: string; generation: number; replayed: boolean;
}>;
type DepositApplicationReceipt = Readonly<{
  applicationId: string; journalId: string; hostedRequestId: string; amountMinor: string; currency: string; replayed: boolean;
}>;
type DepositDraft = Readonly<{
  reservationId: string; folioId: string; accountId: string; folioReference: string | null; amountMinor: string; currency: string;
  balanceBeforeMinor: string; instrument?: HostedDepositInstrument; requestSnapshot?: HostedDepositStatus;
}>;
type DepositAttempt = Readonly<{ draft: DepositDraft; key: string; body: string; kind: "create" | "apply" }>;
type ReceivableTarget = Readonly<{
  accountId: string;
  partyId: string;
  partyRole: "company" | "agent";
  name: string;
  currency: string;
  creditLimitMinor: string;
}>;
type ReceivablePreview = Readonly<{
  folioId: string;
  receivableAccountId: string;
  partyId: string;
  partyRole: "company" | "agent";
  name: string;
  currency: string;
  amountMinor: string;
  exposureMinor: string;
  creditLimitMinor: string | null;
  projectedExposureMinor: string;
  requiresApproval: boolean;
}>;
type ReceivableApprovalReceipt = Readonly<Omit<ReceivablePreview, "requiresApproval"> & {
  approvalId: string;
  status: "pending" | "approved" | "rejected";
  replayed: boolean;
}>;
type ReceivableTransferReceipt = ReceivablePreview & Readonly<{
  journalId: string;
  approvalId: string | null;
  replayed: boolean;
}>;
type Turn = Readonly<{ role: "user" | "assistant"; text: string }>;
type AssistantMemory = Readonly<{
  open: boolean;
  language: VoiceLanguage;
  turns: readonly Turn[];
  reservationQuery?: ReservationQueryContext;
}>;
type AssistantCard = Readonly<{
  eyebrow: string;
  title: string;
  detail: string;
  rows: readonly Readonly<{ primary: string; secondary: string }> [];
  checkInReservationId?: string;
  checkoutReservationId?: string;
  cashierReservationId?: string;
  movement?: Readonly<{
    status: Status | "all";
    lane: Lane;
    query?: MovementQuery;
    detailReservationId?: string;
  }>;
  performance?: Readonly<{ intent: KpiIntent; data: OperatingPerformance }>;
  reservationId?: string;
  guestPartyId?: string;
  workspace?: WorkspaceIntent;
}>;
type GuestAllocationProposal = Readonly<{
  reservationId: string;
  confirmationNo: string;
  primaryName: string;
  baseline: ReservationGuestReplacement;
  replacement: ReservationGuestReplacement;
  displayRows: readonly Readonly<{ primary: string; secondary: string }>[];
  fingerprint: string;
  key: string;
}>;
type CashierChargeProposal = Readonly<{
  reservationId: string;
  confirmationNo: string;
  guestName: string;
  folioId: string;
  folioReference: string;
  currency: string;
  txCode: string;
  txName: string;
  amountMinor: string;
  amountMajor: string;
  quantity: string;
  fingerprint: string;
  key: string;
  postingAttempted: boolean;
  receipt: FolioChargeReceipt | null;
}>;
type VoiceBillWindowTransferProposal = Readonly<{
  reservationId: string;
  confirmationNo: string;
  guestName: string;
  folioReference: string;
  chargeLabel: string;
  destinationLabel: string;
  destinationExistingName: string | null;
  draft: FolioTransferDraft;
  preview: FolioTransferPreview;
  key: string;
  postingAttempted: boolean;
  receipt: FolioTransferReceipt | null;
}>;
type FolioChargeReceipt = Readonly<{
  journalId: string;
  folioId: string;
  businessDate: string;
  currency: string;
  txCode: string;
  amountMinor: string;
  quantity: string;
  replayed: boolean;
}>;
type ArrivalConversationCommand = Readonly<{ id: string; text: string }>;
type ArrivalConversationProposal =
  | Readonly<{ kind: "assign"; room: DueInRoomCandidate; body: DueInRoomAssignmentInput }>
  | Readonly<{ kind: "cleaning"; candidate: ArrivalCleaningCandidate; attendant: Readonly<{ partyId: string; displayName: string }> }>
  | Readonly<{ kind: "housekeeping"; proposal: HousekeepingActionProposal }>
  | Readonly<{ kind: "folio" }>
  | Readonly<{ kind: "checkin" }>;
type Recognition = {
  start(): void;
  stop(): void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex?: number;
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal?: boolean }
        >;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

let sharedDemoSession: Promise<string> | null = null;

async function session(): Promise<string> {
  sharedDemoSession ??= (async () => {
    const r = await fetch("/api/v1/auth/demo:enter", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const body = (await r.json()) as { accessToken?: string };
    if (!r.ok || !body.accessToken)
      throw new Error("The shared demo session is unavailable.");
    return body.accessToken;
  })();
  try {
    return await sharedDemoSession;
  } catch (error) {
    sharedDemoSession = null;
    throw error;
  }
}
async function loadProperties(): Promise<readonly Property[]> {
  const r = await fetch("/api/v1/me/properties", {
    headers: { authorization: `Bearer ${await session()}` },
  });
  if (!r.ok) throw new Error("Property choices are unavailable.");
  return (((await r.json()) as { properties?: Property[] }).properties ?? [])
    .filter((property) => SHOWCASE_PROPERTIES.has(property.id));
}
async function loadLane(status: Status): Promise<Lane> {
  const token = await session();
  return collectReservationBoardPages<Stay>(async (after) => {
    const query = new URLSearchParams({ status, limit: "100" });
    if (after !== null) query.set("after", after);
    const response = await fetch(
      `/api/v1/properties/${propertyId}/reservation-board?${query}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error("Operational data is unavailable.");
    return response.json() as Promise<Readonly<{ reservations?: Stay[]; nextCursor?: string | null }>>;
  });
}
async function loadReservationBoard(): Promise<Lane> {
  const token = await session();
  return collectReservationBoardPages<Stay>(async (after) => {
    const query = new URLSearchParams({ limit: "100" });
    if (after !== null) query.set("after", after);
    const response = await fetch(
      `/api/v1/properties/${propertyId}/reservation-board?${query}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error("Reservations are unavailable.");
    return response.json() as Promise<Readonly<{ reservations?: Stay[]; nextCursor?: string | null }>>;
  });
}
async function loadGroupBlocks(): Promise<GroupBlockWorkbench> {
  const response = await fetch(`/api/v1/properties/${propertyId}/group-blocks`, {
    headers: { authorization: `Bearer ${await session()}` },
  });
  if (!response.ok) throw new Error("Group blocks are unavailable.");
  return response.json() as Promise<GroupBlockWorkbench>;
}
async function loadPartyStayHistory(partyId: string): Promise<Lane> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservation-board?${new URLSearchParams({ partyId, limit: "100" })}`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("Guest stay history is unavailable.");
  return r.json() as Promise<Lane>;
}
async function searchPartyProfiles(
  query: string,
): Promise<readonly PartyProfile[]> {
  const r = await fetch(`/api/v1/properties/${propertyId}/parties:search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await session()}`,
    },
    body: JSON.stringify({ query, limit: 50 }),
  });
  if (!r.ok) throw new Error("Guest profiles are unavailable.");
  return ((await r.json()) as { profiles?: PartyProfile[] }).profiles ?? [];
}
function propertyLocalDate(timezone: string, offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (kind: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === kind)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function propertyLocalDateTimeToIso(
  date: string,
  time: string,
  timezone: string,
): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite))
    throw new Error("Choose valid property-local stay dates.");
  const desired = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0, 0);
  let instant = desired;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant));
    const value = (kind: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === kind)?.value ?? Number.NaN);
    const observed = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    instant = desired - (observed - instant);
  }
  return new Date(instant).toISOString();
}
function childAgesFrom(value: string): readonly number[] {
  if (!value.trim()) return [];
  const ages = value.split(",").map((part) => Number(part.trim()));
  if (
    ages.length > 30 ||
    ages.some((age) => !Number.isSafeInteger(age) || age < 0 || age > 17)
  ) throw new Error("Child ages must be comma-separated whole numbers from 0 to 17.");
  return ages;
}
async function reservationApiError(response: Response, fallback: string): Promise<Error> {
  const problem = (await response.json().catch(() => ({}))) as {
    detail?: string;
    title?: string;
  };
  return new Error(problem.detail ?? problem.title ?? fallback);
}
async function searchReservationOffers(input: Readonly<{
  from: string;
  to: string;
  adults: number;
  childAges: readonly number[];
  channelCode: string;
}>): Promise<readonly ReservationOffer[]> {
  const response = await fetch(
    `/api/v1/properties/${propertyId}/availability:search`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
      },
      body: JSON.stringify({
        stay: { from: input.from, to: input.to },
        party: {
          adults: input.adults,
          children: input.childAges.map((age) => ({ age })),
        },
        channel: input.channelCode,
      }),
    },
  );
  if (!response.ok)
    throw await reservationApiError(response, "Current offers are unavailable.");
  const payload = (await response.json()) as {
    options?: readonly Readonly<{
      option_ref: string;
      bookable: boolean;
      sellable_unit: Readonly<{ id: string; name: string }>;
      unit_type: Readonly<{ code: string }>;
      rate_plan: Readonly<{ id: string; code: string }>;
      available_count: number;
      promise: boolean;
      commit_arbitration_required: boolean;
      stay: Readonly<{ from: string; to: string }>;
      total: Readonly<{ amount_minor: string; currency: string; kind: string }> | null;
    }>[];
  };
  return (payload.options ?? [])
    .filter(
      (offer) =>
        offer.bookable &&
        offer.promise === false &&
        offer.commit_arbitration_required === true &&
        offer.total !== null,
    )
    .map((offer) => ({
      optionRef: offer.option_ref,
      sellableUnitId: offer.sellable_unit.id,
      sellableUnitName: offer.sellable_unit.name,
      unitTypeCode: offer.unit_type.code,
      ratePlanId: offer.rate_plan.id,
      ratePlanCode: offer.rate_plan.code,
      availableCount: offer.available_count,
      promise: false,
      commitArbitrationRequired: true,
      stay: offer.stay,
      total: {
        amountMinor: offer.total!.amount_minor,
        currency: offer.total!.currency,
        kind: offer.total!.kind,
      },
    }));
}
async function commitReservation(input: Readonly<{
  primaryPartyId: string;
  offer: ReservationOffer;
  adults: number;
  childAges: readonly number[];
  channelCode: string;
  idempotencyKey: string;
}>): Promise<CreatedReservation> {
  let response: Response;
  try {
    response = await fetch("/api/v1/reservations:commit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify({
        propertyNode: propertyId,
        primaryPartyId: input.primaryPartyId,
        ratePlanId: input.offer.ratePlanId,
        adults: input.adults,
        childAges: input.childAges,
        channelCode: input.channelCode,
        direct: {
          sellableUnitId: input.offer.sellableUnitId,
          from: input.offer.stay.from,
          to: input.offer.stay.to,
        },
      }),
    });
  } catch {
    throw new ReservationCommandRequestError(
      "The reservation response was interrupted. Yellow retained this exact request for same-key reconciliation.",
      true,
    );
  }
  if (!response.ok) {
    const error = await reservationApiError(
      response,
      "The reservation could not be committed.",
    );
    throw new ReservationCommandRequestError(error.message, response.status >= 500, response.status);
  }
  try {
    const receipt = ((await response.json()) as { reservation?: CreatedReservation }).reservation;
    if (!receipt?.reservationId || !receipt.confirmationNo || !receipt.status) throw new Error("invalid receipt");
    return receipt;
  } catch {
    throw new ReservationCommandRequestError(
      "The reservation response could not be verified. Yellow retained this exact request for same-key reconciliation.",
      true,
    );
  }
}
async function loadHousekeeping(): Promise<
  Readonly<{
    rooms: readonly HousekeepingCondition[];
    tasks: readonly HousekeepingTask[];
  }>
> {
  const headers = { authorization: `Bearer ${await session()}` };
  const [conditions, tasks] = await Promise.all([
    fetch(
      `/api/v1/properties/${propertyId}/housekeeping/conditions?limit=100`,
      { headers },
    ),
    fetch(`/api/v1/properties/${propertyId}/housekeeping/tasks?limit=100`, {
      headers,
    }),
  ]);
  if (!conditions.ok || !tasks.ok)
    throw new Error("Housekeeping data is unavailable.");
  return {
    rooms:
      ((await conditions.json()) as { rooms?: HousekeepingCondition[] })
        .rooms ?? [],
    tasks: ((await tasks.json()) as { tasks?: HousekeepingTask[] }).tasks ?? [],
  };
}
async function loadHousekeepingTask(taskId: string): Promise<HousekeepingTask> {
  const response = await fetch(
    `/api/v1/properties/${propertyId}/housekeeping/tasks/${taskId}`,
    {
      cache: "no-store",
      headers: { authorization: `Bearer ${await session()}` },
    },
  );
  if (!response.ok) throw await reservationApiError(response, "Current housekeeping task truth is unavailable.");
  const body = await response.json() as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !("task" in body)) {
    throw new Error("The housekeeping task response was incoherent.");
  }
  return validateHousekeepingTask((body as { readonly task: unknown }).task, taskId);
}
const HOUSEKEEPING_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HOUSEKEEPING_TASK_KEYS = [
  "allowedActions", "assigned", "completedAt", "dueAt", "floor", "priority",
  "roomCondition", "roomUpdatedAt", "spaceCode", "spaceId", "taskId", "taskStatus",
] as const;
const HOUSEKEEPING_RECEIPT_KEYS = [
  "action", "allowedActions", "completedAt", "replayed", "roomCondition",
  "roomUpdatedAt", "spaceId", "taskId", "taskStatus",
] as const;
function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function isHousekeepingAction(value: unknown): value is HousekeepingTaskAction {
  return value === "start" || value === "complete" || value === "verify";
}
function validateHousekeepingTask(value: unknown, expectedTaskId: string): HousekeepingTask {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, HOUSEKEEPING_TASK_KEYS)) {
    throw new Error("The housekeeping task response was incoherent.");
  }
  const task = value as Partial<HousekeepingTask>;
  const validStatus = task.taskStatus === "assigned" || task.taskStatus === "in_progress" ||
    task.taskStatus === "done" || task.taskStatus === "verified";
  const validCondition = task.roomCondition === "clean" || task.roomCondition === "dirty" ||
    task.roomCondition === "pickup" || task.roomCondition === "inspected";
  const validActions = Array.isArray(task.allowedActions) && task.allowedActions.length <= 1 &&
    task.allowedActions.every(isHousekeepingAction);
  if (
    task.taskId !== expectedTaskId || !HOUSEKEEPING_UUID.test(expectedTaskId) ||
    typeof task.spaceId !== "string" || !HOUSEKEEPING_UUID.test(task.spaceId) ||
    typeof task.spaceCode !== "string" || task.spaceCode.trim().length === 0 ||
    (task.floor !== null && typeof task.floor !== "string") ||
    !validStatus || !validCondition || typeof task.assigned !== "boolean" ||
    !Number.isInteger(task.priority) ||
    (task.dueAt !== null && !isCanonicalInstant(task.dueAt)) ||
    !isCanonicalInstant(task.roomUpdatedAt) ||
    (task.completedAt !== null && !isCanonicalInstant(task.completedAt)) ||
    !validActions
  ) throw new Error("The housekeeping task response was incoherent.");
  return task as HousekeepingTask;
}
function housekeepingTaskMatchesProposal(
  current: HousekeepingTask,
  proposal: HousekeepingActionProposal,
): boolean {
  const expected = proposal.task;
  return current.taskId === expected.taskId &&
    current.spaceId === expected.spaceId &&
    current.taskStatus === expected.taskStatus &&
    current.roomCondition === expected.roomCondition &&
    current.roomUpdatedAt === expected.roomUpdatedAt &&
    current.allowedActions.length === 1 &&
    current.allowedActions[0] === proposal.action;
}
function validateHousekeepingTransitionReceipt(
  value: unknown,
  expected: HousekeepingTask,
  action: HousekeepingTaskAction,
): HousekeepingTransitionReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, HOUSEKEEPING_RECEIPT_KEYS))
    throw new Error("The housekeeping transition receipt was incoherent.");
  const receipt = value as Partial<HousekeepingTransitionReceipt>;
  const expectedStatus = action === "start" ? "in_progress" : action === "complete" ? "done" : "verified";
  const expectedCondition = action === "start" ? expected.roomCondition : action === "complete" ? "clean" : "inspected";
  const expectedAllowedActions: readonly HousekeepingTaskAction[] = action === "start" &&
    (expected.roomCondition === "dirty" || expected.roomCondition === "pickup")
      ? ["complete"]
      : [];
  if (
    receipt.taskId !== expected.taskId ||
    receipt.spaceId !== expected.spaceId ||
    typeof receipt.taskId !== "string" || !HOUSEKEEPING_UUID.test(receipt.taskId) ||
    typeof receipt.spaceId !== "string" || !HOUSEKEEPING_UUID.test(receipt.spaceId) ||
    receipt.action !== action ||
    receipt.taskStatus !== expectedStatus ||
    receipt.roomCondition !== expectedCondition ||
    !isCanonicalInstant(receipt.roomUpdatedAt) ||
    (action === "start" && receipt.roomUpdatedAt !== expected.roomUpdatedAt) ||
    (action === "start" ? receipt.completedAt !== null : !isCanonicalInstant(receipt.completedAt)) ||
    (action === "verify" && receipt.completedAt !== expected.completedAt) ||
    !Array.isArray(receipt.allowedActions) ||
    receipt.allowedActions.length !== expectedAllowedActions.length ||
    receipt.allowedActions.some((item, index) => item !== expectedAllowedActions[index]) ||
    typeof receipt.replayed !== "boolean"
  ) throw new Error("The housekeeping transition receipt was incoherent.");
  return receipt as HousekeepingTransitionReceipt;
}
function housekeepingTaskReflectsAction(
  current: HousekeepingTask,
  proposal: HousekeepingActionProposal,
): boolean {
  const expectedStatus = proposal.action === "start" ? "in_progress" : proposal.action === "complete" ? "done" : "verified";
  const expectedCondition = proposal.action === "start" ? proposal.task.roomCondition : proposal.action === "complete" ? "clean" : "inspected";
  return current.taskId === proposal.task.taskId && current.spaceId === proposal.task.spaceId &&
    current.taskStatus === expectedStatus && current.roomCondition === expectedCondition;
}
function housekeepingFailureIsUncertain(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "uncertain" in value && value.uncertain === true);
}
async function transitionHousekeepingTask(
  task: HousekeepingTask,
  action: HousekeepingTaskAction,
  idempotencyKey: string,
): Promise<HousekeepingTransitionReceipt> {
  const token = await session();
  const request = async (): Promise<HousekeepingTransitionReceipt> => {
    let response: Response;
    try {
      response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping/tasks/${task.taskId}/transition`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            action,
            expectedTaskStatus: task.taskStatus,
            expectedRoomCondition: task.roomCondition,
            expectedRoomUpdatedAt: task.roomUpdatedAt,
          }),
        },
      );
    } catch (cause) {
      const error = new Error("The housekeeping response was interrupted. The same operation key will be retained.");
      Object.assign(error, { cause, uncertain: true, status: 0 });
      throw error;
    }
    if (!response.ok) {
      const error = await reservationApiError(response, "The housekeeping action was not accepted.");
      Object.assign(error, { status: response.status, uncertain: response.status >= 500 });
      throw error;
    }
    try {
      return validateHousekeepingTransitionReceipt(await response.json(), task, action);
    } catch (cause) {
      const error = new Error("The housekeeping receipt could not be verified. No successful result will be claimed.");
      Object.assign(error, { cause, uncertain: true, status: response.status });
      throw error;
    }
  };
  try {
    return await request();
  } catch (error) {
    if (!housekeepingFailureIsUncertain(error)) throw error;
    // The identical request and key are safe to repeat: the server either performs
    // one transition or replays the stored canonical receipt.
    return request();
  }
}
async function loadOperationalBlocks(): Promise<readonly OperationalBlock[]> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/operational-blocks`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("Operational block data is unavailable.");
  return ((await r.json()) as { operationalBlocks?: OperationalBlock[] })
    .operationalBlocks ?? [];
}
async function loadCommercialSnapshot(): Promise<CommercialSnapshot> {
  const headers = { authorization: `Bearer ${await session()}` };
  const [rates, inventory] = await Promise.all([
    fetch(`/api/v1/properties/${propertyId}/rate-configuration`, { headers }),
    fetch(`/api/v1/properties/${propertyId}/inventory`, { headers }),
  ]);
  if (!rates.ok || !inventory.ok)
    throw new Error("Commercial configuration is unavailable.");
  const rateData = (await rates.json()) as Omit<CommercialSnapshot, "inventory">;
  return {
    ...rateData,
    inventory: (await inventory.json()) as CommercialSnapshot["inventory"],
  };
}
async function loadOperatingPerformance(): Promise<OperatingPerformance> {
  const r = await fetch(`/api/v1/properties/${propertyId}/operating-performance`, {
    headers: { authorization: `Bearer ${await session()}` },
  });
  if (!r.ok) throw new Error("Operating performance is unavailable.");
  return r.json() as Promise<OperatingPerformance>;
}
async function loadPropertySettings(): Promise<PropertySettingsSnapshot> {
  const headers = { authorization: `Bearer ${await session()}` };
  const [commercial, performance, blocks, restrictions, policy] = await Promise.all([
    loadCommercialSnapshot(),
    loadOperatingPerformance(),
    fetch(`/api/v1/properties/${propertyId}/operational-blocks`, { headers }),
    fetch(`/api/v1/properties/${propertyId}/restrictions`, { headers }),
    fetch(`/api/v1/properties/${propertyId}/inventory-policy`, { headers }),
  ]);
  if (!blocks.ok || !restrictions.ok || !policy.ok)
    throw new Error("Property setup summaries are unavailable for this operator.");
  const blocksBody = await blocks.json() as Readonly<{ operationalBlocks?: readonly OperationalBlock[] }>;
  const restrictionsBody = await restrictions.json() as Readonly<{ restrictions?: readonly PropertyRestriction[] }>;
  const policyBody = await policy.json() as Readonly<{ inventoryPolicy?: InventoryPolicySummary }>;
  if (!policyBody.inventoryPolicy) throw new Error("Inventory policy is unavailable for this property.");
  return Object.freeze({
    commercial,
    performance,
    operationalBlocks: blocksBody.operationalBlocks ?? [],
    restrictions: restrictionsBody.restrictions ?? [],
    inventoryPolicy: policyBody.inventoryPolicy,
  });
}
async function loadCashierSnapshot(): Promise<CashierSnapshot> {
  const r = await fetch(`/api/v1/properties/${propertyId}/cashier-sessions`, {
    headers: { authorization: `Bearer ${await session()}` },
  });
  if (!r.ok) throw new Error("Cashier status is unavailable.");
  return r.json() as Promise<CashierSnapshot>;
}
async function loadFolioStatement(reference: string): Promise<FolioStatement> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/folios/${encodeURIComponent(reference)}/statement`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("The governed folio statement is unavailable.");
  return r.json() as Promise<FolioStatement>;
}
const UUID_VALUE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const POSITIVE_MINOR = /^[1-9][0-9]*$/u;
const ISO_CURRENCY = /^[A-Z]{3}$/u;
function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
    Object.keys(value as Record<string, unknown>).sort().join("|") === [...keys].sort().join("|");
}
function validDepositStatus(value: unknown): value is HostedDepositStatus {
  if (!exactObject(value, ["requestId", "tenantId", "propertyNode", "propertyName", "folioId", "folioReference", "operationId", "amountMinor", "currency", "generation", "expiresAt", "state", "capturedMinor", "appliedMinor", "remainingMinor"])) return false;
  const item = value as Record<string, unknown>;
  return ["requestId", "tenantId", "propertyNode", "folioId", "operationId"].every((key) => typeof item[key] === "string" && UUID_VALUE.test(item[key] as string)) &&
    typeof item.propertyName === "string" && typeof item.folioReference === "string" &&
    ["amountMinor", "capturedMinor", "appliedMinor", "remainingMinor"].every((key) => typeof item[key] === "string" && /^(?:0|[1-9][0-9]*)$/u.test(item[key] as string)) &&
    typeof item.currency === "string" && ISO_CURRENCY.test(item.currency) && typeof item.generation === "number" && Number.isSafeInteger(item.generation) && item.generation > 0 &&
    typeof item.expiresAt === "string" && !Number.isNaN(Date.parse(item.expiresAt)) &&
    ["ready", "processing", "captured", "declined", "expired", "revoked"].includes(item.state as string) &&
    BigInt(item.appliedMinor as string) <= BigInt(item.capturedMinor as string) &&
    BigInt(item.remainingMinor as string) === BigInt(item.capturedMinor as string) - BigInt(item.appliedMinor as string) &&
    ((item.state === "captured" && BigInt(item.capturedMinor as string) === BigInt(item.amountMinor as string)) ||
      ((item.state === "ready" || item.state === "processing" || item.state === "declined" || item.state === "expired" || item.state === "revoked") && BigInt(item.capturedMinor as string) === 0n && BigInt(item.appliedMinor as string) === 0n));
}
function validDepositInstrument(value: unknown): value is HostedDepositInstrument {
  if (!exactObject(value, ["instrumentId", "kind", "brand", "last4", "expiry", "psp"])) return false;
  const item = value as Record<string, unknown>;
  return typeof item.instrumentId === "string" && UUID_VALUE.test(item.instrumentId) &&
    (item.kind === "card_network_token" || item.kind === "upi_vpa") &&
    ["brand", "last4", "expiry", "psp"].every((key) => item[key] === null || typeof item[key] === "string");
}
function validateDepositWorkbench(value: unknown, expectedFolioId: string): HostedDepositWorkbench {
  if (!exactObject(value, ["propertyNode", "folioId", "deposits", "instruments"]) ||
      (value as Record<string, unknown>).propertyNode !== propertyId || (value as Record<string, unknown>).folioId !== expectedFolioId ||
      !Array.isArray((value as Record<string, unknown>).deposits) || !Array.isArray((value as Record<string, unknown>).instruments)) {
    throw new Error("The server returned an invalid advance-deposit workbench.");
  }
  const deposits = (value as { deposits: unknown[] }).deposits;
  const instruments = (value as { instruments: unknown[] }).instruments;
  if (!deposits.every(validDepositStatus) || !instruments.every(validDepositInstrument) ||
      deposits.some((item) => item.folioId !== expectedFolioId || item.propertyNode !== propertyId)) {
    throw new Error("The server returned incoherent advance-deposit data.");
  }
  return value as HostedDepositWorkbench;
}
async function depositResponse(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as { detail?: string };
    const error = new Error(problem.detail ?? fallback);
    Object.assign(error, { status: response.status, uncertain: response.status >= 500 });
    throw error;
  }
  return response.json();
}
async function loadHostedDepositWorkbench(folioId: string): Promise<HostedDepositWorkbench> {
  const response = await fetch(`/api/v1/properties/${propertyId}/folios/${encodeURIComponent(folioId)}/hosted-deposits`, { headers: { authorization: `Bearer ${await session()}` } });
  return validateDepositWorkbench(await depositResponse(response, "Advance deposits are unavailable."), folioId);
}
async function loadHostedDepositStatus(requestId: string): Promise<HostedDepositStatus> {
  const response = await fetch(`/api/v1/properties/${propertyId}/hosted-deposits/${encodeURIComponent(requestId)}`, { headers: { authorization: `Bearer ${await session()}` } });
  const value = await depositResponse(response, "The hosted-deposit status is unavailable.");
  if (!validDepositStatus(value) || value.propertyNode !== propertyId || value.requestId !== requestId) throw new Error("The server returned an invalid hosted-deposit status.");
  return value;
}
async function createHostedDeposit(draft: DepositDraft, key: string): Promise<HostedDepositLink> {
  let response: Response;
  try { response = await fetch(`/api/v1/properties/${propertyId}/folios/${encodeURIComponent(draft.folioId)}/hosted-deposits`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await session()}`, "idempotency-key": key }, body: JSON.stringify({ instrumentId: draft.instrument?.instrumentId, amountMinor: draft.amountMinor }) }); }
  catch (cause) { const error = new Error("The deposit request response was interrupted. Yellow retained the exact request for reconciliation."); Object.assign(error, { cause, uncertain: true, status: 0 }); throw error; }
  let value: unknown;
  try { value = await depositResponse(response, "The deposit request was not accepted."); }
  catch (error) { if (!response.ok || housekeepingFailureIsUncertain(error)) throw error; const uncertain = new Error("The deposit receipt could not be verified. Yellow retained the exact request for reconciliation."); Object.assign(uncertain, { cause: error, uncertain: true, status: response.status }); throw uncertain; }
  if ((!exactObject(value, ["requestId", "operationId", "bearer", "expiresAt", "amountMinor", "currency", "generation", "replayed"]) &&
       !exactObject(value, ["requestId", "operationId", "expiresAt", "amountMinor", "currency", "generation", "replayed"])) ||
      typeof (value as Record<string, unknown>).requestId !== "string" || !UUID_VALUE.test((value as Record<string, unknown>).requestId as string) ||
      typeof (value as Record<string, unknown>).operationId !== "string" || !UUID_VALUE.test((value as Record<string, unknown>).operationId as string) ||
      !(((value as Record<string, unknown>).bearer === undefined) || typeof (value as Record<string, unknown>).bearer === "string") ||
      (value as Record<string, unknown>).amountMinor !== draft.amountMinor || (value as Record<string, unknown>).currency !== draft.currency ||
      typeof (value as Record<string, unknown>).expiresAt !== "string" || Number.isNaN(Date.parse((value as Record<string, unknown>).expiresAt as string)) ||
      typeof (value as Record<string, unknown>).generation !== "number" || !Number.isSafeInteger((value as Record<string, unknown>).generation) || (value as Record<string, unknown>).generation as number <= 0 ||
      typeof (value as Record<string, unknown>).replayed !== "boolean" || ((value as Record<string, unknown>).replayed === true && typeof (value as Record<string, unknown>).bearer === "string") || ((value as Record<string, unknown>).replayed === false && (typeof (value as Record<string, unknown>).bearer !== "string" || ((value as Record<string, unknown>).bearer as string).length === 0))) {
    const uncertain = new Error("The deposit receipt could not be verified. Yellow retained the exact request for reconciliation."); Object.assign(uncertain, { uncertain: true, status: response.status }); throw uncertain;
  }
  return value as HostedDepositLink;
}
async function applyHostedDeposit(draft: DepositDraft, key: string): Promise<DepositApplicationReceipt> {
  let response: Response;
  try { response = await fetch(`/api/v1/properties/${propertyId}/hosted-deposits/${encodeURIComponent(draft.requestSnapshot!.requestId)}/applications`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await session()}`, "idempotency-key": key }, body: JSON.stringify({ amountMinor: draft.amountMinor }) }); }
  catch (cause) { const error = new Error("The deposit application response was interrupted. Yellow retained the exact application for reconciliation."); Object.assign(error, { cause, uncertain: true, status: 0 }); throw error; }
  let value: unknown;
  try { value = await depositResponse(response, "The deposit application was not accepted."); }
  catch (error) { if (!response.ok || housekeepingFailureIsUncertain(error)) throw error; const uncertain = new Error("The application receipt could not be verified. Yellow retained the exact application for reconciliation."); Object.assign(uncertain, { cause: error, uncertain: true, status: response.status }); throw uncertain; }
  if (!exactObject(value, ["applicationId", "journalId", "hostedRequestId", "amountMinor", "currency", "replayed"]) ||
      !["applicationId", "journalId", "hostedRequestId"].every((keyName) => typeof (value as Record<string, unknown>)[keyName] === "string" && UUID_VALUE.test((value as Record<string, unknown>)[keyName] as string)) ||
      (value as Record<string, unknown>).hostedRequestId !== draft.requestSnapshot?.requestId || (value as Record<string, unknown>).amountMinor !== draft.amountMinor || (value as Record<string, unknown>).currency !== draft.currency || typeof (value as Record<string, unknown>).replayed !== "boolean") {
    const uncertain = new Error("The application receipt could not be verified. Yellow retained the exact application for reconciliation."); Object.assign(uncertain, { uncertain: true, status: response.status }); throw uncertain;
  }
  return value as DepositApplicationReceipt;
}
export const EXACT_MINOR = /^-?(?:0|[1-9][0-9]*)$/u;
function validateReceivableTarget(value: unknown): ReceivableTarget {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The server returned an invalid receivable target.");
  const target = value as Partial<ReceivableTarget>;
  if (!HOUSEKEEPING_UUID.test(target.accountId ?? "") ||
      !HOUSEKEEPING_UUID.test(target.partyId ?? "") ||
      (target.partyRole !== "company" && target.partyRole !== "agent") ||
      typeof target.name !== "string" || target.name.trim().length === 0 ||
      typeof target.currency !== "string" || !/^[A-Z]{3}$/u.test(target.currency) ||
      typeof target.creditLimitMinor !== "string" || !EXACT_MINOR.test(target.creditLimitMinor)) {
    throw new Error("The server returned an invalid receivable target.");
  }
  return target as ReceivableTarget;
}
function validateReceivablePreview(value: unknown, allowEmptyName = false): ReceivablePreview {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The server returned an invalid direct-billing preview.");
  const preview = value as Partial<ReceivablePreview>;
  if (!HOUSEKEEPING_UUID.test(preview.folioId ?? "") ||
      !HOUSEKEEPING_UUID.test(preview.receivableAccountId ?? "") ||
      !HOUSEKEEPING_UUID.test(preview.partyId ?? "") ||
      (preview.partyRole !== "company" && preview.partyRole !== "agent") ||
      typeof preview.name !== "string" || (!allowEmptyName && preview.name.trim().length === 0) ||
      typeof preview.currency !== "string" || !/^[A-Z]{3}$/u.test(preview.currency) ||
      typeof preview.amountMinor !== "string" || !EXACT_MINOR.test(preview.amountMinor) ||
      typeof preview.exposureMinor !== "string" || !EXACT_MINOR.test(preview.exposureMinor) ||
      (preview.creditLimitMinor !== null &&
        (typeof preview.creditLimitMinor !== "string" || !EXACT_MINOR.test(preview.creditLimitMinor))) ||
      typeof preview.projectedExposureMinor !== "string" || !EXACT_MINOR.test(preview.projectedExposureMinor) ||
      typeof preview.requiresApproval !== "boolean") {
    throw new Error("The server returned an invalid direct-billing preview.");
  }
  return preview as ReceivablePreview;
}
function sameReceivablePreview(left: ReceivablePreview, right: ReceivablePreview): boolean {
  return left.folioId === right.folioId &&
    left.receivableAccountId === right.receivableAccountId &&
    left.partyId === right.partyId && left.partyRole === right.partyRole &&
    left.name === right.name && left.currency === right.currency &&
    left.amountMinor === right.amountMinor && left.exposureMinor === right.exposureMinor &&
    left.creditLimitMinor === right.creditLimitMinor &&
    left.projectedExposureMinor === right.projectedExposureMinor &&
    left.requiresApproval === right.requiresApproval;
}
async function receivableResponse(response: Response, fallback: string): Promise<unknown> {
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    const error = new Error(problem.detail ?? fallback);
    Object.assign(error, { status: response.status, uncertain: response.status >= 500 });
    throw error;
  }
  return response.json();
}
async function loadReceivableTargets(): Promise<readonly ReceivableTarget[]> {
  const response = await fetch(
    `/api/operator/properties/${propertyId}/receivable-transfers/targets`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  const result = await receivableResponse(response, "Direct-billing targets are unavailable.");
  if (!result || typeof result !== "object" || Array.isArray(result) ||
      !Array.isArray((result as { targets?: unknown }).targets)) {
    throw new Error("The server returned an invalid direct-billing target list.");
  }
  return (result as { targets: unknown[] }).targets.map(validateReceivableTarget);
}
async function previewReceivableTransfer(
  folioId: string,
  receivableAccountId: string,
): Promise<ReceivablePreview> {
  const response = await fetch(
    `/api/operator/properties/${propertyId}/folios/${folioId}/receivable-transfers:preview`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${await session()}` },
      body: JSON.stringify({ receivableAccountId }),
    },
  );
  return validateReceivablePreview(await receivableResponse(response, "The direct-billing preview is unavailable."));
}
async function requestReceivableApproval(
  folioId: string,
  receivableAccountId: string,
  idempotencyKey: string,
): Promise<ReceivableApprovalReceipt> {
  let response: Response;
  try {
    response = await fetch(
      `/api/operator/properties/${propertyId}/folios/${folioId}/receivable-transfers/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ receivableAccountId }),
      },
    );
  } catch (cause) {
    const error = new Error("The approval response was interrupted. Yellow retained the exact request for reconciliation.");
    Object.assign(error, { cause, uncertain: true, status: 0 });
    throw error;
  }
  let result: unknown;
  try {
    result = await receivableResponse(response, "The direct-billing approval request was not accepted.");
  } catch (cause) {
    if (!response.ok || housekeepingFailureIsUncertain(cause)) throw cause;
    const error = new Error("The approval receipt could not be verified. Yellow retained the exact request for reconciliation.");
    Object.assign(error, { cause, uncertain: true, status: response.status });
    throw error;
  }
  try {
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error("The server returned an invalid approval receipt.");
    const receipt = result as Partial<ReceivableApprovalReceipt>;
    if (!HOUSEKEEPING_UUID.test(receipt.approvalId ?? "") || receipt.folioId !== folioId ||
        receipt.receivableAccountId !== receivableAccountId || receipt.status !== "pending" ||
        !HOUSEKEEPING_UUID.test(receipt.partyId ?? "") ||
        (receipt.partyRole !== "company" && receipt.partyRole !== "agent") ||
        typeof receipt.name !== "string" || receipt.name.trim().length === 0 ||
        typeof receipt.currency !== "string" || !/^[A-Z]{3}$/u.test(receipt.currency) ||
        typeof receipt.amountMinor !== "string" || !EXACT_MINOR.test(receipt.amountMinor) ||
        typeof receipt.exposureMinor !== "string" || !EXACT_MINOR.test(receipt.exposureMinor) ||
        (receipt.creditLimitMinor !== null &&
          (typeof receipt.creditLimitMinor !== "string" || !EXACT_MINOR.test(receipt.creditLimitMinor))) ||
        typeof receipt.projectedExposureMinor !== "string" || !EXACT_MINOR.test(receipt.projectedExposureMinor) ||
        typeof receipt.replayed !== "boolean") {
      throw new Error("The server returned an invalid approval receipt.");
    }
    return receipt as ReceivableApprovalReceipt;
  } catch (cause) {
    const error = new Error("The approval receipt could not be verified. Yellow retained the exact request for reconciliation.");
    Object.assign(error, { cause, uncertain: true, status: response.status });
    throw error;
  }
}
async function submitReceivableTransfer(
  folioId: string,
  input: Readonly<{ receivableAccountId: string; reason: string; approvalId?: string }>,
  idempotencyKey: string,
  expected: ReceivablePreview,
): Promise<ReceivableTransferReceipt> {
  let response: Response;
  try {
    response = await fetch(
      `/api/operator/properties/${propertyId}/folios/${folioId}/receivable-transfers`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(input),
      },
    );
  } catch (cause) {
    const error = new Error("The transfer response was interrupted. Retry the unchanged proposal to keep the same operation key.");
    Object.assign(error, { cause, uncertain: true, status: 0 });
    throw error;
  }
  let value: unknown;
  try {
    value = await receivableResponse(response, "The direct-billing transfer was not accepted.");
  } catch (cause) {
    if (!response.ok || housekeepingFailureIsUncertain(cause)) throw cause;
    const error = new Error("The direct-billing receipt could not be verified. Yellow retained the exact request for reconciliation.");
    Object.assign(error, { cause, uncertain: true, status: response.status });
    throw error;
  }
  try {
    const preview = validateReceivablePreview(value, true);
    const receipt = value as Partial<ReceivableTransferReceipt>;
    if (preview.folioId !== folioId || preview.receivableAccountId !== input.receivableAccountId ||
        preview.partyId !== expected.partyId || preview.partyRole !== expected.partyRole ||
        preview.currency !== expected.currency || preview.amountMinor !== expected.amountMinor ||
        preview.exposureMinor !== expected.exposureMinor || preview.creditLimitMinor !== expected.creditLimitMinor ||
        preview.projectedExposureMinor !== expected.projectedExposureMinor ||
        preview.requiresApproval !== expected.requiresApproval ||
        !HOUSEKEEPING_UUID.test(receipt.journalId ?? "") ||
        (receipt.approvalId !== null && receipt.approvalId !== undefined && !HOUSEKEEPING_UUID.test(receipt.approvalId)) ||
        typeof receipt.replayed !== "boolean") {
      throw new Error("The receipt does not match the confirmed direct-billing proposal.");
    }
    return value as ReceivableTransferReceipt;
  } catch (cause) {
    const error = new Error("The direct-billing receipt could not be verified. Yellow retained the exact request for reconciliation.");
    Object.assign(error, { cause, uncertain: true, status: response.status });
    throw error;
  }
}
const FOLIO_CHARGE_RECEIPT_KEYS = [
  "amountMinor", "businessDate", "currency", "folioId", "journalId", "quantity", "replayed", "txCode",
] as const;
function validateFolioChargeReceipt(value: unknown): FolioChargeReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, FOLIO_CHARGE_RECEIPT_KEYS)) {
    throw new FolioChargeRequestError(
      "The server returned an incoherent success response. Yellow retained the exact request for reconciliation.",
      true,
    );
  }
  const receipt = value as Partial<FolioChargeReceipt>;
  if (typeof receipt.journalId !== "string" || !HOUSEKEEPING_UUID.test(receipt.journalId) ||
      typeof receipt.folioId !== "string" || !HOUSEKEEPING_UUID.test(receipt.folioId) ||
      typeof receipt.businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(receipt.businessDate) ||
      typeof receipt.currency !== "string" || !/^[A-Z]{3}$/u.test(receipt.currency) ||
      typeof receipt.txCode !== "string" || !/^[A-Z0-9_]{1,64}$/u.test(receipt.txCode) ||
      typeof receipt.amountMinor !== "string" || !/^[1-9][0-9]{0,18}$/u.test(receipt.amountMinor) ||
      typeof receipt.quantity !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,3})?$/u.test(receipt.quantity) ||
      !/[1-9]/u.test(receipt.quantity) || typeof receipt.replayed !== "boolean") {
    throw new FolioChargeRequestError(
      "The server returned an incoherent success response. Yellow retained the exact request for reconciliation.",
      true,
    );
  }
  return receipt as FolioChargeReceipt;
}
class FolioChargeRequestError extends Error {
  readonly uncertain: boolean;

  constructor(message: string, uncertain: boolean) {
    super(message);
    this.name = "FolioChargeRequestError";
    this.uncertain = uncertain;
  }
}
async function postFolioCharge(
  folioId: string,
  input: Readonly<{ txCode: string; amountMinor: string; quantity?: string }>,
  idempotencyKey: string,
): Promise<FolioChargeReceipt> {
  const body: { txCode: string; amountMinor: string; quantity?: string } = {
    txCode: input.txCode,
    amountMinor: input.amountMinor,
  };
  if (input.quantity) body.quantity = input.quantity;
  let r: Response;
  try {
    r = await fetch(
      `/api/v1/properties/${propertyId}/folios/${folioId}/charges`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new FolioChargeRequestError(
      "The posting response was interrupted. Yellow can safely reconcile this unchanged proposal.",
      true,
    );
  }
  if (!r.ok) {
    const result = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new FolioChargeRequestError(
      result.detail ?? "The server did not accept this charge.",
      r.status >= 500,
    );
  }
  try {
    return validateFolioChargeReceipt(await r.json() as unknown);
  } catch {
    throw new FolioChargeRequestError(
      "The server returned an unreadable success response. Yellow retained the exact request for reconciliation.",
      true,
    );
  }
}

const FOLIO_TRANSFER_PREVIEW_KEYS = [
  "currency", "destinationAfterMinor", "destinationBeforeMinor", "destinationFolioId",
  "destinationName", "destinationWindowNo", "generation", "memberEffects", "previewRevision",
  "sourceAfterMinor", "sourceBeforeMinor", "sourceFolioId", "stayTotalMinor",
  "unchangedStayTotalMinor",
] as const;
const FOLIO_TRANSFER_RECEIPT_KEYS = [
  "businessDate", "currency", "destinationAfterMinor", "destinationBeforeMinor",
  "destinationFolioId", "destinationName", "destinationWindowNo", "generation",
  "journalId", "memberEffects", "previewRevision", "replayed", "sourceAfterMinor",
  "sourceBeforeMinor", "sourceFolioId", "stayTotalMinor", "unchangedStayTotalMinor",
] as const;

class FolioTransferRequestError extends Error {
  readonly uncertain: boolean;

  constructor(message: string, uncertain: boolean) {
    super(message);
    this.name = "FolioTransferRequestError";
    this.uncertain = uncertain;
  }
}

function isExactTransferMinor(value: unknown): value is string {
  return typeof value === "string" && EXACT_MINOR.test(value);
}

function validateFolioTransferEffect(value: unknown): FolioTransferMemberEffect {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, ["amountMinor", "description", "destinationEffectMinor", "groupId", "quantity", "rootLineId", "sourceEffectMinor", "txCode"])) {
    throw new FolioTransferRequestError("The transfer result is malformed. Yellow retained the exact operation for reconciliation.", true);
  }
  const effect = value as Partial<FolioTransferMemberEffect>;
  if (!HOUSEKEEPING_UUID.test(effect.rootLineId ?? "") || !HOUSEKEEPING_UUID.test(effect.groupId ?? "") ||
      !isExactTransferMinor(effect.amountMinor) || !isExactTransferMinor(effect.sourceEffectMinor) ||
      !isExactTransferMinor(effect.destinationEffectMinor) || typeof effect.txCode !== "string" ||
      !/^[A-Z0-9_]{1,64}$/u.test(effect.txCode) ||
      (effect.description !== null && typeof effect.description !== "string") ||
      typeof effect.quantity !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,3})?$/u.test(effect.quantity)) {
    throw new FolioTransferRequestError("The transfer result is malformed. Yellow retained the exact operation for reconciliation.", true);
  }
  return effect as FolioTransferMemberEffect;
}

function validateFolioTransferPreview(value: unknown): FolioTransferPreview {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, FOLIO_TRANSFER_PREVIEW_KEYS)) {
    throw new FolioTransferRequestError("The server returned an incoherent transfer preview.", false);
  }
  const preview = value as Partial<FolioTransferPreview>;
  if (!HOUSEKEEPING_UUID.test(preview.sourceFolioId ?? "") ||
      (preview.destinationFolioId !== null && !HOUSEKEEPING_UUID.test(preview.destinationFolioId ?? "")) ||
      (preview.destinationName !== null && (typeof preview.destinationName !== "string" || preview.destinationName.trim().length === 0)) ||
      typeof preview.destinationWindowNo !== "number" || !Number.isSafeInteger(preview.destinationWindowNo) || preview.destinationWindowNo < 1 ||
      typeof preview.currency !== "string" || !/^[A-Z]{3}$/u.test(preview.currency) ||
      !isExactTransferMinor(preview.sourceBeforeMinor) || !isExactTransferMinor(preview.sourceAfterMinor) ||
      !isExactTransferMinor(preview.destinationBeforeMinor) || !isExactTransferMinor(preview.destinationAfterMinor) ||
      !isExactTransferMinor(preview.stayTotalMinor) || preview.unchangedStayTotalMinor !== preview.stayTotalMinor ||
      typeof preview.generation !== "string" || !/^[\x21-\x7e]{1,512}$/u.test(preview.generation) ||
      typeof preview.previewRevision !== "string" || !/^[\x21-\x7e]{1,512}$/u.test(preview.previewRevision) ||
      !Array.isArray(preview.memberEffects) || preview.memberEffects.length < 1 || preview.memberEffects.length > 100) {
    throw new FolioTransferRequestError("The server returned an incoherent transfer preview.", false);
  }
  const memberEffects = preview.memberEffects.map(validateFolioTransferEffect);
  if (new Set(memberEffects.map((effect) => effect.rootLineId)).size !== memberEffects.length) {
    throw new FolioTransferRequestError("The transfer preview repeats a member effect.", false);
  }
  return Object.freeze({ ...preview, memberEffects: Object.freeze(memberEffects) }) as FolioTransferPreview;
}

export function validateFolioTransferReceipt(value: unknown): FolioTransferReceipt {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        !hasExactKeys(value, FOLIO_TRANSFER_RECEIPT_KEYS)) {
      throw new Error("The transfer success response did not have the canonical receipt shape.");
    }
    const receipt = value as Partial<FolioTransferReceipt>;
    const preview = validateFolioTransferPreview(Object.fromEntries(
      FOLIO_TRANSFER_PREVIEW_KEYS.map((key) => [key, receipt[key]]),
    ));
    const journalId = receipt.journalId;
    const businessDate = receipt.businessDate;
    const replayed = receipt.replayed;
    if (typeof journalId !== "string" || !HOUSEKEEPING_UUID.test(journalId) ||
        typeof businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(businessDate) ||
        typeof replayed !== "boolean") {
      throw new Error("The transfer success response did not contain a canonical receipt.");
    }
    return Object.freeze({ ...preview, journalId, businessDate, replayed });
  } catch {
    throw new FolioTransferRequestError("The transfer success response could not be verified. Yellow retained the exact operation for reconciliation.", true);
  }
}

function sameTransferPreview(left: FolioTransferPreview, right: FolioTransferPreview): boolean {
  return left.sourceFolioId === right.sourceFolioId &&
    left.destinationFolioId === right.destinationFolioId &&
    left.destinationName === right.destinationName &&
    left.destinationWindowNo === right.destinationWindowNo &&
    left.currency === right.currency &&
    left.sourceBeforeMinor === right.sourceBeforeMinor && left.sourceAfterMinor === right.sourceAfterMinor &&
    left.destinationBeforeMinor === right.destinationBeforeMinor && left.destinationAfterMinor === right.destinationAfterMinor &&
    left.stayTotalMinor === right.stayTotalMinor && left.unchangedStayTotalMinor === right.unchangedStayTotalMinor &&
    left.generation === right.generation && left.previewRevision === right.previewRevision &&
    left.memberEffects.length === right.memberEffects.length &&
    left.memberEffects.every((effect, index) => JSON.stringify(effect) === JSON.stringify(right.memberEffects[index]));
}

function transferReasonIsValid(value: string): boolean {
  return value.length >= 1 && value.length <= 500 && value.trim() === value &&
    !/[\x00-\x1f\x7f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(value);
}

function transferWindowNameIsValid(value: string): boolean {
  return value.length >= 1 && value.length <= 80 && value.trim() === value &&
    !/[\x00-\x1f\x7f]/u.test(value);
}

export function previewMatchesFolioTransferDraft(
  preview: FolioTransferPreview,
  draft: FolioTransferDraft,
  sourceCurrency: string,
  existingDestinationName: string | null,
): boolean {
  const returnedGroups = [...new Set(preview.memberEffects.map((effect) => effect.groupId))].sort();
  const expectedDestinationName = draft.destinationFolioId === null
    ? draft.newWindowName
    : existingDestinationName;
  return preview.sourceFolioId === draft.sourceFolioId &&
    preview.generation === draft.generation &&
    preview.currency === sourceCurrency &&
    preview.destinationFolioId === draft.destinationFolioId &&
    preview.destinationName === expectedDestinationName &&
    returnedGroups.length === draft.groupIds.length &&
    !returnedGroups.some((groupId, index) => groupId !== draft.groupIds[index]);
}

function voiceTransferText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/gu, " ");
}

function resolveVoiceTransferGroup(
  statement: FolioStatement,
  chargeQuery: string,
): Readonly<{ kind: "resolved"; group: FolioTransferGroup; label: string }> | Readonly<{ kind: "ambiguous" | "not_found" }> {
  const wanted = voiceTransferText(chargeQuery);
  const matches = new Map<string, Readonly<{ group: FolioTransferGroup; label: string }>>();
  for (const row of statement.rows) {
    const group = row.transferGroup;
    if (!group.eligible || group.currentWindowId !== statement.folio.id) continue;
    if (voiceTransferText(row.description ?? "") !== wanted && voiceTransferText(row.txCode) !== wanted) continue;
    matches.set(group.id, { group, label: row.description ?? row.txCode });
  }
  if (matches.size === 1) {
    const match = [...matches.values()][0]!;
    return Object.freeze({ kind: "resolved", group: match.group, label: match.label });
  }
  return Object.freeze({ kind: matches.size > 1 ? "ambiguous" : "not_found" });
}

type VoiceTransferSourceResolution =
  | Readonly<{
      kind: "resolved";
      statement: FolioStatement;
      group: FolioTransferGroup;
      label: string;
      destinationWindow: FolioStatement["siblingWindows"][number] | null;
    }>
  | Readonly<{ kind: "ambiguous" | "not_found" }>;

export function resolveVoiceTransferSource(
  statements: readonly FolioStatement[],
  chargeQuery: string,
  destination: FolioBillWindowTransferIntent["destination"],
): VoiceTransferSourceResolution {
  const candidates: Extract<VoiceTransferSourceResolution, { kind: "resolved" }>[] = [];
  for (const statement of statements) {
    if (statement.folio.status !== "open") continue;
    const groupResolution = resolveVoiceTransferGroup(statement, chargeQuery);
    // A complete group must be globally unique across the live open-folio
    // family.  Do not skip an ambiguous window and silently select another
    // otherwise matching group in a sibling window.
    if (groupResolution.kind === "ambiguous") return Object.freeze({ kind: "ambiguous" });
    if (groupResolution.kind !== "resolved") continue;
    candidates.push(Object.freeze({
      kind: "resolved",
      statement,
      group: groupResolution.group,
      label: groupResolution.label,
      destinationWindow: null,
    }));
  }
  if (candidates.length !== 1) {
    return Object.freeze({ kind: candidates.length > 1 ? "ambiguous" : "not_found" });
  }
  const candidate = candidates[0]!;
  const destinations = destination.kind === "existing"
    ? candidate.statement.siblingWindows.filter((window) =>
      window.windowNo === destination.windowNo && window.status === "open" && window.id !== candidate.statement.folio.id,
    )
    : [];
  if (destination.kind === "existing" && destinations.length !== 1) {
    return Object.freeze({ kind: destinations.length > 1 ? "ambiguous" : "not_found" });
  }
  return Object.freeze({
    ...candidate,
    destinationWindow: destinations[0] ?? null,
  });
}

function receiptMatchesVoiceTransfer(
  receipt: FolioTransferReceipt,
  proposal: VoiceBillWindowTransferProposal,
): boolean {
  const expected = proposal.preview;
  return receipt.sourceFolioId === expected.sourceFolioId &&
    (expected.destinationFolioId === null || receipt.destinationFolioId === expected.destinationFolioId) &&
    receipt.destinationFolioId !== null && receipt.destinationName === expected.destinationName &&
    receipt.destinationWindowNo === expected.destinationWindowNo && receipt.currency === expected.currency &&
    receipt.sourceBeforeMinor === expected.sourceBeforeMinor && receipt.sourceAfterMinor === expected.sourceAfterMinor &&
    receipt.destinationBeforeMinor === expected.destinationBeforeMinor && receipt.destinationAfterMinor === expected.destinationAfterMinor &&
    receipt.stayTotalMinor === expected.stayTotalMinor && receipt.unchangedStayTotalMinor === expected.unchangedStayTotalMinor &&
    receipt.generation === expected.generation && receipt.previewRevision === expected.previewRevision &&
    receipt.memberEffects.length === expected.memberEffects.length &&
    receipt.memberEffects.every((effect, index) => JSON.stringify(effect) === JSON.stringify(expected.memberEffects[index]));
}

async function requestFolioTransferPreview(draft: FolioTransferDraft): Promise<FolioTransferPreview> {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/properties/${propertyId}/folios/${draft.sourceFolioId}/transfers:preview`,
      { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await session()}` }, body: JSON.stringify(draft) },
    );
  } catch {
    throw new FolioTransferRequestError("The transfer preview could not be reached. Nothing was posted.", false);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new FolioTransferRequestError(problem.detail ?? "The transfer preview was not accepted.", false);
  }
  try {
    return validateFolioTransferPreview(await response.json() as unknown);
  } catch (error) {
    if (error instanceof FolioTransferRequestError) throw error;
    throw new FolioTransferRequestError("The transfer preview could not be read. Nothing was posted.", false);
  }
}

export async function submitFolioTransfer(draft: FolioTransferDraft, idempotencyKey: string): Promise<FolioTransferReceipt> {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/properties/${propertyId}/folios/${draft.sourceFolioId}/transfers`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await session()}`, "idempotency-key": idempotencyKey },
        body: JSON.stringify(draft),
      },
    );
  } catch {
    throw new FolioTransferRequestError("The transfer response was interrupted. Yellow retained this exact operation for same-key reconciliation.", true);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new FolioTransferRequestError(problem.detail ?? "The transfer was not accepted.", response.status >= 500);
  }
  try {
    return validateFolioTransferReceipt(await response.json() as unknown);
  } catch (error) {
    if (error instanceof FolioTransferRequestError) throw error;
    throw new FolioTransferRequestError("The transfer response could not be verified. Yellow retained this exact operation for same-key reconciliation.", true);
  }
}
function wakeReply(language: VoiceLanguage): string {
  if (language === "Marathi") return "मी इथे आहे. मराठीत पुढे जाऊ का? हवे असल्यास हिंदी किंवा इंग्रजीतही बोला. आजची arrivals, reservations, guests, housekeeping, rates किंवा cashier बद्दल विचारा.";
  if (language === "Hindi") return "मैं यहाँ हूँ। हिंदी में आगे बढ़ें, या अंग्रेज़ी में? आज की arrivals, reservations, guests, housekeeping, rates या cashier के बारे में पूछिए।";
  if (language === "Kannada") return "ನಾನು ಇಲ್ಲಿದ್ದೇನೆ. ಕನ್ನಡದಲ್ಲಿ ಮುಂದುವರೆಯೋಣವೇ? ಬೇಕಾದರೆ ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಹಿಂದಿಯಲ್ಲಿಯೂ ಮಾತನಾಡಿ. ಇಂದಿನ arrivals, reservations, guests, housekeeping, rates ಅಥವಾ cashier ಬಗ್ಗೆ ಕೇಳಿ.";
  if (language === "Telugu") return "నేను ఇక్కడ ఉన్నాను. తెలుగులో కొనసాగుదామా? కావాలంటే ఇంగ్లీష్ లేదా హిందీలో కూడా మాట్లాడండి. ఈరోజు arrivals, reservations, guests, housekeeping, rates లేదా cashier గురించి అడగండి.";
  const suggestedLanguage = browserLanguageSuggestion();
  const preferenceQuestion = suggestedLanguage
    ? ` Would you prefer ${suggestedLanguage}?`
    : " If you prefer Hindi, Marathi, Kannada, or Telugu, just tell me naturally.";
  return `I’m here. I’ll speak in Indian English.${preferenceQuestion} Ask about today’s arrivals, reservations, guests, housekeeping, rates, or cashier.`;
}

function guestHistoryReply(language: VoiceLanguage, name: string): string {
  if (language === "Hindi") return `${name} की सही गेस्ट प्रोफ़ाइल और स्टे हिस्ट्री नीचे दिखा रहा हूँ।`;
  if (language === "Marathi") return `${name} यांचे योग्य गेस्ट प्रोफाइल आणि स्टे हिस्ट्री खाली दाखवत आहे.`;
  if (language === "Kannada") return `${name} ಅವರ ಸರಿಯಾದ ಅತಿಥಿ ಪ್ರೊಫೈಲ್ ಮತ್ತು ವಾಸ್ತವ್ಯದ ಇತಿಹಾಸವನ್ನು ಕೆಳಗೆ ತೋರಿಸುತ್ತಿದ್ದೇನೆ.`;
  if (language === "Telugu") return `${name} యొక్క సరైన అతిథి ప్రొఫైల్ మరియు బస చరిత్రను క్రింద చూపిస్తున్నాను.`;
  return `Showing ${name}’s exact guest profile and factual stay history below.`;
}
async function loadReservation(
  reservationId: string,
): Promise<ReservationDetail> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("Reservation details are unavailable.");
  const value = await r.json() as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !hasExactKeys(value, ["actions", "reservation"])) {
    throw new Error("Reservation details are incoherent.");
  }
  const detail = value as { reservation?: unknown; actions?: unknown };
  if (!detail.reservation || typeof detail.reservation !== "object" || Array.isArray(detail.reservation)) {
    throw new Error("Reservation details are incoherent.");
  }
  return Object.freeze({
    reservation: detail.reservation,
    actions: validateReservationActions(detail.actions),
  }) as ReservationDetail;
}
async function loadCheckInReadiness(
  reservationId: string,
): Promise<CheckInReadiness> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/check-in/readiness`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("Arrival readiness is unavailable.");
  return r.json() as Promise<CheckInReadiness>;
}
async function loadCheckoutReadiness(
  reservationId: string,
): Promise<CheckoutReadiness> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/checkout-readiness`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("Departure readiness is unavailable.");
  return r.json() as Promise<CheckoutReadiness>;
}

async function loadDepartureServices(reservationId: string): Promise<DepartureServiceOverview> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/departure-services`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("Departure service coordination is unavailable.");
  return r.json() as Promise<DepartureServiceOverview>;
}

async function loadDepartureServiceQueue(): Promise<Readonly<{ requests: readonly DepartureServiceRequest[] }>> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/departure-services`,
    { headers: { authorization: `Bearer ${await session()}` } },
  );
  if (!r.ok) throw new Error("Departure service queue is unavailable.");
  return r.json() as Promise<Readonly<{ requests: readonly DepartureServiceRequest[] }>>;
}

export type DepartureServiceProposalInput = Readonly<{
  serviceKind: DepartureServiceKind;
  targetRoleId: string | null;
  schedule: DepartureServiceTiming;
  expected: Readonly<{ segmentId: string; spaceId: string; departureAt: string }>;
  parentRequestId: string | null;
}>;

async function createDepartureServiceProposal(
  reservationId: string,
  input: DepartureServiceProposalInput,
  idempotencyKey: string,
): Promise<Readonly<{ request: DepartureServiceRequest; replayed: boolean }>> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/departure-services/proposals`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
  );
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? "The departure service proposal was not accepted.");
  }
  return r.json() as Promise<Readonly<{ request: DepartureServiceRequest; replayed: boolean }>>;
}

export type DepartureServiceAction = "confirm" | "withdraw" | "assign" | "start" | "complete";
export type DepartureServiceActionInput = Readonly<{
  expectedVersion: number;
  staffPartyId: string | null;
  outcome: "clear" | "finding_reported" | "unable_to_complete" | null;
}>;

async function transitionDepartureService(
  requestId: string,
  action: DepartureServiceAction,
  input: DepartureServiceActionInput,
  idempotencyKey: string,
): Promise<Readonly<{ request: DepartureServiceRequest; replayed: boolean }>> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/departure-services/${requestId}/${action}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
  );
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? "The departure service action was not accepted.");
  }
  return r.json() as Promise<Readonly<{ request: DepartureServiceRequest; replayed: boolean }>>;
}
async function commitCheckIn(
  reservationId: string,
  idempotencyKey = `yellow-public-demo-${crypto.randomUUID()}`,
): Promise<void> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/check-in`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": idempotencyKey,
      },
      body: "{}",
    },
  );
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? "The server did not accept this check-in.");
  }
}
export class PrimaryFolioRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean) {
    super(message);
    this.name = "PrimaryFolioRequestError";
  }
}
export class GovernedCheckoutRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean) {
    super(message);
    this.name = "GovernedCheckoutRequestError";
  }
}
async function openPrimaryFolio(
  reservationId: string,
  idempotencyKey: string,
): Promise<void> {
  let r: Response;
  try {
    r = await fetch(
      `/api/v1/properties/${propertyId}/reservations/${reservationId}/primary-folio`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: "{}",
      },
    );
  } catch {
    throw new PrimaryFolioRequestError("The primary billing-window response was interrupted. Yellow retained the same operation for reconciliation.", true);
  }
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new PrimaryFolioRequestError(body.detail ?? "The server did not open the primary folio.", r.status >= 500);
  }
}
async function loadDueInRoomCandidates(
  reservationId: string,
): Promise<DueInRoomCandidateResult> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/due-in-room-assignment/candidates`,
    {
      cache: "no-store",
      headers: { authorization: `Bearer ${await session()}` },
    },
  );
  if (!r.ok) throw new Error("Current eligible rooms are unavailable.");
  return r.json() as Promise<DueInRoomCandidateResult>;
}
async function assignDueInRoom(
  reservationId: string,
  input: DueInRoomAssignmentInput,
  idempotencyKey: string,
): Promise<void> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/due-in-room-assignment`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
  );
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? "The server did not assign this room.");
  }
}
async function loadArrivalCleaningCandidate(
  reservationId: string,
): Promise<ArrivalCleaningCandidateResult> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/arrival-room-cleaning-task/candidate`,
    {
      cache: "no-store",
      headers: { authorization: `Bearer ${await session()}` },
    },
  );
  if (!r.ok) throw await reservationApiError(r, "The arrival cleaning-task candidate is unavailable.");
  return r.json() as Promise<ArrivalCleaningCandidateResult>;
}
async function createArrivalCleaningTask(
  reservationId: string,
  attendantPartyId: string,
  idempotencyKey: string,
): Promise<ArrivalCleaningTaskResult> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/arrival-room-cleaning-task`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ attendantPartyId }),
    },
  );
  if (!r.ok) throw await reservationApiError(r, "The governed arrival cleaning task was not created.");
  return r.json() as Promise<ArrivalCleaningTaskResult>;
}
async function transitionFolioStatus(
  folioId: string,
  action: "settle" | "close",
  idempotencyKey: string,
): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`/api/v1/properties/${propertyId}/folios/${folioId}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
      },
      body: JSON.stringify({ action, idempotencyKey }),
    });
  } catch {
    throw new GovernedCheckoutRequestError(
      "The folio-status response was interrupted. Yellow retained this exact operation for verification and safe retry.",
      true,
    );
  }
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new GovernedCheckoutRequestError(
      body.detail ?? "The server did not accept this folio-status transition.",
      r.status >= 500,
    );
  }
}
async function commitCheckout(reservationId: string, idempotencyKey: string): Promise<void> {
  let r: Response;
  try {
    r = await fetch(
      `/api/v1/properties/${propertyId}/reservations/${reservationId}/checkout`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: "{}",
      },
    );
  } catch {
    throw new GovernedCheckoutRequestError(
      "The checkout response was interrupted. Yellow retained this exact departure operation for verification and safe retry.",
      true,
    );
  }
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new GovernedCheckoutRequestError(
      body.detail ?? "The server did not accept this checkout.",
      r.status >= 500,
    );
  }
}
async function cancelReservationLifecycle(
  reservationId: string,
  reason: string,
  idempotencyKey: string,
): Promise<CancelReservationReceipt> {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/properties/${propertyId}/reservations/${reservationId}/cancel`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ reason }),
      },
    );
  } catch {
    throw new ReservationLifecycleRequestError(
      "The cancellation response was interrupted. Yellow retained this exact request for same-key reconciliation.",
      true,
    );
  }
  if (!response.ok) {
    const error = await reservationApiError(response, "The server did not accept this cancellation.");
    throw new ReservationLifecycleRequestError(error.message, response.status >= 500, response.status);
  }
  try {
    return validateCancelReservationReceipt(
      await response.json() as unknown,
      reservationId,
      response.headers.get("idempotency-replayed"),
    );
  } catch {
    throw new ReservationLifecycleRequestError(
      "The cancellation response could not be verified. Yellow retained this exact request for same-key reconciliation.",
      true,
    );
  }
}
async function reinstateReservationLifecycle(
  reservationId: string,
  idempotencyKey: string,
): Promise<ReinstateReservationReceipt> {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/properties/${propertyId}/reservations/${reservationId}/reinstate`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: "{}",
      },
    );
  } catch {
    throw new ReservationLifecycleRequestError(
      "The reinstatement response was interrupted. Yellow retained this exact request for same-key reconciliation.",
      true,
    );
  }
  if (!response.ok) {
    const error = await reservationApiError(response, "The server did not accept this reinstatement.");
    throw new ReservationLifecycleRequestError(error.message, response.status >= 500, response.status);
  }
  try {
    return validateReinstateReservationReceipt(
      await response.json() as unknown,
      reservationId,
      response.headers.get("idempotency-replayed"),
    );
  } catch {
    throw new ReservationLifecycleRequestError(
      "The reinstatement response could not be verified. Yellow retained this exact request for same-key reconciliation.",
      true,
    );
  }
}
type ReservationOperationalFields = Readonly<{
  notes: string;
  eta: string;
  etd: string;
  marketCode: string;
  sourceCode: string;
  originCode: string;
}>;
function normalizeReservationOperationalValue(
  field: keyof ReservationOperationalFields,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (field !== "eta" && field !== "etd") return trimmed;
  const match = /^(\d{2}:\d{2}:\d{2})(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(trimmed);
  if (!match || match[1] === undefined || match[2] === undefined) return trimmed;
  if (match[2] === "Z") return `${match[1]}+00:00`;
  const sign = match[2][0];
  const digits = match[2].slice(1).replace(":", "");
  return `${match[1]}${sign}${digits.slice(0, 2)}:${digits.length === 2 ? "00" : digits.slice(2, 4)}`;
}
async function modifyReservationOperationalDetails(
  reservationId: string,
  expected: ReservationMutableFields,
  changes: ReservationMutableFields,
  idempotencyKey: string,
): Promise<ReservationLifecycleMutationResult> {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/properties/${propertyId}/reservations/${reservationId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${await session()}`,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ expected, changes }),
      },
    );
  } catch {
    throw new ReservationCommandRequestError(
      "The edit response was interrupted. Yellow retained this exact edit for same-key reconciliation.",
      true,
    );
  }
  if (!response.ok) {
    const error = await reservationApiError(response, "The server did not accept these operational details.");
    throw new ReservationCommandRequestError(error.message, response.status >= 500, response.status);
  }
  try {
    const payload = await response.json() as { reservation?: Omit<ReservationLifecycleMutationResult, "replayed"> };
    const reservation = payload.reservation;
    if (!reservation || reservation.reservationId !== reservationId || typeof reservation.diff !== "object")
      throw new Error("invalid receipt");
    return Object.freeze({
      ...reservation,
      replayed: response.headers.get("idempotency-replayed") === "true",
    });
  } catch {
    throw new ReservationCommandRequestError(
      "The edit response could not be verified. Yellow retained this exact edit for same-key reconciliation.",
      true,
    );
  }
}
function parseGuestShareBasisPoints(value: string): number | null {
  if (!/^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d?\.\d{2}|100\.00)$/.test(value))
    return null;
  const [whole = "0", fraction = "0"] = value.split(".");
  return Number(whole) * 100 + Number(fraction);
}
function reservationGuestAllocationsMatch(
  detail: ReservationDetail | undefined,
  proposed: ReservationGuestReplacement,
): boolean {
  if (!detail) return false;
  const canonical = detail.reservation.guests
    .map((guest) => ({ partyId: guest.partyId, role: guest.role, sharePct: guest.sharePct }))
    .sort((left, right) => `${left.role}:${left.partyId}`.localeCompare(`${right.role}:${right.partyId}`));
  const desired = [
    {
      partyId: detail.reservation.primaryPartyId,
      role: "primary",
      sharePct: proposed.primarySharePct,
    },
    ...proposed.guests,
  ].sort((left, right) => `${left.role}:${left.partyId}`.localeCompare(`${right.role}:${right.partyId}`));
  return JSON.stringify(canonical) === JSON.stringify(desired);
}
function reservationGuestReplacementFromDetail(detail: ReservationDetail): ReservationGuestReplacement {
  const primary = detail.reservation.guests.find((guest) => guest.role === "primary");
  return Object.freeze({
    primarySharePct: primary?.sharePct ?? null,
    guests: Object.freeze(detail.reservation.guests
      .filter((guest) => guest.role !== "primary")
      .map((guest) => Object.freeze({
        partyId: guest.partyId,
        role: guest.role === "sharer" ? "sharer" as const : "accompanying" as const,
        sharePct: guest.role === "sharer" ? guest.sharePct : null,
      }))
      .sort((left, right) => left.partyId.localeCompare(right.partyId))),
  });
}
function normaliseGuestLookup(value: string): string {
  return value.normalize("NFKD").replace(/\p{Mark}/gu, "").trim().toLocaleLowerCase();
}
async function replaceReservationGuests(
  reservationId: string,
  replacement: ReservationGuestReplacement,
  idempotencyKey: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/guests`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(replacement),
    },
  );
  if (!response.ok)
    throw await reservationApiError(
      response,
      "The server did not accept this guest allocation.",
    );
}
function localReply(
  language: VoiceLanguage,
  lane: OperationalLane,
  stays: readonly Stay[],
) {
  const labels: Record<string, Record<OperationalLane, string>> = {
    "English (India)": {
      due_in: "arrivals",
      due_out: "departures",
      in_house: "in-house stays",
    },
    Hindi: { due_in: "आगमन", due_out: "प्रस्थान", in_house: "इन-हाउस ठहराव" },
    Marathi: {
      due_in: "आगमन",
      due_out: "निर्गमन",
      in_house: "हॉटेलमध्ये असलेले पाहुणे",
    },
    Kannada: {
      due_in: "ಆಗಮನಗಳು",
      due_out: "ನಿರ್ಗಮನಗಳು",
      in_house: "ಹೋಟೆಲ್‌ನಲ್ಲಿರುವ ಅತಿಥಿಗಳು",
    },
    Telugu: {
      due_in: "రాకలు",
      due_out: "బయలుదేరే అతిథులు",
      in_house: "హోటల్‌లో ఉన్న అతిథులు",
    },
  };
  const label =
    labels[language]?.[lane] ?? labels["English (India)"]?.[lane] ?? lane;
  const people = stays.map(nameOf).join(", ");
  if (language === "Marathi")
    return stays.length
      ? `सिंथेटिक डेमोमध्ये ${stays.length} ${label} आहेत: ${people}. कोणत्याही बदलासाठी तुमचे पुनरावलोकन आणि पुष्टी आवश्यक आहे.`
      : `सध्याच्या डेमोमध्ये ${label} नाहीत.`;
  if (language === "Hindi")
    return stays.length
      ? `सिंथेटिक डेमो में ${stays.length} ${label} हैं: ${people}. किसी बदलाव के लिए आपकी समीक्षा और पुष्टि आवश्यक है।`
      : `वर्तमान डेमो में कोई ${label} नहीं है।`;
  if (language === "Kannada")
    return stays.length
      ? `ಸಿಂಥೆಟಿಕ್ ಡೆಮೊದಲ್ಲಿ ${stays.length} ${label} ಇವೆ: ${people}. ಯಾವುದೇ ಬದಲಾವಣೆಗೆ ನಿಮ್ಮ ಪರಿಶೀಲನೆ ಮತ್ತು ದೃಢೀಕರಣ ಅಗತ್ಯವಿದೆ.`
      : `ಪ್ರಸ್ತುತ ಡೆಮೊದಲ್ಲಿ ${label} ಇಲ್ಲ.`;
  if (language === "Telugu")
    return stays.length
      ? `సింథటిక్ డెమోలో ${stays.length} ${label} ఉన్నాయి: ${people}. ఏ మార్పుకైనా మీ సమీక్ష మరియు నిర్ధారణ అవసరం.`
      : `ప్రస్తుత డెమోలో ${label} లేవు.`;
  return stays.length
    ? `The hotel has ${stays.length} ${label}: ${people}. Any operational change will require your review and confirmation.`
    : `There are no ${label} in the current operating window.`;
}

function workspaceReply(
  language: VoiceLanguage,
  workspace: "reservations" | "guests" | "housekeeping" | "cashiers" | "rates",
): string {
  const names = {
    "English (India)": {
      reservations: "Reservations",
      guests: "Guests",
      housekeeping: "Housekeeping",
      cashiers: "Billing Desk",
      rates: "Rates",
    },
    Hindi: {
      reservations: "आरक्षण",
      guests: "अतिथि प्रोफ़ाइल",
      housekeeping: "हाउसकीपिंग",
      cashiers: "बिलिंग डेस्क",
      rates: "दर",
    },
    Marathi: {
      reservations: "आरक्षणे",
      guests: "पाहुणे",
      housekeeping: "हाऊसकीपिंग",
      cashiers: "बिलिंग डेस्क",
      rates: "दर",
    },
    Kannada: {
      reservations: "ರಿಸರ್ವೇಶನ್‌ಗಳು",
      guests: "ಅತಿಥಿ ಪ್ರೊಫೈಲ್‌ಗಳು",
      housekeeping: "ಹೌಸ್‌ಕೀಪಿಂಗ್",
      cashiers: "ಬಿಲ್ಲಿಂಗ್ ಡೆಸ್ಕ್",
      rates: "ದರಗಳು",
    },
    Telugu: {
      reservations: "రిజర్వేషన్లు",
      guests: "అతిథి ప్రొఫైల్‌లు",
      housekeeping: "హౌస్‌కీపింగ్",
      cashiers: "బిల్లింగ్ డెస్క్",
      rates: "రేట్లు",
    },
  } as const;
  const label =
    names[language as keyof typeof names]?.[workspace] ??
    names["English (India)"][workspace];
  if (language === "Hindi") return `${label} खोल रहा हूँ।`;
  if (language === "Marathi") return `${label} उघडत आहे.`;
  if (language === "Kannada") return `${label} ತೆರೆಯುತ್ತಿದ್ದೇನೆ.`;
  if (language === "Telugu") return `${label} తెరుస్తున్నాను.`;
  return `Opening ${label}.`;
}

function exactStateReply(
  language: VoiceLanguage,
  state: OperationalStateIntent,
  stays: readonly Stay[],
): string {
  const labels: Record<VoiceLanguage, Record<OperationalStateIntent, string>> = {
    "English (India)": {
      checked_in_today: "guests checked in today",
      stayover: "stayovers",
      checked_out_today: "guests checked out today",
    },
    Hindi: {
      checked_in_today: "आज चेक-इन हुए मेहमान",
      stayover: "स्टेओवर मेहमान",
      checked_out_today: "आज चेक-आउट हुए मेहमान",
    },
    Marathi: {
      checked_in_today: "आज चेक-इन झालेले पाहुणे",
      stayover: "मुक्कामी पाहुणे",
      checked_out_today: "आज चेक-आउट झालेले पाहुणे",
    },
    Kannada: {
      checked_in_today: "ಇಂದು ಚೆಕ್-ಇನ್ ಮಾಡಿದ ಅತಿಥಿಗಳು",
      stayover: "ತಂಗಿರುವ ಅತಿಥಿಗಳು",
      checked_out_today: "ಇಂದು ಚೆಕ್-ಔಟ್ ಮಾಡಿದ ಅತಿಥಿಗಳು",
    },
    Telugu: {
      checked_in_today: "ఈరోజు చెక్-ఇన్ అయిన అతిథులు",
      stayover: "బస కొనసాగిస్తున్న అతిథులు",
      checked_out_today: "ఈరోజు చెక్-అవుట్ అయిన అతిథులు",
    },
  };
  const label = labels[language][state];
  const people = stays.map(nameOf).join(", ");
  if (language === "Hindi") return stays.length ? `${stays.length} ${label}: ${people}.` : `अभी ${label} नहीं हैं।`;
  if (language === "Marathi") return stays.length ? `${stays.length} ${label}: ${people}.` : `सध्या ${label} नाहीत.`;
  if (language === "Kannada") return stays.length ? `${stays.length} ${label}: ${people}.` : `ಈಗ ${label} ಇಲ್ಲ.`;
  if (language === "Telugu") return stays.length ? `${stays.length} ${label}: ${people}.` : `ప్రస్తుతం ${label} లేరు.`;
  return stays.length ? `${stays.length} ${label}: ${people}.` : `There are no ${label}.`;
}


export type { Status, Stay, Lane, Property, ReservationActions, ReservationDetail, CheckInReadiness, DueInRoomCandidate, DueInRoomCandidateResult, ArrivalCleaningCandidate, ArrivalCleaningCandidateResult, ArrivalCleaningTaskResult, DueInRoomAssignmentInput, CheckoutReadiness, PartyProfile, ReservationGuestRole, ReservationGuestDraft, ReservationGuestReplacement, ReservationOffer, CreatedReservation, ReservationCreateEvidence, DuplicatePartyEvidence, ReservationLifecycleMutationResult, CancellationPolicyDecision, CancelReservationReceipt, ReinstateReservationReceipt, ReservationLifecycleReceipt, HousekeepingCondition, HousekeepingTaskAction, HousekeepingTask, HousekeepingTransitionReceipt, HousekeepingActionProposal, OperationalBlock, PropertyRestriction, InventoryPolicySummary, CommercialSnapshot, PropertySettingsSnapshot, PerformanceMetric, OperatingPerformance, CashierSnapshot, FolioChargeOption, FolioTransferGroup, FolioTransferMemberEffect, FolioTransferPreview, FolioTransferReceipt, FolioTransferDraft, FolioTransferAttempt, FolioChargeGroup, FolioStatement, HostedDepositState, HostedDepositStatus, HostedDepositInstrument, HostedDepositWorkbench, HostedDepositLink, DepositApplicationReceipt, DepositDraft, DepositAttempt, ReceivableTarget, ReceivablePreview, ReceivableApprovalReceipt, ReceivableTransferReceipt, Turn, AssistantMemory, AssistantCard, GuestAllocationProposal, CashierChargeProposal, VoiceBillWindowTransferProposal, FolioChargeReceipt, ArrivalConversationCommand, ArrivalConversationProposal, Recognition };
export type { ReservationOperationalFields, ReservationMutableFields };
export { sameReservationOffer };
export { session, loadProperties, loadLane, loadReservationBoard, loadGroupBlocks, loadPartyStayHistory, searchPartyProfiles, propertyLocalDate, propertyLocalDateTimeToIso, childAgesFrom, reservationApiError, searchReservationOffers, commitReservation, duplicatePartyEvidence, reservationMatchesCreateReceipt, ReservationCommandRequestError, ReservationLifecycleRequestError, validateReservationActions, validateCancelReservationReceipt, validateReinstateReservationReceipt, idempotencyReplayEvidence, loadHousekeeping, loadHousekeepingTask, isCanonicalInstant, hasExactKeys, isHousekeepingAction, validateHousekeepingTask, housekeepingTaskMatchesProposal, validateHousekeepingTransitionReceipt, housekeepingTaskReflectsAction, housekeepingFailureIsUncertain, transitionHousekeepingTask, loadOperationalBlocks, loadCommercialSnapshot, loadOperatingPerformance, loadPropertySettings, loadCashierSnapshot, loadFolioStatement, exactObject, validDepositStatus, validDepositInstrument, validateDepositWorkbench, depositResponse, loadHostedDepositWorkbench, loadHostedDepositStatus, createHostedDeposit, applyHostedDeposit, validateReceivableTarget, validateReceivablePreview, sameReceivablePreview, receivableResponse, loadReceivableTargets, previewReceivableTransfer, requestReceivableApproval, submitReceivableTransfer, validateFolioChargeReceipt, FolioChargeRequestError, postFolioCharge, isExactTransferMinor, validateFolioTransferEffect, validateFolioTransferPreview, sameTransferPreview, transferReasonIsValid, transferWindowNameIsValid, voiceTransferText, resolveVoiceTransferGroup, receiptMatchesVoiceTransfer, requestFolioTransferPreview, wakeReply, guestHistoryReply, loadReservation, loadCheckInReadiness, loadCheckoutReadiness, commitCheckIn, openPrimaryFolio, loadDueInRoomCandidates, assignDueInRoom, loadArrivalCleaningCandidate, createArrivalCleaningTask, transitionFolioStatus, commitCheckout, cancelReservationLifecycle, reinstateReservationLifecycle, normalizeReservationOperationalValue, modifyReservationOperationalDetails, parseGuestShareBasisPoints, reservationGuestAllocationsMatch, reservationGuestReplacementFromDetail, normaliseGuestLookup, replaceReservationGuests, localReply, workspaceReply, exactStateReply, FolioTransferRequestError, loadDepartureServices, loadDepartureServiceQueue, createDepartureServiceProposal, transitionDepartureService };
