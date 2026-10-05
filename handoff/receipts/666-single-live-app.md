# Order 666 - Single live app restoration

Date: 2026-09-23. Implementer: Codex. Independent scoped reviewer:
`/root/journey_service_research` (GPT-6 Luna). No local-model execution claimed.

## One running review app

- URL: https://lying-jones-terminal-church.trycloudflare.com/
- Review source: `D:/Yellow/git-live-order611-source-v2`, branch
  `codex/live-order611-source-v2`, base HEAD `e06e400a`, with preserved dirty work.
- Application: `yellow-public-demo-app-1`, loopback port 3010, healthy.
- Existing tunnel retained; it is a temporary Cloudflare quick tunnel, NOT a
  permanent hostname or a production-availability guarantee.
- Data is the existing synthetic Locanda Homes / Jareed Riyadh review property.
  No production-readiness or real-hotel-data claim.
- Stopped, not removed: old `yellow-app-1` (3000), verified Vite PID 12304
  (3015, order610 tree), and old Localtunnel PID 16704 (target 3000).
  Final listener inspection showed only 3010 among those three ports. Old loca.lt
  is no longer the review link. No code, database, container or volume deleted.
- Existing live and development/test databases/Valkey retained. One app does not
  mean one container: the app still needs its datastore and tunnel.

## Repairs

1. Import the existing `loadCommercialContribution` API function into App.tsx;
   its undefined live reference caused a blank screen despite HTTP 200.
2. Use the existing `setAssistant(true)` setter for Today assistant launch.
3. Narrow optional statement data before constructing reservation timeline rows.
4. Remove the timeline `useMemo` after loading/error early returns, which caused
   React error 310 when reservation details completed loading. Use direct derived
   computation, not a new state/effect synchronization layer.
5. Include the frontend TypeScript project in the normal typecheck command.
6. Add the focused hook-order regression test and correct an existing test that
   required the nonexistent assistant setter.

No business-rule, backend, schema, tenant policy, billing or occupancy changes.
Before recreation, all 252 backend source files were byte-compared with the
running container and matched. No data seeding or guest/payment writes performed.

## Verification

- Red: frontend compiler reproduced three errors; browser reproduced undefined
  import at startup and React 310 on reservation loading.
- Regression red: hook-order test detected the conditional `useMemo`.
- Green: `bun run typecheck` (root and frontend).
- Green: five-file focused test run, 13 pass / 0 fail / 109 assertions:
  order666-reservation-render-safety, order611-operational-timeline,
  order611-today-glass-dashboard, order620-today-colleague-demo-path,
  order623-group-block-workbench.
- Green: `bunx vite build --config frontend/yellow/vite.config.ts`.
- Green: scoped `git diff --check`.
- Independent reviewer personally reran typecheck and all five test files after
  inspecting the hook and test changes: same passing results; no findings.
- Browser: Codex in-app browser via CUA, default viewport approximately 893x683.
  No separate browser installation or external Playwright fallback.
- Actual interaction: Today -> Board & stay detail -> filter L3R-FU-0024 ->
  Aisha Kareem reservation -> named guest -> linked profile and stay history.
  Final detail reload renders booking fields, guests/shares, stay segments,
  timeline, folio section and arrival-readiness controls without the prior crash.
- Today Overwatch card opens its dock without the undefined-setter error.
- URL/title, meaningful DOM, absence of framework overlay and final screenshots
  verified. No fresh console errors/warnings captured after final deployment.
- Screenshot emitted in the conversation; browser left open at Today. The demo
  pathway is horizontally scrollable at this viewport. Not a full UI acceptance.

## Deployment provenance and limits

Running image: `sha256:207d259463af7e3cba802871ec633f35931136eb2893e04874be5e4301279190`.
Built image config: `af3e70441480c03fedd2be287df983b012708bf17ecbd7786b65347a70c9e3a4`.
Static entry: `index-BoEtz2tu.js`; reservation chunk:
`ReservationWorkspace-A1saxbMJ.js`.
Index HTML SHA256: `3EB1564F2F3ECD4E7B4722605D49BE22098954062D147F16FAC862DD1718A854`.

An initial build used an invalid non-SHA build label and the existing server guard
correctly refused startup, briefly causing 502. Rebuilt with the supported empty
build-SHA setting; the guard was NOT weakened. The working tree is dirty, so the
release is honestly unknown-revision rather than falsely labelled as clean HEAD.
Pre-change image retained as `yellow-public-demo-app:before-order666`; it preserves
prior state but is NOT claimed to be a known-working rollback (it had the startup bug).
No commit, push, PR or merge; pre-existing unrelated dirty changes remain intact.

## Not done: concrete follow-up paths

1. **Arrival recovery remains blocked.** L3R-FU-0024 renders a booked stay, but
   readiness reports active-segment missing, room assignment missing and primary
   folio missing. Resolve with Yellow opens the named guided flow, then its room
   candidate request displays `Current eligible rooms are unavailable`. This is
   not a successful check-in and not something the founder should debug. Next:
   trace the candidate response and temporal segment eligibility; preserve the
   backend error reason in UI and provide the appropriate repair/retry control.
   Any eligibility/state-transition change needs a separate scoped order and
   independent reviewer-executed proof. Do not bypass readiness gates.
   Independent source diagnosis: both check-in and candidate selection require
   a unique booked segment whose period contains database transaction time.
   The candidate client discards every non-2xx response's details, replacing it
   with the same generic text. A not-yet-active segment is a plausible cause,
   not proven from displayed local time; compare exact stored bounds/offset and
   DB clock, then status/body and availability/mapping constraints. Do not change
   the guest's stay dates merely to silence a gate. Early-arrival handling must
   follow the approved business policy and use an explicit governed operation.
2. **Universal search is not restored.** This exact source's capability registry
   marks it preview, `existing: false`; reservation/guest/cashier scoped searches
   exist. Next: locate the previously implemented search in other history before
   rebuilding it; verify tenant/per-result access, integrate one shared entry
   point, and prove links to the actual records. Do not rename guest search and
   call it universal search.
3. **Metric copy needs correction.** Today shows 14 sold, 70% occupancy and
   `Available 20 rooms left`. The bound `roomsAvailable` value appears to be the
   occupancy denominator/capacity, not unsold rooms. Trace and prove the measure;
   label sellable capacity separately from rooms remaining. Not fixed here.
4. **Durable review address remains open.** Reuse this one service; replace the
   quick tunnel with an authenticated named tunnel/domain after resolving its
   account/domain requirement. Do not create a second app to solve the URL.
5. Writes, cashier posting, complete check-in/checkout, real hotel operation,
   mobile-browser matrix and all ecosystem modules were not accepted by this run.

Delivery boundary: one existing full frontend runs and its startup/navigation
crashes are repaired. This is not a claim that all modules or guest journeys are done.
