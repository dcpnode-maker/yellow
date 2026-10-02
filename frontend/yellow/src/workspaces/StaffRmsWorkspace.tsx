import { useEffect, useRef, useState } from "react";
import { reactAuthSession } from "../auth-session";
import { propertyLocalDate } from "../yellow-api";
import { SegmentedRibbon } from "../ui/SegmentedRibbon";
import { createStaffRmsClient, type StaffRateBuilder, type StaffRateQuote, type StaffEconomics } from "./staff-rms-client";

type View = "models" | "quote" | "economics";
export function StaffRmsWorkspace({ propertyId, snapshot }: Readonly<{ propertyId: string; snapshot: Readonly<{
  ratePlans: readonly Readonly<{ id: string; name: string; code: string }>[];
  inventory: Readonly<{ sellableUnits: readonly Readonly<{ id: string; name: string }>[] }>;
}> }>) {
  const client = useRef(createStaffRmsClient()).current;
  const generation = useRef(0); const active = useRef<AbortController | null>(null);
  const [view, setView] = useState<View>("models");
  const [plan, setPlan] = useState(snapshot.ratePlans[0]?.id ?? "");
  const [unit, setUnit] = useState(snapshot.inventory.sellableUnits[0]?.id ?? "");
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [adults, setAdults] = useState(1); const [ages, setAges] = useState(""); const [channel, setChannel] = useState("direct");
  const [builder, setBuilder] = useState<StaffRateBuilder | null>(null);
  const [quote, setQuote] = useState<StaffRateQuote | null>(null); const [economics, setEconomics] = useState<StaffEconomics | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const invalidate = () => { ++generation.current; active.current?.abort(); active.current = null; setBuilder(null); setQuote(null); setEconomics(null); setBusy(false); };
  useEffect(() => {
    const loadDates = () => {
      invalidate(); const attempt = generation.current; const controller = new AbortController(); active.current = controller;
      void client.properties(controller.signal).then(properties => {
        if (attempt !== generation.current || controller.signal.aborted) return;
        const property = properties.find(item => item.id === propertyId);
        if (!property) throw new Error("Access to this property is no longer granted.");
        setArrival(propertyLocalDate(property.timezone, 1)); setDeparture(propertyLocalDate(property.timezone, 3));
      }).catch(reason => { if (attempt === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Property timezone is unavailable."); });
    };
    loadDates();
    const unsubscribe = reactAuthSession.subscribe(() => {
      invalidate(); setArrival(""); setDeparture(""); setError("The session changed. Read current evidence again after sign-in.");
      if (reactAuthSession.getSnapshot().status === "authenticated") loadDates();
    });
    return () => { ++generation.current; active.current?.abort(); unsubscribe(); };
  }, [propertyId, snapshot, client]);
  const edit = (change: () => void) => { invalidate(); setError(""); change(); };
  const read = async () => {
    invalidate(); const attempt = generation.current; const controller = new AbortController(); active.current = controller; setBusy(true); setError("");
    try {
      if (view !== "economics" && !snapshot.ratePlans.some(item => item.id === plan)) throw new Error("Choose a current configured rate plan.");
      if (view === "models") {
        const value = await client.builder(propertyId, plan, controller.signal);
        if (attempt === generation.current && !controller.signal.aborted) setBuilder(value);
      } else if (view === "economics") {
        const value = await client.economics(propertyId, controller.signal);
        if (attempt === generation.current && !controller.signal.aborted) setEconomics(value);
      } else {
        if (!snapshot.inventory.sellableUnits.some(item => item.id === unit)) throw new Error("Choose a current configured sellable unit.");
        if (ages !== "" && !/^(?:0|[1-9]\d?)(?:\s*,\s*(?:0|[1-9]\d?))*$/.test(ages)) throw new Error("Enter child ages separated by commas.");
        const value = await client.quote(propertyId, plan, unit, { arrivalDate: arrival, departureDate: departure, adults,
          childAges: ages === "" ? [] : ages.split(",").map(Number), channelCode: channel }, controller.signal);
        if (attempt === generation.current && !controller.signal.aborted) setQuote(value);
      }
    } catch (reason) { if (attempt === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "RMS evidence is unavailable."); }
    finally { if (attempt === generation.current) setBusy(false); }
  };
  return <article className="detail-card commercial-plans" aria-label="Staff RMS">
    <div className="section-heading"><div><span>RMS · SERVER EVIDENCE</span><h2>RMS</h2></div></div>
    <SegmentedRibbon label="RMS evidence" items={[{ key: "models", label: "Rate models" }, { key: "quote", label: "Quote resolver" }, { key: "economics", label: "Recorded economics" }]}
      value={view} onChange={next => edit(() => setView(next))} />
    {view !== "economics" ? <label>Configured rate plan<select value={plan} onChange={event => edit(() => setPlan(event.target.value))}>
      {snapshot.ratePlans.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null}
    {view === "quote" ? <div className="reservation-create-grid">
      <label>Sellable unit<select value={unit} onChange={event => edit(() => setUnit(event.target.value))}>{snapshot.inventory.sellableUnits.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Arrival<input type="date" value={arrival} onChange={event => edit(() => setArrival(event.target.value))} /></label>
      <label>Departure<input type="date" value={departure} onChange={event => edit(() => setDeparture(event.target.value))} /></label>
      <label>Adults<input type="number" min={1} max={20} value={adults} onChange={event => edit(() => setAdults(Number(event.target.value)))} /></label>
      <label>Child ages<input value={ages} onChange={event => edit(() => setAges(event.target.value))} /></label>
      <label>Channel<input value={channel} onChange={event => edit(() => setChannel(event.target.value))} /></label>
    </div> : null}
    <button type="button" disabled={busy || view !== "economics" && !plan || view === "quote" && (!unit || !arrival || !departure)} onClick={() => void read()}>{busy ? "Reading…" : view === "models" ? "Read model catalogue" : view === "quote" ? "Resolve current quote" : "Read recorded economics"}</button>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {builder ? <><p>{builder.modelDraftCount} model drafts · {builder.targetDraftCount} target drafts · {builder.releaseCount} releases returned</p>
      <ul>{builder.catalogue.map(model => <li key={model.key}><strong>{model.label}</strong><span>{model.description}</span><small>{model.key} v{model.version} · {model.capabilities.join(" · ")}</small></li>)}</ul>
      {!builder.releaseCount ? <p className="empty">No release evidence returned for this plan.</p> : null}</> : null}
    {quote ? <><h3>Server result: {quote.state}</h3>{quote.reason === null ? null : <p>{quote.reason}</p>}<ul>{Object.entries(quote.components).map(([key, amount]) => <li key={key}><strong>{key}</strong><span>{amount === null ? "Not returned" : `${amount} ${quote.currency} minor units`}</span></li>)}</ul>
      <p>Tax assignment: {quote.taxAssignmentState ?? "Not returned"}. Quote evidence: {quote.quoteHash ?? "Not returned"}.</p></> : null}
    {economics ? <><p>{economics.name} · Business date {economics.businessDate} · {economics.currency}</p>
      <ul><li>Room nights: {economics.roomNights} · Rooms available: {economics.roomsAvailable}</li><li>Occupancy: {economics.occupancyBasisPoints} basis points</li>
        <li>Room revenue: {economics.roomRevenueMinor} minor units</li><li>ADR: {economics.adrMinor} minor units · RevPAR: {economics.revparMinor} minor units</li></ul>
      <small>Recorded stats_daily_commercial_taxonomy evidence.</small></> : null}
    {!snapshot.ratePlans.length && view !== "economics" ? <p className="empty">No configured rate plan returned.</p> : null}
    <p className="commercial-note">Read-only server evidence. This surface does not publish rates, execute release authoring commands, or infer forecasts, commissions, costs or net profit. Quotes are not reservation promises.</p>
  </article>;
}
