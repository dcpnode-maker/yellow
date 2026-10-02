import { useEffect, useRef, useState } from "react";
import { reactAuthSession, type GrantedProperty } from "../auth-session";
import { propertyLocalDate, type ReservationOffer } from "../yellow-api";
import { createStaffCrsClient, snapshotStaffDraft, staffCrsReservationHref, type StaffSearchDraft, type StaffCrsResult } from "./staff-crs-client";

export function StaffCrsWorkspace({ propertyId, timezone, onContinue }: Readonly<{
  propertyId: string; timezone: string; onContinue: (href: string) => void;
}>) {
  const client = useRef(createStaffCrsClient()).current;
  const navigation = useRef(onContinue); navigation.current = onContinue;
  const generation = useRef(0); const active = useRef<AbortController | null>(null);
  const [properties, setProperties] = useState<readonly GrantedProperty[]>([]);
  const [selected, setSelected] = useState<readonly string[]>([propertyId]);
  const [arrival, setArrival] = useState(() => propertyLocalDate(timezone, 1));
  const [departure, setDeparture] = useState(() => propertyLocalDate(timezone, 3));
  const [adults, setAdults] = useState(1); const [ages, setAges] = useState(""); const [channel, setChannel] = useState("direct");
  const [result, setResult] = useState<Readonly<{ rows: readonly StaffCrsResult[]; draft: StaffSearchDraft }> | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const invalidate = () => { ++generation.current; active.current?.abort(); active.current = null; setResult(null); setBusy(false); };
  useEffect(() => {
    const controller = new AbortController(); const attempt = ++generation.current; active.current = controller;
    void client.properties(controller.signal).then(value => { if (attempt === generation.current) setProperties(value); })
      .catch(reason => { if (attempt === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Property access is unavailable."); });
    const unsubscribe = reactAuthSession.subscribe(() => { invalidate(); setProperties([]); setError("The session changed. Reopen CRS after sign-in."); });
    return () => { ++generation.current; active.current?.abort(); unsubscribe(); };
  }, [propertyId, client]);
  const edit = (change: () => void) => { invalidate(); setError(""); change(); };
  const search = async () => {
    invalidate(); const attempt = generation.current; const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      if (ages !== "" && !/^(?:0|[1-9]\d?)(?:\s*,\s*(?:0|[1-9]\d?))*$/.test(ages)) throw new Error("Enter child ages separated by commas.");
      const draft = snapshotStaffDraft({ arrivalDate: arrival, departureDate: departure, adults,
        childAges: ages === "" ? [] : ages.split(",").map(Number), channelCode: channel });
      const rows = await client.search(selected, draft, controller.signal);
      if (attempt === generation.current && !controller.signal.aborted) setResult({ rows, draft });
    } catch (reason) { if (attempt === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "CRS search failed."); }
    finally { if (attempt === generation.current) setBusy(false); }
  };
  const continueWith = async (row: StaffCrsResult, offer: ReservationOffer) => {
    if (!result || busy) return;
    const captured = result; const attempt = generation.current; const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setBusy(true); setError("");
    try {
      const grants = await client.properties(controller.signal);
      if (!grants.some(property => property.id === row.property.id && property.timezone === row.property.timezone)) throw new Error("Access to this property changed. Search again.");
      if (attempt !== generation.current || controller.signal.aborted) return;
      navigation.current(staffCrsReservationHref(row, offer, captured.draft));
    } catch (reason) { if (attempt === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Property access could not be verified."); }
    finally { if (attempt === generation.current) setBusy(false); }
  };
  return <section className="reservation-workspace" aria-label="Staff CRS">
    <div className="reservation-hero board-hero"><div><span className="state">CRS · STAFF AVAILABILITY</span><h1>CRS</h1><p>Search up to four granted properties. Choose a current offer, then continue through the existing guest and reservation confirmation flow.</p></div></div>
    <fieldset className="reservation-create-panel"><legend>Granted properties</legend>{properties.map(property => <label key={property.id}>
      <input type="checkbox" checked={selected.includes(property.id)} onChange={event => edit(() => setSelected(event.target.checked ? [...selected, property.id] : selected.filter(id => id !== property.id)))} />{property.name}</label>)}</fieldset>
    <div className="reservation-create-grid">
      <label>Arrival<input type="date" value={arrival} onChange={event => edit(() => setArrival(event.target.value))} /></label>
      <label>Departure<input type="date" value={departure} onChange={event => edit(() => setDeparture(event.target.value))} /></label>
      <label>Adults<input type="number" min={1} max={20} value={adults} onChange={event => edit(() => setAdults(Number(event.target.value)))} /></label>
      <label>Child ages<input value={ages} placeholder="5, 12" onChange={event => edit(() => setAges(event.target.value))} /></label>
      <label>Channel<input value={channel} onChange={event => edit(() => setChannel(event.target.value))} /></label>
    </div>
    <button type="button" disabled={busy || !properties.length || !selected.length || selected.length > 4} onClick={() => void search()}>{busy ? "Checking…" : "Search granted properties"}</button>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {result?.rows.map(row => <article key={row.property.id} className="detail-card"><h2>{row.property.name}</h2>
      <p>{row.offers.length} bookable · {row.blocked} blocked · {row.unpriced} unpriced · {row.conflicted} conflicted</p>
      {row.offers.length ? <ul className="reservation-create-results">{row.offers.map(offer => <li key={offer.optionRef}>
        <strong>{offer.sellableUnitName} · {offer.ratePlanCode}</strong><span>{offer.total.amountMinor} {offer.total.currency} minor units · {offer.availableCount} available</span>
        <button type="button" disabled={busy} onClick={() => void continueWith(row, offer)}>Continue with this offer</button></li>)}</ul> : <p className="empty">No current bookable offer returned.</p>}
    </article>)}
    <p className="commercial-note">Availability is evidence, not a promise. The selected reference is a draft only; the destination searches again and requires a canonical guest and explicit confirmation before commit.</p>
  </section>;
}
