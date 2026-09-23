import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as AppRuntime from "../yellow-api";
import { collectReservationBoardPages, operationalStateDescription, operationalStateLabel } from "../reservation-board";
import { RESERVATION_BOARD_CAPABILITIES, createMovementQuery, filterAndSortMovementRows, movementGuestAttributes, movementNights, type MovementQuery, type MovementSortKey } from "../today-workspace";
import { arrivalCleaningAttendantIntent, housekeepingTaskActionIntent, resolveArrivalCleaningAttendant, reservationVoiceAction, type ReservationQueryContext, type VoiceLanguage } from "../voice";
import type { ReservationDetail, Stay, CheckoutReadiness, CheckInReadiness, DueInRoomCandidate, ArrivalCleaningCandidate, HousekeepingTask, HousekeepingTaskAction, ReservationGuestDraft, ReservationGuestReplacement, ReservationOffer, CreatedReservation, PartyProfile, Lane, FolioStatement, FolioChargeOption, FolioTransferPreview, FolioTransferDraft, CashierSnapshot, Property, PerformanceMetric, OperatingPerformance, ReservationOperationalFields, ArrivalConversationCommand, ArrivalConversationProposal, DueInRoomAssignmentInput, DepartureServiceKind, DepartureServiceRequest, DepartureServiceTiming } from "../yellow-api";

type Status = "due_in" | "due_out" | "in_house";
const routeMatch = /^\/p\/([^/]+)(?:\/res\/([^/]+))?(?:\/[^/]*)?$/.exec(window.location.pathname);
const propertyId = routeMatch?.[1] ?? "6081b544-22a1-534f-a86d-bb1ae0519e14";
const pageSearch = new URLSearchParams(window.location.search);
const requestedGuestSearch = pageSearch.get("guest")?.trim() ?? "";
const initialGuestSearch = requestedGuestSearch.length >= 2 ? requestedGuestSearch : "";
const nameOf = (stay: Stay): string => stay.primaryGuestDisplayName ?? stay.primaryPartyName ?? stay.confirmationNo;
const money = (minor: string, currency: string): string => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(BigInt(minor)) / 100);
const moneyExactMinor = (minor: string, currency: string): string => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(BigInt(minor)) / 100);
export const reservationStatusLabel = (status: string): string => {
  if (status === "due_in") return "Expected arrival";
  if (status === "due_out") return "Departure today";
  if (status === "in_house") return "In house";
  if (status === "checked_out") return "Departed history";
  return status.replaceAll("_", " ");
};
export const reservationStatusDescription = (status: string): string => {
  if (status === "due_in") return "Due in · expected arrival";
  if (status === "due_out") return "Due out · departure today";
  if (status === "in_house") return "In house · occupied";
  if (status === "checked_out") return "Checked out · departed history";
  return reservationStatusLabel(status);
};
export function checkInBlockerCopy(blocker: string): Readonly<{ title: string; detail: string; tone: "attention" | "neutral" }> {
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
const titleOf = (status: string): string => status === "due_in" ? "Arrivals" : status === "due_out" ? "Departures" : status === "in_house" ? "In house" : "Reservations";
type OperationalTimelineEntry = Readonly<{
  id: string;
  kind: "party" | "reservation" | "segment" | "room" | "folio" | "posting" | "message" | "task" | "event";
  label: string;
  summary: string;
  occurredAt: string | null;
  businessDate: string | null;
  canonical: readonly Readonly<{ label: string; value: string }>[];
  unavailable?: string;
  returnTarget?: string;
}>;

function timelineTime(entry: OperationalTimelineEntry, timezone: string): string {
  if (entry.occurredAt) return formatMovementTime(entry.occurredAt, timezone, true);
  if (entry.businessDate) return `Business date ${entry.businessDate}`;
  return "Time unavailable";
}

function compareTimelineEntries(a: OperationalTimelineEntry, b: OperationalTimelineEntry): number {
  const left = a.occurredAt ? Date.parse(a.occurredAt) : Number.NaN;
  const right = b.occurredAt ? Date.parse(b.occurredAt) : Number.NaN;
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return right - left;
  if (Number.isFinite(left) !== Number.isFinite(right)) return Number.isFinite(left) ? -1 : 1;
  return a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
}

function reservationOperationalTimeline(
  reservation: ReservationDetail["reservation"],
  statements: readonly FolioStatement[],
  statementsReady: boolean,
): readonly OperationalTimelineEntry[] {
  const entries: OperationalTimelineEntry[] = [{
    id: `reservation-${reservation.reservationId}`,
    kind: "reservation",
    label: `${reservation.confirmationNo} · ${reservation.status.replaceAll("_", " ")}`,
    summary: "Canonical reservation shell, commercial attribution and lifecycle status.",
    occurredAt: reservation.createdAt,
    businessDate: null,
    canonical: [
      { label: "Reservation ID", value: reservation.reservationId },
      { label: "Confirmation", value: reservation.confirmationNo },
      { label: "Primary Party ID", value: reservation.primaryPartyId },
      { label: "Market/Source", value: [reservation.marketCode, reservation.sourceCode, reservation.originCode].filter(Boolean).join(" / ") || "Not recorded" },
    ],
    returnTarget: "reservation",
  }];
  for (const guest of reservation.guests) {
    entries.push({
      id: `party-${guest.partyId}-${guest.role}`,
      kind: "party",
      label: `${guest.displayName} · ${guest.role}`,
      summary: "Guest identity is linked by Party ID; duplicate names remain separate records.",
      occurredAt: reservation.createdAt,
      businessDate: null,
      canonical: [
        { label: "Party ID", value: guest.partyId },
        { label: "Reservation ID", value: reservation.reservationId },
        { label: "Role", value: guest.role },
        { label: "Share", value: guest.sharePct ?? "Not recorded" },
      ],
      returnTarget: "guests",
    });
  }
  for (const segment of reservation.segments) {
    entries.push({
      id: `segment-${segment.segmentId}`,
      kind: "segment",
      label: `Segment ${segment.sequence} · ${segment.status.replaceAll("_", " ")}`,
      summary: `${segment.adults} adult${segment.adults === 1 ? "" : "s"} · ${segment.sellableUnitId ? "assigned room" : "unassigned room"}.`,
      occurredAt: segment.from,
      businessDate: segment.from.slice(0, 10),
      canonical: [
        { label: "Segment ID", value: segment.segmentId },
        { label: "Unit type ID", value: segment.unitTypeId },
        { label: "Sellable unit ID", value: segment.sellableUnitId ?? "Unavailable" },
        { label: "Rate plan ID", value: segment.ratePlanId },
      ],
      returnTarget: "stay",
    });
    if (segment.sellableUnitId) {
      entries.push({
        id: `room-${segment.segmentId}-${segment.sellableUnitId}`,
        kind: "room",
        label: `Room assignment · segment ${segment.sequence}`,
        summary: "Room continuity is tied to the segment and sellable-unit IDs, not display text.",
        occurredAt: segment.from,
        businessDate: segment.from.slice(0, 10),
        canonical: [
          { label: "Reservation ID", value: reservation.reservationId },
          { label: "Segment ID", value: segment.segmentId },
          { label: "Sellable unit ID", value: segment.sellableUnitId },
        ],
        returnTarget: "stay",
      });
    }
  }
  for (const folio of reservation.folios) {
    const statement = statements.find((item) => item.folio.id === folio.folioId);
    entries.push({
      id: `folio-${folio.folioId}`,
      kind: "folio",
      label: `${folio.folioNo ?? "Unnumbered folio"} · window ${folio.windowNo}`,
      summary: `${folio.name ?? "Unnamed bill window"} · ${folio.status}.`,
      occurredAt: null,
      businessDate: null,
      canonical: [
        { label: "Folio ID", value: folio.folioId },
        { label: "Account ID", value: folio.accountId },
        { label: "Window", value: String(folio.windowNo) },
        { label: "Statement generation", value: statement?.generation ?? "Unavailable until statement read completes" },
      ],
      unavailable: !statementsReady ? "Posting rows load through the governed folio statement read; this timeline will not invent them." : undefined,
      returnTarget: "finance",
    });
    for (const row of statement?.rows ?? []) {
      entries.push({
        id: `posting-${row.lineId}`,
        kind: "posting",
        label: `${row.txCode} · ${row.kind}`,
        summary: `${row.description ?? "No description"} · ${row.amountMinor} ${statement.folio.currency}.`,
        occurredAt: null,
        businessDate: row.businessDate,
        canonical: [
          { label: "Posting line ID", value: row.lineId },
          { label: "Journal ID", value: row.journalId },
          { label: "Folio ID", value: folio.folioId },
          { label: "Transfer group", value: row.transferGroup.id },
        ],
        returnTarget: "finance",
      });
    }
  }
  for (const alert of reservation.alerts) {
    entries.push({
      id: `message-${alert.alertId}`,
      kind: "message",
      label: alert.code ?? "Operational alert",
      summary: `${alert.active ? "Active" : "Inactive"} · show on ${alert.showOn}: ${alert.message}`,
      occurredAt: null,
      businessDate: null,
      canonical: [
        { label: "Alert ID", value: alert.alertId },
        { label: "Reservation ID", value: reservation.reservationId },
      ],
      returnTarget: "reservation",
    });
  }
  for (const travel of reservation.travel) {
    const travelLabel = `${travel.direction} travel · ${travel.mode ?? "mode unavailable"}`;
    entries.push({
      id: `event-travel-${travel.travelId}`,
      kind: "event",
      label: travelLabel,
      summary: `${[travel.carrier, travel.serviceNo].filter(Boolean).join(" ") || "Carrier/service unavailable"} · ${travel.pickupRequested ? "pickup requested" : "no pickup requested"}.`,
      occurredAt: travel.scheduledAt,
      businessDate: travel.scheduledAt?.slice(0, 10) ?? null,
      canonical: [
        { label: "Travel ID", value: travel.travelId },
        { label: "Reservation ID", value: reservation.reservationId },
      ],
      returnTarget: "stay",
    });
    if (travel.pickupTaskId) {
      entries.push({
        id: `task-${travel.pickupTaskId}`,
        kind: "task",
        label: `${travel.direction} pickup task`,
        summary: "Linked task surfaced from reservation travel; task details remain governed by the task read endpoint.",
        occurredAt: travel.scheduledAt,
        businessDate: travel.scheduledAt?.slice(0, 10) ?? null,
        canonical: [
          { label: "Task ID", value: travel.pickupTaskId },
          { label: "Travel ID", value: travel.travelId },
          { label: "Reservation ID", value: reservation.reservationId },
        ],
        returnTarget: "tasks",
      });
    }
  }
  for (const fact of reservation.history) {
    entries.push({
      id: `event-${fact.factId}`,
      kind: "event",
      label: fact.factType.replaceAll("_", " "),
      summary: "Authoritative fact-log event retained with property-local business date.",
      occurredAt: fact.recordedAt,
      businessDate: fact.businessDate,
      canonical: [
        { label: "Fact ID", value: fact.factId },
        { label: "Valid from", value: fact.validFrom },
        { label: "Valid to", value: fact.validTo ?? "Current" },
      ],
      returnTarget: "history",
    });
  }
  return Object.freeze(entries.sort(compareTimelineEntries));
}

function OperationalTimeline({ entries, timezone }: Readonly<{ entries: readonly OperationalTimelineEntry[]; timezone: string }>) {
  const compact = entries.slice(0, 18);
  return (
    <article className="detail-card detail-card-wide operational-timeline-card">
      <div className="timeline-heading">
        <div>
          <span className="state">SHARED TIMELINE</span>
          <h2>Operational timeline</h2>
          <p>One read-only chain across guest, stay, room, folio, posting, task, message and event context. Links use canonical IDs only.</p>
        </div>
        <span className="timeline-count">{entries.length} records</span>
      </div>
      <ol className="operational-timeline">
        {compact.map((entry) => (
          <li key={entry.id} className={`timeline-entry timeline-${entry.kind}`}>
            <div className="timeline-marker" aria-hidden="true">{entry.kind.slice(0, 1).toUpperCase()}</div>
            <div className="timeline-body">
              <div className="timeline-row">
                <strong>{entry.label}</strong>
                <span>{timelineTime(entry, timezone)}</span>
              </div>
              <p>{entry.summary}</p>
              {entry.unavailable ? <p className="timeline-unavailable">{entry.unavailable}</p> : null}
              <details>
                <summary>Canonical evidence</summary>
                <dl>
                  {entry.canonical.map((item) => (
                    <div key={`${entry.id}-${item.label}`}>
                      <dt>{item.label}</dt>
                      <dd><code>{item.value}</code></dd>
                    </div>
                  ))}
                  <div>
                    <dt>Return target</dt>
                    <dd>{entry.returnTarget ?? "timeline"}</dd>
                  </div>
                </dl>
              </details>
            </div>
          </li>
        ))}
      </ol>
      {entries.length > compact.length ? <p className="timeline-unavailable">Showing the latest {compact.length} timeline records. Open the target workspace for the complete bounded list.</p> : null}
    </article>
  );
}

function housekeepingActionCopy(action: HousekeepingTaskAction): Readonly<{ button: string; statement: string; outcome: string }> {
  if (action === "start") return { button: "Start cleaning", statement: "A granted operator records the staff declaration that physical cleaning has begun.", outcome: "The task will become in progress; room condition will remain unchanged." };
  if (action === "complete") return { button: "Mark physically clean", statement: "A granted operator records the staff declaration that physical cleaning is complete.", outcome: "The task will become done and the room condition will become clean." };
  return { button: "Verify inspected", statement: "A granted supervisor records the staff declaration that the clean room was physically inspected.", outcome: "The task will become verified and the room condition will become inspected." };
}
const { session, loadReservation, loadCheckInReadiness, loadCheckoutReadiness, commitCheckIn, commitCheckout, openPrimaryFolio, transitionFolioStatus, loadDueInRoomCandidates, assignDueInRoom, loadArrivalCleaningCandidate, createArrivalCleaningTask, loadReservationBoard, loadGroupBlocks, loadLane, loadProperties, loadPartyStayHistory, searchPartyProfiles, searchReservationOffers, commitReservation, duplicatePartyEvidence, reservationMatchesCreateReceipt, sameReservationOffer, ReservationCommandRequestError, cancelReservationLifecycle, reinstateReservationLifecycle, ReservationLifecycleRequestError, loadHousekeeping, loadHousekeepingTask, transitionHousekeepingTask, loadOperationalBlocks, loadCommercialSnapshot, loadOperatingPerformance, loadPropertySettings, loadCashierSnapshot, loadFolioStatement, postFolioCharge, requestFolioTransferPreview, previewMatchesFolioTransferDraft, submitFolioTransfer, receiptMatchesVoiceTransfer, resolveVoiceTransferGroup, exactObject, validateFolioChargeReceipt, validateFolioTransferEffect, validateFolioTransferPreview, sameTransferPreview, validateHousekeepingTask, housekeepingTaskMatchesProposal, validateHousekeepingTransitionReceipt, housekeepingTaskReflectsAction, housekeepingFailureIsUncertain, isHousekeepingAction, isCanonicalInstant, reservationApiError, childAgesFrom, propertyLocalDate, propertyLocalDateTimeToIso, normalizeReservationOperationalValue, modifyReservationOperationalDetails, parseGuestShareBasisPoints, reservationGuestAllocationsMatch, reservationGuestReplacementFromDetail, normaliseGuestLookup, replaceReservationGuests, FolioChargeRequestError, FolioTransferRequestError, PrimaryFolioRequestError, GovernedCheckoutRequestError, loadDepartureServices, createDepartureServiceProposal, transitionDepartureService } = AppRuntime;
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

function ReservationWorkspace({
  reservationId,
  timezone,
  initialLifecycleAction,
  onLifecycleBusyChange,
  onResolveWithYellow,
}: Readonly<{
  reservationId: string;
  timezone: string;
  initialLifecycleAction?: "cancel" | "reinstate" | "no_show";
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
  const timelineFolios = detail.data?.reservation.folios ?? [];
  const timelineStatementQueries = useQueries({
    queries: timelineFolios.map((folio) => ({
      queryKey: ["reservation-operational-timeline-folio", propertyId, reservationId, folio.folioId],
      queryFn: () => loadFolioStatement(folio.folioId),
      enabled: Boolean(detail.data?.reservation),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always" as const,
      retry: 1,
    })),
  });
  const [checkInConfirmed, setCheckInConfirmed] = useState(false);
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [checkInPosting, setCheckInPosting] = useState(false);
  const [checkoutPosting, setCheckoutPosting] = useState(false);
  const checkoutAttempt = useRef(`yellow-checkout-${crypto.randomUUID()}`);
  const [folioConfirmed, setFolioConfirmed] = useState(false);
  const [folioPosting, setFolioPosting] = useState(false);
  const [folioMessage, setFolioMessage] = useState<string | null>(null);
  const folioAttempt = useRef(`yellow-reservation-folio-${crypto.randomUUID()}`);
  const [lifecycleMode, setLifecycleMode] = useState<"cancel" | "reinstate" | "no_show" | null>(initialLifecycleAction ?? null);
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
  const lifecycleBaseline = useRef<{
    status: string;
    canCancel: boolean;
    canReinstate: boolean;
    cancelledAt: string | null;
    cancelReason: string | null;
    cancellationNo: string | null;
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
    setLifecycleMode(initialLifecycleAction ?? null);
    setLifecycleConfirmed(false);
    setLifecycleMessage(null);
    setLifecycleError(null);
    lifecycleAttempt.current = null;
    lifecycleBaseline.current = null;
  }, [initialLifecycleAction, reservationId]);
  useEffect(() => {
    const current = detail.data;
    if (!initialLifecycleAction || !current || lifecycleBaseline.current) return;
    lifecycleBaseline.current = {
      status: current.reservation.status,
      canCancel: current.actions.canCancel,
      canReinstate: current.actions.canReinstate,
      cancelledAt: current.reservation.cancelledAt,
      cancelReason: current.reservation.cancelReason,
      cancellationNo: current.reservation.cancellationNo,
    };
  }, [detail.data, initialLifecycleAction]);
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
  const timelineStatements = timelineStatementQueries.flatMap((query) => query.data ? [query.data] : []);
  const timelineStatementsReady = timelineStatementQueries.every((query) => query.isSuccess);
  const operationalTimeline = useMemo(
    () => reservationOperationalTimeline(reservation, timelineStatements, timelineStatementsReady),
    [reservation, timelineStatements, timelineStatementsReady],
  );
  const ready = readiness.data?.canCheckIn === true;
  const departureReady = departure.data?.ready === true;
  const isArrival = reservation.status === "due_in";
  const isDeparture =
    reservation.status === "in_house" || reservation.status === "due_out";
  const canCancel = detail.data.actions.canCancel;
  const canReinstate = detail.data.actions.canReinstate;
  const cancelBlocker = canCancel ? null : `Cancellation is unavailable while the authoritative status is ${reservationStatusLabel(reservation.status)}.`;
  const reinstateBlocker = canReinstate ? null : `Reinstatement is unavailable while the authoritative status is ${reservationStatusLabel(reservation.status)}.`;
  const noShowBlocker = "No operator command exists. No-show is assigned only by the governed property day-roll process.";
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
  const chooseLifecycleAction = (mode: "cancel" | "reinstate" | "no_show") => {
    if (lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting) return;
    setLifecycleMode(mode);
    setLifecycleConfirmed(false);
    setLifecycleMessage(null);
    setLifecycleError(null);
    lifecycleBaseline.current = {
      status: reservation.status,
      canCancel,
      canReinstate,
      cancelledAt: reservation.cancelledAt,
      cancelReason: reservation.cancelReason,
      cancellationNo: reservation.cancellationNo,
    };
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
    if (lifecycleMode === "no_show") {
      setLifecycleError("Mark no-show is owned by the property day-roll process. This operator screen cannot perform that transition.");
      return;
    }
    const reason = cancellationReason.trim();
    if (lifecycleMode === "cancel" && reason.trim().length === 0) {
      setLifecycleError("Enter a cancellation reason before confirming.");
      return;
    }
    const baseline = lifecycleBaseline.current ?? {
      status: reservation.status,
      canCancel,
      canReinstate,
      cancelledAt: reservation.cancelledAt,
      cancelReason: reservation.cancelReason,
      cancellationNo: reservation.cancellationNo,
    };
    const beforeWrite = await detail.refetch().catch(() => null);
    if (!beforeWrite || beforeWrite.isError || !beforeWrite.data) {
      setLifecycleConfirmed(false);
      setLifecycleError("Yellow could not recheck the authoritative reservation before writing. Nothing was changed; refresh and review again.");
      return;
    }
    const currentBeforeWrite = beforeWrite.data;
    const drifted =
      currentBeforeWrite.reservation.status !== baseline.status ||
      currentBeforeWrite.actions.canCancel !== baseline.canCancel ||
      currentBeforeWrite.actions.canReinstate !== baseline.canReinstate ||
      currentBeforeWrite.reservation.cancelledAt !== baseline.cancelledAt ||
      currentBeforeWrite.reservation.cancelReason !== baseline.cancelReason ||
      currentBeforeWrite.reservation.cancellationNo !== baseline.cancellationNo;
    if (drifted) {
      setLifecycleConfirmed(false);
      lifecycleAttempt.current = null;
      lifecycleBaseline.current = {
        status: currentBeforeWrite.reservation.status,
        canCancel: currentBeforeWrite.actions.canCancel,
        canReinstate: currentBeforeWrite.actions.canReinstate,
        cancelledAt: currentBeforeWrite.reservation.cancelledAt,
        cancelReason: currentBeforeWrite.reservation.cancelReason,
        cancellationNo: currentBeforeWrite.reservation.cancellationNo,
      };
      setLifecycleError("The reservation changed after this proposal was opened. Nothing was written; review the refreshed state and confirm again.");
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
    const authoritativeEffectMatches = (
      current: ReservationDetail | undefined,
      expectedStatus: "cancelled" | "reserved",
      expectedCancellation?: Readonly<{ cancellationNo: string; cancelledAt: string }>,
    ) => {
      const fresh = current?.reservation;
      if (!fresh || fresh.reservationId !== reservationId || fresh.status !== expectedStatus) return false;
      if (expectedStatus === "cancelled") {
        return fresh.cancelReason === reason &&
          typeof fresh.cancellationNo === "string" && fresh.cancellationNo.length > 0 &&
          typeof fresh.cancelledAt === "string" && fresh.cancelledAt.length > 0 &&
          (!expectedCancellation ||
            (fresh.cancellationNo === expectedCancellation.cancellationNo && fresh.cancelledAt === expectedCancellation.cancelledAt));
      }
      return fresh.cancelReason === null && fresh.cancellationNo === null && fresh.cancelledAt === null;
    };
    const refreshCanonicalState = async (
      expectedStatus: "cancelled" | "reserved",
      expectedCancellation?: Readonly<{ cancellationNo: string; cancelledAt: string }>,
    ) => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
      const refreshed = await detail.refetch();
      if (refreshed.isError || !authoritativeEffectMatches(refreshed.data, expectedStatus, expectedCancellation))
        throw new Error(
          "The server response was received, but the refreshed reservation evidence is not yet authoritative. Retry this unchanged action to reconcile safely.",
        );
    };
    const lifecycleSuccessMessage = (reconciled: boolean) =>
      lifecycleMode === "cancel"
        ? `Reservation cancelled${reconciled ? " and reconciled after an uncertain response" : ""}. The refreshed record shows the server-issued cancellation evidence.`
        : `Reservation reinstated${reconciled ? " and reconciled after an uncertain response" : ""} after the server rechecked occupancy. The refreshed record is authoritative.`;
    try {
      if (lifecycleMode === "cancel") {
        const receipt = await cancelReservationLifecycle(reservationId, reason, attempt.key);
        if (receipt.previousStatus !== baseline.status)
          throw new ReservationLifecycleRequestError("The cancellation receipt does not match the reviewed starting state.", true, 200);
        await refreshCanonicalState("cancelled", { cancellationNo: receipt.cancellationNo, cancelledAt: receipt.cancelledAt });
      } else {
        const receipt = await reinstateReservationLifecycle(reservationId, attempt.key);
        if (receipt.previousStatus !== baseline.status)
          throw new ReservationLifecycleRequestError("The reinstatement receipt does not match the reviewed starting state.", true, 200);
        await refreshCanonicalState("reserved");
      }
      setLifecycleConfirmed(false);
      setLifecycleMessage(lifecycleSuccessMessage(false));
    } catch (error) {
      const uncertain = error instanceof ReservationLifecycleRequestError ? error.uncertain : true;
      if (!uncertain) {
        setLifecycleError(error instanceof Error ? error.message : "The reservation lifecycle action was rejected.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });
      const refreshed = await detail.refetch().catch(() => null);
      if (isArrival) await readiness.refetch().catch(() => undefined);
      if (isDeparture) await departure.refetch().catch(() => undefined);
      const expectedStatus = lifecycleMode === "cancel" ? "cancelled" : "reserved";
      if (refreshed && !refreshed.isError && authoritativeEffectMatches(refreshed.data, expectedStatus)) {
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
      await commitCheckout(reservationId, checkoutAttempt.current);
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
        <OperationalTimeline entries={operationalTimeline} timezone={timezone} />
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
        <article className="detail-card detail-card-wide reservation-lifecycle-card">
            <span className="state">RESERVATION LIFECYCLE</span>
            <h2>Governed status actions</h2>
            <p>
              Review every action against the current server record. Yellow never
              changes reservation or occupancy state only in the browser.
            </p>
            <div className="reservation-lifecycle-actions" aria-label="Reservation status actions">
              <section className={canCancel ? "lifecycle-action available" : "lifecycle-action unavailable"}>
                <button
                  type="button"
                  className={lifecycleMode === "cancel" ? "selected" : "quiet"}
                  disabled={!canCancel || lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting}
                  onClick={() => chooseLifecycleAction("cancel")}
                >
                  Cancel reservation
                </button>
                <span>{canCancel ? "Available now" : cancelBlocker}</span>
              </section>
              <section className={canReinstate ? "lifecycle-action available" : "lifecycle-action unavailable"}>
                <button
                  type="button"
                  className={lifecycleMode === "reinstate" ? "selected" : "quiet"}
                  disabled={!canReinstate || lifecyclePosting || operationalPosting || guestAllocationPosting || checkInPosting || checkoutPosting}
                  onClick={() => chooseLifecycleAction("reinstate")}
                >
                  Reinstate reservation
                </button>
                <span>{canReinstate ? "Available now" : reinstateBlocker}</span>
              </section>
              <section className="lifecycle-action unavailable">
                <button
                  type="button"
                  className={lifecycleMode === "no_show" ? "selected" : "quiet"}
                  disabled
                  aria-describedby="no-show-authority"
                >
                  Mark no-show
                </button>
                <span id="no-show-authority">{noShowBlocker}</span>
              </section>
            </div>
            {lifecycleMode === "cancel" && canCancel ? (
              <div className="reservation-lifecycle-confirmation">
                <div className="reservation-lifecycle-evidence">
                  <span><small>Guest</small><strong>{primaryGuest?.displayName ?? reservation.primaryPartyId}</strong></span>
                  <span><small>Confirmation</small><strong>{reservation.confirmationNo}</strong></span>
                  <span><small>Current state</small><strong>{reservationStatusLabel(reservation.status)}</strong></span>
                  <span><small>Requested state</small><strong>Cancelled</strong></span>
                </div>
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
                <p><strong>Consequence:</strong> the server evaluates policy, issues cancellation evidence, and releases only eligible occupancy through the governed command.</p>
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
                <div className="reservation-lifecycle-evidence">
                  <span><small>Guest</small><strong>{primaryGuest?.displayName ?? reservation.primaryPartyId}</strong></span>
                  <span><small>Confirmation</small><strong>{reservation.confirmationNo}</strong></span>
                  <span><small>Current state</small><strong>{reservationStatusLabel(reservation.status)}</strong></span>
                  <span><small>Requested state</small><strong>Reserved</strong></span>
                </div>
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
            {lifecycleMode === "no_show" ? (
              <div className="reservation-lifecycle-confirmation unsupported" role="status">
                <div className="reservation-lifecycle-evidence">
                  <span><small>Guest</small><strong>{primaryGuest?.displayName ?? reservation.primaryPartyId}</strong></span>
                  <span><small>Confirmation</small><strong>{reservation.confirmationNo}</strong></span>
                  <span><small>Current state</small><strong>{reservationStatusLabel(reservation.status)}</strong></span>
                  <span><small>Requested state</small><strong>No-show</strong></span>
                </div>
                <p><strong>Blocked:</strong> {noShowBlocker}</p>
                <p>This screen performs no write. Complete the property day roll to let the server apply its existing arrival-day rule.</p>
              </div>
            ) : null}
            {lifecycleMode === "cancel" && !canCancel ? <p className="lifecycle-blocker" role="status">{cancelBlocker} Nothing will be written.</p> : null}
            {lifecycleMode === "reinstate" && !canReinstate ? <p className="lifecycle-blocker" role="status">{reinstateBlocker} Nothing will be written.</p> : null}
            {lifecycleMessage ? <p className="success" role="status">{lifecycleMessage}</p> : null}
            {lifecycleError ? <p className="error" role="alert">{lifecycleError}</p> : null}
          </article>
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

type CheckoutStage = "stay" | "room" | "services" | "bill" | "release";

export type DepartureConversationCommand = Readonly<
  | {
      id: string;
      kind: "prepare";
      serviceKind: DepartureServiceKind;
      timing: "immediate" | "10" | "15" | "30" | "45" | "custom";
    }
  | { id: string; kind: "confirm" | "cancel" }
>;

const checkoutBlockerCopy = (blocker: string): string => {
  switch (blocker) {
    case "reservation_not_departure_state": return "This stay is not currently in a departure state.";
    case "current_segment_missing_or_ambiguous": return "Yellow cannot identify one current stay segment.";
    case "physical_room_missing_or_ambiguous": return "One exact physical room must be linked before departure.";
    case "occupancy_missing_or_ambiguous": return "The current room occupancy cannot be released safely yet.";
    case "folio_window_missing": return "A primary billing window has not been opened.";
    case "folio_window_unsettled": return "Every billing window must be settled before checkout.";
    case "folio_window_nonzero": return "A billing window still has an outstanding balance.";
    default: return `Server requirement: ${blocker.replaceAll("_", " ")}.`;
  }
};

function OverwatchCheckoutJourney({
  reservationId,
  completedDeparture,
  authoritativeRoomLabel,
  onCompleted,
  conversationCommand,
  onConversationReply,
  onConversationPendingChange,
  onLifecycleBusyChange,
}: Readonly<{
  reservationId: string;
  completedDeparture?: boolean;
  authoritativeRoomLabel?: string | null;
  onCompleted: () => void;
  conversationCommand: DepartureConversationCommand | null;
  onConversationReply: (reply: string) => void;
  onConversationPendingChange: (pending: boolean) => void;
  onLifecycleBusyChange: (busy: boolean) => void;
}>) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["overwatch-checkout-reservation", propertyId, reservationId],
    queryFn: () => loadReservation(reservationId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  const departure = useQuery({
    queryKey: ["overwatch-checkout-readiness", propertyId, reservationId],
    queryFn: () => loadCheckoutReadiness(reservationId),
    enabled: detail.data?.reservation.status === "in_house" || detail.data?.reservation.status === "due_out",
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  const departureServices = useQuery({
    queryKey: ["overwatch-departure-services", propertyId, reservationId],
    queryFn: () => loadDepartureServices(reservationId),
    enabled: Boolean(detail.data?.reservation),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  const folios = detail.data?.reservation.folios ?? [];
  const statementQueries = useQueries({
    queries: folios.map((folio) => ({
      queryKey: ["overwatch-checkout-folio", propertyId, reservationId, folio.folioId],
      queryFn: () => loadFolioStatement(folio.folioId),
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: "always" as const,
      retry: 1,
    })),
  });
  const [stage, setStage] = useState<CheckoutStage>(completedDeparture ? "release" : "stay");
  const [openConfirmed, setOpenConfirmed] = useState(false);
  const [settleConfirmed, setSettleConfirmed] = useState<string | null>(null);
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);
  const [busy, setBusy] = useState<"folio" | "settle" | "checkout" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serviceKind, setServiceKind] = useState<DepartureServiceKind>("luggage_pickup");
  const [serviceTiming, setServiceTiming] = useState<"immediate" | "10" | "15" | "30" | "45" | "custom">("immediate");
  const [customLocalAt, setCustomLocalAt] = useState("");
  const [serviceRoleId, setServiceRoleId] = useState<string | null>(null);
  const [escalationParentId, setEscalationParentId] = useState<string | null>(null);
  const [serviceOutcome, setServiceOutcome] = useState<"clear" | "finding_reported" | "unable_to_complete" | "">("");
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [serviceProposal, setServiceProposal] = useState<DepartureServiceRequest | null>(null);
  const serviceProposalAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const primaryFolioAttempt = useRef(`yellow-checkout-folio-${crypto.randomUUID()}`);
  const settlementAttempts = useRef(new Map<string, string>());
  const checkoutAttempt = useRef(`yellow-checkout-${crypto.randomUUID()}`);
  const handledDepartureConversation = useRef<string | null>(null);
  const ribbonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => onLifecycleBusyChange(false), [onLifecycleBusyChange]);
  useEffect(() => {
    const revealSelectedStage = () => {
      const ribbon = ribbonRef.current;
      const selected = ribbon?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!ribbon || !selected) return;
      ribbon.scrollTo({
        left: selected.offsetLeft - (ribbon.clientWidth - selected.offsetWidth) / 2,
        behavior: "auto",
      });
    };
    revealSelectedStage();
    window.addEventListener("resize", revealSelectedStage);
    return () => window.removeEventListener("resize", revealSelectedStage);
  }, [stage]);
  useEffect(() => {
    if (completedDeparture) setStage("release");
  }, [completedDeparture]);

  const refresh = async () => {
    await Promise.all([
      detail.refetch(),
      departure.refetch(),
      ...statementQueries.map((query) => query.refetch()),
      queryClient.invalidateQueries({ queryKey: ["today", propertyId] }),
      queryClient.invalidateQueries({ queryKey: ["yellow-reservation-command-index", propertyId] }),
    ]);
    onCompleted();
  };
  const reservation = detail.data?.reservation;
  const statements = statementQueries.flatMap((query) => query.data ? [query.data] : []);
  const statementsReady = statementQueries.every((query) => query.isSuccess);
  const completed = reservation?.status === "checked_out";
  const hasMissingFolio = Boolean(
    !completed &&
    reservation &&
    (reservation.folios.length === 0 || departure.data?.blockers.includes("folio_window_missing")),
  );
  const billReady = Boolean(
    statementsReady &&
    statements.length > 0 &&
    statements.every((statement) =>
      statement.balanceMinor === "0" && (statement.folio.status === "settled" || statement.folio.status === "closed"),
    ),
  );
  const roomReady = Boolean(departure.data?.room);
  const roomLabel = completed ? authoritativeRoomLabel : departure.data?.room?.spaceCode;
  const travel = reservation?.travel.find((item) => item.direction === "departure") ?? null;
  const activeDepartureAlerts = reservation?.alerts.filter((alert) => alert.active && (alert.showOn === "departure" || alert.showOn === "both")) ?? [];
  const serviceOverview = departureServices.data;
  const serviceRequests = serviceOverview?.requests ?? [];
  const serviceEvidence = serviceOverview?.evidence;
  const serviceTimingInput = (): DepartureServiceTiming | null => {
    if (serviceTiming === "immediate") return { mode: "immediate", minutes: null, localAt: null, utcOffsetMinutes: null };
    if (serviceTiming !== "custom") return { mode: "delay", minutes: Number(serviceTiming) as 10 | 15 | 30 | 45, localAt: null, utcOffsetMinutes: null };
    if (!customLocalAt) return null;
    const [date, time = ""] = customLocalAt.split("T");
    if (!date || !time || !serviceOverview?.timezone) return null;
    try {
      const canonical = propertyLocalDateTimeToIso(date, time, serviceOverview.timezone);
      if (Date.parse(canonical) <= Date.now()) return null;
      const [year, month, day] = date.split("-").map(Number);
      const [hour, minute] = time.split(":").map(Number);
      const desired = Date.UTC(year!, month! - 1, day!, hour!, minute!);
      const offset = Math.round((desired - Date.parse(canonical)) / 60000);
      return { mode: "custom", minutes: null, localAt: customLocalAt, utcOffsetMinutes: offset };
    } catch { return null; }
  };
  const existingRequest = serviceRequests.find((item) => item.serviceKind === serviceKind && item.proposalStatus !== "withdrawn") ?? null;
  const activeServiceRequest = serviceProposal ?? existingRequest;
  const serviceLabel = (kind: DepartureServiceKind): string => kind === "luggage_pickup" ? "Luggage pickup" : kind === "minibar_check" ? "Minibar check" : kind === "room_inspection" ? "Room inspection" : "Role escalation";
  const actionLabel = (request: DepartureServiceRequest): string => request.taskStatus === "done" ? "Completed" : request.proposalStatus === "confirmed" ? request.taskStatus?.replaceAll("_", " ") ?? "Confirmed" : "Proposal pending";

  const submitDepartureServiceProposal = async () => {
    if (!serviceConfirmed || serviceBusy || completed || !serviceEvidence || !reservation || !serviceOverview) return;
    const schedule = serviceTimingInput();
    if (!schedule) {
      setServiceMessage("Choose a future custom time before confirmation.");
      return;
    }
    if (!serviceRoleId || (serviceKind === "escalation" && !escalationParentId)) {
      setServiceMessage("Choose one configured duty role and one confirmed parent request before confirmation.");
      return;
    }
    setServiceBusy(true);
    setServiceMessage(null);
    const fingerprint = JSON.stringify({ serviceKind, serviceTiming, customLocalAt, serviceRoleId, escalationParentId });
    if (serviceProposalAttempt.current?.fingerprint !== fingerprint) serviceProposalAttempt.current = { fingerprint, key: `yellow-departure-service-${crypto.randomUUID()}` };
    const key = serviceProposalAttempt.current.key;
    try {
      const result = await createDepartureServiceProposal(reservationId, {
        serviceKind,
        targetRoleId: serviceRoleId,
        schedule,
        expected: serviceEvidence,
        parentRequestId: serviceKind === "escalation" ? escalationParentId : null,
      }, key);
      setServiceProposal(result.request);
      setServiceOutcome("");
      setServiceConfirmed(false);
      setServiceMessage(result.replayed ? "The existing governed proposal was retrieved." : `${serviceLabel(serviceKind)} proposal created. No task was dispatched until confirmation.`);
      await departureServices.refetch();
    } catch (error) {
      setServiceMessage(error instanceof Error ? error.message : "The departure service proposal could not be created.");
    } finally {
      setServiceBusy(false);
    }
  };

  const actOnDepartureService = async (
    request: DepartureServiceRequest,
    action: "confirm" | "withdraw" | "assign" | "start" | "complete",
    outcome: "clear" | "finding_reported" | "unable_to_complete" | null = null,
    staffPartyId: string | null = null,
  ) => {
    if (serviceBusy) return;
    setServiceBusy(true);
    setServiceMessage(null);
    const key = `yellow-departure-service-${action}-${request.requestId}`;
    try {
      const result = await transitionDepartureService(request.requestId, action, { expectedVersion: request.version, staffPartyId, outcome }, key);
      setServiceProposal(result.request);
      setServiceConfirmed(false);
      setServiceMessage(result.replayed ? "The governed action was already accepted; Yellow refreshed its receipt." : `${serviceLabel(result.request.serviceKind)} is now ${actionLabel(result.request)}.`);
      await departureServices.refetch();
    } catch (error) {
      setServiceMessage(error instanceof Error ? error.message : "The governed departure action could not be completed.");
      await departureServices.refetch().catch(() => undefined);
    } finally {
      setServiceBusy(false);
    }
  };

  useEffect(() => {
    const pending = [...new Map(
      [serviceProposal, ...serviceRequests]
        .filter((request): request is DepartureServiceRequest => Boolean(request?.proposalStatus === "pending"))
        .map((request) => [request.requestId, request]),
    ).values()];
    onConversationPendingChange(pending.length === 1);
  }, [onConversationPendingChange, serviceProposal, serviceRequests]);

  useEffect(() => {
    if (!conversationCommand || handledDepartureConversation.current === conversationCommand.id) return;
    handledDepartureConversation.current = conversationCommand.id;
    if (conversationCommand.kind === "prepare") {
      setStage(conversationCommand.serviceKind === "room_inspection" || conversationCommand.serviceKind === "minibar_check" ? "room" : "services");
      setServiceKind(conversationCommand.serviceKind);
      setServiceTiming(conversationCommand.timing);
      setCustomLocalAt("");
      setServiceProposal(null);
      setServiceConfirmed(false);
      setServiceMessage(`${serviceLabel(conversationCommand.serviceKind)} and ${conversationCommand.timing === "immediate" ? "immediate timing" : `a ${conversationCommand.timing}-minute delay`} are selected for review. No proposal or task has been created.`);
      return;
    }
    const pending = [...new Map(
      [serviceProposal, ...serviceRequests]
        .filter((request): request is DepartureServiceRequest => Boolean(request?.proposalStatus === "pending"))
        .map((request) => [request.requestId, request]),
    ).values()];
    if (pending.length !== 1) {
      onConversationReply("I cannot apply that answer because there is not exactly one pending departure-service proposal. Open Services and choose the exact request.");
      return;
    }
    const request = pending[0]!;
    if (conversationCommand.kind === "confirm") {
      onConversationReply(`Confirming the one pending ${serviceLabel(request.serviceKind).toLocaleLowerCase()} proposal. Yellow will verify its live version before dispatch.`);
      void actOnDepartureService(request, "confirm");
      return;
    }
    onConversationReply(`Withdrawing the one pending ${serviceLabel(request.serviceKind).toLocaleLowerCase()} proposal. No confirmed task will be created.`);
    void actOnDepartureService(request, "withdraw");
  }, [conversationCommand, onConversationReply, serviceProposal, serviceRequests]);

  const openPrimary = async () => {
    if (!openConfirmed || busy || !hasMissingFolio) return;
    setBusy("folio");
    onLifecycleBusyChange(true);
    setMessage(null);
    try {
      const [fresh, freshReadiness] = await Promise.all([
        loadReservation(reservationId),
        loadCheckoutReadiness(reservationId),
      ]);
      if (
        !["in_house", "due_out"].includes(fresh.reservation.status) ||
        (fresh.reservation.folios.length > 0 && !freshReadiness.blockers.includes("folio_window_missing"))
      ) throw new Error("The live stay changed before confirmation. Yellow stopped without opening another folio.");
      await openPrimaryFolio(reservationId, primaryFolioAttempt.current);
      await refresh();
      setOpenConfirmed(false);
      setMessage("Primary billing window opened. Yellow refreshed the live departure record.");
      setStage("bill");
    } catch (error) {
      await refresh().catch(() => undefined);
      setOpenConfirmed(false);
      setMessage(error instanceof Error ? error.message : "The primary billing window could not be opened.");
    } finally {
      setBusy(null);
      onLifecycleBusyChange(false);
    }
  };

  const settleFolio = async (folioId: string) => {
    if (settleConfirmed !== folioId || busy) return;
    const key = settlementAttempts.current.get(folioId) ?? `yellow-checkout-settle-${crypto.randomUUID()}`;
    settlementAttempts.current.set(folioId, key);
    setBusy("settle");
    onLifecycleBusyChange(true);
    setMessage(null);
    try {
      const [freshDetail, freshReadiness, freshStatement] = await Promise.all([
        loadReservation(reservationId),
        loadCheckoutReadiness(reservationId),
        loadFolioStatement(folioId),
      ]);
      if (
        !freshDetail.reservation.folios.some((folio) => folio.folioId === folioId) ||
        !["in_house", "due_out"].includes(freshDetail.reservation.status) ||
        freshStatement.folio.status !== "open" ||
        freshStatement.balanceMinor !== "0" ||
        freshReadiness.reservationStatus !== freshDetail.reservation.status
      ) throw new Error("The live bill changed before confirmation. Yellow stopped without settling it.");
      await transitionFolioStatus(folioId, "settle", key);
      await refresh();
      setSettleConfirmed(null);
      setMessage("Zero-balance billing window settled. Departure readiness has been recalculated.");
    } catch (error) {
      const reconciled = await loadFolioStatement(folioId).catch(() => null);
      await refresh().catch(() => undefined);
      setSettleConfirmed(null);
      if (reconciled?.folio.status === "settled" && reconciled.balanceMinor === "0") {
        setMessage("Yellow reconciled the interrupted response: this zero-balance window is settled.");
      } else {
        setMessage(error instanceof GovernedCheckoutRequestError && error.uncertain
          ? `${error.message} Retry will use the same operation key.`
          : error instanceof Error ? error.message : "The folio could not be settled.");
      }
    } finally {
      setBusy(null);
      onLifecycleBusyChange(false);
    }
  };

  const completeCheckout = async () => {
    if (!checkoutConfirmed || busy || !departure.data?.ready) return;
    setBusy("checkout");
    onLifecycleBusyChange(true);
    setMessage(null);
    try {
      const [freshDetail, freshReadiness] = await Promise.all([
        loadReservation(reservationId),
        loadCheckoutReadiness(reservationId),
      ]);
      const freshStatements = await Promise.all(
        freshDetail.reservation.folios.map((folio) => loadFolioStatement(folio.folioId)),
      );
      if (
        !["in_house", "due_out"].includes(freshDetail.reservation.status) ||
        !freshReadiness.ready ||
        freshStatements.length === 0 ||
        !freshStatements.every((statement) => statement.balanceMinor === "0" && ["settled", "closed"].includes(statement.folio.status))
      ) throw new Error("The live departure changed before confirmation. Yellow stopped without checking out the guest.");
      await commitCheckout(reservationId, checkoutAttempt.current);
      const verified = await loadReservation(reservationId);
      if (verified.reservation.status !== "checked_out" || !verified.reservation.segments.every((segment) => segment.status === "departed")) {
        throw new Error("The checkout command was received, but the refreshed stay does not yet confirm departure. Retry verification with the same operation key.");
      }
      await refresh();
      setCheckoutConfirmed(false);
      setStage("release");
      setMessage("Checkout complete. The authoritative stay is departed and the room occupancy has been released.");
    } catch (error) {
      const reconciled = await loadReservation(reservationId).catch(() => null);
      await refresh().catch(() => undefined);
      setCheckoutConfirmed(false);
      if (reconciled?.reservation.status === "checked_out" && reconciled.reservation.segments.every((segment) => segment.status === "departed")) {
        setStage("release");
        setMessage("Yellow reconciled the interrupted response: checkout is complete and the stay is departed.");
      } else {
        setMessage(error instanceof GovernedCheckoutRequestError && error.uncertain
          ? `${error.message} Retry will use the same departure operation key.`
          : error instanceof Error ? error.message : "Checkout could not be completed.");
      }
    } finally {
      setBusy(null);
      onLifecycleBusyChange(false);
    }
  };

  if (detail.isLoading || departure.isLoading) {
    return <section className="checkout-journey operational-state" aria-live="polite"><strong>Preparing checkout</strong><p>Reading the live stay, room and folio controls…</p></section>;
  }
  if (detail.isError || !reservation || (reservation.status !== "checked_out" && (departure.isError || !departure.data))) {
    return <section className="checkout-journey operational-state"><strong>Checkout unavailable</strong><p className="error">{detail.error?.message ?? departure.error?.message ?? "The live departure record is unavailable."}</p></section>;
  }

  const stepState = (id: CheckoutStage): "done" | "current" | "blocked" | "review" => {
    if (id === "stay") return ["in_house", "due_out", "checked_out"].includes(reservation.status) ? "done" : "blocked";
    if (id === "room") return completed || roomReady ? "done" : "blocked";
    if (id === "services") return "review";
    if (id === "bill") return completed || billReady ? "done" : "blocked";
    return completed ? "done" : departure.data?.ready ? "current" : "blocked";
  };
  const stages: readonly Readonly<{ id: CheckoutStage; label: string }>[] = [
    { id: "stay", label: "Stay" },
    { id: "room", label: "Room" },
    { id: "services", label: "Services" },
    { id: "bill", label: "Bill" },
    { id: "release", label: "Release" },
  ];

  return (
    <section className="checkout-journey" aria-labelledby="checkout-journey-title">
      <div className="checkout-depth-card checkout-depth-card-one" aria-hidden="true" />
      <div className="checkout-depth-card checkout-depth-card-two" aria-hidden="true" />
      <header className="checkout-journey-header">
        <div><span>GUIDED CHECKOUT</span><h3 id="checkout-journey-title">{reservation.guests[0]?.displayName ?? reservation.confirmationNo}</h3></div>
        <strong>{completed ? "Departed" : departure.data?.ready ? "Ready to confirm" : "Review required"}</strong>
      </header>
      <p className="checkout-journey-context">{reservation.confirmationNo} · Room {roomLabel ?? "not resolved"} · {reservation.folios.length} billing window{reservation.folios.length === 1 ? "" : "s"}</p>

      <div ref={ribbonRef} className="checkout-ribbon" role="tablist" aria-label="Checkout progress">
        {stages.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={stage === item.id}
            className={stage === item.id ? "active" : undefined}
            data-step-state={stepState(item.id)}
            onClick={() => setStage(item.id)}
          ><small>{index + 1}</small>{item.label}</button>
        ))}
      </div>

      <div className="checkout-progress-list" aria-label="Authoritative checkout status">
        {stages.map((item) => <button key={item.id} type="button" onClick={() => setStage(item.id)}><span data-state={stepState(item.id)} />{item.label}<small>{stepState(item.id)}</small></button>)}
      </div>

      <div className="checkout-stage-panel" role="tabpanel">
        {stage === "stay" ? (
          <>
            <h4>Stay identity</h4>
            <dl className="checkout-facts"><div><dt>Status</dt><dd>{reservationStatusDescription(reservation.status)}</dd></div><div><dt>Guests</dt><dd>{reservation.guests.length}</dd></div><div><dt>Departure time</dt><dd>{reservation.etd ?? "Not recorded"}</dd></div></dl>
            {activeDepartureAlerts.length ? <ul>{activeDepartureAlerts.map((alert) => <li key={alert.alertId}>{alert.message}</li>)}</ul> : <p className="muted">No active departure alert is recorded.</p>}
          </>
        ) : null}
        {stage === "room" ? (
          <>
            <h4>Room & occupancy</h4>
            <p><strong>{roomLabel ? `Room ${roomLabel}` : "Room not resolved"}</strong></p>
            <p className="muted">Yellow releases the exact recorded occupancy only inside the final canonical checkout. It never marks a room physically inspected from this screen.</p>
            <dl className="checkout-facts"><div><dt>Damage inspection</dt><dd>Not recorded</dd></div><div><dt>Missing items</dt><dd>Not recorded</dd></div><div><dt>Minibar today</dt><dd>Not recorded</dd></div></dl>
            {!completed ? <section className="departure-coordination-card" aria-labelledby="departure-inspection-title">
              <header><div><span className="departure-card-kicker">HUMAN RECORD REQUIRED</span><h5 id="departure-inspection-title">Request a bounded room check</h5></div><span className="departure-unknown">Unknown</span></header>
              <p className="muted">No physical observation is recorded here. A confirmed request asks a colleague to report clear, finding reported, or unable to complete.</p>
              <div className="departure-service-choice" role="group" aria-label="Inspection type">
                {(["minibar_check", "room_inspection"] as const).map((kind) => <button key={kind} type="button" className={serviceKind === kind ? "selected" : undefined} onClick={() => { setServiceKind(kind); setServiceProposal(null); setServiceConfirmed(false); }}>{serviceLabel(kind)}</button>)}
              </div>
              {serviceKind !== "luggage_pickup" && serviceKind !== "escalation" ? <div className="departure-proposal-block">
                <p><strong>{serviceLabel(serviceKind)}</strong> will use the exact recorded room and departure evidence.</p>
                <label className="departure-role-select">Target configured duty role<select value={serviceRoleId ?? ""} onChange={(event) => { setServiceRoleId(event.target.value || null); setServiceProposal(null); setServiceConfirmed(false); }}><option value="">Choose one role</option>{(serviceOverview?.roles ?? []).map((role) => <option key={role.roleId} value={role.roleId}>{role.name}</option>)}</select></label>
                {activeServiceRequest ? <p className="departure-request-status" role="status">{actionLabel(activeServiceRequest)}{activeServiceRequest.outcome ? ` · ${activeServiceRequest.outcome.replaceAll("_", " ")}` : ""}</p> : null}
                {!activeServiceRequest || activeServiceRequest.proposalStatus === "pending" ? <><label className="checkout-confirm"><input type="checkbox" checked={serviceConfirmed} onChange={(event) => setServiceConfirmed(event.target.checked)} /> Confirm this separate request before creating governed work</label><button type="button" className="primary" disabled={!serviceConfirmed || serviceBusy || !serviceRoleId || !serviceEvidence} onClick={() => void (activeServiceRequest?.proposalStatus === "pending" ? actOnDepartureService(activeServiceRequest, "confirm") : submitDepartureServiceProposal())}>{serviceBusy ? "Working…" : activeServiceRequest?.proposalStatus === "pending" ? "Confirm request" : "Create proposal"}</button></> : null}
              </div> : null}
            </section> : <p className="muted">No new inspection request is available for this completed departure.</p>}
          </>
        ) : null}
        {stage === "services" ? (
          <>
            <h4>Departure services</h4>
            <dl className="checkout-facts"><div><dt>Travel</dt><dd>{travel ? [travel.mode, travel.carrier, travel.serviceNo].filter(Boolean).join(" ") || "Recorded without mode" : "Not recorded"}</dd></div><div><dt>Scheduled</dt><dd>{travel?.scheduledAt ?? "Not recorded"}</dd></div><div><dt>Pickup</dt><dd>{travel?.pickupRequested ? travel.pickupTaskId ? "Requested · task linked" : "Requested · task not linked" : "Not requested"}</dd></div></dl>
            <section className="departure-coordination-card" aria-labelledby="departure-service-title">
              <header><div><span className="departure-card-kicker">CONFIRMATION-GATED</span><h5 id="departure-service-title">Coordinate one departure service</h5></div><span className="departure-unknown">No physical fact</span></header>
              <p className="muted">Choosing a service or time only prepares a proposal. Nothing is assigned or dispatched until its own confirmation.</p>
              {!completed ? <div className="departure-service-choice" role="group" aria-label="Departure service">
                {(["luggage_pickup", "minibar_check", "room_inspection", "escalation"] as const).map((kind) => <button key={kind} type="button" className={serviceKind === kind ? "selected" : undefined} onClick={() => { setServiceKind(kind); setServiceProposal(null); setServiceConfirmed(false); }}>{serviceLabel(kind)}</button>)}
              </div> : null}
              {!completed && (serviceKind === "luggage_pickup" || serviceKind === "minibar_check" || serviceKind === "room_inspection") ? <>
                <label className="departure-role-select">Target configured duty role<select value={serviceRoleId ?? ""} onChange={(event) => { setServiceRoleId(event.target.value || null); setServiceProposal(null); setServiceConfirmed(false); }}><option value="">Choose one role</option>{(serviceOverview?.roles ?? []).map((role) => <option key={role.roleId} value={role.roleId}>{role.name}</option>)}</select></label>
                <fieldset className="departure-timing"><legend>When should this be requested?</legend><div className="departure-timing-grid">{([ ["immediate", "Immediate"], ["10", "In 10 minutes"], ["15", "In 15 minutes"], ["30", "In 30 minutes"], ["45", "In 45 minutes"], ["custom", "Custom"] ] as const).map(([value, label]) => <label key={value} className={serviceTiming === value ? "selected" : undefined}><input type="radio" name="departure-service-timing" checked={serviceTiming === value} onChange={() => { setServiceTiming(value); setServiceProposal(null); setServiceConfirmed(false); }} />{label}</label>)}</div>{serviceTiming === "custom" ? <label className="departure-custom-time">Property-local time<input type="datetime-local" value={customLocalAt} onChange={(event) => { setCustomLocalAt(event.target.value); setServiceProposal(null); setServiceConfirmed(false); }} /></label> : null}</fieldset>
                {activeServiceRequest ? <p className="departure-request-status" role="status">{serviceLabel(activeServiceRequest.serviceKind)} · {actionLabel(activeServiceRequest)}{activeServiceRequest.dueLocal ? ` · due ${activeServiceRequest.dueLocal}` : ""}</p> : null}
                {!activeServiceRequest || activeServiceRequest.proposalStatus === "pending" ? <><label className="checkout-confirm"><input type="checkbox" checked={serviceConfirmed} onChange={(event) => setServiceConfirmed(event.target.checked)} /> Confirm this separate {serviceLabel(serviceKind).toLocaleLowerCase()} request</label><button type="button" className="primary" disabled={!serviceConfirmed || serviceBusy || !serviceRoleId || !serviceEvidence || (serviceTiming === "custom" && !serviceTimingInput())} onClick={() => void (activeServiceRequest?.proposalStatus === "pending" ? actOnDepartureService(activeServiceRequest, "confirm") : submitDepartureServiceProposal())}>{serviceBusy ? "Working…" : activeServiceRequest?.proposalStatus === "pending" ? "Confirm request" : "Prepare proposal"}</button></> : null}
              </> : null}
              {!completed && serviceKind === "escalation" ? <>
                <label className="departure-role-select">Target configured duty role<select value={serviceRoleId ?? ""} onChange={(event) => { setServiceRoleId(event.target.value || null); setServiceProposal(null); setServiceConfirmed(false); }}><option value="">Choose one role</option>{(serviceOverview?.roles ?? []).map((role) => <option key={role.roleId} value={role.roleId}>{role.name}</option>)}</select></label>
                <label className="departure-role-select">Parent confirmed request<select value={escalationParentId ?? ""} onChange={(event) => { setEscalationParentId(event.target.value || null); setServiceProposal(null); setServiceConfirmed(false); }}><option value="">Choose one request</option>{serviceRequests.filter((request) => request.proposalStatus === "confirmed" && request.serviceKind !== "escalation").map((request) => <option key={request.requestId} value={request.requestId}>{serviceLabel(request.serviceKind)} · {actionLabel(request)}</option>)}</select></label>
                <p className="muted">Escalation creates a separate role-queue request and does not change the parent service state.</p>
                {!activeServiceRequest || activeServiceRequest.proposalStatus === "pending" ? <><label className="checkout-confirm"><input type="checkbox" checked={serviceConfirmed} onChange={(event) => setServiceConfirmed(event.target.checked)} /> Confirm this separate role escalation</label><button type="button" className="primary" disabled={!serviceConfirmed || serviceBusy || !serviceRoleId || !escalationParentId || !serviceEvidence} onClick={() => void (activeServiceRequest?.proposalStatus === "pending" ? actOnDepartureService(activeServiceRequest, "confirm") : submitDepartureServiceProposal())}>{serviceBusy ? "Working…" : activeServiceRequest?.proposalStatus === "pending" ? "Confirm escalation" : "Prepare escalation proposal"}</button></> : null}
              </> : null}
              {serviceRequests.length ? <div className="departure-request-list" aria-label="Departure service queue">{serviceRequests.map((request) => <article key={request.requestId}><header><strong>{serviceLabel(request.serviceKind)}</strong><span>{actionLabel(request)}</span></header><p>Role: {request.targetRoleName ?? "Unassigned"} · Due: {request.dueLocal ?? "Immediate"}</p><p>Assignee: {serviceOverview?.staff.find((person) => person.partyId === request.assigneePartyId)?.name ?? (request.assigneePartyId ? "Assigned staff" : "Not assigned")}{request.outcome ? ` · Outcome: ${request.outcome.replaceAll("_", " ")}` : ""}</p>{!completed && request.eligibleActions.includes("withdraw") ? <button type="button" className="secondary" disabled={serviceBusy} onClick={() => void actOnDepartureService(request, "withdraw")}>Withdraw proposal</button> : null}{!completed && request.eligibleActions.includes("assign") && (serviceOverview?.staff.length ?? 0) > 0 ? <label className="departure-role-select">Assign colleague<select defaultValue={request.assigneePartyId ?? ""} onChange={(event) => { const staff = event.target.value || null; if (staff) void actOnDepartureService(request, "assign", null, staff); }}><option value="">Choose colleague</option>{(serviceOverview?.staff ?? []).map((person) => <option key={person.partyId} value={person.partyId}>{person.name}</option>)}</select></label> : null}{!completed && request.eligibleActions.includes("start") ? <button type="button" className="secondary" disabled={serviceBusy} onClick={() => void actOnDepartureService(request, "start")}>Start work</button> : null}{!completed && request.eligibleActions.includes("complete") && request.serviceKind !== "luggage_pickup" && request.serviceKind !== "escalation" ? <label className="departure-role-select">Human outcome<select value={serviceOutcome} onChange={(event) => setServiceOutcome(event.target.value as "clear" | "finding_reported" | "unable_to_complete" | "")}><option value="">Choose outcome</option><option value="clear">Clear</option><option value="finding_reported">Finding reported</option><option value="unable_to_complete">Unable to complete</option></select></label> : null}{!completed && request.eligibleActions.includes("complete") ? <button type="button" className="secondary" disabled={serviceBusy || (request.serviceKind !== "luggage_pickup" && request.serviceKind !== "escalation" && !serviceOutcome)} onClick={() => void actOnDepartureService(request, "complete", request.serviceKind === "luggage_pickup" || request.serviceKind === "escalation" ? null : serviceOutcome || null)}>{request.serviceKind === "luggage_pickup" ? "Confirm delivery" : "Complete with bounded outcome"}</button> : null}</article>)}</div> : null}
            </section>
            {serviceMessage ? <p className="checkout-message" role="status" aria-live="polite">{serviceMessage}</p> : null}
          </>
        ) : null}
        {stage === "bill" ? (
          <>
            <h4>Itemized bill</h4>
            {hasMissingFolio ? (
              <div className="checkout-action-block">
                <p>No primary billing window is recorded for this stay.</p>
                <label className="checkout-confirm"><input type="checkbox" checked={openConfirmed} onChange={(event) => setOpenConfirmed(event.target.checked)} /> Confirm opening one empty primary billing window</label>
                <button type="button" className="primary" disabled={!openConfirmed || busy !== null} onClick={() => void openPrimary()}>{busy === "folio" ? "Opening…" : "Open primary billing window"}</button>
              </div>
            ) : null}
            {statementQueries.some((query) => query.isLoading) ? <p>Loading immutable posting lines…</p> : null}
            {statementQueries.some((query) => query.isError) ? <p className="error">One or more itemized statements are unavailable. Checkout remains blocked.</p> : null}
            <div className="checkout-folios">
              {statements.map((statement) => {
                const canSettle = statement.folio.status === "open" && statement.balanceMinor === "0";
                return (
                  <article key={statement.folio.id}>
                    <header><div><span>Window {statement.folio.windowNo}</span><strong>{statement.folio.name ?? statement.folio.reference ?? "Primary folio"}</strong></div><div><span>{statement.folio.status}</span><strong>{moneyExactMinor(statement.balanceMinor, statement.folio.currency)}</strong></div></header>
                    {statement.rows.length ? (
                      <div className="checkout-line-table" role="table" aria-label={`Window ${statement.folio.windowNo} itemized charges`}>
                        {statement.rows.map((row) => <div role="row" key={row.lineId}><span role="cell">{row.businessDate}</span><span role="cell">{row.description ?? row.txCode}</span><strong role="cell">{moneyExactMinor(row.amountMinor, statement.folio.currency)}</strong></div>)}
                      </div>
                    ) : <p className="muted">No posting lines.</p>}
                    {!completed && canSettle ? <div className="checkout-action-block"><label className="checkout-confirm"><input type="checkbox" checked={settleConfirmed === statement.folio.id} onChange={(event) => setSettleConfirmed(event.target.checked ? statement.folio.id : null)} /> Confirm settling this zero-balance window</label><button type="button" className="primary" disabled={settleConfirmed !== statement.folio.id || busy !== null} onClick={() => void settleFolio(statement.folio.id)}>{busy === "settle" && settleConfirmed === statement.folio.id ? "Settling…" : "Settle zero-balance window"}</button></div> : null}
                    {!completed && statement.balanceMinor !== "0" ? <button type="button" className="secondary" onClick={() => window.location.assign(`/p/${propertyId}/today?workspace=finance`)}>Resolve {moneyExactMinor(statement.balanceMinor, statement.folio.currency)} in Finance</button> : null}
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
        {stage === "release" ? (
          <>
            <h4>Final room release</h4>
            {completed ? <p className="checkout-success">Completed departure review. The stay is departed and its recorded occupancy was released. No checkout action is available.</p> : (
              <>
                {departure.data?.blockers.length ? <ul className="checkout-blockers">{departure.data.blockers.map((blocker) => <li key={blocker}>{checkoutBlockerCopy(blocker)}</li>)}</ul> : <p>All server-owned checkout controls are ready.</p>}
                <label className="checkout-confirm"><input type="checkbox" checked={checkoutConfirmed} disabled={!departure.data?.ready} onChange={(event) => setCheckoutConfirmed(event.target.checked)} /> Confirm checkout for {reservation.guests[0]?.displayName ?? reservation.confirmationNo}</label>
                <button type="button" className="primary" disabled={!departure.data?.ready || !checkoutConfirmed || busy !== null} onClick={() => void completeCheckout()}>{busy === "checkout" ? "Checking out…" : "Complete verified checkout"}</button>
              </>
            )}
          </>
        ) : null}
      </div>
      {message ? <p className="checkout-message" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}

/**
 * A compact, in-context operator flow.  It deliberately consumes the same
 * reservation and readiness endpoints as the full workbench; speech is only a
 * way to reach this surface, never authority to change the stay.
  */
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

function ReservationCreateWorkspace({
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
  const [commitUncertain, setCommitUncertain] = useState(false);
  const guestSearchGeneration = useRef(0);
  const offerSearchGeneration = useRef(0);
  const createGeneration = useRef(0);
  const commitAttempt = useRef<Readonly<{ fingerprint: string; key: string }> | null>(null);

  const resetOffer = () => {
    offerSearchGeneration.current += 1;
    createGeneration.current += 1;
    setOffers([]);
    setOffer(null);
    setConfirmed(false);
    setCommitUncertain(false);
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
    const generation = ++guestSearchGeneration.current;
    setWorking(true);
    setError("");
    setMessage("Searching canonical Party profiles…");
    try {
      const results = await searchPartyProfiles(query);
      if (generation !== guestSearchGeneration.current) return;
      setGuests(results);
      setMessage(`${results.length} matching guest profile${results.length === 1 ? "" : "s"}.`);
    } catch (reason) {
      if (generation !== guestSearchGeneration.current) return;
      setError(reason instanceof Error ? reason.message : "Guest search failed.");
    } finally {
      if (generation === guestSearchGeneration.current) setWorking(false);
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
      if (generation !== offerSearchGeneration.current) return;
      setError(reason instanceof Error ? reason.message : "Current offers are unavailable.");
    } finally {
      if (generation === offerSearchGeneration.current) setWorking(false);
    }
  };
  const createReservation = async () => {
    if (!guest || !offer || !confirmed) return;
    const generation = ++createGeneration.current;
    let receiptReceived = false;
    setWorking(true);
    setError("");
    setMessage(commitUncertain ? "Reconciling the retained request by its original key…" : "Refreshing price, policy and inventory before commit…");
    try {
      const current = stay();
      const evidence = {
        primaryPartyId: guest.partyId,
        offer,
        adults,
        childAges: current.ages,
        channelCode,
      } as const;
      const fingerprint = JSON.stringify({
        propertyId,
        primaryPartyId: guest.partyId,
        sellableUnitId: offer.sellableUnitId,
        ratePlanId: offer.ratePlanId,
        optionRef: offer.optionRef,
        stay: offer.stay,
        total: offer.total,
        adults,
        childAges: current.ages,
        channelCode,
      });
      if (commitAttempt.current?.fingerprint !== fingerprint) {
        commitAttempt.current = { fingerprint, key: crypto.randomUUID() };
      }
      const refreshedOffers = await searchReservationOffers({
        from: current.from,
        to: current.to,
        adults,
        childAges: current.ages,
        channelCode,
      });
      if (generation !== createGeneration.current) return;
      const refreshedOffer = refreshedOffers.find((candidate) => candidate.optionRef === offer.optionRef);
      if (!refreshedOffer || !sameReservationOffer(offer, refreshedOffer)) {
        setOffers(refreshedOffers);
        setOffer(null);
        setConfirmed(false);
        setCommitUncertain(false);
        setStep(3);
        setMessage("The price, policy or availability changed. Review and select a current offer; nothing was written.");
        return;
      }
      setMessage(commitUncertain ? "Replaying the retained command with the same key…" : "Committing through authoritative occupancy…");
      const result = await commitReservation({
        primaryPartyId: guest.partyId,
        offer,
        adults,
        childAges: current.ages,
        channelCode,
        idempotencyKey: commitAttempt.current.key,
      });
      receiptReceived = true;
      if (generation !== createGeneration.current) return;
      setMessage("Commit received. Rereading the authoritative reservation…");
      const authoritative = await loadReservation(result.reservationId);
      if (generation !== createGeneration.current) return;
      if (!reservationMatchesCreateReceipt(authoritative, result, evidence)) {
        throw new ReservationCommandRequestError(
          "The commit receipt does not yet match the authoritative reservation. Yellow retained this exact request for same-key reconciliation.",
          true,
        );
      }
      setCreated(result);
      setCommitUncertain(false);
      setMessage("Reservation created and reconciled against the server-owned record.");
      await onCreated(result.reservationId);
    } catch (reason) {
      if (generation !== createGeneration.current) return;
      const status = reason instanceof ReservationCommandRequestError ? reason.status : 0;
      if (status === 409) {
        resetOffer();
        setStep(2);
        setError("Inventory changed. Stay and guest are preserved; find current offers again.");
      } else if (reason instanceof ReservationCommandRequestError && reason.uncertain) {
        setCommitUncertain(true);
        setConfirmed(true);
        setError(`${reason.message} Use “Reconcile same request”; Yellow will not allocate a new key.`);
      } else if (receiptReceived) {
        setCommitUncertain(true);
        setConfirmed(true);
        setError("The commit receipt was received, but the authoritative reread was interrupted. Use “Reconcile same request”; Yellow will replay the original key and reread before success.");
      } else {
        setError(reason instanceof Error ? reason.message : "The reservation could not be committed.");
      }
    } finally {
      if (generation === createGeneration.current) setWorking(false);
    }
  };

  const duplicates = duplicatePartyEvidence(guests);
  const duplicatePartyIds = new Set(duplicates.flatMap(({ partyIds }) => partyIds));
  const missingRequiredFields = [
    !arrivalDate ? "Arrival date" : null,
    !departureDate ? "Departure date" : null,
    adults < 1 ? "Adults" : null,
    !channelCode ? "Booking source" : null,
    !guest ? "Canonical guest Party" : null,
    !offer ? "Current room/rate offer" : null,
  ].filter((value): value is string => value !== null);

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
        {duplicates.length ? <div className="reservation-duplicate-evidence" role="status"><strong>Possible duplicate profiles</strong><p>Yellow will not merge or guess identity. Compare the canonical Party IDs before selecting.</p>{duplicates.map((item) => <small key={item.normalizedName}>{item.displayName}: {item.partyIds.join(" · ")}</small>)}</div> : null}
        <div className="reservation-create-results">
          {guests.map((profile) => <button type="button" key={profile.partyId} disabled={working} aria-pressed={guest?.partyId === profile.partyId} data-possible-duplicate={duplicatePartyIds.has(profile.partyId) || undefined} onClick={() => { guestSearchGeneration.current += 1; setGuest(profile); resetOffer(); }}><strong>{profile.displayName}</strong><span>{profile.roles.join(" · ") || profile.kind}</span><small>Party {profile.partyId}{duplicatePartyIds.has(profile.partyId) ? " · possible duplicate" : ""}</small></button>)}
        </div>
        <div className="reservation-create-actions"><button type="button" className="quiet" disabled={working} onClick={() => setStep(1)}>Back</button><button type="button" disabled={!guest || working} onClick={() => void findOffers()}>Find current offers</button></div>
      </div> : null}
      {step === 3 ? <div className="reservation-create-panel">
        <h2>Current server offers</h2>
        <p>Every option is guidance with <strong>promise=false</strong>; commit arbitration remains required.</p>
        <div className="reservation-create-results offers">
          {offers.map((item) => <button type="button" key={item.optionRef} aria-pressed={offer?.optionRef === item.optionRef} onClick={() => { setOffer(item); setConfirmed(false); setCommitUncertain(false); }}><strong>{item.sellableUnitName}</strong><span>{item.unitTypeCode} · {item.ratePlanCode} · {money(item.total.amountMinor, item.total.currency)}</span><small>{item.availableCount} currently free · {item.total.kind}</small></button>)}
        </div>
        <div className="reservation-create-actions"><button type="button" className="quiet" onClick={() => setStep(2)}>Back</button><button type="button" disabled={!offer} onClick={() => setStep(4)}>Review reservation</button></div>
      </div> : null}
      {step === 4 && guest && offer ? <div className="reservation-create-panel">
        <h2>Review before committing inventory</h2>
        <dl className="reservation-create-review">
          <dt>Property</dt><dd>{propertyId}</dd>
          <dt>Guest</dt><dd>{guest.displayName} · Party {guest.partyId}</dd>
          <dt>Stay</dt><dd>{arrivalDate} to {departureDate} · {adults} adult{adults === 1 ? "" : "s"}</dd>
          <dt>Source</dt><dd>{channelCode}</dd>
          <dt>Offer</dt><dd>{offer.sellableUnitName} · {offer.ratePlanCode}</dd>
          <dt>Total</dt><dd>{money(offer.total.amountMinor, offer.total.currency)} · {offer.total.kind}</dd>
          <dt>Policy evidence</dt><dd>{offer.ratePlanCode} · promise=false · commit arbitration required · {offer.availableCount} currently free</dd>
        </dl>
        <div className={missingRequiredFields.length ? "reservation-missing-fields attention" : "reservation-missing-fields ready"}><strong>{missingRequiredFields.length ? "Missing before confirmation" : "All required fields present"}</strong>{missingRequiredFields.length ? <ul>{missingRequiredFields.map((field) => <li key={field}>{field}</li>)}</ul> : <p>Yellow will refresh the selected price, policy and availability immediately before writing.</p>}</div>
        <label className="reservation-create-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm these stay, guest and offer details. Yellow may commit the reservation and reserve inventory.</span></label>
        {commitUncertain ? <p className="reservation-uncertain" role="status">The original idempotency key is retained. Reconciliation replays only that exact command, then rereads the reservation.</p> : null}
        <div className="reservation-create-actions"><button type="button" className="quiet" disabled={working} onClick={() => setStep(3)}>Back</button><button type="button" disabled={!confirmed || working || missingRequiredFields.length > 0} onClick={() => void createReservation()}>{working ? "Checking authoritative state…" : commitUncertain ? "Reconcile same request" : "Confirm and create reservation"}</button></div>
      </div> : null}
      {message ? <p className="reservation-create-message" aria-live="polite">{message}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}

function ReservationBoardWorkspace({ timezone }: Readonly<{ timezone: string }>) {
  const [creating, setCreating] = useState(false);
  const board = useQuery({
    queryKey: ["reservation-board", propertyId],
    queryFn: loadReservationBoard,
  });
  const groupBlocks = useQuery({
    queryKey: ["group-blocks", propertyId],
    queryFn: loadGroupBlocks,
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
      <GroupBlockWorkbenchPanel
        loading={groupBlocks.isLoading}
        error={groupBlocks.isError ? groupBlocks.error.message : null}
        groups={groupBlocks.data?.groups ?? []}
      />
      <MovementGrid
        status="all"
        lane={board.data}
        timezone={timezone}
        open={(stay) => window.location.assign(`/p/${propertyId}/res/${stay.reservationId}`)}
      />
    </section>
  );
}

function GroupBlockWorkbenchPanel({
  loading,
  error,
  groups,
}: Readonly<{
  loading: boolean;
  error: string | null;
  groups: Awaited<ReturnType<typeof loadGroupBlocks>>["groups"];
}>) {
  const totals = groups.reduce((acc, group) => ({
    blocked: acc.blocked + group.blockedRooms,
    pickedUp: acc.pickedUp + group.pickedUpRooms,
    remaining: acc.remaining + group.remainingRooms,
  }), { blocked: 0, pickedUp: 0, remaining: 0 });
  return (
    <section className="group-block-workbench" aria-labelledby="group-block-workbench-title">
      <header>
        <div>
          <span className="state">GROUP RESERVATIONS · BLOCK MANAGEMENT</span>
          <h2 id="group-block-workbench-title">Opera-style group blocks</h2>
          <p>Read-only group header, allotment, pickup, cutoff/wash and master-folio evidence from Yellow’s PMS tables.</p>
        </div>
        <div className="group-block-totals" aria-label="Group block totals">
          <span><strong>{totals.blocked}</strong><small>blocked</small></span>
          <span><strong>{totals.pickedUp}</strong><small>picked up</small></span>
          <span><strong>{totals.remaining}</strong><small>remaining</small></span>
        </div>
      </header>
      {loading ? <p className="empty">Loading group block workbench…</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!loading && !error && groups.length === 0 ? (
        <p className="empty">No group blocks are configured for this property yet. The module is ready for MICE, social, corporate and travel-trade block data.</p>
      ) : null}
      <div className="group-block-list">
        {groups.map((group) => {
          const visibleAllotment = group.allotment.slice(0, 8);
          return (
            <article className="group-block-card" key={group.groupId} data-cutoff-state={group.cutoffState}>
              <div className="group-block-card-head">
                <div>
                  <span className="state">{group.code} · {group.status}{group.statusDeductsInventory ? " · deducting" : " · non-deducting"}</span>
                  <h3>{group.name ?? group.code}</h3>
                  <p>{group.accountPartyName ?? "No company/agent linked"} · {group.arrivalDate ?? "No dates"} → {group.departureDate ?? "No dates"}</p>
                </div>
                <strong>{group.pickupPercent}% pickup</strong>
              </div>
              <dl className="group-block-metrics">
                <div><dt>Blocked</dt><dd>{group.blockedRooms}</dd></div>
                <div><dt>Picked up</dt><dd>{group.pickedUpRooms}</dd></div>
                <div><dt>Remaining</dt><dd>{group.remainingRooms}</dd></div>
                <div><dt>Cutoff</dt><dd>{group.cutoffDate ?? "Not set"} · {group.cutoffState.replaceAll("_", " ")}</dd></div>
                <div><dt>Master folio</dt><dd>{group.masterFolioNo ?? "Not linked"}{group.masterFolioStatus ? ` · ${group.masterFolioStatus}` : ""}</dd></div>
                <div><dt>Wash</dt><dd>{group.washSchedule === null ? "No schedule" : "Schedule configured"}</dd></div>
              </dl>
              <div className="group-block-allotment" role="table" aria-label={`${group.code} allotment`}>
                <div role="row" className="group-block-allotment-head"><span>Room type</span><span>Date</span><span>Block</span><span>Pickup</span><span>Left</span></div>
                {visibleAllotment.map((row) => (
                  <div role="row" key={`${group.groupId}-${row.unitTypeId}-${row.stayDate}`}>
                    <span>{row.unitTypeCode}<small>{row.unitTypeName}</small></span>
                    <span>{row.stayDate}</span>
                    <span>{row.blocked}</span>
                    <span>{row.pickedUp}</span>
                    <span>{row.remaining}</span>
                  </div>
                ))}
              </div>
              {group.allotment.length > visibleAllotment.length ? <small className="group-block-more">Showing first {visibleAllotment.length} of {group.allotment.length} allotment rows.</small> : null}
            </article>
          );
        })}
      </div>
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

export { ReservationWorkspace, OverwatchCheckInJourney, OverwatchCheckoutJourney, ReservationCreateWorkspace, ReservationBoardWorkspace, GuestsWorkspace, InlineGuestProfile };
