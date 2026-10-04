import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadHostingCalendar, loadProperties, propertyLocalDate } from "../yellow-api";
import { HostingCalendar } from "./HostingCalendar";
import { HostReservationCalendar } from "./HostReservationCalendar";
import { reactAuthSession } from "../auth-session";
import { assertHostPage, hostSegmentIdentity } from "../host-calendar-views";
import type { CalendarMode, CalendarPage } from "../hosting-calendar";
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

let nextCalendarInstance = 0;
export function ReservationCalendar({ propertyId, timezone, onOpen }: Readonly<{ propertyId: string; timezone: string; onOpen: (id: string, propertyId?: string) => void }>) {
  const snapshot = useSyncExternalStore(reactAuthSession.subscribe, reactAuthSession.getSnapshot, reactAuthSession.getSnapshot);
  const [instance] = useState(() => ++nextCalendarInstance);
  const generation = useRef({ snapshot, value: 0 });
  if (generation.current.snapshot !== snapshot) generation.current = { snapshot, value: generation.current.value + 1 };
  const authGeneration = generation.current.value;
  const [start, setStart] = useState(() => { try { return propertyLocalDate(timezone, 0); } catch { return ""; } });
  const [mode, setMode] = useState<CalendarMode>("month");
  const [portfolio, setPortfolio] = useState(false);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([propertyId]);
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const [readConflict, setReadConflict] = useState<string | null>(null);
  let today = "";
  try { today = propertyLocalDate(timezone, 0); } catch { /* Visible timezone error below. */ }
  const grants = useQuery({ queryKey: ["hosting-calendar-grants", instance, authGeneration], queryFn: async () => {
    const accepted = snapshot;
    const result = await loadProperties();
    if (reactAuthSession.getSnapshot() !== accepted || accepted.status !== "authenticated") throw new Error("Property access changed. Refresh the calendar.");
    return result;
  }, enabled: snapshot.status === "authenticated" && Boolean(today), retry: false, staleTime: 0, gcTime: 0 });
  const properties = grants.data ?? [];
  const current = properties.find(property => property.id === propertyId);
  const selected = properties.filter(property => property.id === propertyId || selectedIds.includes(property.id)).slice(0, 8);
  const scope = mode === "timeline" && portfolio ? selected : current ? [current] : [];
  const authorized = Boolean(today && snapshot.status === "authenticated" && snapshot.properties.some(property => property.id === propertyId) &&
    grants.isSuccess && !grants.isFetching && current && current.timezone === timezone && !readConflict);
  const contextKey = `${instance}:${authGeneration}:${grants.dataUpdatedAt}:${refreshEpoch}:${propertyId}:${timezone}:${authorized}`;
  const evidence = useRef<{ key: string; pages: Map<string, CalendarPage> }>({ key: contextKey, pages: new Map() });
  if (evidence.current.key !== contextKey) evidence.current = { key: contextKey, pages: new Map() };
  const acceptedEvidence = evidence.current;
  const stillCurrent = () => authorized && evidence.current === acceptedEvidence && reactAuthSession.getSnapshot() === snapshot;
  const loadMonth = useCallback(async (from: string, to: string, signal: AbortSignal): Promise<CalendarPage> => {
    const assertCurrent = () => {
      if (signal.aborted || !authorized || evidence.current !== acceptedEvidence || reactAuthSession.getSnapshot() !== snapshot)
        throw new Error("Calendar access changed. Refresh this month.");
    };
    assertCurrent();
    const page = await loadHostingCalendar({ propertyId, timezone, from, to, signal });
    // The unchanged reader has consumed and validated the complete response body.
    // Abort alone cannot fence a renewal, logout or a delayed body completion.
    assertCurrent();
    assertHostPage(page, propertyId, timezone, from, to);
    for (const [key, other] of acceptedEvidence.pages) {
      if (key === `${from}:${to}`) continue;
      for (const segment of page.segments) {
        const previous = other.segments.find(item => item.segmentId === segment.segmentId);
        if (previous && hostSegmentIdentity(previous) !== hostSegmentIdentity(segment)) {
          setReadConflict("Calendar records disagree across months. Refresh before opening a stay.");
          throw new Error("Calendar records disagree across months.");
        }
      }
      for (const room of page.rooms) {
        const previous = other.rooms.find(item => item.sellableUnitId === room.sellableUnitId);
        if (previous && (previous.unitTypeId !== room.unitTypeId || previous.sellableUnitLabel !== room.sellableUnitLabel)) {
          setReadConflict("Unit identity changed across months. Refresh the calendar.");
          throw new Error("Unit identity changed across months.");
        }
      }
    }
    acceptedEvidence.pages.set(`${from}:${to}`, page);
    while (acceptedEvidence.pages.size > 12) acceptedEvidence.pages.delete(acceptedEvidence.pages.keys().next().value!);
    return page;
  }, [authorized, acceptedEvidence, snapshot, propertyId, timezone]);
  const range = useMemo(() => {
    if (!isCalendarDate(start)) return null;
    const from = `${start.slice(0, 7)}-01`;
    const to = calendarDateOffset(calendarDateOffset(from, 32).slice(0, 7) + "-01", 0);
    return isCalendarDate(to) ? { from, to } : null;
  }, [start]);
  const scopeKey = scope.map(property => `${property.id}:${property.timezone}`).join(",");
  const calendar = useQuery({
    queryKey: ["native-reservation-calendar", contextKey, mode, range?.from, range?.to, scopeKey],
    queryFn: async ({ signal }) => {
      const pages = [];
      for (let offset = 0; offset < scope.length; offset += 4) {
        pages.push(...await Promise.all(scope.slice(offset, offset + 4).map(async property => ({ label: property.name,
          page: await loadHostingCalendar({ propertyId: property.id, timezone: property.timezone, ...range!, signal }) }))));
      }
      if (!stillCurrent() || signal.aborted) throw new Error("Calendar access changed. Refresh the timeline.");
      if (new Set(pages.map(item => item.page.propertyId)).size !== pages.length) throw new Error("Calendar returned duplicate property pages.");
      return pages;
    },
    enabled: mode === "timeline" && range !== null && authorized,
    retry: false, staleTime: 0, gcTime: 0,
  });
  const error = !today || !range ? "The property timezone is unavailable. Choose a valid calendar date after the timezone is restored." : snapshot.status !== "authenticated" ? "Sign in to view reservation calendars."
    : grants.isError ? "Property access could not be verified." : !grants.isPending && !current ? "Calendar access to this property is not granted."
    : current && current.timezone !== timezone ? "The property timezone changed. Reload this calendar." : readConflict ?? (mode === "timeline" && calendar.isError ? calendar.error.message : null);
  const loading = grants.isPending || grants.isFetching || mode === "timeline" && calendar.isFetching;
  const pages = !error && !loading ? calendar.data : undefined;
  const open = (id: string) => {
    if (!stillCurrent() || error || loading) return;
    const ownedPages = mode === "timeline" ? pages?.map(item => item.page) ?? [] : [...acceptedEvidence.pages.values()];
    const matches = new Set(ownedPages.flatMap(page => page.segments.some(segment => segment.reservationId === id) ? [page.propertyId] : []));
    if (matches.size === 1) onOpen(id, [...matches][0]);
  };
  return <>
    <div className="host-calendar-destinations" aria-label="Calendar destinations"><button type="button" aria-pressed={mode !== "timeline"} onClick={() => setMode("month")}>Calendars</button><button type="button" aria-pressed={mode === "timeline"} onClick={() => setMode("timeline")}>Portfolio timeline</button><button type="button" disabled={!today || snapshot.status !== "authenticated" || grants.isFetching} onClick={() => { setReadConflict(null); setRefreshEpoch(value => value + 1); void grants.refetch(); }}>Refresh calendar</button></div>
    {mode === "timeline" && properties.length > 1 && !grants.isError ? <details className="hosting-portfolio-controls">
      <summary>Properties · {portfolio ? scope.length : 1}</summary>
      <label><input type="checkbox" checked={portfolio} onChange={event => setPortfolio(event.target.checked)} />Compare selected properties</label>
      {portfolio ? <div>{properties.map(property => <label key={property.id}><input type="checkbox" checked={property.id === propertyId || selectedIds.includes(property.id)}
        disabled={property.id === propertyId || !selectedIds.includes(property.id) && selectedIds.length >= 8}
        onChange={event => setSelectedIds(ids => event.target.checked ? [...ids, property.id] : ids.filter(id => id !== property.id))} />{property.name}</label>)}
        <p>Choose up to eight granted properties. Each uses its own timezone.</p></div> : null}
    </details> : null}
    {mode !== "timeline" ? error ? <p role="alert" className="host-calendar-notice">{error}</p> : !authorized ? <p role="status">Checking property access…</p> : <HostReservationCalendar key={contextKey} contextKey={contextKey} propertyId={propertyId} propertyLabel={current!.name} timezone={timezone} today={today} loadCalendar={loadMonth} onOpenReservation={open}/> : <HostingCalendar key={contextKey} page={pages?.find(item => item.page.propertyId === propertyId)?.page ?? null} startDate={start} mode="timeline" timezone={timezone}
      loading={loading} error={error} onMode={next => setMode(next === "timeline" ? "timeline" : "month")} onDate={setStart} onOpen={open}
      onRefresh={() => { setReadConflict(null); setRefreshEpoch(value => value + 1); void grants.refetch(); }}
      timelinePages={pages} />}
  </>;
}
