import { type CSSProperties, type ReactNode } from "react";
import { BUSINESS_MIX_PERIODS, type BusinessMixPeriod, type BusinessMixSnapshot, movementHaptic } from "../today-business-mix";

type MovementSignal = Readonly<{
  label: string;
  value: number | null;
  loading: boolean;
  unavailable: boolean;
  glyph: string;
  onOpen: () => void;
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
  businessMix: BusinessMixSnapshot | null;
  businessMixPeriod: BusinessMixPeriod;
  businessMixLoading: boolean;
  businessMixError: string | null;
  onBusinessMixPeriod: (period: BusinessMixPeriod) => void;
  formatMoney: (minor: string, currency: string) => string;
  activeMovementIndex: number;
  movementDrawerOpen: boolean;
  movementDrawer: ReactNode;
  onMovementDrawerToggle: () => void;
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
  businessMixPeriod, businessMixLoading, businessMixError, onBusinessMixPeriod, formatMoney,
  activeMovementIndex, movementDrawerOpen, movementDrawer, onMovementDrawerToggle,
  onOpenPerformance,
}: TodayGlassDashboardProps) {
  const movementIndex = activeMovementIndex;
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

      <div className="today-glass-movement-wrap">
        <span className="today-glass-ribbon-label">Guest movement</span>
        <div className="today-glass-tab-depth" aria-hidden="true"><i /><i /></div>
        <div
          className="today-glass-ribbon"
          role="group"
          aria-label="Guest movement"
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
                aria-pressed={movementIndex === index}
                onClick={() => { movementHaptic(); movement.onOpen(); }}
              >
                <span aria-hidden="true">{movement.glyph}</span>
                <small>{movement.label}</small>
                <strong className={movement.loading || movement.unavailable || movement.value === null ? "is-state" : undefined}>{rendered}</strong>
              </button>
            );
          })}
        </div>
        <button type="button" className="today-drawer-toggle" aria-expanded={movementDrawerOpen} aria-controls="today-reservation-drawer"
          onClick={() => { movementHaptic(); onMovementDrawerToggle(); }}>
          {movementDrawerOpen ? "Hide reservations" : "Show reservations"}<span aria-hidden="true">{movementDrawerOpen ? "⌃" : "⌄"}</span>
        </button>
        <div className={`today-reservation-drawer${movementDrawerOpen ? " is-open" : ""}`} id="today-reservation-drawer" inert={!movementDrawerOpen} aria-hidden={!movementDrawerOpen}>
          <div className="today-reservation-drawer-body">{movementDrawer}</div>
        </div>
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

      <section className="today-business-mix" aria-label="Business mix by market segment group, market segment and source" aria-busy={businessMixLoading}>
        <header className="today-mix-heading"><span>BUSINESS MIX</span><h2>Source performance</h2></header>
        <div className="today-mix-periods" role="group" aria-label="Business mix period">
          {BUSINESS_MIX_PERIODS.map(period => <button type="button" key={period} aria-pressed={businessMixPeriod === period} onClick={() => onBusinessMixPeriod(period)}>{period[0]!.toUpperCase() + period.slice(1)}</button>)}
        </div>
        <p className="today-mix-context">Calendar period to date · week starts Monday · property local dates</p>
        {businessMixLoading ? <p role="status">Loading source performance…</p> : businessMixError ? <p role="alert">{businessMixError}</p> : businessMix ? <>
          <p>{businessMix.fromDate} – {businessMix.toDateExclusive} (end excluded) · {businessMix.recordedDays}/{businessMix.expectedDays} dates recorded{businessMix.recordedDays < businessMix.expectedDays ? " · incomplete period evidence" : ""}</p>
          {businessMix.rows.length ? <div className="today-mix-scroll"><table><caption>Recorded room revenue · {businessMix.currency} · share of room nights</caption>
            <thead><tr><th scope="col">Source / channel</th><th scope="col">Room nights</th><th scope="col">Revenue</th><th scope="col">ADR</th><th scope="col">Mix</th></tr></thead>
            <tbody>{businessMix.rows.map((item,index) => <tr key={`${item.marketSegmentGroup}-${item.marketSegment}-${item.source}-${item.channel}-${index}`}>
              <th scope="row">{item.source}<small>{item.channel} · {item.marketSegmentGroup} → {item.marketSegment}</small></th>
              <td>{item.roomNights}</td><td>{formatMoney(item.roomRevenueMinor,businessMix.currency)}</td><td>{formatMoney(item.adrMinor,businessMix.currency)}</td><td>{(item.shareBasisPoints / 100).toFixed(2)}%</td>
            </tr>)}</tbody>
          </table></div> : <p>No recorded source performance for this period.</p>}
        </> : <p>Source performance unavailable.</p>}
      </section>
      <p className="today-glass-note">Live hotel data · select a signal for its complete operational view.</p>
    </section>
  );
}
