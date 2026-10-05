import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadReservationCalendarBoard, propertyLocalDate } from "../yellow-api";
import { calendarDateOffset, calendarDayBoundary, calendarDays, calendarGuest, calendarLocalDate, filterCalendarEntries, isCalendarDate, projectCalendar, type CalendarStay } from "../reservation-calendar";
import { operationalStateLabel } from "../reservation-board";
import { SegmentedRibbon } from "../ui/SegmentedRibbon";
import "./reservation-calendar.css";

type CalendarView = "active" | "all";
export function CalendarTimeline({ stays, start, days, timezone, search, view, limit, onOpen }: Readonly<{
  stays: readonly CalendarStay[]; start: string; days: number; timezone: string;
  search: string; view: CalendarView; limit: number; onOpen: (id: string) => void;
}>) {
  const projection = projectCalendar(stays, start, days, timezone);
  const entries = filterCalendarEntries(projection.entries, search, view);
  const stayTime = (value: string) => new Intl.DateTimeFormat("en", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <>
    <p className="calendar-count" role="status">{entries.length} stay{entries.length === 1 ? "" : "s"} · {entries.length > limit ? `Showing first ${limit}. Use Show more below.` : "All matching stays shown."}</p>
    {projection.invalid > 0 ? <p className="error" role="alert">{projection.invalid} reservation record{projection.invalid === 1 ? " has" : "s have"} incomplete or conflicting dates. The calendar is incomplete; refresh or use the list to inspect.</p> : null}
    {!entries.length ? <p className="empty">{projection.entries.length ? "No matching recorded stays in this date range." : "No recorded stays in this date range."}</p> : <div className="calendar-scroll" tabIndex={0} role="region" aria-label="Reservation stay calendar; scroll horizontally for more dates">
      <div className="calendar-timeline" role="table" aria-label="Reservation stay summaries" aria-colcount={days + 1} aria-rowcount={entries.length + 1} style={{ gridTemplateColumns: `220px repeat(${days}, minmax(76px, 1fr))` }}>
        <div role="row" className="calendar-heading"><div role="columnheader" className="calendar-label">Guest / reservation</div>{projection.dates.map(date => <div role="columnheader" key={date} className="calendar-date"><span>{new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span><strong>{date.slice(8)}</strong><small>{new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</small></div>)}</div>
        {entries.slice(0, limit).map(entry => <div role="row" className="calendar-row" key={entry.stay.reservationId}>
          <div role="rowheader" className="calendar-label"><strong>{calendarGuest(entry.stay)}</strong><small>{entry.stay.confirmationNo} · {entry.stay.unitTypeLabel ?? "Room type pending"}</small></div>
          <div role="cell" aria-colindex={entry.start + 2} aria-colspan={entry.span} className="calendar-stay-cell" style={{ gridColumn: `${entry.start + 2} / span ${entry.span}` }}>
            <button type="button" className="calendar-stay" data-state={entry.stay.status} data-departure-only={entry.departureOnly} onClick={() => onOpen(entry.stay.reservationId)} aria-label={`${calendarGuest(entry.stay)}, ${entry.stay.confirmationNo}, ${stayTime(entry.stay.stayFrom!)} to ${stayTime(entry.stay.stayTo!)}${entry.dayUse ? ", day use" : entry.departureOnly ? ", departure marker" : ""}, ${operationalStateLabel(entry.stay.operationalState ?? entry.stay.status)}`} title={`${stayTime(entry.stay.stayFrom!)} → ${stayTime(entry.stay.stayTo!)} · ${entry.stay.channelCode ?? "Source not returned"}`}>
              <strong>{entry.continuesBefore ? "← " : ""}{calendarGuest(entry.stay)}{entry.continuesAfter ? " →" : ""}</strong><span>{entry.dayUse ? "Day use · " : entry.departureOnly ? "Departure · " : ""}{operationalStateLabel(entry.stay.operationalState ?? entry.stay.status)} · {entry.stay.channelCode ?? "Source not returned"}</span>
            </button>
          </div>
        </div>)}
      </div>
    </div>}
    <p className="commercial-note">Stay summaries in {timezone}. Departure dates are exclusive for overnight stays. Room changes and gaps within split stays are shown in reservation details. Blank cells do not confirm availability.</p>
  </>;
}

export function ReservationCalendar({ propertyId, timezone, onOpen }: Readonly<{ propertyId: string; timezone: string; onOpen: (id: string) => void }>) {
  const [start, setStart] = useState(() => { try { return propertyLocalDate(timezone, 0); } catch { return ""; } });
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [search, setSearch] = useState(""); const [view, setView] = useState<CalendarView>("active");
  const [limit, setLimit] = useState(100);
  const timezoneValid = useMemo(() => { try { calendarLocalDate("2000-01-01T12:00:00Z", timezone); return true; } catch { return false; } }, [timezone]);
  const range = useMemo(() => {
    if (!isCalendarDate(start)) return null;
    try {
      calendarDays(start, days);
      const from = calendarDayBoundary(start, timezone), to = calendarDayBoundary(calendarDateOffset(start, days), timezone);
      if (to <= from) return null;
      return { from, to };
    } catch { return null; }
  }, [start, days, timezone]);
  const board = useQuery({ queryKey: ["reservation-board", propertyId, "calendar", timezone, range?.from, range?.to],
    queryFn: ({ signal }) => loadReservationCalendarBoard({ ...range!, signal }), enabled: range !== null });
  const matchingCount = range && board.data && !board.isError ? filterCalendarEntries(projectCalendar(board.data.reservations ?? [], start, days, timezone).entries, search, view).length : 0;
  const move = (offset: number) => { setStart(calendarDateOffset(start, offset)); setLimit(100); };
  return <section className="reservation-calendar detail-card" aria-labelledby="reservation-calendar-title">
    <div className="section-heading"><div><span>RESERVATIONS</span><h2 id="reservation-calendar-title">Calendar</h2></div><button type="button" className="quiet" disabled={!range || board.isFetching} onClick={() => void board.refetch()}>{board.isFetching ? "Refreshing…" : "Refresh"}</button></div>
    <div className="calendar-controls">
      <div className="calendar-date-controls"><button type="button" aria-label="Previous date range" disabled={!range} onClick={() => move(-days)}>←</button><button type="button" className="quiet" disabled={!timezoneValid} onClick={() => { setStart(propertyLocalDate(timezone, 0)); setLimit(100); }}>Today</button><button type="button" aria-label="Next date range" disabled={!range} onClick={() => move(days)}>→</button><label>From<input type="date" value={start} onChange={event => { setStart(event.target.value); setLimit(100); }} /></label></div>
      <SegmentedRibbon label="Calendar date range" items={[{ key: "7", label: "7 days" }, { key: "14", label: "14 days" }, { key: "30", label: "30 days" }]} value={String(days) as "7" | "14" | "30"} onChange={value => { setDays(Number(value) as 7 | 14 | 30); setLimit(100); }} />
    </div>
    <div className="calendar-filter-controls"><label>Find a stay<input type="search" placeholder="Guest, confirmation, room type or source" value={search} onChange={event => { setSearch(event.target.value); setLimit(100); }} /></label><label>Show<select value={view} onChange={event => { setView(event.target.value as CalendarView); setLimit(100); }}><option value="active">Stays excluding cancelled / no-show</option><option value="all">All recorded stays</option></select></label></div>
    {!range ? <p className="error" role="alert">{timezoneValid ? "Choose a valid start date in the property timezone." : "The property timezone is unavailable. Calendar data cannot be displayed."}</p> : board.isPending ? <p className="empty">Loading the stay calendar…</p> : board.isError ? <p className="error" role="alert">{board.error.message} Calendar data is unavailable.</p> : board.data ? <>
      <CalendarTimeline stays={board.data.reservations ?? []} start={start} days={days} timezone={timezone} search={search} view={view} limit={limit} onOpen={onOpen} />
      {matchingCount > limit ? <button type="button" className="quiet" onClick={() => setLimit(value => value + 100)}>Show more stays</button> : null}
    </> : <p className="error">Calendar data is unavailable.</p>}
  </section>;
}
