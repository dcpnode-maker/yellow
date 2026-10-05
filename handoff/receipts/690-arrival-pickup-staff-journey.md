# Order690 — arrival travel and linked pickup task staff journey

24 September 2026. Implementer: `ecosystem_journey_gaps`. Independent reviewer:
`order679_independent_review` (approved). Root owns release and public read-only
verification. This receipt records scoped source and synthetic proof; root will
append final public evidence. No live reservation or pickup-task mutation was
made for QA.

## Delivered

The reservation travel card now captures property-local arrival mode, carrier,
service, scheduled time and pickup intent through the existing compare-and-set
travel command. The UI rejects missing/ambiguous DST local times, preserves the
server's exact expected tuple and retains the same idempotency key/body when an
outcome is uncertain. A scheduled request without a linked task is explicitly
shown as pending asynchronous linkage, with manual refresh. A linked task loads
its own authoritative detail; the current eligible action supports staff Party
search and assignment, then start and completion with exact task-status and
assignee expectations. No transport booking, vehicle, charge, or new task CRUD
semantics are claimed. Parent reservation controls and navigation join the
pickup attempt lock.

## Executed source proof

- `bun test tests/order690-arrival-pickup.test.ts tests/order690-arrival-pickup-http.test.ts`:
  7 pass, 0 fail, 29 assertions. Covers property-local DST gap/fold rejection,
  exact travel/task command bodies, no-op and linked-task guards, microsecond
  readback equivalence, typed retained-attempt validation, definite denial/
  conflict versus uncertain server failure, exact same-key/body retry and the
  valid unscheduled pickup-intent state.
- Final `bun run typecheck`: backend and frontend pass. `bun run boundaries`:
  pass, 208 TypeScript files scanned. A temporary concurrent Order691 fixture
  TS6142 import failure was corrected before final combined verification.
- Synthetic loopback fixture `tests/fixtures/order690/server.ts` on
  `127.0.0.1:4175` serves built React assets and local in-memory commands only;
  unsupported API paths return 404 and no request is forwarded externally.
  Root mounted the real React UI and observed saved arrival travel, honest
  unlinked-pickup state, manual link/refresh, staff search, assign, start and
  complete (four fixture writes, final task `done`, lock released). Root also
  reported an unknown-result exact retry and the instant-link timing scenario
  passing after the task-read generation fix. Root also mounted synthetic 403
  denial and 409 conflict, each blocking a new save until authoritative refresh;
  the final build includes correction clearing stale confirmation after refresh.
  Fixture session `67310` was stopped after these checks.

## Boundaries and limits

The pickup worker was verified by root as configured on in the current live
container (`YELLOW_PICKUP_TASK_WORKER=1` and workbench enabled), but task creation
is asynchronous and UI never assumes it already happened. Browser proof above
is synthetic, not a live hotel write; the independent existing backend DB/HTTP
proof is recorded separately by reviewer. Public verification remains read-only.
No whole Guest Requests or ecosystem-complete claim follows from this slice.
The root reported a healthy same-URL app release with image
`d0b30b44ba85277f983a9e3357c366a12e2f5819f8a7dc769acf2796c7774b7e`;
Root then verified the public record L3R-DI-0015 shows the new panel, correct
Asia/Riyadh property timezone, explicit confirmation and disabled initial Save.
Actual 390x844 mobile screenshot: D:/Yellow/temp/order690-live-pickup-mobile.png;
document width375 within viewport390, form controls visible without page overflow.
No live travel or task write was made. Public fixture record remains unchanged.

## Final release proof

Same existing app image d0b30b44 above, static-only overlay on reviewed a42f0b25
(tag before-orders690-691 retained); no schema/backend/config change. Live pickup
worker flags remain enabled. Final combined 53pass/0fail/272 assertions plus one
complementary native-map-mode skip; types and208boundaries pass, installed source
licence120 and serving image47 pass. Independent real-PG proofs and referee11/11
are in review690. Existing brittle pre-687 source-string oracle remains documented.
Inherited /ready503 build_revision_unavailable remains, public /health200 and
Docker healthy; no full-CI/immutable-Git/production-readiness claim. Disposable
tmpfs yellow-order690-proof was verified exact and removed after reviewer finished;
its synthetic data is reproducible. Public DB/cache/tunnel were untouched.
