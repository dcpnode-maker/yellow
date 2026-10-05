import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadReservationCalendar, propertyLocalDate } from "../yellow-api";
import {
  addCalendarDays, calendarDays, reservationCalendarRows, reservationCalendarStatusLabel,
  segmentOccupiesCalendarDate,
  type ReservationCalendar,
  type ReservationCalendarSegment,
} from "../reservation-calendar";
import "./reservation-room-calendar.css";
import { HostReservationCalendar } from "./HostReservationCalendar";

type Props = Readonly<{
  propertyId: string;
  timezone: string;
  onOpenReservation: (reservationId: string) => void;
}>;

const CALENDAR_WINDOW_DAYS = 7;

function stayForDate(segments: readonly ReservationCalendarSegment[], date: string): readonly ReservationCalendarSegment[] {
  return segments.filter((segment) => segmentOccupiesCalendarDate(segment, date));
}

function dateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function stayLabel(segment: ReservationCalendarSegment): string {
  const before = segment.continuesBefore ? "Continues from earlier dates. " : "";
  const after = segment.continuesAfter ? " Continues beyond this date range." : "";
  return `${before}${segment.primaryGuestDisplayName} · ${segment.confirmationNo} · ${reservationCalendarStatusLabel(segment.reservationStatus)} · ${segment.clipFromDate} to ${segment.clipToDateExclusive}.${after}`;
}

function filterSegments(calendar: ReservationCalendar, status: string, unitType: string) {
  return reservationCalendarRows(calendar, status, unitType);
}

export function ReservationRoomCalendar(props: Props) {
  const [mode, setMode] = useState<"host" | "room-plan">("host");
  return <>
    <div className="calendar-workspace-mode" aria-label="Calendar workspace">
      <button type="button" aria-pressed={mode === "host"} onClick={() => setMode("host")}>Calendars</button>
      <button type="button" aria-pressed={mode === "room-plan"} onClick={() => setMode("room-plan")}>Room plan</button>
    </div>
    {mode === "host" ? <HostReservationCalendar key={`${props.propertyId}:${props.timezone}`} {...props} today={propertyLocalDate(props.timezone, 0)} loadCalendar={loadReservationCalendar}/> : <LegacyRoomCalendar key={`${props.propertyId}:${props.timezone}`} {...props}/>}
  </>;
}

function LegacyRoomCalendar({ propertyId, timezone, onOpenReservation }: Props) {
  const [fromDate, setFromDate] = useState(() => propertyLocalDate(timezone, 0));
  const [statusFilter, setStatusFilter] = useState("");
  const [unitTypeFilter, setUnitTypeFilter] = useState("");
  useEffect(() => { setFromDate(propertyLocalDate(timezone, 0)); }, [propertyId, timezone]);
  const toDateExclusive = addCalendarDays(fromDate, CALENDAR_WINDOW_DAYS);
  const previousFromDate = addCalendarDays(fromDate, -CALENDAR_WINDOW_DAYS);
  const nextFromDate = addCalendarDays(fromDate, CALENDAR_WINDOW_DAYS);
  const canPrevious = previousFromDate !== fromDate;
  const canNext = nextFromDate !== fromDate && addCalendarDays(nextFromDate, CALENDAR_WINDOW_DAYS) !== nextFromDate;
  const hasValidRange = toDateExclusive > fromDate;
  const query = useQuery({
    queryKey: ["reservation-calendar", propertyId, fromDate, toDateExclusive],
    queryFn: () => loadReservationCalendar(fromDate, toDateExclusive),
    enabled: Boolean(fromDate && toDateExclusive && hasValidRange),
    retry: false,
    staleTime: 10_000,
  });
  const days = useMemo(() => calendarDays(fromDate, CALENDAR_WINDOW_DAYS), [fromDate]);
  const calendar = query.data;
  const rows = useMemo(() => calendar ? filterSegments(calendar, statusFilter, unitTypeFilter) : [], [calendar, statusFilter, unitTypeFilter]);
  const visibleSegmentCount = rows.reduce((count, row) => count + row.segments.length, 0);
  const statusOptions = useMemo(() => [...new Set(calendar?.segments.map((segment) => segment.reservationStatus) ?? [])].sort(), [calendar]);
  const roomTypeOptions = useMemo(() => {
    const byId = new Map<string, Readonly<{ id: string; label: string }>>();
    for (const segment of calendar?.segments ?? []) byId.set(segment.unitTypeId, { id: segment.unitTypeId, label: `${segment.unitTypeCode} · ${segment.unitTypeLabel}` });
    for (const room of calendar?.rooms ?? []) byId.set(room.unitTypeId, { id: room.unitTypeId, label: `${room.unitTypeCode} · ${room.unitTypeLabel}` });
    return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [calendar]);
  const previous = () => setFromDate((value) => addCalendarDays(value, -CALENDAR_WINDOW_DAYS));
  const next = () => setFromDate((value) => addCalendarDays(value, CALENDAR_WINDOW_DAYS));

  return <section className="reservation-room-calendar" aria-labelledby="reservation-room-calendar-title" aria-busy={query.isFetching}>
    <header className="reservation-calendar-heading">
      <div>
        <span className="state">ROOM PLAN · READ ONLY</span>
        <h2 id="reservation-room-calendar-title">Room calendar</h2>
        <p>Seven property-local dates · stay segments and room context. Blank cells do not indicate sellable availability.</p>
      </div>
      <div className="reservation-calendar-date-controls" aria-label="Calendar date navigation">
        <button type="button" className="quiet" onClick={previous} disabled={!canPrevious} aria-label="Previous seven dates">← Previous</button>
        <label>Start date<input aria-label="Calendar start date" type="date" min="0001-01-01" max="9999-12-24" value={fromDate} onChange={(event) => { if (event.target.value) setFromDate(event.target.value); }} /></label>
        <button type="button" className="quiet" onClick={() => setFromDate(propertyLocalDate(timezone, 0))}>Today</button>
        <button type="button" className="quiet" onClick={next} disabled={!canNext} aria-label="Next seven dates">Next →</button>
      </div>
    </header>

    <div className="reservation-calendar-filters">
      <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
        <option value="">All statuses</option>
        {statusOptions.map((status) => <option key={status} value={status}>{reservationCalendarStatusLabel(status)}</option>)}
      </select></label>
      <label>Room type<select value={unitTypeFilter} onChange={(event) => setUnitTypeFilter(event.target.value)}>
        <option value="">All room types</option>
        {roomTypeOptions.map((roomType) => <option key={roomType.id} value={roomType.id}>{roomType.label}</option>)}
      </select></label>
      {calendar ? <span className="reservation-calendar-range">{calendar.fromDate} – {calendar.toDateExclusive} · {calendar.timezone}</span> : null}
    </div>

    {!hasValidRange ? <p className="empty" role="status">Choose a start date with seven calendar dates available.</p> : null}
    {query.isLoading ? <p className="empty" role="status">Loading room calendar…</p> : null}
    {query.isError ? <div className="reservation-calendar-state" role="alert"><p>Room calendar data is unavailable.</p><button type="button" onClick={() => void query.refetch()}>Retry</button></div> : null}
    {calendar?.limited || calendar?.roomsLimited ? <div className="reservation-calendar-limited" role="status">
      {calendar.limited ? <p>Stay result limit reached ({calendar.limit}). This view is partial and cannot show all stays.</p> : null}
      {calendar.roomsLimited ? <p>Room result limit reached ({calendar.roomLimit}). Some room rows may be omitted.</p> : null}
    </div> : null}
    {query.isSuccess && calendar && visibleSegmentCount === 0 ? <p className="empty" role="status">{calendar.segments.length === 0 ? "No stay segments were returned for these dates. This does not indicate whether a room is available to sell." : "No stay segments match these filters."}</p> : null}
    {query.isSuccess && calendar && rows.length > 0 ? <div className="reservation-calendar-scroll" role="region" aria-label="Room calendar grid" tabIndex={0}>
      <div className="reservation-calendar-grid" role="grid" aria-label="Rooms and stay segments by date" aria-rowcount={rows.length + 1} aria-colcount={days.length + 1}>
        <div className="reservation-calendar-row reservation-calendar-header" role="row">
          <div className="reservation-calendar-room-header" role="columnheader">Room / stay</div>
          {days.map((date) => <div role="columnheader" key={date}>{dateLabel(date)}</div>)}
        </div>
        {rows.map((row) => <div className="reservation-calendar-row" role="row" key={row.id}>
          <div className="reservation-calendar-room" role="rowheader">
            <strong>{row.label}</strong><span>{row.unitTypeLabel}</span>
            {row.assigned && row.roomCondition ? <small>Current condition: {row.roomCondition}</small> : null}
            {row.assigned && row.outOfService === true ? <small className="reservation-calendar-room-warning">Out-of-service block overlaps this date range</small> : null}
          </div>
          {days.map((date) => {
            const stays = stayForDate(row.segments, date);
            return <div className="reservation-calendar-cell" role="gridcell" aria-label={`${row.label}, ${date}, ${stays.length} stay segments`} key={date}>
              {stays.map((segment) => <button className="reservation-calendar-stay" type="button" key={`${segment.segmentId}:${date}`}
                onClick={() => onOpenReservation(segment.reservationId)}
                aria-label={`Open reservation. ${stayLabel(segment)} Segment ${segment.segmentSeq}. Room ${segment.sellableUnitLabel ?? "unassigned"}.`}>
                <strong>{segment.primaryGuestDisplayName}</strong>
                <span>{segment.confirmationNo} · {reservationCalendarStatusLabel(segment.reservationStatus)}</span>
                <small>{segment.clipFromDate} → {segment.clipToDateExclusive}{segment.continuesBefore ? " · continued" : ""}{segment.continuesAfter ? " · continues" : ""}</small>
              </button>)}
            </div>;
          })}
        </div>)}
      </div>
    </div> : null}
    {calendar && (calendar.limited || calendar.roomsLimited) ? <p className="reservation-calendar-footer">This limited result is a planning view only. It does not represent full room availability or sellability.</p> : null}
  </section>;
}
