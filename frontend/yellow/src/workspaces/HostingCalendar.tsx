import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  assignCalendarLanes,
  calendarDateOffset,
  calendarMonthDates,
  calendarStatusLabel,
  calendarYearMonths,
  isCalendarDate,
  projectCalendarPage,
  selectCalendarRange,
  type CalendarEntry,
  type CalendarMode,
  type CalendarPage,
  type CalendarProjection,
  type CalendarRange,
} from "../hosting-calendar";
import "./hosting-calendar.css";

type TimelinePage = Readonly<{ label: string; page: CalendarPage }>;

export type HostingCalendarProps = Readonly<{
  page: CalendarPage | null;
  startDate: string;
  mode: CalendarMode;
  timezone: string;
  loading: boolean;
  error: string | null;
  onMode: (mode: CalendarMode) => void;
  onDate: (date: string) => void;
  onOpen: (reservationId: string) => void;
  onRefresh: () => void;
  timelinePages?: readonly TimelinePage[] | null;
}>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });
const HUMAN_DATE = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const dayLabel = (date: string) => isCalendarDate(date) ? HUMAN_DATE.format(new Date(`${date}T12:00:00Z`)) : "Date unavailable";
const monthTitle = (date: string) => MONTH_NAMES.format(new Date(`${date.slice(0, 7)}-01T12:00:00Z`));
const monthIndex = (date: string) => Number(date.slice(5, 7)) - 1;
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const monthEndExclusive = (date: string) => {
  const month = Number(date.slice(5, 7));
  const year = Number(date.slice(0, 4));
  return `${year + Number(month === 12)}-${String(month % 12 + 1).padStart(2, "0")}-01`;
};
const monthLength = (date: string) => Number(calendarDateOffset(monthEndExclusive(date), -1).slice(8, 10));
const propertyToday = (timezone: string) => {
  try {
    const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(Date.now()).map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return "";
  }
};

function formatStay(instant: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(instant));
  } catch {
    return "Time unavailable";
  }
}

function propertyName(page: CalendarPage, label: string): string {
  return label.trim() || page.propertyId;
}

function propertyIsIncomplete(page: CalendarPage, projection: CalendarProjection): boolean {
  return page.limited || page.roomsLimited || projection.invalid.length > 0;
}

function monthCoverage(page: CalendarPage, date: string): boolean {
  return date >= page.fromDate && date < page.toDateExclusive;
}

function MonthWeek({
  dates,
  weekIndex,
  entries,
  page,
  selected,
  onSelectDate,
  onSelectEntry,
  activeKey,
}: Readonly<{
  dates: readonly (string | null)[];
  weekIndex: number;
  entries: readonly CalendarEntry[];
  page: CalendarPage;
  selected: CalendarRange | null;
  onSelectDate: (date: string) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
  activeKey: string | null;
}>) {
  const weekStart = weekIndex * 7;
  const weekEntries = entries.flatMap(entry => {
    const start = Math.max(entry.start, weekStart);
    const end = Math.min(entry.endExclusive, weekStart + 7);
    return end > start ? [{ ...entry, start: start - weekStart, endExclusive: end - weekStart }] : [];
  });
  const lanes = assignCalendarLanes(weekEntries, "calendar");
  const rowCount = Math.max(1, ...lanes.map(item => item.lane + 1));
  return <div className="hosting-week" role="row" style={{ "--hosting-lanes": rowCount } as CSSProperties}>
    {dates.map((date, index) => {
      const inRange = Boolean(date && selected && (selected.to
        ? date >= selected.from && date <= selected.to
        : date === selected.from));
      const dateEntries = date ? entries.filter(entry => entry.start <= weekStart + index && entry.endExclusive > weekStart + index) : [];
      const loaded = Boolean(date && monthCoverage(page, date));
      const marker = date && selected?.from === date ? "range-start" : date && selected?.to === date ? "range-end" : undefined;
      return date ? <button
        key={date}
        type="button"
        role="gridcell"
        className="hosting-day"
        data-covered={loaded}
        data-in-range={inRange}
        data-range-edge={marker}
        aria-label={`${dayLabel(date)}${loaded ? dateEntries.length ? `, ${dateEntries.length} recorded segment${dateEntries.length === 1 ? "" : "s"}` : ", no reservation segment returned" : ", reservation data not loaded"}; rate not returned`}
        aria-pressed={inRange}
        onClick={() => onSelectDate(date)}
        style={{ gridColumn: index + 1, gridRow: 1 }}
      ><span className="hosting-day-number">{Number(date.slice(8, 10))}</span><span className="hosting-day-rate" aria-label="Rate not returned">—</span>{!loaded ? <span className="hosting-day-loading">Not loaded</span> : null}</button> : <span key={`blank-${weekIndex}-${index}`} className="hosting-day hosting-day-blank" aria-hidden="true" style={{ gridColumn: index + 1, gridRow: 1 }} />;
    })}
    {lanes.map(({ entry, lane }) => {
      const segment = entry.segment;
      const label = segment.primaryGuestDisplayName?.trim() || "Guest name not returned";
      const canOpen = entry.openable;
      const startDate = dates[entry.start] ?? entry.segment.localFromDate;
      const endDate = dates[entry.endExclusive - 1] ?? entry.segment.localToDateExclusive;
      return <button
        key={entry.key}
        type="button"
        className="hosting-booking-pill"
        data-active={activeKey === entry.key}
        data-status={segment.reservationStatus}
        data-unassigned={segment.sellableUnitId === null}
        disabled={!canOpen}
        aria-label={`${label}, ${segment.confirmationNo || "confirmation not returned"}, ${dayLabel(startDate)}${entry.dayUse ? ", day use" : ` through ${dayLabel(endDate)}`}, ${calendarStatusLabel(segment.reservationStatus)}${canOpen ? ". Select for details" : ". Invalid identity; opening is disabled"}`}
        title={`${label} · ${segment.confirmationNo || "Reservation reference not returned"}`}
        onClick={() => onSelectEntry(entry)}
        style={{ gridColumn: `${entry.start + 1} / span ${entry.endExclusive - entry.start}`, gridRow: lane + 2 }}
      ><span>{segment.continuesBefore || entry.start > 0 ? "← " : ""}{label}{segment.continuesAfter || entry.endExclusive < 7 ? " →" : ""}</span></button>;
    })}
  </div>;
}

function MonthView({
  date,
  page,
  projection,
  selected,
  onSelectDate,
  onSelectEntry,
  activeKey,
}: Readonly<{
  date: string;
  page: CalendarPage;
  projection: CalendarProjection;
  selected: CalendarRange | null;
  onSelectDate: (date: string) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
  activeKey: string | null;
}>) {
  const weeks = calendarMonthDates(date);
  const leading = weeks[0]?.findIndex(day => day !== null) ?? 0;
  const gridEntries = projection.entries.map(entry => ({ ...entry, start: entry.start + leading, endExclusive: entry.endExclusive + leading }));
  return <div className="hosting-month" role="grid" aria-label={`${monthTitle(date)} ${date.slice(0, 4)} reservation calendar`}>
    <div className="hosting-weekdays" role="row">{WEEKDAYS.map(day => <span role="columnheader" key={day}>{day}</span>)}</div>
    {weeks.map((week, index) => <MonthWeek key={`${date}-${index}`} dates={week} weekIndex={index} entries={gridEntries.filter(entry => entry.start < (index + 1) * 7 && entry.endExclusive > index * 7)} page={page} selected={selected} onSelectDate={onSelectDate} onSelectEntry={onSelectEntry} activeKey={activeKey} />)}
  </div>;
}

function YearView({ page, year, entries, onOpenMonth, onSelectDate }: Readonly<{
  page: CalendarPage;
  year: number;
  entries: readonly CalendarEntry[];
  onOpenMonth: (date: string) => void;
  onSelectDate: (date: string) => void;
}>) {
  const months = calendarYearMonths(year);
  return <div className="hosting-year" aria-label={`Year ${year}`}>
    {months.map(month => {
      const dates = calendarMonthDates(month);
      return <section className="hosting-mini-month" key={month} aria-labelledby={`hosting-year-${month}`}>
        <button type="button" className="hosting-mini-title" id={`hosting-year-${month}`} onClick={() => onOpenMonth(month)}>{monthTitle(month)}</button>
        <div className="hosting-mini-grid" role="grid" aria-label={`${monthTitle(month)} ${year}`}>
          {WEEKDAYS.map(day => <span role="columnheader" key={day}>{day.slice(0, 1)}</span>)}
          {dates.flatMap((week, row) => week.map((date, column) => date ? <button
            key={date}
            type="button"
            role="gridcell"
            data-covered={monthCoverage(page, date)}
            data-has-segment={entries.some(entry => entry.segment.localFromDate <= date && date < entry.segment.localToDateExclusive || entry.dayUse && entry.segment.localFromDate === date)}
            aria-label={`${dayLabel(date)}${monthCoverage(page, date) ? ", calendar data loaded" : ", calendar data not loaded"}`}
            onClick={() => onSelectDate(date)}
            style={{ gridColumn: column + 1, gridRow: row + 2 }}
          >{Number(date.slice(8, 10))}</button> : <span key={`blank-${row}-${column}`} aria-hidden="true" style={{ gridColumn: column + 1, gridRow: row + 2 }} />))}
        </div>
      </section>;
    })}
  </div>;
}

function TimelineProperty({
  label,
  page,
  startDate,
  projection,
  onSelectEntry,
  activeKey,
}: Readonly<{
  label: string;
  page: CalendarPage;
  startDate: string;
  projection: CalendarProjection;
  onSelectEntry: (entry: CalendarEntry) => void;
  activeKey: string | null;
}>) {
  const days = monthLength(startDate);
  const rows: { id: string | null; label: string; type: string }[] = page.rooms.map(room => ({ id: room.sellableUnitId, label: room.sellableUnitLabel, type: room.unitTypeLabel }));
  for (const entry of projection.entries) {
    const segment = entry.segment;
    if (segment.sellableUnitId && !rows.some(row => row.id === segment.sellableUnitId)) {
      rows.push({ id: segment.sellableUnitId, label: "Listing omitted from limited results", type: segment.unitTypeLabel });
    }
  }
  if (projection.entries.some(entry => entry.segment.sellableUnitId === null)) rows.push({ id: null, label: "Listing not assigned", type: "Recorded stay" });
  return <section className="hosting-property-timeline" aria-label={`${propertyName(page, label)} timeline`}>
    <h3>{propertyName(page, label)} <span>{page.timezone}</span></h3>
    <div className="hosting-timeline-scroll" role="region" tabIndex={0} aria-label={`${propertyName(page, label)} calendar timeline; scroll horizontally for dates`}>
          <div className="hosting-timeline" style={{ "--hosting-day-count": days } as CSSProperties}>
        <div className="hosting-timeline-heading" role="row">
          <span role="columnheader">Listing</span>
          {Array.from({ length: days }, (_, index) => calendarDateOffset(startDate, index)).map(date => <span role="columnheader" key={date} data-covered={monthCoverage(page, date)}><small>{WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}</small>{Number(date.slice(8, 10))}</span>)}
        </div>
        {rows.map(row => {
          const entries = projection.entries.filter(entry => entry.segment.sellableUnitId === row.id);
          const assigned = assignCalendarLanes(entries);
          const lanes = Math.max(1, ...assigned.map(item => item.lane + 1));
          const actualRoom = page.rooms.find(room => room.sellableUnitId === row.id);
          const condition = actualRoom?.outOfService === true ? "Out of service" : actualRoom?.roomCondition ? calendarStatusLabel(actualRoom.roomCondition) : actualRoom?.outOfService === false ? "No service block returned" : "Condition not returned";
          return <div className="hosting-timeline-row" role="row" key={row.id ?? `unassigned-${page.propertyId}`} style={{ "--hosting-lanes": lanes } as CSSProperties}>
            <span role="rowheader" className="hosting-timeline-label"><strong>{row.label}</strong><small>{row.type} · {condition}</small></span>
            {Array.from({ length: days }, (_, index) => {
              const date = calendarDateOffset(startDate, index);
              return <span key={date} role="gridcell" aria-label={`${dayLabel(date)}${monthCoverage(page, date) ? " · data loaded" : " · data not loaded"}`} className="hosting-timeline-day" data-covered={monthCoverage(page, date)} />;
            })}
            {assigned.map(({ entry, lane }) => <button
              key={entry.key}
              type="button"
              className="hosting-timeline-pill"
              data-active={activeKey === entry.key}
              data-status={entry.segment.reservationStatus}
              disabled={!entry.openable}
              aria-label={`${entry.segment.primaryGuestDisplayName || "Guest name not returned"}, ${entry.segment.confirmationNo || "reference not returned"}, ${dayLabel(calendarDateOffset(startDate, entry.start))} through ${dayLabel(calendarDateOffset(startDate, entry.endExclusive - 1))}${entry.dayUse ? ", day use" : ""}, ${calendarStatusLabel(entry.segment.reservationStatus)}. Select for details`}
              onClick={() => onSelectEntry(entry)}
              style={{ gridColumn: `${entry.start + 2} / span ${entry.endExclusive - entry.start}`, gridRow: lane + 1 }}
            >{entry.segment.continuesBefore || entry.start > 0 ? "← " : ""}{entry.segment.primaryGuestDisplayName || "Guest name not returned"}{entry.segment.continuesAfter || entry.endExclusive < days ? " →" : ""}</button>)}
          </div>;
        })}
        {!rows.length ? <p className="hosting-empty">No listing rows were returned for this property.</p> : null}
      </div>
    </div>
    <p className="hosting-property-note">Times follow {page.timezone}. Only recorded reservation segments are shown; blank dates do not establish availability. Rates were not returned.</p>
  </section>;
}

export function CalendarSidePanel({
  date,
  range,
  page,
  segmentEntries,
  activeKey,
  onOpen,
  timeline,
}: Readonly<{
  date: string;
  range: CalendarRange | null;
  page: CalendarPage | null;
  segmentEntries: readonly CalendarEntry[];
  activeKey: string | null;
  onOpen: (reservationId: string) => void;
  timeline: boolean;
}>) {
  const active = segmentEntries.find(entry => entry.key === activeKey);
  const selectedPage = active?.page ?? page;
  const selectedTimezone = selectedPage?.timezone ?? "UTC";
  const related = active ? segmentEntries.filter(entry => entry.segment.reservationId === active.segment.reservationId).sort((left, right) => left.segment.stayFrom.localeCompare(right.segment.stayFrom)) : [];
  return <aside className="hosting-context" aria-label="Selected calendar details">
    <div className="hosting-context-heading"><span>{range?.to ? "Selected range" : "Selected date"}</span><h2>{range?.to ? `${dayLabel(range.from)} – ${dayLabel(range.to)}` : dayLabel(date)}</h2></div>
    <p className="hosting-rate-note">Nightly rates were not returned. A blank date is not an availability promise.</p>
    {active ? <div className="hosting-context-reservation">
      <p className="hosting-context-eyebrow">Recorded reservation segment</p>
      <h3>{active.segment.primaryGuestDisplayName || "Guest name not returned"}</h3>
      <p>{active.segment.confirmationNo || "Reservation reference not returned"} · {calendarStatusLabel(active.segment.reservationStatus)}</p>
      {timeline ? <p>{propertyName(active.page, "")} · {active.page.timezone}</p> : null}
      <ul className="hosting-recorded-segments">{related.map(entry => <li key={entry.key}>
        <span>{formatStay(entry.segment.stayFrom, entry.page.timezone)} – {formatStay(entry.segment.stayTo, entry.page.timezone)}</span>
        <small>{entry.segment.sellableUnitLabel ?? "Listing not assigned"} · segment {entry.segment.segmentSeq}</small>
      </li>)}</ul>
      {active.openable ? <button type="button" className="hosting-open-reservation" onClick={() => onOpen(active.segment.reservationId)}>Open reservation</button> : <p role="alert">This record has an invalid or duplicate identity; opening is unavailable.</p>}
    </div> : <div className="hosting-context-empty">
      <p>{page && date >= page.fromDate && date < page.toDateExclusive ? "Select a recorded reservation to review its segment details." : "No reservation details were returned for this date."}</p>
      {selectedPage ? <p>{propertyName(selectedPage, "")} · {selectedTimezone}</p> : null}
    </div>}
    <div className="hosting-context-section"><h3>Selection</h3><p>Calendar range selection is for review only. It does not create a booking, block, rate, or availability change.</p></div>
  </aside>;
}

export function HostingCalendar({
  page,
  startDate,
  mode,
  timezone,
  loading,
  error,
  onMode,
  onDate,
  onOpen,
  onRefresh,
  timelinePages,
}: HostingCalendarProps) {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [roomId, setRoomId] = useState("all");
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [selectedDate, setSelectedDate] = useState(startDate);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  useEffect(() => setSelectedDate(startDate), [startDate]);
  const validDate = isCalendarDate(startDate);
  const firstOfMonth = validDate ? monthStart(startDate) : "2026-01-01";
  const days = validDate ? monthLength(firstOfMonth) : 31;
  const pages: readonly TimelinePage[] = useMemo(() => mode === "timeline"
    ? timelinePages ?? (page ? [{ label: page.propertyId, page }] : [])
    : page ? [{ label: page.propertyId, page }] : [], [mode, timelinePages, page]);
  const selectedRoom = roomId === "unassigned" || page?.rooms.some(room => room.sellableUnitId === roomId) ? roomId : "all";
  const projectionStart = mode === "year" ? `${startDate.slice(0, 4)}-01-01` : firstOfMonth;
  const projectionDays = mode === "year" ? (Date.parse(`${Number(startDate.slice(0, 4)) + 1}-01-01T00:00:00Z`) - Date.parse(`${startDate.slice(0, 4)}-01-01T00:00:00Z`)) / 86_400_000 : days;
  const projectionRows = useMemo(() => pages.map(item => ({ ...item, projection: projectCalendarPage(item.page, projectionStart, projectionDays, mode === "timeline" ? item.page.timezone : timezone, mode === "timeline" ? "all" : selectedRoom) })), [pages, projectionStart, projectionDays, mode, timezone, selectedRoom]);
  const allEntries = projectionRows.flatMap(row => row.projection.entries);
  const allInvalid = projectionRows.flatMap(row => row.projection.invalid.map(message => `${propertyName(row.page, row.label)}: ${message}`));
  if (mode === "year" && page && (page.fromDate > `${startDate.slice(0, 4)}-01-01` || page.toDateExclusive < `${String(Number(startDate.slice(0, 4)) + 1).padStart(4, "0")}-01-01`)) {
    allInvalid.push("Only returned dates are marked in this year overview; the rest of the year has not been loaded");
  }
  const timelineIdentityInvalid = mode === "timeline" && new Set(pages.map(item => item.page.propertyId)).size !== pages.length;
  const completeCoverage = Boolean(validDate && page && projectionRows.length && !allInvalid.length && !timelineIdentityInvalid && !error && !loading);
  const effectiveIncomplete = !completeCoverage;
  const pageForPanel = mode === "timeline" ? null : page;
  const heading = mode === "year" ? startDate.slice(0, 4) : mode === "timeline" ? `${monthTitle(firstOfMonth)} ${firstOfMonth.slice(0, 4)} · selected properties` : `${monthTitle(firstOfMonth)} ${firstOfMonth.slice(0, 4)}`;
  const pickDate = (date: string) => {
    setSelectedDate(date);
    setRange(current => selectCalendarRange(current, date));
    setActiveKey(null);
  };
  const chooseEntry = (entry: CalendarEntry) => {
    setSelectedDate(entry.segment.localFromDate);
    setRange(null);
    setActiveKey(entry.key);
  };
  const changeMonth = (amount: number) => onDate(monthStart(calendarDateOffset(firstOfMonth, amount < 0 ? -1 : days)));
  const changeYear = (amount: number) => {
    const year = Number(startDate.slice(0, 4)) + amount;
    if (year >= 1 && year <= 9999) onDate(`${String(year).padStart(4, "0")}-01-01`);
  };
  const viewPage = mode === "timeline" ? null : page;

  return <section className="hosting-calendar" aria-labelledby="hosting-calendar-title">
    <header className="hosting-calendar-header">
      <div className="hosting-calendar-titleblock"><span className="hosting-calendar-kicker">RESERVATIONS</span><h1 id="hosting-calendar-title">Calendar</h1></div>
      <div className="hosting-calendar-actions">
        <div className="hosting-view-menu-wrap">
          <button type="button" className="hosting-view-button" aria-haspopup="menu" aria-expanded={viewMenuOpen} onClick={() => setViewMenuOpen(value => !value)}>{mode === "timeline" ? "Timeline" : mode === "year" ? "Year" : "Month"}<span aria-hidden="true">⌄</span></button>
          {viewMenuOpen ? <div className="hosting-view-menu" role="menu" aria-label="Calendar view">
            {(["month", "year", "timeline"] as const).map(option => <button role="menuitemradio" aria-checked={mode === option} type="button" key={option} onClick={() => { setViewMenuOpen(false); setRange(null); setActiveKey(null); onMode(option); }}>{option === "month" ? "Month" : option === "year" ? "Year" : "Timeline"}</button>)}
          </div> : null}
        </div>
        <button type="button" className="hosting-refresh" onClick={onRefresh} disabled={loading} aria-label="Refresh calendar">{loading ? "Refreshing" : "Refresh"}</button>
      </div>
    </header>
    <div className="hosting-calendar-toolbar">
      <div className="hosting-date-navigation">
        <button type="button" className="hosting-round-control" aria-label={mode === "year" ? "Previous year" : "Previous month"} disabled={!validDate} onClick={() => mode === "year" ? changeYear(-1) : changeMonth(-1)}>‹</button>
        <button type="button" className="hosting-round-control" aria-label={mode === "year" ? "Next year" : "Next month"} disabled={!validDate} onClick={() => mode === "year" ? changeYear(1) : changeMonth(1)}>›</button>
      <button type="button" className="hosting-today-control" disabled={!validDate} onClick={() => { const today = propertyToday(timezone); if (today) onDate(monthStart(today)); }}>Today</button>
        <div className="hosting-date-menu-wrap">
          <button type="button" className="hosting-date-title" aria-expanded={dateMenuOpen} aria-haspopup="dialog" onClick={() => setDateMenuOpen(value => !value)}>{heading}<span aria-hidden="true">⌄</span></button>
          {dateMenuOpen ? <div className="hosting-date-popover" role="dialog" aria-label="Choose calendar date">
            {mode === "year" ? <label>Year<input type="number" min="1" max="9999" value={startDate.slice(0, 4)} onChange={event => { const year = Number(event.target.value); if (Number.isInteger(year) && year >= 1 && year <= 9999) onDate(`${String(year).padStart(4, "0")}-01-01`); }} /></label> : <label>Month<input type="month" value={firstOfMonth.slice(0, 7)} onChange={event => { if (isCalendarDate(`${event.target.value}-01`)) onDate(`${event.target.value}-01`); }} /></label>}
          </div> : null}
        </div>
      </div>
      {viewPage ? <label className="hosting-listing-picker">Listing<select value={roomId} onChange={event => setRoomId(event.target.value)} aria-label="Choose listing">
        <option value="all">All listings</option>
        <option value="unassigned">Unassigned stays</option>
        {viewPage.rooms.map(room => <option key={room.sellableUnitId} value={room.sellableUnitId}>{room.unitTypeLabel} · {room.sellableUnitLabel}</option>)}
      </select></label> : <span className="hosting-portfolio-label">Selected authorized properties</span>}
    </div>
    {error ? <p className="hosting-error" role="alert">{error} Calendar results are unavailable or incomplete.</p> : null}
    {!validDate ? <p className="hosting-error" role="alert">Choose a valid calendar date to continue.</p> : null}
    {loading ? <p className="hosting-loading" role="status">Loading recorded reservation segments…</p> : null}
    {effectiveIncomplete && !loading && !error && validDate ? <div className="hosting-incomplete" role="alert">
      <strong>Calendar data is incomplete.</strong>
      <span>{allInvalid[0] ?? (timelineIdentityInvalid ? "Duplicate property pages were returned. No property rows were merged." : page ? "Some dates, listings, or reservations were not returned. Blank cells do not confirm availability." : "No calendar page was returned. Refresh or return to the reservation list.")}</span>
    </div> : null}
    <div className="hosting-calendar-content">
    {!loading && !error && validDate && mode === "timeline" && page && pages.length ? <div className="hosting-timeline-properties">
      {timelineIdentityInvalid ? <p className="hosting-error" role="alert">Timeline received duplicate property pages; no properties were merged.</p> : null}
      {projectionRows.map((row, index) => <TimelineProperty key={`${row.page.propertyId}-${index}`} label={row.label} page={row.page} startDate={firstOfMonth} projection={row.projection} onSelectEntry={chooseEntry} activeKey={activeKey} />)}
    </div> : null}
    {!loading && !error && validDate && mode === "timeline" && !page ? <p className="hosting-error" role="alert">A selected property page is missing. The timeline is not shown as complete.</p> : null}
    {!loading && !error && validDate && mode === "month" && page && projectionRows[0] ? <MonthView date={firstOfMonth} page={page} projection={projectionRows[0].projection} selected={range} onSelectDate={pickDate} onSelectEntry={chooseEntry} activeKey={activeKey} /> : null}
    {!loading && !error && validDate && mode === "year" && page ? <YearView page={page} year={Number(startDate.slice(0, 4))} entries={projectionRows[0]?.projection.entries ?? []} onOpenMonth={date => { setRange(null); setActiveKey(null); onMode("month"); onDate(date); }} onSelectDate={date => { setRange(null); setActiveKey(null); onMode("month"); onDate(date); }} /> : null}
    {effectiveIncomplete && !loading && !error && validDate ? <p className="hosting-data-footnote">Only the recorded rows above are shown. This view does not establish pricing, availability, or a sellability decision.</p> : null}
      <CalendarSidePanel date={selectedDate} range={range} page={pageForPanel} segmentEntries={allEntries} activeKey={activeKey} onOpen={onOpen} timeline={mode === "timeline"} />
    </div>
  </section>;
}
