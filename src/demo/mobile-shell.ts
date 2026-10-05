import { COLLEAGUE_DEMO_READINESS, type ColleagueDemoReadiness } from "./colleague-readiness";
import { buildDemoFrontDeskBoard, type DemoFrontDeskBoard } from "./front-desk-board";
import { buildDemoHotelPerformance, type DemoHotelPerformance } from "./hotel-performance";
import { buildColleagueOperatingJourney, type ColleagueOperatingJourney } from "./operating-journey";
import { buildDemoPropertyConfiguration, type DemoPropertyConfiguration } from "./property-config";

export const DEMO_SHELL_CSS = `
:root {
  color-scheme: light;
  --ink: #0b1020;
  --muted: #627084;
  --line: rgba(15, 23, 42, 0.12);
  --surface: rgba(255, 255, 255, 0.82);
  --surface-strong: rgba(255, 255, 255, 0.96);
  --neon: #39ff88;
  --yellow: #fff138;
  --red: #ff365d;
  --orange: #ff9a2e;
  --blue: #2962ff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-width: 320px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(circle at 12% 0%, rgba(57, 255, 136, 0.24), transparent 32rem),
    radial-gradient(circle at 90% 8%, rgba(255, 241, 56, 0.22), transparent 26rem),
    linear-gradient(180deg, #f8fbff 0%, #eef5f1 48%, #f8fafc 100%);
}
a { color: inherit; }
.shell {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 18px clamp(16px, 4vw, 28px) 40px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0 22px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 850;
  letter-spacing: -0.04em;
}
.mark {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: #050816;
  box-shadow: 0 0 0 2px rgba(57, 255, 136, 0.85), 0 0 28px rgba(57, 255, 136, 0.75);
}
.status-pill {
  border: 1px solid var(--line);
  background: var(--surface-strong);
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 0.82rem;
  color: var(--muted);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 18px;
  align-items: stretch;
}
.glass {
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: linear-gradient(145deg, rgba(255,255,255,0.92), rgba(255,255,255,0.58));
  box-shadow: 0 20px 80px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.9);
  border-radius: 30px;
  backdrop-filter: blur(24px);
}
.hero-main { padding: clamp(22px, 5vw, 42px); }
h1 {
  margin: 0;
  font-size: clamp(2.4rem, 8vw, 5.8rem);
  line-height: 0.9;
  letter-spacing: -0.08em;
}
.lead {
  margin: 20px 0 0;
  max-width: 58ch;
  color: var(--muted);
  font-size: clamp(1rem, 2vw, 1.18rem);
  line-height: 1.6;
}
.hero-side { padding: 22px; display: grid; gap: 12px; }
.stat {
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.74);
  border-radius: 22px;
  padding: 16px;
}
.stat b { display: block; font-size: 1.45rem; letter-spacing: -0.05em; }
.stat span { display: block; color: var(--muted); font-size: 0.85rem; margin-top: 4px; }
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 18px 0 0;
}
.link-button {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  background: #08091f;
  color: #fff;
  text-decoration: none;
  font-weight: 750;
  box-shadow: 0 0 28px rgba(57, 255, 136, 0.32);
}
.link-button.secondary {
  background: rgba(255,255,255,0.78);
  color: var(--ink);
  border: 1px solid var(--line);
  box-shadow: none;
}
.section-title {
  margin: 34px 0 14px;
  font-size: clamp(1.6rem, 5vw, 3rem);
  letter-spacing: -0.06em;
}
.workflow-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.card {
  position: relative;
  padding: 18px;
  overflow: hidden;
}
.card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: var(--neon);
  box-shadow: 0 0 22px var(--neon);
}
.card.needs::before { background: var(--orange); box-shadow: 0 0 22px var(--orange); }
.card h3 {
  margin: 0 0 8px;
  font-size: 1.2rem;
  letter-spacing: -0.04em;
}
.purpose {
  margin: 0 0 12px;
  color: var(--muted);
  line-height: 1.45;
  font-size: 0.94rem;
}
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.chip {
  border-radius: 999px;
  padding: 7px 10px;
  background: rgba(57,255,136,0.16);
  border: 1px solid rgba(57,255,136,0.42);
  color: #0b6234;
  font-size: 0.78rem;
  font-weight: 760;
}
.chip.warn {
  background: rgba(255,154,46,0.16);
  border-color: rgba(255,154,46,0.42);
  color: #8a4500;
}
.action-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.action-list li {
  border-radius: 14px;
  border: 1px solid var(--line);
  padding: 10px 12px;
  background: rgba(255,255,255,0.66);
  font-size: 0.86rem;
}
.block-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.block-card { padding: 18px; }
.block-card h3 { margin: 0; }
.config-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.config-card { padding: 18px; }
.config-card h3 { margin: 0 0 8px; }
.config-card b { display: block; font-size: 1.8rem; letter-spacing: -0.06em; }
.config-card span { color: var(--muted); font-size: 0.82rem; }
.block-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.metric {
  border-radius: 16px;
  padding: 10px;
  background: rgba(8,9,31,0.04);
}
.metric b { display: block; font-size: 1.1rem; }
.metric span { color: var(--muted); font-size: 0.72rem; }
.footnote {
  margin: 20px 0 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.5;
}
.eyebrow {
  margin: 0 0 12px;
  color: #08783f;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.76rem;
}
.notice {
  display: grid;
  gap: 4px;
  margin: 0 0 16px;
  padding: 14px 16px;
  border-radius: 20px;
  border: 1px solid rgba(57,255,136,0.52);
  background: rgba(57,255,136,0.16);
}
.notice.bad {
  border-color: rgba(255,54,93,0.48);
  background: rgba(255,54,93,0.12);
}
.notice span { color: var(--muted); }
.flow-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.flow-card {
  padding: 18px;
}
.flow-card h3 { margin: 0 0 10px; letter-spacing: -0.04em; }
.operator-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}
.operator-list li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255,255,255,0.72);
  border: 1px solid var(--line);
}
.operator-list span { color: var(--muted); text-align: right; }
label {
  display: grid;
  gap: 7px;
  margin: 12px 0;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 750;
}
input {
  width: 100%;
  min-height: 44px;
  border-radius: 16px;
  border: 1px solid var(--line);
  padding: 0 12px;
  background: rgba(255,255,255,0.86);
  color: var(--ink);
  font: inherit;
}
.action-button {
  width: 100%;
  min-height: 46px;
  border: 0;
  border-radius: 999px;
  background: #07120c;
  color: white;
  font: inherit;
  font-weight: 850;
  box-shadow: 0 0 30px rgba(57,255,136,0.36);
}
@media (max-width: 760px) {
  .shell { padding-top: 12px; }
  .topbar { align-items: flex-start; }
  .hero, .workflow-grid, .block-strip, .config-grid, .flow-grid { grid-template-columns: 1fr; }
  .hero-main, .hero-side { border-radius: 26px; }
  .block-metrics { grid-template-columns: repeat(2, 1fr); }
}
`.trim();

export function renderMobileDemoShell(
  readiness: ColleagueDemoReadiness = COLLEAGUE_DEMO_READINESS,
  journey: ColleagueOperatingJourney = buildColleagueOperatingJourney(),
  performance: DemoHotelPerformance = buildDemoHotelPerformance(),
  board: DemoFrontDeskBoard = buildDemoFrontDeskBoard(),
  propertyConfig: DemoPropertyConfiguration = buildDemoPropertyConfiguration(),
): string {
  const provedCount = readiness.requirements.filter((requirement) => requirement.status === "proved").length;
  const workflowCards = journey.workflows.map((workflow) => {
    const needs = workflow.status === "needs_governed_execution";
    const chips = workflow.currentState.slice(0, 2).map((state) => `<span class="chip${needs ? " warn" : ""}">${escapeHtml(state)}</span>`).join("");
    const actions = workflow.actions.slice(0, 3)
      .map((action) => `<li>${escapeHtml(action.label)} · confirmation required · disabled</li>`)
      .join("");
    return `<article class="card glass${needs ? " needs" : ""}">
      <h3>${escapeHtml(workflow.title)}</h3>
      <p class="purpose">${escapeHtml(workflow.purpose)}</p>
      <div class="chips">${chips}</div>
      <ul class="action-list">${actions}</ul>
    </article>`;
  }).join("");
  const blocks = journey.groupBlocks.map((block) => `<article class="block-card glass">
    <h3>${escapeHtml(block.code)} · ${escapeHtml(block.name)}</h3>
    <p class="purpose">${escapeHtml(block.operationalPurpose)}</p>
    <div class="block-metrics">
      <div class="metric"><b>${block.totals.blocked}</b><span>blocked</span></div>
      <div class="metric"><b>${block.totals.pickedUp}</b><span>picked up</span></div>
      <div class="metric"><b>${block.totals.washed}</b><span>washed</span></div>
      <div class="metric"><b>${block.totals.availableForPickup}</b><span>available</span></div>
    </div>
  </article>`).join("");
  const groupCodes = propertyConfig.marketSegmentGroups.map((group) => group.code).join(" · ");
  const sourceKinds = [...new Set(propertyConfig.sourceChannels.map((source) => source.kind))].join(" · ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yellow PMS demo</title>
  <link rel="stylesheet" href="/assets/demo.css">
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand"><span class="mark" aria-hidden="true"></span><span>Yellow PMS</span></div>
      <div class="status-pill">Demo status: ${escapeHtml(readiness.status)} · notification disabled</div>
    </header>
    <section class="hero">
      <div class="hero-main glass">
        <h1>${escapeHtml(journey.property.name)}</h1>
        <p class="lead">A mobile-first operating demo for ${escapeHtml(journey.guestScenario.guestName)} / ${escapeHtml(journey.guestScenario.reservationCode)} showing PMS flows, group blocks, cashier safety and Overwatch confirmation gates without clutter.</p>
        <nav class="links" aria-label="Demo API links">
          <a class="link-button" href="/api/v1/demo/operating-journey">Operating journey JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/colleague-scenario">Colleague scenario JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/front-desk-board">Front desk board JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/property-config">Property config JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/performance">Performance JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/ai-rehearsal">AI rehearsal JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/action-safety-matrix">Action safety JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/workflow-rehearsal">Workflow rehearsal JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/proof-bundle">Proof bundle JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/readiness">Readiness JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/group-blocks">Group blocks JSON</a>
          <a class="link-button secondary" href="/api/v1/demo/group-blocks/manager">Block manager JSON</a>
        </nav>
      </div>
      <aside class="hero-side glass">
        <div class="stat"><b>${performance.hotel.occupancyPct ?? "—"}%</b><span>occupancy · server-read model</span></div>
        <div class="stat"><b>₹${formatMinor(performance.hotel.adrMinor)}</b><span>ADR · recomputed after aggregation</span></div>
        <div class="stat"><b>₹${formatMinor(performance.hotel.revparMinor)}</b><span>RevPAR · ${performance.hotel.roomNights} room nights</span></div>
        <div class="stat"><b>10</b><span>governed mutation families · exact confirmation</span></div>
      </aside>
    </section>
    <h2 class="section-title">Configured property</h2>
    <section class="config-grid" aria-label="Configured property summary">
      <article class="config-card glass">
        <h3>Inventory</h3>
        <b>${propertyConfig.property.inventoryRooms}</b>
        <span>${propertyConfig.roomTypes.length} room types · ${propertyConfig.roomClasses.length} room classes</span>
      </article>
      <article class="config-card glass">
        <h3>Rates and packages</h3>
        <b>${propertyConfig.ratePlans.length}</b>
        <span>${propertyConfig.mealPlans.length} meal plans · ${propertyConfig.cancellationPolicies.length} cancellation policies</span>
      </article>
      <article class="config-card glass">
        <h3>Business mix</h3>
        <b>${propertyConfig.marketSegmentGroups.length}</b>
        <span>${escapeHtml(groupCodes)} · sources: ${escapeHtml(sourceKinds)}</span>
      </article>
      <article class="config-card glass">
        <h3>Cashier safety</h3>
        <b>${propertyConfig.cashierPolicy.cashDrawerRequiredForRead ? "drawer" : "no drawer"}</b>
        <span>read/prep allowed · governed posting/settlement · ${escapeHtml(propertyConfig.safety.publicDemoMutationMode)}</span>
      </article>
    </section>
    <h2 class="section-title">Operating journey</h2>
    <section class="block-strip">
      <article class="block-card glass">
        <h3>Today board</h3>
        <p class="purpose">Due in ${board.headline.dueIn}, in house ${board.headline.inHouse}, due out ${board.headline.dueOut}. Cashier exceptions ${board.headline.cashierExceptions}; room attention ${board.headline.roomsNeedingAttention}.</p>
        <div class="chips"><span class="chip">cashier read allowed</span><span class="chip warn">governed posting/settlement</span></div>
      </article>
      <article class="block-card glass">
        <h3>Rooms</h3>
        <div class="block-metrics">
          <div class="metric"><b>${board.roomStatus.inspected}</b><span>inspected</span></div>
          <div class="metric"><b>${board.roomStatus.clean}</b><span>clean</span></div>
          <div class="metric"><b>${board.roomStatus.dirty}</b><span>dirty</span></div>
          <div class="metric"><b>${board.roomStatus.pickup}</b><span>pickup</span></div>
        </div>
      </article>
    </section>
    <section class="workflow-grid">${workflowCards}</section>
    <h2 class="section-title">Group block control</h2>
    <section class="block-strip">${blocks}</section>
    <p class="footnote">Overwatch endpoint: POST /api/v1/overwatch/message. Synthetic demo execution endpoint: POST /api/v1/demo/sandbox/actions/execute. State-changing PMS requests require the exact phrase CONFIRM YELLOW OPERATION; sandbox execution never writes occupancy, folio, journal, payment, document, statutory or outbox records.</p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMinor(value: number | null): string {
  if (value === null) return "—";
  return Math.round(value / 100).toLocaleString("en-IN");
}
