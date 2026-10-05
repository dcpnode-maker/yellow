# Order 520 — Yellow inline KPI intelligence review

## Verdict

**ACCEPT — deterministic KPI reads published.** This review covers the bounded
read-only Yellow KPI command surface. It is not acceptance of every PMS
workflow or of the complete AI action catalogue.

## Implemented

- Local intent routing for occupancy, rooms sold/room nights, ADR, RevPAR,
  available inventory and full operating performance.
- KPI intent resolves after a specific movement lane and before generic rate
  workspace language, avoiding model prose and rate-screen misrouting.
- Yellow renders Today, MTD, QTD and YTD actual/last-year/forecast/budget values
  from the existing property-scoped operating-performance response.
- Today KPI buttons execute immediately; no second submit is required.
- The full performance request adds room revenue and shows the existing
  scenario-data disclosure.
- On phones the comparison stays inside a bounded horizontal table with a
  visible swipe cue and sticky period context; the document itself does not
  overflow horizontally.

## Executed proof

- `bun test tests/yellow-voice-routing.test.ts tests/yellow-ambient-ai-mode.test.ts tests/operator-today-command-centre.integration.test.ts`
  — **37 passed, 0 failed, 320 assertions**.
- `bun run typecheck` — passed.
- `bunx vite build --config frontend/yellow/vite.config.ts` — passed; 469
  modules transformed.
- Published assets: `index-B8DNSh1E.js`, `index-BMb9V_0X.css`.
- Docker app-only recreation completed; app health became `healthy` and the
  public property route returned HTTP 200.
- Public browser command `Show occupancy` remained URL-stable and rendered
  Today/MTD/QTD/YTD values for actual, last year, forecast and budget.
- Public browser command `Show operating performance` remained URL-stable and
  rendered room nights, occupancy, room revenue, ADR and RevPAR for all four
  periods.
- Live 375×812 proof: inner/document width `375`, body width `359`, swipe cue
  visible and period cell computed `position: sticky`.

## Limits

- Forecast and budget values are the existing scenario projections, explicitly
  labelled as such. Client plan imports remain future work.
- This order adds no KPI calculation, revenue feed, write action or Gemini call.
- The public quick tunnel remains temporary and laptop-dependent.
