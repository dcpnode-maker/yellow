import { VoiceInput } from "./VoiceField";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildHotelSearchResults, isHotelSearchCurrent, normalizeHotelSearchQuery, type HotelSearchFilter } from "../hotel-search";
import { loadReservationBoard, searchPartyProfiles } from "../yellow-api";
import { searchGroups } from "../group-reservations-api";
import { SegmentedRibbon } from "./SegmentedRibbon";
import "./hotel-search.css";

type Props = Readonly<{ propertyId: string; locked: boolean; timezone?: string }>;

/** Read-only navigation. Mutations remain in the existing authorized workspaces. */
export function HotelSearch({ propertyId, locked, timezone }: Props) {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get("hotelSearch") === "1");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [filter, setFilter] = useState<HotelSearchFilter>("all");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const helpId = useId();
  const normalized = normalizeHotelSearchQuery(query);
  const enabled = open && !locked && submitted.length >= 2;
  useEffect(() => {
    if (!enabled) { setGroupQuery(""); return; }
    const timer = window.setTimeout(() => setGroupQuery(submitted), 250);
    return () => window.clearTimeout(timer);
  }, [enabled, submitted]);
  // Reuse the board already loaded by Today; no duplicate index or per-key fetch.
  const board = useQuery({
    queryKey: ["yellow-reservation-command-index", propertyId],
    queryFn: loadReservationBoard,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
  const profiles = useQuery({
    queryKey: ["hotel-search-profiles", propertyId, submitted],
    queryFn: () => searchPartyProfiles(submitted),
    enabled,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
  });
  const groups = useQuery({
    queryKey: ["hotel-search-groups", propertyId, groupQuery],
    queryFn: () => searchGroups(propertyId, groupQuery),
    enabled: enabled && groupQuery === submitted,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
  });
  const matches = useMemo(() => buildHotelSearchResults(
    propertyId,
    submitted,
    board.isSuccess ? board.data.reservations ?? [] : [],
    profiles.isSuccess ? profiles.data : [],
    30,
    { filter, timezone, groups: groupQuery === submitted && groups.isSuccess ? groups.data.groups : [] },
  ), [propertyId, submitted, board.isSuccess, board.data, profiles.isSuccess, profiles.data,
    groupQuery, groups.isSuccess, groups.data, filter, timezone]);
  const current = isHotelSearchCurrent(query, submitted, locked);
  const loading = enabled && (board.isFetching || profiles.isFetching || groupQuery !== submitted || groups.isFetching);

  useEffect(() => {
    if (locked) setOpen(false);
  }, [locked]);
  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (open && !locked && !modal.open) { modal.showModal(); input.current?.focus(); }
    else if ((!open || locked) && modal.open) modal.close();
  }, [open, locked]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!locked) setOpen(value => !value);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [locked]);

  return <div className="hotel-search-entry">
    <button ref={trigger} className="hotel-search-trigger" type="button" disabled={locked}
      aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <span aria-hidden="true">⌕</span> Search hotel <kbd>Ctrl K</kbd>
    </button>
    <dialog ref={dialog} className="hotel-search-dialog" aria-labelledby={headingId}
      onCancel={() => setOpen(false)} onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="hotel-search-heading">
        <div><p className="hotel-search-eyebrow">Hotel search</p><h2 id={headingId}>Find & open</h2></div>
        <button type="button" className="hotel-search-close" aria-label="Close hotel search" onClick={() => setOpen(false)}>×</button>
      </div>
      <form role="search" aria-label="Hotel records" onSubmit={event => {
        event.preventDefault();
        if (!locked && normalized.length >= 2) {
          if (submitted === normalized) { void board.refetch(); void profiles.refetch(); if (groupQuery === normalized) void groups.refetch(); }
          else { setSubmitted(normalized); setFilter("all"); }
        }
      }}>
        <label htmlFor={`${headingId}-query`}>Name, confirmation, room reference or profile contact</label>
        <div className="hotel-search-field">
          <VoiceInput aria-label="Search hotel" contextKey={propertyId} onVoiceValue={voiceValue => setQuery(voiceValue)} ref={input} id={`${headingId}-query`} type="search" maxLength={100} value={query}
            autoComplete="off" aria-describedby={helpId} placeholder="Try a guest name or room 109"
            onChange={event => setQuery(event.target.value)} disabled={locked} />
          <button type="submit" disabled={locked || normalized.length < 2 || loading}>Search</button>
        </div>
      </form>
      <p id={helpId} className="hotel-search-help">Search authorized stays and profiles. Each result shows the workspace it opens.</p>
      <div className="hotel-search-results" aria-busy={loading}>
        {!current ? <p className="hotel-search-message">Enter at least two characters and press Search. Results stay within this property.</p> : <>
          <SegmentedRibbon<HotelSearchFilter> label="Search result types" value={filter} onChange={setFilter}
            contentId={`${headingId}-results`} items={[
              { key: "all", label: "All", count: matches.counts.all },
              { key: "reservation", label: "Stays", count: matches.counts.reservation },
              { key: "guest", label: "Profiles", count: matches.counts.guest },
              { key: "group", label: "Groups", count: matches.counts.group ?? 0 },
            ]} />
          <div id={`${headingId}-results`} role="tabpanel" aria-label={`${filter === "all" ? "All" : filter === "reservation" ? "Stay" : filter === "group" ? "Group" : "Profile"} search results`}>
          <p className="hotel-search-summary" role="status">{loading ? "Searching authorized hotel records…" :
            `${matches.results.length} of ${matches.total} loaded matches for “${submitted}”${groups.isSuccess && groupQuery === submitted && groups.data.nextCursor ? "; more group matches exist" : ""}`}</p>
          {board.isError && <p className="hotel-search-warning" role="alert">Reservations could not be loaded. You can still open available profiles. Search again to retry.</p>}
          {profiles.isError && <p className="hotel-search-warning" role="alert">Profile search could not be loaded. You can still open available reservation matches. Search again to retry.</p>}
          {groups.isError && groupQuery === submitted && <p className="hotel-search-warning" role="alert">Groups could not be loaded. Available stay and profile matches may still be opened. Search again to retry.</p>}
          {groups.isSuccess && groupQuery === submitted && groups.data.nextCursor && <p className="hotel-search-help">Group search reached its 50-result page limit. Refine the group name or code to narrow the results.</p>}
          {profiles.isSuccess && profiles.data.length >= 50 && <p className="hotel-search-help">Profile search returned its 50-result limit. Refine the name or contact for a more specific result.</p>}
          {matches.total > matches.results.length && <p className="hotel-search-help">Showing the first {matches.results.length} results. Refine your search to find more.</p>}
          {!loading && !matches.total && !board.isError && !profiles.isError && !groups.isError && <p className="hotel-search-message">{matches.counts.all ? "No matches in this view. Select another result type." : "No matching records. Try a confirmation number, guest name, booked room, or group name or code."}</p>}
          <ul aria-label="Hotel search results">{matches.results.map(result => <li key={result.key}>
            <a className="hotel-search-result" href={result.href} onClick={event => { if (locked) event.preventDefault(); }}>
              <span className="hotel-search-kind" aria-hidden="true">{result.kind === "guest" ? "P" : result.kind === "group" ? "G" : "R"}</span>
              <span className="hotel-search-record">
                <span className="hotel-search-record-heading"><strong>{result.title}</strong><span className="hotel-search-status">{result.statusLabel}</span></span>
                <span>{result.detail}</span>
                <span className="hotel-search-destination">{result.destination} <span aria-hidden="true">↗</span></span>
              </span>
            </a>
            {result.cashierHref && <a className="hotel-search-cashier" href={result.cashierHref}
              onClick={event => { if (locked) event.preventDefault(); }} aria-label={`Open cashier for ${result.title}, ${result.label}`}
              title={`Finance › Cashier · ${result.label}`}>Cashier <span aria-hidden="true">↗</span></a>}
          </li>)}</ul>
          </div>
        </>}
      </div>
      <p className="hotel-search-footnote">Current reservation board, profile matches and property-scoped group name/code matches. Folios, tasks, catalogues and complete room history are not indexed here.</p>
    </dialog>
  </div>;
}
