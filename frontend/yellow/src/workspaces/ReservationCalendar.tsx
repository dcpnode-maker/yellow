import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadHostingCalendar, loadProperties, propertyLocalDate } from "../yellow-api";
import { HostingCalendar } from "./HostingCalendar";
import type { CalendarMode } from "../hosting-calendar";
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

export function ReservationCalendar({ propertyId, timezone, onOpen }: Readonly<{ propertyId: string; timezone: string; onOpen: (id: string, propertyId?: string) => void }>) {
  const [start, setStart] = useState(() => { try { return propertyLocalDate(timezone, 0); } catch { return ""; } });
  const [mode, setMode] = useState<CalendarMode>("month");
  const [portfolio, setPortfolio] = useState(false);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([propertyId]);
  const grants = useQuery({ queryKey: ["hosting-calendar-grants"], queryFn: loadProperties, retry: false, staleTime: 0 });
  const properties = grants.data ?? [];
  const current = properties.find(property => property.id === propertyId);
  const selected = properties.filter(property => property.id === propertyId || selectedIds.includes(property.id));
  const scope = mode === "timeline" && portfolio ? selected : current ? [current] : [];
  const range = useMemo(() => {
    if (!isCalendarDate(start)) return null;
    const from = mode === "year" ? `${start.slice(0, 4)}-01-01` : `${start.slice(0, 7)}-01`;
    const to = mode === "year" ? `${String(Number(start.slice(0, 4)) + 1).padStart(4, "0")}-01-01`
      : calendarDateOffset(calendarDateOffset(from, 32).slice(0, 7) + "-01", 0);
    return isCalendarDate(to) ? { from, to } : null;
  }, [start, mode]);
  const scopeKey = scope.map(property => `${property.id}:${property.timezone}`).join(",");
  const calendar = useQuery({
    queryKey: ["native-reservation-calendar", propertyId, timezone, mode, range?.from, range?.to, scopeKey],
    queryFn: async ({ signal }) => {
      const pages = [];
      for (let offset = 0; offset < scope.length; offset += 4) {
        pages.push(...await Promise.all(scope.slice(offset, offset + 4).map(async property => ({ label: property.name,
          page: await loadHostingCalendar({ propertyId: property.id, timezone: property.timezone, ...range!, signal }) }))));
      }
      if (new Set(pages.map(item => item.page.propertyId)).size !== pages.length) throw new Error("Calendar returned duplicate property pages.");
      return pages;
    },
    enabled: range !== null && Boolean(current) && !grants.isError && !grants.isPending,
    retry: false, staleTime: 0,
  });
  const error = !range ? "The property timezone is unavailable. Choose a valid calendar date after the timezone is restored." : grants.isError ? "Property access could not be verified."
    : !grants.isPending && !current ? "Calendar access to this property is not granted." : calendar.isError ? calendar.error.message : null;
  const loading = grants.isPending || calendar.isPending && Boolean(current);
  const pages = !error && !loading ? calendar.data : undefined;
  const open = (id: string) => {
    const matches = new Set(pages?.flatMap(item => item.page.segments.some(segment => segment.reservationId === id) ? [item.page.propertyId] : []) ?? []);
    if (matches.size === 1) onOpen(id, [...matches][0]);
  };
  return <>
    {mode === "timeline" && properties.length > 1 && !grants.isError ? <details className="hosting-portfolio-controls">
      <summary>Properties · {portfolio ? scope.length : 1}</summary>
      <label><input type="checkbox" checked={portfolio} onChange={event => setPortfolio(event.target.checked)} />Compare selected properties</label>
      {portfolio ? <div>{properties.map(property => <label key={property.id}><input type="checkbox" checked={property.id === propertyId || selectedIds.includes(property.id)}
        disabled={property.id === propertyId || !selectedIds.includes(property.id) && selectedIds.length >= 8}
        onChange={event => setSelectedIds(ids => event.target.checked ? [...ids, property.id] : ids.filter(id => id !== property.id))} />{property.name}</label>)}
        <p>Choose up to eight granted properties. Each uses its own timezone.</p></div> : null}
    </details> : null}
    <HostingCalendar page={pages?.find(item => item.page.propertyId === propertyId)?.page ?? null} startDate={start} mode={mode} timezone={timezone}
      loading={loading} error={error} onMode={setMode} onDate={setStart} onOpen={open}
      onRefresh={() => { void grants.refetch(); void calendar.refetch(); }}
      timelinePages={mode === "timeline" ? pages : undefined} />
  </>;
}
