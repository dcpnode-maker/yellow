import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { OptionsDrawer } from "../ui/OptionsDrawer";
import { SegmentedRibbon, type RibbonItem } from "../ui/SegmentedRibbon";
import { StatusBadge, type StatusTone } from "../ui/StatusBadge";
import type { OperationalBlock, OperationalRoom, OperationalStay, QueryState } from "./operational-data";
import { loadDepartureServiceQueue, loadDepartureServices, transitionDepartureService, type DepartureServiceRequest } from "../yellow-api";

import "./department-task-table.css";

type View = "rooms" | "arrivals" | "departures" | "service" | "sources" | "tasks";

const toneFor = (value?: string | null): StatusTone => {
  const state = value?.toLowerCase() ?? "";
  if (/clean|inspect|ready|complete|checked_in/.test(state)) return "verified";
  if (/dirty|blocked|urgent|overdue|out_of_order/.test(state)) return "urgent";
  if (/pickup|progress|assigned|due|pending/.test(state)) return "warning";
  return "neutral";
};

const labelFor = (value?: string | null) => value?.replaceAll("_", " ") || "Status unavailable";
const guestName = (stay: OperationalStay) => stay.primaryGuestDisplayName ?? stay.primaryPartyName ?? "Guest name unavailable";

function StatePanel({ loading, error, empty, children }: Readonly<{
  loading: boolean;
  error: boolean;
  empty: boolean;
  children: React.ReactNode;
}>) {
  if (loading) return <section className="operational-state" aria-live="polite"><strong>Loading current hotel truth…</strong><p>Yellow is fetching one bounded operational view.</p></section>;
  if (error) return <section className="operational-state is-error" role="alert"><strong>This view is unavailable</strong><p>No result has been inferred. Refresh the source workspace or try again.</p></section>;
  if (empty) return <section className="operational-state"><strong>Nothing requires attention here</strong><p>The current server response contains no matching records.</p></section>;
  return <>{children}</>;
}

const departureServiceLabel = (kind: DepartureServiceRequest["serviceKind"]): string =>
  kind === "luggage_pickup" ? "Luggage pickup" : kind === "minibar_check" ? "Minibar check" : kind === "room_inspection" ? "Room inspection" : "Role escalation";

export function DepartureServiceQueue() {
  const queue = useQuery({
    queryKey: ["operational-departure-service-queue"],
    queryFn: loadDepartureServiceQueue,
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });
  const requests = queue.data?.requests ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const detailQueries = useQueries({
    queries: requests.map((request) => ({
      queryKey: ["operational-departure-service-detail", request.reservationId],
      queryFn: () => loadDepartureServices(request.reservationId),
      staleTime: 0,
      retry: 1,
    })),
  });
  const [staffSelection, setStaffSelection] = useState<Readonly<Record<string, string>>>({});
  const [outcomeSelection, setOutcomeSelection] = useState<Readonly<Record<string, "clear" | "finding_reported" | "unable_to_complete" | "">>>({});
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const action = async (request: DepartureServiceRequest, name: "withdraw" | "assign" | "start" | "complete") => {
    if (busyRequestId) return;
    const staffPartyId = staffSelection[request.requestId] ?? request.assigneePartyId;
    const outcome = outcomeSelection[request.requestId] ?? "";
    if (name === "assign" && !staffPartyId) {
      setMessage("Choose one active staff Party before assigning.");
      return;
    }
    if (name === "complete" && request.serviceKind !== "luggage_pickup" && request.serviceKind !== "escalation" && !outcome) {
      setMessage("Choose one bounded human outcome before completing this request.");
      return;
    }
    setBusyRequestId(request.requestId);
    setMessage(null);
    try {
      await transitionDepartureService(request.requestId, name, {
        expectedVersion: request.version,
        staffPartyId: name === "assign" ? staffPartyId : null,
        outcome: name === "complete" && request.serviceKind !== "luggage_pickup" && request.serviceKind !== "escalation" ? outcome || null : null,
      }, `yellow-departure-queue-${name}-${request.requestId}`);
      await queue.refetch();
      setMessage(`${departureServiceLabel(request.serviceKind)} updated from the server receipt.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The queue action was not accepted.");
      await queue.refetch().catch(() => undefined);
    } finally {
      setBusyRequestId(null);
    }
  };
  if (queue.isLoading) return <section className="departure-queue operational-state" aria-live="polite"><strong>Loading departure service queue…</strong><p>Reading role-visible requests from the property service queue.</p></section>;
  if (queue.isError) return <section className="departure-queue operational-state is-error" role="alert"><strong>Departure service queue unavailable</strong><p>No queue state has been inferred.</p></section>;
  if (!requests.length) return <section className="departure-queue operational-state"><strong>No open departure service requests</strong><p>Confirmed luggage, minibar and room-inspection work will appear here.</p></section>;
  const statusOf = (request: DepartureServiceRequest) => request.taskStatus ?? request.proposalStatus;
  const roleOf = (request: DepartureServiceRequest) => request.targetRoleId === null ? "none" : `role:${request.targetRoleId}`;
  const statuses = [...new Set(requests.map(statusOf))].sort();
  const services = [...new Set(requests.map((request) => request.serviceKind))].sort();
  const roles = [...new Map(requests.map((request) => [roleOf(request), request.targetRoleName ?? (request.targetRoleId ? `Role reference: ${request.targetRoleId}` : "Configured queue")])).entries()];
  const term = search.trim().toLocaleLowerCase();
  const visible = requests.map((request, index) => ({ request, index })).filter(({ request, index }) =>
    (!statusFilter || statusOf(request) === statusFilter) && (!serviceFilter || request.serviceKind === serviceFilter) &&
    (!roleFilter || roleOf(request) === roleFilter) && (!assignmentFilter || String(request.assigneePartyId !== null) === assignmentFilter) &&
    (!term || [request.requestId, request.reservationId, request.spaceId, request.taskId, request.serviceKind, departureServiceLabel(request.serviceKind),
      statusOf(request), request.targetRoleId, request.targetRoleName, request.assigneePartyId, request.dueLocal, request.outcome,
      detailQueries[index]?.data?.staff.find((person) => person.partyId === request.assigneePartyId)?.name].filter((value) => value != null).join(" ").toLocaleLowerCase().includes(term)));
  const clearFilters = () => { setSearch(""); setStatusFilter(""); setServiceFilter(""); setRoleFilter(""); setAssignmentFilter(""); };
  return <section className="departure-queue department-task-dashboard" aria-labelledby="departure-queue-title">
    <header className="departure-queue-head"><div><span className="eyebrow">ROLE-VISIBLE SERVICE TASKS</span><h2 id="departure-queue-title">Department service tasks</h2></div></header>
    <p>Current returned luggage pickup, minibar, room-inspection and escalation requests. Other CRM and PMS task kinds are outside this queue.</p>
    <div className="department-task-filters">
      <label className="department-task-search">Search loaded tasks<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Service, reservation reference or returned field" /></label>
      <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></label>
      <label>Service<select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="">All services</option>{services.map((value) => <option key={value} value={value}>{departureServiceLabel(value)}</option>)}</select></label>
      <label>Role target<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All role targets</option>{roles.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      <label>Assignment<select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}><option value="">All assignments</option><option value="true">Assigned</option><option value="false">Unassigned</option></select></label>
      <button type="button" onClick={clearFilters}>Clear filters</button>
    </div>
    <p role="status">{visible.length} of {requests.length} loaded requests</p>
    <p className="department-task-coverage">The server returns at most 100 role-visible requests.{requests.length >= 100 ? " This response reaches that limit; more requests may exist." : " Counts cover this response only."}</p>
    {visible.length ? <div className="department-task-scroll" role="region" aria-label="Department service task table" tabIndex={0}><table><caption>Loaded role-visible department service requests</caption><thead><tr><th scope="col">Service</th><th scope="col">Status</th><th scope="col">Reservation reference</th><th scope="col">Room reference</th><th scope="col">Role target</th><th scope="col">Assignment</th><th scope="col">Due</th><th scope="col">Task details</th></tr></thead><tbody>
    {visible.map(({ request, index }) => {
      const details = detailQueries[index]?.data;
      const staff = details?.staff ?? [];
      const selectedStaff = staffSelection[request.requestId] ?? request.assigneePartyId ?? "";
      return <tr key={request.requestId} data-request-id={request.requestId}>
        <th scope="row">{departureServiceLabel(request.serviceKind)}</th><td><StatusBadge tone={toneFor(statusOf(request))}>{labelFor(statusOf(request))}</StatusBadge></td>
        <td>{request.reservationId}</td><td>{request.spaceId}</td><td>{request.targetRoleName ?? (request.targetRoleId ? `Role reference: ${request.targetRoleId}` : "Configured queue")}</td>
        <td>{details?.staff.find((person) => person.partyId === request.assigneePartyId)?.name ?? (request.assigneePartyId ? "Assigned staff" : "Not assigned")}</td><td>{request.dueLocal ?? "Immediate"}</td>
        <td><details className="department-task-detail"><summary>Review task</summary>
          <p>Request reference: {request.requestId}</p><p>Outcome: {request.outcome?.replaceAll("_", " ") ?? "Not recorded"}</p>
        {request.eligibleActions.includes("assign") ? <label className="departure-queue-select">Active staff<select value={selectedStaff} onChange={(event) => setStaffSelection((current) => ({ ...current, [request.requestId]: event.target.value }))}><option value="">Choose staff</option>{staff.map((person) => <option key={person.partyId} value={person.partyId}>{person.name}</option>)}</select></label> : null}
        {!request.outcome && request.eligibleActions.includes("complete") && request.serviceKind !== "luggage_pickup" && request.serviceKind !== "escalation" ? <label className="departure-queue-select">Human outcome<select value={outcomeSelection[request.requestId] ?? ""} onChange={(event) => setOutcomeSelection((current) => ({ ...current, [request.requestId]: event.target.value as "clear" | "finding_reported" | "unable_to_complete" | "" }))}><option value="">Choose outcome</option><option value="clear">Clear</option><option value="finding_reported">Finding reported</option><option value="unable_to_complete">Unable to complete</option></select></label> : null}
        <div className="departure-queue-actions">{request.eligibleActions.includes("withdraw") ? <button type="button" disabled={busyRequestId !== null} onClick={() => void action(request, "withdraw")}>Withdraw</button> : null}{request.eligibleActions.includes("assign") ? <button type="button" disabled={busyRequestId !== null || !selectedStaff} onClick={() => void action(request, "assign")}>Assign</button> : null}{request.eligibleActions.includes("start") ? <button type="button" disabled={busyRequestId !== null} onClick={() => void action(request, "start")}>Start</button> : null}{request.eligibleActions.includes("complete") ? <button type="button" disabled={busyRequestId !== null || (request.serviceKind !== "luggage_pickup" && request.serviceKind !== "escalation" && !(outcomeSelection[request.requestId] ?? ""))} onClick={() => void action(request, "complete")}>{request.serviceKind === "luggage_pickup" ? "Confirm delivery" : "Complete"}</button> : null}</div>
        </details></td>
      </tr>;
    })}</tbody></table></div> : <p className="empty">No loaded requests match these filters.</p>}
    {message ? <p className="checkout-message" role="status" aria-live="polite">{message}</p> : null}
  </section>;
}

export default function OperationalHub({
  propertyName,
  arrivals,
  departures,
  rooms,
  blocks,
  onOpenReservation,
  onNavigate,
  initialView = "rooms",
}: Readonly<{
  propertyName: string;
  initialView?: View;
  arrivals: QueryState<readonly OperationalStay[]>;
  departures: QueryState<readonly OperationalStay[]>;
  rooms: QueryState<readonly OperationalRoom[]>;
  blocks: QueryState<readonly OperationalBlock[]>;
  onOpenReservation: (stay: OperationalStay) => void;
  onNavigate: (workspace: string) => void;
}>) {
  const [view, setView] = useState<View>(initialView);
  useEffect(() => { setView(initialView); }, [initialView]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const observedSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const stay of [...(arrivals.data ?? []), ...(departures.data ?? [])]) {
      const source = stay.channelCode?.trim() || stay.sourceCode?.trim() || "Unspecified source";
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [arrivals.data, departures.data]);
  const sourcesTrusted = !arrivals.isLoading && !departures.isLoading && !arrivals.isError && !departures.isError;
  const displayedSources = sourcesTrusted ? observedSources : [];
  const ribbon = useMemo<readonly RibbonItem<View>[]>(() => [
    { key: "rooms", label: "Rooms", icon: "▦", count: rooms.data?.length },
    { key: "arrivals", label: "Arrivals", icon: "↘", count: arrivals.data?.length },
    { key: "departures", label: "Departures", icon: "↗", count: departures.data?.length },
    { key: "tasks", label: "Tasks", icon: "☷" },
    { key: "service", label: "Service", icon: "⌁", count: blocks.data?.length },
    { key: "sources", label: "Sources", icon: "⊞", count: sourcesTrusted ? observedSources.length : null },
  ], [arrivals.data?.length, blocks.data?.length, departures.data?.length, observedSources.length, rooms.data?.length, sourcesTrusted]);

  const currentTitle = ribbon.find((item) => item.key === view)?.label ?? "Operations";
  return (
    <section className="operational-hub" aria-labelledby="operations-title">
      <header className="operational-hub-head">
        <div>
          <span className="eyebrow">Live operations · {propertyName}</span>
          <h1 id="operations-title">Run the hotel, without the noise.</h1>
          <p>Current truth first. Detailed controls appear only when you ask for them.</p>
        </div>
        <button type="button" className="options-button" onClick={() => setOptionsOpen(true)} aria-haspopup="dialog">Options <span aria-hidden="true">⌄</span></button>
      </header>

      <SegmentedRibbon layered label="Operational views" items={ribbon} value={view} onChange={setView} />

      <div className="operational-summary" aria-label={`${currentTitle} summary`}>
        <span>{currentTitle}</span>
        <strong>{ribbon.find((item) => item.key === view)?.count ?? "—"}</strong>
        <small>current records</small>
      </div>

      {view === "rooms" ? (
        <StatePanel loading={rooms.isLoading} error={rooms.isError} empty={!rooms.data?.length}>
          <div className="operational-card-grid">
            {rooms.data?.map((room) => (
              <article className="operational-card" key={room.spaceId}>
                <header><div><small>ROOM</small><h2>{room.spaceLabel}</h2></div><StatusBadge tone={toneFor(room.condition)}>{labelFor(room.condition)}</StatusBadge></header>
                <dl><div><dt>Occupancy</dt><dd>{labelFor(room.occupancyState)}</dd></div><div><dt>Work</dt><dd>{room.task ? labelFor(room.task.state) : "No active task"}</dd></div></dl>
                <button type="button" className="card-link" onClick={() => onNavigate("housekeeping")}>Open housekeeping <span aria-hidden="true">→</span></button>
              </article>
            ))}
          </div>
        </StatePanel>
      ) : null}

      {view === "arrivals" || view === "departures" ? (() => {
        const state = view === "arrivals" ? arrivals : departures;
        return (
          <StatePanel loading={state.isLoading} error={state.isError} empty={!state.data?.length}>
            <div className="operational-list" role="list">
              {state.data?.map((stay) => (
                <article role="listitem" className="operational-row" key={stay.reservationId}>
                  <div className="operational-row-main"><span>{stay.sellableUnitLabel ?? "Room unassigned"}</span><strong>{guestName(stay)}</strong><small>{stay.confirmationNo} · {stay.unitTypeLabel ?? "Category unavailable"}</small></div>
                  <StatusBadge tone={toneFor(stay.operationalState)}>{labelFor(stay.operationalState)}</StatusBadge>
                  <button type="button" onClick={() => onOpenReservation(stay)}>Open <span aria-hidden="true">→</span></button>
                </article>
              ))}
            </div>
          </StatePanel>
        );
      })() : null}

      {view === "tasks" ? <DepartureServiceQueue /> : null}

      {view === "service" ? (
        <StatePanel loading={blocks.isLoading} error={blocks.isError} empty={false}>
          {blocks.data?.length ? <div className="operational-list" role="list">
            {blocks.data.map((block, index) => (
              <article role="listitem" className="operational-row" key={block.id ?? block.blockId ?? index}>
                <div className="operational-row-main"><span>OPERATIONAL BLOCK</span><strong>{block.label ?? block.title ?? "Attention required"}</strong><small>{block.reason ?? "Open the source workspace for current detail."}</small></div>
                <StatusBadge tone={toneFor(block.state)}>{labelFor(block.state)}</StatusBadge>
              </article>
            ))}
          </div> : <p className="empty">No operational blocks are currently recorded.</p>}
          <DepartureServiceQueue />
        </StatePanel>
      ) : null}

      {view === "sources" ? (
          <div className="source-grid" aria-label="Observed and planned reservation sources">
            {arrivals.isLoading || departures.isLoading ? <article className="source-card source-state"><small>LIVE EVIDENCE</small><h2>Loading current sources…</h2><p>Planned connectors remain previews until an accepted contract exists.</p></article> : null}
            {arrivals.isError || departures.isError ? <article className="source-card source-state is-error"><small>LIVE EVIDENCE</small><h2>Current sources unavailable</h2><p>No source count has been inferred.</p></article> : null}
            {!arrivals.isLoading && !departures.isLoading && !arrivals.isError && !departures.isError && observedSources.length === 0 ? <article className="source-card source-state"><small>LIVE EVIDENCE</small><h2>No current movements</h2><p>The current arrival and departure reads contain no source records.</p></article> : null}
            {displayedSources.map(([source, count]) => (
              <article className="source-card is-live" key={source}><header><div><small>OBSERVED SOURCE</small><h2>{source}</h2></div><StatusBadge tone="verified">Live evidence</StatusBadge></header><strong>{count}</strong><p>current arrival/departure record{count === 1 ? "" : "s"}</p></article>
            ))}
            <article className="source-card is-planned" aria-disabled="true"><small>CONNECTOR PREVIEW</small><h2>Overture</h2><StatusBadge tone="neutral">Contract pending</StatusBadge><p>Shown in the operating model; no connector or data claim yet.</p></article>
            <article className="source-card is-planned" aria-disabled="true"><small>CONNECTOR PREVIEW</small><h2>Booking.com · Expedia</h2><StatusBadge tone="neutral">Certification gated</StatusBadge><p>Reservation delivery, acknowledgement, mapping and ARI controls.</p></article>
            <article className="source-card is-planned" aria-disabled="true"><small>CONNECTOR PREVIEW</small><h2>Agoda</h2><StatusBadge tone="neutral">Certification gated</StatusBadge><p>Booking-hint recovery, mapping, allotment and restriction controls.</p></article>
            <article className="source-card is-planned" aria-disabled="true"><small>CONNECTOR PREVIEW</small><h2>MakeMyTrip · Goibibo</h2><StatusBadge tone="neutral">Private spec required</StatusBadge><p>Property-authorized mapping after partner access is proven.</p></article>
          </div>
      ) : null}

      <OptionsDrawer open={optionsOpen} onClose={() => setOptionsOpen(false)} title={`${currentTitle} options`} description="Go directly to the specialist workspace. Yellow does not invent an action when no governed command exists.">
        <div className="option-groups">
          <section><span className="eyebrow">Front office</span><button type="button" onClick={() => onNavigate("reservations")}><strong>Reservation board</strong><small>Search, arrivals, departures and stay detail</small></button><button type="button" onClick={() => onNavigate("finance")}><strong>Cashier & folios</strong><small>Guest bills, deposits and posting controls</small></button></section>
          <section><span className="eyebrow">Rooms</span><button type="button" onClick={() => onNavigate("housekeeping")}><strong>Housekeeping</strong><small>Room conditions, tasks and inspections</small></button><button type="button" onClick={() => onNavigate("settings")}><strong>Property setup</strong><small>Property identity and configuration</small></button></section>
          <section className="ecosystem-preview"><span className="eyebrow">Ecosystem preview</span><p>Visible now so the complete operating model is clear. These remain disabled until their governed connector is accepted.</p><button type="button" disabled><strong>Overture</strong><small>Connector definition and authoritative contract pending</small></button><button type="button" disabled><strong>Booking.com · Expedia · Agoda</strong><small>Certification-gated channel delivery and mapping</small></button><button type="button" disabled><strong>MakeMyTrip · Goibibo</strong><small>Private partner specification required</small></button><button type="button" disabled><strong>Revenue intelligence</strong><small>Approved source, freshness and cost controls required</small></button></section>
        </div>
      </OptionsDrawer>
    </section>
  );
}
