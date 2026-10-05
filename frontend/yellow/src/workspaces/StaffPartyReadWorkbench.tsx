import { createElement, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { reactAuthSession, type AuthSnapshot } from "../auth-session";
import { navigateYellow } from "../workspace-navigation";
import { operationalStateDescription } from "../reservation-board";
import { createStaffPartyIdentityCard } from "./StaffPartyIdentityCard.mjs";
import "./party-identity.css";
import "./staff-party-workbench.css";
import { createStaffPartyClient, StaffPartyScopeError, type StaffPartyProfile, type StaffPartyStay } from "./staff-party-client";

type Scope = Readonly<{ propertyId: string; snapshot: AuthSnapshot; generation: number }>;
const StaffPartyIdentityCard = createStaffPartyIdentityCard(createElement);
type ProfileState = Scope & Readonly<{ partyId: string; timezone: string; loading: boolean; profile: StaffPartyProfile | null; error: string;
  historyLoading: boolean; history: readonly StaffPartyStay[] | null; historyError: string }>;
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : "Guest evidence is unavailable.";
const useAuthSnapshot = () => useSyncExternalStore(reactAuthSession.subscribe, reactAuthSession.getSnapshot, reactAuthSession.getSnapshot);

/** Independent exact selected identity; query text never becomes an inferred Party selection. */
function SelectedParty({ propertyId, partyId, timezone, close, onScopeLoss }: Readonly<{ propertyId: string; partyId: string; timezone: string; close?: () => void; onScopeLoss: (reason: StaffPartyScopeError) => void }>) {
  const snapshot = useAuthSnapshot(), client = useRef(createStaffPartyClient()).current, generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ProfileState | null>(null);
  useEffect(() => {
    const attempt = ++generation.current, controller = new AbortController();
    const context = { propertyId, partyId, snapshot, timezone, generation: attempt };
    const current = () => !controller.signal.aborted && attempt === generation.current && snapshot === reactAuthSession.getSnapshot();
    setState({ ...context, loading: true, profile: null, error: "", historyLoading: false, history: null, historyError: "" });
    void (async () => {
      try {
        const result = await client.profile(propertyId, partyId, controller.signal);
        if (!current()) return;
        const admittedContext = { ...context, timezone: result.property.timezone };
        setState({ ...admittedContext, loading: false, profile: result.profile, error: "", historyLoading: result.profile !== null, history: null, historyError: "" });
        if (!result.profile) return;
        try {
          const history = await client.history(propertyId, partyId, controller.signal);
          if (current()) setState({ ...admittedContext, loading: false, profile: result.profile, error: "", historyLoading: false, history: history.reservations, historyError: "" });
        } catch (reason) {
          if (!current()) return;
          if (reason instanceof StaffPartyScopeError) { onScopeLoss(reason); return; }
          setState({ ...admittedContext, loading: false, profile: result.profile, error: "", historyLoading: false, history: null, historyError: errorMessage(reason) });
        }
      } catch (reason) {
        if (!current()) return;
        if (reason instanceof StaffPartyScopeError) { onScopeLoss(reason); return; }
        setState({ ...context, loading: false, profile: null, error: errorMessage(reason), historyLoading: false, history: null, historyError: "" });
      }
    })();
    return () => { ++generation.current; controller.abort(); };
  }, [propertyId, partyId, timezone, snapshot, revision, client, onScopeLoss]);
  const same = snapshot.status === "authenticated" && state?.snapshot === snapshot && state.propertyId === propertyId && state.partyId === partyId;
  const profile = same && !state.loading && !state.error ? state.profile : null;
  const history = profile && same && !state.historyLoading && !state.historyError ? state.history : null;
  const date = (value: string) => new Intl.DateTimeFormat(undefined, { timeZone: same ? state.timezone : timezone, dateStyle: "medium" }).format(new Date(value));
  return <section className={`${close ? "guest-profile" : "yellow-inline-guest"} staff-party-detail`} aria-label="Selected guest profile">
    <header>{close ? <h2>Guest profile</h2> : <h4>Guest profile</h4>}<div className="reservation-board-actions">
      <button type="button" disabled={!same || state.loading} onClick={() => setRevision(value => value + 1)}>Refresh profile</button>
      {close ? <button type="button" onClick={close}>Close profile</button> : null}
    </div></header>
    {!same || state.loading ? <p className="empty">{snapshot.status === "authenticated" ? "Loading the canonical guest profile…" : "Sign in to read guest evidence."}</p> :
      state.error ? <p className="error" role="alert">{state.error}</p> :
      !profile ? <p className="empty">The requested Party profile is not returned in this property scope.</p> : null}
    {profile ? <StaffPartyIdentityCard key={`${partyId}:${state!.generation}`} profile={profile} contextLabel="Current granted property · selected Party" evidenceState="current" /> : null}
    {profile ? <><h3>Stay history</h3><p>Stays involving this Party in this property. Company payer and account business are separate.</p>
      {state!.historyLoading ? <p className="empty">Loading factual stay history…</p> : state!.historyError ? <p className="error" role="alert">{state!.historyError}</p> :
        history?.length === 0 ? <p className="empty">No factual stays are returned for this guest profile.</p> : history ? <ul className="guest-history">
          {history.map(stay => <li key={stay.reservationId}><strong>{stay.confirmationNo}</strong>
            <span>{operationalStateDescription(stay.operationalState)} · {date(stay.stayFrom)} – {date(stay.stayTo)} · {stay.sellableUnitLabel ?? stay.unitTypeLabel} · {stay.ratePlanLabel}</span>
            <button type="button" onClick={() => navigateYellow(`/p/${propertyId}/res/${stay.reservationId}`)}>Open stay</button></li>)}
        </ul> : <p className="empty">Stay history is unavailable.</p>}
    </> : null}
  </section>;
}

type SearchState = Scope & Readonly<{ query: string; loading: boolean; profiles: readonly StaffPartyProfile[] | null; error: string }>;
export function StaffPartyReadWorkbench({ propertyId, partyId, timezone = "UTC", requestedGuestSearch = "" }: Readonly<{
  propertyId: string; partyId?: string; timezone?: string; requestedGuestSearch?: string;
}>) {
  const snapshot = useAuthSnapshot(), client = useRef(createStaffPartyClient()).current, generation = useRef(0);
  const [query, setQuery] = useState(requestedGuestSearch), [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Readonly<{ id: string; propertyId: string; snapshot: AuthSnapshot }> | null>(null);
  const [state, setState] = useState<SearchState | null>(null);
  const [scopeLoss, setScopeLoss] = useState<Readonly<{ propertyId: string; snapshot: AuthSnapshot; message: string }> | null>(null);
  const blocked = scopeLoss?.propertyId === propertyId && scopeLoss.snapshot === snapshot;
  const invalidateScope = useCallback((reason: StaffPartyScopeError) => {
    if (snapshot !== reactAuthSession.getSnapshot()) return;
    ++generation.current; // Synchronously fence late search replies before React commits the denial.
    setScopeLoss({ propertyId, snapshot, message: reason.message });
    setState(null); setSelected(null);
  }, [propertyId, snapshot]);
  const retry = () => { setScopeLoss(null); setState(null); setRevision(value => value + 1); };
  useEffect(() => { setQuery(requestedGuestSearch); }, [requestedGuestSearch]);
  useEffect(() => {
    if (partyId || blocked) return;
    const attempt = ++generation.current, controller = new AbortController(), exact = query.trim();
    const context = { propertyId, snapshot, query: exact, generation: attempt };
    const current = () => !controller.signal.aborted && attempt === generation.current && snapshot === reactAuthSession.getSnapshot();
    setState({ ...context, loading: exact.length >= 2, profiles: null, error: "" });
    if (exact.length >= 2) void client.search(propertyId, exact, controller.signal).then(result => {
      if (current()) setState({ ...context, loading: false, profiles: result.profiles, error: "" });
    }, reason => {
      if (!current()) return;
      if (reason instanceof StaffPartyScopeError) { invalidateScope(reason); return; }
      setState({ ...context, loading: false, profiles: null, error: errorMessage(reason) });
    });
    return () => { ++generation.current; controller.abort(); };
  }, [propertyId, partyId, snapshot, query, revision, client, blocked, invalidateScope]);
  if (partyId) return blocked ? <section className="yellow-inline-guest staff-party-detail" aria-label="Selected guest profile">
    <header><h4>Guest profile</h4><button type="button" onClick={retry} disabled={snapshot.status !== "authenticated"}>Refresh profile</button></header>
    <p className="error" role="alert">{scopeLoss.message}</p>
  </section> : <SelectedParty propertyId={propertyId} partyId={partyId} timezone={timezone} onScopeLoss={invalidateScope} />;
  const same = !blocked && snapshot.status === "authenticated" && state?.snapshot === snapshot && state.propertyId === propertyId && state.query === query.trim();
  const profiles = same && !state.loading && !state.error ? state.profiles : null;
  const selectedId = !blocked && selected?.propertyId === propertyId && selected.snapshot === snapshot ? selected.id : null;
  return <section className="reservation-workspace">
    <div className="reservation-hero board-hero"><div><span className="state">GUEST RELATIONSHIPS</span><h1>Guests</h1>
      <p>Find a guest, open their profile and review their stay history. Contact hints remain as returned by the server.</p></div></div>
    <form className="guest-search" onSubmit={event => { event.preventDefault(); retry(); }}>
      <label>Find a guest<input value={query} minLength={2} maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Enter at least two characters" /></label>
      <button type="submit" disabled={snapshot.status !== "authenticated"}>Search</button>
    </form>
    {blocked ? <p className="error" role="alert">{scopeLoss.message}</p> : query.trim().length < 2 ? <p className="empty">Enter at least two characters to search guest profiles.</p> : !same || state.loading ?
      <p className="empty">{snapshot.status === "authenticated" ? "Searching guest profiles…" : "Sign in to read guest evidence."}</p> :
      state.error ? <p className="error" role="alert">{state.error}</p> : null}
    <div className="guest-results">{profiles?.map(profile => <StaffPartyIdentityCard key={`${profile.partyId}:${state!.generation}`} profile={profile}
      contextLabel="Current granted property · search result" evidenceState="current" action={<button type="button" onClick={() => setSelected({ id: profile.partyId, propertyId, snapshot })}>Open profile</button>} />)}</div>
    {profiles?.length === 0 ? <p className="empty">No guest profile matches this search.</p> : null}
    {selectedId ? <SelectedParty key={`${propertyId}:${selectedId}`} propertyId={propertyId} partyId={selectedId} timezone={timezone} close={() => setSelected(null)} onScopeLoss={invalidateScope} /> : null}
  </section>;
}
