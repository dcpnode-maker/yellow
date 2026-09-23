import { useMemo, useState } from "react";
import { OptionsDrawer } from "../ui/OptionsDrawer";
import { SegmentedRibbon, type RibbonItem } from "../ui/SegmentedRibbon";
import { StatusBadge, type StatusTone } from "../ui/StatusBadge";
import {
  CAPABILITY_REGISTRY,
  capabilitiesForModule,
  isOperationalCapability,
  type CapabilityRecord,
  type CapabilityStatus,
  type EcosystemModule,
} from "../ecosystem/capability-registry";

type EcosystemView = "all" | "operate" | "stay" | "commercial" | "guest" | "property" | "platform";

type EcosystemHubProps = Readonly<{
  propertyName?: string;
  propertyId?: string;
  onNavigate?: (workspace: string) => void;
  internalMarketLabEnabled?: boolean;
  onOpenMarketLab?: () => void;
}>;

const viewLabels: Readonly<Record<EcosystemView, string>> = {
  all: "All ecosystem",
  operate: "Operate",
  stay: "Stay",
  commercial: "Commercial",
  guest: "Guest",
  property: "Property",
  platform: "Platform",
};

const viewModules: Readonly<Record<Exclude<EcosystemView, "all">, readonly EcosystemModule[]>> = {
  operate: ["today", "front-desk", "rooms", "housekeeping", "guest-services", "cashiering", "finance"],
  stay: ["reservations", "crm", "groups-events"],
  commercial: ["revenue", "distribution", "analytics"],
  guest: ["guest-mobile", "guest-services", "crm", "food-ancillaries"],
  property: ["maintenance-assets", "food-ancillaries", "purchasing-inventory", "property-setup"],
  platform: ["compliance", "integrations"],
};

const moduleLabels: Readonly<Record<EcosystemModule, string>> = {
  today: "Today & Overwatch",
  reservations: "Reservations & CRS",
  "front-desk": "Front desk",
  rooms: "Rooms",
  housekeeping: "Housekeeping",
  "guest-services": "Guest services",
  cashiering: "Cashiering",
  finance: "Finance",
  revenue: "Revenue",
  distribution: "Distribution",
  crm: "CRM",
  "groups-events": "Groups & events",
  "maintenance-assets": "Maintenance & assets",
  "food-ancillaries": "F&B & ancillaries",
  "purchasing-inventory": "Purchasing & inventory",
  analytics: "Analytics",
  compliance: "Compliance",
  "property-setup": "Property setup",
  integrations: "Integrations",
  "guest-mobile": "Yellow guest/mobile",
};

const moduleIcons: Readonly<Record<EcosystemModule, string>> = {
  today: "✦",
  reservations: "▤",
  "front-desk": "⌂",
  rooms: "▦",
  housekeeping: "⌁",
  "guest-services": "♡",
  cashiering: "¤",
  finance: "∑",
  revenue: "↗",
  distribution: "⇄",
  crm: "◎",
  "groups-events": "◇",
  "maintenance-assets": "⌘",
  "food-ancillaries": "◌",
  "purchasing-inventory": "⊞",
  analytics: "∿",
  compliance: "✓",
  "property-setup": "⚙",
  integrations: "⌘",
  "guest-mobile": "⌕",
};

const statusLabel: Readonly<Record<CapabilityStatus, string>> = {
  live: "Live",
  beta: "Beta",
  preview: "Preview",
  blocked: "Blocked",
  planned: "Planned",
};

const statusTone = (status: CapabilityStatus): StatusTone => {
  if (status === "live") return "verified";
  if (status === "beta" || status === "preview") return "warning";
  if (status === "blocked") return "urgent";
  return "neutral";
};

const routeFor = (capability: CapabilityRecord, propertyId: string): string =>
  capability.route.replaceAll(":propertyId", encodeURIComponent(propertyId));

// App's existing workflow router accepts workspace identities. Keep those
// identities separate from the registry's route metadata so a live card never
// accidentally sends a URL-shaped value to the parent router.
const liveWorkspaceFor: Readonly<Record<string, string>> = {
  "today.command-centre": "today",
  "reservations.board": "reservations",
  "reservations.detail": "reservations",
  "front-desk.arrivals-departures": "today",
  "front-desk.check-in-readiness": "reservations",
  "rooms.board": "operations",
  "rooms.assignment": "reservations",
  "rooms.inventory": "rates",
  "housekeeping.tasks": "housekeeping",
  "housekeeping.inspection": "housekeeping",
  "cashiering.desk": "finance",
  "cashiering.deposits": "finance",
  "finance.control-centre": "finance",
  "revenue.rate-strategy": "rates",
  "crm.guests": "guests",
  "analytics.performance": "rates",
  "property-setup.settings": "settings",
};

const viewModulesFor = (view: EcosystemView): readonly EcosystemModule[] | null =>
  view === "all" ? null : viewModules[view];

function CapabilityCard({
  capability,
  propertyId,
  onNavigate,
  onPreview,
}: Readonly<{
  capability: CapabilityRecord;
  propertyId: string;
  onNavigate: (workspace: string) => void;
  onPreview: (capability: CapabilityRecord) => void;
}>) {
  const operational = isOperationalCapability(capability);
  const navigate = () => onNavigate(liveWorkspaceFor[capability.key] ?? routeFor(capability, propertyId));
  return (
    <article className={`ecosystem-capability ecosystem-status-${capability.status}`} data-capability-key={capability.key}>
      <header className="ecosystem-capability-head">
        <div>
          <span className="ecosystem-capability-module">{moduleLabels[capability.module]}</span>
          <h3>{capability.label}</h3>
        </div>
        <StatusBadge tone={statusTone(capability.status)}>{statusLabel[capability.status]}</StatusBadge>
      </header>
      <p className="ecosystem-capability-summary">{capability.summary}</p>
      <p className="ecosystem-capability-purpose"><strong>Purpose</strong> {capability.operationalPurpose}</p>
      <div className="ecosystem-capability-actions">
        {operational ? (
          <button type="button" className="card-link" onClick={navigate} aria-label={`Open ${capability.label}`}>
            {capability.status === "beta" ? "Open bounded view" : "Open workspace"} <span aria-hidden="true">→</span>
          </button>
        ) : (
          <>
            <button type="button" className="card-link" disabled aria-disabled="true">Not operational</button>
            <button type="button" className="ecosystem-preview-link" onClick={() => onPreview(capability)} aria-haspopup="dialog">
              View boundary <span aria-hidden="true">↗</span>
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function EcosystemHub({
  propertyName = "Current property",
  propertyId = "current-property",
  onNavigate = () => undefined,
  internalMarketLabEnabled = false,
  onOpenMarketLab,
}: EcosystemHubProps) {
  const [view, setView] = useState<EcosystemView>("all");
  const [selected, setSelected] = useState<CapabilityRecord | null>(null);

  const modules = viewModulesFor(view);
  const visibleCapabilities = useMemo(
    () => modules === null
      ? CAPABILITY_REGISTRY
      : CAPABILITY_REGISTRY.filter((capability) => modules.includes(capability.module)),
    [modules],
  );
  const grouped = useMemo(() => {
    const groups = new Map<EcosystemModule, CapabilityRecord[]>();
    for (const capability of visibleCapabilities) {
      const group = groups.get(capability.module) ?? [];
      group.push(capability);
      groups.set(capability.module, group);
    }
    return [...groups.entries()];
  }, [visibleCapabilities]);
  const ribbon = useMemo<readonly RibbonItem<EcosystemView>[]>(() => {
    const items: RibbonItem<EcosystemView>[] = [{ key: "all", label: viewLabels.all, icon: "✦", count: CAPABILITY_REGISTRY.length }];
    for (const key of ["operate", "stay", "commercial", "guest", "property", "platform"] as const) {
      const count = CAPABILITY_REGISTRY.filter((capability) => viewModules[key].includes(capability.module)).length;
      items.push({ key, label: viewLabels[key], icon: key === "operate" ? "⌂" : key === "commercial" ? "↗" : key === "platform" ? "⌘" : "◇", count });
    }
    return items;
  }, []);

  const liveCount = CAPABILITY_REGISTRY.filter((capability) => capability.status === "live").length;
  const plannedCount = CAPABILITY_REGISTRY.filter((capability) => capability.status === "planned" || capability.status === "preview" || capability.status === "blocked").length;

  return (
    <section className="ecosystem-hub" aria-labelledby="ecosystem-title">
      <header className="ecosystem-hub-head">
        <div>
          <span className="eyebrow">Yellow ecosystem · {propertyName}</span>
          <h1 id="ecosystem-title">One operating model. Every surface accounted for.</h1>
          <p>Live workspaces stay actionable. The rest of the approved product is visible as an honest, non-operational preview with its prerequisite and route boundary.</p>
        </div>
        <div className="ecosystem-hub-summary" aria-label="Ecosystem capability summary">
          <strong>{liveCount}</strong><span>live</span>
          <strong>{plannedCount}</strong><span>preview or planned</span>
        </div>
      </header>

      <SegmentedRibbon layered label="Ecosystem areas" items={ribbon} value={view} onChange={setView} />

      <div className="ecosystem-view-heading">
        <div>
          <span className="eyebrow">Capability index</span>
          <h2>{viewLabels[view]}</h2>
        </div>
        <p>{visibleCapabilities.length} approved surface{visibleCapabilities.length === 1 ? "" : "s"}</p>
      </div>

      <div className="ecosystem-module-list">
        {grouped.map(([module, capabilities]) => (
          <section className="ecosystem-module" key={module} aria-labelledby={`ecosystem-module-${module}`}>
            <header className="ecosystem-module-head">
              <span className="ecosystem-module-icon" aria-hidden="true">{moduleIcons[module]}</span>
              <div><h2 id={`ecosystem-module-${module}`}>{moduleLabels[module]}</h2><p>{capabilities.length} {capabilities.length === 1 ? "capability" : "capabilities"}</p></div>
            </header>
            <div className="ecosystem-capability-grid">
              {capabilities.map((capability) => <CapabilityCard key={capability.key} capability={capability} propertyId={propertyId} onNavigate={onNavigate} onPreview={setSelected} />)}
            </div>
          </section>
        ))}
      </div>

      {internalMarketLabEnabled && onOpenMarketLab ? (
        <aside className="ecosystem-internal-lab" aria-label="Yellow Devices internal market lab">
          <div><span className="eyebrow">Yellow Devices only · synthetic</span><h2>Internal market lab</h2><p>Explore deterministic source contracts and drift analysis. This presentation state never contacts a provider or exposes hotel-user data.</p></div>
          <button type="button" className="card-link" onClick={onOpenMarketLab}>Open internal lab <span aria-hidden="true">→</span></button>
        </aside>
      ) : null}

      <OptionsDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.label} · ${statusLabel[selected.status]}` : "Capability boundary"}
        description={selected?.summary}
      >
        {selected ? (
          <div className="ecosystem-preview-detail">
            <StatusBadge tone={statusTone(selected.status)}>{statusLabel[selected.status]}</StatusBadge>
            <p className="ecosystem-preview-boundary">{selected.statusReason}</p>
            <dl>
              <div><dt>Operational purpose</dt><dd>{selected.operationalPurpose}</dd></div>
              <div><dt>Prerequisite</dt><dd>{selected.prerequisite}</dd></div>
              <div><dt>Audience</dt><dd>{selected.audience.join(" · ")}</dd></div>
              <div><dt>Devices</dt><dd>{selected.devices.join(" · ")}</dd></div>
              <div><dt>Presentation route</dt><dd><code>{selected.route}</code></dd></div>
            </dl>
            <button type="button" className="card-link" disabled aria-disabled="true">No action is available from this preview</button>
          </div>
        ) : null}
      </OptionsDrawer>
    </section>
  );
}

export type { EcosystemHubProps };
export { capabilitiesForModule };
