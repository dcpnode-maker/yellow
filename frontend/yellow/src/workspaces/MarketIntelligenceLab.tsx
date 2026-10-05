import { useMemo, useState } from "react";
import type { ObservationMode, ObservationRequest, SchedulerResult } from "../market-intelligence/contracts";
import { createMarketIntelligenceScheduler } from "../market-intelligence/scheduler";
import { createSyntheticAdapter } from "../market-intelligence/synthetic-adapter";
import { SegmentedRibbon, type RibbonItem } from "../ui/SegmentedRibbon";
import { StatusBadge } from "../ui/StatusBadge";

const MODES: readonly RibbonItem<ObservationMode>[] = [
  { key: "deterministic", label: "Deterministic", icon: "◇" },
  { key: "ai-drift", label: "AI drift", icon: "⌁" },
  { key: "manual", label: "Manual review", icon: "◎" },
];

const formatMoney = (minor: bigint, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(minor) / 100);

export default function MarketIntelligenceLab({ propertyName = "Current property" }: Readonly<{ propertyName?: string }>) {
  const [mode, setMode] = useState<ObservationMode>("deterministic");
  const [result, setResult] = useState<SchedulerResult | null>(null);
  const [running, setRunning] = useState(false);
  const scheduler = useMemo(() => createMarketIntelligenceScheduler({
    adapters: [
      createSyntheticAdapter({ sourceId: "synthetic-direct", host: "synthetic.yellow.internal" }),
      createSyntheticAdapter({ sourceId: "synthetic-ota", host: "synthetic.yellow.internal" }),
      createSyntheticAdapter({ sourceId: "synthetic-compset", host: "synthetic.yellow.internal" }),
    ],
    policy: {
      id: "yellow-devices-zero-cost",
      allowedHosts: ["synthetic.yellow.internal"],
      zeroCost: true,
      maxConcurrency: 2,
      ttlMs: 60_000,
    },
  }), []);

  const run = async () => {
    setRunning(true);
    const request: ObservationRequest = {
      tenantId: "yellow-devices",
      propertyId: "synthetic-property",
      shell: {
        tenantId: "yellow-devices",
        propertyId: "synthetic-property",
        propertyName,
        timezone: "Asia/Kolkata",
        currency: "INR",
        roomTypeCodes: ["DLX", "STD"],
        ratePlanCodes: ["BAR", "BB"],
        channelCodes: ["DIRECT", "OTA"],
        shellVersion: "synthetic-v1",
        asOf: "2026-09-22",
      },
      arrival: "2026-10-01",
      departure: "2026-10-02",
      occupancy: { adults: 2, children: 0, rooms: 1 },
      currency: "INR",
      roomTypeCodes: ["DLX", "STD"],
      ratePlanCodes: ["BAR", "BB"],
      channelCodes: ["DIRECT", "OTA"],
      sourceIds: ["synthetic-direct", "synthetic-ota", "synthetic-compset"],
      mode,
    };
    try {
      setResult(await scheduler.schedule(request));
    } finally {
      setRunning(false);
    }
  };

  const observations = result?.results.flatMap((entry) => entry.observations) ?? [];
  return (
    <section className="market-lab" aria-labelledby="market-lab-title">
      <header className="market-lab-head">
        <div>
          <span className="eyebrow">Yellow Devices only · synthetic · zero network</span>
          <h1 id="market-lab-title">Market intelligence laboratory</h1>
          <p>Validate contracts, cache behaviour and analysis presentation without provider credentials, client data or external requests.</p>
        </div>
        <StatusBadge tone="warning">Internal lab</StatusBadge>
      </header>

      <SegmentedRibbon layered label="Synthetic analysis modes" items={MODES} value={mode} onChange={(next) => { setMode(next); setResult(null); }} />

      <section className="market-lab-guardrails" aria-label="Laboratory guardrails">
        <div><small>Transport</small><strong>None</strong><span>No browser, fetch or provider adapter</span></div>
        <div><small>Cost policy</small><strong>Hard stop at ₹0</strong><span>Non-zero estimates are refused</span></div>
        <div><small>Absence</small><strong>Not observed</strong><span>Never inferred as sold out</span></div>
      </section>

      <section className="market-lab-runner">
        <div><span className="eyebrow">Fictional property shell</span><h2>{propertyName}</h2><p>2 room types · 2 rate plans · 2 channels · 3 synthetic sources</p></div>
        <button type="button" className="market-lab-run" onClick={() => void run()} disabled={running}>{running ? "Running bounded simulation…" : "Run synthetic observation"}</button>
      </section>

      {result ? (
        <section className="market-lab-results" aria-live="polite">
          <header><div><span className="eyebrow">Scheduler result</span><h2>{result.kind}</h2></div><StatusBadge tone={result.kind === "complete" ? "verified" : "warning"}>{result.fromCache ? "TTL cache" : "Fresh simulation"}</StatusBadge></header>
          <p className="market-lab-cache-key">Canonical key <code>{result.cacheKey.slice(0, 54)}…</code></p>
          <div className="market-lab-offers">
            {observations.slice(0, 8).map((offer) => (
              <article key={offer.offerId}>
                <header><strong>{offer.roomTypeCode}</strong><span>{offer.sourceId}</span></header>
                <p>{offer.ratePlanCode} · {offer.channelCode}</p>
                <strong>{formatMoney(offer.total.amountMinor, offer.total.currency)}</strong>
                <small>{offer.availability.kind === "available" ? `${offer.availability.quantity} synthetic units observed` : "Not observed"}</small>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="operational-state"><strong>No simulation has run</strong><p>Select a presentation mode, then run the bounded synthetic observation.</p></section>
      )}
      <p className="market-lab-disclaimer">This flag is discovery containment only. It is not authorization for any future real-data release.</p>
    </section>
  );
}
