import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { reservationCalendarRows, segmentOccupiesCalendarDate,
  type ReservationCalendar, type ReservationCalendarRow, type ReservationCalendarSegment } from "../reservation-calendar";
import { calendarBarTone, calendarMatchesContext, calendarMonthDates, calendarMonthWeeks, calendarSegmentBadge, calendarSegmentLabel, calendarWeekBars, monthStart,
  shiftCalendarMonth, type CalendarView } from "../reservation-calendar-views";
import "./host-reservation-calendar.css";

type CalendarLoader = (fromDate: string, toDateExclusive: string) => Promise<ReservationCalendar>;
type Props = Readonly<{ propertyId: string; timezone: string; onOpenReservation: (id: string) => void; loadCalendar: CalendarLoader }>;
type IconName = CalendarView | "back" | "next" | "today" | "close" | "room";
function CalendarIcon({ name }: { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "list" ? <><rect x="4" y="3" width="16" height="4" rx=".6"/><rect x="4" y="10" width="16" height="4" rx=".6"/><rect x="4" y="17" width="16" height="4" rx=".6"/></> : null}
    {name === "month" ? [3, 13].flatMap(x => [3, 13].map(y => <rect key={`${x}:${y}`} x={x} y={y} width="8" height="8" rx="1"/>)) : null}
    {name === "year" ? [3, 10, 17].flatMap(x => [3, 10, 17].map(y => <rect key={`${x}:${y}`} x={x} y={y} width="4" height="4" rx=".5"/>)) : null}
    {name === "back" ? <path d="m14 5-7 7 7 7M7 12h14"/> : null}
    {name === "next" ? <path d="m10 5 7 7-7 7M17 12H3"/> : null}
    {name === "today" ? <path d="M12 20V4m-7 7 7-7 7 7"/> : null}
    {name === "close" ? <path d="m6 6 12 12M6 18 18 6"/> : null}
    {name === "room" ? <><path d="M5 21V3h14v18M3 21h18M9 7h6M9 11h6M10 21v-6h4v6"/></> : null}
  </svg>;
}

function formatted(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
function monthLabel(date: string) { return formatted(date, { month: "long", year: "numeric" }); }
function dateLabel(date: string) { return formatted(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function initials(name: string) { return name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0]).join(""); }
function stayLabel(stay: ReservationCalendarSegment) {
  return `${stay.primaryGuestDisplayName} · ${stay.confirmationNo} · ${calendarSegmentLabel(stay)} · ${stay.localFromDate} to ${stay.localToDateExclusive}`;
}

function useCalendarMonth(propertyId: string, timezone: string, month: string, loadCalendar: CalendarLoader, enabled = true) {
  const end = shiftCalendarMonth(month, 1);
  return useQuery({
    queryKey: ["host-reservation-calendar", propertyId, timezone, month, end],
    queryFn: async () => {
      const result = await loadCalendar(month, end);
      // Never paint a response for a property or range that has since changed.
      if (!calendarMatchesContext(result, propertyId, timezone, month, end)) {
        throw new Error("Calendar response does not match the selected property and dates.");
      }
      return result;
    },
    enabled: enabled && Boolean(month && end && end > month), retry: false, staleTime: 10_000,
  });
}

function PartialNotice({ calendar }: { calendar: ReservationCalendar }) {
  return calendar.limited || calendar.roomsLimited ? <p className="host-calendar-notice" role="status">
    Partial calendar: {calendar.limited ? `the ${calendar.limit}-stay limit was reached. ` : ""}
    {calendar.roomsLimited ? `The ${calendar.roomLimit}-room limit was reached. ` : ""}Some records may be missing.
  </p> : null;
}

function MiniMonth({ month, today, segments = [] }: { month: string; today: string; segments?: readonly ReservationCalendarSegment[] }) {
  return <span className="host-mini-month" aria-hidden="true">{calendarMonthWeeks(month).flat().map((date, index) =>
    <span key={date ?? `blank-${index}`} className={!date ? "is-empty" : date === today ? "is-today" : segments.some(stay => segmentOccupiesCalendarDate(stay, date)) ? "has-stay" : ""}/>
  )}</span>;
}

function YearMonth({ propertyId, timezone, month, today, rowId, onOpen, loadCalendar }: Readonly<{
  propertyId: string; timezone: string; month: string; today: string; rowId: string; onOpen: () => void; loadCalendar: CalendarLoader;
}>) {
  const element = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!element.current) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "120px" });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  // At most twelve bounded month reads, fetched only as the year cards enter view.
  const query = useCalendarMonth(propertyId, timezone, month, loadCalendar, visible);
  const calendar = query.isSuccess ? query.data : undefined;
  const row = calendar ? reservationCalendarRows(calendar).find(item => item.id === rowId) : undefined;
  const status = query.isError ? "Unavailable · open to retry" : !calendar ? "Not loaded" : calendar.limited || calendar.roomsLimited ? "Partial stays" : row ? `${row.segments.length} stay segments` : "Room not returned";
  return <button ref={element} type="button" className="host-year-month" onClick={onOpen} aria-label={`Open ${monthLabel(month)}. ${status}`}>
    <span>{formatted(month, { month: "short" })} <small>{month.slice(0, 4)}</small></span>
    <MiniMonth month={month} today={today} segments={row?.segments ?? []}/><small>{status}</small>
  </button>;
}

/** Shared calendar presentation. Reservations supplies stay actions; a future RMS
 * controller can supply authoritative day content without owning reservation state. */
export function HostCalendarMonth({ month, today, segments, selectedDate, onSelectDate, onOpenReservation, renderDayContent }: Readonly<{
  month: string; today: string; segments: readonly ReservationCalendarSegment[]; selectedDate: string | null;
  onSelectDate: (date: string) => void; onOpenReservation: (id: string) => void;
  renderDayContent?: (date: string) => ReactNode;
}>) {
  return <div className="host-month-grid" aria-label={monthLabel(month)}>
    {calendarMonthWeeks(month).map((week, weekIndex) => {
      const bars = calendarWeekBars(week, segments);
      const lanes = Math.max(1, ...bars.map(bar => bar.lane + 1));
      return <div className="host-calendar-week" key={weekIndex} style={{ "--calendar-lanes": lanes } as CSSProperties}>
        {week.map((date, column) => date ? <button type="button" key={date}
          className={`host-calendar-day${date < today ? " is-past" : ""}${date === today ? " is-today" : ""}${date === selectedDate ? " is-selected" : ""}`}
          style={{ gridColumn: column + 1 }} data-calendar-date={date} aria-label={dateLabel(date)} aria-pressed={date === selectedDate}
          aria-current={date === today ? "date" : undefined} onClick={() => onSelectDate(date)}>
          <span className="host-day-number">{Number(date.slice(-2))}</span>
          {renderDayContent ? <span className="host-day-content">{renderDayContent(date)}</span> : null}
        </button> : <span className="host-calendar-blank" style={{ gridColumn: column + 1 }} key={`empty-${column}`}/>)}
        {bars.map(bar => <button type="button" key={bar.segment.segmentId}
          className={`host-booking-bar tone-${calendarBarTone(bar.segment)}${bar.starts ? " starts" : ""}${bar.ends ? " ends" : ""}`}
          style={{ gridColumn: `${bar.column} / span ${bar.span}`, gridRow: 1, alignSelf: "start", marginTop: 42 + bar.lane * 33 }}
          onClick={() => onOpenReservation(bar.segment.reservationId)} aria-label={`Open reservation: ${stayLabel(bar.segment)}`} title={stayLabel(bar.segment)}>
          <span className="host-guest-avatar" aria-hidden="true">{initials(bar.segment.primaryGuestDisplayName)}</span>
          <span className="host-guest-name">{bar.segment.primaryGuestDisplayName}</span>
          <span className="host-bar-status" title={calendarSegmentLabel(bar.segment)}>{calendarSegmentBadge(bar.segment)}</span>
        </button>)}
      </div>;
    })}
  </div>;
}

function MonthPanel({ propertyId, timezone, month, rowId, today, selectedDate, onSelect, onOpenReservation, view, loadCalendar, todayJump }: Props & Readonly<{
  month: string; rowId: string; today: string; selectedDate: string | null; view: "list" | "month";
  onSelect: (date: string) => void;
  todayJump: number;
}>) {
  const query = useCalendarMonth(propertyId, timezone, month, loadCalendar);
  // Even a failed background refresh must not leave stale operational data presented as current.
  const calendar = query.isSuccess ? query.data : undefined;
  const row = useMemo(() => calendar ? reservationCalendarRows(calendar).find(item => item.id === rowId) : undefined, [calendar, rowId]);
  const monthElement = useRef<HTMLElement>(null);
  useEffect(() => {
    if (todayJump && calendar && month === monthStart(today)) monthElement.current?.querySelector(`[data-calendar-date="${today}"]`)?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [todayJump, Boolean(calendar), month, today, view]);
  return <section ref={monthElement} className="host-calendar-month" aria-label={monthLabel(month)} aria-busy={query.isFetching}>
    <h3>{monthLabel(month)}</h3>
    {query.isLoading ? <p role="status" className="host-calendar-notice">Loading {monthLabel(month)}…</p> : null}
    {query.isError ? <div className="host-calendar-notice" role="alert">This month could not be loaded. <button type="button" onClick={() => void query.refetch()}>Retry month</button></div> : null}
    {calendar ? <><PartialNotice calendar={calendar}/>
      {!row ? <p className="host-calendar-notice">No room record returned for this month. Availability is unknown.</p> : null}
      {view === "month" ? <HostCalendarMonth month={month} today={today} segments={row?.segments ?? []} selectedDate={selectedDate}
        onSelectDate={onSelect} onOpenReservation={onOpenReservation}/> :
        <div className="host-calendar-list">{calendarMonthDates(month).map(date => {
          const stays = row?.segments.filter(stay => segmentOccupiesCalendarDate(stay, date)) ?? [];
          return <div key={date} data-calendar-date={date} className={`host-calendar-list-day${date === today ? " is-today" : ""}${date === selectedDate ? " is-selected" : ""}`}>
            <button type="button" className="host-list-date" onClick={() => onSelect(date)} aria-label={`Details for ${dateLabel(date)}`} aria-current={date === today ? "date" : undefined}>
              <strong>{Number(date.slice(-2))}</strong><span>{formatted(date, { weekday: "short" })}</span>
            </button>
            <div className="host-list-stays">{stays.length ? stays.map(stay => <button type="button" key={stay.segmentId} className={`host-list-stay tone-${calendarBarTone(stay)}`} onClick={() => onOpenReservation(stay.reservationId)} aria-label={`Open reservation: ${stayLabel(stay)}`}>
              <strong>{stay.primaryGuestDisplayName}</strong><span>{calendarSegmentLabel(stay)} · {stay.confirmationNo}</span>
            </button>) : <><span>No recorded stay</span><small>Availability not checked</small></>}</div>
          </div>;
        })}</div>}
    </> : null}
  </section>;
}

function DateDetails({ propertyId, timezone, date, rowId, roomLabel, onClose, onOpenReservation, loadCalendar }: Props & Readonly<{
  date: string; rowId: string; roomLabel: string; onClose: () => void;
}>) {
  const query = useCalendarMonth(propertyId, timezone, monthStart(date), loadCalendar);
  const calendar = query.isSuccess ? query.data : undefined;
  const row = calendar ? reservationCalendarRows(calendar).find(item => item.id === rowId) : undefined;
  const stays = row?.segments.filter(stay => segmentOccupiesCalendarDate(stay, date)) ?? [];
  return <aside className="host-calendar-selection" aria-label={`Selected date ${dateLabel(date)}`}>
    <header><div><small>{roomLabel}</small><h3>{formatted(date, { day: "numeric", month: "long" })}</h3></div><button type="button" className="host-calendar-icon" onClick={onClose} aria-label="Close date details"><CalendarIcon name="close"/></button></header>
    {query.isLoading ? <p role="status">Loading date details…</p> : null}
    {query.isError ? <div role="alert">Date details are unavailable. <button type="button" onClick={() => void query.refetch()}>Retry date details</button></div> : null}
    {calendar ? <><PartialNotice calendar={calendar}/><div className="host-selection-stays">{stays.length ? stays.map(stay => <button type="button" key={stay.segmentId} onClick={() => onOpenReservation(stay.reservationId)}>
      <span className="host-guest-avatar" aria-hidden="true">{initials(stay.primaryGuestDisplayName)}</span><span><strong>{stay.primaryGuestDisplayName}</strong><small>{stay.confirmationNo} · {calendarSegmentLabel(stay)}</small></span><CalendarIcon name="next"/>
    </button>) : <p>{row ? "No recorded stay on this date." : "No room record returned for this month."} Check availability through the reservation workflow before making a booking.</p>}</div></> : null}
    <p className="host-selection-note">Open a stay to manage its reservation. Pricing and availability edits are not enabled in this calendar.</p>
  </aside>;
}

export function HostReservationCalendar({ propertyId, timezone, onOpenReservation, loadCalendar, today }: Props & { today: string }) {
  const [month, setMonth] = useState(() => monthStart(today));
  const [view, setView] = useState<CalendarView>("month");
  const [selectedRow, setSelectedRow] = useState<ReservationCalendarRow | null>(null);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string | null>(null);
  const [todayJump, setTodayJump] = useState(0);
  const query = useCalendarMonth(propertyId, timezone, month, loadCalendar);
  const calendar = query.isSuccess ? query.data : undefined;
  const rows = useMemo(() => calendar ? reservationCalendarRows(calendar) : [], [calendar]);
  const visibleRows = useMemo(() => rows.filter(row => `${row.label} ${row.unitTypeLabel}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [rows, search]);
  const viewMenu = useRef<HTMLDetailsElement>(null);
  const heading = useRef<HTMLElement>(null);
  const months = [month, shiftCalendarMonth(month, 1), shiftCalendarMonth(month, 2)].filter(date => date && shiftCalendarMonth(date, 1));
  const goToMonth = (date: string) => {
    if (!date || !shiftCalendarMonth(date, 1)) return;
    setMonth(date); setSelection(null);
  };
  const goToday = () => { goToMonth(monthStart(today)); setTodayJump(value => value + 1); if (view === "year") heading.current?.scrollIntoView({ block: "start", behavior: "auto" }); };

  return <section className="host-calendar" aria-label="Reservation calendars">
    <header className="host-calendar-heading" ref={heading}>
      {selectedRow ? <button type="button" className="host-calendar-icon" aria-label="Back to calendars" title="Choose a room or listing" onClick={() => { setSelectedRow(null); setSelection(null); }}><CalendarIcon name="back"/></button> : null}
      <div className="host-calendar-title"><h2>{selectedRow?.label ?? "Calendars"}</h2><span>{selectedRow?.unitTypeLabel ?? "Choose a room or listing"}</span></div>
      {selectedRow ? <details className="host-view-menu" ref={viewMenu} onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
        <summary className="host-calendar-icon" aria-label={`Calendar view: ${view}. Change view`} title="Change calendar view"><CalendarIcon name={view}/></summary>
        <div className="host-view-options" aria-label="Calendar style">{(["list", "month", "year"] as const).map(option =>
          <button type="button" key={option} aria-pressed={option === view} onClick={() => { setView(option); setSelection(null); if (viewMenu.current) { viewMenu.current.open = false; viewMenu.current.querySelector("summary")?.focus(); } }}>
            <span>{option[0]!.toUpperCase() + option.slice(1)}</span><CalendarIcon name={option}/>
          </button>)}</div>
      </details> : null}
    </header>

    {!selectedRow ? <>
      <label className="host-calendar-search"><span className="host-calendar-sr">Search rooms and listings</span><input type="search" placeholder="Search rooms and listings" value={search} onChange={event => setSearch(event.target.value)}/></label>
      {query.isLoading ? <p role="status">Loading calendars…</p> : null}
      {query.isError ? <div role="alert" className="host-calendar-notice">Calendars could not be loaded. <button type="button" onClick={() => void query.refetch()}>Retry</button></div> : null}
      {calendar ? <><PartialNotice calendar={calendar}/><div className="host-calendar-picker">{visibleRows.map(row =>
        <button type="button" className="host-calendar-room-card" key={row.id} onClick={() => { setSelectedRow(row); setSelection(null); }}>
          <span className="host-room-tile"><CalendarIcon name="room"/><small>{row.assigned ? "Room" : "Unassigned"}</small></span>
          <span className="host-room-description"><strong>{row.label}</strong><span>{row.unitTypeLabel}</span><small>{row.assigned ? row.roomCondition ? `Currently ${row.roomCondition}` : "Room condition not recorded" : "Room assignment pending"}</small></span>
          <MiniMonth month={month} today={today} segments={row.segments}/>
        </button>
      )}</div>{!visibleRows.length ? <p role="status">{rows.length ? "No calendars match your search." : "No room or stay records were returned."}</p> : null}</> : null}
    </> : <>
      <div className="host-calendar-navigation" aria-label="Calendar dates">
        <button type="button" className="host-calendar-icon" disabled={!shiftCalendarMonth(month, view === "year" ? -12 : -1)} aria-label={view === "year" ? "Previous year" : "Previous month"} onClick={() => goToMonth(shiftCalendarMonth(month, view === "year" ? -12 : -1))}><CalendarIcon name="back"/></button>
        <label><span className="host-calendar-sr">Jump to month</span><input type="month" aria-label="Jump to month" min="0001-01" max="9999-10" value={month.slice(0, 7)} onChange={event => goToMonth(monthStart(`${event.target.value}-01`))}/></label>
        <button type="button" className="host-calendar-icon" disabled={!shiftCalendarMonth(month, view === "year" ? 12 : 1) || !shiftCalendarMonth(month, view === "year" ? 13 : 2)} aria-label={view === "year" ? "Next year" : "Next month"} onClick={() => goToMonth(shiftCalendarMonth(month, view === "year" ? 12 : 1))}><CalendarIcon name="next"/></button>
      </div>
      {view === "year" ? <div className="host-calendar-year" aria-label="Year overview">{Array.from({ length: 12 }, (_, index) => shiftCalendarMonth(month, index)).filter(date => date && shiftCalendarMonth(date, 1)).map(date =>
        <YearMonth key={`${selectedRow.id}:${date}`} propertyId={propertyId} timezone={timezone} month={date} today={today} rowId={selectedRow.id} loadCalendar={loadCalendar} onOpen={() => { goToMonth(date); setView("month"); }}/>
      )}<p className="host-year-note">Dark dots: recorded stays. Green: today. Dots do not confirm availability.</p></div> : <>
        {view === "month" ? <div className="host-calendar-weekdays" aria-hidden="true">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={index}>{day}</span>)}</div> : null}
        {(view === "month" ? months : [month]).map(date => <MonthPanel key={`${selectedRow.id}:${date}`} propertyId={propertyId} timezone={timezone} month={date} rowId={selectedRow.id} today={today} view={view} loadCalendar={loadCalendar}
          selectedDate={selection} onSelect={setSelection} onOpenReservation={onOpenReservation} todayJump={todayJump}/>)}
      </>}
      <p className="host-calendar-legend">RSV · Reserved &nbsp; ARR · Arrival &nbsp; IN · In house &nbsp; DUE · Due out &nbsp; OUT · Departed</p>
      <div className="host-calendar-bottom"><p>Blank dates are not confirmed availability. Rates are managed separately.</p><button type="button" className="host-calendar-today" onClick={goToday}><CalendarIcon name="today"/> Today</button></div>
      {selection ? <DateDetails propertyId={propertyId} timezone={timezone} date={selection} rowId={selectedRow.id} roomLabel={selectedRow.label} onClose={() => setSelection(null)} onOpenReservation={onOpenReservation} loadCalendar={loadCalendar}/> : null}
    </>}
  </section>;
}
