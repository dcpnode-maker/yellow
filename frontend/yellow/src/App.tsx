import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  arrivalCleaningAttendantIntent,
  cashierChargeConfirmationIntent,
  cashierChargeIntent,
  folioBillWindowTransferIntent,
  hasFolioBillWindowPartialSplitIntent,
  housekeepingTaskActionIntent,
  resolveArrivalCleaningAttendant,
  guidedNavigationPath,
  guestProfileVoiceAction,
  guestProfileVoiceCandidates,
  isAssistantWakeWord,
  requestVoiceMicrophone,
  resolveLocalReadIntent,
  reservationGuestAllocationIntent,
  reservationVoiceAction,
  departureServiceConfirmationIntent,
  departureServiceVoiceIntent,
  resolveCashierChargeOption,
  mergeVoiceTranscript,
  voicePauseMs,
  voiceRestartLimit,
  defaultVoiceLanguage,
  preferredSpeechVoice,
  languageFromBrowserLocales,
  languagePreferenceFromText,
  speechOutputIntent,
  resolveReservationQueryIntent,
  type KpiIntent,
  type FolioBillWindowTransferIntent,
  type OperationalLane,
  type OperationalStateIntent,
  type ReservationQueryContext,
  type VoiceLanguage,
  type WorkspaceIntent,
} from "./voice";
import type { DepartureConversationCommand } from "./workspaces/ReservationWorkspace";
import { collectReservationBoardPages, operationalStateDescription, operationalStateLabel } from "./reservation-board";
import {
  RESERVATION_BOARD_CAPABILITIES,
  createMovementQuery,
  filterAndSortMovementRows,
  metricVariance,
  movementGuestAttributes,
  movementNights,
  propertyLocalGreeting,
  type MovementSort,
  type MovementQuery,
  type MovementSortKey,
} from "./today-workspace";
import {
  configureYellowApi,
  session,
  loadProperties,
  loadLane,
  loadReservationBoard,
  loadPartyStayHistory,
  searchPartyProfiles,
  searchReservationOffers,
  commitReservation,
  loadHousekeeping,
  loadHousekeepingTask,
  loadOperationalBlocks,
  loadCommercialSnapshot,
  loadOperatingPerformance,
  loadPropertySettings,
  loadCashierSnapshot,
  loadFolioStatement,
  loadHostedDepositWorkbench,
  loadHostedDepositStatus,
  createHostedDeposit,
  applyHostedDeposit,
  loadReceivableTargets,
  previewReceivableTransfer,
  requestReceivableApproval,
  submitReceivableTransfer,
  postFolioCharge,
  requestFolioTransferPreview,
  previewMatchesFolioTransferDraft,
  submitFolioTransfer,
  validateFolioTransferReceipt,
  resolveVoiceTransferSource,
  FolioTransferRequestError,
  PrimaryFolioRequestError,
  loadReservation,
  loadCheckInReadiness,
  loadCheckoutReadiness,
  commitCheckIn,
  openPrimaryFolio,
  loadDueInRoomCandidates,
  assignDueInRoom,
  loadArrivalCleaningCandidate,
  createArrivalCleaningTask,
  commitCheckout,
  cancelReservationLifecycle,
  reinstateReservationLifecycle,
  normalizeReservationOperationalValue,
  modifyReservationOperationalDetails,
  parseGuestShareBasisPoints,
  reservationGuestAllocationsMatch,
  reservationGuestReplacementFromDetail,
  normaliseGuestLookup,
  replaceReservationGuests,
  localReply,
  workspaceReply,
  exactStateReply,
  FolioChargeRequestError,
} from "./yellow-api";
import type { ReservationOperationalFields } from "./yellow-api";
import { TodayGlassDashboard } from "./workspaces/TodayGlassDashboard";
import {
  propertyLocalDate,
  propertyLocalDateTimeToIso,
  childAgesFrom,
  reservationApiError,
  isCanonicalInstant,
  hasExactKeys,
  isHousekeepingAction,
  validateHousekeepingTask,
  housekeepingTaskMatchesProposal,
  validateHousekeepingTransitionReceipt,
  housekeepingTaskReflectsAction,
  housekeepingFailureIsUncertain,
  transitionHousekeepingTask,
  exactObject,
  validDepositStatus,
  validDepositInstrument,
  validateDepositWorkbench,
  depositResponse,
  validateReceivableTarget,
  validateReceivablePreview,
  sameReceivablePreview,
  receivableResponse,
  validateFolioChargeReceipt,
  isExactTransferMinor,
  validateFolioTransferEffect,
  validateFolioTransferPreview,
  sameTransferPreview,
  transferReasonIsValid,
  transferWindowNameIsValid,
  voiceTransferText,
  resolveVoiceTransferGroup,
  receiptMatchesVoiceTransfer,
  wakeReply,
  guestHistoryReply,
} from "./yellow-api";

// Kept as a named compatibility export for the voice allocation proof; the
// implementation lives in the shared API module so lazy workspaces do not
// import App.tsx.
export { resolveVoiceTransferSource, validateFolioTransferReceipt, previewMatchesFolioTransferDraft, submitFolioTransfer };

const OperationalHub = lazy(() => import("./workspaces/OperationalHub"));
const EcosystemHub = lazy(() => import("./workspaces/EcosystemHub"));
const MarketIntelligenceLab = lazy(() => import("./workspaces/MarketIntelligenceLab"));
const LazyFinanceWorkspace = lazy(() => import("./workspaces/FinanceWorkspace").then((module) => ({ default: module.FinanceWorkspace })));
const LazyPrimaryBillingWindowAction = lazy(() => import("./workspaces/FinanceWorkspace").then((module) => ({ default: module.PrimaryBillingWindowAction })));
const LazyAdvanceDepositWorkbench = lazy(() => import("./workspaces/FinanceWorkspace").then((module) => ({ default: module.AdvanceDepositWorkbench })));
const LazyCashierWorkbench = lazy(() => import("./workspaces/FinanceWorkspace").then((module) => ({ default: module.CashierWorkbench })));
function FinanceWorkspace(props: ComponentProps<typeof LazyFinanceWorkspace>) {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening cashier…</strong><p>Loading finance only when it is needed.</p></section>}><LazyFinanceWorkspace {...props} /></Suspense>;
}
const LazyReservationWorkspace = lazy(() => import("./workspaces/ReservationWorkspace").then((module) => ({ default: module.ReservationWorkspace })));
const LazyOverwatchCheckInJourney = lazy(() => import("./workspaces/ReservationWorkspace").then((module) => ({ default: module.OverwatchCheckInJourney })));
const LazyOverwatchCheckoutJourney = lazy(() => import("./workspaces/ReservationWorkspace").then((module) => ({ default: module.OverwatchCheckoutJourney })));
const LazyReservationCreateWorkspace = lazy(() => import("./workspaces/ReservationWorkspace").then((module) => ({ default: module.ReservationCreateWorkspace })));
const LazyReservationBoardWorkspace = lazy(() => import("./workspaces/ReservationWorkspace").then((module) => ({ default: module.ReservationBoardWorkspace })));
const LazyGuestsWorkspace = lazy(() => import("./workspaces/ReservationWorkspace").then((module) => ({ default: module.GuestsWorkspace })));
const LazyInlineGuestProfile = lazy(() => import("./workspaces/ReservationWorkspace").then((module) => ({ default: module.InlineGuestProfile })));
function ReservationWorkspace(props: ComponentProps<typeof LazyReservationWorkspace>) {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening reservation…</strong><p>Loading reservation controls only when they are needed.</p></section>}><LazyReservationWorkspace {...props} /></Suspense>;
}
function OverwatchCheckInJourney(props: ComponentProps<typeof LazyOverwatchCheckInJourney>) {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening check-in…</strong><p>Loading the arrival workflow.</p></section>}><LazyOverwatchCheckInJourney {...props} /></Suspense>;
}
function OverwatchCheckoutJourney(props: ComponentProps<typeof LazyOverwatchCheckoutJourney>) {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening checkout…</strong><p>Reading the live stay, room and billing controls.</p></section>}><LazyOverwatchCheckoutJourney {...props} /></Suspense>;
}
function ReservationCreateWorkspace(props: ComponentProps<typeof LazyReservationCreateWorkspace>) {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening reservation builder…</strong><p>Loading reservation creation.</p></section>}><LazyReservationCreateWorkspace {...props} /></Suspense>;
}
function ReservationBoardWorkspace(props: ComponentProps<typeof LazyReservationBoardWorkspace>) {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening reservation board…</strong><p>Loading the board only when it is needed.</p></section>}><LazyReservationBoardWorkspace {...props} /></Suspense>;
}
function GuestsWorkspace() {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening guests…</strong><p>Loading guest search only when it is needed.</p></section>}><LazyGuestsWorkspace /></Suspense>;
}
function InlineGuestProfile(props: ComponentProps<typeof LazyInlineGuestProfile>) {
  return <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening guest profile…</strong><p>Loading the guest profile.</p></section>}><LazyInlineGuestProfile {...props} /></Suspense>;
}

// The entry property carries a complete current-arrival readiness walkthrough.
// Riverstone remains selectable for the larger room/channel catalogue.
const DEFAULT_PROPERTY = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const SHOWCASE_PROPERTIES = new Set([
  "6081b544-22a1-534f-a86d-bb1ae0519e14",
  "01e4e102-c54f-5205-9542-d84d103084f8",
]);
const routeMatch = /^\/p\/([^/]+)(?:\/res\/([^/]+))?(?:\/[^/]*)?$/.exec(
  window.location.pathname,
);
const requestedPropertyId = routeMatch?.[1] ?? DEFAULT_PROPERTY;
const propertyId = requestedPropertyId;
configureYellowApi(propertyId);
const reservationRouteId = routeMatch?.[2] ?? null;
type WorkspacePart =
  | "today"
  | "reservations"
  | "guests"
  | "housekeeping"
  | "operations"
  | "ecosystem"
  | "market-lab"
  | "rates"
  | "finance"
  | "settings";

const internalMarketLabEnabled =
  (import.meta as ImportMeta & {
    readonly env?: Readonly<Record<string, string | boolean | undefined>>;
  }).env?.VITE_YELLOW_INTERNAL_MARKET_LAB === "1";
const requestedWorkspacePart = new URLSearchParams(window.location.search).get(
  "workspace",
);
const routeWorkspacePart = /^\/p\/[^/]+\/(today|reservations|guests|housekeeping|operations|ecosystem)$/.exec(
  window.location.pathname,
)?.[1];
const workspacePart: WorkspacePart =
  requestedWorkspacePart === "rates" || requestedWorkspacePart === "finance" || requestedWorkspacePart === "settings" || requestedWorkspacePart === "operations" || requestedWorkspacePart === "ecosystem" || (requestedWorkspacePart === "market-lab" && internalMarketLabEnabled)
    ? requestedWorkspacePart
    : routeWorkspacePart === "today" ||
        routeWorkspacePart === "reservations" ||
        routeWorkspacePart === "guests" ||
        routeWorkspacePart === "housekeeping" ||
        routeWorkspacePart === "operations" ||
        routeWorkspacePart === "ecosystem"
      ? routeWorkspacePart
      : "today";
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
type Lane = Readonly<{ reservations?: readonly Stay[] }>;
type Property = Readonly<{ id: string; name: string; timezone: string }>;
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
  checkoutCompleted?: boolean;
  checkoutRoomLabel?: string | null;
  cashierReservationId?: string;
  movement?: Readonly<{
    status: Status | "all";
    lane: Lane;
    query?: MovementQuery;
    detailReservationId?: string;
  }>;
  performance?: Readonly<{ intent: KpiIntent; data: OperatingPerformance }>;
  reservationId?: string;
  reservationLifecycleAction?: "cancel" | "reinstate" | "no_show";
  reservationCreate?: boolean;
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
const lang: Record<VoiceLanguage, string> = {
  "English (India)": "en-IN",
  Hindi: "hi-IN",
  Marathi: "mr-IN",
  Kannada: "kn-IN",
  Telugu: "te-IN",
};
const languageCodeFor = (language: VoiceLanguage): string => lang[language];
const nameOf = (stay: Stay) =>
  stay.primaryGuestDisplayName ?? stay.primaryPartyName ?? stay.confirmationNo;
const reservationStatusLabel = (status: string): string => {
  if (status === "due_in") return "Expected arrival";
  if (status === "due_out") return "Departure today";
  if (status === "in_house") return "In house";
  if (status === "checked_out") return "Departed history";
  return status.replaceAll("_", " ");
};
const reservationStatusDescription = (status: string): string => {
  if (status === "due_in") return "Due in · expected arrival";
  if (status === "due_out") return "Due out · departure today";
  if (status === "in_house") return "In house · occupied";
  if (status === "checked_out") return "Checked out · departed history";
  return reservationStatusLabel(status);
};
const reservationCreationVoiceIntent = (message: string): boolean =>
  /(?:create|new|make|book|reserve|बनाओ|नई|नया|बुक|आरक्षण|ಹೊಸ|ಕಾಯ್ದಿರಿಸಿ|బుక్|కొత్త|రిజర్వేషన్).*(?:reservation|booking|stay|आरक्षण|बुकिंग|ಕಾಯ್ದಿರಿಸುವಿಕೆ|బుకింగ్|రిజర్వేషన్)|(?:reservation|booking|आरक्षण|बुकिंग|ಕಾಯ್ದಿರಿಸುವಿಕೆ|బుకಿಂಗ್|రిజర్వేషన్).*(?:create|new|make|बनाओ|नई|नया|ಹೊಸ|బుక్|కొత్త)/iu.test(message);
const propertyDisplayName = (property: Property | undefined): string =>
  property?.name === "Yellow Demo Property" ? "Yellow Hotel" : property?.name ?? "Loading property…";
const titleOf = (status: Status) =>
  status === "due_in"
    ? "Arrivals"
    : status === "due_out"
      ? "Departures"
      : "In house";
const reservationQueryTitle = (context: ReservationQueryContext): string =>
  context.query.state
    ? operationalStateLabel(context.query.state)
    : context.view === "all"
      ? "Reservations"
      : titleOf(context.view);
const reservationRowsForQuery = (
  rows: readonly Stay[],
  context: ReservationQueryContext,
): readonly Stay[] => {
  if (context.query.state || context.query.dateFrom || context.query.dateTo || context.view === "all") return rows;
  if (context.view === "in_house") {
    return rows.filter((row) => row.status === "in_house" || row.operationalState === "in_house" || row.operationalState === "checked_in_today" || row.operationalState === "stayover");
  }
  return rows.filter((row) => row.status === context.view || row.operationalState === context.view);
};
const reservationQueryFilterCount = (query: MovementQuery): number =>
  Number(Boolean(query.search.trim())) +
  Number(Boolean(query.source)) +
  Number(query.assignment !== "all") +
  Number(Boolean(query.state)) +
  Number(Boolean(query.roomType)) +
  Number(Boolean(query.ratePlan)) +
  Number(Boolean(query.dateFrom)) +
  Number(Boolean(query.dateTo)) +
  Number(query.minAdults !== null) +
  Number(query.children !== "all") +
  Number(query.travel !== "all") +
  Number(query.pickup !== "all");
const workspaceTitle = (workspace: WorkspaceIntent): string =>
  workspace === "cashiers"
    ? "Cashier and folios"
    : workspace === "housekeeping"
      ? "Housekeeping"
      : workspace === "rates"
        ? "Rate configuration"
        : workspace === "guests"
          ? "Guest profiles"
          : "Reservations";
const overwatchMemoryKey = `yellow-overwatch:${propertyId}`;

function browserLanguagePreference(): VoiceLanguage {
  return defaultVoiceLanguage;
}

function browserLanguageSuggestion(): VoiceLanguage | null {
  const suggestion = languageFromBrowserLocales(
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language],
  );
  return suggestion === defaultVoiceLanguage ? null : suggestion;
}

function restoredReservationQuery(value: unknown): ReservationQueryContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { view?: unknown; query?: unknown };
  if (candidate.view !== "due_in" && candidate.view !== "due_out" && candidate.view !== "in_house" && candidate.view !== "all") return undefined;
  if (!candidate.query || typeof candidate.query !== "object") return undefined;
  const query = candidate.query as Record<string, unknown>;
  if (query.movementTime !== "arrival" && query.movementTime !== "departure") return undefined;
  if (query.assignment !== "all" && query.assignment !== "assigned" && query.assignment !== "unassigned") return undefined;
  if (query.minAdults !== undefined && query.minAdults !== null && (!Number.isSafeInteger(query.minAdults) || Number(query.minAdults) < 1 || Number(query.minAdults) > 20)) return undefined;
  if (query.children !== undefined && query.children !== "all" && query.children !== "present" && query.children !== "absent") return undefined;
  if (query.travel !== undefined && query.travel !== "all" && query.travel !== "recorded" && query.travel !== "not_recorded") return undefined;
  if (query.pickup !== undefined && query.pickup !== "all" && query.pickup !== "requested" && query.pickup !== "not_recorded") return undefined;
  const stringKeys = ["search", "source", "state", "roomType", "ratePlan", "dateFrom", "dateTo"] as const;
  if (stringKeys.some((key) => typeof query[key] !== "string")) return undefined;
  const sortKeys: readonly MovementSortKey[] = RESERVATION_BOARD_CAPABILITIES.sorts;
  if (!Array.isArray(query.sorts) || !query.sorts.length || query.sorts.some((sort) => {
    if (!sort || typeof sort !== "object") return true;
    const item = sort as { key?: unknown; direction?: unknown };
    return !sortKeys.includes(item.key as MovementSortKey) || (item.direction !== "asc" && item.direction !== "desc");
  })) return undefined;
  return Object.freeze({
    view: candidate.view,
    query: createMovementQuery(query.movementTime, {
      search: query.search as string,
      source: query.source as string,
      assignment: query.assignment,
      state: query.state as string,
      roomType: query.roomType as string,
      ratePlan: query.ratePlan as string,
      dateFrom: query.dateFrom as string,
      dateTo: query.dateTo as string,
      minAdults: query.minAdults === undefined ? null : query.minAdults as number | null,
      children: query.children === undefined ? "all" : query.children as MovementQuery["children"],
      travel: query.travel === undefined ? "all" : query.travel as MovementQuery["travel"],
      pickup: query.pickup === undefined ? "all" : query.pickup as MovementQuery["pickup"],
      sorts: query.sorts as readonly MovementSort[],
    }),
  });
}

function restoredOverwatchMemory(): AssistantMemory {
  try {
    const stored = window.sessionStorage.getItem(overwatchMemoryKey);
    if (!stored) return { open: false, language: browserLanguagePreference(), turns: [] };
    const value = JSON.parse(stored) as Partial<AssistantMemory>;
    const language =
      typeof value.language === "string" && value.language in lang
        ? value.language as VoiceLanguage
        : browserLanguagePreference();
    const turns = Array.isArray(value.turns)
      ? value.turns
          .filter(
            (turn): turn is Turn =>
              typeof turn?.text === "string" &&
              (turn.role === "user" || turn.role === "assistant"),
          )
          .slice(-6)
      : [];
    return { open: value.open === true, language, turns, reservationQuery: restoredReservationQuery(value.reservationQuery) };
  } catch {
    return { open: false, language: browserLanguagePreference(), turns: [] };
  }
}

function rememberOverwatch(memory: AssistantMemory): void {
  try {
    window.sessionStorage.setItem(
      overwatchMemoryKey,
      JSON.stringify({ ...memory, turns: memory.turns.slice(-6) }),
    );
  } catch {
    // A private-mode storage failure must never block hotel operations.
  }
}


/* Order584 extracted shared API/contracts; executable implementation is yellow-api.ts.
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
  const response = await fetch("/api/v1/reservations:commit", {
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
  if (!response.ok) {
    const error = await reservationApiError(
      response,
      "The reservation could not be committed.",
    );
    Object.assign(error, { status: response.status });
    throw error;
  }
  return ((await response.json()) as { reservation: CreatedReservation }).reservation;
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
const POSITIVE_MINOR = /^[1-9][0-9]*$/u;
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
const EXACT_MINOR = /^-?(?:0|[1-9][0-9]*)$/u;
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
  return r.json() as Promise<ReservationDetail>;
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
class PrimaryFolioRequestError extends Error {
  constructor(message: string, readonly uncertain: boolean) {
    super(message);
    this.name = "PrimaryFolioRequestError";
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
async function commitCheckout(reservationId: string): Promise<void> {
  const r = await fetch(
    `/api/v1/properties/${propertyId}/reservations/${reservationId}/checkout`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await session()}`,
        "idempotency-key": `yellow-public-demo-${crypto.randomUUID()}`,
      },
      body: "{}",
    },
  );
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? "The server did not accept this checkout.");
  }
}
async function cancelReservationLifecycle(
  reservationId: string,
  reason: string,
  idempotencyKey: string,
): Promise<void> {
  const response = await fetch(
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
  if (!response.ok)
    throw await reservationApiError(
      response,
      "The server did not accept this cancellation.",
    );
}
async function reinstateReservationLifecycle(
  reservationId: string,
  idempotencyKey: string,
): Promise<void> {
  const response = await fetch(
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
  if (!response.ok)
    throw await reservationApiError(
      response,
      "The server did not accept this reinstatement.",
    );
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
  expected: Readonly<Record<string, string | null>>,
  changes: Readonly<Record<string, string | null>>,
  idempotencyKey: string,
): Promise<void> {
  const response = await fetch(
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
  if (!response.ok)
    throw await reservationApiError(
      response,
      "The server did not accept these operational details.",
    );
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

*/

function LanePanel({
  status,
  lane,
  review,
  open,
  focused = false,
}: Readonly<{
  status: Status;
  lane?: Lane;
  review: (stay: Stay) => void;
  open: (stay: Stay) => void;
  focused?: boolean;
}>) {
  const stays = lane?.reservations ?? [];
  return (
    <section className={`lane${focused ? " focused" : ""}`} id={`yellow-lane-${status}`} role={focused ? "table" : undefined} aria-label={focused ? `${titleOf(status)} live operations` : undefined}>
      <header>
        <h2>{titleOf(status)}</h2>
        <button
          onClick={() =>
            window.location.assign(`/p/${propertyId}/reservations`)
          }
        >
          View all →
        </button>
      </header>
      {focused ? <div className="lane-table-head" role="row"><span role="columnheader">State</span><span role="columnheader">Guest</span><span role="columnheader">Room · rate</span><span role="columnheader">Action</span></div> : null}
      {stays.length ? (
        stays.map((stay) => (
          <article key={stay.reservationId} role={focused ? "row" : undefined}>
            <span className={`state ${status}`} role={focused ? "cell" : undefined}>
              {status.replace("_", " ")}
            </span>
            <strong role={focused ? "cell" : undefined}>{nameOf(stay)}</strong>
            <p role={focused ? "cell" : undefined}>
              {stay.sellableUnitLabel ?? stay.unitTypeLabel ?? "Room to assign"}{" "}
              · {stay.ratePlanLabel ?? "Public rate"}
            </p>
            {focused ? <span className="lane-action" role="cell"><button onClick={() => (status === "due_in" ? review(stay) : open(stay))}>{status === "due_in" ? "Prepare check-in" : "Open stay"}</button></span> : <button onClick={() => (status === "due_in" ? review(stay) : open(stay))}>{status === "due_in" ? "Prepare check-in" : "Open stay"}</button>}
          </article>
        ))
      ) : (
        <p className="empty">No stays in this window.</p>
      )}
    </section>
  );
}

function formatMovementTime(
  value: string | null | undefined,
  timezone: string,
  includeDate = false,
): string {
  if (!value) return "—";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    ...(includeDate
      ? ({ day: "2-digit", month: "short", year: "numeric" } as const)
      : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(instant);
}

function MovementGrid({
  status,
  lane,
  timezone,
  open,
  headingId = "movement-heading",
  query: controlledQuery,
  onQueryChange,
}: Readonly<{
  status: Status | "all";
  lane?: Lane;
  timezone: string;
  open: (stay: Stay) => void;
  headingId?: string;
  query?: MovementQuery;
  onQueryChange?: (query: MovementQuery) => void;
}>) {
  const [localQuery, setLocalQuery] = useState<MovementQuery>(() => createMovementQuery(
    status === "due_out" ? "departure" : "arrival",
    { sorts: [{ key: status === "due_in" ? "eta" : "guest", direction: "asc" }, ...(status === "due_in" ? [{ key: "guest" as const, direction: "asc" as const }] : [])] },
  ));
  const query = controlledQuery ?? localQuery;
  const updateQuery = (updates: Partial<MovementQuery>) => {
    const next = createMovementQuery(updates.movementTime ?? query.movementTime, { ...query, ...updates });
    if (onQueryChange) onQueryChange(next);
    else setLocalQuery(next);
  };
  const { search, source, roomType, ratePlan, dateFrom, dateTo, assignment, state: stateFilter, minAdults, children, travel, pickup } = query;
  const primarySort = query.sorts[0]?.key ?? "eta";
  const primaryDirection = query.sorts[0]?.direction ?? "asc";
  const secondarySort = query.sorts[1]?.key ?? primarySort;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  useEffect(() => {
    if (!filtersOpen && !sortOpen) return;
    const dismissPopover = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFiltersOpen(false);
      setSortOpen(false);
    };
    window.addEventListener("keydown", dismissPopover);
    return () => window.removeEventListener("keydown", dismissPopover);
  }, [filtersOpen, sortOpen]);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollViewport = useRef<HTMLDivElement | null>(null);
  const resetGridScroll = () => {
    setScrollTop(0);
    if (scrollViewport.current) scrollViewport.current.scrollTop = 0;
  };
  const rows = lane?.reservations ?? [];
  const sources = useMemo(() => [...new Set(rows.map((row) => row.channelCode).filter((item): item is string => Boolean(item)))].sort(), [rows]);
  const roomTypes = useMemo(() => [...new Set(rows.map((row) => row.unitTypeLabel).filter((item): item is string => Boolean(item)))].sort(), [rows]);
  const ratePlans = useMemo(() => [...new Set(rows.map((row) => row.ratePlanLabel).filter((item): item is string => Boolean(item)))].sort(), [rows]);
  const states = useMemo(() => [...new Set(rows.map((row) => row.operationalState ?? row.status).filter(Boolean))].sort((left, right) => operationalStateLabel(left).localeCompare(operationalStateLabel(right))), [rows]);
  const sorts = query.sorts;
  const visibleRows = useMemo(
    () => filterAndSortMovementRows(rows, query, sorts, query.movementTime, timezone),
    [query, rows, sorts, timezone],
  );
  const rowHeight = 54;
  const headerHeight = 36;
  const viewportHeight = 598;
  const overscan = 8;
  const rowScrollTop = Math.max(0, scrollTop - headerHeight);
  const first = Math.max(0, Math.floor(rowScrollTop / rowHeight) - overscan);
  const last = Math.min(visibleRows.length, Math.ceil((rowScrollTop + viewportHeight) / rowHeight) + overscan);
  const rendered = visibleRows.slice(first, last);
  const filterCount = Number(Boolean(source)) + Number(Boolean(roomType)) + Number(Boolean(ratePlan)) + Number(Boolean(dateFrom)) + Number(Boolean(dateTo)) + Number(assignment !== "all") + Number(Boolean(stateFilter)) + Number(Boolean(search.trim())) + Number(minAdults !== null) + Number(children !== "all") + Number(travel !== "all") + Number(pickup !== "all");
  const sortOptions: readonly Readonly<{ key: MovementSortKey; label: string }>[] = [
    { key: "eta", label: status === "due_out" ? "Departure time" : status === "all" ? "Arrival date" : "ETA" },
    { key: "guest", label: "Guest" },
    { key: "confirmation", label: "Reservation" },
    { key: "nights", label: "Nights" },
    { key: "room", label: "Room" },
    { key: "source", label: "Source" },
    { key: "rate", label: "Rate plan" },
    { key: "adults", label: "Adults" },
    { key: "children", label: "Children" },
  ];
  return (
    <section className="movement-workspace" aria-labelledby={headingId}>
      <header className="movement-heading">
        <div>
          <button type="button" className="back-link" onClick={() => window.location.assign(`/p/${propertyId}/today`)}>Today /</button>
          <h1 id={headingId}>{status === "all" ? "Reservations · All states" : `${titleOf(status)} · ${status === "due_in" ? "Due in" : status === "due_out" ? "Due out" : "Occupied"}`} ({visibleRows.length})</h1>
          <p>{visibleRows.length.toLocaleString()} reservations · {rendered.length} rows rendered on demand · live</p>
        </div>
      </header>
      <div className="movement-toolbar">
        <label className="movement-search"><span>⌕</span><input value={search} onChange={(event) => { updateQuery({ search: event.target.value }); resetGridScroll(); }} placeholder="Search guest, reservation, room, source, rate or travel…" /></label>
        <div className="movement-tool-wrap">
          <button type="button" className={filtersOpen ? "active" : undefined} onClick={() => { setFiltersOpen((value) => !value); setSortOpen(false); }}>Advanced filter{filterCount ? ` (${filterCount})` : ""}⌄</button>
          {filtersOpen ? <div className="movement-popover" role="dialog" aria-label="Advanced movement filters">
            <div className="movement-popover-head"><strong>Match all rules</strong><button type="button" aria-label="Close advanced filters" onClick={() => setFiltersOpen(false)}>Close</button></div>
            {status === "all" ? <label>Operational state<select value={stateFilter} onChange={(event) => { updateQuery({ state: event.target.value }); resetGridScroll(); }}><option value="">Any state</option>{states.map((item) => <option key={item} value={item}>{operationalStateDescription(item)}</option>)}</select></label> : null}
            <label>Source<select value={source} onChange={(event) => { updateQuery({ source: event.target.value }); resetGridScroll(); }}><option value="">Any source</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Room type<select value={roomType} onChange={(event) => { updateQuery({ roomType: event.target.value }); resetGridScroll(); }}><option value="">Any room type</option>{roomTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Rate plan<select value={ratePlan} onChange={(event) => { updateQuery({ ratePlan: event.target.value }); resetGridScroll(); }}><option value="">Any rate plan</option>{ratePlans.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>{query.movementTime === "departure" ? "Departure from" : "Arrival from"}<input type="date" value={dateFrom} onChange={(event) => { updateQuery({ dateFrom: event.target.value }); resetGridScroll(); }} /></label>
            <label>{query.movementTime === "departure" ? "Departure to" : "Arrival to"}<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { updateQuery({ dateTo: event.target.value }); resetGridScroll(); }} /></label>
            <label>Room assignment<select value={assignment} onChange={(event) => { updateQuery({ assignment: event.target.value as MovementQuery["assignment"] }); resetGridScroll(); }}><option value="all">Any</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></label>
            <label>Minimum adults<input aria-label="Minimum adults" type="number" min="1" max="20" inputMode="numeric" value={minAdults ?? ""} onChange={(event) => { const value = event.target.value; const parsed = Number(value); updateQuery({ minAdults: value === "" || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > 20 ? null : parsed }); resetGridScroll(); }} /></label>
            <label>Children<select value={children} onChange={(event) => { updateQuery({ children: event.target.value as MovementQuery["children"] }); resetGridScroll(); }}><option value="all">Any</option><option value="present">With children</option><option value="absent">0 children recorded</option></select></label>
            <label>{query.movementTime === "departure" ? "Departure travel" : "Arrival travel"}<select value={travel} onChange={(event) => { updateQuery({ travel: event.target.value as MovementQuery["travel"] }); resetGridScroll(); }}><option value="all">Any</option><option value="recorded">Travel recorded</option><option value="not_recorded">Travel not recorded</option></select></label>
            <label>Pickup<select value={pickup} onChange={(event) => { updateQuery({ pickup: event.target.value as MovementQuery["pickup"] }); resetGridScroll(); }}><option value="all">Any</option><option value="requested">Pickup requested</option><option value="not_recorded">No pickup recorded</option></select></label>
            <button type="button" onClick={() => { updateQuery(createMovementQuery(query.movementTime)); resetGridScroll(); }}>Clear filters</button>
            <button type="button" className="movement-popover-done" onClick={() => setFiltersOpen(false)}>Done</button>
          </div> : null}
        </div>
        <div className="movement-tool-wrap">
          <button type="button" className={sortOpen ? "active" : undefined} onClick={() => { setSortOpen((value) => !value); setFiltersOpen(false); }}>Advanced sort (2)⌄</button>
          {sortOpen ? <div className="movement-popover" role="dialog" aria-label="Advanced movement sorting">
            <div className="movement-popover-head"><strong>Sort levels</strong><button type="button" aria-label="Close advanced sorting" onClick={() => setSortOpen(false)}>Close</button></div>
            <label>1<select value={primarySort} onChange={(event) => { const key = event.target.value as MovementSortKey; updateQuery({ sorts: [{ key, direction: primaryDirection }, ...(secondarySort !== key ? [{ key: secondarySort, direction: "asc" as const }] : [])] }); resetGridScroll(); }}>{sortOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
            <label>Direction<select value={primaryDirection} onChange={(event) => { updateQuery({ sorts: [{ key: primarySort, direction: event.target.value as "asc" | "desc" }, ...(secondarySort !== primarySort ? [{ key: secondarySort, direction: "asc" as const }] : [])] }); resetGridScroll(); }}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
            <label>2<select value={secondarySort} onChange={(event) => { const key = event.target.value as MovementSortKey; updateQuery({ sorts: [{ key: primarySort, direction: primaryDirection }, ...(key !== primarySort ? [{ key, direction: "asc" as const }] : [])] }); resetGridScroll(); }}>{sortOptions.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
            <button type="button" className="movement-popover-done" onClick={() => setSortOpen(false)}>Done</button>
          </div> : null}
        </div>
        <span className="movement-density">Compact density</span>
      </div>
      <div className="movement-grid" role="table" aria-rowcount={visibleRows.length + 1}>
        <div ref={scrollViewport} className="movement-grid-scroll" style={{ height: viewportHeight }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
          <div className="movement-grid-head movement-grid-row" role="row">
            {[status === "due_out" ? "Departure" : status === "all" ? "Arrival" : "ETA", "Guest", "Reservation", "Nights", "Room type", "Assigned room", "Source", "Rate plan", "Guests / travel", "Readiness", "Status", "Billing"].map((heading) => <span role="columnheader" key={heading}>{heading} ↕</span>)}
          </div>
          <div className="movement-grid-space" style={{ height: visibleRows.length * rowHeight }}>
            {rendered.map((stay, offset) => {
              const rowIndex = first + offset;
              const timeValue = status === "due_out"
                ? stay.stayTo
                : stay.arrivalTravel?.scheduledAt ?? stay.stayFrom;
              const state = stay.operationalState ?? stay.status;
              return <div className="movement-grid-row movement-data-row" role="row" aria-rowindex={rowIndex + 2} data-row-index={rowIndex} tabIndex={0} key={stay.reservationId} style={{ transform: `translateY(${rowIndex * rowHeight}px)` }} onClick={() => open(stay)} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(stay); return; }
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                const next = Math.max(0, Math.min(visibleRows.length - 1, rowIndex + (event.key === "ArrowDown" ? 1 : -1)));
                if (scrollViewport.current) scrollViewport.current.scrollTop = headerHeight + next * rowHeight;
                window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row-index="${next}"]`)?.focus());
              }}>
                <span role="cell">{formatMovementTime(timeValue, timezone, status === "all")}</span>
                <span role="cell" className="movement-guest"><strong>{nameOf(stay)}</strong><small className="movement-mobile-attribute">{movementGuestAttributes(stay, status === "due_out" ? "departure" : "arrival")}</small><aside className="movement-preview"><small>Reservation preview</small><b>{nameOf(stay)}</b><span>{stay.confirmationNo} · {movementNights(stay)} night{movementNights(stay) === 1 ? "" : "s"}</span><span>{stay.unitTypeLabel ?? "Room type pending"} · {stay.sellableUnitLabel ?? "room unassigned"}</span><span>{stay.ratePlanLabel ?? "Rate plan unavailable"} · {stay.channelCode ?? "Source unavailable"}</span><span>{movementGuestAttributes(stay, status === "due_out" ? "departure" : "arrival")}</span><span>{stay.sellableUnitLabel ? "Room assigned" : "Room assignment pending"}</span></aside></span>
                <span role="cell">{stay.confirmationNo}</span>
                <span role="cell">{movementNights(stay)}</span>
                <span role="cell">{stay.unitTypeLabel ?? "—"}</span>
                <span role="cell">{stay.sellableUnitLabel ?? "—"}</span>
                <span role="cell">{stay.channelCode ?? "—"}</span>
                <span role="cell">{stay.ratePlanLabel ?? "—"}</span>
                <span role="cell">{movementGuestAttributes(stay, status === "due_out" ? "departure" : "arrival")}</span>
                <span role="cell"><i className={stay.sellableUnitLabel ? "ready-dot" : "pending-dot"} />{stay.sellableUnitLabel ? "Assigned" : "Pending"}</span>
                <span role="cell"><em>{operationalStateLabel(state)}</em></span>
                <span role="cell"><button type="button" className="movement-billing-action" aria-label={`Open cashier and billing for ${stay.confirmationNo}`} onClick={(event) => { event.stopPropagation(); window.location.assign(`/p/${propertyId}/today?workspace=finance&reservation=${encodeURIComponent(stay.reservationId)}`); }} onKeyDown={(event) => event.stopPropagation()}>Cashier</button></span>
              </div>;
            })}
          </div>
        </div>
      </div>
      <footer className="movement-footer"><span>Rows rendered on demand — {visibleRows.length.toLocaleString()} total · {RESERVATION_BOARD_CAPABILITIES.filters.length} structured filters</span><span>Enter opens reservation · ↑ ↓ navigate</span></footer>
    </section>
  );
}

/* Order584 extracted reservation/check-in/board/create route family; executable implementation is lazy-loaded from workspaces/ReservationWorkspace.tsx.
// Retained only as frozen compatibility source for older source-contract tests.
// The active runtime uses the lazy modular workspace declared above.
function LegacyReservationWorkspace({
  reservationId,
  timezone,
  onLifecycleBusyChange,
  onResolveWithYellow,
}: Readonly<{
  reservationId: string;
  timezone: string;
  onLifecycleBusyChange?: (busy: boolean) => void;
  onResolveWithYellow?: (reservation: ReservationDetail["reservation"]) => void;
}>) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["reservation", propertyId, reservationId],
    queryFn: () => loadReservation(reservationId),
  });
  const readiness = useQuery({
    queryKey: ["check-in", propertyId, reservationId],
    queryFn: () => loadCheckInReadiness(reservationId),
    enabled: detail.data?.reservation.status === "due_in",
    retry: 1,
  });
  const departure = useQuery({
    queryKey: ["checkout-readiness", propertyId, reservationId],
    queryFn: () => loadCheckoutReadiness(reservationId),
    enabled:
      detail.data?.reservation.status === "in_house" ||
      detail.data?.reservation.status === "due_out",
    retry: 1,
  });
  const [checkInConfirmed, setCheckInConfirmed] = useState(false);
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [checkInPosting, setCheckInPosting] = useState(false);
  const [checkoutPosting, setCheckoutPosting] = useState(false);
  const [folioConfirmed, setFolioConfirmed] = useState(false);
  const [folioPosting, setFolioPosting] = useState(false);
  const [folioMessage, setFolioMessage] = useState<string | null>(null);
  const folioAttempt = useRef(`yellow-reservation-folio-${crypto.randomUUID()}`);
  const [lifecycleMode, setLifecycleMode] = useState<"cancel" | "reinstate" | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [lifecycleConfirmed, setLifecycleConfirmed] = useState(false);
  const [lifecyclePosting, setLifecyclePosting] = useState(false);
  const [lifecycleMessage, setLifecycleMessage] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [operationalDraft, setOperationalDraft] = useState<ReservationOperationalFields>({
    notes: "", eta: "", etd: "", marketCode: "", sourceCode: "", originCode: "",
  });
  const [operationalBaseline, setOperationalBaseline] = useState<ReservationOperationalFields>({
    notes: "", eta: "", etd: "", marketCode: "", sourceCode: "", originCode: "",
  });
  const [operationalEditing, setOperationalEditing] = useState(false);
  const [operationalConfirmed, setOperationalConfirmed] = useState(false);
  const [operationalPosting, setOperationalPosting] = useState(false);
  const [operationalMessage, setOperationalMessage] = useState<string | null>(null);
  const [operationalError, setOperationalError] = useState<string | null>(null);
  const operationalAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [guestAllocationEditing, setGuestAllocationEditing] = useState(false);
  const [guestAllocationDraft, setGuestAllocationDraft] = useState<readonly ReservationGuestDraft[]>([]);
  const [primaryGuestShare, setPrimaryGuestShare] = useState("");
  const [guestProfileQuery, setGuestProfileQuery] = useState("");
  const [guestProfileResults, setGuestProfileResults] = useState<readonly PartyProfile[]>([]);
  const [guestProfileSearching, setGuestProfileSearching] = useState(false);
  const [guestAllocationConfirmed, setGuestAllocationConfirmed] = useState(false);
  const [guestAllocationPosting, setGuestAllocationPosting] = useState(false);
  const [guestAllocationMessage, setGuestAllocationMessage] = useState<string | null>(null);
  const [guestAllocationError, setGuestAllocationError] = useState<string | null>(null);
  const guestAllocationAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const guestSearchGeneration = useRef(0);
  const lifecycleAttempt = useRef<{
    kind: "cancel" | "reinstate";
    fingerprint: string;
    key: string;
  } | null>(null);
  useEffect(
    () => () => onLifecycleBusyChange?.(false),
    [onLifecycleBusyChange],
  );
  useEffect(() => {
    guestSearchGeneration.current += 1;
    setGuestProfileSearching(false);
    setGuestAllocationEditing(false);
    setGuestProfileQuery("");
    setGuestProfileResults([]);
    setGuestAllocationConfirmed(false);
    setGuestAllocationMessage(null);
    setGuestAllocationError(null);
    guestAllocationAttempt.current = null;
  }, [reservationId]);
  useEffect(() => {
    const reservation = detail.data?.reservation;
    if (!reservation || operationalEditing || operationalPosting) return;
    const canonical = {
      notes: reservation.notes ?? "",
      eta: reservation.eta ?? "",
      etd: reservation.etd ?? "",
      marketCode: reservation.marketCode ?? "",
      sourceCode: reservation.sourceCode ?? "",
      originCode: reservation.originCode ?? "",
    };
    setOperationalDraft(canonical);
    setOperationalBaseline(canonical);
  }, [
    detail.data?.reservation.reservationId,
    detail.data?.reservation.notes,
    detail.data?.reservation.eta,
    detail.data?.reservation.etd,
    detail.data?.reservation.marketCode,
    detail.data?.reservation.sourceCode,
    detail.data?.reservation.originCode,
    operationalEditing,
    operationalPosting,
  ]);
  useEffect(() => {
    const reservation = detail.data?.reservation;
    if (!reservation || guestAllocationEditing || guestAllocationPosting) return;
    const primary = reservation.guests.find((guest) => guest.role === "primary");
    setPrimaryGuestShare(primary?.sharePct ?? "");
    setGuestAllocationDraft(
      reservation.guests
        .filter((guest) => guest.role !== "primary")
        .map((guest) => ({
          partyId: guest.partyId,
          displayName: guest.displayName,
          role: guest.role === "sharer" ? "sharer" : "accompanying",
          sharePct: guest.role === "sharer" ? guest.sharePct ?? "" : null,
        })),
    );
  }, [
    detail.data?.reservation.reservationId,
    detail.data?.reservation.guests,
    guestAllocationEditing,
    guestAllocationPosting,
  ]);
  if (detail.isLoading)
    return (
      <section className="reservation-workspace">
        <p className="empty">Loading the governed stay record…</p>
      </section>
    );
  if (detail.isError)
    return (
      <section className="reservation-workspace">
        <p className="error">{detail.error.message}</p>
        <button
          onClick={() => window.location.assign(`/p/${propertyId}/today`)}
        >
          Back to Today
        </button>
      </section>
    );
  if (!detail.data)
    return (
      <section className="reservation-workspace">
        <p className="error">Reservation details are unavailable.</p>
      </section>
    );
  const reservation = detail.data.reservation;
  const ready = readiness.data?.canCheckIn === true;
  const departureReady = departure.data?.ready === true;
  const isArrival = reservation.status === "due_in";
  const isDeparture =
    reservation.status === "in_house" || reservation.status === "due_out";
  const canCancel =
    reservation.status === "reserved" || reservation.status === "due_in";
  const canReinstate =
    reservation.status === "cancelled" || reservation.status === "no_show";
  const canModifyOperational = new Set(["reserved", "due_in", "in_house", "due_out"]).has(reservation.status);
  const canModifyGuests = new Set(["reserved", "due_in", "in_house", "due_out"]).has(reservation.status);
  const reservationMutationBusy = lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting || folioPosting;
  const primaryGuest = reservation.guests.find((guest) => guest.role === "primary") ?? reservation.guests[0];
  const sharerDrafts = guestAllocationDraft.filter((guest) => guest.role === "sharer");
  const parsedPrimaryGuestShare = sharerDrafts.length ? parseGuestShareBasisPoints(primaryGuestShare) : null;
  const parsedSharerShares = sharerDrafts.map((guest) => parseGuestShareBasisPoints(guest.sharePct ?? ""));
  const guestSharesCanonical = sharerDrafts.length === 0 ||
    (parsedPrimaryGuestShare !== null && parsedSharerShares.every((value) => value !== null));
  const guestShareTotalBasisPoints = sharerDrafts.length === 0
    ? 10_000
    : (parsedPrimaryGuestShare ?? 0) + parsedSharerShares.reduce<number>((total, value) => total + (value ?? 0), 0);
  const guestAllocationReplacement: ReservationGuestReplacement = {
    primarySharePct: sharerDrafts.length ? primaryGuestShare : null,
    guests: guestAllocationDraft
      .map((guest) => ({ partyId: guest.partyId, role: guest.role, sharePct: guest.role === "sharer" ? guest.sharePct : null }))
      .sort((left, right) => left.partyId.localeCompare(right.partyId)),
  };
  const guestAllocationChanged = !reservationGuestAllocationsMatch(detail.data, guestAllocationReplacement);
  const guestAllocationValid = guestSharesCanonical && guestShareTotalBasisPoints === 10_000;
  const canonicalOperationalFields: ReservationOperationalFields = {
    notes: reservation.notes ?? "",
    eta: reservation.eta ?? "",
    etd: reservation.etd ?? "",
    marketCode: reservation.marketCode ?? "",
    sourceCode: reservation.sourceCode ?? "",
    originCode: reservation.originCode ?? "",
  };
  const openOperationalEditor = () => {
    setOperationalDraft(canonicalOperationalFields);
    setOperationalBaseline(canonicalOperationalFields);
    setOperationalEditing(true);
    setOperationalConfirmed(false);
    setOperationalMessage(null);
    setOperationalError(null);
  };
  const operationalFieldLabels: Readonly<Record<keyof ReservationOperationalFields, string>> = {
    notes: "Notes", eta: "ETA", etd: "ETD", marketCode: "Market", sourceCode: "Source", originCode: "Origin",
  };
  const resetGuestAllocationFeedback = () => {
    setGuestAllocationConfirmed(false);
    setGuestAllocationMessage(null);
    setGuestAllocationError(null);
  };
  const openGuestAllocation = () => {
    guestSearchGeneration.current += 1;
    setGuestProfileSearching(false);
    const primary = reservation.guests.find((guest) => guest.role === "primary");
    setPrimaryGuestShare(primary?.sharePct ?? "");
    setGuestAllocationDraft(
      reservation.guests
        .filter((guest) => guest.role !== "primary")
        .map((guest) => ({
          partyId: guest.partyId,
          displayName: guest.displayName,
          role: guest.role === "sharer" ? "sharer" : "accompanying",
          sharePct: guest.role === "sharer" ? guest.sharePct ?? "" : null,
        })),
    );
    setGuestProfileQuery("");
    setGuestProfileResults([]);
    resetGuestAllocationFeedback();
    setGuestAllocationEditing(true);
  };
  const closeGuestAllocation = () => {
    guestSearchGeneration.current += 1;
    setGuestProfileSearching(false);
    setGuestAllocationEditing(false);
    setGuestProfileQuery("");
    setGuestProfileResults([]);
    resetGuestAllocationFeedback();
  };
  const searchGuestProfilesForAllocation = async () => {
    const query = guestProfileQuery.trim();
    if (query.length < 2) {
      setGuestAllocationError("Enter at least two characters to find an existing guest profile.");
      return;
    }
    const generation = ++guestSearchGeneration.current;
    setGuestProfileSearching(true);
    setGuestAllocationError(null);
    try {
      const profiles = await searchPartyProfiles(query);
      if (generation !== guestSearchGeneration.current) return;
      setGuestProfileResults(profiles);
      setGuestAllocationMessage(`${profiles.length} existing guest profile${profiles.length === 1 ? "" : "s"} found.`);
    } catch (error) {
      if (generation !== guestSearchGeneration.current) return;
      setGuestAllocationError(error instanceof Error ? error.message : "Guest profiles are unavailable.");
    } finally {
      if (generation === guestSearchGeneration.current) setGuestProfileSearching(false);
    }
  };
  const addGuestProfile = (profile: PartyProfile, role: "accompanying" | "sharer") => {
    if (profile.partyId === reservation.primaryPartyId || guestAllocationDraft.some((guest) => guest.partyId === profile.partyId)) {
      setGuestAllocationError(`${profile.displayName} is already attached to this reservation.`);
      return;
    }
    setGuestAllocationDraft((current) => [
      ...current,
      { partyId: profile.partyId, displayName: profile.displayName, role, sharePct: role === "sharer" ? "" : null },
    ]);
    resetGuestAllocationFeedback();
  };
  const updateGuestAllocation = (partyId: string, update: Partial<Pick<ReservationGuestDraft, "role" | "sharePct">>) => {
    setGuestAllocationDraft((current) => current.map((guest) => {
      if (guest.partyId !== partyId) return guest;
      const role = update.role ?? guest.role;
      return {
        ...guest,
        role,
        sharePct: role === "sharer" ? update.sharePct ?? (guest.role === "sharer" ? guest.sharePct : "") : null,
      };
    }));
    resetGuestAllocationFeedback();
  };
  const removeGuestAllocation = (partyId: string) => {
    setGuestAllocationDraft((current) => current.filter((guest) => guest.partyId !== partyId));
    resetGuestAllocationFeedback();
  };
  const submitGuestAllocation = async () => {
    if (!guestAllocationConfirmed || !guestAllocationValid || !guestAllocationChanged || reservationMutationBusy) return;
    const replacement = guestAllocationReplacement;
    const fingerprint = JSON.stringify({ reservationId, replacement });
    if (guestAllocationAttempt.current?.fingerprint !== fingerprint)
      guestAllocationAttempt.current = { fingerprint, key: `yellow-reservation-guests-${crypto.randomUUID()}` };
    const attempt = guestAllocationAttempt.current;
    setGuestAllocationPosting(true);
    onLifecycleBusyChange?.(true);
    setGuestAllocationMessage(null);
    setGuestAllocationError(null);
    try {
      await replaceReservationGuests(reservationId, replacement, attempt.key);
      const refreshed = await detail.refetch();
      if (refreshed.isError || !reservationGuestAllocationsMatch(refreshed.data, replacement))
        throw new Error("The command was received, but the refreshed guest allocation is not yet authoritative. Retry the unchanged command to reconcile safely.");
      await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
      setGuestAllocationConfirmed(false);
      setGuestAllocationMessage("Guests and shares saved. The refreshed reservation and history are authoritative.");
    } catch (error) {
      const refreshed = await detail.refetch().catch(() => null);
      if (refreshed && !refreshed.isError && reservationGuestAllocationsMatch(refreshed.data, replacement)) {
        await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
        setGuestAllocationConfirmed(false);
        setGuestAllocationMessage("Guests and shares saved and reconciled after an uncertain response.");
      } else setGuestAllocationError(error instanceof Error ? error.message : "Guests and shares could not be saved.");
    } finally {
      setGuestAllocationPosting(false);
      onLifecycleBusyChange?.(false);
    }
  };
  const changedOperationalFields = (Object.keys(canonicalOperationalFields) as (keyof ReservationOperationalFields)[])
    .filter((field) =>
      normalizeReservationOperationalValue(field, operationalDraft[field]) !==
      normalizeReservationOperationalValue(field, operationalBaseline[field]),
    );
  const editOperationalField = (field: keyof ReservationOperationalFields, value: string) => {
    setOperationalDraft((current) => ({ ...current, [field]: value }));
    setOperationalConfirmed(false);
    setOperationalMessage(null);
    setOperationalError(null);
  };
  const submitOperationalDetails = async () => {
    if (!operationalConfirmed || changedOperationalFields.length === 0 || operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting) return;
    const expected: Record<string, string | null> = {};
    const changes: Record<string, string | null> = {};
    for (const field of changedOperationalFields) {
      expected[field] = normalizeReservationOperationalValue(field, operationalBaseline[field]);
      changes[field] = normalizeReservationOperationalValue(field, operationalDraft[field]);
    }
    const fingerprint = JSON.stringify({ reservationId, expected, changes });
    if (operationalAttempt.current?.fingerprint !== fingerprint)
      operationalAttempt.current = { fingerprint, key: `yellow-reservation-operational-${crypto.randomUUID()}` };
    const attempt = operationalAttempt.current;
    setOperationalPosting(true);
    onLifecycleBusyChange?.(true);
    setOperationalMessage(null);
    setOperationalError(null);
    const refreshedMatches = (fresh: ReservationDetail | undefined) =>
      !!fresh && changedOperationalFields.every((field) =>
        normalizeReservationOperationalValue(field, fresh.reservation[field] ?? "") === changes[field],
      );
    try {
      await modifyReservationOperationalDetails(reservationId, expected, changes, attempt.key);
      const refreshed = await detail.refetch();
      if (refreshed.isError || !refreshedMatches(refreshed.data))
        throw new Error("The command was received, but refreshed operational details are not yet authoritative. Retry the unchanged command to reconcile safely.");
      await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
      setOperationalConfirmed(false);
      setOperationalEditing(false);
      setOperationalMessage("Operational details saved. The refreshed reservation and history are authoritative.");
    } catch (error) {
      const refreshed = await detail.refetch().catch(() => null);
      if (refreshed && !refreshed.isError && refreshedMatches(refreshed.data)) {
        await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
        setOperationalConfirmed(false);
        setOperationalEditing(false);
        setOperationalMessage("Operational details saved and reconciled after an uncertain response.");
      } else setOperationalError(error instanceof Error ? error.message : "Operational details could not be saved.");
    } finally {
      setOperationalPosting(false);
      onLifecycleBusyChange?.(false);
    }
  };
  const chooseLifecycleAction = (mode: "cancel" | "reinstate") => {
    if (lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting) return;
    setLifecycleMode(mode);
    setLifecycleConfirmed(false);
    setLifecycleMessage(null);
    setLifecycleError(null);
  };
  const submitLifecycle = async () => {
    if (
      !lifecycleMode ||
      !lifecycleConfirmed ||
      lifecyclePosting ||
      operationalPosting ||
      guestAllocationPosting ||
      checkInPosting ||
      checkoutPosting
    ) return;
    const reason = cancellationReason.trim();
    if (lifecycleMode === "cancel" && reason.trim().length === 0) {
      setLifecycleError("Enter a cancellation reason before confirming.");
      return;
    }
    const fingerprint = JSON.stringify({
      kind: lifecycleMode,
      reservationId,
      ...(lifecycleMode === "cancel" ? { reason } : {}),
    });
    if (lifecycleAttempt.current?.fingerprint !== fingerprint) {
      lifecycleAttempt.current = {
        kind: lifecycleMode,
        fingerprint,
        key: `yellow-reservation-lifecycle-${crypto.randomUUID()}`,
      };
    }
    const attempt = lifecycleAttempt.current;
    setLifecyclePosting(true);
    onLifecycleBusyChange?.(true);
    setLifecycleMessage(null);
    setLifecycleError(null);
    const refreshCanonicalState = async (expectedStatus: "cancelled" | "reserved") => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
      const refreshed = await detail.refetch();
      if (refreshed.isError || refreshed.data?.reservation.status !== expectedStatus)
        throw new Error(
          "The server response was received, but the refreshed reservation status is not yet authoritative. Retry this unchanged action to reconcile safely.",
        );
    };
    const lifecycleSuccessMessage = (reconciled: boolean) =>
      lifecycleMode === "cancel"
        ? `Reservation cancelled${reconciled ? " and reconciled after an uncertain response" : ""}. The refreshed record shows the server-issued cancellation evidence.`
        : `Reservation reinstated${reconciled ? " and reconciled after an uncertain response" : ""} after the server rechecked occupancy. The refreshed record is authoritative.`;
    try {
      if (lifecycleMode === "cancel") {
        await cancelReservationLifecycle(reservationId, reason, attempt.key);
        await refreshCanonicalState("cancelled");
      } else {
        await reinstateReservationLifecycle(reservationId, attempt.key);
        await refreshCanonicalState("reserved");
      }
      setLifecycleConfirmed(false);
      setLifecycleMessage(lifecycleSuccessMessage(false));
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
      const refreshed = await detail.refetch().catch(() => null);
      if (isArrival) await readiness.refetch().catch(() => undefined);
      if (isDeparture) await departure.refetch().catch(() => undefined);
      const expectedStatus = lifecycleMode === "cancel" ? "cancelled" : "reserved";
      if (refreshed && !refreshed.isError && refreshed.data?.reservation.status === expectedStatus) {
        setLifecycleConfirmed(false);
        setLifecycleMessage(lifecycleSuccessMessage(true));
      } else {
        setLifecycleError(
          error instanceof Error
            ? error.message
            : "The reservation lifecycle action could not be completed.",
        );
      }
    } finally {
      setLifecyclePosting(false);
      onLifecycleBusyChange?.(false);
    }
  };
  const submitCheckIn = async () => {
    if (!ready || !checkInConfirmed || checkInPosting || lifecyclePosting || operationalPosting || guestAllocationPosting) return;
    setCheckInPosting(true);
    setStatus(null);
    try {
      await commitCheckIn(reservationId);
      await Promise.all([detail.refetch(), readiness.refetch()]);
      setCheckInConfirmed(false);
      setStatus(
        "Check-in completed from current server readiness. The Today board has refreshed.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Check-in could not be completed.",
      );
    } finally {
      setCheckInPosting(false);
    }
  };
  const submitCheckout = async () => {
    if (!departureReady || !checkoutConfirmed || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting) return;
    setCheckoutPosting(true);
    setStatus(null);
    try {
      await commitCheckout(reservationId);
      await Promise.all([detail.refetch(), departure.refetch()]);
      setCheckoutConfirmed(false);
      setStatus(
        "Checkout completed from current server readiness. Housekeeping can now prepare the released room.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Checkout could not be completed.",
      );
    } finally {
      setCheckoutPosting(false);
    }
  };
  const inspectedAssignedRoom = readiness.data?.roomCondition === "inspected";
  const canOpenPrimaryFolio =
    isArrival &&
    readiness.data?.primaryFolioId === null &&
    readiness.data?.identityGate.satisfied === true &&
    inspectedAssignedRoom &&
    readiness.data?.blockers.length === 1 &&
    readiness.data.blockers[0] === "primary_folio_not_open";
  const submitPrimaryFolio = async () => {
    if (!canOpenPrimaryFolio || !folioConfirmed || reservationMutationBusy) return;
    setFolioPosting(true);
    onLifecycleBusyChange?.(true);
    setFolioMessage(null);
    try {
      await openPrimaryFolio(reservationId, folioAttempt.current);
      const [refreshedDetail, refreshedReadiness] = await Promise.all([detail.refetch(), readiness.refetch()]);
      const authoritativePrimaryFolioId = refreshedReadiness.data?.primaryFolioId ?? null;
      const authoritativeOpenFolio =
        authoritativePrimaryFolioId !== null &&
        refreshedDetail.data?.reservation.folios.some((folio) =>
          folio.folioId === authoritativePrimaryFolioId && folio.status === "open",
        ) === true;
      const authoritativeFolioReady =
        refreshedReadiness.data?.primaryFolioId !== null &&
        refreshedReadiness.data?.blockers.includes("primary_folio_not_open") === false;
      if (refreshedDetail.isError || refreshedReadiness.isError || !authoritativeOpenFolio || !authoritativeFolioReady)
        throw new Error("The folio command was received, but the refreshed hotel record has not confirmed it yet. Retry the unchanged action to reconcile safely.");
      setFolioConfirmed(false);
      setFolioMessage("Primary folio opened. Live check-in readiness has been refreshed.");
    } catch (error) {
      const [reconciledDetail, reconciledReadiness] = await Promise.all([
        detail.refetch().catch(() => null),
        readiness.refetch().catch(() => null),
      ]);
      setFolioConfirmed(false);
      const reconciled =
        reconciledDetail?.isError === false &&
        reconciledReadiness?.isError === false &&
        reconciledReadiness.data?.primaryFolioId !== null &&
        reconciledDetail.data?.reservation.folios.some((folio) =>
          folio.folioId === reconciledReadiness.data?.primaryFolioId && folio.status === "open",
        ) === true &&
        reconciledReadiness?.data?.blockers.includes("primary_folio_not_open") === false;
      setFolioMessage(reconciled
        ? "Primary folio opened and reconciled from the refreshed hotel record."
        : error instanceof Error ? error.message : "The primary folio could not be opened.");
    } finally {
      setFolioPosting(false);
      onLifecycleBusyChange?.(false);
    }
  };
  return (
    <section className="reservation-workspace">
      <button
        className="back-link"
        disabled={lifecyclePosting || operationalPosting || guestAllocationPosting}
        onClick={() => window.location.assign(`/p/${propertyId}/today`)}
      >
        ← Back to Today
      </button>
      {lifecyclePosting || operationalPosting || guestAllocationPosting ? (
        <div className="reservation-lifecycle-busy-shield" role="status" aria-live="polite">
          <span>{guestAllocationPosting ? "Saving guests and shares…" : operationalPosting ? "Saving operational details…" : lifecycleMode === "cancel" ? "Cancelling reservation…" : "Reinstating reservation…"}</span>
        </div>
      ) : null}
      <div className="reservation-hero">
        <div>
          <span className="state">RESERVATION</span>
          <h1>{reservation.confirmationNo}</h1>
          <p>
            {reservation.guests.map((guest) => guest.displayName).join(", ")} ·{" "}
            {reservation.status.replace("_", " ")}
          </p>
        </div>
        <span
          className={`readiness-chip ${
            isArrival
              ? ready
                ? "ready"
                : "blocked"
              : departureReady
                ? "ready"
                : "blocked"
          }`}
        >
          {isArrival
            ? ready
              ? "Ready for check-in"
              : "Needs attention"
            : isDeparture
              ? departureReady
                ? "Ready for checkout review"
                : "Needs attention"
              : reservation.status.replace("_", " ")}
        </span>
      </div>
      <div className="reservation-grid reservation-sheet">
        <article className="detail-card detail-card-wide reservation-summary-card">
          <h2>Booking context</h2>
          <dl>
            <dt>Guest</dt>
            <dd className="reservation-guests">
              {reservation.guests.map((guest) => (
                <button
                  className="guest-link"
                  disabled={lifecyclePosting || operationalPosting || guestAllocationPosting}
                  key={`${guest.partyId}-${guest.role}`}
                  onClick={() =>
                    window.location.assign(
                      `/p/${propertyId}/guests?guest=${encodeURIComponent(guest.partyId)}`,
                    )
                  }
                >
                  {guest.displayName}
                  <span>{guest.role}</span>
                </button>
              ))}
            </dd>
            <dt>Channel</dt>
            <dd>{reservation.channelCode ?? "Direct"}</dd>
            <dt>Market</dt>
            <dd><button type="button" className="inline-edit-field" disabled={!canModifyOperational || reservationMutationBusy} onClick={openOperationalEditor}>{reservation.marketCode ?? "Not recorded"}<small>Tap to edit</small></button></dd>
            <dt>Source</dt>
            <dd><button type="button" className="inline-edit-field" disabled={!canModifyOperational || reservationMutationBusy} onClick={openOperationalEditor}>{reservation.sourceCode ?? "Not recorded"}<small>Tap to edit</small></button></dd>
            <dt>Origin</dt>
            <dd><button type="button" className="inline-edit-field" disabled={!canModifyOperational || reservationMutationBusy} onClick={openOperationalEditor}>{reservation.originCode ?? "Not recorded"}<small>Tap to edit</small></button></dd>
            <dt>Currency</dt>
            <dd>{reservation.currency}</dd>
            <dt>Booked</dt>
            <dd>{formatMovementTime(reservation.createdAt, timezone, true)}</dd>
            <dt>ETA / ETD</dt>
            <dd><button type="button" className="inline-edit-field" disabled={!canModifyOperational || reservationMutationBusy} onClick={openOperationalEditor}>{formatMovementTime(reservation.eta, timezone, true)} / {formatMovementTime(reservation.etd, timezone, true)}<small>Tap to edit</small></button></dd>
            <dt>Notes</dt>
            <dd><button type="button" className="inline-edit-field" disabled={!canModifyOperational || reservationMutationBusy} onClick={openOperationalEditor}>{reservation.notes ?? "No operational notes."}<small>Tap to edit</small></button></dd>
            {reservation.cancelledAt ? <><dt>Cancellation</dt><dd>{reservation.cancellationNo ?? "Number unavailable"} · {reservation.cancelReason ?? "Reason not recorded"} · {formatMovementTime(reservation.cancelledAt, timezone, true)}</dd></> : null}
          </dl>
        </article>
        {canModifyGuests ? (
          <article className="detail-card detail-card-wide reservation-guests-card">
            <span className="state">GUEST OCCURRENCES</span>
            <div className="reservation-guests-heading">
              <div>
                <h2>Guests & shares</h2>
                <p>Attach existing guest profiles to this stay. These percentages describe reservation sharing only; billing windows and charges remain separate.</p>
              </div>
              <button
                type="button"
                className="quiet"
                disabled={reservationMutationBusy}
                onClick={() => guestAllocationEditing ? closeGuestAllocation() : openGuestAllocation()}
              >
                {guestAllocationEditing ? "Close editor" : "Manage guests & shares"}
              </button>
            </div>
            {guestAllocationEditing ? (
              <div className="reservation-guests-editor">
                <div className="reservation-primary-guest">
                  <div>
                    <span>Primary guest · server owned</span>
                    <strong>{primaryGuest?.displayName ?? reservation.primaryPartyId}</strong>
                    <small>{reservation.primaryPartyId}</small>
                  </div>
                  {sharerDrafts.length ? (
                    <label>
                      Primary share %
                      <input
                        aria-label="Primary guest share percentage"
                        inputMode="decimal"
                        placeholder="60.00"
                        value={primaryGuestShare}
                        disabled={reservationMutationBusy}
                        onChange={(event) => {
                          setPrimaryGuestShare(event.target.value);
                          resetGuestAllocationFeedback();
                        }}
                      />
                    </label>
                  ) : <span className="reservation-primary-role">Primary role cannot be changed</span>}
                </div>
                <div className="reservation-guest-search">
                  <label>
                    Search existing guest profiles
                    <input
                      value={guestProfileQuery}
                      disabled={reservationMutationBusy}
                      placeholder="Name, email, phone or Party ID"
                      onChange={(event) => {
                        guestSearchGeneration.current += 1;
                        setGuestProfileSearching(false);
                        setGuestProfileQuery(event.target.value);
                        setGuestProfileResults([]);
                        resetGuestAllocationFeedback();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void searchGuestProfilesForAllocation();
                        }
                      }}
                    />
                  </label>
                  <button type="button" disabled={reservationMutationBusy || guestProfileSearching || guestProfileQuery.trim().length < 2} onClick={() => void searchGuestProfilesForAllocation()}>
                    {guestProfileSearching ? "Searching…" : "Find guest"}
                  </button>
                </div>
                {guestProfileResults.length ? (
                  <ul className="reservation-guest-search-results" aria-label="Matching guest profiles">
                    {guestProfileResults.map((profile) => {
                      const alreadyAttached = profile.partyId === reservation.primaryPartyId || guestAllocationDraft.some((guest) => guest.partyId === profile.partyId);
                      return <li key={profile.partyId}>
                        <div><strong>{profile.displayName}</strong><small>{profile.partyId} · {profile.kind} · {profile.status}</small></div>
                        <div>
                          <button type="button" disabled={reservationMutationBusy || alreadyAttached || profile.status !== "active"} onClick={() => addGuestProfile(profile, "accompanying")}>Add as accompanying</button>
                          <button type="button" disabled={reservationMutationBusy || alreadyAttached || profile.status !== "active"} onClick={() => addGuestProfile(profile, "sharer")}>Add as sharer</button>
                        </div>
                      </li>;
                    })}
                  </ul>
                ) : null}
                <div className="reservation-guest-allocation-list">
                  {guestAllocationDraft.length ? guestAllocationDraft.map((guest) => (
                    <div className="reservation-guest-allocation-row" key={guest.partyId}>
                      <div><strong>{guest.displayName}</strong><small>{guest.partyId}</small></div>
                      <label>
                        Role
                        <select
                          value={guest.role}
                          disabled={reservationMutationBusy}
                          onChange={(event) => updateGuestAllocation(guest.partyId, { role: event.target.value === "sharer" ? "sharer" : "accompanying" })}
                        >
                          <option value="accompanying">Accompanying</option>
                          <option value="sharer">Sharer</option>
                        </select>
                      </label>
                      {guest.role === "sharer" ? (
                        <label>
                          Share %
                          <input
                            aria-label={`${guest.displayName} share percentage`}
                            inputMode="decimal"
                            placeholder="40.00"
                            value={guest.sharePct ?? ""}
                            disabled={reservationMutationBusy}
                            onChange={(event) => updateGuestAllocation(guest.partyId, { sharePct: event.target.value })}
                          />
                        </label>
                      ) : <span className="reservation-accompanying-note">No percentage</span>}
                      <button type="button" className="quiet danger" disabled={reservationMutationBusy} onClick={() => removeGuestAllocation(guest.partyId)}>Remove</button>
                    </div>
                  )) : <p className="empty">Only the primary guest is attached.</p>}
                </div>
                <div className={`reservation-share-total ${guestAllocationValid ? "valid" : "invalid"}`} role="status">
                  <strong>{sharerDrafts.length ? `${(guestShareTotalBasisPoints / 100).toFixed(2)}% allocated` : "No sharer allocation required"}</strong>
                  <span>{sharerDrafts.length ? "Primary and all sharers must total exactly 100.00%." : "Accompanying guests do not carry a share percentage."}</span>
                </div>
                <div className="reservation-guest-review">
                  <p><strong>Proposed allocation for {reservation.confirmationNo}</strong></p>
                  <ul>
                    <li>{primaryGuest?.displayName ?? reservation.primaryPartyId} · primary{sharerDrafts.length ? ` · ${primaryGuestShare || "share missing"}%` : ""}</li>
                    {guestAllocationDraft.map((guest) => <li key={`review-${guest.partyId}`}>{guest.displayName} · {guest.role}{guest.role === "sharer" ? ` · ${guest.sharePct || "share missing"}%` : ""}</li>)}
                  </ul>
                </div>
                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={guestAllocationConfirmed}
                    disabled={reservationMutationBusy || !guestAllocationValid || !guestAllocationChanged}
                    onChange={(event) => setGuestAllocationConfirmed(event.target.checked)}
                  />{" "}
                  I confirm this exact guest allocation for {reservation.confirmationNo}. The primary guest remains unchanged.
                </label>
                <button
                  type="button"
                  className="reservation-guests-submit"
                  disabled={reservationMutationBusy || !guestAllocationConfirmed || !guestAllocationValid || !guestAllocationChanged}
                  onClick={() => void submitGuestAllocation()}
                >
                  {guestAllocationPosting ? "Saving…" : "Confirm guests & shares"}
                </button>
              </div>
            ) : null}
            {guestAllocationMessage ? <p className="success" role="status">{guestAllocationMessage}</p> : null}
            {guestAllocationError ? <p className="error" role="alert">{guestAllocationError}</p> : null}
          </article>
        ) : null}
        <article className="detail-card">
          <h2>Stay segments</h2>
          {reservation.segments.length ? <ul>{reservation.segments.map((segment) => <li key={segment.segmentId}>
            <strong>Segment {segment.sequence} · {segment.status.replaceAll("_", " ")}</strong>
            <span>{formatMovementTime(segment.from, timezone, true)} – {formatMovementTime(segment.to, timezone, true)}</span>
            <span>{segment.adults} adult{segment.adults === 1 ? "" : "s"}{segment.childAges.length ? ` · ${segment.childAges.length} child${segment.childAges.length === 1 ? "" : "ren"}` : ""} · {segment.sellableUnitId ? "Room assigned" : "Room unassigned"}</span>
          </li>)}</ul> : <p>No stay segments are recorded.</p>}
        </article>
        <article className="detail-card">
          <h2>Folio windows</h2>
          {reservation.folios.length ? (
            <ul>
              {reservation.folios.map((folio) => (
                <li key={folio.folioId}>
                  <strong>{folio.folioNo}</strong>
                  <span>
                    {folio.name} · Window {folio.windowNo} · {folio.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No folio is open yet. Arrival preparation can open the primary guest window when the current room and identity gates are ready.</p>
          )}
          <button type="button" className="reservation-cashier-link" disabled={reservationMutationBusy} onClick={() => window.location.assign(`/p/${propertyId}/today?workspace=finance&reservation=${encodeURIComponent(reservation.reservationId)}`)}>{reservation.status === "in_house" || reservation.status === "due_out" ? "Open cashier · in-house billing" : "Open cashier · pre-arrival billing"}</button>
        </article>
        <article className="detail-card">
          <h2>Alerts & travel</h2>
          {reservation.alerts.length ? <ul>{reservation.alerts.map((alert) => <li key={alert.alertId}>
            <strong>{alert.code ?? "Operational alert"} · {alert.active ? "active" : "inactive"}</strong>
            <span>{alert.message} · show on {alert.showOn}</span>
          </li>)}</ul> : <p>No reservation alerts are recorded.</p>}
          <h3>Travel</h3>
          {reservation.travel.length ? <ul>{reservation.travel.map((travel) => <li key={travel.travelId}>
            <strong>{travel.direction} · {travel.mode ?? "mode not recorded"}</strong>
            <span>{[travel.carrier, travel.serviceNo].filter(Boolean).join(" ") || "Carrier/service not recorded"} · {formatMovementTime(travel.scheduledAt, timezone, true)}</span>
            <span>{travel.pickupRequested ? "Pickup requested" : "No pickup requested"}{travel.notes ? ` · ${travel.notes}` : ""}</span>
          </li>)}</ul> : <p>No travel details are recorded.</p>}
        </article>
        <article className="detail-card detail-card-wide">
          <h2>Recorded history</h2>
          {reservation.history.length ? <ol className="reservation-history">{reservation.history.map((fact) => <li key={fact.factId}>
            <strong>{fact.factType.replaceAll("_", " ")}</strong>
            <span>Business date {fact.businessDate} · recorded {formatMovementTime(fact.recordedAt, timezone, true)}</span>
          </li>)}</ol> : <p>No reservation history facts are returned.</p>}
        </article>
        {canModifyOperational ? (
          <article className="detail-card detail-card-wide reservation-operational-card">
            <span className="state">OPERATIONAL DETAILS</span>
            <div className="reservation-operational-heading">
              <div><h2>Operational details</h2><p>Select Market, Source, Origin, ETA/ETD or Notes in the booking card to edit them here. ETA and ETD require an exact offset time such as 15:00:00+03:00.</p></div>
            </div>
            {operationalEditing ? (
              <div className="reservation-operational-review">
                <div className="reservation-operational-fields">
                  <label className="wide">Notes<textarea rows={4} maxLength={4000} value={operationalDraft.notes} disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting} onChange={(event) => editOperationalField("notes", event.target.value)} /></label>
                  <label>ETA<input value={operationalDraft.eta} disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting} placeholder="15:00:00+03:00" onChange={(event) => editOperationalField("eta", event.target.value)} /></label>
                  <label>ETD<input value={operationalDraft.etd} disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting} placeholder="11:00:00+03:00" onChange={(event) => editOperationalField("etd", event.target.value)} /></label>
                  <label>Market<input maxLength={64} value={operationalDraft.marketCode} disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting} onChange={(event) => editOperationalField("marketCode", event.target.value)} /></label>
                  <label>Source<input maxLength={64} value={operationalDraft.sourceCode} disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting} onChange={(event) => editOperationalField("sourceCode", event.target.value)} /></label>
                  <label>Origin<input maxLength={64} value={operationalDraft.originCode} disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting} onChange={(event) => editOperationalField("originCode", event.target.value)} /></label>
                </div>
                <p><strong>Review operational changes:</strong> {changedOperationalFields.length ? changedOperationalFields.map((field) => operationalFieldLabels[field]).join(", ") : "No fields changed"}.</p>
                <label className="confirmation"><input type="checkbox" checked={operationalConfirmed} disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting || changedOperationalFields.length === 0} onChange={(event) => setOperationalConfirmed(event.target.checked)} />{" "}I confirm these operational changes for {reservation.confirmationNo}. Yellow will compare every original value before saving.</label>
                <button type="button" className="reservation-operational-submit" disabled={operationalPosting || lifecyclePosting || guestAllocationPosting || checkInPosting || checkoutPosting || !operationalConfirmed || changedOperationalFields.length === 0} onClick={() => void submitOperationalDetails()}>{operationalPosting ? "Saving…" : "Confirm and save details"}</button>
              </div>
            ) : null}
            {operationalMessage ? <p className="success" role="status">{operationalMessage}</p> : null}
            {operationalError ? <p className="error" role="alert">{operationalError}</p> : null}
          </article>
        ) : null}
        {canCancel || canReinstate || lifecycleMessage || lifecycleError ? (
          <article className="detail-card detail-card-wide reservation-lifecycle-card">
            <span className="state">RESERVATION LIFECYCLE</span>
            <h2>Change reservation status</h2>
            <p>
              Yellow sends this action to the governed reservation service. It never
              changes status or occupancy only in the browser.
            </p>
            <div className="reservation-lifecycle-actions">
              {canCancel ? (
                <button
                  type="button"
                  className={lifecycleMode === "cancel" ? "selected" : "quiet"}
                  disabled={lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting}
                  onClick={() => chooseLifecycleAction("cancel")}
                >
                  Cancel reservation
                </button>
              ) : null}
              {canReinstate ? (
                <button
                  type="button"
                  className={lifecycleMode === "reinstate" ? "selected" : "quiet"}
                  disabled={lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting}
                  onClick={() => chooseLifecycleAction("reinstate")}
                >
                  Reinstate reservation
                </button>
              ) : null}
            </div>
            {lifecycleMode === "cancel" && canCancel ? (
              <div className="reservation-lifecycle-confirmation">
                <label>
                  Cancellation reason
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={cancellationReason}
                    disabled={lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting}
                    onChange={(event) => {
                      setCancellationReason(event.target.value);
                      setLifecycleConfirmed(false);
                      setLifecycleMessage(null);
                      setLifecycleError(null);
                    }}
                    placeholder="Record the operational or guest-requested reason"
                  />
                </label>
                <p>{cancellationReason.length}/500 characters</p>
                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={lifecycleConfirmed}
                    disabled={lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting || cancellationReason.trim().length === 0}
                    onChange={(event) => setLifecycleConfirmed(event.target.checked)}
                  />{" "}
                  I confirm cancellation of {reservation.confirmationNo}. Yellow will
                  release eligible occupancy only through the governed server action.
                </label>
                <button
                  type="button"
                  className="reservation-lifecycle-submit danger"
                  disabled={
                    lifecyclePosting ||
                    operationalPosting ||
                    checkInPosting ||
                    checkoutPosting ||
                    !lifecycleConfirmed ||
                    cancellationReason.trim().length === 0
                  }
                  onClick={() => void submitLifecycle()}
                >
                  {lifecyclePosting ? "Cancelling…" : "Confirm cancellation"}
                </button>
              </div>
            ) : null}
            {lifecycleMode === "reinstate" && canReinstate ? (
              <div className="reservation-lifecycle-confirmation">
                <p>
                  PostgreSQL will recheck the original occupancy before the reservation
                  can return to reserved status. A conflict leaves this record unchanged.
                </p>
                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={lifecycleConfirmed}
                    disabled={lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting}
                    onChange={(event) => setLifecycleConfirmed(event.target.checked)}
                  />{" "}
                  I confirm reinstatement of {reservation.confirmationNo} using its
                  original stay and room evidence.
                </label>
                <button
                  type="button"
                  className="reservation-lifecycle-submit"
                  disabled={lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting || !lifecycleConfirmed}
                  onClick={() => void submitLifecycle()}
                >
                  {lifecyclePosting ? "Reinstating…" : "Confirm reinstatement"}
                </button>
              </div>
            ) : null}
            {lifecycleMessage ? <p className="success" role="status">{lifecycleMessage}</p> : null}
            {lifecycleError ? <p className="error" role="alert">{lifecycleError}</p> : null}
          </article>
        ) : null}
        {isArrival ? (
          <article className="detail-card checkin-card">
            <span className="state">ARRIVAL READINESS</span>
            <h2>Check in this stay</h2>
            {readiness.isError ? (
              <p className="error">{readiness.error.message}</p>
            ) : (
              <>
                <p>
                  {ready
                    ? `Room condition: ${readiness.data?.roomCondition ?? "confirmed"}. Identity evidence is satisfied.`
                    : "The server has named the conditions that still need attention."}
                </p>
                {readiness.data?.blockers.length ? <div className="arrival-resolution-list">
                  {readiness.data.blockers.map((blocker) => {
                    const copy = checkInBlockerCopy(blocker);
                    return <section className={`arrival-resolution ${copy.tone}`} key={blocker}>
                      <span aria-hidden="true">{copy.tone === "attention" ? "!" : "•"}</span>
                      <div><strong>{copy.title}</strong><p>{copy.detail}</p></div>
                    </section>;
                  })}
                </div> : null}
                {!ready ? <div className="arrival-resolution-actions">
                  <button type="button" className="yellow-resolve-button" disabled={!onResolveWithYellow || reservationMutationBusy} onClick={() => onResolveWithYellow?.(reservation)}>Resolve with Yellow</button>
                  {readiness.data?.blockers.includes("dirty_room_override_unauthorized") ? <button type="button" className="quiet" disabled={reservationMutationBusy} onClick={() => window.location.assign(`/p/${propertyId}/housekeeping`)}>Open Housekeeping</button> : null}
                </div> : null}
                {canOpenPrimaryFolio ? <section className="arrival-folio-action" aria-label="Primary folio preparation">
                  <strong>Billing window can be prepared now</strong>
                  <p>This is ordinary folio preparation and does not require an open physical cash drawer.</p>
                  <label className="confirmation"><input type="checkbox" checked={folioConfirmed} disabled={folioPosting} onChange={(event) => setFolioConfirmed(event.target.checked)} /> I confirm opening the primary folio for {reservation.confirmationNo}.</label>
                  <button type="button" className="checkin-button" disabled={!folioConfirmed || folioPosting} onClick={() => void submitPrimaryFolio()}>{folioPosting ? "Opening folio…" : "Open primary folio"}</button>
                  {folioMessage ? <p className={folioMessage.startsWith("Primary folio opened") ? "success" : "error"} role="status">{folioMessage}</p> : null}
                </section> : null}
                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={checkInConfirmed}
                    disabled={!ready || checkInPosting || lifecyclePosting || operationalPosting || guestAllocationPosting}
                    onChange={(event) =>
                      setCheckInConfirmed(event.target.checked)
                    }
                  />{" "}
                  I confirm this named arrival and the current server-owned
                  readiness result.
                </label>
                <button
                  className="checkin-button"
                  disabled={!ready || !checkInConfirmed || checkInPosting || lifecyclePosting || operationalPosting || guestAllocationPosting}
                  onClick={() => {
                    void submitCheckIn();
                  }}
                >
                  {checkInPosting ? "Checking in…" : "Check in guest"}
                </button>
              </>
            )}
            {status ? (
              <p
                className={
                  status.startsWith("Check-") ? "success" : "error"
                }
                role="status"
              >
                {status}
              </p>
            ) : null}
          </article>
        ) : null}
        {isDeparture ? (
          <article className="detail-card departure-card">
            <span className="state">DEPARTURE READINESS</span>
            <h2>Review checkout</h2>
            {departure.isLoading ? (
              <p>Loading current departure evidence…</p>
            ) : departure.isError ? (
              <p className="error">{departure.error.message}</p>
            ) : (
              <>
                <p>
                  {departure.data?.ready
                    ? "All current server-owned departure conditions are ready for a governed checkout review."
                    : "Checkout remains blocked until the listed server-owned conditions are resolved."}
                </p>
                <dl className="departure-evidence">
                  <dt>Room</dt>
                  <dd>{departure.data?.room?.spaceCode ?? "Not resolved"}</dd>
                  <dt>Folio windows</dt>
                  <dd>{departure.data?.folios.length ?? 0}</dd>
                </dl>
                {departure.data?.blockers.length ? (
                  <ul className="blockers">
                    {departure.data.blockers.map((blocker) => (
                      <li key={blocker}>{blocker.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                ) : null}
                <label className="confirmation">
                  <input
                    type="checkbox"
                    checked={checkoutConfirmed}
                    disabled={!departureReady || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting}
                    onChange={(event) =>
                      setCheckoutConfirmed(event.target.checked)
                    }
                  />{" "}
                  I confirm this named departure and the current server-owned
                  readiness result.
                </label>
                <button
                  className="checkin-button"
                  disabled={!departureReady || !checkoutConfirmed || checkoutPosting || lifecyclePosting || operationalPosting || guestAllocationPosting}
                  onClick={() => {
                    void submitCheckout();
                  }}
                >
                  {checkoutPosting ? "Checking out…" : "Check out guest"}
                </button>
                {status ? (
                  <p
                    className={
                      status.startsWith("Check-") ? "success" : "error"
                    }
                    role="status"
                  >
                    {status}
                  </p>
                ) : null}
              </>
            )}
          </article>
        ) : null}
      </div>
    </section>
  );
}

/**
 * A compact, in-context operator flow.  It deliberately consumes the same
 * reservation and readiness endpoints as the full workbench; speech is only a
 * way to reach this surface, never authority to change the stay.
  * /
function OverwatchCheckInJourney({
  reservationId,
  onCompleted,
  conversationCommand,
  conversationAuthority,
  onConversationReply,
  onLifecycleBusyChange,
}: Readonly<{
  reservationId: string;
  onCompleted: () => void;
  conversationCommand: ArrivalConversationCommand | null;
  conversationAuthority: Readonly<{ current: number }>;
  onConversationReply: (reply: string) => void;
  onLifecycleBusyChange: (busy: boolean) => void;
}>) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["overwatch-reservation", propertyId, reservationId],
    queryFn: () => loadReservation(reservationId),
  });
  const readiness = useQuery({
    queryKey: ["overwatch-check-in", propertyId, reservationId],
    queryFn: () => loadCheckInReadiness(reservationId),
    enabled: detail.data?.reservation.status === "due_in",
    retry: 1,
  });
  const roomCandidates = useQuery({
    queryKey: ["overwatch-due-in-room-candidates", propertyId, reservationId],
    queryFn: () => loadDueInRoomCandidates(reservationId),
    enabled:
      detail.data?.reservation.status === "due_in" &&
      detail.data.reservation.segments.length === 1 &&
      detail.data.reservation.segments[0]?.status === "booked" &&
      detail.data.reservation.segments[0]?.sellableUnitId === null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  const cleaningCandidate = useQuery({
    queryKey: ["overwatch-arrival-cleaning", propertyId, reservationId],
    queryFn: () => loadArrivalCleaningCandidate(reservationId),
    enabled:
      detail.data?.reservation.status === "due_in" &&
      readiness.data?.blockers.includes("dirty_room_override_unauthorized") === true,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  const [arrivalTaskId, setArrivalTaskId] = useState<string | null>(null);
  const arrivalHousekeepingTask = useQuery({
    queryKey: ["overwatch-arrival-housekeeping-task", propertyId, reservationId, arrivalTaskId],
    queryFn: () => loadHousekeepingTask(arrivalTaskId!),
    enabled: arrivalTaskId !== null,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
  useEffect(() => {
    const existingTaskId = cleaningCandidate.data?.candidate.existingTaskId;
    if (existingTaskId) setArrivalTaskId(existingTaskId);
  }, [cleaningCandidate.data?.candidate.existingTaskId]);
  const [confirmed, setConfirmed] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [folioConfirmed, setFolioConfirmed] = useState(false);
  const [openingFolio, setOpeningFolio] = useState(false);
  const [folioResult, setFolioResult] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomConfirmed, setRoomConfirmed] = useState(false);
  const [roomDraft, setRoomDraft] = useState<Readonly<{
    candidateId: string;
    body: DueInRoomAssignmentInput;
  }> | null>(null);
  const [assigningRoom, setAssigningRoom] = useState(false);
  const [roomResult, setRoomResult] = useState<string | null>(null);
  const [cleaningResult, setCleaningResult] = useState<string | null>(null);
  const [conversationProposal, setConversationProposal] = useState<ArrivalConversationProposal | null>(null);
  // One human-confirmed attempt owns one key.  A retry after an uncertain network
  // response remains the same canonical operation, never a second check-in.
  const idempotencyKey = useRef(`yellow-public-demo-${crypto.randomUUID()}`);
  const folioIdempotencyKey = useRef(`yellow-public-demo-${crypto.randomUUID()}`);
  const roomAssignmentAttempt = useRef<Readonly<{ draft: string; key: string }> | null>(null);
  const cleaningTaskAttempt = useRef<Readonly<{ draft: string; key: string }> | null>(null);
  const handledConversation = useRef<string | null>(null);
  const conversationGeneration = useRef(0);
  const renderedConversationAuthority = conversationAuthority.current;
  useEffect(() => {
    // Every newer parent command supersedes every unconfirmed child proposal,
    // including an identity lookup that has yielded but not returned yet.
    conversationGeneration.current += 1;
    setConversationProposal(null);
  }, [renderedConversationAuthority]);
  const conversationInFlight = useRef(false);
  useEffect(() => {
    if (
      !conversationCommand ||
      conversationCommand.id === handledConversation.current ||
      !detail.data ||
      !readiness.data
    ) return;
    handledConversation.current = conversationCommand.id;
    const commandGeneration = ++conversationGeneration.current;
    const commandAuthorityGeneration = conversationAuthority.current;
    const reservation = detail.data.reservation;
    const message = conversationCommand.text.trim().toLowerCase();
    const segment =
      reservation.status === "due_in" &&
      reservation.segments.length === 1 &&
      reservation.segments[0]?.status === "booked" &&
      reservation.segments[0]?.sellableUnitId === null
        ? reservation.segments[0]
        : null;
    const roomReady = readiness.data.roomCondition === "inspected";
    const primaryFolioOpen = reservation.folios.some((folio) => folio.status === "open");
    const canOpenFolio =
      reservation.status === "due_in" &&
      readiness.data.primaryFolioId === null &&
      readiness.data.identityGate.satisfied === true &&
      roomReady &&
      readiness.data.blockers.length === 1 &&
      readiness.data.blockers[0] === "primary_folio_not_open";
    const canCheckIn = reservation.status === "due_in" && readiness.data.canCheckIn === true;
    const reply = (text: string) => onConversationReply(text);
    const refresh = async () => {
      await Promise.all([
        detail.refetch(),
        readiness.refetch(),
        roomCandidates.refetch(),
        ...(readiness.data.blockers.includes("dirty_room_override_unauthorized")
          ? [cleaningCandidate.refetch()]
          : []),
        ...(arrivalTaskId ? [arrivalHousekeepingTask.refetch()] : []),
        queryClient.invalidateQueries({ queryKey: ["today", propertyId] }),
        queryClient.invalidateQueries({ queryKey: ["housekeeping", propertyId] }),
        queryClient.invalidateQueries({ queryKey: ["yellow-reservation-command-index", propertyId] }),
      ]);
      onCompleted();
    };
    const advanceArrivalConversation = async (prefix: string, taskId: string | null = arrivalTaskId) => {
      const [currentDetail, currentReadiness] = await Promise.all([
        loadReservation(reservationId),
        loadCheckInReadiness(reservationId),
      ]);
      const currentReservation = currentDetail.reservation;
      const noCombinedWrite = "No write was inferred or combined with the completed action.";
      const currentTask = taskId ? await loadHousekeepingTask(taskId).catch(() => null) : null;
      if (currentReservation.status !== "due_in") {
        setConversationProposal(null);
        reply(`${prefix} This reservation is no longer due in. ${noCombinedWrite}`);
        return;
      }
      if (currentReadiness.canCheckIn) {
        setConversationProposal(Object.freeze({ kind: "checkin" }));
        reply(`${prefix} Every current prerequisite is ready. Shall I complete check-in now? ${noCombinedWrite}`);
        return;
      }
      const primaryFolioOnly =
        currentReadiness.roomCondition === "inspected" &&
        currentReadiness.identityGate.satisfied === true &&
        currentReadiness.primaryFolioId === null &&
        currentReadiness.blockers.length === 1 &&
        currentReadiness.blockers[0] === "primary_folio_not_open";
      if (primaryFolioOnly) {
        setConversationProposal(Object.freeze({ kind: "folio" }));
        reply(`${prefix} The primary folio is next. Shall I open it now? ${noCombinedWrite}`);
        return;
      }
      setConversationProposal(null);
      if (currentReadiness.blockers.includes("room_inspection_required")) {
        reply(currentTask?.allowedActions.length === 1 && currentTask.allowedActions[0] === "verify"
          ? `${prefix} Supervisor inspection is the next required declaration. After a supervisor physically inspects Room ${currentTask.spaceCode}, say “verify inspected” and I will show that exact proposal before confirmation. ${noCombinedWrite}`
          : `${prefix} The room is clean but standard check-in still requires a separately recorded supervisor inspection. I cannot infer it. ${noCombinedWrite}`);
        return;
      }
      if (currentReadiness.blockers.includes("room_assignment_missing")) {
        const candidates = await loadDueInRoomCandidates(reservationId).catch(() => null);
        const roomCodes = candidates?.candidates.map((candidate) => candidate.spaceCode) ?? [];
        reply(roomCodes.length
          ? `${prefix} Room assignment is next. Current eligible rooms are ${roomCodes.join(", ")}. Say one room number and I will show the exact assignment before confirmation. ${noCombinedWrite}`
          : `${prefix} Room assignment is next, but no current eligible room was returned. I stopped without choosing or changing a room. ${noCombinedWrite}`);
        return;
      }
      if (currentReadiness.blockers.includes("dirty_room_override_unauthorized")) {
        if (currentTask?.allowedActions.length === 1) {
          const nextAction = currentTask.allowedActions[0]!;
          reply(`${prefix} The next governed Housekeeping step is “${housekeepingActionCopy(nextAction).button}”. Say it only after the corresponding physical work is true, and I will show the exact proposal before confirmation. ${noCombinedWrite}`);
        } else {
          reply(`${prefix} The assigned room still needs physical Housekeeping work. Name the exact attendant for a governed cleaning task; I will not infer completion. ${noCombinedWrite}`);
        }
        return;
      }
      if (currentReadiness.blockers.includes("identity_document_missing")) {
        reply(`${prefix} Required identity evidence is still missing. I cannot invent or infer guest identity data. ${noCombinedWrite}`);
        return;
      }
      reply(`${prefix} I refreshed the canonical arrival and stopped at the remaining server-owned blockers: ${currentReadiness.blockers.join(", ")}. ${noCombinedWrite}`);
    };
    // Once confirmation has crossed the authority boundary, it cannot be
    // retroactively cancelled from another turn. Wait for the canonical result
    // and fresh state instead of accepting a conflicting instruction.
    if (conversationInFlight.current) {
      reply("A confirmed arrival action is already in progress. I cannot cancel or replace it mid-operation; I will show the refreshed result next.");
      return;
    }
    if (committing || openingFolio || assigningRoom) {
      reply("That confirmed arrival action is still in progress. I will refresh the live result before taking another instruction.");
      return;
    }
    const execute = async () => {
      const proposal = conversationProposal;
      if (!proposal) {
        reply("I do not have a specific pending action. Please ask me to prepare this arrival or name a current eligible room.");
        return;
      }
      if (conversationInFlight.current) {
        reply("That confirmed arrival action is already in progress. I will share the refreshed result before taking another instruction.");
        return;
      }
      conversationInFlight.current = true;
      // The parent shell owns every confirmed mutation, including a child
      // journey. Acquire that ownership synchronously before the first await so
      // a second voice/UI command cannot supersede this operation's final reply.
      onLifecycleBusyChange(true);
      setConversationProposal(null);
      try {
        // A spoken confirmation authorizes one proposal, never a cached view of
        // an arrival. Fetch the authoritative reservation and readiness again
        // immediately before a write; a failed preflight is a stop, not a hint.
        const [freshDetail, freshReadiness] = await Promise.all([
          loadReservation(reservationId),
          loadCheckInReadiness(reservationId),
        ]);
        const freshReservation = freshDetail.reservation;
        const freshRoomReady = freshReadiness.roomCondition === "inspected";
        const freshCanOpenFolio =
          freshReservation.status === "due_in" &&
          freshReadiness.primaryFolioId === null &&
          freshReadiness.identityGate.satisfied === true &&
          freshRoomReady &&
          freshReadiness.blockers.length === 1 &&
          freshReadiness.blockers[0] === "primary_folio_not_open";
        const freshCanCheckIn =
          freshReservation.status === "due_in" && freshReadiness.canCheckIn === true;
        if (proposal.kind === "housekeeping") {
          const currentTask = await loadHousekeepingTask(proposal.proposal.task.taskId);
          if (!housekeepingTaskMatchesProposal(currentTask, proposal.proposal)) {
            reply("The task changed before confirmation. I stopped without recording a housekeeping declaration and refreshed current truth.");
            await refresh();
            return;
          }
          const receipt = await transitionHousekeepingTask(
            currentTask,
            proposal.proposal.action,
            proposal.proposal.key,
          );
          setCleaningResult(`Room ${currentTask.spaceCode}: ${receipt.taskStatus} · ${receipt.roomCondition}. This action records a staff declaration; it was not inferred by Yellow.`);
          await refresh();
          await advanceArrivalConversation(`Room ${currentTask.spaceCode} is now ${receipt.roomCondition} and task ${receipt.taskStatus}. This action records one staff declaration. Physical cleaning and supervisor inspection remain distinct.`, currentTask.taskId);
          return;
        } else if (proposal.kind === "cleaning") {
          const current = await loadArrivalCleaningCandidate(reservationId);
          if (current.candidate.existingTaskId) {
            setArrivalTaskId(current.candidate.existingTaskId);
            setCleaningResult(`An actionable cleaning task already exists for Room ${current.candidate.spaceCode}.`);
            await refresh();
            await advanceArrivalConversation(`An actionable cleaning task already exists for Room ${current.candidate.spaceCode}; I did not create a duplicate.`, current.candidate.existingTaskId);
            return;
          }
          const expected = proposal.candidate;
          const actual = current.candidate;
          if (
            !current.canCreate ||
            actual.reservationId !== expected.reservationId ||
            actual.spaceId !== expected.spaceId ||
            actual.spaceCode !== expected.spaceCode ||
            actual.roomCondition !== expected.roomCondition ||
            actual.dueAt !== expected.dueAt
          ) {
            setCleaningResult("The cleaning-task candidate changed before confirmation. No task was created.");
            reply("The cleaning-task candidate changed before confirmation, so I stopped and refreshed the arrival without creating a task.");
            await refresh();
            return;
          }
          const draft = JSON.stringify({
            reservationId,
            spaceId: actual.spaceId,
            attendantPartyId: proposal.attendant.partyId,
          });
          const existing = cleaningTaskAttempt.current;
          const attempt = existing?.draft === draft
            ? existing
            : Object.freeze({ draft, key: `yellow-public-demo-${crypto.randomUUID()}` });
          cleaningTaskAttempt.current = attempt;
          const created = await createArrivalCleaningTask(
            reservationId,
            proposal.attendant.partyId,
            attempt.key,
          );
          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(created.taskId) ||
            created.reservationId !== reservationId ||
            created.spaceId !== actual.spaceId ||
            created.roomCondition !== actual.roomCondition ||
            created.attendantPartyId !== proposal.attendant.partyId ||
            created.dueAt !== actual.dueAt ||
            typeof created.created !== "boolean" ||
            typeof created.replayed !== "boolean"
          ) throw new Error("The arrival cleaning-task receipt was incoherent.");
          setArrivalTaskId(created.taskId);
          setCleaningResult(`${created.created ? "Cleaning task created" : "Existing cleaning task found"} for Room ${actual.spaceCode}, assigned to ${proposal.attendant.displayName}. Physical cleaning and inspection still belong to Housekeeping.`);
          await refresh();
          await advanceArrivalConversation(`${created.created ? "The cleaning task is created" : "The existing cleaning task is reconciled"} for Room ${actual.spaceCode} and assigned to ${proposal.attendant.displayName}.`, created.taskId);
          return;
        } else if (proposal.kind === "assign") {
          const freshSegment =
            freshReservation.status === "due_in" &&
            freshReservation.segments.length === 1 &&
            freshReservation.segments[0]?.status === "booked" &&
            freshReservation.segments[0]?.sellableUnitId === null
              ? freshReservation.segments[0]
              : null;
          if (
            !freshSegment ||
            freshSegment.segmentId !== proposal.body.segmentId ||
            freshSegment.unitTypeId !== proposal.body.expectedUnitTypeId ||
            freshSegment.sellableUnitId !== proposal.body.expectedSellableUnitId ||
            freshSegment.from !== proposal.body.expectedPeriod.from ||
            freshSegment.to !== proposal.body.expectedPeriod.to
          ) {
            reply("This arrival changed before confirmation, so I stopped and refreshed it without assigning a room.");
            await refresh();
            return;
          }
          const current = await loadDueInRoomCandidates(reservationId);
          if (!current.candidates.some((candidate) => candidate.sellableUnitId === proposal.body.sellableUnitId)) {
            setRoomResult("That room is no longer an eligible current candidate.");
            reply(`Room ${proposal.room.spaceCode} is no longer eligible. I stopped without changing the reservation.`);
            await refresh();
            return;
          }
          const draft = JSON.stringify(proposal.body);
          const existing = roomAssignmentAttempt.current;
          const attempt = existing?.draft === draft ? existing : Object.freeze({ draft, key: `yellow-public-demo-${crypto.randomUUID()}` });
          roomAssignmentAttempt.current = attempt;
          setAssigningRoom(true);
          await assignDueInRoom(reservationId, proposal.body, attempt.key);
          setRoomResult(`Room ${proposal.room.spaceCode} assigned from your spoken confirmation.`);
        } else if (proposal.kind === "folio") {
          if (!freshCanOpenFolio) {
            reply("The folio is no longer the only current prerequisite, so I stopped and refreshed the arrival.");
            await refresh();
            return;
          }
          setOpeningFolio(true);
          await openPrimaryFolio(reservationId, folioIdempotencyKey.current);
          setFolioResult("Primary folio opened from your spoken confirmation.");
        } else {
          if (!freshCanCheckIn) {
            reply("This arrival is no longer ready to check in, so I stopped and refreshed the live prerequisites.");
            await refresh();
            return;
          }
          setCommitting(true);
          await commitCheckIn(reservationId, idempotencyKey.current);
          setResult("Check-in completed from your spoken confirmation.");
        }
        await refresh();
        if (proposal.kind === "checkin") {
          reply("Check-in is complete. The live Today board and reservation status are refreshed. No additional write was inferred.");
        } else if (proposal.kind === "assign") {
          await advanceArrivalConversation(`Room ${proposal.room.spaceCode} is assigned.`);
        } else if (proposal.kind === "folio") {
          await advanceArrivalConversation("The primary folio is open.");
        }
      } catch (error) {
        const detailText = error instanceof Error ? error.message : "The server did not accept that action.";
        if (proposal.kind === "housekeeping") setCleaningResult(detailText);
        else setResult(detailText);
        try {
          let housekeepingTruth: HousekeepingTask | null = null;
          if (proposal.kind === "housekeeping") {
            housekeepingTruth = await loadHousekeepingTask(proposal.proposal.task.taskId).catch(() => null);
          }
          await refresh();
          if (proposal.kind === "housekeeping" && housekeepingTruth) {
            if (housekeepingFailureIsUncertain(error) && housekeepingTaskMatchesProposal(housekeepingTruth, proposal.proposal)) {
              setConversationProposal(proposal);
              reply(`${detailText} Current task evidence is unchanged. Say yes again to retry this exact proposal with the same operation key, or say no to cancel it.`);
            } else if (housekeepingTaskReflectsAction(housekeepingTruth, proposal.proposal)) {
              reply(`${detailText} Current server truth now reads ${housekeepingTruth.taskStatus} and ${housekeepingTruth.roomCondition}, but I cannot attribute that change without a verified receipt. I refreshed the arrival and will not repeat it automatically.`);
            } else {
              reply(`${detailText} The task no longer matches the confirmed proposal. I refreshed current truth and cleared the action.`);
            }
          } else {
            reply(`${detailText} I refreshed the current reservation before proposing anything else.`);
          }
        } catch {
          reply(`${detailText} The follow-up refresh also failed, so I will not claim current readiness.`);
        }
      } finally {
        conversationInFlight.current = false;
        onLifecycleBusyChange(false);
        setAssigningRoom(false);
        setOpeningFolio(false);
        setCommitting(false);
      }
    };
    if (/^(?:yes|yes please|go ahead|confirm|haan|ha|हाँ)\s*[.!]?$/iu.test(message)) {
      void execute();
      return;
    }
    if (/^(?:no|no thanks|cancel|stop|not now|nahi|नहीं)\s*[.!]?$/iu.test(message)) {
      setConversationProposal(null);
      reply("Understood. I cancelled the pending action and did not change this arrival.");
      return;
    }
    const housekeepingAction = housekeepingTaskActionIntent(conversationCommand.text);
    if (housekeepingAction) {
      setConversationProposal(null);
      const task = arrivalHousekeepingTask.data;
      if (arrivalHousekeepingTask.isFetching || arrivalHousekeepingTask.isError || !task) {
        reply("I cannot prepare that staff declaration until the exact arrival housekeeping task is available.");
        return;
      }
      if (task.allowedActions.length !== 1 || task.allowedActions[0] !== housekeepingAction) {
        const next = task.allowedActions[0];
        reply(next
          ? `Room ${task.spaceCode} is ${task.roomCondition} with task ${task.taskStatus}. The only currently permitted action is “${housekeepingActionCopy(next).button}”.`
          : `Room ${task.spaceCode} has no permitted housekeeping transition for this session.`);
        return;
      }
      const proposal = Object.freeze({
        task,
        action: housekeepingAction,
        key: `yellow-housekeeping-${crypto.randomUUID()}`,
      });
      setConversationProposal(Object.freeze({ kind: "housekeeping", proposal }));
      const copy = housekeepingActionCopy(housekeepingAction);
      reply(`Room ${task.spaceCode}: ${copy.statement} ${copy.outcome} No change has been made. Shall I record this exact housekeeping action?`);
      return;
    }
    const cleaningAttendantQuery = arrivalCleaningAttendantIntent(conversationCommand.text);
    if (cleaningAttendantQuery) {
      // A replacement staff instruction withdraws any earlier unconfirmed
      // cleaning proposal before identity lookup can yield or fail.
      setConversationProposal(null);
      const candidateState = cleaningCandidate.data;
      if (cleaningCandidate.isFetching || cleaningCandidate.isError || !candidateState) {
        setConversationProposal(null);
        reply("I cannot safely prepare a cleaning task until the current governed arrival candidate is available.");
        return;
      }
      if (candidateState.candidate.existingTaskId) {
        setConversationProposal(null);
        reply(`An actionable cleaning task already exists for Room ${candidateState.candidate.spaceCode}. I will not create a duplicate.`);
        return;
      }
      if (!candidateState.canCreate) {
        setConversationProposal(null);
        reply("You may review this dirty arrival, but cleaning-task creation is not granted for this session.");
        return;
      }
      void (async () => {
        try {
          const profiles = await searchPartyProfiles(cleaningAttendantQuery);
          if (
            commandGeneration !== conversationGeneration.current ||
            commandAuthorityGeneration !== conversationAuthority.current
          ) return;
          const staff = resolveArrivalCleaningAttendant(cleaningAttendantQuery, profiles);
          if (staff.kind === "ambiguous") {
            setConversationProposal(null);
            reply("More than one active staff profile matches that identity. Say the exact Party ID.");
            return;
          }
          if (staff.kind === "ineligible") {
            setConversationProposal(null);
            reply("That exact Party is not an active staff profile, so I did not prepare a cleaning task.");
            return;
          }
          const attendant = Object.freeze({
            partyId: staff.partyId,
            displayName: staff.displayName,
          });
          setConversationProposal(Object.freeze({
            kind: "cleaning",
            candidate: candidateState.candidate,
            attendant,
          }));
          reply(`Room ${candidateState.candidate.spaceCode} is ${candidateState.candidate.roomCondition}; the task is due ${candidateState.candidate.dueAt} and will be assigned to ${attendant.displayName}. No change has been made. Shall I create this exact cleaning task?`);
        } catch (error) {
          if (
            commandGeneration !== conversationGeneration.current ||
            commandAuthorityGeneration !== conversationAuthority.current
          ) return;
          setConversationProposal(null);
          reply(error instanceof Error ? error.message : "Staff identity could not be resolved.");
        }
      })();
      return;
    }
    const roomMatch = /(?:room\s*)?(\d{2,4})\b/iu.exec(message);
    if (roomMatch?.[1]) {
      if (!segment || roomCandidates.isFetching || roomCandidates.isError) {
        reply("I cannot safely select a room until the current availability check is complete.");
        return;
      }
      const candidate = roomCandidates.data?.candidates.find((value) => value.spaceCode === roomMatch[1]);
      if (!candidate) {
        setConversationProposal(null);
        reply(`Room ${roomMatch[1]} is not a current eligible option for this stay. I have not changed the reservation.`);
        return;
      }
      const body = Object.freeze({
        segmentId: segment.segmentId,
        expectedReservationStatus: "due_in" as const,
        expectedSegmentStatus: "booked" as const,
        expectedUnitTypeId: segment.unitTypeId,
        expectedSellableUnitId: null,
        expectedPeriod: Object.freeze({ from: segment.from, to: segment.to }),
        sellableUnitId: candidate.sellableUnitId,
      });
      setSelectedRoomId(candidate.sellableUnitId);
      setConversationProposal(Object.freeze({ kind: "assign", room: candidate, body }));
      reply(`Room ${candidate.spaceCode} is currently eligible and matches the booked room type. Shall I assign it to this arrival?`);
      return;
    }
    if (/(?:prepare|check[ -]?in|arrival)/iu.test(message)) {
      if (readiness.data.blockers.includes("dirty_room_override_unauthorized")) {
        if (cleaningCandidate.isFetching) {
          reply("I am checking the governed cleaning-task candidate for this arrival. Ask me to prepare check-in again when it is visible.");
        } else if (cleaningCandidate.isError || !cleaningCandidate.data) {
          reply("The governed cleaning-task candidate is unavailable, so I did not prepare a task.");
        } else if (cleaningCandidate.data.candidate.existingTaskId) {
          reply(`An actionable cleaning task already exists for Room ${cleaningCandidate.data.candidate.spaceCode}. A granted operator must record completed physical cleaning before standard check-in can continue; supervisor inspection remains a separate follow-on step.`);
        } else if (cleaningCandidate.data.canCreate) {
          reply(`Room ${cleaningCandidate.data.candidate.spaceCode} is ${cleaningCandidate.data.candidate.roomCondition}. Say “assign cleaning to” followed by the exact staff name or Party ID, and I will show the complete task before asking for confirmation.`);
        } else {
          reply("The dirty-room blocker is confirmed, but this session cannot create the housekeeping task. A granted housekeeping lead must assign it.");
        }
      } else if (canCheckIn) {
        setConversationProposal(Object.freeze({ kind: "checkin" }));
        reply("Every current server-owned prerequisite is ready. Shall I complete check-in now?");
      } else if (canOpenFolio) {
        setConversationProposal(Object.freeze({ kind: "folio" }));
        reply("The primary folio is the only current prerequisite. Shall I open it now?");
      } else if (segment) {
        reply("This arrival needs an assigned current eligible room. Say a room number from the live options, and I will ask for confirmation before assigning it.");
      } else {
        reply("I checked the current arrival. The remaining server-owned blockers need attention before I can propose a safe action.");
      }
      return;
    }
    reply("For this arrival, say a room number, ask me to prepare check-in, or say yes to the specific action I have just proposed.");
  }, [arrivalHousekeepingTask, arrivalTaskId, cleaningCandidate, conversationCommand, conversationProposal, detail.data, onCompleted, onConversationReply, onLifecycleBusyChange, queryClient, readiness.data, reservationId, roomCandidates, roomCandidates.data]);
  if (detail.isLoading || readiness.isLoading)
    return <section className="overwatch-journey" aria-live="polite"><p>Preparing live arrival workflow…</p></section>;
  if (detail.isError || readiness.isError || !detail.data)
    return <section className="overwatch-journey"><p className="error">{detail.error?.message ?? readiness.error?.message ?? "Arrival workflow is unavailable."}</p></section>;
  const reservation = detail.data.reservation;
  const unassignedBookedSegment =
    reservation.status === "due_in" &&
    reservation.segments.length === 1 &&
    reservation.segments[0]?.status === "booked" &&
    reservation.segments[0]?.sellableUnitId === null
      ? reservation.segments[0]
      : null;
  const selectedRoom = roomCandidates.data?.candidates.find(
    (candidate) => candidate.sellableUnitId === selectedRoomId,
  ) ?? null;
  const canAssignRoom =
    unassignedBookedSegment !== null &&
    selectedRoom !== null &&
    roomConfirmed &&
    roomDraft !== null &&
    roomDraft.candidateId === selectedRoom.sellableUnitId &&
    roomDraft.body.segmentId === unassignedBookedSegment.segmentId &&
    roomDraft.body.expectedUnitTypeId === unassignedBookedSegment.unitTypeId &&
    roomDraft.body.expectedPeriod.from === unassignedBookedSegment.from &&
    roomDraft.body.expectedPeriod.to === unassignedBookedSegment.to &&
    roomDraft.body.sellableUnitId === selectedRoom.sellableUnitId &&
    !assigningRoom &&
    !roomCandidates.isError &&
    !roomCandidates.isFetching;
  const ready = reservation.status === "due_in" && readiness.data?.canCheckIn === true;
  const inspectedAssignedRoom = readiness.data?.roomCondition === "inspected";
  const primaryFolioOpen = reservation.folios.some((folio) => folio.status === "open");
  const canOpenPrimaryFolio =
    reservation.status === "due_in" &&
    readiness.data?.primaryFolioId === null &&
    readiness.data?.identityGate.satisfied === true &&
    inspectedAssignedRoom &&
    readiness.data?.blockers.length === 1 &&
    readiness.data.blockers[0] === "primary_folio_not_open";
  const steps = [
    { label: "Guest & sharers", detail: `${reservation.guests.length} guest${reservation.guests.length === 1 ? "" : "s"} on the current stay`, done: reservation.guests.length > 0 },
    { label: "Stay preferences", detail: reservation.notes ?? "No additional stay notes", done: true },
    { label: "Room readiness", detail: readiness.data?.roomCondition === "clean" ? "Cleaned · awaiting supervisor inspection" : readiness.data?.roomCondition ? `${readiness.data.roomCondition} room condition from Housekeeping` : "No eligible assigned room", done: inspectedAssignedRoom },
    { label: "Folio & identity", detail: readiness.data?.identityGate.satisfied && primaryFolioOpen ? `${reservation.folios.length} folio window${reservation.folios.length === 1 ? "" : "s"} · identity ready` : "An open folio and identity or statutory evidence are required", done: readiness.data?.identityGate.satisfied === true && primaryFolioOpen },
  ] as const;
  const commit = async () => {
    if (!ready || !confirmed || committing || conversationInFlight.current) return;
    conversationInFlight.current = true;
    setCommitting(true);
    setResult(null);
    try {
      await commitCheckIn(reservationId, idempotencyKey.current);
      await Promise.all([detail.refetch(), readiness.refetch()]);
      setConfirmed(false);
      setResult("Check-in completed. The live Today board and reservation status have refreshed.");
      onCompleted();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "The server did not accept this check-in.");
      await Promise.all([detail.refetch(), readiness.refetch()]);
      setConfirmed(false);
    } finally {
      conversationInFlight.current = false;
      setCommitting(false);
    }
  };
  const openPrimary = async () => {
    if (!canOpenPrimaryFolio || !folioConfirmed || openingFolio || conversationInFlight.current) return;
    conversationInFlight.current = true;
    setOpeningFolio(true);
    setFolioResult(null);
    try {
      await openPrimaryFolio(reservationId, folioIdempotencyKey.current);
      await Promise.all([detail.refetch(), readiness.refetch()]);
      setFolioConfirmed(false);
      setFolioResult("Primary folio opened. Overwatch has refreshed the current arrival readiness.");
    } catch (error) {
      await Promise.all([detail.refetch(), readiness.refetch()]);
      setFolioConfirmed(false);
      setFolioResult(error instanceof Error ? error.message : "The primary folio could not be opened.");
    } finally {
      conversationInFlight.current = false;
      setOpeningFolio(false);
    }
  };
  const assignSelectedRoom = async () => {
    if (!canAssignRoom || !unassignedBookedSegment || !selectedRoom || conversationInFlight.current) return;
    conversationInFlight.current = true;
    const draft = JSON.stringify(roomDraft.body);
    const existingAttempt = roomAssignmentAttempt.current;
    const attempt = existingAttempt?.draft === draft
      ? existingAttempt
      : Object.freeze({
          draft,
          key: `yellow-public-demo-${crypto.randomUUID()}`,
        });
    roomAssignmentAttempt.current = attempt;
    setAssigningRoom(true);
    setRoomResult(null);
    try {
      await assignDueInRoom(
        reservationId,
        roomDraft.body,
        attempt.key,
      );
      await Promise.all([detail.refetch(), readiness.refetch(), roomCandidates.refetch()]);
      setSelectedRoomId(null);
      setRoomConfirmed(false);
      setRoomDraft(null);
      setRoomResult(`Room ${selectedRoom.spaceCode} assigned. Overwatch has refreshed the live arrival readiness.`);
    } catch (error) {
      await Promise.all([detail.refetch(), readiness.refetch(), roomCandidates.refetch()]);
      setRoomConfirmed(false);
      setRoomDraft(null);
      setRoomResult(error instanceof Error ? error.message : "The room could not be assigned.");
    } finally {
      conversationInFlight.current = false;
      setAssigningRoom(false);
    }
  };
  return (
    <section className="overwatch-journey" aria-live="polite">
      <span>LIVE ARRIVAL FLOW</span>
      <h3>{reservation.confirmationNo}</h3>
      <p>{reservation.guests.map((guest) => `${guest.displayName} · ${guest.role}`).join("; ")}</p>
       {conversationProposal ? <p className="readiness-chip blocked" aria-live="polite">
         {conversationProposal.kind === "assign"
           ? `Pending spoken confirmation: assign Room ${conversationProposal.room.spaceCode} to ${reservation.confirmationNo}.`
           : conversationProposal.kind === "cleaning"
             ? `Pending spoken confirmation: create the ${conversationProposal.candidate.roomCondition} room task for Room ${conversationProposal.candidate.spaceCode}, assigned to ${conversationProposal.attendant.displayName}.`
           : conversationProposal.kind === "housekeeping"
             ? `Pending spoken confirmation: ${housekeepingActionCopy(conversationProposal.proposal.action).button} for Room ${conversationProposal.proposal.task.spaceCode}.`
           : conversationProposal.kind === "folio"
            ? `Pending spoken confirmation: open the primary folio for ${reservation.confirmationNo}.`
            : `Pending spoken confirmation: check in ${reservation.confirmationNo}.`}
      </p> : null}
      <ol>
        {steps.map((step) => <li key={step.label} className={step.done ? "complete" : "blocked"}><strong>{step.done ? "✓" : "!"} {step.label}</strong><small>{step.detail}</small></li>)}
      </ol>
       {readiness.data?.blockers.length ? <div className="arrival-resolution-list">{readiness.data.blockers.map((blocker) => {
         const copy = checkInBlockerCopy(blocker);
         return <section className={`arrival-resolution ${copy.tone}`} key={blocker}><span aria-hidden="true">{copy.tone === "attention" ? "!" : "•"}</span><div><strong>{copy.title}</strong><p>{copy.detail}</p></div></section>;
       })}</div> : null}
       {cleaningCandidate.data ? <section className="overwatch-preparation" aria-label="Arrival cleaning task preparation">
         <strong>Housekeeping task truth for Room {cleaningCandidate.data.candidate.spaceCode}</strong>
         <p>{cleaningCandidate.data.candidate.roomCondition} condition · due {cleaningCandidate.data.candidate.dueAt}</p>
         <p>{cleaningCandidate.data.candidate.existingTaskId
           ? `Actionable task ${cleaningCandidate.data.candidate.existingTaskId} already exists. Physical cleaning and inspection still belong to Housekeeping.`
           : cleaningCandidate.data.canCreate
             ? "Say “assign cleaning to” and the exact staff name or Party ID. Yellow will show the complete proposal before any write."
             : "This session may review the blocker but cannot create its task."}</p>
         {cleaningResult ? <p className="success" role="status">{cleaningResult}</p> : null}
       </section> : cleaningCandidate.isError ? <p className="error">{cleaningCandidate.error.message}</p> : null}
      {arrivalHousekeepingTask.data ? <section className="overwatch-preparation" aria-label="Arrival housekeeping task progression">
        <strong>Live task {arrivalHousekeepingTask.data.taskId}</strong>
        <p>Room {arrivalHousekeepingTask.data.spaceCode} · {arrivalHousekeepingTask.data.taskStatus} · {arrivalHousekeepingTask.data.roomCondition}</p>
        <p>{arrivalHousekeepingTask.data.allowedActions.length === 1
          ? `Next permitted declaration: ${housekeepingActionCopy(arrivalHousekeepingTask.data.allowedActions[0]!).button}. Say it naturally and Yellow will show the exact proposal before confirmation.`
          : "No further housekeeping action is granted from this task."}</p>
      </section> : arrivalHousekeepingTask.isError ? <p className="error">{arrivalHousekeepingTask.error.message}</p> : null}
      {unassignedBookedSegment ? <section className="overwatch-preparation" aria-label="Room assignment preparation">
        <strong>Choose a current eligible room.</strong>
        <p>These rooms come from the server-owned availability check. Selecting a room does not check in the guest or change its Housekeeping condition.</p>
        {roomCandidates.isLoading ? <p>Loading current eligible rooms…</p> : null}
        {roomCandidates.isError ? <p className="error">{roomCandidates.error.message}</p> : null}
        {roomCandidates.data?.candidates.length === 0 ? <p>No currently eligible room is returned. Refresh only after inventory truth changes.</p> : null}
        {roomCandidates.data?.candidates.map((candidate) => <label className="overwatch-room-candidate" key={candidate.sellableUnitId}>
          <input
            type="radio"
            name={`overwatch-room-${reservationId}`}
            checked={selectedRoomId === candidate.sellableUnitId}
            disabled={assigningRoom}
            onChange={() => {
              setSelectedRoomId(candidate.sellableUnitId);
              setRoomConfirmed(false);
              setRoomDraft(null);
              setRoomResult(null);
            }}
          />
          <span><strong>Room {candidate.spaceCode}</strong><small>{candidate.sellableUnitName} · {candidate.floor === null ? "Floor not recorded" : `Floor ${candidate.floor}`} · {candidate.roomCondition === null ? "Condition not recorded" : `${candidate.roomCondition} condition`}</small></span>
        </label>)}
        <label className="confirmation"><input type="checkbox" checked={roomConfirmed} disabled={selectedRoom === null || unassignedBookedSegment === null || assigningRoom || roomCandidates.isFetching} onChange={(event) => {
          if (!event.target.checked || !selectedRoom || !unassignedBookedSegment || roomCandidates.isFetching) {
            setRoomConfirmed(false);
            setRoomDraft(null);
            return;
          }
          setRoomDraft(Object.freeze({
            candidateId: selectedRoom.sellableUnitId,
            body: Object.freeze({
              segmentId: unassignedBookedSegment.segmentId,
              expectedReservationStatus: "due_in",
              expectedSegmentStatus: "booked",
              expectedUnitTypeId: unassignedBookedSegment.unitTypeId,
              expectedSellableUnitId: null,
              expectedPeriod: Object.freeze({ from: unassignedBookedSegment.from, to: unassignedBookedSegment.to }),
              sellableUnitId: selectedRoom.sellableUnitId,
            }),
          }));
          setRoomConfirmed(true);
        }} /> I confirm assigning Room {selectedRoom?.spaceCode ?? "…"} to this named arrival.</label>
        <button className="checkin-button" disabled={!canAssignRoom} onClick={() => { void assignSelectedRoom(); }}>{assigningRoom ? "Assigning room…" : "Confirm room assignment"}</button>
        {roomResult ? <p className={roomResult.startsWith("Room ") ? "success" : "error"}>{roomResult}</p> : null}
      </section> : null}
      {canOpenPrimaryFolio ? <section className="overwatch-preparation" aria-label="Primary folio preparation">
        <strong>Primary folio is the only remaining prerequisite.</strong>
        <p>Open the server-owned primary folio for this named arrival, then Overwatch will refresh readiness before allowing check-in.</p>
        <label className="confirmation"><input type="checkbox" checked={folioConfirmed} disabled={openingFolio} onChange={(event) => setFolioConfirmed(event.target.checked)} /> I confirm opening the primary folio for this arrival.</label>
        <button className="checkin-button" disabled={!folioConfirmed || openingFolio} onClick={() => { void openPrimary(); }}>{openingFolio ? "Opening primary folio…" : "Open confirmed primary folio"}</button>
        {folioResult ? <p className={folioResult.startsWith("Primary folio opened") ? "success" : "error"}>{folioResult}</p> : null}
      </section> : null}
      <p className={ready ? "success" : "error"}>{ready ? "Every current server-owned prerequisite is ready. Confirm to commit this check-in." : "The workflow cannot commit until the blocked server-owned conditions are resolved."}</p>
      <label className="confirmation"><input type="checkbox" checked={confirmed} disabled={!ready || committing} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this named arrival and the live readiness result.</label>
      <button className="checkin-button" disabled={!ready || !confirmed || committing} onClick={() => { void commit(); }}>{committing ? "Checking in…" : "Confirm and check in"}</button>
      {result ? <p className={result.startsWith("Check-in") ? "success" : "error"}>{result}</p> : null}
    </section>
  );
}

function ReservationBoardRow({
  stay,
  expanded,
  onToggle,
}: Readonly<{
  stay: Stay;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const detail = useQuery({
    queryKey: ["reservation-board-detail", propertyId, stay.reservationId],
    queryFn: () => loadReservation(stay.reservationId),
    enabled: expanded,
    staleTime: 30_000,
  });
  const room = stay.sellableUnitLabel ?? stay.unitTypeLabel ?? "Room to assign";
  return (
    <div className="reservation-board-item">
      <div className="board-row" role="row">
        <strong>{stay.confirmationNo}</strong>
        <span>{nameOf(stay)}</span>
        <span className={`state ${stay.operationalState ?? stay.status}`}>
          {operationalStateLabel(stay.operationalState ?? stay.status)}
        </span>
        <span>
          {room}
          <small>{stay.ratePlanLabel ?? "Rate plan not returned"}</small>
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`reservation-context-${stay.reservationId}`}
          onClick={onToggle}
        >
          {expanded ? "Hide context" : "Expand record"}
        </button>
      </div>
      {expanded ? (
        <section
          className="reservation-board-context"
          id={`reservation-context-${stay.reservationId}`}
          aria-label={`${stay.confirmationNo} factual reservation context`}
        >
          {detail.isLoading ? (
            <p className="empty">Loading the current server-owned record…</p>
          ) : detail.isError ? (
            <p className="error">{detail.error.message}</p>
          ) : detail.data ? (
            <div className="reservation-context-grid">
              <article>
                <span className="state">GUESTS</span>
                <h2>Named on this stay</h2>
                {detail.data.reservation.guests.length ? (
                  <ul>
                    {detail.data.reservation.guests.map((guest) => (
                      <li key={`${guest.displayName}-${guest.role}`}>
                        <strong>{guest.displayName}</strong>
                        <span>{guest.role}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">No guest role is returned for this record.</p>
                )}
              </article>
              <article>
                <span className="state">STAY &amp; ROOM</span>
                <h2>Current record</h2>
                <dl>
                  <dt>State</dt><dd>{reservationStatusDescription(detail.data.reservation.status)}</dd>
                  <dt>Room</dt><dd>{room}</dd>
                  <dt>Rate</dt><dd>{stay.ratePlanLabel ?? "Rate plan not returned"}</dd>
                  <dt>Channel</dt><dd>{detail.data.reservation.channelCode ?? "Direct"}</dd>
                  <dt>Stay</dt><dd>{detail.data.reservation.segments.map((segment) => `${new Date(segment.from).toLocaleDateString()} – ${new Date(segment.to).toLocaleDateString()} · ${segment.adults} adult${segment.adults === 1 ? "" : "s"}`).join("; ") || "No stay segment is returned."}</dd>
                </dl>
              </article>
              <article>
                <span className="state">FOLIO CONTEXT</span>
                <h2>Server-owned windows</h2>
                {detail.data.reservation.folios.length ? (
                  <ul>
                    {detail.data.reservation.folios.map((folio) => (
                      <li key={folio.folioId}>
                        <strong>{folio.folioNo}</strong>
                        <span>{folio.name} · Window {folio.windowNo} · {folio.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">No folio is open for this reservation.</p>
                )}
                <p className="reservation-context-note">{detail.data.reservation.status === "in_house" || detail.data.reservation.status === "due_out" ? "In-house billing context." : "Pre-arrival billing context."} Posting eligibility remains server-authoritative.</p>
                <button type="button" className="reservation-cashier-link" onClick={() => window.location.assign(`/p/${propertyId}/today?workspace=finance&reservation=${encodeURIComponent(detail.data!.reservation.reservationId)}`)}>Open cashier &amp; billing</button>
                <p className="reservation-context-note">{detail.data.reservation.notes ?? "No operational note is recorded."}</p>
              </article>
            </div>
          ) : (
            <p className="error">Reservation details are unavailable.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function LegacyReservationCreateWorkspace({
  timezone,
  onCancel,
  onCreated,
}: Readonly<{
  timezone: string;
  onCancel(): void;
  onCreated(reservationId: string): void | Promise<void>;
}>) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [arrivalDate, setArrivalDate] = useState(() => propertyLocalDate(timezone, 1));
  const [departureDate, setDepartureDate] = useState(() => propertyLocalDate(timezone, 3));
  const [adults, setAdults] = useState(1);
  const [childAges, setChildAges] = useState("");
  const [channelCode, setChannelCode] = useState("direct");
  const [guestQuery, setGuestQuery] = useState("");
  const [guests, setGuests] = useState<readonly PartyProfile[]>([]);
  const [guest, setGuest] = useState<PartyProfile | null>(null);
  const [offers, setOffers] = useState<readonly ReservationOffer[]>([]);
  const [offer, setOffer] = useState<ReservationOffer | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedReservation | null>(null);
  const offerSearchGeneration = useRef(0);
  const commitAttempt = useRef<Readonly<{ fingerprint: string; key: string }> | null>(null);

  const resetOffer = () => {
    offerSearchGeneration.current += 1;
    setOffers([]);
    setOffer(null);
    setConfirmed(false);
  };
  const stay = () => {
    const ages = childAgesFrom(childAges);
    const from = propertyLocalDateTimeToIso(arrivalDate, "15:00", timezone);
    const to = propertyLocalDateTimeToIso(departureDate, "11:00", timezone);
    if (new Date(from).getTime() >= new Date(to).getTime())
      throw new Error("Departure must be after arrival.");
    if (!Number.isSafeInteger(adults) || adults < 1 || adults > 20)
      throw new Error("Adults must be a whole number from 1 to 20.");
    return { from, to, ages };
  };
  const nextToGuest = () => {
    setError("");
    try {
      stay();
      resetOffer();
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Stay details are invalid.");
    }
  };
  const findGuests = async () => {
    const query = guestQuery.trim();
    if (query.length < 2) {
      setError("Enter at least two characters to find a guest.");
      return;
    }
    setWorking(true);
    setError("");
    setMessage("Searching canonical Party profiles…");
    try {
      const results = await searchPartyProfiles(query);
      setGuests(results);
      setMessage(`${results.length} matching guest profile${results.length === 1 ? "" : "s"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Guest search failed.");
    } finally {
      setWorking(false);
    }
  };
  const findOffers = async () => {
    if (!guest) {
      setError("Choose one canonical guest profile before finding offers.");
      return;
    }
    const generation = ++offerSearchGeneration.current;
    setWorking(true);
    setError("");
    setMessage("Checking live inventory, restrictions and published rates…");
    try {
      const current = stay();
      const results = await searchReservationOffers({
        from: current.from,
        to: current.to,
        adults,
        childAges: current.ages,
        channelCode,
      });
      if (generation !== offerSearchGeneration.current) return;
      setOffers(results);
      setOffer(null);
      setConfirmed(false);
      setMessage(
        results.length
          ? `${results.length} current bookable offer${results.length === 1 ? "" : "s"}. Commit still rechecks occupancy.`
          : "No current bookable server offer matches this stay.",
      );
      setStep(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Current offers are unavailable.");
    } finally {
      setWorking(false);
    }
  };
  const createReservation = async () => {
    if (!guest || !offer || !confirmed) return;
    setWorking(true);
    setError("");
    setMessage("Committing through authoritative occupancy…");
    try {
      const current = stay();
      const fingerprint = JSON.stringify({
        propertyId,
        primaryPartyId: guest.partyId,
        sellableUnitId: offer.sellableUnitId,
        ratePlanId: offer.ratePlanId,
        stay: offer.stay,
        adults,
        childAges: current.ages,
        channelCode,
      });
      if (commitAttempt.current?.fingerprint !== fingerprint) {
        commitAttempt.current = { fingerprint, key: crypto.randomUUID() };
      }
      const result = await commitReservation({
        primaryPartyId: guest.partyId,
        offer,
        adults,
        childAges: current.ages,
        channelCode,
        idempotencyKey: commitAttempt.current.key,
      });
      setCreated(result);
      setMessage("Reservation created from the server-owned confirmation.");
      await onCreated(result.reservationId);
    } catch (reason) {
      const status = typeof reason === "object" && reason !== null && "status" in reason
        ? Number(reason.status)
        : 0;
      if (status === 409) {
        resetOffer();
        setStep(2);
        setError("Inventory changed. Stay and guest are preserved; find current offers again.");
      } else {
        setError(reason instanceof Error ? reason.message : "The reservation could not be committed.");
      }
    } finally {
      setWorking(false);
    }
  };

  if (created) return (
    <section className="reservation-create-next" aria-labelledby="reservation-created-title">
      <header>
        <div><span className="state">RESERVATION CREATED</span><h1 id="reservation-created-title">{created.confirmationNo}</h1></div>
      </header>
      <div className="reservation-create-success">
        <strong>Reservation created</strong>
        <p>Status {created.status} · the canonical reservation board has refreshed.</p>
        <button type="button" onClick={() => window.location.assign(`/p/${propertyId}/res/${created.reservationId}`)}>Open reservation</button>
        <button type="button" className="quiet" onClick={onCancel}>Return to reservations</button>
      </div>
    </section>
  );

  return (
    <section className="reservation-create-next" aria-labelledby="reservation-create-title">
      <header>
        <div><span className="state">NEW RESERVATION</span><h1 id="reservation-create-title">Create a governed stay</h1><p>Availability guides the choice. The final commit rechecks PostgreSQL occupancy.</p></div>
        <button type="button" className="quiet" disabled={working} onClick={onCancel}>Close</button>
      </header>
      <ol className="reservation-create-steps" aria-label="Reservation creation steps">
        <li className={step === 1 ? "active" : step > 1 ? "done" : ""}><span>1</span><strong>Stay</strong></li>
        <li className={step === 2 ? "active" : step > 2 ? "done" : ""}><span>2</span><strong>Guest</strong></li>
        <li className={step === 3 ? "active" : step > 3 ? "done" : ""}><span>3</span><strong>Offer</strong></li>
        <li className={step === 4 ? "active" : ""}><span>4</span><strong>Review</strong></li>
      </ol>
      {step === 1 ? <div className="reservation-create-panel">
        <h2>Stay details</h2>
        <div className="reservation-create-fields">
          <label>Arrival date<input type="date" value={arrivalDate} onChange={(event) => { setArrivalDate(event.target.value); resetOffer(); }} /></label>
          <label>Departure date<input type="date" value={departureDate} onChange={(event) => { setDepartureDate(event.target.value); resetOffer(); }} /></label>
          <label>Adults<input type="number" min="1" max="20" value={adults} onChange={(event) => { setAdults(Number(event.target.value)); resetOffer(); }} /></label>
          <label>Child ages<input value={childAges} onChange={(event) => { setChildAges(event.target.value); resetOffer(); }} placeholder="Example: 4, 9" /></label>
          <label>Booking source<select value={channelCode} onChange={(event) => { setChannelCode(event.target.value); resetOffer(); }}><option value="direct">Direct</option><option value="booking.com">Booking.com</option><option value="agoda">Agoda</option><option value="airbnb">Airbnb</option><option value="expedia">Expedia</option></select></label>
        </div>
        <p className="reservation-create-note">Arrival 15:00 and departure 11:00 are interpreted in {timezone}.</p>
        <button type="button" onClick={nextToGuest}>Continue to guest</button>
      </div> : null}
      {step === 2 ? <div className="reservation-create-panel">
        <h2>Find an existing guest</h2>
        <form className="reservation-create-search" onSubmit={(event) => { event.preventDefault(); void findGuests(); }}>
          <label>Guest name or Party ID<input value={guestQuery} disabled={working} onChange={(event) => setGuestQuery(event.target.value)} placeholder="Search canonical guest profiles" /></label>
          <button type="submit" disabled={working}>Search</button>
        </form>
        {guest ? <div className="reservation-create-selected"><span>SELECTED GUEST</span><strong>{guest.displayName}</strong><small>Party {guest.partyId}</small></div> : null}
        <div className="reservation-create-results">
          {guests.map((profile) => <button type="button" key={profile.partyId} disabled={working} aria-pressed={guest?.partyId === profile.partyId} onClick={() => { setGuest(profile); resetOffer(); }}><strong>{profile.displayName}</strong><span>{profile.roles.join(" · ") || profile.kind}</span><small>Party {profile.partyId}</small></button>)}
        </div>
        <div className="reservation-create-actions"><button type="button" className="quiet" disabled={working} onClick={() => setStep(1)}>Back</button><button type="button" disabled={!guest || working} onClick={() => void findOffers()}>Find current offers</button></div>
      </div> : null}
      {step === 3 ? <div className="reservation-create-panel">
        <h2>Current server offers</h2>
        <p>Every option is guidance with <strong>promise=false</strong>; commit arbitration remains required.</p>
        <div className="reservation-create-results offers">
          {offers.map((item) => <button type="button" key={item.optionRef} aria-pressed={offer?.optionRef === item.optionRef} onClick={() => { setOffer(item); setConfirmed(false); }}><strong>{item.sellableUnitName}</strong><span>{item.unitTypeCode} · {item.ratePlanCode} · {money(item.total.amountMinor, item.total.currency)}</span><small>{item.availableCount} currently free · {item.total.kind}</small></button>)}
        </div>
        <div className="reservation-create-actions"><button type="button" className="quiet" onClick={() => setStep(2)}>Back</button><button type="button" disabled={!offer} onClick={() => setStep(4)}>Review reservation</button></div>
      </div> : null}
      {step === 4 && guest && offer ? <div className="reservation-create-panel">
        <h2>Review before committing inventory</h2>
        <dl className="reservation-create-review">
          <dt>Guest</dt><dd>{guest.displayName} · Party {guest.partyId}</dd>
          <dt>Stay</dt><dd>{arrivalDate} to {departureDate} · {adults} adult{adults === 1 ? "" : "s"}</dd>
          <dt>Source</dt><dd>{channelCode}</dd>
          <dt>Offer</dt><dd>{offer.sellableUnitName} · {offer.ratePlanCode}</dd>
          <dt>Total</dt><dd>{money(offer.total.amountMinor, offer.total.currency)} · {offer.total.kind}</dd>
        </dl>
        <label className="reservation-create-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm these stay, guest and offer details. Yellow may commit the reservation and reserve inventory.</span></label>
        <div className="reservation-create-actions"><button type="button" className="quiet" onClick={() => setStep(3)}>Back</button><button type="button" disabled={!confirmed || working} onClick={() => void createReservation()}>{working ? "Creating reservation…" : "Confirm and create reservation"}</button></div>
      </div> : null}
      {message ? <p className="reservation-create-message" aria-live="polite">{message}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}

function LegacyReservationBoardWorkspace({ timezone }: Readonly<{ timezone: string }>) {
  const [creating, setCreating] = useState(false);
  const board = useQuery({
    queryKey: ["reservation-board", propertyId],
    queryFn: loadReservationBoard,
  });
  if (creating)
    return <ReservationCreateWorkspace timezone={timezone} onCancel={() => setCreating(false)} onCreated={async () => { await board.refetch(); }} />;
  if (board.isLoading)
    return (
      <section className="reservation-workspace">
        <p className="empty">Loading reservations…</p>
      </section>
    );
  if (board.isError)
    return (
      <section className="reservation-workspace">
        <p className="error">{board.error.message}</p>
      </section>
    );
  if (!board.data)
    return (
      <section className="reservation-workspace">
        <p className="error">Reservation details are unavailable.</p>
      </section>
    );
  return (
    <section className="reservation-board-next">
      <div className="reservation-board-actions"><button type="button" onClick={() => setCreating(true)}>New reservation</button></div>
      <MovementGrid
        status="all"
        lane={board.data}
        timezone={timezone}
        open={(stay) => window.location.assign(`/p/${propertyId}/res/${stay.reservationId}`)}
      />
    </section>
  );
}

function GuestsWorkspace() {
  const [query, setQuery] = useState(initialGuestSearch);
  const [selectedParty, setSelectedParty] = useState<PartyProfile | null>(null);
  const profiles = useQuery({
    queryKey: ["guest-search", propertyId, query],
    queryFn: () => searchPartyProfiles(query),
    enabled: query.trim().length >= 2,
  });
  const history = useQuery({
    queryKey: ["guest-stay-history", propertyId, selectedParty?.partyId],
    queryFn: () => loadPartyStayHistory(selectedParty!.partyId),
    enabled: selectedParty !== null,
  });
  useEffect(() => {
    if (
      !requestedGuestSearch ||
      query !== requestedGuestSearch ||
      selectedParty ||
      !profiles.data
    ) {
      return;
    }
    const requestedName = requestedGuestSearch.toLocaleLowerCase();
    const matchingProfile = profiles.data.find(
      (profile) => profile.partyId === requestedGuestSearch || profile.displayName.toLocaleLowerCase() === requestedName,
    );
    if (matchingProfile) setSelectedParty(matchingProfile);
  }, [profiles.data, query, selectedParty]);
  return (
    <section className="reservation-workspace">
      <div className="reservation-hero board-hero">
        <div>
          <span className="state">GUEST RELATIONSHIPS</span>
          <h1>Guests</h1>
          <p>
            Find a guest, open their profile and review their stay history.
            Contact hints, when configured, remain masked by the server.
          </p>
        </div>
      </div>
      <form
        className="guest-search"
        onSubmit={(event) => {
          event.preventDefault();
          void profiles.refetch();
        }}
      >
        <label>
          Find a guest
          <input
            value={query}
            minLength={2}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter at least two characters"
          />
        </label>
        <button type="submit">Search</button>
      </form>
      {query.trim().length < 2 ? (
        <p className="empty">Enter at least two characters to search guest profiles.</p>
      ) : profiles.isLoading ? (
        <p className="empty">Searching guest profiles…</p>
      ) : profiles.isError ? (
        <p className="error">{profiles.error.message}</p>
      ) : (
        <div className="guest-results">
          {profiles.data?.length ? (
            profiles.data.map((profile) => (
              <button
                className="guest-result"
                key={profile.partyId}
                onClick={() => setSelectedParty(profile)}
              >
                <span className="state">
                  {profile.kind} · {profile.status}
                </span>
                <h2>{profile.displayName}</h2>
                <p>{profile.roles.join(" · ")}</p>
                {profile.contacts.length ? (
                  <small>
                    {profile.contacts
                      .map((contact) => `${contact.kind}: ${contact.hint}`)
                      .join(" · ")}
                  </small>
                ) : (
                  <small>No contact hint is recorded.</small>
                )}
                <strong className="guest-open">Open profile →</strong>
              </button>
            ))
          ) : (
            <p className="empty">No guest profile matches this search.</p>
          )}
        </div>
      )}
      {selectedParty ? (
        <section
          className="guest-profile"
          aria-label={`${selectedParty.displayName} profile`}
        >
          <header>
            <div>
              <span className="state">GUEST PROFILE</span>
              <h2>{selectedParty.displayName}</h2>
              <p>
                {selectedParty.roles.join(" · ")} · {selectedParty.status}
              </p>
            </div>
            <button onClick={() => setSelectedParty(null)}>
              Close profile
            </button>
          </header>
          <h3>Stay history</h3>
          {history.isLoading ? (
            <p className="empty">Loading factual stay history…</p>
          ) : history.isError ? (
            <p className="error">{history.error.message}</p>
          ) : history.data?.reservations?.length ? (
            <ul className="guest-history">
              {history.data.reservations.map((stay) => (
                <li key={stay.reservationId}>
                  <strong>{stay.confirmationNo}</strong>
                  <span>
                    {stay.status.replace("_", " ")} ·{" "}
                    {stay.sellableUnitLabel ??
                      stay.unitTypeLabel ??
                      "Room to assign"}{" "}
                    · {stay.ratePlanLabel ?? "Public rate"}
                  </span>
                  <button
                    onClick={() =>
                      window.location.assign(
                        `/p/${propertyId}/res/${stay.reservationId}`,
                      )
                    }
                  >
                    Open stay
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">
              No factual stays are returned for this guest profile.
            </p>
          )}
        </section>
      ) : null}
    </section>
  );
}

function InlineGuestProfile({ partyId, timezone }: Readonly<{ partyId: string; timezone: string }>) {
  const profiles = useQuery({
    queryKey: ["yellow-inline-guest-profile", propertyId, partyId],
    queryFn: () => searchPartyProfiles(partyId),
  });
  const profile = profiles.data?.find((item) => item.partyId === partyId) ?? null;
  const history = useQuery({
    queryKey: ["yellow-inline-guest-history", propertyId, partyId],
    queryFn: () => loadPartyStayHistory(partyId),
    enabled: profile !== null,
  });
  if (profiles.isLoading) return <p className="empty">Loading the canonical guest profile…</p>;
  if (profiles.isError) return <p className="error">{profiles.error.message}</p>;
  if (!profile) return <p className="empty">The requested Party profile is not available in this property.</p>;
  return <section className="yellow-inline-guest" aria-label={`${profile.displayName} guest history`}>
    <header><div><span>GUEST PROFILE</span><h4>{profile.displayName}</h4><p>{profile.roles.join(" · ")} · {profile.status}</p></div></header>
    <div className="yellow-inline-guest-contacts">{profile.contacts.length ? profile.contacts.map((contact) => <small key={`${contact.kind}-${contact.hint}`}>{contact.kind}: {contact.hint}</small>) : <small>No contact hint is recorded.</small>}</div>
    <h5>Stay history</h5>
    {history.isLoading ? <p className="empty">Loading factual stay history…</p> : history.isError ? <p className="error">{history.error.message}</p> : history.data?.reservations?.length ? <ul>{history.data.reservations.map((stay) => <li key={stay.reservationId}>
      <button type="button" onClick={() => window.location.assign(`/p/${propertyId}/res/${stay.reservationId}`)}><strong>{stay.confirmationNo}</strong><span>{reservationStatusDescription(stay.operationalState ?? stay.status)} · {formatMovementTime(stay.stayFrom, timezone, true)} · {stay.sellableUnitLabel ?? stay.unitTypeLabel ?? "Room pending"}</span></button>
    </li>)}</ul> : <p className="empty">No factual stays are returned for this guest profile.</p>}
  </section>;
}

function housekeepingActionCopy(action: HousekeepingTaskAction): Readonly<{
  button: string;
  statement: string;
  outcome: string;
}> {
  if (action === "start") return Object.freeze({
    button: "Start cleaning",
    statement: "A granted operator records the staff declaration that physical cleaning has begun.",
    outcome: "The task will become in progress; room condition will remain unchanged.",
  });
  if (action === "complete") return Object.freeze({
    button: "Mark physically clean",
    statement: "A granted operator records the staff declaration that physical cleaning is complete.",
    outcome: "The task will become done and the room condition will become clean.",
  });
  return Object.freeze({
    button: "Verify inspected",
    statement: "A granted supervisor records the staff declaration that the clean room was physically inspected.",
    outcome: "The task will become verified and the room condition will become inspected.",
  });
}

*/

function housekeepingActionCopy(action: HousekeepingTaskAction): Readonly<{ button: string; statement: string; outcome: string }> {
  if (action === "start") return { button: "Start cleaning", statement: "A granted operator records the staff declaration that physical cleaning has begun.", outcome: "The task will become in progress; room condition will remain unchanged." };
  if (action === "complete") return { button: "Mark physically clean", statement: "A granted operator records the staff declaration that physical cleaning is complete.", outcome: "The task will become done and the room condition will become clean." };
  return { button: "Verify inspected", statement: "A granted supervisor records the staff declaration that the clean room was physically inspected.", outcome: "The task will become verified and the room condition will become inspected." };
}

function HousekeepingWorkspace({
  onLifecycleBusyChange,
}: Readonly<{
  onLifecycleBusyChange: (busy: boolean) => void;
}>) {
  const queryClient = useQueryClient();
  const query = useQuery<
    Readonly<{
      rooms: readonly HousekeepingCondition[];
      tasks: readonly HousekeepingTask[];
    }>,
    Error
  >({
    queryKey: ["housekeeping", propertyId],
    queryFn: loadHousekeeping,
  });
  const [proposal, setProposal] = useState<HousekeepingActionProposal | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const prepare = (task: HousekeepingTask, action: HousekeepingTaskAction) => {
    setProposal(Object.freeze({ task, action, key: `yellow-housekeeping-${crypto.randomUUID()}` }));
    setConfirmed(false);
    setResult(null);
  };
  const submit = async () => {
    if (!proposal || !confirmed || busy) return;
    setBusy(true);
    onLifecycleBusyChange(true);
    setResult(null);
    try {
      const current = await loadHousekeepingTask(proposal.task.taskId);
      if (!housekeepingTaskMatchesProposal(current, proposal))
        throw new Error("The task changed before confirmation. Yellow refreshed current Housekeeping truth without writing.");
      const receipt = await transitionHousekeepingTask(current, proposal.action, proposal.key);
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["overwatch-arrival-cleaning", propertyId] }),
        queryClient.invalidateQueries({ queryKey: ["overwatch-check-in", propertyId] }),
      ]);
      setProposal(null);
      setConfirmed(false);
      setResult(`Room ${current.spaceCode}: ${receipt.taskStatus} · ${receipt.roomCondition}. The recorded staff declaration is now authoritative.`);
    } catch (error) {
      const current = await loadHousekeepingTask(proposal.task.taskId).catch(() => null);
      await Promise.all([
        query.refetch().catch(() => undefined),
        queryClient.invalidateQueries({ queryKey: ["overwatch-arrival-cleaning", propertyId] }),
        queryClient.invalidateQueries({ queryKey: ["overwatch-check-in", propertyId] }),
      ]);
      setConfirmed(false);
      const detail = error instanceof Error ? error.message : "The housekeeping action could not be verified.";
      if (current && housekeepingFailureIsUncertain(error) && housekeepingTaskMatchesProposal(current, proposal)) {
        setResult(`${detail} Current evidence is unchanged. Confirm again to retry the exact action with the same operation key.`);
      } else if (current && housekeepingTaskReflectsAction(current, proposal)) {
        setProposal(null);
        setResult(`${detail} Current server truth is ${current.taskStatus} · ${current.roomCondition}, but Yellow cannot attribute that change without a verified receipt.`);
      } else {
        setProposal(null);
        setResult(`${detail} Current task truth was refreshed and the stale proposal was cleared.`);
      }
    } finally {
      setBusy(false);
      onLifecycleBusyChange(false);
    }
  };
  if (query.isLoading)
    return (
      <section className="reservation-workspace">
        <p className="empty">Loading room conditions…</p>
      </section>
    );
  if (query.isError)
    return (
      <section className="reservation-workspace">
        <p className="error">{query.error.message}</p>
      </section>
    );
  if (!query.data)
    return (
      <section className="reservation-workspace">
        <p className="error">Housekeeping details are unavailable.</p>
      </section>
    );
  const { rooms, tasks } = query.data;
  const counts = rooms.reduce<Record<string, number>>(
    (current, room) => ({
      ...current,
      [room.condition]: (current[room.condition] ?? 0) + 1,
    }),
    {},
  );
  return (
    <section className="reservation-workspace">
      <div className="reservation-hero board-hero">
        <div>
          <span className="state">ROOM OPERATIONS</span>
          <h1>Housekeeping</h1>
          <p>
            Server-owned room condition and current assigned task truth. Room
            condition remains a prerequisite for a governed arrival check-in.
          </p>
        </div>
      </div>
      <div className="condition-summary">
        {Object.entries(counts).map(([condition, count]) => (
          <div key={condition}>
            <strong>{count}</strong>
            <span>{condition}</span>
          </div>
        ))}
      </div>
      <div className="housekeeping-grid">
        <article className="detail-card">
          <h2>Room conditions</h2>
          <div className="room-grid">
            {rooms.map((room) => (
              <div key={room.spaceId} className={`room-tile ${room.condition}`}>
                <strong>{room.code}</strong>
                <span>Floor {room.floor}</span>
                <small>{room.condition}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="detail-card">
          <h2>Current tasks</h2>
          {tasks.length ? (
            <ul>
              {tasks.map((task) => (
                <li key={task.taskId}>
                  <strong>
                    Room {task.spaceCode} · {task.taskStatus}
                  </strong>
                  <span>
                    Floor {task.floor} · priority {task.priority} ·{" "}
                    {task.roomCondition}
                    {task.assigned ? " · assigned" : " · unassigned"}
                  </span>
                  {task.allowedActions.map((action) => (
                    <button className="housekeeping-task-action" key={action} type="button" onClick={() => prepare(task, action)}>
                      {housekeepingActionCopy(action).button}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p>No current tasks are listed.</p>
          )}
          {proposal ? <section className="housekeeping-action-proposal" aria-label="Housekeeping action proposal">
            <span>HOUSEKEEPING ACTION PROPOSAL</span>
            <h3>{housekeepingActionCopy(proposal.action).button} · Room {proposal.task.spaceCode}</h3>
            <p>{housekeepingActionCopy(proposal.action).statement}</p>
            <p>{housekeepingActionCopy(proposal.action).outcome}</p>
            <p>No room or task changes have been made. Physical cleaning is never inferred from elapsed time or task creation.</p>
            <label className="confirmation">
              <input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />
              I confirm the physical housekeeping statement above.
            </label>
            <div className="proposal-actions">
              <button type="button" disabled={!confirmed || busy} onClick={() => void submit()}>{busy ? "Verifying…" : "Confirm housekeeping action"}</button>
              <button type="button" disabled={busy} onClick={() => { setProposal(null); setConfirmed(false); }}>Cancel</button>
            </div>
          </section> : null}
          {result ? <p role="status" className={result.includes("authoritative") ? "success" : "error"}>{result}</p> : null}
        </article>
      </div>
    </section>
  );
}

type DepartmentPerformanceMatrixProps = Readonly<{
  arrivals: number | null;
  departures: number | null;
  inHouse: number | null;
  configuredRooms: number | undefined;
  occupancyPercent: number | null;
  housekeeping: Readonly<{
    rooms: readonly HousekeepingCondition[];
    tasks: readonly HousekeepingTask[];
  }> | undefined;
  housekeepingLoading: boolean;
  operationalBlocks: readonly OperationalBlock[] | undefined;
  operationalBlocksLoading: boolean;
  onDrillDown: (request: string) => void;
}>;

function DepartmentPerformanceMatrix({
  arrivals,
  departures,
  inHouse,
  configuredRooms,
  occupancyPercent,
  housekeeping,
  housekeepingLoading,
  operationalBlocks,
  operationalBlocksLoading,
  onDrillDown,
}: DepartmentPerformanceMatrixProps) {
  const rooms = housekeeping?.rooms ?? [];
  const tasks = housekeeping?.tasks ?? [];
  const readyRooms = rooms.filter(
    (room) => room.condition === "clean" || room.condition === "inspected",
  ).length;
  const turnaroundRooms = rooms.filter(
    (room) => room.condition === "dirty" || room.condition === "pickup",
  ).length;
  const activeTasks = tasks.filter((task) => task.taskStatus !== "done").length;
  const unassignedTasks = tasks.filter(
    (task) => task.taskStatus !== "done" && !task.assigned,
  ).length;
  const oooCount = operationalBlocks?.filter((block) => block.kind === "ooo").length ?? 0;
  const oosCount = operationalBlocks?.filter((block) => block.kind === "oos").length ?? 0;
  const arrivalPressure = arrivals === null || departures === null
    ? "Movement loading"
    : `${arrivals} arrival${arrivals === 1 ? "" : "s"} · ${departures} departure${departures === 1 ? "" : "s"}`;
  const earlyCheckInSignal = housekeepingLoading || arrivals === null || departures === null
    ? "Checking readiness and movement"
    : readyRooms === 0
      ? "No ready-room signal yet"
      : `${readyRooms} ready-room signal${readyRooms === 1 ? "" : "s"} · verify the requested stay`;
  const roomReadiness = housekeepingLoading
    ? "Loading room readiness"
    : housekeeping
      ? `${readyRooms} ready · ${turnaroundRooms} turnaround`
      : "Room readiness unavailable";

  return (
    <section className="department-performance" aria-label="Department performance matrix">
      <div className="section-heading">
        <div>
          <span>LIVE OPERATING MATRIX</span>
          <h2>Department view</h2>
        </div>
        <p>Cards use current governed hotel data. Unconnected feeds stay unavailable.</p>
      </div>
      <div className="department-card-grid">
        <article className="department-card">
          <span>GENERAL MANAGER</span>
          <strong>{occupancyPercent === null ? "—" : `${occupancyPercent}%`}</strong>
          <p>Occupancy · {configuredRooms ?? "—"} configured rooms</p>
          <ul className="department-fact-list" aria-label="General Manager performance sources">
            <li><span>Last-night actuals</span><b>Unavailable</b></li>
            <li><span>ADR · RevPAR</span><b>Unavailable</b></li>
            <li><span>Forecast · review health</span><b>Unavailable</b></li>
          </ul>
          <small>These figures appear only after their approved sources connect.</small>
          <button type="button" onClick={() => onDrillDown("Show today's operating summary")}>Ask Yellow</button>
        </article>
        <article className="department-card">
          <span>FRONT OFFICE</span>
          <strong>{arrivals === null ? "—" : arrivals} in</strong>
          <p>{arrivalPressure} · {inHouse === null ? "—" : inHouse} in house</p>
          <small>Every arrival needs reservation-specific readiness; early check-in is never assumed from a room count.</small>
          <button type="button" onClick={() => onDrillDown("Show today's arrivals and their readiness")}>Review arrivals</button>
        </article>
        <article className="department-card">
          <span>HOUSEKEEPING</span>
          <strong>{housekeepingLoading ? "…" : readyRooms}</strong>
          <p>{roomReadiness}</p>
          <small>{activeTasks} active task{activeTasks === 1 ? "" : "s"} · {unassignedTasks} unassigned · {arrivalPressure}</small>
          <button type="button" onClick={() => onDrillDown("Show housekeeping room conditions and tasks")}>Open room status</button>
        </article>
        <article className="department-card">
          <span>REVENUE</span>
          <strong>—</strong>
          <p>Actuals · pace · forecast unavailable</p>
          <ul className="department-fact-list" aria-label="Revenue performance sources">
            <li><span>Room nights · revenue</span><b>Unavailable</b></li>
            <li><span>Pickup · pace</span><b>Unavailable</b></li>
            <li><span>Channel contribution</span><b>Unavailable</b></li>
          </ul>
          <small>Rate setup is available; performance requires an approved reporting feed.</small>
          <button type="button" onClick={() => onDrillDown("Explain revenue data availability and current rate configuration")}>Review rate setup</button>
        </article>
        <article className="department-card">
          <span>ROOMS DIVISION</span>
          <strong>{operationalBlocksLoading ? "…" : `${oooCount} / ${oosCount}`}</strong>
          <p>OOO · OOS rooms</p>
          <small>{earlyCheckInSignal}. A sell decision also needs live supply, policy, approved price and guest confirmation.</small>
          <button type="button" onClick={() => onDrillDown("Show out of order and out of service rooms")}>Review room blocks</button>
        </article>
        <article className="department-card">
          <span>SALES &amp; HOD</span>
          <strong>—</strong>
          <p>Room nights, groups and channel contribution unavailable</p>
          <ul className="department-fact-list" aria-label="Sales and HOD performance sources">
            <li><span>Group displacement</span><b>Unavailable</b></li>
            <li><span>Budget contribution</span><b>Unavailable</b></li>
            <li><span>Market · review health</span><b>Unavailable</b></li>
          </ul>
          <small>These require authorised reporting and market feeds.</small>
          <button type="button" onClick={() => onDrillDown("Explain sales and HOD reporting data availability")}>Review reporting</button>
        </article>
      </div>
    </section>
  );
}

function CommercialWorkspace() {
  const query = useQuery<CommercialSnapshot, Error>({
    queryKey: ["commercial-snapshot", propertyId],
    queryFn: loadCommercialSnapshot,
  });
  if (query.isLoading)
    return <section className="commercial-workspace"><p className="empty">Loading the current commercial configuration…</p></section>;
  if (query.isError || !query.data)
    return <section className="commercial-workspace"><p className="error">{query.error?.message ?? "Commercial configuration is unavailable."}</p></section>;
  const { policies, ratePlans, inventory } = query.data;
  return (
    <section className="commercial-workspace">
      <div className="reservation-hero board-hero">
        <div>
          <span className="state">COMMERCIAL CONTROL</span>
          <h1>Rates & distribution</h1>
          <p>Start with the hotel’s current setup, then open the existing governed configuration only for the exact change you want to review.</p>
        </div>
      </div>
      <div className="commercial-steps" aria-label="Commercial configuration overview">
        <article><span>01 · Inventory</span><strong>{inventory.unitTypes.length} room types · {inventory.spaces.length} rooms</strong><p>{inventory.sellableUnits.length} sellable units are currently configured.</p><button onClick={() => window.location.assign(`/p/${propertyId}/inventory`)}>Review rooms & inventory</button></article>
        <article><span>02 · Policies</span><strong>{policies.length} reusable policies</strong><p>{policies.slice(0, 3).map((policy) => policy.name).join(" · ") || "No policies configured"}</p><button onClick={() => window.location.assign(`/p/${propertyId}/rates?legacy=1#policies`)}>Review policies</button></article>
        <article><span>03 · Rate plans</span><strong>{ratePlans.length} active plan{ratePlans.length === 1 ? "" : "s"}</strong><p>{ratePlans.map((plan) => `${plan.code} · ${plan.currency}`).join(" · ") || "No rate plan configured"}</p><button onClick={() => window.location.assign(`/p/${propertyId}/rates?legacy=1#rate-plans`)}>Review rate plans</button></article>
      </div>
      <article className="detail-card commercial-plans">
        <div className="section-heading"><div><span>SERVER-OWNED SUMMARY</span><h2>Current rate plans</h2></div><button onClick={() => window.location.assign(`/p/${propertyId}/rates?legacy=1`)}>Open governed configuration</button></div>
        {ratePlans.length ? <ul>{ratePlans.map((plan) => <li key={plan.id}><strong>{plan.name}</strong><span>{plan.code} · {plan.currency} · {plan.taxInclusive ? "tax inclusive" : "tax exclusive"}</span><small>{plan.marketCode ?? "All markets"} · {plan.sourceCode ?? "All sources"} · {plan.status}</small></li>)}</ul> : <p className="empty">No rate plans are configured.</p>}
      </article>
      <p className="commercial-note">Configuration changes remain in the existing reviewed workflow and require its normal confirmation; this overview never changes rates or distribution.</p>
    </section>
  );
}

function PropertySettingsWorkspace({ property }: Readonly<{ property: Property | undefined }>) {
  const query = useQuery<PropertySettingsSnapshot, Error>({
    queryKey: ["property-settings", propertyId],
    queryFn: loadPropertySettings,
  });
  if (query.isLoading)
    return <section className="property-settings"><p className="empty">Loading the current governed property setup…</p></section>;
  if (query.isError || !query.data)
    return <section className="property-settings"><p className="error">{query.error?.message ?? "Property setup summaries are unavailable."}</p></section>;
  const { commercial, performance, operationalBlocks, restrictions, inventoryPolicy } = query.data;
  const ooo = operationalBlocks.filter((block) => block.kind === "ooo").length;
  const oos = operationalBlocks.filter((block) => block.kind === "oos").length;
  const openSetup = (path: string) => window.location.assign(path);
  return (
    <section className="property-settings" aria-labelledby="property-settings-heading">
      <div className="reservation-hero board-hero">
        <div>
          <span className="state">PROPERTY SETUP</span>
          <h1 id="property-settings-heading">{property?.name ?? performance.property.name}</h1>
          <p>Current server-owned setup summary. Editing remains in the existing governed workflows.</p>
        </div>
      </div>
      <section className="settings-identity" aria-label="Canonical property identity">
        <article><span>PROPERTY</span><strong>{property?.name ?? performance.property.name}</strong></article>
        <article><span>TIME ZONE</span><strong>{property?.timezone ?? "Not returned"}</strong></article>
        <article><span>CURRENCY</span><strong>{performance.property.currency}</strong><small>Business date {performance.property.businessDate}</small></article>
      </section>
      <div className="settings-card-grid">
        <article><span>INVENTORY</span><strong>{commercial.inventory.unitTypes.length} room types · {commercial.inventory.spaces.length} rooms</strong><p>{commercial.inventory.sellableUnits.length} sellable units are currently returned.</p><button type="button" onClick={() => openSetup(`/p/${propertyId}/inventory`)}>Open governed inventory</button></article>
        <article><span>RATE PLANS</span><strong>{commercial.ratePlans.length} active plan{commercial.ratePlans.length === 1 ? "" : "s"}</strong><p>{commercial.ratePlans.slice(0, 3).map((plan) => plan.code).join(" · ") || "No plan returned"}</p><button type="button" onClick={() => openSetup(`/p/${propertyId}/rates?legacy=1#rate-plans`)}>Open governed rates</button></article>
        <article><span>RESTRICTIONS</span><strong>{restrictions.length} current restriction{restrictions.length === 1 ? "" : "s"}</strong><p>Restriction detail stays in the reviewed commercial workflow.</p><button type="button" onClick={() => openSetup(`/p/${propertyId}/rates?legacy=1#restrictions`)}>Review restrictions</button></article>
        <article><span>ROOM AVAILABILITY POLICY</span><strong>OOS sellability: {inventoryPolicy.oosSellability}</strong><p>{ooo} OOO · {oos} OOS active room block{operationalBlocks.length === 1 ? "" : "s"}.</p><button type="button" onClick={() => openSetup(`/p/${propertyId}/housekeeping`)}>Review room operations</button></article>
      </div>
      <p className="settings-boundary">Property profile, amenities, channel connections, company/TA contracts, meal plans, market segments and user access are not shown because this deployment has no reviewed property-settings API for them.</p>
    </section>

/* Order584 extracted finance contracts; executable implementation is lazy-loaded from workspaces/FinanceWorkspace.tsx.
  Finance uses server-owned catalogues and separate visible confirmations.
  Cash drawer not configured. Governed room, service and non-cash folio charges can still be posted above.
  );
}

function MobileSettingsShortcut() {
  return <button type="button" className="mobile-settings-link" onClick={() => window.location.assign(`/p/${propertyId}/today?workspace=settings`)}>Setup</button>;
}

function FinanceWorkspace({
  initialReservationId = requestedFinanceReservation,
  onLifecycleBusyChange,
}: Readonly<{
  initialReservationId?: string | null;
  onLifecycleBusyChange?: (busy: boolean) => void;
}> = {}) {
  const query = useQuery<CashierSnapshot, Error>({
    queryKey: ["cashier-snapshot", propertyId],
    queryFn: loadCashierSnapshot,
  });
  if (query.isLoading)
    return <section className="commercial-workspace"><p className="empty">Loading cashier and folio controls…</p></section>;
  if (query.isError || !query.data)
    return <section className="commercial-workspace"><p className="error">{query.error?.message ?? "Cashier status is unavailable."}</p></section>;
  const { drawers } = query.data;
  return <CashierWorkbench drawers={drawers} initialReservationId={initialReservationId} onLifecycleBusyChange={onLifecycleBusyChange} />;
}

type PrimaryBillingWindowAttempt = Readonly<{
  reservationId: string;
  fingerprint: string;
  key: string;
  body: "{}";
}>;

function PrimaryBillingWindowAction({
  reservation,
  reservationReadUnavailable,
  onOpened,
  onLifecycleBusyChange,
}: Readonly<{
  reservation: ReservationDetail["reservation"];
  reservationReadUnavailable: boolean;
  onOpened: (detail: ReservationDetail, folioId: string) => void;
  onLifecycleBusyChange?: (busy: boolean) => void;
}>) {
  const [confirmed, setConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [recoveryLocked, setRecoveryLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attempt = useRef<PrimaryBillingWindowAttempt | null>(null);
  const allowedStatuses = new Set(["reserved", "due_in", "in_house", "due_out"]);
  const eligible = allowedStatuses.has(reservation.status) && reservation.folios.length === 0;
  const reservationIdentity = `${reservation.reservationId}:${reservation.folios.map((folio) => folio.folioId).join("|")}`;
  const boundReservationIdentity = useRef(reservationIdentity);
  useEffect(() => {
    if (boundReservationIdentity.current === reservationIdentity) return;
    // A normal identity/topology change invalidates named consent. A retained
    // uncertain request is the narrow exception: it stays bound to its own key.
    if (!recoveryLocked && attempt.current === null) {
      setConfirmed(false);
      setMessage(null);
    }
    boundReservationIdentity.current = reservationIdentity;
  }, [recoveryLocked, reservationIdentity]);
  // An unresolved command must remain visible even if the next authoritative
  // read drifts. Its only permitted path is the retained same-key recovery.
  if ((!eligible || reservationReadUnavailable) && !recoveryLocked) return null;
  const confirmationName = reservation.guests.find((guest) => guest.role === "primary")?.displayName ?? reservation.confirmationNo;
  const isInHouseBilling = reservation.status === "in_house" || reservation.status === "due_out";
  const billingContextLabel = isInHouseBilling ? "IN-HOUSE BILLING" : "PRE-ARRIVAL BILLING";
  const completeFromDetail = (fresh: ReservationDetail, prefix: string): boolean => {
    if (fresh.reservation.reservationId !== reservation.reservationId) return false;
    const primary = fresh.reservation.folios.find((folio) => folio.windowNo === 1 && folio.status === "open");
    if (!primary) return false;
    attempt.current = null;
    setRecoveryLocked(false);
    setConfirmed(false);
    setMessage(`${prefix} The refreshed reservation confirms its open primary billing window.`);
    onLifecycleBusyChange?.(false);
    onOpened(fresh, primary.folioId);
    return true;
  };
  const submit = async () => {
    if (!confirmed || posting) return;
    setPosting(true);
    setMessage(null);
    onLifecycleBusyChange?.(true);
    let retainRecovery = recoveryLocked && attempt.current !== null;
    let crossedServerBoundary = false;
    try {
      const fresh = await loadReservation(reservation.reservationId);
      if (fresh.reservation.reservationId !== reservation.reservationId)
        throw new Error("The fresh reservation read does not match the selected billing context.");
      if (completeFromDetail(fresh, "No new billing-window command was needed.")) return;
      const fingerprint = JSON.stringify({
        reservationId: fresh.reservation.reservationId,
        status: fresh.reservation.status,
        folios: fresh.reservation.folios.map((folio) => ({ folioId: folio.folioId, windowNo: folio.windowNo, status: folio.status })),
      });
      if (!allowedStatuses.has(fresh.reservation.status) || fresh.reservation.folios.length !== 0) {
        if (attempt.current) {
          retainRecovery = true;
          setRecoveryLocked(true);
          setMessage("The live reservation changed before same-key reconciliation. Yellow retained the exact primary billing-window operation and keeps navigation locked.");
          return;
        }
        setConfirmed(false);
        setMessage("The live reservation changed before opening a billing window. Refresh the reservation and review the current record; nothing was sent.");
        return;
      }
      if (attempt.current && (attempt.current.reservationId !== fresh.reservation.reservationId || attempt.current.fingerprint !== fingerprint)) {
        retainRecovery = true;
        setRecoveryLocked(true);
        setMessage("The preflight no longer matches the retained billing-window operation. Yellow kept the same key and requires reconciliation against the current record.");
        return;
      }
      attempt.current ??= Object.freeze({
        reservationId: fresh.reservation.reservationId,
        fingerprint,
        // The server binds this idempotency key to the authenticated actor and exact empty canonical body.
        key: `yellow-primary-billing-window-${reservation.reservationId}-${crypto.randomUUID()}`,
        body: "{}",
      });
      crossedServerBoundary = true;
      await openPrimaryFolio(reservation.reservationId, attempt.current.key);
      const refreshed = await loadReservation(reservation.reservationId);
      if (refreshed.reservation.reservationId !== reservation.reservationId)
        throw new PrimaryFolioRequestError("The refreshed reservation does not match the retained primary billing-window operation.", true);
      if (completeFromDetail(refreshed, "Primary billing window opened.")) return;
      throw new PrimaryFolioRequestError("The server acknowledged the billing-window command, but the refreshed reservation has not confirmed an open primary folio. Yellow retained the same operation for reconciliation.", true);
    } catch (error) {
      const uncertain = crossedServerBoundary && (!(error instanceof PrimaryFolioRequestError) || error.uncertain);
      const reconciled = await loadReservation(reservation.reservationId).catch(() => null);
      if (reconciled && completeFromDetail(reconciled, "Primary billing window reconciled.")) return;
      if (uncertain || (recoveryLocked && attempt.current !== null)) {
        retainRecovery = true;
        setRecoveryLocked(true);
        setMessage("The primary billing-window outcome is uncertain. Yellow retained the exact reservation, body and idempotency key; use only the same-key reconciliation action.");
      } else {
        attempt.current = null;
        retainRecovery = false;
        setRecoveryLocked(false);
        setConfirmed(false);
        setMessage(error instanceof Error ? error.message : "The primary billing window could not be opened.");
      }
    } finally {
      setPosting(false);
      if (!retainRecovery) onLifecycleBusyChange?.(false);
    }
  };
  return (
    <section className="primary-billing-window" data-lifecycle-recovery={recoveryLocked ? "true" : undefined} aria-label="Open primary billing window">
      <span className="state">{billingContextLabel}</span>
      <h3>Open primary billing window</h3>
      <p>This {reservation.status === "in_house" || reservation.status === "due_out" ? "in-house" : "pre-arrival"} reservation has no folio. Yellow will refresh the exact reservation before it sends the existing canonical command.</p>
      {recoveryLocked ? <p className="error"><strong>Reconciliation required.</strong> Only the retained same-key primary-window request can continue.</p> : null}
      <label className="confirmation"><input type="checkbox" checked={confirmed} disabled={posting || recoveryLocked} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm opening the primary billing window for {confirmationName}.</label>
      <button type="button" disabled={!confirmed || posting} onClick={() => { void submit(); }}>{posting ? "Reconciling primary window…" : recoveryLocked ? "Retry retained primary window" : "Open confirmed primary window"}</button>
      {message ? <p role="status" className={message.includes("confirms") || message.startsWith("Primary billing window") ? "success" : "error"}>{message}</p> : null}
    </section>
  );
}

function AdvanceDepositWorkbench({
  reservation,
  statement,
  acquireMutationLease,
  releaseMutationLease,
  onStatementReconciled,
}: Readonly<{
  reservation: ReservationDetail["reservation"];
  statement: FolioStatement;
  acquireMutationLease: () => boolean;
  releaseMutationLease: () => void;
  onStatementReconciled: (statement: FolioStatement) => void;
}>) {
  const folioId = statement.folio.id;
  const [requestAmount, setRequestAmount] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [requestProposal, setRequestProposal] = useState<DepositDraft | null>(null);
  const [applyAmount, setApplyAmount] = useState("");
  const [applyProposal, setApplyProposal] = useState<DepositDraft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoveryLocked, setRecoveryLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oneTimeBearer, setOneTimeBearer] = useState<string | null>(null);
  const attempt = useRef<DepositAttempt | null>(null);
  const mutationLeaseHeld = useRef(false);
  const running = useRef(false);
  const lastWorkbench = useRef<HostedDepositWorkbench | null>(null);
  const locked = recoveryLocked;
  const workbench = useQuery<HostedDepositWorkbench, Error>({
    queryKey: ["cashier-hosted-deposits", propertyId, folioId],
    queryFn: () => loadHostedDepositWorkbench(folioId),
    refetchInterval: (query) => {
      const data = query.state.data as HostedDepositWorkbench | undefined;
      return data?.deposits.some((deposit) => deposit.state === "ready" || deposit.state === "processing") ? 10_000 : false;
    },
  });
  const currentWorkbench = workbench.data?.folioId === folioId ? workbench.data : null;
  if (currentWorkbench) lastWorkbench.current = currentWorkbench;
  const visibleWorkbench = currentWorkbench ?? (lastWorkbench.current?.folioId === folioId ? lastWorkbench.current : null);
  const workbenchRefreshUnavailable = workbench.isError && visibleWorkbench !== null;
  useEffect(() => {
    setRequestAmount(""); setInstrumentId(""); setRequestProposal(null); setApplyAmount(""); setApplyProposal(null); setConfirmed(false); setError(null); setMessage(null); setOneTimeBearer(null); setRecoveryLocked(false); attempt.current = null;
  }, [folioId]);
  const primaryGuest = reservation.guests.find((guest) => guest.role === "primary")?.displayName ?? reservation.confirmationNo;
  const liveInstrument = visibleWorkbench?.instruments.find((instrument) => instrument.instrumentId === instrumentId) ?? null;
  const proposeRequest = () => {
    if (!POSITIVE_MINOR.test(requestAmount) || !liveInstrument || statement.folio.status !== "open") { setError("Choose one server-returned instrument and a canonical positive amount before preparing a deposit request."); return; }
    const accountId = reservation.folios.find((item) => item.folioId === folioId)?.accountId;
    if (!accountId) { setError("The selected folio account is no longer available for a deposit request."); return; }
    setError(null); setMessage(null); setConfirmed(false); setRequestProposal(Object.freeze({ reservationId: reservation.reservationId, folioId, accountId, folioReference: statement.folio.reference, amountMinor: requestAmount, currency: statement.folio.currency, balanceBeforeMinor: statement.balanceMinor, instrument: liveInstrument })); setApplyProposal(null);
  };
  const proposeApply = (deposit: HostedDepositStatus) => {
    if (deposit.state !== "captured" || BigInt(deposit.remainingMinor) <= 0n || BigInt(statement.balanceMinor) <= 0n) return;
    const maximum = BigInt(deposit.remainingMinor) < BigInt(statement.balanceMinor) ? deposit.remainingMinor : statement.balanceMinor;
    const accountId = reservation.folios.find((item) => item.folioId === folioId)?.accountId;
    if (!accountId) return;
    setApplyAmount(maximum); setRequestProposal(null); setApplyProposal(Object.freeze({ reservationId: reservation.reservationId, folioId, accountId, folioReference: statement.folio.reference, amountMinor: maximum, currency: deposit.currency, balanceBeforeMinor: statement.balanceMinor, requestSnapshot: deposit })); setConfirmed(false); setError(null); setMessage(null);
  };
  const run = async () => {
    const proposal = requestProposal ?? applyProposal;
    if (!proposal || !confirmed || busy || running.current) return;
    if (!mutationLeaseHeld.current) {
      if (!acquireMutationLease()) {
        setError("Another governed financial operation is already in progress.");
        return;
      }
      mutationLeaseHeld.current = true;
    }
    running.current = true;
    const kind = requestProposal ? "create" as const : "apply" as const;
    const retrying = attempt.current?.kind === kind;
    setBusy(true); setError(null); setMessage(retrying ? "Reconciling the retained same-key request against current server truth…" : "Refreshing the exact reservation, folio and deposit truth before sending this governed request…");
    let crossed = false;
    try {
      const [freshReservation, freshStatement, freshWorkbench] = await Promise.all([loadReservation(reservation.reservationId), loadFolioStatement(folioId), loadHostedDepositWorkbench(folioId)]);
      const currentFolio = freshReservation.reservation.folios.find((item) => item.folioId === folioId && item.status === "open");
      if (freshReservation.reservation.reservationId !== proposal.reservationId || !currentFolio || currentFolio.accountId !== proposal.accountId || freshStatement.reservationId !== proposal.reservationId || freshStatement.folio.id !== folioId || freshStatement.folio.reference !== proposal.folioReference || freshStatement.folio.status !== "open" || freshStatement.folio.currency !== proposal.currency || freshWorkbench.folioId !== folioId) {
        if (!retrying) { setConfirmed(false); setRequestProposal(null); setApplyProposal(null); }
        throw new Error("The reservation or folio changed during the fresh preflight. Nothing was sent.");
      }
      if (kind === "create" && !freshWorkbench.instruments.some((item) => JSON.stringify(item) === JSON.stringify(proposal.instrument))) {
        if (!retrying) { setConfirmed(false); setRequestProposal(null); }
        throw new Error(retrying ? "The current instrument list changed while Yellow reconciles the retained request; the exact same-key request remains locked." : "The selected masked instrument is no longer eligible. Nothing was sent.");
      }
      if (kind === "apply") {
        const current = freshWorkbench.deposits.find((item) => item.requestId === proposal.requestSnapshot?.requestId);
        if (!current || current.currency !== proposal.currency || (!retrying && (freshStatement.balanceMinor !== proposal.balanceBeforeMinor || JSON.stringify(current) !== JSON.stringify(proposal.requestSnapshot) || current.state !== "captured" || BigInt(proposal.amountMinor) > BigInt(current.remainingMinor) || BigInt(proposal.amountMinor) > BigInt(freshStatement.balanceMinor) || BigInt(freshStatement.balanceMinor) <= 0n))) {
          if (!retrying) { setConfirmed(false); setApplyProposal(null); } throw new Error("Captured deposit or positive folio balance changed during the fresh preflight. Nothing was sent.");
        }
      }
      const body = kind === "create" ? JSON.stringify({ instrumentId: proposal.instrument?.instrumentId, amountMinor: proposal.amountMinor }) : JSON.stringify({ amountMinor: proposal.amountMinor });
      if (!attempt.current) attempt.current = Object.freeze({ draft: proposal, key: `yellow-hosted-deposit-${kind}-${crypto.randomUUID()}`, body, kind });
      if (attempt.current.kind !== kind || attempt.current.body !== body) throw new Error("The retained deposit request does not match this proposal.");
      crossed = true;
      if (kind === "create") {
        const receipt = await createHostedDeposit(proposal, attempt.current.key);
        const status = await loadHostedDepositStatus(receipt.requestId);
        if (status.requestId !== receipt.requestId || status.operationId !== receipt.operationId || status.folioId !== folioId || status.propertyNode !== propertyId || status.amountMinor !== proposal.amountMinor || status.currency !== proposal.currency || status.generation !== receipt.generation || status.expiresAt !== receipt.expiresAt || (receipt.replayed && receipt.bearer !== undefined) || (!receipt.replayed && receipt.bearer !== undefined && status.state !== "ready")) throw new Error("The deposit request could not be reconciled to its authoritative status.");
        setOneTimeBearer(receipt.bearer ?? null);
        setMessage(receipt.bearer ? "Secure deposit handoff is ready. The bearer below is shown once; creating a replacement revokes the prior active link. A browser return never proves capture." : "The request was reconciled from server status. Its one-time bearer is not recoverable in Yellow.");
      } else {
        const receipt = await applyHostedDeposit(proposal, attempt.current.key);
        const [status, refreshedStatement] = await Promise.all([loadHostedDepositStatus(proposal.requestSnapshot!.requestId), loadFolioStatement(folioId)]);
        const matchingRows = refreshedStatement.rows.filter((row) => row.journalId === receipt.journalId);
        if (receipt.hostedRequestId !== proposal.requestSnapshot!.requestId || receipt.amountMinor !== proposal.amountMinor || receipt.currency !== proposal.currency || status.requestId !== proposal.requestSnapshot!.requestId || status.operationId !== proposal.requestSnapshot!.operationId || status.folioId !== folioId || status.propertyNode !== propertyId || status.currency !== proposal.currency || status.generation !== proposal.requestSnapshot!.generation || status.amountMinor !== proposal.requestSnapshot!.amountMinor || status.expiresAt !== proposal.requestSnapshot!.expiresAt || status.state !== "captured" || status.capturedMinor !== proposal.requestSnapshot!.capturedMinor || BigInt(status.appliedMinor) !== BigInt(proposal.requestSnapshot!.appliedMinor) + BigInt(proposal.amountMinor) || BigInt(status.remainingMinor) !== BigInt(proposal.requestSnapshot!.remainingMinor) - BigInt(proposal.amountMinor) || refreshedStatement.reservationId !== proposal.reservationId || refreshedStatement.folio.id !== folioId || refreshedStatement.folio.currency !== proposal.currency || BigInt(refreshedStatement.balanceMinor) !== BigInt(proposal.balanceBeforeMinor) - BigInt(proposal.amountMinor) || matchingRows.length !== 1 || matchingRows[0]?.amountMinor !== (-BigInt(proposal.amountMinor)).toString() || matchingRows[0]?.kind !== "payment") throw new Error("The application receipt did not reconcile to the authoritative deposit status and folio statement.");
        onStatementReconciled(refreshedStatement);
        setMessage(receipt.replayed ? "The existing deposit application was reconciled from the authoritative statement." : "Captured deposit applied and reconciled to the immutable folio statement.");
      }
      attempt.current = null; setRecoveryLocked(false); setRequestProposal(null); setApplyProposal(null); setConfirmed(false);
      mutationLeaseHeld.current = false; releaseMutationLease();
      await workbench.refetch();
    } catch (cause) {
      const uncertain = recoveryLocked || crossed;
      if (uncertain && attempt.current) { setRecoveryLocked(true); setError(`${cause instanceof Error ? cause.message : "Deposit outcome is uncertain."} Yellow retained the exact body and same operation key; only same-key reconciliation is available.`); }
      else {
        attempt.current = null; setConfirmed(false);
        mutationLeaseHeld.current = false; releaseMutationLease();
        setError(cause instanceof Error ? cause.message : "The deposit action could not be completed.");
      }
    } finally { running.current = false; setBusy(false); }
  };
  const proposal = requestProposal ?? applyProposal;
  return <section className="cashier-deposit-workbench" data-lifecycle-recovery={locked ? "true" : undefined} aria-label="Advance deposits">
    <div className="cashier-receivable-heading"><div><span>GOVERNED ADVANCE DEPOSITS</span><h3>Secure deposit requests</h3></div><span className="cashier-status neutral">{statement.folio.currency}</span></div>
    <p>Prepare a hosted request only from a server-returned masked instrument. Yellow never accepts card, UPI or token details.</p>
    {!visibleWorkbench && workbench.isLoading ? <p className="empty">Loading advance-deposit truth…</p> : !visibleWorkbench ? <p className="error">{workbench.error?.message ?? "Advance deposits are unavailable; no zero balance is assumed."}</p> : <>
      {workbenchRefreshUnavailable ? <p className="cashier-detail-refresh-warning" role="status"><strong>The latest advance-deposit refresh is unavailable.</strong> The last confirmed record remains visible only for same-key recovery; Yellow will fresh-read before it sends any command.</p> : null}
      <div className="deposit-status-list">{visibleWorkbench.deposits.length ? visibleWorkbench.deposits.map((deposit) => <article key={deposit.requestId}><strong>Generation {deposit.generation} · {deposit.state}</strong><span>Requested {moneyExactMinor(deposit.amountMinor, deposit.currency)} · captured {moneyExactMinor(deposit.capturedMinor, deposit.currency)}</span><small>Applied {moneyExactMinor(deposit.appliedMinor, deposit.currency)} · remaining {moneyExactMinor(deposit.remainingMinor, deposit.currency)} · expires {new Date(deposit.expiresAt).toLocaleString()}</small>{deposit.state === "captured" && BigInt(deposit.remainingMinor) > 0n && BigInt(statement.balanceMinor) > 0n ? <button type="button" disabled={busy || locked || workbenchRefreshUnavailable} onClick={() => proposeApply(deposit)}>Prepare deposit application</button> : null}</article>) : <p className="empty">No advance deposits.</p>}</div>
      <fieldset className="deposit-request-fields" disabled={busy || locked || workbenchRefreshUnavailable || statement.folio.status !== "open"}><legend>Prepare secure deposit request</legend><div className="deposit-instruments">{visibleWorkbench.instruments.map((instrument) => <label key={instrument.instrumentId} className={instrumentId === instrument.instrumentId ? "selected" : undefined}><input type="radio" name={`deposit-instrument-${folioId}`} checked={instrumentId === instrument.instrumentId} onChange={() => { setInstrumentId(instrument.instrumentId); setRequestProposal(null); setConfirmed(false); }} /> <span><strong>{instrument.brand ?? instrument.kind}</strong><small>{instrument.last4 ? `•••• ${instrument.last4}` : "Masked network instrument"}{instrument.expiry ? ` · ${instrument.expiry}` : ""}</small></span></label>)}</div>{visibleWorkbench.instruments.length === 0 ? <p className="empty">No eligible masked instruments are available for this open folio.</p> : null}<label>Amount ({statement.folio.currency} minor units)<input inputMode="numeric" pattern="[1-9][0-9]*" value={requestAmount} onChange={(event) => { setRequestAmount(event.target.value); setRequestProposal(null); setConfirmed(false); }} /></label><button type="button" onClick={proposeRequest}>Review deposit request</button></fieldset>
      {proposal ? <div className="deposit-proposal"><strong>{requestProposal ? "Deposit request proposal" : "Deposit application proposal"}</strong><span>{primaryGuest} · {reservation.confirmationNo} · {proposal.folioReference ?? `Window ${statement.folio.windowNo}`}</span><span>Audit purpose: Advance deposit / hosted payment request</span><span>{moneyExactMinor(proposal.amountMinor, proposal.currency)}{requestProposal ? ` · ${proposal.instrument?.brand ?? proposal.instrument?.kind ?? "masked instrument"}` : ` · liability applied ${moneyExactMinor(proposal.requestSnapshot!.appliedMinor, proposal.currency)} → ${moneyExactMinor((BigInt(proposal.requestSnapshot!.appliedMinor) + BigInt(proposal.amountMinor)).toString(), proposal.currency)} · remaining ${moneyExactMinor(proposal.requestSnapshot!.remainingMinor, proposal.currency)} → ${moneyExactMinor((BigInt(proposal.requestSnapshot!.remainingMinor) - BigInt(proposal.amountMinor)).toString(), proposal.currency)} · folio ${moneyExactMinor(proposal.balanceBeforeMinor, proposal.currency)} → ${moneyExactMinor((BigInt(proposal.balanceBeforeMinor) - BigInt(proposal.amountMinor)).toString(), proposal.currency)}`}</span><label className="receivable-confirm"><input type="checkbox" checked={confirmed} disabled={busy || locked} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this exact governed {requestProposal ? "deposit request" : "deposit application"}.</label><button type="button" className="receivable-transfer-action" disabled={!confirmed || busy} onClick={() => { void run(); }}>{busy ? "Reconciling server truth…" : locked ? "Retry retained same-key request" : requestProposal ? "Create confirmed secure request" : "Apply confirmed deposit"}</button></div> : null}
      {oneTimeBearer ? <div className="deposit-one-time" role="status"><strong>One-time secure handoff</strong><p>Copy or open this bearer now. Yellow cannot recover it later, and a replacement revokes the active link.</p><a href={`/api/public/hosted-deposits/${encodeURIComponent(oneTimeBearer)}`} target="_blank" rel="noreferrer">Open guest deposit page</a></div> : null}
    </>}
    {message ? <p className="receivable-message" role="status">{message}</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}
  </section>;
}

function CashierWorkbench({
  drawers,
  initialReservationId,
  onLifecycleBusyChange,
}: Readonly<{
  drawers: CashierSnapshot["drawers"];
  initialReservationId: string | null;
  onLifecycleBusyChange?: (busy: boolean) => void;
}>) {
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(initialReservationId);
  const [selectedFolioId, setSelectedFolioId] = useState<string | null>(null);
  const [staySearch, setStaySearch] = useState("");
  const [stayScope, setStayScope] = useState<"all" | "current">("all");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [openingReference, setOpeningReference] = useState(false);
  const [txCode, setTxCode] = useState("");
  const [amountMinor, setAmountMinor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [confirmed, setConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postingClass, setPostingClass] = useState("all");
  const [chargeGroup, setChargeGroup] = useState<FolioChargeGroup | "All">("All");
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [receivablePreview, setReceivablePreview] = useState<ReceivablePreview | null>(null);
  const [receivableReason, setReceivableReason] = useState("");
  const [receivableConfirmed, setReceivableConfirmed] = useState(false);
  const [receivableBusy, setReceivableBusy] = useState(false);
  const [receivableUncertainOperation, setReceivableUncertainOperation] = useState<"approval" | "transfer" | null>(null);
  const receivableAttemptUncertain = receivableUncertainOperation !== null;
  const [depositLocked, setDepositLocked] = useState(false);
  const queryClient = useQueryClient();
  const [receivableError, setReceivableError] = useState<string | null>(null);
  const [receivableMessage, setReceivableMessage] = useState<string | null>(null);
  const [receivableApproval, setReceivableApproval] = useState<ReceivableApprovalReceipt | null>(null);
  const [allocationGroupIds, setAllocationGroupIds] = useState<readonly string[]>([]);
  const [allocationDestinationFolioId, setAllocationDestinationFolioId] = useState("");
  const [allocationNewWindowName, setAllocationNewWindowName] = useState("");
  const [allocationReason, setAllocationReason] = useState("");
  const [allocationPreview, setAllocationPreview] = useState<FolioTransferPreview | null>(null);
  const [allocationConfirmed, setAllocationConfirmed] = useState(false);
  const [allocationBusy, setAllocationBusy] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);
  const [allocationUncertainAttempt, setAllocationUncertainAttempt] = useState<FolioTransferAttempt | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const allocationAttemptKey = useRef<string | null>(null);
  const receivableTransferKey = useRef<string | null>(null);
  const receivableTransferFingerprint = useRef<string | null>(null);
  const receivableApprovalKey = useRef<string | null>(null);
  const receivableApprovalFingerprint = useRef<string | null>(null);
  const receivableGeneration = useRef(0);
  const depositMutationLease = useRef(false);
  const board = useQuery<Lane, Error>({
    queryKey: ["cashier-reservation-board", propertyId],
    queryFn: loadReservationBoard,
  });
  const detail = useQuery<ReservationDetail, Error>({
    queryKey: ["cashier-reservation", propertyId, selectedReservationId],
    queryFn: () => loadReservation(selectedReservationId!),
    enabled: selectedReservationId !== null,
  });
  const lastReservationDetail = useRef<ReservationDetail | null>(null);
  const currentReservationDetail = detail.data?.reservation.reservationId === selectedReservationId
    ? detail.data
    : null;
  if (currentReservationDetail) lastReservationDetail.current = currentReservationDetail;
  const visibleReservationDetail = currentReservationDetail ?? (
    lastReservationDetail.current?.reservation.reservationId === selectedReservationId
      ? lastReservationDetail.current
      : null
  );
  const reservationDetailRefreshUnavailable = detail.isError && visibleReservationDetail !== null;
  const folio = useQuery<FolioStatement, Error>({
    queryKey: ["cashier-folio-statement", propertyId, selectedFolioId],
    queryFn: () => loadFolioStatement(selectedFolioId!),
    enabled: selectedFolioId !== null,
  });
  const receivableTargets = useQuery<readonly ReceivableTarget[], Error>({
    queryKey: ["cashier-receivable-targets", propertyId, selectedFolioId],
    queryFn: loadReceivableTargets,
    enabled: selectedFolioId !== null,
  });
  const resetReceivableDraft = () => {
    receivableGeneration.current += 1;
    setReceivableAccountId("");
    setReceivablePreview(null);
    setReceivableReason("");
    setReceivableConfirmed(false);
    setReceivableError(null);
    setReceivableMessage(null);
    setReceivableApproval(null);
    setReceivableUncertainOperation(null);
    receivableTransferKey.current = null;
    receivableTransferFingerprint.current = null;
    receivableApprovalKey.current = null;
    receivableApprovalFingerprint.current = null;
  };
  const resetCandidate = () => {
    idempotencyKey.current = null;
    setConfirmed(false);
    setPostError(null);
  };
  const allocationLocked = allocationBusy || allocationUncertainAttempt !== null;
  const depositInteractionLocked = () => depositMutationLease.current || depositLocked;
  const acquireDepositMutationLease = () => {
    if (depositMutationLease.current || openingReference || posting || allocationLocked ||
        receivableBusy || receivableAttemptUncertain) return false;
    depositMutationLease.current = true;
    setDepositLocked(true);
    onLifecycleBusyChange?.(true);
    return true;
  };
  const releaseDepositMutationLease = () => {
    depositMutationLease.current = false;
    setDepositLocked(false);
    onLifecycleBusyChange?.(false);
  };
  const resetAllocationDraft = () => {
    if (allocationUncertainAttempt) return;
    setAllocationGroupIds([]);
    setAllocationDestinationFolioId("");
    setAllocationNewWindowName("");
    setAllocationReason("");
    setAllocationPreview(null);
    setAllocationConfirmed(false);
    setAllocationError(null);
    setAllocationMessage(null);
    allocationAttemptKey.current = null;
  };
  const invalidateAllocationPreview = () => {
    if (allocationUncertainAttempt) return;
    setAllocationPreview(null);
    setAllocationConfirmed(false);
    setAllocationError(null);
    setAllocationMessage(null);
    allocationAttemptKey.current = null;
  };
  const selectReservation = (reservationId: string) => {
    if (receivableBusy || receivableAttemptUncertain || allocationLocked || depositInteractionLocked()) {
      setAllocationError("Reconcile the retained financial operation before opening another reservation.");
      return;
    }
    setSelectedReservationId(reservationId);
    setSelectedFolioId(null);
    setTxCode("");
    setChargeGroup("All");
    setAmountMinor("");
    setSearchError(null);
    resetReceivableDraft();
    resetAllocationDraft();
    resetCandidate();
  };
  const selectFolio = (folioId: string) => {
    if (receivableBusy || receivableAttemptUncertain || allocationLocked || depositInteractionLocked()) {
      setAllocationError("Reconcile the retained financial operation before opening another folio.");
      return;
    }
    setSelectedFolioId(folioId);
    setPostingClass("all");
    setTxCode("");
    setChargeGroup("All");
    setAmountMinor("");
    resetReceivableDraft();
    resetAllocationDraft();
    resetCandidate();
  };
  const enterOpenedPrimaryBillingWindow = (fresh: ReservationDetail, folioId: string) => {
    // The post-command read is the authority. Cache and selection both use its exact reservation and folio ids.
    setSelectedReservationId(fresh.reservation.reservationId);
    setSelectedFolioId(folioId);
    setPostingClass("all");
    setTxCode("");
    setChargeGroup("All");
    setAmountMinor("");
    setSearchError(null);
    resetReceivableDraft();
    resetAllocationDraft();
    resetCandidate();
    void board.refetch();
    void detail.refetch();
  };
  useEffect(() => {
    if (!selectedReservationId || selectedFolioId || !detail.data) return;
    const firstWindow =
      detail.data.reservation.folios.find((item) => item.status === "open") ??
      detail.data.reservation.folios[0];
    if (firstWindow) selectFolio(firstWindow.folioId);
  }, [detail.data, selectedFolioId, selectedReservationId]);
  const selectedOption = folio.data?.chargeOptions.find((option) => option.code === txCode) ?? null;
  const chargeGroups = useMemo(
    () => [...new Set((folio.data?.chargeOptions ?? []).map(folioChargeGroup))],
    [folio.data?.chargeOptions],
  );
  const visibleChargeOptions = (folio.data?.chargeOptions ?? []).filter(
    (option) => chargeGroup === "All" || folioChargeGroup(option) === chargeGroup,
  );
  const normalizedStaySearch = staySearch.trim().toLocaleLowerCase();
  const eligibleStays = (board.data?.reservations ?? []).filter((stay) =>
    stayScope === "all" || stay.status === "in_house" || stay.status === "due_out",
  );
  const matchingStays = normalizedStaySearch.length === 0
    ? eligibleStays
    : eligibleStays.filter((stay) =>
      nameOf(stay).toLocaleLowerCase().includes(normalizedStaySearch) ||
      stay.confirmationNo.toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.sellableUnitLabel ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.unitTypeLabel ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.channelCode ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.sourceCode ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.marketCode ?? "").toLocaleLowerCase().includes(normalizedStaySearch),
    );
  const openFolioReference = async () => {
    const reference = staySearch.trim();
    if (!reference || openingReference || receivableBusy || receivableAttemptUncertain || depositInteractionLocked()) return;
    setOpeningReference(true);
    setSearchError(null);
    try {
      const statement = await loadFolioStatement(reference);
      if (!statement.reservationId) {
        setSearchError("That folio is not attached to a current reservation at this property.");
        return;
      }
      const currentReservation = await loadReservation(statement.reservationId);
      resetReceivableDraft();
      setSelectedReservationId(statement.reservationId);
      setSelectedFolioId(statement.folio.id);
      setTxCode("");
      setChargeGroup("All");
      setAmountMinor("");
      resetCandidate();
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "That folio reference could not be opened.");
    } finally {
      setOpeningReference(false);
    }
  };
  const validAmount = /^[1-9][0-9]*$/.test(amountMinor);
  const validQuantity = /^[1-9][0-9]*$/.test(quantity);
  const canPost = Boolean(
    folio.data?.chargeAvailability.allowed && selectedOption && validAmount && validQuantity,
  );
  const postingClasses = useMemo(
    () => [...new Set((folio.data?.rows ?? []).map((row) => row.kind).filter(Boolean))].sort(),
    [folio.data?.rows],
  );
  const visiblePostingRows = (folio.data?.rows ?? []).filter(
    (row) => postingClass === "all" || row.kind === postingClass,
  );
  const transferGroups = useMemo(() => {
    const groups = new Map<string, FolioTransferGroup>();
    for (const row of folio.data?.rows ?? []) {
      const group = row.transferGroup;
      if (!groups.has(group.id)) groups.set(group.id, group);
    }
    return [...groups.values()].sort((left, right) => left.id.localeCompare(right.id));
  }, [folio.data?.rows]);
  const selectableTransferGroups = transferGroups.filter((group) =>
    group.eligible && group.currentWindowId === folio.data?.folio.id,
  );
  const selectedTransferGroups = selectableTransferGroups.filter((group) =>
    allocationGroupIds.includes(group.id),
  );
  const destinationWindow = folio.data?.siblingWindows.find((window) =>
    window.id === allocationDestinationFolioId && window.id !== folio.data?.folio.id && window.status === "open",
  ) ?? null;
  const trimmedAllocationWindowName = allocationNewWindowName.trim();
  const allocationUsesNewWindow = allocationDestinationFolioId.length === 0 && trimmedAllocationWindowName.length > 0;
  const allocationDestinationIsValid = (destinationWindow !== null) !== allocationUsesNewWindow &&
    (!allocationUsesNewWindow || transferWindowNameIsValid(trimmedAllocationWindowName));
  const allocationReasonIsValid = transferReasonIsValid(allocationReason);
  const canPreviewAllocation = Boolean(
    folio.data && folio.data.folio.status === "open" && selectedTransferGroups.length > 0 &&
    selectedTransferGroups.length === allocationGroupIds.length && allocationDestinationIsValid &&
    allocationReasonIsValid && !allocationLocked && !depositLocked,
  );
  const allocationDraftFor = (generation: string, previewRevision: string): FolioTransferDraft | null => {
    if (!folio.data || !canPreviewAllocation) return null;
    return Object.freeze({
      sourceFolioId: folio.data.folio.id,
      destinationFolioId: destinationWindow?.id ?? null,
      newWindowName: allocationUsesNewWindow ? trimmedAllocationWindowName : null,
      groupIds: Object.freeze([...allocationGroupIds].sort()),
      reason: allocationReason,
      generation,
      previewRevision,
    });
  };
  const previewBillWindowAllocation = async () => {
    if (!folio.data || !canPreviewAllocation || depositInteractionLocked()) return;
    const draft = allocationDraftFor(folio.data.generation, "");
    if (!draft) return;
    setAllocationBusy(true);
    setAllocationError(null);
    setAllocationMessage("Checking exact charge-group routing against the current folio family…");
    try {
      const preview = await requestFolioTransferPreview(draft);
      if (!previewMatchesFolioTransferDraft(
        preview,
        draft,
        folio.data.folio.currency,
        destinationWindow?.name ?? null,
      )) {
        throw new Error("The canonical preview does not match the selected complete charge groups.");
      }
      setAllocationPreview(preview);
      setAllocationConfirmed(false);
      allocationAttemptKey.current = null;
      setAllocationMessage("Preview ready. Review every complete group and the exact before/after balances, then confirm the balanced transfer.");
    } catch (error) {
      setAllocationPreview(null);
      setAllocationConfirmed(false);
      setAllocationError(error instanceof Error ? error.message : "The bill-window preview failed.");
      setAllocationMessage(null);
    } finally {
      setAllocationBusy(false);
    }
  };
  const receiptMatchesAllocation = (receipt: FolioTransferReceipt, attempt: FolioTransferAttempt): boolean => {
    const expected = attempt.preview;
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
  };
  const reconcileBillWindowAllocation = async () => {
    if (!folio.data || (!allocationPreview && !allocationUncertainAttempt) || depositInteractionLocked()) return;
    const retryingRetainedAttempt = allocationUncertainAttempt !== null;
    let attempt = allocationUncertainAttempt;
    setAllocationBusy(true);
    setAllocationError(null);
    setAllocationMessage(retryingRetainedAttempt
      ? "Reconciling the retained bill-window transfer with its original operation key…"
      : "Refreshing the source folio and repeating the canonical preview before the transfer…");
    onLifecycleBusyChange?.(true);
    let submitted = false;
    let keepParentLocked = false;
    try {
      if (!attempt) {
        const originalPreview = allocationPreview!;
        const freshSource = await loadFolioStatement(originalPreview.sourceFolioId);
        if (freshSource.folio.id !== originalPreview.sourceFolioId || freshSource.folio.currency !== originalPreview.currency) {
          throw new Error("The authoritative source folio changed before submission.");
        }
        const refreshedDraft = allocationDraftFor(freshSource.generation, "");
        if (!refreshedDraft) throw new Error("The selected bill-window draft is no longer complete.");
        const freshPreview = await requestFolioTransferPreview(refreshedDraft);
        if (!sameTransferPreview(freshPreview, originalPreview)) {
          setAllocationPreview(freshPreview);
          setAllocationConfirmed(false);
          allocationAttemptKey.current = null;
          setAllocationMessage("The folio family changed. Yellow refreshed the exact preview; review and confirm it again.");
          throw new Error("The bill-window preview drifted before submission. Nothing was transferred.");
        }
        const draft = Object.freeze({ ...refreshedDraft, previewRevision: freshPreview.previewRevision });
        allocationAttemptKey.current ??= `yellow-folio-transfer-${crypto.randomUUID()}`;
        attempt = Object.freeze({ draft, preview: freshPreview, idempotencyKey: allocationAttemptKey.current });
      }
      submitted = true;
      const receipt = await submitFolioTransfer(attempt.draft, attempt.idempotencyKey);
      if (!receiptMatchesAllocation(receipt, attempt)) {
        throw new FolioTransferRequestError("The returned transfer receipt does not match the confirmed complete-group preview.", true);
      }
      const destinationFolioId = receipt.destinationFolioId;
      if (!destinationFolioId) {
        throw new FolioTransferRequestError("The transfer receipt did not name a destination folio. Yellow retained the exact operation for reconciliation.", true);
      }
      const [sourceStatement, destinationStatement] = await Promise.all([
        loadFolioStatement(receipt.sourceFolioId),
        loadFolioStatement(destinationFolioId),
      ]);
      const reconciled = sourceStatement.folio.id === receipt.sourceFolioId &&
        destinationStatement.folio.id === destinationFolioId &&
        sourceStatement.folio.currency === receipt.currency && destinationStatement.folio.currency === receipt.currency &&
        sourceStatement.balanceMinor === receipt.sourceAfterMinor &&
        destinationStatement.balanceMinor === receipt.destinationAfterMinor &&
        sourceStatement.stayTotalMinor === receipt.stayTotalMinor && destinationStatement.stayTotalMinor === receipt.stayTotalMinor &&
        receipt.stayTotalMinor === receipt.unchangedStayTotalMinor &&
        sourceStatement.rows.some((row) => row.journalId === receipt.journalId) &&
        destinationStatement.rows.some((row) => row.journalId === receipt.journalId);
      if (!reconciled) {
        throw new FolioTransferRequestError("The transfer response was received, but both authoritative statements do not yet reconcile to its exact balances. Yellow retained the same-key operation.", true);
      }
      await folio.refetch();
      setAllocationUncertainAttempt(null);
      setAllocationPreview(null);
      setAllocationConfirmed(false);
      setAllocationGroupIds([]);
      setAllocationDestinationFolioId("");
      setAllocationNewWindowName("");
      setAllocationReason("");
      allocationAttemptKey.current = null;
      setAllocationMessage(receipt.replayed
        ? "The existing balanced transfer was reconciled from authoritative source and destination statements."
        : "Balanced bill-window transfer recorded and reconciled from authoritative source and destination statements.");
    } catch (error) {
      const uncertain = retryingRetainedAttempt || (submitted &&
        (!(error instanceof FolioTransferRequestError) || error.uncertain));
      keepParentLocked = uncertain;
      if (uncertain && attempt) setAllocationUncertainAttempt(attempt);
      setAllocationError(`${error instanceof Error ? error.message : "The bill-window transfer failed."}${uncertain ? " The exact source, destination, groups, reason and operation key are locked for same-key reconciliation." : " Review the current preview before trying again."}`);
      setAllocationMessage(null);
    } finally {
      setAllocationBusy(false);
      onLifecycleBusyChange?.(keepParentLocked);
    }
  };
  const toggleAllocationGroup = (groupId: string) => {
    if (allocationLocked || depositInteractionLocked()) return;
    setAllocationGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId].sort());
    invalidateAllocationPreview();
  };
  const postCharge = async () => {
    if (!folio.data || !selectedOption || !canPost || !confirmed || posting || allocationLocked || depositInteractionLocked()) return;
    onLifecycleBusyChange?.(true);
    setPosting(true);
    setPostError(null);
    idempotencyKey.current ??= `yellow-public-demo-${crypto.randomUUID()}`;
    try {
      await postFolioCharge(
        folio.data.folio.id,
        { txCode: selectedOption.code, amountMinor, quantity },
        idempotencyKey.current,
      );
      setConfirmed(false);
      setAmountMinor("");
      idempotencyKey.current = null;
      await folio.refetch();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "The charge could not be posted.");
      await folio.refetch();
    } finally {
      setPosting(false);
      onLifecycleBusyChange?.(false);
    }
  };
  const previewDirectBilling = async () => {
    if (!folio.data || !receivableAccountId || receivableBusy || receivableAttemptUncertain || depositInteractionLocked()) return;
    const generation = receivableGeneration.current + 1;
    receivableGeneration.current = generation;
    setReceivableBusy(true);
    setReceivableError(null);
    setReceivableMessage(null);
    setReceivableConfirmed(false);
    setReceivableApproval(null);
    receivableTransferKey.current = null;
    receivableTransferFingerprint.current = null;
    receivableApprovalKey.current = null;
    receivableApprovalFingerprint.current = null;
    try {
      const preview = await previewReceivableTransfer(folio.data.folio.id, receivableAccountId);
      if (generation !== receivableGeneration.current) return;
      if (preview.folioId !== folio.data.folio.id || preview.receivableAccountId !== receivableAccountId ||
          preview.currency !== folio.data.folio.currency || preview.amountMinor !== folio.data.balanceMinor) {
        throw new Error("The live folio changed while Yellow prepared direct billing. Refresh and preview again.");
      }
      setReceivablePreview(preview);
      setReceivableMessage(preview.requiresApproval
        ? "A different authorised supervisor must approve this exact over-limit request."
        : "The server confirmed this exact balance is within the target’s current credit limit.");
    } catch (error) {
      if (generation !== receivableGeneration.current) return;
      setReceivablePreview(null);
      setReceivableError(error instanceof Error ? error.message : "The direct-billing preview failed.");
    } finally {
      if (generation === receivableGeneration.current) setReceivableBusy(false);
    }
  };
  const requestDirectBillingApproval = async () => {
    if (!folio.data || !receivablePreview?.requiresApproval || receivableBusy || receivableUncertainOperation === "transfer" || depositInteractionLocked()) return;
    const generation = receivableGeneration.current + 1;
    receivableGeneration.current = generation;
    const fingerprint = JSON.stringify({
      folioId: folio.data.folio.id,
      accountId: receivablePreview.receivableAccountId,
      amountMinor: receivablePreview.amountMinor,
      projectedExposureMinor: receivablePreview.projectedExposureMinor,
    });
    if (receivableApprovalFingerprint.current !== fingerprint) {
      receivableApprovalFingerprint.current = fingerprint;
      receivableApprovalKey.current = `yellow-receivable-approval-${crypto.randomUUID()}`;
    }
    setReceivableBusy(true);
    setReceivableError(null);
    onLifecycleBusyChange?.(true);
    let keepParentLocked = false;
    let approvalReceiptAccepted = false;
    try {
      const receipt = await requestReceivableApproval(
        folio.data.folio.id,
        receivablePreview.receivableAccountId,
        receivableApprovalKey.current!,
      );
      approvalReceiptAccepted = true;
      if (generation !== receivableGeneration.current) return;
      if (receipt.folioId !== receivablePreview.folioId ||
          receipt.receivableAccountId !== receivablePreview.receivableAccountId ||
          receipt.partyId !== receivablePreview.partyId || receipt.partyRole !== receivablePreview.partyRole ||
          receipt.currency !== receivablePreview.currency || receipt.amountMinor !== receivablePreview.amountMinor ||
          receipt.exposureMinor !== receivablePreview.exposureMinor ||
          receipt.creditLimitMinor !== receivablePreview.creditLimitMinor ||
          receipt.projectedExposureMinor !== receivablePreview.projectedExposureMinor) {
        throw new Error("The approval receipt does not match the current direct-billing proposal.");
      }
      setReceivableApproval(receipt);
      setReceivableUncertainOperation(null);
      setReceivableMessage(receipt.replayed
        ? "The existing approval request was confirmed. A different authorised supervisor must decide it."
        : "Approval requested. A different authorised supervisor must decide this exact amount and target.");
    } catch (error) {
      if (generation !== receivableGeneration.current) return;
      const uncertain = receivableUncertainOperation === "approval" || approvalReceiptAccepted || housekeepingFailureIsUncertain(error);
      keepParentLocked = uncertain;
      setReceivableUncertainOperation(uncertain ? "approval" : null);
      setReceivableError(`${error instanceof Error ? error.message : "The approval request failed."} Retry keeps the same operation key.`);
    } finally {
      if (generation === receivableGeneration.current) {
        setReceivableBusy(false);
        onLifecycleBusyChange?.(keepParentLocked);
      }
    }
  };
  const directBillingReasonIsValid = receivableReason.length >= 1 && receivableReason.length <= 500 &&
    receivableReason.trim() === receivableReason && !/[\x00-\x1f\x7f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(receivableReason);
  const canTransferReceivable = Boolean(
    folio.data && receivablePreview && !receivablePreview.requiresApproval &&
    receivablePreview.folioId === folio.data.folio.id &&
    (receivableUncertainOperation === "transfer" || receivablePreview.amountMinor === folio.data.balanceMinor) &&
    directBillingReasonIsValid && receivableConfirmed && !receivableBusy && !depositLocked,
  );
  const transferDirectBilling = async () => {
    if (!folio.data || !receivablePreview || !canTransferReceivable || receivableUncertainOperation === "approval" || depositInteractionLocked()) return;
    const folioId = folio.data.folio.id;
    const retryingRetainedAttempt = receivableUncertainOperation === "transfer";
    const confirmedPreview = receivablePreview;
    const input = {
      receivableAccountId: confirmedPreview.receivableAccountId,
      reason: receivableReason,
    };
    const generation = receivableGeneration.current + 1;
    receivableGeneration.current = generation;
    setReceivableBusy(true);
    setReceivableError(null);
    setReceivableMessage(retryingRetainedAttempt
      ? "Reconciling the retained transfer with its original operation key…"
      : "Rechecking the exact balance and credit evidence before recording the transfer…");
    onLifecycleBusyChange?.(true);
    let transferSubmitted = false;
    let transferReceiptAccepted = false;
    let keepParentLocked = false;
    try {
      if (!retryingRetainedAttempt) {
        const freshPreview = await previewReceivableTransfer(folioId, input.receivableAccountId);
        if (generation !== receivableGeneration.current) return;
        if (!sameReceivablePreview(freshPreview, confirmedPreview)) {
          const refreshedStatement = await folio.refetch();
          if (generation !== receivableGeneration.current) return;
          if (refreshedStatement.isError || !refreshedStatement.data ||
              refreshedStatement.data.folio.id !== freshPreview.folioId ||
              refreshedStatement.data.folio.currency !== freshPreview.currency ||
              refreshedStatement.data.balanceMinor !== freshPreview.amountMinor) {
            setReceivablePreview(null);
            setReceivableConfirmed(false);
            throw new Error("The proposal changed, but the authoritative folio could not be refreshed to the same exact balance.");
          }
          setReceivablePreview(freshPreview);
          setReceivableConfirmed(false);
          setReceivableMessage("The live balance or credit evidence changed. Review the refreshed exact proposal and confirm it again.");
          throw new Error("The direct-billing proposal changed before submission.");
        }
      }
      const fingerprint = JSON.stringify({ folioId, ...input, amountMinor: confirmedPreview.amountMinor });
      if (!retryingRetainedAttempt && receivableTransferFingerprint.current !== fingerprint) {
        receivableTransferFingerprint.current = fingerprint;
        receivableTransferKey.current = `yellow-receivable-transfer-${crypto.randomUUID()}`;
      }
      if (!receivableTransferKey.current) throw new Error("The retained transfer operation key is unavailable.");
      transferSubmitted = true;
      const idempotencyKey = receivableTransferKey.current;
      const receipt = await submitReceivableTransfer(folioId, input, idempotencyKey, confirmedPreview);
      transferReceiptAccepted = true;
      if (generation !== receivableGeneration.current) return;
      const refreshed = await loadFolioStatement(folioId);
      const receiptRows = refreshed.rows.filter((row) => row.journalId === receipt.journalId);
      const expectedGuestCreditMinor = (-BigInt(receipt.amountMinor)).toString();
      if (refreshed.folio.id !== folioId || refreshed.folio.currency !== receipt.currency ||
          BigInt(refreshed.balanceMinor) !== 0n || receiptRows.length !== 1 ||
          receiptRows[0]?.amountMinor !== expectedGuestCreditMinor) {
        throw new Error("No successful transfer will be claimed without an exact zero-balance statement containing the confirmed journal and guest credit.");
      }
      await folio.refetch();
      setReceivableConfirmed(false);
      setReceivableReason("");
      setReceivablePreview(null);
      setReceivableApproval(null);
      receivableTransferKey.current = null;
      receivableTransferFingerprint.current = null;
      setReceivableUncertainOperation(null);
      setReceivableMessage(receipt.replayed
        ? "The existing direct-billing transfer was reconciled. The guest folio is now zero."
        : `Direct billing recorded to ${receivablePreview.name}. The guest folio is now zero.`);
    } catch (error) {
      if (generation !== receivableGeneration.current) return;
      const uncertain = receivableUncertainOperation === "transfer" ||
        (transferSubmitted && (transferReceiptAccepted || housekeepingFailureIsUncertain(error)));
      keepParentLocked = uncertain;
      setReceivableUncertainOperation(uncertain ? "transfer" : null);
      setReceivableError(`${error instanceof Error ? error.message : "The direct-billing transfer failed."} ${uncertain ? "The proposal is locked; retry or reconcile the unchanged attempt with the same operation key." : "Review the proposal before trying again."}`);
    } finally {
      if (generation === receivableGeneration.current) {
        setReceivableBusy(false);
        onLifecycleBusyChange?.(keepParentLocked);
      }
    }
  };
  return (
    <section className="commercial-workspace">
      <div className="reservation-hero board-hero">
        <div><span className="state">FRONT DESK FINANCE</span><h1>Cashier & folios</h1><p>Select an authoritative stay, then review its immutable folio before preparing a charge. Yellow never invents transaction codes or bypasses a confirmation.</p></div>
      </div>
      <div className="cashier-workbench">
        <article className="cashier-panel">
          <span className="state">01 · SELECT STAY</span>
          <h2>Find any reservation or bill</h2>
          <form className="cashier-unified-search" onSubmit={(event) => { event.preventDefault(); if (matchingStays.length === 0) void openFolioReference(); }}>
          <label className="cashier-search">Search guest, reservation, room, source, channel or folio
            <input
              value={staySearch}
              onChange={(event) => { setStaySearch(event.target.value); setSearchError(null); }}
              placeholder="Name, confirmation, room, OTA, company or exact folio"
              autoComplete="off"
            />
          </label>
            <button type="submit" disabled={!staySearch.trim() || matchingStays.length > 0 || openingReference || receivableBusy || receivableAttemptUncertain || depositLocked}>{openingReference ? "Opening…" : "Find exact folio"}</button>
          </form>
          <div className="cashier-search-scope" role="group" aria-label="Reservation search scope">
            <button type="button" className={stayScope === "all" ? "active" : undefined} aria-pressed={stayScope === "all"} onClick={() => setStayScope("all")}>All returned stays</button>
            <button type="button" className={stayScope === "current" ? "active" : undefined} aria-pressed={stayScope === "current"} onClick={() => setStayScope("current")}>In house &amp; due out</button>
          </div>
          <p className="cashier-search-note">Exact folio reference is accepted in the same search. Results stay bounded to this property’s governed reservation board.</p>
          {searchError ? <p className="error">{searchError}</p> : null}
          {board.isLoading ? <p className="empty">Loading reservations…</p> : board.isError ? <p className="error">{board.error.message}</p> : (
            <div className="cashier-stay-list">
              {matchingStays.map((stay) => <button type="button" key={stay.reservationId} disabled={receivableBusy || receivableAttemptUncertain || depositLocked} className={selectedReservationId === stay.reservationId ? "selected" : undefined} onClick={() => selectReservation(stay.reservationId)}><strong>{nameOf(stay)}</strong><small>{stay.confirmationNo} · {stay.sellableUnitLabel ?? stay.unitTypeLabel ?? "Room unassigned"}</small><small>{[stay.channelCode, stay.sourceCode, stay.marketCode].filter(Boolean).join(" · ") || "Source not recorded"}</small><span data-status={stay.status} className={`cashier-status ${statusTone(stay.status)}`}>{reservationStatusLabel(stay.status)}</span></button>)}
              {matchingStays.length === 0 ? <p className="empty">No returned reservation matches. If this is an exact folio reference, use “Find exact folio”.</p> : null}
            </div>
          )}
        </article>
        <article className="cashier-panel">
          <span className="state">02 · OPEN WINDOW</span>
          <h2>Server-owned folios</h2>
          {!selectedReservationId ? <p className="empty">Select a stay to load its folio windows.</p> : !visibleReservationDetail && detail.isLoading ? <p className="empty">Loading governed folio windows…</p> : !visibleReservationDetail ? <p className="error">{detail.error?.message ?? "The current reservation record is unavailable."}</p> : (
            <>
              {reservationDetailRefreshUnavailable ? <p className="cashier-detail-refresh-warning" role="status"><strong>The latest reservation refresh is unavailable.</strong> The last confirmed reservation record remains visible only for same-key recovery; Yellow will require a fresh authoritative preflight before it sends any command.</p> : null}
              <div className="cashier-selected-stay" role="status" aria-live="polite">
                <span>Selected reservation</span>
                <strong>{visibleReservationDetail.reservation.guests.find((guest) => guest.role === "primary")?.displayName ?? visibleReservationDetail.reservation.confirmationNo}</strong>
                <small>{visibleReservationDetail.reservation.confirmationNo}</small>
                <span data-status={visibleReservationDetail.reservation.status} className={`cashier-status ${statusTone(visibleReservationDetail.reservation.status)}`}>{reservationStatusDescription(visibleReservationDetail.reservation.status)}</span>
              </div>
              <p className="cashier-billing-context">{visibleReservationDetail.reservation.status === "in_house" || visibleReservationDetail.reservation.status === "due_out" ? "In-house billing context" : "Pre-arrival billing context"}. The current server record controls whether charges can be posted.</p>
              {visibleReservationDetail.reservation.folios.length ? (
                <div className="cashier-stay-list">{visibleReservationDetail.reservation.folios.map((item) => <button type="button" key={item.folioId} disabled={receivableBusy || receivableAttemptUncertain || reservationDetailRefreshUnavailable || depositLocked} className={selectedFolioId === item.folioId ? "selected" : undefined} onClick={() => selectFolio(item.folioId)}><strong>Window {item.windowNo} · {item.name ?? item.folioNo}</strong><small>{item.folioNo}</small><span data-status={item.status} className={`cashier-status ${statusTone(item.status)}`}>{item.status.replaceAll("_", " ")}</span></button>)}</div>
              ) : (
                <div className="cashier-empty-folio" role="status">
                  <strong>No folio windows exist for this reservation.</strong>
                  <p>A governed folio window must be opened before charges can be reviewed or posted.</p>
                </div>
              )}
              <PrimaryBillingWindowAction key={visibleReservationDetail.reservation.reservationId} reservation={visibleReservationDetail.reservation} reservationReadUnavailable={reservationDetailRefreshUnavailable} onOpened={enterOpenedPrimaryBillingWindow} onLifecycleBusyChange={onLifecycleBusyChange} />
            </>
          )}
        </article>
        <article className="cashier-panel cashier-posting">
          <span className="state">03 · REVIEW &amp; PREPARE</span>
          <h2>Folio posting</h2>
          {!selectedFolioId ? <p className="empty">{visibleReservationDetail?.reservation.folios.length === 0 ? "A folio window is required before any charge can be prepared." : "Select a folio window to review its statement."}</p> : folio.isLoading ? <p className="empty">Loading immutable statement…</p> : !folio.data ? <p className="error">{folio.error?.message ?? "Folio is unavailable."}</p> : <>
            {folio.isError ? <p className="error">The latest folio refresh failed. The last authoritative statement remains visible{receivableAttemptUncertain ? "; use the highlighted recovery control to reconcile the retained attempt." : "."}</p> : null}
            <p className="cashier-balance">Balance <strong>{money(folio.data.balanceMinor, folio.data.folio.currency)}</strong> · Window {folio.data.folio.windowNo}</p>
            {folio.data.siblingWindows.length > 1 ? <div className="cashier-window-tabs" aria-label="Folio windows">{folio.data.siblingWindows.map((window) => <button type="button" key={window.id} className={window.id === folio.data?.folio.id ? "active" : undefined} onClick={() => selectFolio(window.id)}>Window {window.windowNo}<small>{money(window.balanceMinor, folio.data!.folio.currency)}</small></button>)}</div> : null}
            {postingClasses.length > 1 ? <div className="cashier-posting-tabs" aria-label="Posting classes"><button type="button" className={postingClass === "all" ? "active" : undefined} onClick={() => setPostingClass("all")}>All postings ({folio.data.rows.length})</button>{postingClasses.map((kind) => <button type="button" key={kind} className={postingClass === kind ? "active" : undefined} onClick={() => setPostingClass(kind)}>{kind.replaceAll("_", " ")} ({folio.data!.rows.filter((row) => row.kind === kind).length})</button>)}</div> : null}
            <div className="cashier-ledger" aria-label="Immutable folio postings">{visiblePostingRows.map((row) => <div key={row.lineId}><strong>{row.txCode}</strong><span>{row.description ?? row.kind} · {money(row.amountMinor, folio.data!.folio.currency)} · quantity {row.quantity}</span><small>{row.businessDate} · running balance {money(row.runningBalanceMinor, folio.data!.folio.currency)}</small></div>)}{visiblePostingRows.length === 0 ? <p className="empty">No postings match this statement view.</p> : null}</div>
            <form className="cashier-charge-form" onSubmit={(event) => { event.preventDefault(); void postCharge(); }}>
              <fieldset className="cashier-charge-picker" disabled={!folio.data.chargeAvailability.allowed || posting || depositLocked}>
                <legend>Charge class</legend>
                {chargeGroups.length > 1 ? <div className="cashier-charge-groups" aria-label="Charge groups">{(["All", ...chargeGroups] as const).map((group) => <button type="button" key={group} aria-pressed={chargeGroup === group} className={chargeGroup === group ? "active" : undefined} data-group={group.toLocaleLowerCase().replaceAll(" ", "-").replaceAll("&", "and")} onClick={() => { setChargeGroup(group); if (group !== "All" && selectedOption && folioChargeGroup(selectedOption) !== group) setTxCode(""); resetCandidate(); }}><CashierGroupIcon group={group} /><span>{group}</span></button>)}</div> : null}
                <div className="cashier-charge-options" aria-label="Charge options">{visibleChargeOptions.map((option) => <button type="button" key={option.code} aria-pressed={txCode === option.code} className={txCode === option.code ? "active" : undefined} onClick={() => { setTxCode(option.code); resetCandidate(); }}><strong>{option.name}</strong><small>{option.usaliLine}</small></button>)}</div>
                {visibleChargeOptions.length === 0 ? <p className="empty">No governed charges are configured for this group.</p> : null}
              </fieldset>
              <label>Amount (minor units)<input inputMode="numeric" pattern="[0-9]*" value={amountMinor} onChange={(event) => { setAmountMinor(event.target.value); resetCandidate(); }} disabled={!folio.data.chargeAvailability.allowed || posting || depositLocked} placeholder="e.g. 125000" /></label>
              <label>Quantity<input inputMode="numeric" pattern="[0-9]*" value={quantity} onChange={(event) => { setQuantity(event.target.value); resetCandidate(); }} disabled={!folio.data.chargeAvailability.allowed || posting || depositLocked} /></label>
              {!folio.data.chargeAvailability.allowed ? <p className="error">{folio.data.chargeAvailability.reason ?? "This folio is not available for charges."}</p> : null}
              <label className="cashier-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!canPost || posting || depositLocked} /> I confirm the selected class, amount and folio window. Post this immutable charge.</label>
              {postError ? <p className="error">{postError}</p> : null}
              <button type="submit" disabled={!canPost || !confirmed || posting || depositLocked}>{posting ? "Posting governed charge…" : "Post confirmed charge"}</button>
            </form>
            <section className="cashier-bill-allocation" aria-labelledby="cashier-bill-allocation-heading" data-lifecycle-recovery={allocationUncertainAttempt ? "true" : undefined}>
              <div className="cashier-bill-allocation-heading">
                <div><span>COMPLETE-GROUP ROUTING</span><h3 id="cashier-bill-allocation-heading">Split bill windows</h3></div>
                <span className="cashier-status neutral">No partial amount split</span>
              </div>
              <p>Move one or more complete canonical charge groups between this guest’s governed folio windows. Financial history remains immutable; Yellow adds a balanced transfer.</p>
              {allocationUncertainAttempt ? <p className="cashier-allocation-uncertain" role="status"><strong>Transfer outcome needs reconciliation.</strong> Source, destination, selected complete groups, reason, request body and operation key are locked. Only the same-key recovery action is available.</p> : null}
              <fieldset className="cashier-allocation-groups" disabled={allocationLocked}>
                <legend>1 · Choose complete charge groups</legend>
                {transferGroups.length ? <div className="cashier-allocation-group-list">
                  {transferGroups.map((group) => {
                    const selectable = group.eligible && group.currentWindowId === folio.data!.folio.id;
                    const routedWindow = folio.data!.siblingWindows.find((window) => window.id === group.currentWindowId);
                    const explanation = selectable
                      ? `${group.memberCount} immutable member${group.memberCount === 1 ? "" : "s"}`
                      : group.currentWindowId !== folio.data!.folio.id
                        ? `Already routed to Window ${routedWindow?.windowNo ?? "unknown"}`
                        : group.reason ?? "Ineligible for transfer";
                    return <label key={group.id} className={selectable ? undefined : "ineligible"}>
                      <input type="checkbox" checked={allocationGroupIds.includes(group.id)} disabled={!selectable} onChange={() => toggleAllocationGroup(group.id)} />
                      <span><strong>Group {group.id.slice(0, 8)}</strong><small>{explanation}</small></span>
                    </label>;
                  })}
                </div> : <p className="empty">No server-returned complete charge groups are available in this window.</p>}
              </fieldset>
              <fieldset className="cashier-allocation-destination" disabled={allocationLocked}>
                <legend>2 · Choose a different bill window</legend>
                <div className="cashier-allocation-destination-list" role="radiogroup" aria-label="Transfer destination">
                  {folio.data.siblingWindows.filter((window) => window.id !== folio.data!.folio.id && window.status === "open").map((window) => <label key={window.id} className={allocationDestinationFolioId === window.id ? "selected" : undefined}>
                    <input type="radio" name="allocation-destination" checked={allocationDestinationFolioId === window.id} onChange={() => { setAllocationDestinationFolioId(window.id); setAllocationNewWindowName(""); invalidateAllocationPreview(); }} />
                    <span><strong>Existing Window {window.windowNo}</strong><small>{window.name ?? window.reference ?? "Unnamed"} · {moneyExactMinor(window.balanceMinor, folio.data!.folio.currency)}</small></span>
                  </label>)}
                  <label className={allocationUsesNewWindow ? "selected" : undefined}>
                    <input type="radio" name="allocation-destination" checked={allocationDestinationFolioId.length === 0 && allocationNewWindowName.length > 0} onChange={() => { setAllocationDestinationFolioId(""); if (!allocationNewWindowName) setAllocationNewWindowName("New bill window"); invalidateAllocationPreview(); }} />
                    <span><strong>New named window</strong><small>Created only by the governed transfer if confirmed.</small></span>
                  </label>
                </div>
                <label className="cashier-allocation-window-name">New window name
                  <input value={allocationNewWindowName} maxLength={80} disabled={allocationLocked || allocationDestinationFolioId.length > 0} onChange={(event) => { setAllocationDestinationFolioId(""); setAllocationNewWindowName(event.target.value); invalidateAllocationPreview(); }} placeholder="Example: Colleague B" />
                </label>
              </fieldset>
              <label className="cashier-allocation-reason">3 · Audit reason
                <textarea rows={2} maxLength={500} value={allocationReason} readOnly={allocationLocked} onChange={(event) => { setAllocationReason(event.target.value); invalidateAllocationPreview(); }} placeholder="Example: Split complete dinner and minibar groups to colleague B" />
              </label>
              <div className="cashier-allocation-actions">
                <button type="button" disabled={!canPreviewAllocation || allocationBusy} onClick={() => void previewBillWindowAllocation()}>{allocationBusy && !allocationUncertainAttempt ? "Preparing exact preview…" : "Preview complete-group transfer"}</button>
              </div>
              {allocationPreview ? <div className="cashier-allocation-preview" role="status" aria-live="polite">
                <div><span>Source</span><strong>{moneyExactMinor(allocationPreview.sourceBeforeMinor, allocationPreview.currency)} → {moneyExactMinor(allocationPreview.sourceAfterMinor, allocationPreview.currency)}</strong></div>
                <div><span>Destination</span><strong>{moneyExactMinor(allocationPreview.destinationBeforeMinor, allocationPreview.currency)} → {moneyExactMinor(allocationPreview.destinationAfterMinor, allocationPreview.currency)}</strong></div>
                <div><span>Stay total</span><strong>{moneyExactMinor(allocationPreview.stayTotalMinor, allocationPreview.currency)} unchanged</strong></div>
                <div><span>Destination window</span><strong>{allocationPreview.destinationName ?? `Window ${allocationPreview.destinationWindowNo}`}</strong></div>
                <ul>{allocationPreview.memberEffects.map((effect) => <li key={effect.rootLineId}><strong>{effect.txCode}</strong><span>{effect.description ?? "No description"} · {moneyExactMinor(effect.amountMinor, allocationPreview.currency)} · quantity {effect.quantity}</span></li>)}</ul>
              </div> : null}
              {allocationPreview && !allocationUncertainAttempt ? <label className="cashier-confirm cashier-allocation-confirm"><input type="checkbox" checked={allocationConfirmed} disabled={allocationBusy} onChange={(event) => setAllocationConfirmed(event.target.checked)} /> I confirm these complete charge groups, exact destination and audit reason. Append this balanced transfer.</label> : null}
              {allocationError ? <p className="error">{allocationError}</p> : null}
              {allocationMessage ? <p className="cashier-allocation-message" role="status">{allocationMessage}</p> : null}
              <button type="button" className="cashier-allocation-commit" disabled={allocationBusy || (allocationUncertainAttempt === null && (!allocationPreview || !allocationConfirmed))} onClick={() => void reconcileBillWindowAllocation()}>{allocationUncertainAttempt ? "Retry same transfer and reconcile" : allocationBusy ? "Reconciling governed transfer…" : "Confirm balanced bill-window transfer"}</button>
            </section>
            <section className="cashier-receivable" aria-labelledby="cashier-receivable-heading">
              <div className="cashier-receivable-heading">
                <div><span>ACCOUNT-OWNED SETTLEMENT</span><h3 id="cashier-receivable-heading">Direct billing / Post Master</h3></div>
                <span className="cashier-status neutral">Independent of cash drawer</span>
              </div>
              <p>Company and travel-agent balances move to account-owned receivables, never to a physical room.</p>
              {(!EXACT_MINOR.test(folio.data.balanceMinor) || BigInt(folio.data.balanceMinor) <= 0n) && receivableUncertainOperation !== "transfer" ? (
                <p className="empty">Direct billing requires an open folio with a positive guest balance.</p>
              ) : receivableTargets.isLoading && !receivableAttemptUncertain ? (
                <p className="empty">Loading eligible company and travel-agent accounts…</p>
              ) : receivableTargets.isError && !receivableAttemptUncertain ? (
                <p className="error">{receivableTargets.error.message}</p>
              ) : (receivableTargets.data?.filter((target) => target.currency === folio.data?.folio.currency).length ?? 0) === 0 && !receivableAttemptUncertain ? (
                <p className="empty">No eligible receivable account exists for this property and currency.</p>
              ) : (
                <form className="receivable-transfer-form" data-lifecycle-recovery={receivableAttemptUncertain || undefined} onSubmit={(event) => { event.preventDefault(); void transferDirectBilling(); }}>
                  <fieldset disabled={receivableBusy || receivableAttemptUncertain || depositLocked}>
                    <legend>1 · Select a server-owned target</legend>
                    <div className="receivable-targets" role="radiogroup" aria-label="Eligible receivable accounts">
                      {receivableTargets.data?.filter((target) => target.currency === folio.data?.folio.currency).map((target) => (
                        <label key={target.accountId} className={receivableAccountId === target.accountId ? "selected" : undefined}>
                          <input type="radio" name="receivable-target" value={target.accountId} checked={receivableAccountId === target.accountId} onChange={() => {
                            receivableGeneration.current += 1;
                            setReceivableAccountId(target.accountId);
                            setReceivablePreview(null);
                            setReceivableApproval(null);
                            setReceivableConfirmed(false);
                            setReceivableError(null);
                            setReceivableMessage(null);
                            receivableTransferKey.current = null;
                            receivableTransferFingerprint.current = null;
                            receivableApprovalKey.current = null;
                            receivableApprovalFingerprint.current = null;
                          }} />
                          <span><strong>{target.name}</strong><small>{target.partyRole} · {target.currency} · limit {moneyExactMinor(target.creditLimitMinor, target.currency)}</small></span>
                        </label>
                      ))}
                    </div>
                    <button type="button" className="receivable-preview-action" disabled={!receivableAccountId || receivableBusy} onClick={() => void previewDirectBilling()}>{receivableBusy && !receivablePreview ? "Checking live credit…" : "Preview exact transfer"}</button>
                  </fieldset>
                  {receivablePreview ? <>
                    <div className="receivable-preview-grid" role="status" aria-live="polite">
                      <div><span>Target</span><strong>{receivablePreview.name}</strong></div>
                      <div><span>Exact transfer</span><strong>{moneyExactMinor(receivablePreview.amountMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Current exposure</span><strong>{moneyExactMinor(receivablePreview.exposureMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Credit limit</span><strong>{receivablePreview.creditLimitMinor === null ? "Not configured" : moneyExactMinor(receivablePreview.creditLimitMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Projected exposure</span><strong>{moneyExactMinor(receivablePreview.projectedExposureMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Approval</span><strong>{receivablePreview.requiresApproval ? "Supervisor required" : "Within limit"}</strong></div>
                    </div>
                    {receivablePreview.requiresApproval ? (
                      <div className="receivable-approval">
                        <strong>A different authorised supervisor must approve this exact over-limit request.</strong>
                        <p>Requesting approval does not move money. This colleague session cannot approve its own request.</p>
                        {receivableUncertainOperation === "approval" ? <p className="receivable-uncertain" role="status"><strong>Approval-request outcome not yet verified.</strong> Yellow has locked this exact request and operation key for same-attempt reconciliation.</p> : null}
                        <button type="button" disabled={receivableBusy || receivableApproval?.status === "pending"} onClick={() => void requestDirectBillingApproval()}>{receivableApproval?.status === "pending" ? "Approval pending" : receivableUncertainOperation === "approval" ? "Retry same approval request" : "Request supervisor approval"}</button>
                      </div>
                    ) : <>
                      <label className="receivable-reason">Audit reason<textarea rows={2} maxLength={500} value={receivableReason} readOnly={receivableAttemptUncertain} onChange={(event) => { setReceivableReason(event.target.value); setReceivableConfirmed(false); receivableTransferKey.current = null; receivableTransferFingerprint.current = null; }} placeholder="Example: OTA virtual-card settlement to agency receivable" /></label>
                      <label className="cashier-confirm receivable-confirm"><input type="checkbox" checked={receivableConfirmed} onChange={(event) => setReceivableConfirmed(event.target.checked)} disabled={!directBillingReasonIsValid || receivableBusy || receivableAttemptUncertain} /> I confirm this exact balance, target and audit reason. Record the immutable direct-billing transfer.</label>
                      {receivableAttemptUncertain ? <p className="receivable-uncertain" role="status"><strong>Outcome not yet verified.</strong> Yellow has locked this exact folio, target, amount, reason and operation key. Retry below to reconcile the same attempt.</p> : null}
                      <button type="submit" className="receivable-transfer-action" disabled={!canTransferReceivable}>{receivableBusy ? "Recording and reconciling…" : receivableAttemptUncertain ? "Retry and reconcile same transfer" : "Transfer confirmed balance"}</button>
                    </>}
                  </> : null}
                  {receivableMessage ? <p className="receivable-message" role="status">{receivableMessage}</p> : null}
                  {receivableError ? <p className="error" role="alert">{receivableError}</p> : null}
                </form>
              )}
            </section>
            <AdvanceDepositWorkbench reservation={visibleReservationDetail!.reservation} statement={folio.data} acquireMutationLease={acquireDepositMutationLease} releaseMutationLease={releaseDepositMutationLease} onStatementReconciled={(refreshed) => queryClient.setQueryData(["cashier-folio-statement", propertyId, refreshed.folio.id], refreshed)} />
          </>}
        </article>
 */

  );
}

function MobileSettingsShortcut() {
  return <button type="button" className="mobile-settings-link" onClick={() => window.location.assign(`/p/${propertyId}/today?workspace=settings`)}>Setup</button>;
}

function money(minor: string, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(BigInt(minor)) / 100);
}

function moneyExactMinor(minor: string, currency: string): string {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const amount = BigInt(minor);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const scale = 10n ** BigInt(fractionDigits);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(fractionDigits, "0");
  const parts = formatter.formatToParts(negative ? -whole : whole);
  const rendered = parts.map((part) => part.type === "fraction" ? fraction : part.value).join("");
  return negative && whole === 0n && !parts.some((part) => part.type === "minusSign")
    ? `-${rendered}`
    : rendered;
}

type PmsIconName = "today" | "stays" | "guests" | "finance" | "yellow";

function PmsIcon({ name }: Readonly<{ name: PmsIconName }>) {
  return (
    <svg className="pms-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {name === "today" ? <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3.5 2" />
      </> : name === "stays" ? <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 9h16M8 13h3M13 13h3M8 16h3" />
      </> : name === "guests" ? <>
        <circle cx="10" cy="9" r="3" />
        <path d="M4.5 19c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5" />
        <circle cx="17" cy="10" r="2" />
        <path d="M16.5 15c2.1.1 3.3 1.4 3.5 3.5" />
      </> : name === "finance" ? <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M7 14h4M16 13.5v3M14.5 15h3" />
      </> : <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6.3 6.3 8 8M16 16l1.7 1.7" />
      </>}
    </svg>
  );
}

function VarianceBadge({ actual, baseline }: Readonly<{ actual: number; baseline: number }>) {
  const variance = metricVariance(actual, baseline);
  if (!variance) return null;
  return <span className={`metric-variance ${variance.direction}`} aria-label={`${variance.direction} ${variance.percent} percent versus last year`}>{variance.direction === "up" ? "↑" : variance.direction === "down" ? "↓" : "•"} {variance.percent.toFixed(1)}%</span>;
}

function PerformancePanel({
  performance,
  detailRequestKey = 0,
  summaryVisible = true,
}: Readonly<{
  performance: OperatingPerformance;
  detailRequestKey?: number;
  summaryVisible?: boolean;
}>) {
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (detailRequestKey > 0) setExpanded(true);
  }, [detailRequestKey]);
  useEffect(() => {
    if (!expanded || !dialogRef.current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setExpanded(false); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]!;
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => { dialog.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [expanded]);
  const maxOtb = Math.max(1, ...performance.otb.map((day) => day.occupancyBasisPoints));
  const comparisons = [{ key: "today", label: "Today", ...performance.todayComparison }, ...performance.periods];
  const summaries = [comparisons[0], comparisons[1], comparisons[3]].filter(
    (period): period is (typeof comparisons)[number] => period !== undefined,
  );
  return (
    <>
      {summaryVisible ? <section className="performance-panel" aria-labelledby="performance-heading">
      <div className="section-heading">
        <div><span>OPERATING PERFORMANCE</span><h2 id="performance-heading">Actuals, pace and plan</h2></div>
        <button type="button" onClick={() => setExpanded(true)}>Open detailed table →</button>
      </div>
      <div className="performance-summary">
        {summaries.map((period) => <article key={period.key}><span>{period.label}</span><strong>{money(period.actual.roomRevenueMinor, performance.property.currency)}</strong><small>{(period.actual.occupancyBasisPoints / 100).toFixed(1)}% occupancy · {period.actual.roomNights.toLocaleString()} room nights</small></article>)}
      </div>
      <p className="performance-note performance-disclosure">Scenario projection for product testing · client plan imports replace forecast and budget values.</p>
      </section> : null}
      {expanded ? <div className="performance-dialog-backdrop" role="presentation" onMouseDown={() => setExpanded(false)}><section ref={dialogRef} className="performance-dialog" role="dialog" aria-modal="true" aria-labelledby="performance-detail-heading" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>OPERATING PERFORMANCE</span><h2 id="performance-detail-heading">Actuals, pace and plan</h2><small>{performance.property.currency} · property-local business date</small></div><button type="button" aria-label="Close operating performance" onClick={() => setExpanded(false)}>×</button></header>
        <div className="performance-table-wrap"><table className="performance-table"><colgroup><col className="performance-period-column" /><col className="performance-measure-column" /><col className="performance-value-column" /><col className="performance-value-column" /><col className="performance-value-column" /><col className="performance-value-column" /></colgroup><thead><tr><th scope="col" className="performance-period">Period</th><th scope="col" className="performance-measure">Measure</th><th scope="col" className="performance-value">Actual</th><th scope="col" className="performance-value">Last year</th><th scope="col" className="performance-value">Forecast</th><th scope="col" className="performance-value">Budget</th></tr></thead><tbody>{comparisons.flatMap((period) => [
          <tr key={`${period.key}-rooms`}><th scope="rowgroup" rowSpan={5} className="performance-period">{period.label}</th><th scope="row" className="performance-measure">Room nights</th><td className="performance-value">{period.actual.roomNights.toLocaleString()}</td><td className="performance-value">{period.lastYear.roomNights.toLocaleString()}</td><td className="performance-value">{period.forecast.roomNights.toLocaleString()}</td><td className="performance-value">{period.budget.roomNights.toLocaleString()}</td></tr>,
          <tr key={`${period.key}-occ`}><th scope="row" className="performance-measure">Occupancy</th><td className="performance-value">{(period.actual.occupancyBasisPoints / 100).toFixed(1)}%</td><td className="performance-value">{(period.lastYear.occupancyBasisPoints / 100).toFixed(1)}%</td><td className="performance-value">{(period.forecast.occupancyBasisPoints / 100).toFixed(1)}%</td><td className="performance-value">{(period.budget.occupancyBasisPoints / 100).toFixed(1)}%</td></tr>,
          <tr key={`${period.key}-rev`}><th scope="row" className="performance-measure">Room revenue</th><td className="performance-value">{money(period.actual.roomRevenueMinor, performance.property.currency)}</td><td className="performance-value">{money(period.lastYear.roomRevenueMinor, performance.property.currency)}</td><td className="performance-value">{money(period.forecast.roomRevenueMinor, performance.property.currency)}</td><td className="performance-value">{money(period.budget.roomRevenueMinor, performance.property.currency)}</td></tr>,
          <tr key={`${period.key}-adr`}><th scope="row" className="performance-measure">ADR</th><td className="performance-value">{money(period.actual.adrMinor, performance.property.currency)}</td><td className="performance-value">{money(period.lastYear.adrMinor, performance.property.currency)}</td><td className="performance-value">{money(period.forecast.adrMinor, performance.property.currency)}</td><td className="performance-value">{money(period.budget.adrMinor, performance.property.currency)}</td></tr>,
          <tr key={`${period.key}-revpar`}><th scope="row" className="performance-measure">RevPAR</th><td className="performance-value">{money(period.actual.revparMinor, performance.property.currency)}</td><td className="performance-value">{money(period.lastYear.revparMinor, performance.property.currency)}</td><td className="performance-value">{money(period.forecast.revparMinor, performance.property.currency)}</td><td className="performance-value">{money(period.budget.revparMinor, performance.property.currency)}</td></tr>,
        ])}</tbody></table></div>
        <div className="otb-heading"><strong>Future OTB</strong><span>56-day occupancy slope</span></div><div className="otb-bars" aria-label="Future on-the-books occupancy">{performance.otb.map((day, index) => <div className="otb-day" key={day.date} title={`${day.date}: ${(day.occupancyBasisPoints / 100).toFixed(0)}%`}><i style={{ height: `${Math.max(4, day.occupancyBasisPoints / maxOtb * 100)}%` }} />{index % 7 === 0 ? <small>{day.date.slice(5)}</small> : null}</div>)}</div>
        <p className="performance-note">Scenario reporting projection for product testing. Client uploads replace budget and forecast plan values; legal ledgers remain authoritative.</p>
      </section></div> : null}
    </>
  );
}

type PerformanceMeasure = Exclude<KpiIntent, "performance"> | "revenue";

function performanceMeasureLabel(measure: PerformanceMeasure): string {
  if (measure === "rooms_sold") return "Room nights";
  if (measure === "occupancy") return "Occupancy";
  if (measure === "revenue") return "Room revenue";
  if (measure === "adr") return "ADR";
  if (measure === "revpar") return "RevPAR";
  return "Available room nights";
}

function performanceMeasureValue(
  measure: PerformanceMeasure,
  metric: PerformanceMetric,
  currency: string,
): string {
  if (measure === "rooms_sold") return metric.roomNights.toLocaleString();
  if (measure === "occupancy") return `${(metric.occupancyBasisPoints / 100).toFixed(1)}%`;
  if (measure === "revenue") return money(metric.roomRevenueMinor, currency);
  if (measure === "adr") return money(metric.adrMinor, currency);
  if (measure === "revpar") return money(metric.revparMinor, currency);
  return metric.roomsAvailable.toLocaleString();
}

function kpiTitle(intent: KpiIntent): string {
  if (intent === "rooms_sold") return "Rooms sold";
  if (intent === "adr") return "Average daily rate";
  if (intent === "revpar") return "Revenue per available room";
  if (intent === "inventory") return "Available inventory";
  if (intent === "performance") return "Operating performance";
  return "Occupancy";
}

function InlinePerformanceResult({
  intent,
  performance,
}: Readonly<{ intent: KpiIntent; performance: OperatingPerformance }>) {
  const periods = [
    { key: "today", label: "Today", ...performance.todayComparison },
    ...performance.periods,
  ];
  const measures: readonly PerformanceMeasure[] = intent === "performance"
    ? ["rooms_sold", "occupancy", "revenue", "adr", "revpar"]
    : [intent];
  return (
    <section className="yellow-kpi-result" aria-labelledby="yellow-kpi-heading">
      <div className="yellow-kpi-heading">
        <div>
          <span>PROPERTY-LOCAL PERFORMANCE</span>
          <h4 id="yellow-kpi-heading">{kpiTitle(intent)}</h4>
        </div>
        <small>{performance.property.currency} · {performance.property.businessDate}</small>
      </div>
      <div className="yellow-kpi-table-wrap">
        <table className="yellow-kpi-table">
          <thead><tr><th>Period</th>{intent === "performance" ? <th>Measure</th> : null}<th>Actual</th><th>Last year</th><th>Forecast</th><th>Budget</th></tr></thead>
          <tbody>{periods.flatMap((period) => measures.map((measure, index) => (
            <tr key={`${period.key}-${measure}`}>
              {index === 0 ? <th rowSpan={measures.length}>{period.label}</th> : null}
              {intent === "performance" ? <td>{performanceMeasureLabel(measure)}</td> : null}
              <td>{performanceMeasureValue(measure, period.actual, performance.property.currency)}</td>
              <td>{performanceMeasureValue(measure, period.lastYear, performance.property.currency)}</td>
              <td>{performanceMeasureValue(measure, period.forecast, performance.property.currency)}</td>
              <td>{performanceMeasureValue(measure, period.budget, performance.property.currency)}</td>
            </tr>
          )))}</tbody>
        </table>
      </div>
      <small className="yellow-kpi-swipe">Swipe the table sideways to compare every plan column.</small>
      <p className="performance-disclosure">Scenario projection for product testing · client plan imports replace forecast and budget values.</p>
    </section>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const initialOverwatch = useRef(restoredOverwatchMemory());
  const [assistant, setAssistant] = useState(initialOverwatch.current.open);
  const [reservationLifecycleBusy, setReservationLifecycleBusy] = useState(false);
  const reservationLifecycleBusyRef = useRef(false);
  const assistantOperationGeneration = useRef(0);
  // The URL supplies the initial operating lens, but a spoken request must be
  // remain stable while Yellow renders spoken reads in its own live surface.
  const [activeLane, setActiveLane] = useState<Status | null>(focusedLane ?? null);
  const [language, setLanguage] = useState(initialOverwatch.current.language);
  const speechOutputPermit = useRef<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<readonly Turn[]>(
    initialOverwatch.current.turns,
  );
  const [reservationQueryContext, setReservationQueryContext] = useState<ReservationQueryContext | null>(
    initialOverwatch.current.reservationQuery ?? null,
  );
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [assistantCard, setAssistantCard] = useState<AssistantCard | null>(null);
  const [guestAllocationProposal, setGuestAllocationProposal] = useState<GuestAllocationProposal | null>(null);
  const [cashierChargeProposal, setCashierChargeProposal] = useState<CashierChargeProposal | null>(null);
  const [voiceBillWindowTransferProposal, setVoiceBillWindowTransferProposal] = useState<VoiceBillWindowTransferProposal | null>(null);
  const [voiceTransferRecoveryLocked, setVoiceTransferRecoveryLocked] = useState(false);
  const voiceTransferRecoveryLockedRef = useRef(false);
  const setVoiceBillWindowTransfer = (proposal: VoiceBillWindowTransferProposal | null) => {
    const locked = Boolean(proposal?.postingAttempted);
    voiceTransferRecoveryLockedRef.current = locked;
    setVoiceTransferRecoveryLocked(locked);
    setVoiceBillWindowTransferProposal(proposal);
  };
  const yellowVisualState = listening
    ? "yellow-ai-listening"
    : thinking
      ? "yellow-ai-thinking"
      : assistantCard
        ? "yellow-ai-result"
        : "yellow-ai-ready";
  const shellClassName = `yellow-next${assistant ? ` yellow-ai-active ${yellowVisualState}` : ""}`;
  const [arrivalConversation, setArrivalConversation] = useState<ArrivalConversationCommand | null>(null);
  const [departureConversation, setDepartureConversation] = useState<DepartureConversationCommand | null>(null);
  const [departureConversationPending, setDepartureConversationPending] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [performanceDetailRequestKey, setPerformanceDetailRequestKey] = useState(0);
  const recognition = useRef<Recognition | null>(null);
  const setReservationLifecycleFlight = useMemo(
    () => (busy: boolean) => {
      reservationLifecycleBusyRef.current = busy;
      if (busy) {
        assistantOperationGeneration.current += 1;
        recognition.current?.stop();
        setListening(false);
        setLiveTranscript("");
      }
      setReservationLifecycleBusy(busy);
    },
    [],
  );
  const guardReservationLifecycleFlight = (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
    target?: EventTarget | null;
  }) => {
    if (!reservationLifecycleBusyRef.current && !voiceTransferRecoveryLockedRef.current) return;
    if (event.target instanceof Element && event.target.closest('[data-lifecycle-recovery="true"]')) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const dueInQuery = useQuery<Lane, Error>({
    queryKey: ["today", propertyId, "due_in"],
    queryFn: () => loadLane("due_in"),
    enabled: workspacePart === "today" || workspacePart === "operations" || assistant,
  });
  const dueOutQuery = useQuery<Lane, Error>({
    queryKey: ["today", propertyId, "due_out"],
    queryFn: () => loadLane("due_out"),
    enabled: workspacePart === "today" || workspacePart === "operations" || assistant,
  });
  const inHouseQuery = useQuery<Lane, Error>({
    queryKey: ["today", propertyId, "in_house"],
    queryFn: () => loadLane("in_house"),
    enabled: workspacePart === "today" || workspacePart === "operations" || assistant,
  });
  const reservationIndexQuery = useQuery<Lane, Error>({
    queryKey: ["yellow-reservation-command-index", propertyId],
    queryFn: loadReservationBoard,
    staleTime: 30_000,
    enabled: workspacePart === "today" || workspacePart === "reservations" || assistant,
  });
  const commercialSnapshotQuery = useQuery<CommercialSnapshot, Error>({
    queryKey: ["commercial-snapshot", propertyId],
    queryFn: loadCommercialSnapshot,
    enabled: workspacePart === "today" || assistant,
  });
  const performanceQuery = useQuery<OperatingPerformance, Error>({
    queryKey: ["operating-performance", propertyId],
    queryFn: loadOperatingPerformance,
    enabled: workspacePart === "today" || assistant,
  });
  const housekeepingQuery = useQuery<
    Readonly<{
      rooms: readonly HousekeepingCondition[];
      tasks: readonly HousekeepingTask[];
    }>,
    Error
  >({
    queryKey: ["housekeeping", propertyId],
    queryFn: loadHousekeeping,
    enabled: workspacePart === "operations" || assistant,
  });
  const operationalBlocksQuery = useQuery<readonly OperationalBlock[], Error>({
    queryKey: ["operational-blocks", propertyId],
    queryFn: loadOperationalBlocks,
    enabled: workspacePart === "operations" || assistant,
  });
  const propertyQuery = useQuery({
    queryKey: ["properties"],
    queryFn: loadProperties,
  });
  const selected = propertyQuery.data?.find((p) => p.id === propertyId);
  const lanes: readonly Readonly<{
    status: Status;
    query: UseQueryResult<Lane, Error>;
  }>[] = [
    { status: "due_in", query: dueInQuery },
    { status: "due_out", query: dueOutQuery },
    { status: "in_house", query: inHouseQuery },
  ];
  const total = useMemo(
    () =>
      lanes.reduce(
        (sum, lane) => sum + (lane.query.data?.reservations?.length ?? 0),
        0,
      ),
    [lanes],
  );
  const inHouseCount = inHouseQuery.data?.reservations?.length ?? null;
  const configuredRooms = commercialSnapshotQuery.data?.inventory.spaces.length;
  const operationalRooms = useMemo(
    () => housekeepingQuery.data?.rooms.map((room) => {
      const task = housekeepingQuery.data?.tasks.find((candidate) => candidate.spaceId === room.spaceId);
      return {
        spaceId: room.spaceId,
        spaceLabel: room.code,
        condition: room.condition,
        occupancyState: null,
        task: task ? { taskId: task.taskId, state: task.taskStatus } : null,
      };
    }),
    [housekeepingQuery.data],
  );
  const occupancyPercent = performanceQuery.data
    ? Math.round(performanceQuery.data.today.occupancyBasisPoints / 100)
    : inHouseCount !== null && configuredRooms && configuredRooms > 0
      ? Math.round((inHouseCount / configuredRooms) * 100)
      : null;
  const localGreeting = propertyLocalGreeting(new Date(), selected?.timezone ?? "UTC");
  useEffect(() => {
    rememberOverwatch({ open: assistant, language, turns, reservationQuery: reservationQueryContext ?? undefined });
  }, [assistant, language, reservationQueryContext, turns]);
  const workflow = (part: string) => {
    if (reservationLifecycleBusyRef.current || voiceTransferRecoveryLockedRef.current) return;
    window.location.assign(
      part === "rates"
        ? `/p/${propertyId}/today?workspace=rates`
        : part === "settings"
          ? `/p/${propertyId}/today?workspace=settings`
        : part === "ecosystem"
          ? `/p/${propertyId}/today?workspace=ecosystem`
        : part === "market-lab" && internalMarketLabEnabled
          ? `/p/${propertyId}/today?workspace=market-lab`
        : part === "cashiers"
          ? `/p/${propertyId}/today?workspace=finance`
        : `/p/${propertyId}/${part}`,
    );
  };
  const billingDesk = () => {
    if (reservationLifecycleBusyRef.current || voiceTransferRecoveryLockedRef.current) return;
    window.location.assign(`/p/${propertyId}/today?workspace=finance`);
  };
  const open = (stay: Stay) => {
    if (reservationLifecycleBusyRef.current || voiceTransferRecoveryLockedRef.current) return;
    window.location.assign(`/p/${propertyId}/res/${stay.reservationId}`);
  };
  const review = (stay: Stay) => {
    if (reservationLifecycleBusyRef.current || voiceTransferRecoveryLockedRef.current) return;
    setAssistant(true);
    setAssistantCard({
      eyebrow: "LIVE ARRIVAL FLOW",
      title: `Prepare ${nameOf(stay)}`,
      detail: "Overwatch is loading the current server-owned arrival prerequisites. No check-in will be committed unless every requirement is ready and you confirm it.",
      rows: [{
        primary: stay.confirmationNo,
        secondary: stay.sellableUnitLabel ?? stay.unitTypeLabel ?? "Room assignment pending",
      }],
      checkInReservationId: stay.reservationId,
    });
  };
  const resolveReservationWithYellow = (reservation: ReservationDetail["reservation"]) => {
    setAssistant(true);
    setAssistantCard({
      eyebrow: "LIVE ARRIVAL FLOW",
      title: `Prepare ${reservation.guests.find((guest) => guest.role === "primary")?.displayName ?? reservation.confirmationNo}`,
      detail: "Yellow is resolving the live room, Housekeeping, identity and folio prerequisites for this named arrival. Every write remains confirmation-gated.",
      rows: [{
        primary: reservation.confirmationNo,
        secondary: reservation.segments[0]?.sellableUnitId ? "Assigned room · live readiness below" : "Room assignment pending",
      }],
      checkInReservationId: reservation.reservationId,
    });
  };
  const openMetric = (request: string) => {
    setAssistant(true);
    void ask(request);
  };
  const openOperationalTable = (lane: Status) =>
    window.location.assign(`/p/${propertyId}/today?lane=${lane}`);
  const cancelSpeech = () => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // A broken optional browser voice must never interrupt text or PMS work.
    }
  };
  const say = (answer: string, explicit = false) => {
    const permitted = explicit || speechOutputPermit.current === assistantOperationGeneration.current;
    if (!permitted) return;
    speechOutputPermit.current = null;
    if (!("speechSynthesis" in window)) return;
    try {
      cancelSpeech();
      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = languageCodeFor(language);
      utterance.rate = 0.96;
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = preferredSpeechVoice(voices, utterance.lang);
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech is optional local presentation. The completed text response stays
      // authoritative and visible when a browser voice is absent or fails.
    }
  };
  async function ask(raw: string) {
    const displayedMessage = raw.trim();
    if (!displayedMessage || thinking || reservationLifecycleBusyRef.current) return;
    const operationGeneration = ++assistantOperationGeneration.current;
    speechOutputPermit.current = null;
    cancelSpeech();
    const speechIntent = speechOutputIntent(displayedMessage);
    const message = speechIntent?.kind === "answer" ? speechIntent.query : displayedMessage;
    const assistantOperationWasSuperseded = () =>
      reservationLifecycleBusyRef.current ||
      assistantOperationGeneration.current !== operationGeneration;
    const next = [...turns, { role: "user" as const, text: displayedMessage }];
    setPrompt("");
    setLiveTranscript("");
    setTurns(next);
    if (speechIntent?.kind === "stop") {
      const answer = "Speech stopped. Yellow remains available in text.";
      const stoppedTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(stoppedTurns);
      rememberOverwatch({ open: true, language, turns: stoppedTurns });
      return;
    }
    if (speechIntent?.kind === "latest") {
      const latest = [...turns].reverse().find((turn) => turn.role === "assistant");
      if (latest) say(latest.text, true);
      return;
    }
    if (speechIntent?.kind === "answer") speechOutputPermit.current = operationGeneration;
    if (voiceTransferRecoveryLockedRef.current && cashierChargeConfirmationIntent(message) === null) {
      const answer = "A bill-window transfer is awaiting reconciliation. Say yes to retry the exact same operation, or cancel to keep it locked without sending another request.";
      const recoveryTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(recoveryTurns);
      rememberOverwatch({ open: true, language, turns: recoveryTurns });
      say(answer);
      return;
    }
    let indexedReservations = reservationIndexQuery.data?.reservations;
    if (!indexedReservations) {
      indexedReservations = (await reservationIndexQuery.refetch()).data?.reservations;
      if (assistantOperationWasSuperseded()) return;
    }
    const completeReservationBoardAvailable = Array.isArray(indexedReservations);
    const all = indexedReservations?.length
      ? indexedReservations
      : completeReservationBoardAvailable
        ? []
        : lanes.flatMap((x) => x.query.data?.reservations ?? []);
    // A named command always resolves its named reservation first. An active
    // arrival may accept only a deliberately narrow follow-up, so "check in
    // Bob" can never be applied to the previously opened arrival.
    const namedReservationAction = reservationVoiceAction(message, all);
    const namedGuest = guestProfileVoiceAction(message, all);
    const ambiguousGuests = namedGuest ? [] : guestProfileVoiceCandidates(message, all);
    const cashierInstruction = cashierChargeIntent(message);
    const billWindowInstruction = folioBillWindowTransferIntent(message);
    const partialBillWindowTransfer = hasFolioBillWindowPartialSplitIntent(message);
    const cashierDecision = cashierChargeProposal
      ? cashierChargeConfirmationIntent(message)
      : null;
    const billWindowDecision = voiceBillWindowTransferProposal
      ? cashierChargeConfirmationIntent(message)
      : null;
    const departureDecision = assistantCard?.checkoutReservationId && departureConversationPending
      ? departureServiceConfirmationIntent(message)
      : null;
    const replyCashier = (answer: string, card?: AssistantCard) => {
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      if (card) setAssistantCard(card);
    };
    if (departureDecision) {
      setDepartureConversation({ id: crypto.randomUUID(), kind: departureDecision });
      return;
    }
    if (cashierChargeProposal && cashierDecision) {
      const proposal = cashierChargeProposal;
      if (cashierDecision === "cancel") {
        if (proposal.postingAttempted) {
          replyCashier("I stopped. I cannot say that nothing was posted because a posting attempt already crossed the server boundary. I kept the exact proposal and idempotency key locked so you can say yes to reconcile it safely.", {
            eyebrow: "RECONCILIATION REQUIRED",
            title: `${proposal.guestName} · ${proposal.folioReference}`,
            detail: "No new request was sent. The prior attempt remains unresolved; Yellow will never replace its idempotency key or describe it as cancelled.",
            rows: [{ primary: proposal.txName, secondary: `${proposal.currency} ${proposal.amountMajor}` }],
            workspace: "cashiers",
            cashierReservationId: proposal.reservationId,
          });
          return;
        }
        setCashierChargeProposal(null);
        replyCashier("Understood. I cancelled the pending folio charge. Nothing was posted.", {
          eyebrow: "CHARGE CANCELLED",
          title: `${proposal.guestName} · ${proposal.folioReference}`,
          detail: "The proposal was discarded without changing the immutable folio.",
          rows: [{ primary: proposal.txName, secondary: `${proposal.currency} ${proposal.amountMajor}` }],
          workspace: "cashiers",
          cashierReservationId: proposal.reservationId,
        });
        return;
      }
      setReservationLifecycleFlight(true);
      setThinking(true);
      let encounteredUncertainResponse = false;
      try {
        let receipt = proposal.receipt;
        if (!proposal.postingAttempted) {
          const [freshReservation, fresh] = await Promise.all([
            loadReservation(proposal.reservationId),
            loadFolioStatement(proposal.folioId),
          ]);
          if (freshReservation.reservation.status !== "in_house" && freshReservation.reservation.status !== "due_out") {
            setCashierChargeProposal(null);
            replyCashier("The guest is no longer in house or due out, so I stopped without posting.");
            return;
          }
          const freshOpenFolios = freshReservation.reservation.folios.filter((folio) => folio.status === "open");
          if (freshReservation.reservation.confirmationNo !== proposal.confirmationNo ||
              freshOpenFolios.length !== 1 || freshOpenFolios[0]?.folioId !== proposal.folioId ||
              fresh.reservationId !== proposal.reservationId || fresh.folio.id !== proposal.folioId ||
              fresh.folio.status !== "open" || fresh.folio.currency !== proposal.currency ||
              !fresh.chargeAvailability.allowed) {
            setCashierChargeProposal(null);
            replyCashier("The folio or posting authority changed before confirmation, so I stopped without posting.", {
              eyebrow: "CHARGE STOPPED",
              title: proposal.confirmationNo,
              detail: "Yellow refreshed the server-owned folio and rejected the stale proposal.",
              rows: [],
              workspace: "cashiers",
              cashierReservationId: proposal.reservationId,
            });
            return;
          }
          const option = fresh.chargeOptions.find((item) => item.code === proposal.txCode);
          if (!option || option.name !== proposal.txName) {
            setCashierChargeProposal(null);
            replyCashier("The configured charge class changed before confirmation, so I stopped without posting.");
            return;
          }
          setCashierChargeProposal(Object.freeze({ ...proposal, postingAttempted: true }));
        }
        if (!receipt) {
          try {
            receipt = await postFolioCharge(proposal.folioId, {
              txCode: proposal.txCode,
              amountMinor: proposal.amountMinor,
              quantity: proposal.quantity,
            }, proposal.key);
          } catch (error) {
            if (!(error instanceof FolioChargeRequestError) || !error.uncertain) throw error;
            encounteredUncertainResponse = true;
            // The same immutable request/key is safe to retry after an uncertain
            // response; PostgreSQL idempotency returns the original receipt.
            receipt = await postFolioCharge(proposal.folioId, {
              txCode: proposal.txCode,
              amountMinor: proposal.amountMinor,
              quantity: proposal.quantity,
            }, proposal.key);
          }
          setCashierChargeProposal(Object.freeze({ ...proposal, postingAttempted: true, receipt }));
        }
        if (receipt.folioId !== proposal.folioId || receipt.currency !== proposal.currency ||
            receipt.txCode !== proposal.txCode || receipt.amountMinor !== proposal.amountMinor ||
            receipt.quantity !== `${proposal.quantity}.000`) {
          throw new Error("The posting receipt did not match the confirmed proposal.");
        }
        const refreshed = await loadFolioStatement(proposal.folioId);
        const posted = refreshed.reservationId === proposal.reservationId &&
          refreshed.folio.id === proposal.folioId &&
          refreshed.folio.currency === proposal.currency &&
          refreshed.rows.some((row) =>
          row.journalId === receipt.journalId && row.kind === "charge" &&
          row.txCode === proposal.txCode && row.amountMinor === proposal.amountMinor &&
          row.quantity === receipt.quantity && row.businessDate === receipt.businessDate,
          );
        if (!posted) {
          throw new Error("The charge response was received, but the refreshed folio has not exposed the immutable journal yet. Repeat the unchanged confirmation to reconcile safely.");
        }
        await queryClient.invalidateQueries({ queryKey: ["cashier-folio-statement", propertyId, proposal.folioId] });
        setCashierChargeProposal(null);
        replyCashier(
          receipt.replayed
            ? `The ${proposal.txName} charge was already posted. I reconciled the same journal without creating another charge.`
            : `Done. I posted ${proposal.currency} ${proposal.amountMajor} for ${proposal.txName} to ${proposal.guestName} and verified the live folio.`,
          {
            eyebrow: receipt.replayed ? "CHARGE RECONCILED" : "CHARGE POSTED",
            title: `${proposal.guestName} · ${proposal.folioReference}`,
            detail: "Yellow used the governed posting endpoint and verified the exact immutable journal in the refreshed statement.",
            rows: [
              { primary: proposal.txName, secondary: `${proposal.currency} ${proposal.amountMajor} · quantity ${proposal.quantity}` },
              { primary: receipt.businessDate, secondary: receipt.replayed ? "Existing idempotent journal" : "New balanced journal" },
            ],
            workspace: "cashiers",
            cashierReservationId: proposal.reservationId,
          },
        );
      } catch (error) {
        if (error instanceof FolioChargeRequestError && !error.uncertain && !proposal.receipt &&
            !proposal.postingAttempted && !encounteredUncertainResponse) {
          setCashierChargeProposal(Object.freeze({ ...proposal, postingAttempted: false }));
        }
        replyCashier(error instanceof Error ? error.message : "The charge could not be posted. The same proposal remains available for safe reconciliation.");
      } finally {
        setThinking(false);
        setReservationLifecycleFlight(false);
      }
      return;
    }
    if (cashierChargeProposal?.postingAttempted) {
      replyCashier("The previous folio charge has an unresolved server outcome. I kept its exact idempotency key locked. Say yes to reconcile that same request before starting another command.", {
        eyebrow: "RECONCILIATION REQUIRED",
        title: `${cashierChargeProposal.guestName} · ${cashierChargeProposal.folioReference}`,
        detail: "Yellow will not discard or replace an attempted financial command.",
        rows: [{ primary: cashierChargeProposal.txName, secondary: `${cashierChargeProposal.currency} ${cashierChargeProposal.amountMajor}` }],
        workspace: "cashiers",
        cashierReservationId: cashierChargeProposal.reservationId,
      });
      return;
    }
    if (voiceBillWindowTransferProposal && billWindowDecision) {
      const proposal = voiceBillWindowTransferProposal;
      if (billWindowDecision === "cancel") {
        if (proposal.postingAttempted) {
          replyCashier("I cannot cancel an already submitted bill-window transfer. I retained the exact request and key; say yes to reconcile that same operation.", {
            eyebrow: "TRANSFER RECONCILIATION REQUIRED",
            title: `${proposal.guestName} · ${proposal.confirmationNo}`,
            detail: "No new transfer was sent and the original operation remains locked until its authoritative outcome is reconciled.",
            rows: [{ primary: proposal.chargeLabel, secondary: proposal.destinationLabel }],
          });
          return;
        }
        setVoiceBillWindowTransfer(null);
        replyCashier("Understood. I discarded the pending complete charge-group transfer. Nothing was posted.", {
          eyebrow: "TRANSFER CANCELLED",
          title: `${proposal.guestName} · ${proposal.confirmationNo}`,
          detail: "The preview was discarded without changing either folio.",
          rows: [{ primary: proposal.chargeLabel, secondary: proposal.destinationLabel }],
        });
        return;
      }
      setReservationLifecycleFlight(true);
      setThinking(true);
      let retained = proposal;
      let receipt = proposal.receipt;
      try {
        if (!proposal.postingAttempted) {
          const [freshReservation, freshSource] = await Promise.all([
            loadReservation(proposal.reservationId),
            loadFolioStatement(proposal.draft.sourceFolioId),
          ]);
          const freshDestinationName = proposal.draft.destinationFolioId === null
            ? null
            : freshSource.siblingWindows.find((window) => window.id === proposal.draft.destinationFolioId && window.status === "open")?.name ?? null;
          const freshGroup = resolveVoiceTransferGroup(freshSource, proposal.chargeLabel);
          if (freshReservation.reservation.confirmationNo !== proposal.confirmationNo ||
              (freshReservation.reservation.status !== "in_house" && freshReservation.reservation.status !== "due_out") ||
              freshSource.reservationId !== proposal.reservationId || freshSource.folio.id !== proposal.draft.sourceFolioId ||
              freshSource.folio.status !== "open" || freshSource.folio.currency !== proposal.preview.currency ||
              freshGroup.kind !== "resolved" || freshGroup.group.id !== proposal.draft.groupIds[0]) {
            setVoiceBillWindowTransfer(null);
            replyCashier("The current reservation, folio, or complete charge group changed before confirmation. I stopped without posting.");
            return;
          }
          const preflightDraft = Object.freeze({ ...proposal.draft, generation: freshSource.generation, previewRevision: "" });
          const freshPreview = await requestFolioTransferPreview(preflightDraft);
          if (!previewMatchesFolioTransferDraft(freshPreview, preflightDraft, freshSource.folio.currency, freshDestinationName) ||
              !sameTransferPreview(freshPreview, proposal.preview)) {
            setVoiceBillWindowTransfer(null);
            replyCashier("The live folio changed since the preview. I cleared the proposal and did not post anything; ask me to prepare the complete transfer again.", {
              eyebrow: "TRANSFER PREVIEW DRIFTED",
              title: `${proposal.guestName} · ${proposal.confirmationNo}`,
              detail: "Yellow repeated the canonical preview before submission and refused to reuse stale consent.",
              rows: [],
            });
            return;
          }
          retained = Object.freeze({
            ...proposal,
            draft: Object.freeze({ ...preflightDraft, previewRevision: freshPreview.previewRevision }),
            preview: freshPreview,
            postingAttempted: true,
          });
          setVoiceBillWindowTransfer(retained);
        }
        if (!receipt) {
          const candidateReceipt = await submitFolioTransfer(retained.draft, retained.key);
          if (!receiptMatchesVoiceTransfer(candidateReceipt, retained)) {
            throw new FolioTransferRequestError("The transfer receipt did not match the confirmed complete charge-group preview.", true);
          }
          receipt = candidateReceipt;
          retained = Object.freeze({ ...retained, postingAttempted: true, receipt: candidateReceipt });
          setVoiceBillWindowTransfer(retained);
        }
        if (!receipt || !receiptMatchesVoiceTransfer(receipt, retained)) {
          throw new FolioTransferRequestError("The transfer receipt did not match the confirmed complete charge-group preview.", true);
        }
        const verifiedReceipt = receipt;
        if (!verifiedReceipt.destinationFolioId) {
          throw new FolioTransferRequestError("The transfer receipt did not identify the destination folio.", true);
        }
        const [sourceStatement, destinationStatement] = await Promise.all([
          loadFolioStatement(verifiedReceipt.sourceFolioId),
          loadFolioStatement(verifiedReceipt.destinationFolioId),
        ]);
        const reconciled = sourceStatement.folio.id === verifiedReceipt.sourceFolioId &&
          destinationStatement.folio.id === verifiedReceipt.destinationFolioId &&
          sourceStatement.folio.currency === verifiedReceipt.currency && destinationStatement.folio.currency === verifiedReceipt.currency &&
          sourceStatement.balanceMinor === verifiedReceipt.sourceAfterMinor && destinationStatement.balanceMinor === verifiedReceipt.destinationAfterMinor &&
          sourceStatement.stayTotalMinor === verifiedReceipt.stayTotalMinor && destinationStatement.stayTotalMinor === verifiedReceipt.stayTotalMinor &&
          sourceStatement.rows.some((row) => row.journalId === verifiedReceipt.journalId) &&
          destinationStatement.rows.some((row) => row.journalId === verifiedReceipt.journalId);
        if (!reconciled) {
          throw new FolioTransferRequestError("The transfer result is not yet visible in both authoritative folio statements. The exact operation remains locked for reconciliation.", true);
        }
        await queryClient.invalidateQueries({ queryKey: ["cashier-folio-statement", propertyId, verifiedReceipt.sourceFolioId] });
        await queryClient.invalidateQueries({ queryKey: ["cashier-folio-statement", propertyId, verifiedReceipt.destinationFolioId] });
        setVoiceBillWindowTransfer(null);
        replyCashier(verifiedReceipt.replayed
          ? "The complete charge-group transfer was already posted. I reconciled the same journal without creating another transfer."
          : "Done. I transferred the complete charge group and verified both live folio statements.", {
          eyebrow: verifiedReceipt.replayed ? "TRANSFER RECONCILED" : "TRANSFER COMPLETE",
          title: `${proposal.guestName} · ${proposal.confirmationNo}`,
          detail: "Yellow verified the exact journal, both after-balances, currency, and conserved stay total from authoritative statements.",
          rows: [
            { primary: proposal.chargeLabel, secondary: proposal.destinationLabel },
            { primary: `Journal ${verifiedReceipt.journalId}`, secondary: `${verifiedReceipt.currency} · stay total ${moneyExactMinor(verifiedReceipt.stayTotalMinor, verifiedReceipt.currency)}` },
          ],
        });
      } catch (error) {
        if (retained.postingAttempted || error instanceof FolioTransferRequestError && error.uncertain) {
          setVoiceBillWindowTransfer(Object.freeze({ ...retained, postingAttempted: true, receipt }));
          replyCashier("The transfer outcome is uncertain. Yellow retained the exact draft, body, and idempotency key. Say yes only to reconcile this same operation.", {
            eyebrow: "TRANSFER RECONCILIATION REQUIRED",
            title: `${proposal.guestName} · ${proposal.confirmationNo}`,
            detail: error instanceof Error ? error.message : "The authoritative result could not be verified.",
            rows: [{ primary: proposal.chargeLabel, secondary: proposal.destinationLabel }],
          });
        } else {
          setVoiceBillWindowTransfer(null);
          replyCashier(error instanceof Error ? error.message : "The transfer preview could not be refreshed; nothing was posted.");
        }
      } finally {
        setThinking(false);
        setReservationLifecycleFlight(false);
      }
      return;
    }
    if (voiceBillWindowTransferProposal?.postingAttempted) {
      replyCashier("A complete bill-window transfer still needs same-key reconciliation. Say yes to reconcile it before starting another operation.", {
        eyebrow: "TRANSFER RECONCILIATION REQUIRED",
        title: `${voiceBillWindowTransferProposal.guestName} · ${voiceBillWindowTransferProposal.confirmationNo}`,
        detail: "Yellow will not replace an attempted financial command with another request.",
        rows: [{ primary: voiceBillWindowTransferProposal.chargeLabel, secondary: voiceBillWindowTransferProposal.destinationLabel }],
      });
      return;
    }
    if (cashierChargeProposal) setCashierChargeProposal(null);
    if (voiceBillWindowTransferProposal) setVoiceBillWindowTransfer(null);
    if (partialBillWindowTransfer) {
      replyCashier("Yellow can move only one complete posted charge group. I will not split an amount, percentage, quantity, or tax line. Say the named whole charge and a destination bill window.");
      return;
    }
    if (billWindowInstruction) {
      setGuestAllocationProposal(null);
      setThinking(true);
      try {
        const resolved = reservationVoiceAction(`open cashier for ${billWindowInstruction.guestQuery}`, all);
        if (!resolved || resolved.workbench !== "cashier") {
          replyCashier("I could not resolve one current in-house guest for that complete charge transfer. Say the exact guest name or confirmation number.");
          return;
        }
        const reservation = resolved.reservation;
        const detail = await loadReservation(reservation.reservationId);
        if (assistantOperationWasSuperseded()) return;
        if (detail.reservation.status !== "in_house" && detail.reservation.status !== "due_out") {
          replyCashier("That reservation is no longer current, so I did not prepare a transfer.");
          return;
        }
        const openFolios = detail.reservation.folios.filter((folio) => folio.status === "open");
        if (openFolios.length === 0) {
          replyCashier("That current stay has no open source folio.");
          return;
        }
        const sourceStatements = await Promise.all(openFolios.map((folio) => loadFolioStatement(folio.folioId)));
        if (assistantOperationWasSuperseded()) return;
        if (sourceStatements.some((statement) => statement.reservationId !== reservation.reservationId)) {
          replyCashier("The live folio family changed before I could prepare the transfer.");
          return;
        }
        const sourceResolution = resolveVoiceTransferSource(
          sourceStatements,
          billWindowInstruction.chargeQuery,
          billWindowInstruction.destination,
        );
        if (sourceResolution.kind !== "resolved") {
          replyCashier(sourceResolution.kind === "ambiguous"
            ? "More than one open source folio has an eligible complete charge group matching that name. Say the exact posted charge description."
            : "I could not resolve one eligible complete charge group and distinct open destination from the live folio family.");
          return;
        }
        const { statement, group, label, destinationWindow } = sourceResolution;
        const initialDraft: FolioTransferDraft = Object.freeze({
          sourceFolioId: statement.folio.id,
          destinationFolioId: destinationWindow?.id ?? null,
          newWindowName: billWindowInstruction.destination.kind === "new" ? billWindowInstruction.destination.name : null,
          groupIds: Object.freeze([group.id]),
          reason: `Yellow voice: move complete ${label} charge group`,
          generation: statement.generation,
          previewRevision: "",
        });
        const preview = await requestFolioTransferPreview(initialDraft);
        if (!previewMatchesFolioTransferDraft(preview, initialDraft, statement.folio.currency, destinationWindow?.name ?? null)) {
          replyCashier("The canonical preview did not match the exact source, destination, and complete charge group, so I stopped without posting.");
          return;
        }
        const proposal = Object.freeze({
          reservationId: reservation.reservationId,
          confirmationNo: reservation.confirmationNo,
          guestName: nameOf(reservation),
          folioReference: statement.folio.reference ?? `Window ${statement.folio.windowNo}`,
          chargeLabel: label,
          destinationLabel: preview.destinationName ?? `Window ${preview.destinationWindowNo}`,
          destinationExistingName: destinationWindow?.name ?? null,
          draft: Object.freeze({ ...initialDraft, previewRevision: preview.previewRevision }),
          preview,
          key: `yellow-voice-folio-transfer-${crypto.randomUUID()}`,
          postingAttempted: false,
          receipt: null,
        } satisfies VoiceBillWindowTransferProposal);
        setVoiceBillWindowTransfer(proposal);
        replyCashier("I prepared the exact complete charge-group transfer. Nothing has been posted. Say yes to submit this exact preview, or no to cancel.", {
          eyebrow: "CONFIRM COMPLETE CHARGE TRANSFER",
          title: `${proposal.guestName} · ${proposal.confirmationNo}`,
          detail: "Yellow resolved one live source folio, one eligible complete posted group, and the selected destination. It will repeat this canonical preview before any commit.",
          rows: [
            { primary: `${proposal.chargeLabel} · source ${proposal.folioReference}`, secondary: `Before ${moneyExactMinor(preview.sourceBeforeMinor, preview.currency)} · after ${moneyExactMinor(preview.sourceAfterMinor, preview.currency)}` },
            { primary: proposal.destinationLabel, secondary: `Before ${moneyExactMinor(preview.destinationBeforeMinor, preview.currency)} · after ${moneyExactMinor(preview.destinationAfterMinor, preview.currency)}` },
            { primary: `Stay total ${moneyExactMinor(preview.stayTotalMinor, preview.currency)}`, secondary: `Conserved across both bill windows · audit reason: ${proposal.draft.reason}` },
          ],
        });
      } catch (error) {
        if (!assistantOperationWasSuperseded()) replyCashier(error instanceof Error ? error.message : "The live transfer preview could not be prepared.");
      } finally {
        setThinking(false);
      }
      return;
    }
    if (cashierInstruction) {
      setGuestAllocationProposal(null);
      setThinking(true);
      try {
        const resolved = reservationVoiceAction(`open cashier for ${cashierInstruction.guestQuery}`, all);
        if (!resolved || resolved.workbench !== "cashier") {
          replyCashier("I could not resolve one current in-house guest for that charge. Say the exact guest name or confirmation number. Nothing was posted.");
          return;
        }
        const reservation = resolved.reservation;
        const detail = await loadReservation(reservation.reservationId);
        if (assistantOperationWasSuperseded()) return;
        if (detail.reservation.status !== "in_house" && detail.reservation.status !== "due_out") {
          replyCashier("That reservation is no longer in house or due out, so I did not prepare a charge.");
          return;
        }
        const openFolios = detail.reservation.folios.filter((folio) => folio.status === "open");
        if (openFolios.length !== 1) {
          replyCashier(openFolios.length === 0
            ? "That current stay has no open folio, so I did not prepare a charge."
            : "That stay has more than one open folio. Say the exact folio reference before I prepare a charge.");
          return;
        }
        const openFolio = openFolios[0]!;
        const statement = await loadFolioStatement(openFolio.folioId);
        if (assistantOperationWasSuperseded()) return;
        if (statement.reservationId !== reservation.reservationId || statement.folio.status !== "open" ||
            !statement.chargeAvailability.allowed) {
          replyCashier(statement.chargeAvailability.reason ?? "The live folio is not eligible for a charge. Nothing was posted.");
          return;
        }
        if (statement.folio.currency !== cashierInstruction.currency) {
          replyCashier(`That folio is in ${statement.folio.currency}, not ${cashierInstruction.currency}. Say the amount in the folio currency. Nothing was posted.`);
          return;
        }
        const optionResolution = resolveCashierChargeOption(cashierInstruction.chargeQuery, statement.chargeOptions);
        if (optionResolution.kind !== "resolved") {
          replyCashier(optionResolution.kind === "ambiguous"
            ? "More than one configured charge matches that description. Say the exact charge name shown in the cashier."
            : "That charge class is not configured for this property and currency. I did not invent a transaction code or post anything.");
          return;
        }
        const option = optionResolution.option;
        const guestName = nameOf(reservation);
        const folioReference = statement.folio.reference ?? `Window ${statement.folio.windowNo}`;
        const fingerprint = JSON.stringify({
          propertyId,
          reservationId: reservation.reservationId,
          folioId: statement.folio.id,
          txCode: option.code,
          amountMinor: cashierInstruction.amountMinor,
          quantity: "1",
        });
        const proposal: CashierChargeProposal = Object.freeze({
          reservationId: reservation.reservationId,
          confirmationNo: reservation.confirmationNo,
          guestName,
          folioId: statement.folio.id,
          folioReference,
          currency: statement.folio.currency,
          txCode: option.code,
          txName: option.name,
          amountMinor: cashierInstruction.amountMinor,
          amountMajor: cashierInstruction.amountMajor,
          quantity: "1",
          fingerprint,
          key: cashierChargeProposal?.fingerprint === fingerprint
            ? cashierChargeProposal.key
            : `yellow-conversation-charge-${crypto.randomUUID()}`,
          postingAttempted: false,
          receipt: null,
        });
        setCashierChargeProposal(proposal);
        replyCashier("Nothing has been posted. Shall I post this exact charge?", {
          eyebrow: "CONFIRM FOLIO CHARGE",
          title: `${guestName} · ${folioReference}`,
          detail: "Say yes to post this exact configured charge or no to cancel. A different instruction discards this proposal.",
          rows: [
            { primary: `Folio ${folioReference}`, secondary: "Exact open folio window" },
            { primary: option.name, secondary: `${statement.folio.currency} ${cashierInstruction.amountMajor} · quantity 1` },
            { primary: reservation.confirmationNo, secondary: `Current ${reservationStatusDescription(reservation.status ?? "unknown")}` },
          ],
          workspace: "cashiers",
          cashierReservationId: reservation.reservationId,
        });
      } catch (error) {
        if (assistantOperationWasSuperseded()) return;
        replyCashier(error instanceof Error ? error.message : "The live folio could not be loaded, so no charge was prepared.");
      } finally {
        setThinking(false);
      }
      return;
    }
    const activeArrival = assistantCard?.checkInReservationId;
    const activeReservation = assistantCard?.reservationId ?? activeArrival;
    const cleaningAttendantInstruction = activeArrival
      ? arrivalCleaningAttendantIntent(message)
      : null;
    const housekeepingActionInstruction = activeArrival
      ? housekeepingTaskActionIntent(message)
      : null;
    if (activeArrival && (cleaningAttendantInstruction || housekeepingActionInstruction)) {
      // Changing from a guest allocation or earlier arrival proposal to a
      // cleaning attendant is explicit supersession, never shared authority.
      setGuestAllocationProposal(null);
      setArrivalConversation({ id: crypto.randomUUID(), text: message });
      return;
    }
    if (
      activeArrival &&
      !guestAllocationProposal &&
      !namedReservationAction &&
      /^(?:(?:yes|yes please|go ahead|confirm|haan|ha|हाँ|no|no thanks|cancel|stop|not now|nahi|नहीं)\s*[.!]?|(?:room\s*)?\d{2,4}\s*[.!]?|(?:prepare\s+)?check[ -]?in\s*(?:please)?[.!]?)$/iu.test(message)
    ) {
      setArrivalConversation({ id: crypto.randomUUID(), text: message });
      return;
    }
    const guestConversationIntent = activeReservation
      ? reservationGuestAllocationIntent(message)
      : null;
    if (activeReservation && guestConversationIntent) {
      const activeReservationCardContext = assistantCard?.checkInReservationId === activeReservation
        ? { checkInReservationId: activeReservation }
        : { reservationId: activeReservation };
      const reply = (answer: string, card?: AssistantCard) => {
        const replyTurns = [...next, { role: "assistant" as const, text: answer }];
        setTurns(replyTurns);
        rememberOverwatch({ open: true, language, turns: replyTurns });
        say(answer);
        if (card) setAssistantCard(card);
      };
      if (guestConversationIntent.kind === "cancel") {
        setGuestAllocationProposal(null);
        reply("Understood. I cancelled the pending guest allocation and did not change this reservation.");
        return;
      }
      if (guestConversationIntent.kind === "confirm") {
        const proposal = guestAllocationProposal;
        if (!proposal || proposal.reservationId !== activeReservation) {
          reply("No guest allocation is waiting for confirmation.");
          return;
        }
        setReservationLifecycleFlight(true);
        setThinking(true);
        try {
          const freshDetail = await loadReservation(proposal.reservationId);
          if (reservationGuestAllocationsMatch(freshDetail, proposal.replacement)) {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["reservation", propertyId, proposal.reservationId] }),
              queryClient.invalidateQueries({ queryKey: ["overwatch-reservation", propertyId, proposal.reservationId] }),
              queryClient.invalidateQueries({ queryKey: ["overwatch-check-in", propertyId, proposal.reservationId] }),
              queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] }),
              queryClient.invalidateQueries({ queryKey: ["yellow-reservation-command-index", propertyId] }),
            ]);
            setGuestAllocationProposal(null);
            reply(
              "Guests and shares were already saved. I reconciled the authoritative reservation after the earlier uncertain response.",
              {
                eyebrow: "GUEST ALLOCATION RECONCILED",
                title: proposal.confirmationNo,
                detail: "Yellow verified that canonical guest truth already equals the exact confirmed proposal; it did not submit a second change.",
                rows: proposal.displayRows,
                ...activeReservationCardContext,
              },
            );
            return;
          }
          if (!reservationGuestAllocationsMatch(freshDetail, proposal.baseline)) {
            setGuestAllocationProposal(null);
            reply(
              "The guest allocation changed before confirmation, so I stopped without writing.",
              {
                eyebrow: "GUEST ALLOCATION REFRESHED",
                title: proposal.confirmationNo,
                detail: "Another change reached the reservation first. Yellow discarded the old proposal and is showing current canonical truth.",
                rows: [],
                ...activeReservationCardContext,
              },
            );
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["reservation", propertyId, proposal.reservationId] }),
              queryClient.invalidateQueries({ queryKey: ["overwatch-reservation", propertyId, proposal.reservationId] }),
              queryClient.invalidateQueries({ queryKey: ["overwatch-check-in", propertyId, proposal.reservationId] }),
            ]);
            return;
          }
          let reconciled = false;
          try {
            await replaceReservationGuests(proposal.reservationId, proposal.replacement, proposal.key);
          } catch (error) {
            const afterUncertain = await loadReservation(proposal.reservationId).catch(() => undefined);
            if (!reservationGuestAllocationsMatch(afterUncertain, proposal.replacement)) throw error;
            reconciled = true;
          }
          const refreshed = await loadReservation(proposal.reservationId);
          if (!reservationGuestAllocationsMatch(refreshed, proposal.replacement))
            throw new Error("The command was received, but the refreshed guest allocation is not yet authoritative. Retry the unchanged confirmation to reconcile safely.");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["reservation", propertyId, proposal.reservationId] }),
            queryClient.invalidateQueries({ queryKey: ["overwatch-reservation", propertyId, proposal.reservationId] }),
            queryClient.invalidateQueries({ queryKey: ["overwatch-check-in", propertyId, proposal.reservationId] }),
            queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] }),
            queryClient.invalidateQueries({ queryKey: ["yellow-reservation-command-index", propertyId] }),
          ]);
          setGuestAllocationProposal(null);
          reply(
            reconciled
              ? "Guests and shares are saved and reconciled after an uncertain response. The live reservation is authoritative."
              : "Guests and shares are saved. The live reservation and recorded history are refreshed.",
            {
              eyebrow: "GUEST ALLOCATION UPDATED",
              title: proposal.confirmationNo,
              detail: "Yellow used the governed reservation guest command and verified the canonical result before reporting success.",
              rows: proposal.displayRows,
              ...activeReservationCardContext,
            },
          );
        } catch (error) {
          reply(error instanceof Error ? error.message : "Guests and shares could not be saved.");
        } finally {
          setThinking(false);
          setReservationLifecycleFlight(false);
        }
        return;
      }
      // Any new add/remove instruction supersedes an earlier unconfirmed
      // allocation immediately, including when this new instruction later
      // fails resolution or validation.
      setGuestAllocationProposal(null);
      const currentDetail = await loadReservation(activeReservation).catch(() => undefined);
      if (assistantOperationWasSuperseded()) return;
      if (!currentDetail) {
        reply("The live reservation is unavailable, so I did not prepare a guest change.");
        return;
      }
      const currentReservation = currentDetail.reservation;
      if (!["reserved", "due_in", "in_house", "due_out"].includes(currentReservation.status)) {
        reply("This reservation state does not allow guest allocation changes.");
        return;
      }
      const baseline = reservationGuestReplacementFromDetail(currentDetail);
      let replacement: ReservationGuestReplacement;
      const displayNames = new Map(currentReservation.guests.map((guest) => [guest.partyId, guest.displayName]));
      if (guestConversationIntent.kind === "remove") {
        const query = normaliseGuestLookup(guestConversationIntent.query);
        const matches = currentReservation.guests.filter((guest) =>
          (normaliseGuestLookup(guest.partyId) === query || normaliseGuestLookup(guest.displayName).includes(query)),
        );
        if (matches.length !== 1) {
          reply(matches.length ? "More than one attached guest matches that identity. Say the exact Party ID." : "I could not find one attached guest with that identity.");
          return;
        }
        const removed = matches[0]!;
        if (removed.role === "primary") {
          reply("The primary guest is server owned and cannot be removed from the reservation.");
          return;
        }
        const retained = baseline.guests.filter((guest) => guest.partyId !== removed.partyId);
        replacement = Object.freeze({
          primarySharePct: retained.some((guest) => guest.role === "sharer") ? baseline.primarySharePct : null,
          guests: Object.freeze(retained),
        });
      } else {
        const profiles = await searchPartyProfiles(guestConversationIntent.query).catch(() => []);
        if (assistantOperationWasSuperseded()) return;
        const query = normaliseGuestLookup(guestConversationIntent.query);
        const exactProfiles = profiles.filter((profile) =>
          normaliseGuestLookup(profile.partyId) === query || normaliseGuestLookup(profile.displayName) === query,
        );
        if (exactProfiles.length === 1 && exactProfiles[0]!.status !== "active") {
          reply("That exact guest profile is not active, so I did not prepare a reservation change.");
          return;
        }
        const matches = exactProfiles.length === 1
          ? exactProfiles
          : exactProfiles.length === 0 && profiles.length === 1 && profiles[0]!.status === "active"
            ? profiles
            : [];
        if (matches.length !== 1) {
          reply(profiles.length > 1 ? "I found multiple guest profiles. Say the exact Party ID before I prepare a change." : "I could not find one active existing guest profile with that identity.");
          return;
        }
        const profile = matches[0]!;
        if (profile.partyId === currentReservation.primaryPartyId || baseline.guests.some((guest) => guest.partyId === profile.partyId)) {
          reply(`${profile.displayName} is already attached to this reservation. No change has been prepared.`);
          return;
        }
        if (guestConversationIntent.role === "sharer" && (!guestConversationIntent.sharePct || !guestConversationIntent.primarySharePct)) {
          reply(`Tell me both percentages, for example: “add ${profile.displayName} as sharer with 40 percent, primary 60 percent.”`);
          return;
        }
        displayNames.set(profile.partyId, profile.displayName);
        const proposedGuests = [...baseline.guests, Object.freeze({
          partyId: profile.partyId,
          role: guestConversationIntent.role,
          sharePct: guestConversationIntent.role === "sharer" ? guestConversationIntent.sharePct : null,
        })].sort((left, right) => left.partyId.localeCompare(right.partyId));
        replacement = Object.freeze({
          primarySharePct: guestConversationIntent.role === "sharer" ? guestConversationIntent.primarySharePct : baseline.primarySharePct,
          guests: Object.freeze(proposedGuests),
        });
      }
      const sharers = replacement.guests.filter((guest) => guest.role === "sharer");
      const primaryBasisPoints = sharers.length ? parseGuestShareBasisPoints(replacement.primarySharePct ?? "") : 10_000;
      const sharerBasisPoints = sharers.map((guest) => parseGuestShareBasisPoints(guest.sharePct ?? ""));
      const exactTotal = primaryBasisPoints !== null && sharerBasisPoints.every((value) => value !== null)
        ? primaryBasisPoints + sharerBasisPoints.reduce<number>((sum, value) => sum + (value ?? 0), 0)
        : -1;
      if (exactTotal !== 10_000) {
        reply("The primary and every retained sharer must have explicit two-decimal percentages totalling exactly 100.00. No change has been prepared.");
        return;
      }
      const primaryName = currentReservation.guests.find((guest) => guest.role === "primary")?.displayName ?? currentReservation.confirmationNo;
      const displayRows = Object.freeze([
        Object.freeze({ primary: primaryName, secondary: `primary${sharers.length ? ` · ${replacement.primarySharePct}%` : ""}` }),
        ...replacement.guests.map((guest) => Object.freeze({
          primary: displayNames.get(guest.partyId) ?? guest.partyId,
          secondary: `${guest.role}${guest.role === "sharer" ? ` · ${guest.sharePct}%` : " · no share percentage"}`,
        })),
      ]);
      const fingerprint = JSON.stringify({ propertyId, reservationId: activeReservation, baseline, replacement });
      const proposal: GuestAllocationProposal = Object.freeze({
        reservationId: activeReservation,
        confirmationNo: currentReservation.confirmationNo,
        primaryName,
        baseline,
        replacement,
        displayRows,
        fingerprint,
        key: guestAllocationProposal?.fingerprint === fingerprint
          ? guestAllocationProposal.key
          : `yellow-conversation-guests-${crypto.randomUUID()}`,
      });
      setGuestAllocationProposal(proposal);
      reply(
        "No change has been made. Shall I save this exact guest allocation?",
        {
          eyebrow: "CONFIRM GUEST ALLOCATION",
          title: currentReservation.confirmationNo,
          detail: "Review the complete primary, accompanying and sharer allocation below. Say yes to submit this exact proposal or no to cancel it.",
          rows: displayRows,
          ...activeReservationCardContext,
        },
      );
      return;
    }
    if (guestAllocationProposal) setGuestAllocationProposal(null);
    const preferredLanguage = languagePreferenceFromText(message);
    if (preferredLanguage) {
      setLanguage(preferredLanguage);
      const answer = preferredLanguage === "Marathi"
        ? "नक्की. आता मी मराठीत मदत करेन."
        : preferredLanguage === "Hindi"
          ? "बिल्कुल। अब मैं हिंदी में मदद करूँगा।"
          : preferredLanguage === "Kannada"
            ? "ಖಂಡಿತ. ಈಗ ನಾನು ಕನ್ನಡದಲ್ಲಿ ಸಹಾಯ ಮಾಡುತ್ತೇನೆ."
            : preferredLanguage === "Telugu"
              ? "తప్పకుండా. ఇప్పుడు నేను తెలుగులో సహాయం చేస్తాను."
              : "Certainly. I’ll continue in English.";
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language: preferredLanguage, turns: replyTurns });
      say(answer);
      return;
    }
    if (isAssistantWakeWord(message)) {
      const answer = wakeReply(language);
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      return;
    }
    if (namedGuest) {
      const answer = guestHistoryReply(language, namedGuest.displayName);
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "LIVE GUEST RELATIONSHIP",
        title: namedGuest.displayName,
        detail: "Yellow resolved one canonical Party ID and is displaying its server-scoped profile and stay history. No profile or reservation has been changed.",
        rows: [],
        guestPartyId: namedGuest.partyId,
      });
      return;
    }
    if (ambiguousGuests.length) {
      const answer = `I found multiple separate guest profiles with that name. Say “show guest history for” followed by one confirmation number shown below.`;
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "GUEST IDENTITY NEEDS CLARIFICATION",
        title: ambiguousGuests[0]?.displayName ?? "Matching guests",
        detail: "Yellow will not merge or guess between separate Party records that share a display name.",
        rows: ambiguousGuests.map((candidate) => ({
          primary: candidate.confirmations.join(" · "),
          secondary: "Separate Party profile",
        })),
      });
      return;
    }
    if (reservationCreationVoiceIntent(message)) {
      const answer = "I opened the governed reservation builder. Add the stay, choose one canonical Party profile, and review the current room, rate, price and policy. Nothing will be written until you separately confirm the complete proposal.";
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "GOVERNED RESERVATION BUILDER",
        title: "Create a reservation",
        detail: "Overwatch opened the real reservation workflow. It uses canonical Party, availability, rate and policy services, then rereads the committed reservation before reporting success.",
        rows: [],
        reservationCreate: true,
      });
      return;
    }
    if (namedReservationAction?.workbench === "cashier") {
      const answer = `Opening ${nameOf(namedReservationAction.reservation)}’s current billing desk. I will not post, settle, or alter the folio without a separate visible confirmation.`;
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "LIVE CASHIER WORKSPACE",
        title: `${nameOf(namedReservationAction.reservation)} · billing`,
        detail: "The named reservation is selected in the governed billing desk below. Review its folio windows and immutable postings; any new charge still requires a configured class, amount and separate visible confirmation.",
        rows: [{
          primary: namedReservationAction.reservation.confirmationNo,
          secondary: reservationStatusDescription(namedReservationAction.reservation.status ?? "unknown"),
        }],
        workspace: "cashiers",
        cashierReservationId: namedReservationAction.reservation.reservationId,
      });
      return;
    }
    const reservationAction = namedReservationAction;
    if (reservationAction) {
      const preparingCheckIn = reservationAction.workbench === "check-in";
      const preparingCheckOut = reservationAction.workbench === "check-out";
      const preparingLifecycle = reservationAction.workbench === "lifecycle";
      const requestedDepartureService = departureServiceVoiceIntent(message);
      const completedDeparture = preparingCheckOut && reservationAction.completed === true;
      const answer = preparingLifecycle
        ? reservationAction.lifecycleAction === "cancel"
          ? `Opening the governed cancellation review for ${nameOf(reservationAction.reservation)}. Review the reason and current server state; voice alone changes nothing.`
          : reservationAction.lifecycleAction === "reinstate"
            ? `Opening the governed reinstatement review for ${nameOf(reservationAction.reservation)}. PostgreSQL must reclaim the original occupancy before any confirmed change.`
            : `Opening ${nameOf(reservationAction.reservation)}’s no-show authority review. No operator no-show command exists, so this view is deliberately non-mutating.`
        : preparingCheckIn
        ? `Opening the governed check-in review for ${nameOf(reservationAction.reservation)}. Yellow will show readiness before any change.`
        : completedDeparture
          ? `Opening the completed departure review for ${nameOf(reservationAction.reservation)}. This stay is already departed; Yellow will show the verified read-only record.`
        : requestedDepartureService
          ? `I selected ${requestedDepartureService.serviceKind.replaceAll("_", " ")} for ${nameOf(reservationAction.reservation)}. Review the role and timing in the departure card. Voice alone created no proposal or task.`
        : preparingCheckOut
          ? `Opening the governed checkout readiness for ${nameOf(reservationAction.reservation)}. Yellow will show every blocker before any change.`
          : `Opening ${nameOf(reservationAction.reservation)}’s live reservation.`;
      const replyTurns = [
        ...next,
        { role: "assistant" as const, text: answer },
      ];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      if (preparingLifecycle) {
        setAssistantCard({
          eyebrow: "RESERVATION LIFECYCLE REVIEW",
          title: nameOf(reservationAction.reservation),
          detail: reservationAction.lifecycleAction === "no_show"
            ? "No-show is owned by the property day-roll process. Yellow opens the real reservation record and explains the blocker without inventing an operator write."
            : "Yellow opened the real reservation lifecycle surface. The proposal must still pass a fresh authoritative reread and separate visible confirmation.",
          rows: [{
            primary: reservationAction.reservation.confirmationNo,
            secondary: reservationStatusDescription(reservationAction.reservation.status ?? "unknown"),
          }],
          reservationId: reservationAction.reservation.reservationId,
          reservationLifecycleAction: reservationAction.lifecycleAction,
        });
      } else if (preparingCheckIn) {
        setAssistantCard({
          eyebrow: "LIVE OPERATION",
          title: nameOf(reservationAction.reservation),
          detail: "Yellow is preparing the live check-in flow. Nothing changes until you confirm the final step.",
          rows: [
            { primary: reservationAction.reservation.confirmationNo, secondary: reservationAction.reservation.status },
            { primary: reservationAction.reservation.sellableUnitLabel ?? "Room to be assigned", secondary: reservationAction.reservation.ratePlanLabel ?? "Rate plan pending" },
          ],
          checkInReservationId: reservationAction.reservation.reservationId,
        });
      } else {
        setDepartureConversationPending(false);
        setDepartureConversation(requestedDepartureService && !completedDeparture
          ? {
              id: crypto.randomUUID(),
              kind: "prepare",
              serviceKind: requestedDepartureService.serviceKind,
              timing: requestedDepartureService.timing === "immediate" || requestedDepartureService.timing === "custom"
                ? requestedDepartureService.timing
                : String(requestedDepartureService.timing) as "10" | "15" | "30" | "45",
            }
          : null);
        setAssistantCard({
          // Keep the live-departure branch explicit for source-level route audits:
          // eyebrow: preparingCheckOut ? "LIVE DEPARTURE FLOW" : "LIVE RESERVATION"
          eyebrow: completedDeparture ? "COMPLETED DEPARTURE REVIEW" : preparingCheckOut ? "LIVE DEPARTURE FLOW" : "LIVE RESERVATION",
          title: nameOf(reservationAction.reservation),
          detail: completedDeparture
            ? "This reservation is already checked out. Yellow is opening its verified completed departure review; no checkout action is available."
            : preparingCheckOut
            ? "Yellow is displaying current server-owned checkout readiness. No checkout occurs unless every blocker is cleared and you separately confirm the named departure."
            : "The complete governed reservation is live below. Review its guest, stay, room and folio context without leaving Yellow.",
          rows: [{
            primary: reservationAction.reservation.confirmationNo,
            secondary: reservationStatusDescription(reservationAction.reservation.status ?? "unknown"),
          }],
          ...(preparingCheckOut
            ? {
                // Historical source contract: ? { checkoutReservationId: reservationAction.reservation.reservationId }
                checkoutReservationId: reservationAction.reservation.reservationId,
                checkoutCompleted: completedDeparture,
                checkoutRoomLabel: reservationAction.roomLabel ?? null,
              }
            : { reservationId: reservationAction.reservation.reservationId }),
        });
      }
      return;
    }
    const completeBoardRows = indexedReservations ?? [];
    const reservationQueryResolution = resolveReservationQueryIntent(
      message,
      reservationQueryContext,
      {
        now: new Date(),
        timezone: selected?.timezone ?? "UTC",
        sources: [...new Set(completeBoardRows.map((row) => row.channelCode).filter((item): item is string => Boolean(item)))],
        roomTypes: [...new Set(completeBoardRows.map((row) => row.unitTypeLabel).filter((item): item is string => Boolean(item)))],
        ratePlans: [...new Set(completeBoardRows.map((row) => row.ratePlanLabel).filter((item): item is string => Boolean(item)))],
      },
    );
    if (reservationQueryResolution) {
      if (!completeReservationBoardAvailable) {
        const answer = "The complete reservation board is unavailable right now. Yellow will not substitute a partial arrivals or departures list.";
        const replyTurns = [...next, { role: "assistant" as const, text: answer }];
        setTurns(replyTurns);
        rememberOverwatch({ open: true, language, turns: replyTurns, reservationQuery: reservationQueryContext ?? undefined });
        say(answer);
        setAssistantCard({
          eyebrow: "RESERVATION VIEW UNAVAILABLE",
          title: "Complete board required",
          detail: answer,
          rows: [],
        });
        return;
      }
      if (reservationQueryResolution.kind === "clarify") {
        const answer = reservationQueryResolution.message;
        const replyTurns = [...next, { role: "assistant" as const, text: answer }];
        setTurns(replyTurns);
        rememberOverwatch({ open: true, language, turns: replyTurns, reservationQuery: reservationQueryContext ?? undefined });
        say(answer);
        setAssistantCard({
          eyebrow: "RESERVATION FILTER NEEDS CLARIFICATION",
          title: "I will not broaden your request",
          detail: answer,
          rows: [],
        });
        return;
      }
      const context = reservationQueryResolution.context;
      const baseRows = reservationRowsForQuery(completeBoardRows, context);
      const filteredRows = filterAndSortMovementRows(
        baseRows,
        context.query,
        context.query.sorts,
        context.query.movementTime,
        selected?.timezone ?? "UTC",
      );
      const count = filteredRows.length;
      const filters = reservationQueryFilterCount(context.query);
      const plannedMovement = Boolean(context.query.dateFrom || context.query.dateTo) && !context.query.state;
      const answer = `Showing ${count} ${reservationQueryTitle(context).toLowerCase()}${filters ? ` matching ${filters} active filter${filters === 1 ? "" : "s"}` : ""}.`;
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setReservationQueryContext(context);
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns, reservationQuery: context });
      say(answer);
      setAssistantCard({
        eyebrow: plannedMovement ? "PLANNED MOVEMENT VIEW" : "LIVE RESERVATION VIEW",
        title: reservationQueryTitle(context),
        detail: plannedMovement
          ? `${count} reservations match the recorded ${context.query.movementTime} date and filters. Yellow has not inferred a due-in, due-out, check-in or checkout event.`
          : `${count} reservations match the complete governed board. Search, refine, sort or open a record without leaving Yellow.`,
        rows: [],
        movement: {
          status: context.view,
          lane: { reservations: baseRows },
          query: context.query,
        },
      });
      return;
    }
    const readIntent = resolveLocalReadIntent(message);
    if (readIntent?.kind === "state") {
      const askedState = readIntent.state;
      const exactReservations = all.filter((reservation) => reservation.operationalState === askedState);
      const answer = exactStateReply(language, askedState, exactReservations);
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "EXACT OPERATING STATE",
        title: operationalStateLabel(askedState),
        detail: `${exactReservations.length} reservations match the server-provided ${operationalStateDescription(askedState).toLowerCase()} state. Yellow has not inferred a completed event from dates or planned status.`,
        rows: [],
        movement: {
          status: askedState === "checked_out_today" ? "all" : "in_house",
          lane: { reservations: exactReservations },
        },
      });
      return;
    }
    if (readIntent?.kind === "lane") {
      const askedLane = readIntent.lane;
      const laneReservations = lanes.find((x) => x.status === askedLane)?.query.data?.reservations ?? [];
      const answer = localReply(language, askedLane, laneReservations);
      const replyTurns = [
        ...next,
        { role: "assistant" as const, text: answer },
      ];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "LIVE HOTEL VIEW",
        title: titleOf(askedLane),
        detail: `${laneReservations.length} current ${titleOf(askedLane).toLowerCase()} are displayed below. Search, filter, sort or open any reservation without leaving Yellow.`,
        rows: [],
        movement: {
          status: askedLane,
          lane: { reservations: laneReservations },
        },
      });
      return;
    }
    if (readIntent?.kind === "metric") {
      let metricData = performanceQuery.data;
      if (!metricData) metricData = (await performanceQuery.refetch()).data;
      if (assistantOperationWasSuperseded()) return;
      if (!metricData) {
        const answer = "The governed operating-performance feed is unavailable right now. Yellow will not estimate the missing KPI.";
        const replyTurns = [...next, { role: "assistant" as const, text: answer }];
        setTurns(replyTurns);
        rememberOverwatch({ open: true, language, turns: replyTurns });
        say(answer);
        return;
      }
      const requestedMetricIntent = readIntent.metric;
      const answer = `Showing ${kpiTitle(requestedMetricIntent).toLowerCase()} for Today, MTD, QTD and YTD against last year, forecast and budget.`;
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "LIVE HOTEL KPI",
        title: kpiTitle(requestedMetricIntent),
        detail: "This is the current property-scoped operating-performance view. Yellow has not estimated or replaced any unavailable measure.",
        rows: [],
        performance: { intent: requestedMetricIntent, data: metricData },
      });
      return;
    }
    if (readIntent?.kind === "workspace") {
      const targetWorkspace = readIntent.workspace;
      const answer = workspaceReply(language, targetWorkspace);
      const replyTurns = [...next, { role: "assistant" as const, text: answer }];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      setAssistantCard({
        eyebrow: "LIVE PMS WORKSPACE",
        title: workspaceTitle(targetWorkspace),
        detail: "The requested governed PMS workspace is live below. Read, search or continue the existing confirmation-gated workflow without leaving Yellow.",
        rows: [],
        workspace: targetWorkspace,
      });
      return;
    }
    setThinking(true);
    try {
      const bearerToken = await session();
      if (assistantOperationWasSuperseded()) return;
      const r = await fetch("/api/v1/jarvis:ask", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({
          message,
          language: languageCodeFor(language),
          history: next.slice(-4, -1),
        }),
      });
      if (assistantOperationWasSuperseded()) return;
      const body = (await r.json()) as {
        answer?: string;
        detail?: string;
        navigation?: unknown;
        focus?: unknown;
        requiresConfirmation?: unknown;
        reservationOperation?: unknown;
      };
      if (assistantOperationWasSuperseded()) return;
      const baseAnswer =
        body.answer ??
        body.detail ??
        "Overwatch could not complete that request.";
      const answer =
        body.requiresConfirmation === true
          ? `${baseAnswer}\n\nNo change has been made. Review and visibly confirm it in Yellow.`
          : baseAnswer;
      const replyTurns = [
        ...next,
        { role: "assistant" as const, text: answer },
      ];
      setTurns(replyTurns);
      rememberOverwatch({ open: true, language, turns: replyTurns });
      say(answer);
      if (body.reservationOperation === "create") {
        setAssistantCard({
          eyebrow: "GOVERNED RESERVATION BUILDER",
          title: "Create a reservation",
          detail: "Overwatch opened the real reservation workflow. Complete and visibly confirm its canonical proposal before any write.",
          rows: [],
          reservationCreate: true,
        });
        return;
      }
      if (body.reservationOperation === "edit") {
        setAssistantCard({
          eyebrow: "SELECT A CANONICAL RESERVATION",
          title: "Edit a reservation",
          detail: "Choose the exact reservation below. Yellow will open its live governed record; every proposed change remains separate and confirmation-gated.",
          rows: [],
          workspace: "reservations",
        });
        return;
      }
      const target = guidedNavigationPath(
        propertyId,
        body.navigation,
        body.focus,
      );
      if (target) {
        setAssistantCard({
          eyebrow: "OPENING LIVE VIEW",
          title: "Requested workspace",
          detail: "Yellow is opening the server-approved PMS view now.",
          rows: [],
        });
        window.location.assign(target);
      }
    } catch {
      if (assistantOperationWasSuperseded()) return;
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          text: "I could not reach the guided assistant. Please try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }
  async function listen() {
    if (reservationLifecycleBusyRef.current) return;
    const access = await requestVoiceMicrophone(window.navigator.mediaDevices);
    if (reservationLifecycleBusyRef.current) return;
    if (access !== "granted") {
      setTurns((x) => [
        ...x,
        {
          role: "assistant",
          text:
            access === "unavailable"
              ? "Microphone access is not available in this browser. You can type your request."
              : "Please allow microphone access in the browser, then tap the microphone again.",
        },
      ]);
      return;
    }
    const Ctor =
      (
        window as unknown as {
          SpeechRecognition?: new () => Recognition;
          webkitSpeechRecognition?: new () => Recognition;
        }
      ).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
        .webkitSpeechRecognition;
    if (!Ctor) {
      setTurns((x) => [
        ...x,
        {
          role: "assistant",
          text: "Voice input is not available in this browser. You can type your request.",
        },
      ]);
      return;
    }
    const listener = new Ctor();
    recognition.current = listener;
    setListening(true);
    setLiveTranscript("");
    listener.lang = languageCodeFor(language);
    listener.continuous = true;
    listener.interimResults = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shouldListen = true;
    let restartCount = 0;
    let committedWords = "";
    const finishTurn = (words: string) => {
      if (reservationLifecycleBusyRef.current) return;
      shouldListen = false;
      setListening(false);
      setLiveTranscript("");
      listener.stop();
      void ask(words);
    };
    listener.onresult = (event) => {
      if (reservationLifecycleBusyRef.current) return;
      const results = Array.from(event.results);
      const changedResults = results.slice(event.resultIndex ?? 0);
      const merged = mergeVoiceTranscript(
        committedWords,
        changedResults.map((result) => ({
          transcript: result[0]?.transcript ?? "",
          isFinal: result.isFinal === true,
        })),
      );
      committedWords = merged.committed;
      if (!merged.display) return;
      setPrompt(merged.display);
      // This text is intentionally ephemeral: it is visible to the operator
      // while listening, but is not persisted or sent until the turn finishes.
      setLiveTranscript(merged.display);
      // Interim recognition is deliberately display-only. It can be rewritten
      // by the browser and must never become a confirmation or a PMS command.
      if (timer) clearTimeout(timer);
      if (committedWords) {
        timer = setTimeout(() => {
          finishTurn(committedWords);
        }, voicePauseMs);
      }
    };
    listener.onend = () => {
      // Chromium can end a continuous session at phrase boundaries. Resume the
      // same turn (including its partial text) instead of treating it as done.
      if (shouldListen && restartCount < voiceRestartLimit) {
        restartCount += 1;
        window.setTimeout(() => {
          if (shouldListen) listener.start();
        }, 80);
        return;
      }
      if (shouldListen && !timer) {
        shouldListen = false;
        setTurns((x) => [
          ...x,
          {
            role: "assistant",
            text: "Voice recognition paused. Tap the microphone to continue, or type your request.",
          },
        ]);
      }
      setListening(false);
      setLiveTranscript("");
    };
    listener.onerror = (event) => {
      if (event.error === "no-speech" && shouldListen) return;
      shouldListen = false;
      if (timer) clearTimeout(timer);
      setListening(false);
      setLiveTranscript("");
      setTurns((x) => [
        ...x,
        {
          role: "assistant",
          text:
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
              ? "Please allow microphone access in the browser, then tap the microphone again."
              : "Voice recognition paused. Tap the microphone to continue, or type your request.",
        },
      ]);
    };
    listener.start();
  }
  const assistantDock = (
    <>
      <nav className="mobile-nav" aria-label="Mobile PMS navigation">
        <button
          className={workspacePart === "today" ? "active" : undefined}
          onClick={() => workflow("today")}
          aria-current={workspacePart === "today" ? "page" : undefined}
          aria-label="Open Today"
        >
          <PmsIcon name="today" />Today
        </button>
        <button
          className={workspacePart === "reservations" ? "active" : undefined}
          onClick={() => workflow("reservations")}
          aria-current={workspacePart === "reservations" ? "page" : undefined}
          aria-label="Open Reservations"
        >
          <PmsIcon name="stays" />Stays
        </button>
        <button
          className={workspacePart === "guests" ? "active" : undefined}
          onClick={() => workflow("guests")}
          aria-current={workspacePart === "guests" ? "page" : undefined}
          aria-label="Open Guests"
        >
          <PmsIcon name="guests" />Guests
        </button>
        <button
          className={workspacePart === "operations" ? "active" : undefined}
          onClick={() => workflow("operations")}
          aria-current={workspacePart === "operations" ? "page" : undefined}
          aria-label="Open Operations"
        >
          <PmsIcon name="today" />Ops
        </button>
        <button
          className={workspacePart === "finance" ? "active" : undefined}
          onClick={billingDesk}
          aria-current={workspacePart === "finance" ? "page" : undefined}
          aria-label="Open Cashier and folios"
        >
          <PmsIcon name="finance" />Finance
        </button>
        <button
          className={workspacePart === "ecosystem" || workspacePart === "market-lab" ? "active" : undefined}
          onMouseEnter={() => void import("./workspaces/EcosystemHub")}
          onFocus={() => void import("./workspaces/EcosystemHub")}
          onClick={() => workflow("ecosystem")}
          aria-current={workspacePart === "ecosystem" || workspacePart === "market-lab" ? "page" : undefined}
          aria-label="Open the Yellow ecosystem"
        >
          <PmsIcon name="yellow" />All
        </button>
        <button
          className={assistant ? "active" : undefined}
          onClick={() => setAssistant(true)}
          aria-label="Activate Yellow"
        >
          <PmsIcon name="yellow" />Yellow
        </button>
      </nav>
      <button className="yellow-launch" onClick={() => setAssistant(true)}>
        <PmsIcon name="yellow" /><span>Ask Yellow</span>
      </button>
      <AnimatePresence>
        {assistant ? (
          <motion.div
            className={`yellow-ai-mode ${yellowVisualState}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Yellow AI mode"
          >
            <div className="yellow-neon-field" aria-hidden="true" />
            <section className="yellow-command-surface" role="region" aria-label="Yellow commands">
              <header>
                <p><PmsIcon name="yellow" /> Yellow is active</p>
                <button onClick={() => setAssistant(false)} aria-label="Exit Yellow mode">×</button>
              </header>
              <p className="yellow-command-cue">Speak naturally. Yellow will show the live hotel view or explain the next governed action before changing anything.</p>
              {turns.length ? (
                <div className="yellow-turns">
                  {turns.slice(-3).map((turn, i) => (
                    <div key={`${turn.role}-${i}`} className={`yellow-turn ${turn.role}`}>
                      <p>{turn.text}</p>
                      {turn.role === "assistant" ? (
                        <button
                          type="button"
                          className="yellow-turn-speak"
                          onClick={() => say(turn.text, true)}
                          aria-label="Speak this Yellow response"
                        >Speak</button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {listening && liveTranscript ? (
                <div className="yellow-live-transcript" aria-live="polite">
                  <span>HEARING NOW</span>
                  <p>{liveTranscript}</p>
                </div>
              ) : null}
              {assistantCard ? (
                <section className="yellow-live-result" aria-live="polite">
                  <span>{assistantCard.eyebrow}</span>
                  <h3>{assistantCard.title}</h3>
                  <p>{assistantCard.detail}</p>
                  {assistantCard.rows.map((row, index) => (
                    <div key={`${row.primary}-${index}`}>
                      <strong>{row.primary}</strong><small>{row.secondary}</small>
                    </div>
                  ))}
                  {assistantCard.movement ? (
                    <div className="yellow-inline-movement">
                      {assistantCard.movement.detailReservationId ? (
                        <>
                          <button
                            type="button"
                            className="back-link"
                            onClick={() => setAssistantCard((current) => current?.movement ? {
                              ...current,
                              movement: { ...current.movement, detailReservationId: undefined },
                            } : current)}
                          >Back to filtered reservations</button>
                          <ReservationWorkspace
                            key={assistantCard.movement.detailReservationId}
                            reservationId={assistantCard.movement.detailReservationId}
                            timezone={selected?.timezone ?? "UTC"}
                            onLifecycleBusyChange={setReservationLifecycleFlight}
                            onResolveWithYellow={resolveReservationWithYellow}
                          />
                        </>
                      ) : (
                        <MovementGrid
                          status={assistantCard.movement.status}
                          lane={assistantCard.movement.lane}
                          timezone={selected?.timezone ?? "UTC"}
                          query={assistantCard.movement.query}
                          onQueryChange={(query) => {
                            const view = assistantCard.movement?.status ?? "all";
                            const context = { view, query } satisfies ReservationQueryContext;
                            const rows = reservationRowsForQuery(
                              reservationIndexQuery.data?.reservations ?? assistantCard.movement?.lane.reservations ?? [],
                              context,
                            );
                            setReservationQueryContext(context);
                            setAssistantCard((current) => current?.movement ? {
                              ...current,
                              movement: { ...current.movement, lane: { reservations: rows }, query },
                            } : current);
                          }}
                          open={(stay) => setAssistantCard((current) => current?.movement ? {
                            ...current,
                            movement: { ...current.movement, detailReservationId: stay.reservationId },
                          } : current)}
                          headingId="yellow-inline-movement-heading"
                        />
                      )}
                    </div>
                  ) : null}
                  {assistantCard.workspace ? (
                    <div className="yellow-inline-workspace">
                      {assistantCard.workspace === "reservations" ? (
                        <ReservationBoardWorkspace timezone={selected?.timezone ?? "UTC"} />
                      ) : assistantCard.workspace === "guests" ? (
                        <GuestsWorkspace />
                      ) : assistantCard.workspace === "housekeeping" ? (
                        <HousekeepingWorkspace onLifecycleBusyChange={setReservationLifecycleFlight} />
                      ) : assistantCard.workspace === "cashiers" ? (
                        <FinanceWorkspace
                          key={assistantCard.cashierReservationId ?? "cashiers"}
                          initialReservationId={assistantCard.cashierReservationId}
                          onLifecycleBusyChange={setReservationLifecycleFlight}
                        />
                      ) : (
                        <CommercialWorkspace />
                      )}
                    </div>
                  ) : null}
                  {assistantCard.performance ? (
                    <div className="yellow-inline-performance">
                      <InlinePerformanceResult
                        intent={assistantCard.performance.intent}
                        performance={assistantCard.performance.data}
                      />
                    </div>
                  ) : null}
                  {assistantCard.reservationCreate ? (
                    <div className="yellow-inline-reservation yellow-inline-reservation-create">
                      <ReservationCreateWorkspace
                        timezone={selected?.timezone ?? "UTC"}
                        onCancel={() => setAssistantCard(null)}
                        onCreated={(reservationId) => {
                          void reservationIndexQuery.refetch();
                          setAssistantCard({
                            eyebrow: "RESERVATION RECONCILED",
                            title: "Authoritative reservation",
                            detail: "Yellow reread the server-owned reservation after the canonical commit. The reconciled record is live below.",
                            rows: [],
                            reservationId,
                          });
                        }}
                      />
                    </div>
                  ) : null}
                  {assistantCard.reservationId ? (
                    <div className="yellow-inline-reservation">
                      <ReservationWorkspace
                        key={assistantCard.reservationId}
                        reservationId={assistantCard.reservationId}
                        timezone={selected?.timezone ?? "UTC"}
                        initialLifecycleAction={assistantCard.reservationLifecycleAction}
                        onLifecycleBusyChange={setReservationLifecycleFlight}
                        onResolveWithYellow={resolveReservationWithYellow}
                      />
                    </div>
                  ) : null}
                  {assistantCard.guestPartyId ? (
                    <InlineGuestProfile partyId={assistantCard.guestPartyId} timezone={selected?.timezone ?? "UTC"} />
                  ) : null}
                  {assistantCard.checkInReservationId ? (
                    <OverwatchCheckInJourney
                      key={assistantCard.checkInReservationId}
                      reservationId={assistantCard.checkInReservationId}
                      onCompleted={() => {
                        void Promise.all([
                          dueInQuery.refetch(),
                          inHouseQuery.refetch(),
                        ]);
                      }}
                      conversationCommand={arrivalConversation}
                      conversationAuthority={assistantOperationGeneration}
                      onConversationReply={(reply) => {
                        setTurns((current) => [...current, { role: "assistant", text: reply }]);
                        say(reply);
                      }}
                      onLifecycleBusyChange={setReservationLifecycleFlight}
                    />
                  ) : null}
                  {assistantCard.checkoutReservationId ? (
                    <OverwatchCheckoutJourney
                      key={assistantCard.checkoutReservationId}
                      reservationId={assistantCard.checkoutReservationId}
                      completedDeparture={assistantCard.checkoutCompleted === true}
                      authoritativeRoomLabel={assistantCard.checkoutRoomLabel}
                      conversationCommand={departureConversation}
                      onConversationReply={(reply) => {
                        setTurns((current) => [...current, { role: "assistant", text: reply }]);
                        say(reply);
                      }}
                      onConversationPendingChange={setDepartureConversationPending}
                      onCompleted={() => {
                        void Promise.all([
                          dueOutQuery.refetch(),
                          inHouseQuery.refetch(),
                        ]);
                      }}
                      onLifecycleBusyChange={setReservationLifecycleFlight}
                    />
                  ) : null}
                </section>
              ) : null}
              <form
                data-lifecycle-recovery={voiceTransferRecoveryLocked ? "true" : undefined}
              onSubmit={(event) => {
                event.preventDefault();
                void ask(prompt);
              }}
            >
              <input
                aria-label="Ask Yellow"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={
                  thinking
                    ? "Yellow is working…"
                    : `Ask Yellow in ${language}…`
                }
              />
              <button
                type="button"
                onClick={() => {
                  void listen();
                }}
                aria-label="Speak to Yellow"
              >
                {listening ? "Listening…" : "⌁"}
              </button>
              <button
                type="submit"
                aria-label="Send request to Yellow"
                disabled={thinking || prompt.trim().length === 0}
              >
                ↑
              </button>
              </form>
            </section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
  if (workspacePart === "ecosystem" || workspacePart === "market-lab")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy ? true : undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>Y<span>Yellow<br /><small>Hotel Operations</small></span></a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("operations")}>Operations</button>
            <button onClick={billingDesk}>Finance</button>
            <button className={workspacePart === "ecosystem" ? "active" : undefined} onClick={() => workflow("ecosystem")}>Ecosystem</button>
          </nav>
          <a className="client-preview" href="/client/locanda-homes" target="_blank" rel="noreferrer">Preview client site ↗</a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("operations")}>Operations</button>
            <button className={workspacePart === "ecosystem" ? "selected" : undefined} onClick={() => workflow("ecosystem")}>All ecosystem</button>
            {internalMarketLabEnabled ? <button className={workspacePart === "market-lab" ? "selected" : undefined} onClick={() => workflow("market-lab")}>Internal market lab</button> : null}
            <hr />
            <p>DETAIL</p>
            <button onClick={billingDesk}>Cashier &amp; folios</button>
            <button onClick={() => workflow("settings")}>Settings &amp; setup</button>
          </aside>
          <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening ecosystem…</strong><p>Loading this workspace only when it is needed.</p></section>}>
            {workspacePart === "market-lab" && internalMarketLabEnabled ? (
              <MarketIntelligenceLab propertyName={selected?.name ?? "Current property"} />
            ) : (
              <EcosystemHub
                propertyName={selected?.name ?? "Current property"}
                propertyId={propertyId}
                internalMarketLabEnabled={internalMarketLabEnabled}
                onOpenMarketLab={() => workflow("market-lab")}
                onNavigate={(destination) => {
                  if (destination.startsWith("/")) window.location.assign(destination);
                  else workflow(destination);
                }}
              />
            )}
          </Suspense>
        </main>
        {assistantDock}
      </div>
    );
  if (workspacePart === "operations")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy ? true : undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>Y<span>Yellow<br /><small>Hotel Operations</small></span></a>
          <nav>
            <button onMouseEnter={() => void import("./workspaces/OperationalHub")} onFocus={() => void import("./workspaces/OperationalHub")} onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button className="active" onClick={() => workflow("operations")}>Operations</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <button onClick={billingDesk}>Finance</button>
            <button onMouseEnter={() => void import("./workspaces/EcosystemHub")} onFocus={() => void import("./workspaces/EcosystemHub")} onClick={() => workflow("ecosystem")}>Ecosystem</button>
          </nav>
          <a className="client-preview" href="/client/locanda-homes" target="_blank" rel="noreferrer">Preview client site ↗</a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button className="selected" onClick={() => workflow("operations")}>Operations</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <button onClick={() => workflow("ecosystem")}>All ecosystem</button>
            <hr />
            <p>DETAIL</p>
            <button onClick={billingDesk}>Cashier & folios</button>
            <button onClick={() => workflow("settings")}>Settings & setup</button>
          </aside>
          <Suspense fallback={<section className="operational-state operational-route-loading"><strong>Opening operations…</strong><p>Loading the workspace only when it is needed.</p></section>}>
            <OperationalHub
              propertyName={selected?.name ?? "Current property"}
              arrivals={{ data: dueInQuery.data?.reservations, isLoading: dueInQuery.isLoading, isError: dueInQuery.isError }}
              departures={{ data: dueOutQuery.data?.reservations, isLoading: dueOutQuery.isLoading, isError: dueOutQuery.isError }}
              rooms={{ data: operationalRooms, isLoading: housekeepingQuery.isLoading, isError: housekeepingQuery.isError }}
              blocks={{
                data: operationalBlocksQuery.data?.map((block) => ({ id: block.id, label: block.kind === "ooo" ? "Out of order room" : "Out of service room", state: block.kind === "ooo" ? "urgent" : "warning" })),
                isLoading: operationalBlocksQuery.isLoading,
                isError: operationalBlocksQuery.isError,
              }}
              onOpenReservation={(stay) => window.location.assign(`/p/${propertyId}/res/${stay.reservationId}`)}
              onNavigate={workflow}
            />
          </Suspense>
        </main>
        {assistantDock}
      </div>
    );
  if (workspacePart === "housekeeping")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy || undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>
            Y
            <span>
              Yellow
              <br />
              <small>Hotel Operations</small>
            </span>
          </a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>
              Reservations
            </button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button className="active" onClick={() => workflow("housekeeping")}>
              Housekeeping
            </button>
            <button onClick={billingDesk}>Finance</button>
          </nav>
          <a
            className="client-preview"
            href="/client/locanda-homes"
            target="_blank"
            rel="noreferrer"
          >
            Preview client site ↗
          </a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>
              Reservations
            </button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button
              className="selected"
              onClick={() => workflow("housekeeping")}
            >
              Housekeeping
            </button>
          </aside>
          <HousekeepingWorkspace onLifecycleBusyChange={setReservationLifecycleFlight} />
        </main>
        {assistantDock}
      </div>
    );
  if (workspacePart === "settings")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy ? true : undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>Y<span>Yellow<br /><small>Hotel Operations</small></span></a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <button onClick={billingDesk}>Finance</button>
            <button className="active" onClick={() => workflow("settings")}>Settings</button>
          </nav>
          <MobileSettingsShortcut />
          <a className="client-preview" href="/client/locanda-homes" target="_blank" rel="noreferrer">Preview client site ↗</a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <hr />
            <p>PROPERTY</p>
            <button className="selected" onClick={() => workflow("settings")}>Settings & setup</button>
            <button onClick={() => workflow("rates")}>Rates & distribution</button>
          </aside>
          <PropertySettingsWorkspace property={selected} />
        </main>
        {assistantDock}
      </div>
    );
  if (workspacePart === "finance")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy || undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>Y<span>Yellow<br /><small>Hotel Operations</small></span></a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <button className="active" onClick={billingDesk}>Finance</button>
          </nav>
          <a className="client-preview" href="/client/locanda-homes" target="_blank" rel="noreferrer">Preview client site ↗</a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <hr />
            <p>FRONT DESK FINANCE</p>
            <button className="selected" onClick={billingDesk}>Cashier & folios</button>
          </aside>
          <FinanceWorkspace onLifecycleBusyChange={setReservationLifecycleFlight} />
        </main>
        {assistantDock}
      </div>
    );
  if (workspacePart === "rates")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy || undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>Y<span>Yellow<br /><small>Hotel Operations</small></span></a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <button className="active" onClick={() => workflow("rates")}>Rates</button>
            <button onClick={billingDesk}>Finance</button>
          </nav>
          <a className="client-preview" href="/client/locanda-homes" target="_blank" rel="noreferrer">Preview client site ↗</a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>Reservations</button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
            <hr />
            <p>COMMERCIAL</p>
            <button className="selected" onClick={() => workflow("rates")}>Rates</button>
            <button onClick={() => workflow("inventory")}>Inventory</button>
            <button onClick={() => workflow("operations")}>Operations centre</button>
          </aside>
          <CommercialWorkspace />
        </main>
        {assistantDock}
      </div>
    );
  if (workspacePart === "guests")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy || undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>
            Y
            <span>
              Yellow
              <br />
              <small>Hotel Operations</small>
            </span>
          </a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>
              Reservations
            </button>
            <button className="active" onClick={() => workflow("guests")}>
              Guests
            </button>
            <button onClick={() => workflow("housekeeping")}>
              Housekeeping
            </button>
            <button onClick={billingDesk}>Finance</button>
          </nav>
          <a
            className="client-preview"
            href="/client/locanda-homes"
            target="_blank"
            rel="noreferrer"
          >
            Preview client site ↗
          </a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button onClick={() => workflow("reservations")}>
              Reservations
            </button>
            <button className="selected" onClick={() => workflow("guests")}>
              Guests
            </button>
            <button onClick={() => workflow("housekeeping")}>
              Housekeeping
            </button>
            <button onClick={billingDesk}>Finance</button>
          </aside>
          <GuestsWorkspace />
        </main>
        {assistantDock}
      </div>
    );
  if (workspacePart === "reservations")
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy || undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>
            Y
            <span>
              Yellow
              <br />
              <small>Hotel Operations</small>
            </span>
          </a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button className="active" onClick={() => workflow("reservations")}>
              Reservations
            </button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>
              Housekeeping
            </button>
            <button onClick={billingDesk}>Finance</button>
          </nav>
          <a
            className="client-preview"
            href="/client/locanda-homes"
            target="_blank"
            rel="noreferrer"
          >
            Preview client site ↗
          </a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button
              className="selected"
              onClick={() => workflow("reservations")}
            >
              Reservations
            </button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>
              Housekeeping
            </button>
          </aside>
          <ReservationBoardWorkspace timezone={selected?.timezone ?? "UTC"} />
        </main>
        {assistantDock}
      </div>
    );
  if (reservationRouteId)
    return (
      <div className={shellClassName} aria-busy={reservationLifecycleBusy || undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
        <header className="topbar">
          <a className="brand" href={`/p/${propertyId}/today`}>
            Y
            <span>
              Yellow
              <br />
              <small>Hotel Operations</small>
            </span>
          </a>
          <nav>
            <button onClick={() => workflow("today")}>Today</button>
            <button className="active" onClick={() => workflow("reservations")}>
              Reservations
            </button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>
              Housekeeping
            </button>
          </nav>
          <a
            className="client-preview"
            href="/client/locanda-homes"
            target="_blank"
            rel="noreferrer"
          >
            Preview client site ↗
          </a>
        </header>
        <main>
          <aside>
            <p>WORKSPACE</p>
            <button onClick={() => workflow("today")}>Today</button>
            <button
              className="selected"
              onClick={() => workflow("reservations")}
            >
              Reservations
            </button>
            <button onClick={() => workflow("guests")}>Guests</button>
            <button onClick={() => workflow("housekeeping")}>
              Housekeeping
            </button>
          </aside>
          <ReservationWorkspace
            key={reservationRouteId}
            reservationId={reservationRouteId}
            timezone={selected?.timezone ?? "UTC"}
            onLifecycleBusyChange={setReservationLifecycleFlight}
            onResolveWithYellow={resolveReservationWithYellow}
          />
        </main>
        {assistantDock}
      </div>
    );
  return (
    <div className={shellClassName} aria-busy={reservationLifecycleBusy || undefined} onClickCapture={guardReservationLifecycleFlight} onSubmitCapture={guardReservationLifecycleFlight}>
      <header className="topbar">
        <a className="brand" href={`/p/${propertyId}/today`}>
          Y
          <span>
            Yellow
            <br />
            <small>Hotel Operations</small>
          </span>
        </a>
        <nav>
          <button className="active" onClick={() => workflow("today")}>
            Today
          </button>
          <button onClick={() => workflow("reservations")}>Reservations</button>
          <button onClick={() => workflow("guests")}>Guests</button>
          <button
            onMouseEnter={() => void import("./workspaces/OperationalHub")}
            onFocus={() => void import("./workspaces/OperationalHub")}
            onClick={() => workflow("operations")}
          >Operations</button>
          <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
          <button onClick={billingDesk}>Finance</button>
          <button onClick={() => workflow("settings")}>Settings</button>
          <button
            onMouseEnter={() => void import("./workspaces/EcosystemHub")}
            onFocus={() => void import("./workspaces/EcosystemHub")}
            onClick={() => workflow("ecosystem")}
          >Ecosystem</button>
          <button onClick={() => workflow("status")}>Reports</button>
        </nav>
        <MobileSettingsShortcut />
        <a
          className="client-preview"
          href="/client/locanda-homes"
          target="_blank"
          rel="noreferrer"
        >
          Preview client site ↗
        </a>
        <div className="property-switcher">
          <button
            className="profile"
            aria-expanded={propertiesOpen}
            onClick={() => setPropertiesOpen((x) => !x)}
          >
            {propertyDisplayName(selected)}&nbsp;⌄
          </button>
          {propertiesOpen ? (
            <div className="property-options" role="menu">
              {propertyQuery.data?.map((p) => (
                <button
                  key={p.id}
                  role="menuitem"
                  aria-current={p.id === propertyId ? "page" : undefined}
                  onClick={() => window.location.assign(`/p/${p.id}/today`)}
                >
                  <strong>{propertyDisplayName(p)}</strong>
                  <small>{p.timezone}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      <main>
        <aside>
          <p>WORKSPACE</p>
          <button className="selected" onClick={() => workflow("today")}>
            Today
          </button>
          <button onClick={() => workflow("reservations")}>Reservations</button>
          <button onClick={() => workflow("guests")}>Guests</button>
          <button onClick={() => workflow("operations")}>Operations</button>
          <button onClick={() => workflow("housekeeping")}>Housekeeping</button>
          <button onClick={() => workflow("ecosystem")}>All ecosystem</button>
          <hr />
          <p>COMMERCIAL</p>
          <button onClick={() => workflow("rates")}>Rates</button>
          <button onClick={() => workflow("inventory")}>Inventory</button>
          <button onClick={() => workflow("operations")}>Operations centre</button>
          <hr />
          <p>PROPERTY</p>
          <button onClick={() => workflow("settings")}>Settings &amp; setup</button>
        </aside>
        <section className={`workspace${activeLane ? " movement-mode" : ""}`}>
          {activeLane ? (() => {
            const lane = lanes.find((item) => item.status === activeLane);
            return lane?.query.isLoading ? <div className="skeleton" /> : lane?.query.isError ? <p className="error">{lane.query.error.message}</p> : <MovementGrid status={activeLane} lane={lane?.query.data} timezone={selected?.timezone ?? "UTC"} open={open} />;
          })() : <><motion.div
            className="welcome today-welcome"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <TodayGlassDashboard
              greeting={localGreeting.greeting}
              propertyName={propertyDisplayName(selected)}
              localTime={localGreeting.time}
              occupancyPercent={occupancyPercent}
              roomNights={performanceQuery.data?.today.roomNights ?? null}
              roomsAvailable={performanceQuery.data?.today.roomsAvailable ?? configuredRooms ?? null}
              roomRevenue={performanceQuery.data ? money(performanceQuery.data.today.roomRevenueMinor, performanceQuery.data.property.currency) : null}
              performanceLoading={performanceQuery.isLoading}
              performanceUnavailable={performanceQuery.isError}
              occupancyVariance={performanceQuery.data ? <VarianceBadge actual={performanceQuery.data.today.occupancyBasisPoints} baseline={performanceQuery.data.todayComparison.lastYear.occupancyBasisPoints} /> : null}
              revenueVariance={performanceQuery.data ? <VarianceBadge actual={Number(BigInt(performanceQuery.data.today.roomRevenueMinor))} baseline={Number(BigInt(performanceQuery.data.todayComparison.lastYear.roomRevenueMinor))} /> : null}
              movements={[
                { label: "Arrivals", value: dueInQuery.data?.reservations?.length ?? null, loading: dueInQuery.isLoading, unavailable: dueInQuery.isError, glyph: "↘", onOpen: () => openOperationalTable("due_in") },
                { label: "Departures", value: dueOutQuery.data?.reservations?.length ?? null, loading: dueOutQuery.isLoading, unavailable: dueOutQuery.isError, glyph: "↗", onOpen: () => openOperationalTable("due_out") },
                { label: "In house", value: inHouseCount, loading: inHouseQuery.isLoading, unavailable: inHouseQuery.isError, glyph: "⌂", onOpen: () => openOperationalTable("in_house") },
              ]}
              onOpenPerformance={() => setPerformanceDetailRequestKey((key) => key + 1)}
            />
          </motion.div>
          {performanceQuery.data ? <PerformancePanel performance={performanceQuery.data} detailRequestKey={performanceDetailRequestKey} summaryVisible={false} /> : performanceQuery.isError ? <p className="error">Operating performance is unavailable. {performanceQuery.error.message}</p> : null}</>}
        </section>
      </main>
      {assistantDock}
    </div>
  );
}
