import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { reservationViewDestination, reservationViewFromSearch, type ReservationWorkspaceView } from "../reservation-navigation";
import { WorkspaceDock, type WorkspaceDockAction } from "./WorkspaceDock";
import { PortfolioExplorer } from "./PortfolioExplorer";
import { loadPropertyOperatingMode } from "../yellow-api";
import "./PropertyOperatingModeCard.css";
import {
  defaultWorkspaceDockPlacement,
  readWorkspaceDockPlacement,
  resolveWorkspaceDockPlacement,
  type WorkspaceDockPlacement,
  type WorkspaceDockStorage,
} from "./workspace-dock";

const sections = [
  { label: "Operate", items: [["today", "Today"], ["reservations", "Reservations"], ["operations", "Front desk"], ["housekeeping-menu", "Housekeeping"]] },
  { label: "Business", items: [["finance", "Cashier"], ["rates", "Rates & distribution"], ["market-map", "Map"], ["status", "Reports"]] },
  { label: "System", items: [["ecosystem", "All workspaces"], ["settings", "Property setup"]] },
] as const;

function MenuIcon({ close = false }: { close?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {close ? <path d="m7 7 10 10M17 7 7 17" /> : <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16m5-11 3 3-3 3" /></>}
  </svg>;
}

function WorkspaceIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    today: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16M8 14h2m4 0h2m-8 3h2"/></>,
    reservations: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3v3m6-3v3M8 10h8m-8 4h8m-8 4h5"/></>,
    operations: <><path d="M4 17h16M6 15a6 6 0 0 1 12 0M3 20h18M12 6V4m-2 0h4"/></>,
    "rooms-housekeeping": <><path d="M3 19V8m18 11V8M3 15h18M5 8h14a2 2 0 0 1 2 2v5H3v-5a2 2 0 0 1 2-2Z"/><path d="M12 8v7"/></>,
    inventory: <><path d="M3 19V8m18 11V8M3 15h18M5 8h14a2 2 0 0 1 2 2v5H3v-5a2 2 0 0 1 2-2Z"/><path d="M12 8v7"/></>,
    housekeeping: <><path d="m15 3-4 9m-4-2 9 4-3 7-9-4 3-7Zm2 5-2 4m5-3-2 4"/></>,
    "housekeeping-menu": <><path d="m15 3-4 9m-4-2 9 4-3 7-9-4 3-7Zm2 5-2 4m5-3-2 4"/></>,
    finance: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    rates: <><path d="M4 20V10m5 10V5m6 15v-8m5 8V3"/></>,
    "market-map": <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>,
    status: <><path d="M4 20h17M5 16l5-6 4 3 6-8"/></>,
    ecosystem: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
    individual: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3v3m6-3v3M8 10h8m-8 4h8m-8 4h5"/></>,
    groups: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2Zm13-13a3 3 0 0 1 0 6m1 2a5 5 0 0 1 4 5"/></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.ecosystem}</svg>;
}

function getWorkspaceDockStorage(): WorkspaceDockStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** A single navigation surface; existing guarded callbacks retain mutation/recovery authority. */
export function OperatorHeader({ children, workspace, propertyId, propertyName, onNavigate, onBilling, locked, internalMarketLabEnabled = false }: Readonly<{
  children: ReactNode;
  workspace: string;
  propertyId: string;
  propertyName: string;
  onNavigate: (destination: string) => void;
  onBilling: () => void;
  locked: boolean;
  internalMarketLabEnabled?: boolean;
}>) {
  const operatingMode = useQuery({
    queryKey: ["property-operating-mode", propertyId],
    queryFn: () => loadPropertyOperatingMode(propertyId),
    retry: false,
  });
  const [workspaceView, setWorkspaceView] = useState<"hotel" | "str" | null>(null);
  useEffect(() => {
    const mode = operatingMode.data?.mode ?? null;
    setWorkspaceView(mode === "both" ? (current => current === "str" ? "str" : "hotel") : mode);
  }, [propertyId, operatingMode.data?.mode]);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 980px)").matches);
  const [expanded, setExpanded] = useState(() => {
    try { return window.localStorage.getItem("yellow.navigation.v1") !== "collapsed"; } catch { return true; }
  });
  const savedDockPlacement = useRef<WorkspaceDockPlacement | undefined>(undefined);
  const didReadDockPlacement = useRef(false);
  if (!didReadDockPlacement.current) {
    savedDockPlacement.current = readWorkspaceDockPlacement(getWorkspaceDockStorage());
    didReadDockPlacement.current = true;
  }
  const [dockPlacement, setDockPlacement] = useState(() => resolveWorkspaceDockPlacement(
    savedDockPlacement.current,
    typeof window === "undefined" ? 1280 : window.innerWidth,
  ));
  const dockPlacementChosen = useRef(savedDockPlacement.current !== undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reservationsOpen, setReservationsOpen] = useState(workspace === "reservations");
  const [roomsOpen, setRoomsOpen] = useState(workspace === "operations" || workspace === "housekeeping");
  const [reservationView, setReservationView] = useState<ReservationWorkspaceView>(() =>
    typeof window === "undefined" ? "list" : reservationViewFromSearch(window.location.search));
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  const panelId = useId();
  const reservationsChildrenId = `${panelId}-reservations-views`;
  const roomsChildrenId = `${panelId}-rooms-views`;
  const open = mobile ? mobileOpen : expanded;
  const childList = Children.toArray(children);
  const propertyControl = childList.find((child) => isValidElement<{ className?: string }>(child) && child.props.className === "property-switcher");
  const utilities = childList.filter((child) => !isValidElement<{ className?: string }>(child) || (child.type !== "nav" && child.props.className !== "brand" && child.props.className !== "property-switcher"));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 980px)");
    const change = () => { setMobile(query.matches); setMobileOpen(false); };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const resize = () => {
      if (!dockPlacementChosen.current) setDockPlacement(defaultWorkspaceDockPlacement(window.innerWidth));
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const syncReservationView = () => setReservationView(reservationViewFromSearch(window.location.search));
    window.addEventListener("popstate", syncReservationView);
    return () => window.removeEventListener("popstate", syncReservationView);
  }, []);
  useEffect(() => {
    if (workspace === "operations" || workspace === "housekeeping") setRoomsOpen(true);
  }, [workspace]);
  useEffect(() => {
    if (!mobile || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = [...(header.current?.parentElement?.children ?? [])].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== header.current);
    const inertBefore = background.map((node) => node.inert);
    background.forEach((node) => { node.inert = true; });
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== "Tab") return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']") ?? [])];
      const first = controls[0]; const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((node, index) => { node.inert = inertBefore[index] ?? false; });
      document.removeEventListener("keydown", keydown);
      trigger.current?.focus();
    };
  }, [mobile, mobileOpen]);
  const toggle = () => {
    if (mobile) { setMobileOpen((value) => !value); return; }
    setExpanded((value) => {
      try { window.localStorage.setItem("yellow.navigation.v1", value ? "collapsed" : "expanded"); } catch { /* Private browsing must not disable navigation. */ }
      return !value;
    });
  };
  const changeDockPlacement = (placement: WorkspaceDockPlacement) => {
    if (locked) return;
    dockPlacementChosen.current = true;
    setDockPlacement(placement);
  };
  const dockActions: readonly WorkspaceDockAction[] = [
    { id: "today", label: "Today", current: workspace === "today", icon: <WorkspaceIcon name="today" />, onActivate: () => onNavigate("today") },
    { id: "reservations", label: "Reservations", current: workspace === "reservations", icon: <WorkspaceIcon name="reservations" />, onActivate: () => { setReservationView("list"); onNavigate(reservationViewDestination("list")); } },
    { id: "operations", label: "Front desk", current: workspace === "operations", icon: <WorkspaceIcon name="operations" />, onActivate: () => onNavigate("operations") },
    { id: "housekeeping", label: "Housekeeping", current: workspace === "housekeeping", icon: <WorkspaceIcon name="housekeeping" />, onActivate: () => onNavigate("housekeeping") },
    { id: "finance", label: "Cashier", current: workspace === "finance", icon: <WorkspaceIcon name="finance" />, onActivate: onBilling },
    { id: "rates", label: "Rates & distribution", current: workspace === "rates", icon: <WorkspaceIcon name="rates" />, onActivate: () => onNavigate("rates") },
    { id: "market-map", label: "Map", current: workspace === "market-map", icon: <WorkspaceIcon name="market-map" />, onActivate: () => onNavigate("market-map") },
    { id: "status", label: "Reports", current: workspace === "status", icon: <WorkspaceIcon name="status" />, onActivate: () => onNavigate("status") },
    { id: "ecosystem", label: "All workspaces", current: workspace === "ecosystem", icon: <WorkspaceIcon name="ecosystem" />, onActivate: () => onNavigate("ecosystem") },
    { id: "settings", label: "Property setup", current: workspace === "settings", icon: <WorkspaceIcon name="settings" />, onActivate: () => onNavigate("settings") },
  ];
  return <header ref={header} className="topbar operator-header" data-hotel-search="enabled" data-nav-expanded={open}>
    <button ref={trigger} className="operator-nav-toggle" type="button" aria-controls={panelId} aria-expanded={open} aria-label={open ? "Collapse navigation" : "Expand navigation"} onClick={toggle}><MenuIcon /></button>
    <a className="operator-brand" href={`/p/${propertyId}/today`} aria-label="Yellow home" aria-disabled={locked || undefined} onClick={(event) => { event.preventDefault(); if (!locked) onNavigate("today"); }}><b>Y</b><span>YELLOW</span></a>
    <span className="operator-property-context" title={propertyName}>{propertyName}</span>
    <PortfolioExplorer propertyId={propertyId} propertyName={propertyName} locked={locked} />
    {operatingMode.isLoading ? <span className="property-mode-header is-pending" role="status">Mode…</span> : operatingMode.isError || !operatingMode.data ? <button className="property-mode-header" type="button" title="Retry reading the saved property mode" onClick={() => void operatingMode.refetch()} disabled={locked || operatingMode.isFetching}>Mode unavailable</button> : operatingMode.data.mode === null ? <button className="property-mode-header" type="button" title="Configure the operating mode for this property" onClick={() => onNavigate("settings")} disabled={locked || !operatingMode.data.canWrite}>{operatingMode.data.canWrite ? "Set up mode" : "Mode not configured"}</button> : operatingMode.data.mode === "both" ? <button className="property-mode-header is-view" type="button" title="View preference only; this remains the same property and inventory" aria-label={`Current ${workspaceView === "str" ? "STR" : "Hotel"} view. Switch workspace view`} aria-pressed={workspaceView === "str"} onClick={() => setWorkspaceView(workspaceView === "str" ? "hotel" : "str")} disabled={locked}>{workspaceView === "str" ? "STR view" : "Hotel view"}<span aria-hidden="true">⌄</span></button> : <span className="property-mode-header" title="Saved operating mode">{operatingMode.data.mode === "hotel" ? "Hotel view" : "STR view"}</span>}
    <div className="operator-header-tools" inert={mobileOpen || undefined}>{utilities}</div>
    {mobileOpen ? <button type="button" tabIndex={-1} className="operator-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
    <aside ref={panel} id={panelId} className="operator-navigation" data-expanded={open} data-mobile={mobile} inert={!mobile && !open || mobile && !mobileOpen || undefined} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined} aria-label="Workspace navigation">
      <div className="operator-navigation-heading"><strong>Workspaces</strong><button ref={close} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><MenuIcon close /></button></div>
      <div className="operator-navigation-property"><small>Current property</small>{propertyControl ?? <strong>{propertyName}</strong>}</div>
      <nav aria-label="Hotel operations">
        {sections.map((section) => <section key={section.label} className="operator-navigation-group"><h2>{section.label}</h2>{section.items.map(([destination, label]) => destination === "reservations" ? <div key={destination} className="operator-reservations-nav operator-navigation-nested">
          <button className="operator-navigation-parent" type="button" title={label} aria-label={label} aria-expanded={reservationsOpen} aria-controls={reservationsChildrenId} data-active={workspace === destination} disabled={locked} onClick={() => setReservationsOpen(value => !value)}>
            <WorkspaceIcon name={destination} /><span>{label}</span><span className="operator-navigation-disclosure" aria-hidden="true">{reservationsOpen ? "⌄" : "›"}</span>
          </button>
          <div id={reservationsChildrenId} className="operator-reservation-children operator-navigation-children" role="group" aria-label="Reservation views" hidden={!reservationsOpen}>
            {([ ["list", "Individual", "individual"], ["groups", "Groups", "groups"], ["calendar", "Calendar", "calendar"] ] as const).map(([view, childLabel, icon]) => <button key={view} type="button" title={childLabel} aria-label={childLabel} aria-current={reservationView === view && workspace === "reservations" ? "page" : undefined} disabled={locked} onClick={() => { if (locked) return; setReservationView(view); onNavigate(reservationViewDestination(view)); setMobileOpen(false); }}><WorkspaceIcon name={icon} /><span>{childLabel}</span></button>)}
          </div>
        </div> : destination === "housekeeping-menu" ? <div key={destination} className="operator-navigation-nested">
          <button className="operator-navigation-parent" type="button" title={label} aria-label={label} aria-expanded={roomsOpen} aria-controls={roomsChildrenId} data-active={workspace === "operations" || workspace === "housekeeping"} disabled={locked} onClick={() => setRoomsOpen(value => !value)}>
            <WorkspaceIcon name={destination} /><span>{label}</span><span className="operator-navigation-disclosure" aria-hidden="true">{roomsOpen ? "⌄" : "›"}</span>
          </button>
          <div id={roomsChildrenId} className="operator-navigation-children operator-room-children" role="group" aria-label="Room and housekeeping views" hidden={!roomsOpen}>
            {([ ["operations", "Room status", "operations"], ["housekeeping", "Cleaning & inspection", "housekeeping"] ] as const).map(([route, childLabel, icon]) => <button key={route} type="button" title={childLabel} aria-label={childLabel} aria-current={workspace === route ? "page" : undefined} disabled={locked} onClick={() => { if (locked) return; onNavigate(route); setMobileOpen(false); }}><WorkspaceIcon name={icon} /><span>{childLabel}</span></button>)}
          </div>
        </div> : <button key={destination} type="button" title={label} aria-label={label} aria-current={workspace === destination ? "page" : undefined} disabled={locked} onClick={() => { if (locked) return; destination === "finance" ? onBilling() : onNavigate(destination); setMobileOpen(false); }}><WorkspaceIcon name={destination} /><span>{label}</span></button>)}</section>)}
        {internalMarketLabEnabled ? <button type="button" title="Internal market lab" disabled={locked} onClick={() => { onNavigate("market-lab"); setMobileOpen(false); }}><WorkspaceIcon name="status" /><span>Internal market lab</span></button> : null}
      </nav>
    </aside>
    {(!open || mobile) && (!mobile || !mobileOpen) ? <WorkspaceDock
      actions={dockActions}
      placement={dockPlacement}
      locked={locked}
      onPlacementChange={changeDockPlacement}
    /> : null}
  </header>;
}
