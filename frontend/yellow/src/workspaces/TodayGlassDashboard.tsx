import { useState, type CSSProperties, type ReactNode } from "react";

type MovementSignal = Readonly<{
  label: string;
  value: number | null;
  loading: boolean;
  unavailable: boolean;
  glyph: string;
  onOpen: () => void;
}>;

type DemoStep = Readonly<{
  label: string;
  title: string;
  purpose: string;
  status: string;
  onOpen: () => void;
}>;

type BusinessMixSignal = Readonly<{
  label: string;
  source: string;
  stays: number;
}>;

type TodayGlassDashboardProps = Readonly<{
  greeting: string;
  propertyName: string;
  localTime: string;
  occupancyPercent: number | null;
  roomNights: number | null;
  roomsAvailable: number | null;
  roomRevenue: string | null;
  adr: string | null;
  revpar: string | null;
  performanceLoading: boolean;
  performanceUnavailable: boolean;
  occupancyVariance?: ReactNode;
  revenueVariance?: ReactNode;
  movements: readonly [MovementSignal, MovementSignal, MovementSignal];
  businessMix: readonly BusinessMixSignal[];
  demoSteps: readonly DemoStep[];
  onOpenPerformance: () => void;
}>;

function metricValue(
  value: string | number | null,
  loading: boolean,
  unavailable: boolean,
): string {
  if (loading) return "Loading";
  if (unavailable || value === null) return "Unavailable";
  return String(value);
}

export function TodayGlassDashboard({
  greeting,
  propertyName,
  localTime,
  occupancyPercent,
  roomNights,
  roomsAvailable,
  roomRevenue,
  adr,
  revpar,
  performanceLoading,
  performanceUnavailable,
  occupancyVariance,
  revenueVariance,
  movements,
  businessMix,
  demoSteps,
  onOpenPerformance,
}: TodayGlassDashboardProps) {
  const [movementIndex, setMovementIndex] = useState(0);
  const occupancy = metricValue(
    occupancyPercent === null ? null : `${occupancyPercent}%`,
    performanceLoading,
    performanceUnavailable,
  );
  const sold = metricValue(roomNights, performanceLoading, performanceUnavailable);
  const available = metricValue(roomsAvailable, performanceLoading, performanceUnavailable);
  const performanceState = performanceLoading || performanceUnavailable || occupancyPercent === null;
  const revenue = metricValue(roomRevenue, performanceLoading, performanceUnavailable);
  const averageDailyRate = metricValue(adr, performanceLoading, performanceUnavailable);
  const revenuePerAvailableRoom = metricValue(revpar, performanceLoading, performanceUnavailable);
  const usefulStats = [
    { label: "Occupancy", value: occupancy, helper: "current house fill", action: onOpenPerformance },
    { label: "Room nights", value: sold, helper: "sold today", action: onOpenPerformance },
    { label: "Available", value: available, helper: "rooms left", action: onOpenPerformance },
    { label: "Revenue", value: revenue, helper: "room revenue", action: onOpenPerformance },
    { label: "ADR", value: averageDailyRate, helper: "avg daily rate", action: onOpenPerformance },
    { label: "RevPAR", value: revenuePerAvailableRoom, helper: "revenue / available room", action: onOpenPerformance },
  ] as const;

  return (
    <section className="today-glass" aria-labelledby="today-glass-heading">
      <div className="today-glass-orb" aria-hidden="true" />
      <header className="today-glass-heading">
        <div>
          <span>LIVE TODAY</span>
          <h1 id="today-glass-heading">{greeting}.</h1>
        </div>
        <p>{propertyName}<small>{localTime} · property local time</small></p>
      </header>

      <div className="today-glass-command" aria-label="Today command summary">
        <div>
          <span className="today-glass-command-kicker">PMS command centre</span>
          <strong>Front desk, cashier and rooms in one live view</strong>
        </div>
        <p>Tap any card to open the exact governed workspace. No write action runs from this screen.</p>
      </div>

      <div className="today-glass-stat-grid" aria-label="Useful operating stats">
        {usefulStats.map((stat) => (
          <button type="button" key={stat.label} onClick={stat.action}>
            <span>{stat.label}</span>
            <strong className={performanceState ? "is-state" : undefined}>{stat.value}</strong>
            <small>{stat.helper}</small>
          </button>
        ))}
      </div>

      <div className="today-glass-stage">
        <div className="today-glass-depth" aria-hidden="true"><i /><i /></div>
        <div className="today-glass-pulse">
          <button
            type="button"
            className="today-glass-occupancy"
            aria-label={`Open operating performance. Occupancy ${occupancy}`}
            onClick={onOpenPerformance}
          >
            <span>Occupancy</span>
            <strong className={performanceState ? "is-state" : undefined}>{occupancy}</strong>
            <small>{sold} rooms sold · {available} available</small>
            {occupancyVariance}
          </button>
          <button
            type="button"
            className="today-glass-revenue"
            aria-label={`Open operating performance. Room revenue ${metricValue(roomRevenue, performanceLoading, performanceUnavailable)}`}
            onClick={onOpenPerformance}
          >
            <span>Room revenue</span>
            <strong className={performanceState ? "is-state" : undefined}>{revenue}</strong>
            <small>ADR {averageDailyRate} · RevPAR {revenuePerAvailableRoom}</small>
            {revenueVariance}
          </button>
        </div>
      </div>

      <section className="today-business-mix" aria-label="Business mix by market and source">
        <div>
          <span>BUSINESS MIX</span>
          <strong>Market · source · channel</strong>
        </div>
        {businessMix.length ? <ul>{businessMix.map((item) => (
          <li key={`${item.label}-${item.source}`}>
            <span>{item.label}</span>
            <strong>{item.stays}</strong>
            <small>{item.source}</small>
          </li>
        ))}</ul> : <p>No coded movement rows yet.</p>}
      </section>

      <div className="today-glass-movement-wrap">
        <span className="today-glass-ribbon-label">Guest movement</span>
        <div className="today-glass-tab-depth" aria-hidden="true"><i /><i /></div>
        <div
          className="today-glass-ribbon"
          role="group"
          aria-label="Open today's complete guest movement tables"
          style={{ "--today-movement-index": movementIndex } as CSSProperties}
        >
          <i className="today-glass-ribbon-pill" aria-hidden="true" />
          {movements.map((movement, index) => {
            const rendered = metricValue(movement.value, movement.loading, movement.unavailable);
            return (
              <button
                type="button"
                key={movement.label}
                aria-label={`Open ${movement.label.toLowerCase()} table. ${rendered}`}
                onPointerEnter={() => setMovementIndex(index)}
                onFocus={() => setMovementIndex(index)}
                onClick={movement.onOpen}
              >
                <span aria-hidden="true">{movement.glyph}</span>
                <small>{movement.label}</small>
                <strong className={movement.loading || movement.unavailable || movement.value === null ? "is-state" : undefined}>{rendered}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <section className="today-demo-path" aria-labelledby="today-demo-path-title">
        <div className="today-demo-path-head">
          <span>COLLEAGUE DEMO PATH</span>
          <h2 id="today-demo-path-title">Review the implemented PMS flow in order</h2>
          <p>Each card opens a governed workspace or assistant journey. Dashboard cards navigate only.</p>
        </div>
        <div className="today-demo-path-grid">
          {demoSteps.map((step, index) => (
            <button type="button" key={step.label} onClick={step.onOpen} aria-label={`Open demo step ${index + 1}: ${step.title}`}>
              <small>{String(index + 1).padStart(2, "0")} · {step.label}</small>
              <strong>{step.title}</strong>
              <span>{step.purpose}</span>
              <em>{step.status}</em>
            </button>
          ))}
        </div>
      </section>
      <p className="today-glass-note">Live hotel data · select a signal for its complete operational view.</p>
    </section>
  );
}
