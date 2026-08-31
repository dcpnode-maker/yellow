# BUILD-PLAN.md — phased delivery for Claude Code

Rules of engagement: one phase at a time · a phase is DONE only when its DoD checks
pass in CI · every session starts with the ritual below · no phase may modify a prior
phase's public surface without a written note in `DECISIONS.log`.

## Session ritual (every Claude Code session)

1. Read `CLAUDE.md`, then this file's current phase section only.
2. `git log --oneline -10` + read `DECISIONS.log` tail — know what changed.
3. State the session goal in one sentence. If it spans phases, stop and re-scope.
4. Work. Tests alongside code, not after.
5. End: update `DECISIONS.log` if anything was decided; leave the tree green.

## Phase 0 — Bootstrap (repo that proves the loop)

Scaffold: Bun + Elysia + TypeScript strict; `src/contexts/<ctx>/index.ts` layout;
raw-SQL Bun migration runner (forward-only, numbered); Docker Compose with pinned
PostgreSQL 16 + Valkey (NATS deferred by D-14 until the first out-of-process consumer
or second app node); CI = typecheck + test + fresh-DB migrate + canonical RLS referee;
apply immutable `migrations/0001_init.sql` (80 baseline tables) only through the
runner, which adds `schema_migration` (81 public tables); seed deterministic
`yellow-demo` tenant + property separately from the two-tenant invariant fixture.
**DoD**: `bun test` green in CI · fresh clone → `docker compose up` → migrate → seed →
health endpoint 200 · RLS smoke test proves cross-tenant read = 0 rows **on tables AND
through views** (views bypass RLS without security_invoker — proven leak class) ·
schema-drift check (normalized dump vs `tests/schema/expected.sql`) empty.
**Free wins to wire in at this phase (all zero-dependency):** Bun-native everywhere —
`Bun.sql` as the exercised Postgres driver. `Bun.password` (argon2id), Bun's built-in
WebSocket/SSE, and `Bun.S3Client` remain mandatory zero-dependency choices and gain
executable coverage with their first real consumers · `pg_stat_statements` in
Postgres Compose config from day one ·
commit `.claude/` into the repo (CLAUDE.md, hooks: format+typecheck PostToolUse,
postgres+github MCP config) so both founders share one Claude Code setup ·
`license-check` CI gate (permissive-only allowlist, see DEPENDENCIES.md) + CSP test
asserting zero third-party origins. Forgejo mirroring is pre-deployment founder work;
Cloudflare Tunnel waits for OCI hosts (D-68). Neither blocks repository Phase 0.

## Phase 1 — Kernel (tenancy, extension registry, outbox, fact_log)

Tenant/org/app_user/role auth (JWT w/ tenant + scopes); `set_config` tx-local tenant
context middleware; extension_type + extension CRUD with JSON-Schema validation
(load EXTENSIONS.md schemas + launch instances as seed); outbox relay worker
(poll 100–250 ms → NATS JetStream, at-least-once, `published_at` update); fact_log
write helper; approval_request primitive; audit envelope on every mutation.
**DoD**: register a new extension_type at runtime via API and store a validated
instance · kill relay mid-batch, restart, no event lost or duplicated (dedupe on id) ·
org ltree queries (property under brand under chain) correct.
**Decision gate (DECISIONS.log) — defer NATS?** In a modular monolith every EVENTS.md
consumer is in-process; they can read the outbox directly by `seq` with a per-consumer
cursor row (the pattern §9 push_cursor already uses) instead of looping through an
external broker. Default: start PG-outbox-bus behind one `EventBus` interface;
introduce NATS JetStream when the first out-of-process consumer or second app node
appears. Subjects in EVENTS.md map 1:1 either way, so the swap is a config change —
and day-one compose drops another stateful service. Also consider `pg_cron` for the
pure-SQL jobs (expire_holds, prune_outbox) so their timing can't die with an app worker.

## Phase 2 — Inventory & Occupancy (the choke point goes live)

Space/unit_type/sellable_unit CRUD honouring vertical_profile defaults; port the
prototype: `record_occupancy`/`release_occupancy` as the ONLY write path (REVOKE
verified by test); holds with TTL + `expire_holds` worker; offline lease pool;
restrictions, OOO/OOS, overbooking_limit; availability_projection rebuilder consuming
occupancy events; Valkey cache + invalidator.
**DoD**: prototype tests T1–T5 re-pass as integration tests in TypeScript ·
projection rebuilt from zero matches truth · availability:search p99 < 50 ms on
seeded 500-space dataset · direct INSERT to space_occupancy fails 42501.
**Decision gate (DECISIONS.log)**: run the p99 benchmark against BOTH Valkey and
NATS JetStream KV as the projection cache. If NATS KV meets the 50 ms budget,
drop the Valkey container (one less service); if not, Valkey stays. Cache access
goes behind one interface either way, so the loser is a config change.

## Phase 3 — Rates & Policies

rate_plan (+derivation), rate_price insert-only bitemporal writes + `current_rate_price`
reads; packages/elements with allowance math; promotions; negotiated_rate resolution
order (negotiated > promo > derived > base); policy engine evaluating EXTENSIONS §3
shapes at quote time.
**DoD**: derived plan follows parent change · "price as of last Tuesday as known then"
bitemporal query returns the historically correct number · policy penalties compute
correctly across timezones (property-local cutoffs).

## Phase 4 — Reservations (search → hold → commit honest end-to-end)

availability:search/hold/commit per CONTRACTS §2 with Idempotency-Key store;
reservation lifecycle per STATE-MACHINES (create/modify diff/cancel/reinstate/
move = new segment); reservation_guest incl. share_pct; alerts, waitlist w/ offer
window; every transition emits its event.
**DoD**: two racing commits on last unit → exactly one 201, one 409
conflict/occupancy · modify dates re-arbitrates through the choke · state-machine
table in code equals STATE-MACHINES.md (generated test).

## Phase 5 — Financials (the ledger)

account/folio(window)/tx_code(usali_line) ; postCharge/transfer/adjust(reversal)/
settle; journal + posting_line with deferred balance trigger; business_day +
seal_business_day + assert_day_open; cashier_session; payment state machine w/
token-only instruments; deposit schedules via automation; trust role behaviour;
folio statement + `folio_balance`.
**DoD**: unbalanced journal rejected AT COMMIT · posting to sealed day rejected ·
1,000-posting concurrency run: trial balance = 0 drift · adjustment creates reversal
journal, original untouched · trust account negative-guard requires approval.

Order 192 adds the payment foundation within this phase: immutable token-only
operations, append-only attempts/receipts, journal-free auth/increment/void, exactly
one locked balance-capped capture, bounded linked partial refunds and deterministic
local reconciliation. Order 193 adds the zero-cost hosted deposit workbench: expiring
hash-only guest links, a separately originated synthetic provider with signed bounded
callbacks, deposit-liability capture and separately authorized capped partial/full
folio application. Built-unreviewed Order 196 adds the governed per-window lifecycle:
`open -> settled -> closed` is available only through the exact tenant/property
PostgreSQL capability after shared financial locks and an exact-zero canonical balance,
with durable idempotency and same-transaction fact/outbox evidence. It creates no
journal and does not close the account or reservation. Real PSPs, delivery, deposit
refunds/chargebacks, provider settlement, checkout, account closure,
invoice/fiscal issue, trust safeguards and audited business-day close remain work in
this active phase; Phase 5 is not complete. Built-unreviewed Order 197 adds governed property
cash drawers, blind immutable denomination counts and approval-bound over/short close;
it creates no cash posting, balancing journal or business-day seal authority.
Built-unreviewed Order 198 adds the missing direct-billing path: one locked positive guest-folio
balance may move to one party-specific company/travel-agent receivable under derived
credit authority, leaving the folio at zero for existing settlement. It is not a full
AR ledger, invoice, allocation, aging, checkout or accounting-provider integration.
Built-unreviewed Order 199 executes the Order 114 Phase-5 composition gate on pristine
PostgreSQL: charge-to-payment and charge-to-receivable paths both reach exact zero,
settle and close, while over-limit four-eyes, hostile runtime/property authority and
capture/transfer/settlement arbitration remain coherent. It adds no product authority.
Independent review remains deferred under the founder's build-first direction; this
does not yet claim checkout, external provider settlement, Phase-5 approval or app
completion.

## Phase 6 — Stay ops & Housekeeping

check_in (statutory field gate) / check_out (settlement) flows; travel_detail capture
+ pickup automation (ETA → transfer task); vehicle register + plate search + parking
slot assignment (parking spaces go through the normal occupancy choke point); unit_condition
lifecycle; task_sheets generation per housekeeping_cadence; discrepancy (skip/sleep);
queue_entry; message primitive + send_message action.
**DoD**: checkout with open balance blocks with actionable error · HK task sheet
matches occupancy + cadence config · discrepancy report correct on seeded divergence.

Order 200 is built-unreviewed as the first Phase-6 product slice. It adds server-owned due-in
readiness and the exact atomic `due_in -> in_house` reservation/current-segment
transition. Assigned physical room, open primary folio, clean/inspected condition and
configuration-selected recorded identity evidence are prerequisites; dirty/pickup
requires distinct same-property authority and a reason. Deterministic review seed rows
cover ready and dirty arrivals on the canonical review property plus an identity-gated
arrival on a deterministic sibling property whose config selects the synthetic review
adapter; the canonical property's config remains unchanged. The fixtures perform no
check-in, occupancy or ledger effects. This built slice does not implement checkout, key issue,
housekeeping workflows, statutory submission, or complete/review/approve Phase 6.

Order 201 is built-unreviewed as the bounded housekeeping lifecycle slice. It consumes only existing
housekeeping/space tasks and the canonical `assigned -> in_progress -> done ->
verified` lifecycle: start preserves condition, completion moves dirty/pickup to
clean, and independently authorized verification moves clean to inspected. Exact
read/work/inspect scopes, stale task/condition/time guards, same-transaction minimized
evidence and deterministic assigned-dirty/done-clean review fixtures are executable.
It adds no task creation/assignment/cancellation, sheets, cadence, credits,
discrepancies, occupancy, reservation, financial, day or statutory behavior and does
not complete Phase 6.

Order 202 is a built-unreviewed bounded task-sheet generation slice. It resolves exact
tenant-over-global `vertical_profile` truth per active physical room and admits only
recorded daily in-house plus exact property-local on-departure cadence. One selected
active staff Party receives one deterministic sheet and one assigned housekeeping
task per distinct eligible occupied room; creation and minimized evidence are atomic.
Weekly/custom/missing/mixed/ambiguous cadence fails closed. The deterministic review
fixture adds one fixed-date in-house occupied pickup room and exposes Avery
Housekeeping without pre-generating a sheet/task. This slice adds no lifecycle or
condition transition, credit balancing, auto-scheduling, reservation/occupancy
mutation, financial/day/statutory effect, discrepancy or checkout, and does not
complete Phase 6.

Order 203 is a built-unreviewed read-only departure-readiness slice. One tenant transaction
and one PostgreSQL snapshot derive fixed blockers from reservation state, the unique
current in-house segment, its active physical room, matching exclusive occupancy and
every reservation folio window's canonical status/balance. The operator receives an
actionable Departure workbench under `stay-operations.checkout:read`, but no checkout,
settlement, occupancy trim or other mutation is admitted. The later checkout command
must lock and revalidate the same truth.

Order 204 is a built-unreviewed governed checkout slice. One actor-bound transaction
locks and revalidates the Order203 reservation, segment, room, occupancy and all-window
financial-readiness truth, releases only the exact segment occupancy through the
sanctioned inventory service, trims without lengthening and departs that segment, and
transitions `in_house`/`due_out` to `checked_out` with replayable fact/outbox evidence.
The operator receives a deliberate confirmed checkout action and deterministic ready
fixture. Checkout performs no financial repair, room-condition change or housekeeping
task creation and does not complete, independently approve or locally promote Phase 6.

Order 205 is a built-unreviewed read-only Vehicle Register slice. One tenant transaction
returns a minimized exact-property page ordered by `(reg_no,id)` with canonical keyset
pagination, plus optional case-sensitive literal registration lookup. Linked reservation
and Party associations are re-proven before disclosure, and any inconsistency fails the
whole read closed. The human register supports deliberate search, paging and retry across
all current appearances; its deterministic seed adds two distinguishable rows without
notes, parking, inferred onsite state or lifecycle effects. This slice adds no vehicle
write, occupancy, event or migration and does not complete, independently approve or
locally promote Phase 6.

Order 206 is a built-unreviewed read-only arrival-travel visibility slice. Existing
reservation-board rows and Today due-in cards now show only recorded arrival mode,
carrier, service number, schedule, pickup-requested truth and whether the recorded
pickup-task link resolves inside the same tenant and exact property. The existing
route, read permission, filters, `(created_at,id)` ordering and cursor remain unchanged;
hostile task associations fail the complete read closed. Deterministic clean and dirty
due-in fixtures add arrival rows without notes, ids, Party/contact data, task or any
other effect. This slice adds no travel write, pickup automation, migration, event or
authority and does not complete, independently approve or locally promote Phase 6.

Order 207 is a built-unreviewed read-only departure-travel visibility slice. Existing
reservation-board rows and Today due-out cards now show only recorded departure mode,
carrier, service number and scheduled instant. Arrival remains separately visible on
the board and only in Today due-in; neither association changes the existing route,
read permission, filters, `(created_at,id)` ordering or cursor. The deterministic
checkout-ready due-out fixture adds exactly one departure row without notes, pickup
task, pickup/drop-off interpretation or any operational effect. This slice adds no
travel write, transfer automation, task, migration, event or authority and does not
complete, independently approve or locally promote Phase 6.

Order 208 is a built-unreviewed read-only Room conditions slice. The existing Housekeeping
workbench exposes canonical active physical-room `unit_condition` truth through a
tenant/property-scoped, filter-bound keyset page under existing housekeeping read
authority. It returns only room identity, floor, literal condition and update instant,
with no task, assignee, updater, occupancy, reservation, guest, readiness, OOO/OOS,
source, reason or inferred status. This slice adds no write, migration, event, fact,
authority or local promotion and cannot complete Phase 6.

Order 209 is built-unreviewed as a UI-only Today operational-routing slice. Exact due-in and
due-out card status/lane pairs deep-link to the existing check-in and checkout
readiness workbenches with strict refresh/history/focus behavior. In-house and
mismatched rows receive no action; readiness and explicit confirmation remain
server-governed. This adds no API, domain authority, product mutation or local
promotion and cannot complete Phase 6.

Order 210 is built-unreviewed as a UI-only reservation-detail stay-change integration. The
existing governed segment history, departure-change and room-move controls become
reachable from the exact current reservation without copied identifiers. Server
action flags, occupancy arbitration, idempotency and endpoints remain unchanged;
stale drawer requests fail closed. This cannot complete Phase 6.

Order 211 is built-unreviewed as a UI-only reservation-detail guest-allocation integration.
The existing audited guest editor becomes reachable from the exact current
reservation without copied identifiers. Server-owned primary identity, explicit
share semantics, existing PUT/idempotency/fact/event behavior and detached lookup
containment remain unchanged. This cannot complete Phase 6.

Order 212 is built-unreviewed as governed per-direction reservation travel capture. It adds one
owner-mediated CAS create/replace capability while raw runtime travel DML remains
denied, records only adopted arrival/departure travel fields, blocks changes to rows
already linked to pickup work, and reuses reservation.modified evidence. Canonical
reservation detail hosts the editor. Pickup automation, delete, notes, vehicle,
parking, occupancy, financial and statutory effects remain outside this slice.

Order 213 is built-unreviewed as the create-only arrival pickup automation slice. A durable
`reservation.modified` consumer re-reads current arrival truth and atomically creates
and links exactly one existing-kind transport guest-request task only for scheduled,
pickup-requested, unlinked `reserved|due_in` stays. Consumer marker and `task.created`
evidence commit with the task/link. Assignment, cancellation, post-link travel edits,
manual UI, vehicle/parking, occupancy, finance and statutory effects remain outside
this slice. This cannot complete Phase 6.

Order 214 is built-unreviewed and owns only read-only arrival pickup state on canonical reservation detail.
It renders authoritative not-requested, schedule-required, scheduled-unlinked or
linked presence without exposing task identity/lifecycle or adding an action, route,
query, poll or mutation. This cannot complete Phase 6.

Order 215 is built-unreviewed and owns one reservation-scoped read-only pickup-task detail endpoint and
nested human route. It proves the exact current arrival link and canonical transport
task shape, returns minimized task state, and adds no generic task authority,
lifecycle action or polling. This cannot complete Phase 6.

Order 216 is built-unreviewed and owns one exact read-only Vehicle Register detail endpoint and nested human
route. It reuses the Order205 minimized row truth, re-proves linked reservation and
Party associations, and adds no vehicle write, parking/occupancy inference or action,
polling, scope, migration or event. This cannot complete Phase 6.

Order 217 is built-unreviewed and owns one exact read-only housekeeping-task detail endpoint and nested human
route. It admits only the existing board's housekeeping/space/active-room and
assigned/in-progress/done truth, exposes no notes/payload/assignee identity or inferred
operational meaning, and adds no task mutation, scope, migration or event. This cannot
complete Phase 6.

Order 218 is built-unreviewed and composes the exact Order216 vehicle detail with the existing canonical
reservation-detail route. Only a validated non-null reservation association receives
one stale-safe read-only navigation action; no API, authority, mutation, parking
inference, polling, schema or event is added. This cannot complete Phase 6.

Order 219 is built-unreviewed and composes canonical reservation detail with the existing governed check-in
or checkout preparation route according only to current authoritative status. The
action opens readiness and explicit confirmation; it runs no command and adds no API,
authority, status meaning, mutation, schema or event. This cannot complete Phase 6.

Order 220 is built-unreviewed and composes exact housekeeping-task detail with the existing governed Order201
transition. It adds only zero-or-one server-authorized action presentation and reuses
the existing command/idempotency/revalidation path. This cannot complete Phase 6.

Order 221 is built-unreviewed and composes the exact existing housekeeping-sheet generation receipt with the
already-governed task-detail journey. It adds only transient validated task links and
no server authority, mutation, persistent sheet-history claim, schema or event. This
cannot complete Phase 6.

Order 222 is built-unreviewed and repairs the existing departure-readiness to Folio-controls round trip. It
adds only a minimized validated history return descriptor and authoritative refetch/
focus restoration; it changes no financial or checkout authority. This cannot complete Phase 6.

Order 223 is built-unreviewed and extends the existing Today pure routing table so exact in-house rows may
open the already-governed checkout-preparation workbench. It adds no command,
authority, readiness meaning or new control family. This cannot complete Phase 6.

Order 224 is built-unreviewed and repairs the existing reservation-detail to Folio-controls round trip for
both existing and successfully resolved primary Folios. It adds only minimized
history return context and no financial command or authority. This cannot complete Phase 6.

Order 225 is built-unreviewed and composes exact current Vehicle Register row truth with the existing canonical
reservation-detail journey. It adds only minimized history return context and no new
request, vehicle/reservation mutation, parking or occupancy authority. This cannot complete Phase 6.

Order 226 is built-unreviewed and composes exact current room-owned check-in readiness blockers with the
existing Housekeeping condition board. It adds only minimized history return context,
authoritative condition/reservation/readiness refetch and exact-or-safe focus; it adds
no request, command, task/occupancy inference, schema or event. This cannot complete Phase 6.

Order 227 is built-unreviewed as the governed absence-only initial room-condition ingress. An
exact missing-room candidate read and one actor-bound idempotent owner-mediated insert
record canonical condition truth plus same-transaction `unit.condition_changed`
evidence. It cannot overwrite an existing condition, initialize `inspected`, or
change task, reservation, check-in, occupancy or financial truth.

Order 228 is built-unreviewed as the governed exact arrival pickup-task dispatch lifecycle. Only
the currently linked canonical task may advance open to assigned active staff, then
in progress and done through actor-bound idempotent CAS and one same-transaction
`task.status_changed` fact/outbox per change. Generic task CRUD, reassignment,
cancellation, travel/vehicle/parking/occupancy/financial effects and inferred
transport outcome remain outside this slice.

Order 229 is built-unreviewed as the bounded dirty/pickup-room arrival-to-cleaning-task slice. One
authorized operator may select an active property attendant and create at most one
assigned housekeeping task for the exact dirty/pickup assigned room, with atomic
`task.created` evidence and existing-task duplicate containment. It changes no room
condition, reservation, occupancy, check-in or financial truth. Admission uses the
current executable `dirty_room_override_unauthorized` blocker, not the reserved
`room_not_ready` literal, and actors already granted the exact property-scoped dirty-room
override are concealed by both the candidate read and owner capability.

Order 230 is built-unreviewed as the UI-only continuation from that exact cleaning task
back to canonical check-in preparation. Context survives existing governed task work,
but only one deliberate return refetches reservation and readiness truth; the browser
neither infers readiness nor runs check-in. Generic Housekeeping navigation remains
unchanged. Focused `17/17`, adjacent continuity `36/36`, standing `695/0`, all static
gates and the fresh invariant referee `11/11` are green.

Order 231 is built-unreviewed as the exact due-in room-assignment bridge. A current
unassigned check-in blocker now gains one server-authoritative candidate read and one
deliberate actor-bound command that uses the PostgreSQL occupancy choke point and
commits exact assignment/evidence atomically before refetching check-in preparation.
Executable contention, rollback, authority, migration, seed, schema and standing
proofs are green. It is not room move, automatic allocation, readiness inference or
automatic check-in.

Order 232 is built-unreviewed as the canonical property-local arrival roll. Its
bounded opt-in server worker discovers only due tenant/property scopes through one
owner-mediated runtime capability, then uses PostgreSQL's transaction-stable
property-local calendar date and exact latest-segment truth to change only a coherent
`reserved` parent to `due_in`. The current segment remains byte-equivalent `booked`,
and one existing `reservation.due_in` fact/outbox/idempotency chain commits atomically.
A real direct commit now becomes visible through existing Today, reservation-detail
and check-in truth without a browser command or no-show, due-out, occupancy,
financial, identity or statutory behavior. Focused `14/14`, database authority,
exact schema, standing gates and fresh referee `11/11` are green; independent Tier-3
approval remains deferred.

Order 233 is built-unreviewed as the mirrored canonical property-local departure roll.
Its bounded opt-in worker uses PostgreSQL's transaction-stable property-local calendar
date and the latest current `in_house` segment's local upper bound to change only its
coherent `in_house` parent to `due_out`. The complete segment remains byte-equivalent,
and one existing `reservation.due_out` fact/outbox/idempotency chain commits atomically.
Existing Today, reservation-detail and checkout-readiness surfaces consume the result;
checkout, occupancy release, finance, day and product UI behavior remain unchanged.
Focused `14/14`, database authority, migration `33/33`, exact schema, standing gates
and fresh referee `11/11` are green; independent Tier-3 approval remains deferred.

Order 234 is built-unreviewed as UI-only checkout-to-Housekeeping continuity. One exact
current checkout success retains only its validated released-room identity through the
authoritative checked-out reservation-detail refresh and presents a deliberate Review
room in Housekeeping action. The existing Housekeeping condition board owns room truth;
the browser neither dirties the room, creates work, infers discrepancy nor reruns
checkout. Direct Housekeeping and every server/database authority remain unchanged.
Focused `13/13`, adjacent `104/104`, standing `741/0`, static/exact-schema gates and a
fresh referee `11/11` are green; independent product review remains deferred.

Order 235 is built-unreviewed as the governed room-discrepancy slice. One authorized
deliberate room observation is compared in PostgreSQL with coherent current segment
and exact exclusive occupancy truth, producing only sleep, skip or person discrepancy
evidence; matching truth produces nothing. It reuses the existing discrepancy
primitive and event, keeps raw DML denied, permits one unresolved row per room, and
explicitly defers resolution, queue/message linkage, shared/positional semantics and
all source condition/task/reservation/occupancy/financial mutation.
Focused `29/29`, adjacent `150/150`, standing `761/0`, fresh database authority and
review-seed proof, exact schema, static gates and fresh referee `11/11` are green;
independent Tier-3 approval remains deferred under the founder's build-first direction.

Order 236 is built-unreviewed as governed create-only vehicle parking assignment. One
exact onsite reservation-linked vehicle may receive one active capacity-one
`profile_key='parking'` space through an owner-private, vehicle-validating overload of
the canonical occupancy choke point, with PostgreSQL deriving the current segment and
bounded period. Canonical checkout release now clears both parking occupancy and the
vehicle pointer atomically; replacement, manual release, staff/visitor parking,
entry/exit and history remain deferred. Focused `23/23`, adjacent `80/80`, standing
`771/771`, migration/acceptance/runtime-authority/review-seed proof, exact schema,
static gates and a fresh 93-table referee `11/11` are green. Independent Tier-3
approval remains deferred under the founder's build-first direction.

## Phase 7 — Tax engine + India IRP

Order 237 is built-unreviewed under D-625 as the positive pure rules-driven
tax-evaluation foundation.
It validates the adopted jurisdiction contract, converts configuration rates to
integer basis points, evaluates signed-safe `bigint` minor-unit inputs across the four
existing modes, and makes inclusive/exclusive, line/document rounding, India per-night
slabs and explicit acyclic compounding executable. It adds no database, HTTP, UI,
posting, document, provider or event authority and may close only built-unreviewed.
Credit-note rounding, progressive slabs, person-category derivation, rate-plan
inclusion precedence, line allocation and India invoice decomposition remain explicit
later policy/authority work.

Exact inclusive bigint arithmetic, ordered mixed-night attribution, visible
line-rounded compounding, fail-closed document compounding without allocation and
bounded hostile work are executable. Focused `17/17`, adjacent `24/24` plus 18
database skips, standing `788/788` plus 704 environment skips and all required static
gates are green. Independent tax review remains deferred by the founder's build-first
direction.

Order238 is built-unreviewed under D-627 as the read-only authority slice. It binds
one exact active-tenant property/business-date assignment to exactly one active visible
`tax_jurisdiction` extension id/version/content hash through existing PostgreSQL and
runtime-extension authority. Missing/overlapping assignments and missing/ambiguous
versions fail closed. No precedence, migration, mutation, quote, posting, document,
provider, HTTP or UI behavior is admitted.

The real-database focused proof passes `13/13`, adjacent extension/rate/tax proof
passes `17/17` plus 12 expected database skips, and the standing suite passes
`797/797` plus 708 environment skips. Typecheck, 89 import boundaries, 23 dependency
licences, zero-vulnerability audit, JavaScript syntax and diff hygiene are green.

Order239 is ready under D-628. It composes effective nightly resolution and the pure
evaluator into one exact room-only quote tax preview, binds the frozen evidence before
quote hashing and exposes it through existing offer JSON. It refuses partial/mixed
jurisdiction, unsupported package/promotion allocation, over-366-night calculation
and rate-plan/display disagreement. No price mutation, folio/posting/document/fiscal
authority, migration or new endpoint is admitted.

Order239 is built-unreviewed under D-629. Its focused contract passes `7/7` with 33
assertions, fresh isolated PostgreSQL quote proof passes `8/8` with 49 assertions and
exact zero-write truth, and the standing suite passes `808/808` plus 708 environment
skips. Typecheck, 89 import boundaries, 23 dependency licences, zero-vulnerability
audit, JavaScript syntax and diff hygiene are green. The disposable proof database was
removed and no schema or local application was changed. Independent review remains
deferred; folio attribution, posting, document and fiscal authority remain later.

Order240 is ready under D-630. It creates the missing pure canonical positive-origin
tax-attribution snapshot: exact Order239 quote/night/jurisdiction/evaluator evidence
becomes deeply frozen JSON-safe decimal-string truth with strict reconciliation and a
deterministic snapshot hash. It adds no persistence, reservation, posting, folio,
correction, transfer, document, HTTP, UI or local-app authority. Independent review
remains deferred under the founder's build-first direction.

Order240 is built-unreviewed under D-631. Its pure builder/parser accepts only one
fully reconciled positive `rate_quote` origin, emits canonical decimal-string JSON,
binds exact nightly assignment/jurisdiction/evaluator lineage with a deterministic
SHA-256 and returns recursively frozen truth. Hostile shape, identity, ordering,
duplicate, magnitude and monetary reconciliation failures reject atomically. Focused
proof passes `12/12` with 131 assertions, combined adjacent tax/quote proof passes
`50/50` plus 11 expected database skips with 260 assertions, and the standing suite
passes `820/820` plus 708 environment skips with 8,356 assertions across 1,528
tests/276 files. Typecheck, 90 import boundaries, 23 dependency licences,
zero-vulnerability audit, JavaScript syntax and diff hygiene are green. Schema,
database and local runtime behavior are unchanged; persistence, posting, documents
and fiscal finality remain later slices.

Order244 is built-unreviewed under D-640 as the first governed persistence boundary.
One exact positive Order240 snapshot can be stored as append-only tenant/property
truth with actor binding, same-hash convergence, tenant-scoped read and one minimized
atomic `tax.attribution_recorded` fact/outbox pair. Focused real PostgreSQL proof is
`6/6` with 49 assertions; standing proof is `822/822` plus 717 expected database
skips. No hold, reservation, folio, journal, posting, document or fiscal state changes.

Order245 is built-unreviewed under D-639. Forward migration0039 repairs only the two
inherited Order236 occupancy SECURITY DEFINER search paths to explicit `pg_temp` last;
function bodies, signatures, owners, ACLs and product behavior remain unchanged. The
complete fresh migration suite is `36/36` with 160 assertions, database acceptance is
`8/8` with 18 assertions and the 94-table/84-policy referee is `11/11`. Typecheck,
91 boundaries, 23 licences, zero-vulnerability audit, four JavaScript syntax checks
and diff hygiene are green. Independent review remains deferred.

Order248 is built-unreviewed under D-646. It introduces one internal authoritative booking-edge
command: acquire the exact release-publication lock, freshly resolve the complete
server quote, require live bookability plus quoted/calculated-tax evidence, derive the
canonical Order240 snapshot, place the existing cart hold, persist through Order244
and append one tenant/property binding with minimized atomic
`tax.attribution_bound` evidence. The binding is retained after hold expiry/release
but is not a reservation, price promise, posting, document or fiscal submission. No
caller price/hash/snapshot/tax authority, HTTP, UI or local promotion is admitted.
Focused P0-P6 proof is 8/8 with 55 assertions; fresh PostgreSQL reaches migration40,
95 tables and 85 policies with referee11/11. Standing proof is 824/824 with 727
expected environment skips, typecheck/92-boundaries/licence/audit/diff green.
Independent Tier-3 product review remains deferred under the founder's build-first
direction.

Order249 is built-unreviewed under D-648 as a status-only refresh through built Order248/current
Order249 truth. It advances only the recorded founder snapshot and compact Phase7
builder milestone while preserving independent review through Order91 and keeping
unfinished Phases5-7 active. Focused status proof is 5/5 and the 824-test standing
suite is green. Exact local promotion remains separate.

Order251 is built-unreviewed under D-652 as the first pure account-agnostic posting topology.
It reparses exact Order240 truth, proves D-323 signed bigint balance across guest,
revenue and ordered tax sides, and blocks document-rounding allocation and India GST
decomposition rather than inventing legal policy. It has no account routing or write
authority.
Focused proof is 8/8, adjacent tax proof is 31/31 and the 832-test standing suite plus
fresh referee11/11 are green. Independent Tier-3 product review remains deferred.

Order244 is ready under D-637 as the append-only persistence foundation. It gives one
exact parsed Order240 positive quote snapshot a tenant/property-scoped PostgreSQL
root, same-hash convergence, tenant-isolated read, idempotent receipt and one atomic
minimized `tax.attribution_recorded` fact/outbox pair. Contextual property and actor
binding does not establish quote ownership or booking acceptance. No hold,
reservation, folio, journal, posting, tax detail, document, series, submission, tax
payable routing, correction allocation, India decomposition, HTTP, UI or local
runtime authority is admitted; Order244 can close only built-unreviewed pending its
required independent executable fiscal review.

Order252 is independently approved under D-656 as the exact hold-consumption lineage
prerequisite for positive tax posting. A quoted-tax binding may become linked to one exact reservation
and first segment only inside the existing successful held-reservation transaction;
unquoted/direct commits remain unchanged. The edge chooses no folio, account, tx code
or route and grants no posting, document, India-policy or fiscal authority.

Order253/D-657 is the bounded founder-visible status refresh through approved
Order252. It changes recorded status truth only; the sole local remains a separate
promotion concern and unfinished Phases5–7 remain active.

Order254/D-661 independently approves repository reconciliation to the exact historical migration0041 bytes
already applied by an Order252 proof setup incident and carries the final no-binding
compatibility correction forward in migration0042. Direct local app promotion remains
separate and requires its own protected backup and verification order.

Order256/D-666 independently approves the exact positive-tax primary-folio eligibility prerequisite.
It resolves one immutable Order252 reservation lineage to its canonical open primary
folio and coherent open guest account, acquires the existing bounded financial locks,
then re-reads and revalidates the full graph before returning frozen evidence. It is
strictly read/lock-only: no account routing, financial write, posting, tax detail,
document or India-policy authority is admitted. The reviewer personally reproduced
focused, database-acceptance, referee and static proof with no product finding. The
next bounded dependency is configured semantic transaction routing.

Order257/D-668 records authenticated founder-visible truth through approved Order256:
date2026-08-29/latest256/current257/review91/active7 with the compact Orders237–256
milestone and every unfinished Phase5–7 dependency still explicit. It changes no
runtime or product behavior; exact sole-local promotion is separate.

Order259/D-673 is independently approved as the configured positive-
tax semantic-routing prerequisite. Approved Order256 eligibility and the pure
Order251 plan may resolve only explicit exact-property/currency/jurisdiction
room-revenue and canonical nonzero-tax credit routes. The table is tenant/RLS scoped,
SELECT-only to app_role and has no runtime authoring path. Policy-blocked plans issue
zero semantic lookup; names, USALI labels, role defaults and generic TAX/GST/VAT
codes never provide fallback. Fresh migration43/97 tables/87 policies, focused9/9,
acceptance11/11, migration38/38, schema/referee/static and standing837/837 proof are
green, and the reviewer personally reproduced the focused, adjacent, database,
schema, referee and static gates with no finding. No posting writer, India
decomposition, document allocation or fiscal authority is yet admitted.

Order260/D-674 refreshes only authenticated recorded status through approved
Order259: date2026-08-29/latest259/current260/review91/active7 and compact
Orders237–259 truth. It changes no product, schema, database, credential or runtime;
sole-local promotion remains a separate guarded order.

Order262 is independently approved as the first governed financials-owned positive-tax
journal writer. It accepts only tenant/property/reservation identity, idempotency and
audit authority; Orders251/256/259 derive the exact eligible primary folio, signed
amounts and configured revenue/tax routes. Route-ready line-rounded non-India truth
creates one balanced charge journal, insert-only root-only version-1 `tax_detail`, one
immutable attribution-to-journal binding and atomic `journal.posted` plus
`tax.attribution_posted` fact/outbox evidence. The app inserts only the null-tax
credit set; an owner capability validates locked lineage/snapshot/routes, proves
sequence 1 absent, then inserts the exact guest root and binding. Exact policy
blockers write nothing. Document allocation, India GST/place-of-supply decomposition,
negative tax, correction/reversal, fiscal documents/IRP, HTTP/UI/local promotion and
Phase7 completion remain explicit later work. A non-implementing Tier-3 reviewer
personally reproduced migration44/98 tables/88 policies, referee11/11, focused9/9,
adjacent21/21, acceptance11/11, migration38/38, exact live schema, clean correction
and statement regressions, standing841/841 and the static gates with no blocking
product finding.

Order263 is independently approved as a bounded authenticated status and loopback sign-in
restoration slice. Recorded truth is date2026-08-29/latest262/current263/review91/
active7; the aggregate Orders237–262 card remains `built_unverified` while naming the
Order262 posting slice independently approved. The existing D-520 no-store loopback
helper retains escaped defaults only in a private closure after removing temporary
DOM attributes and handles one cancelable internal restore event. Sign-in restore,
success and failure dispatch that event; ordinary/non-loopback documents have no
handler and therefore keep clearing the password. No credential value, storage,
authentication, token, throttle, endpoint, database or runtime authority changes.
Status stale4/1+2 skips and helper security6/1 intentional reds precede combined
12/0+2 skips(149), relevant operator47/0(711), standing842/0+765 skips(8528),
type/96-boundary/23-licence/audit0/diff green. A non-implementing Tier-3 reviewer
personally reproduced focused12/0+2 skips(149), exact operator47/0(711), adjacent
security52/0(440), standing842/0+765 skips(8528) and every static gate with no
blocking finding. Sole-local promotion is governed separately by Order264 below.

Order264 promoted exact approved Orders262–263 to the sole local app, but independent
verification recorded CHANGES REQUIRED after an internal hashing-tool alias error
rendered protected app environment values into agent/tool output. Only the app had
changed; PostgreSQL, Valkey,
retained volume, protected environment, two properties, migration44/98-table/
88-policy catalogue and exact all-table row-count digest remain unchanged. The
healthy no-store loopback3000 sign-in has three populated masked defaults and both
properties report exact latest262/current263/review91/active7;3002/3188 are closed.
The reviewer made no mutation and independently confirmed non-secret continuity;
all exposed application credentials/secrets require a separate governed rotation
and logging-safe re-review before local approval.

Order265 completed and independently approved that governed forward rotation. Five
protected app values changed while every other environment value stayed
exact; new runtime/registrar/local credentials work and the captured immediately
prior database credentials, local password and JWT all fail. Both protected ignored
handoff files retain owner/SYSTEM-only ACL. Sole local app remains approved image
83a7bb59bd70 with exact PostgreSQL/Valkey/volume, two hotels, catalog44/98/88,
all-table row-count digest and both262/263/review91/active7 snapshots unchanged. A
fresh non-operating Tier-3 reviewer personally reproduced every safely repeatable
current-generation credential, SCRAM, identity, integrity, HTTP and sole-port gate
without exposing protected values or mutating the runtime.

Order266 is paused at D692 after its migration lane accidentally targeted the stable
Compose project while preparing disposable database proof. PostgreSQL and Valkey were
recreated against the retained data volume; the app remained unchanged and healthy.
Read-only containment proves `yellow_dev` still has exact migration44/98 tables/88
policies/two hotels and the byte-exact pre-incident all-table digest. Migration0045 did
not reach the product database, but one seeded scratch database remains in the cluster.
No Order266 database-execution, local-promotion or completion claim is valid until a
separate governed reconciliation removes only that scratch state and independently
approves the replacement runtime identities.

Order267 completed that guarded reconciliation pending independent non-operating
review. A fresh owner/SYSTEM-only D-drive backup is readable; literal target checks
removed only `yellow_order266_migration`. The unchanged app and replacement
PostgreSQL/Valkey now pass exact catalog44/98/88/two-hotel/digest, HTTP/no-store
populated masked login, both262/263/review91/active7 snapshots and sole-port proof
without any container restart or product mutation. Independent review subsequently
recorded CHANGES REQUIRED because all three retained containers exited together with
code255 before live reproof. Their exact identities/image/volume/restart0 remain;
restoring those same containers and fresh independent live proof is now required.

Order268 has restored those exact retained containers with literal full-ID starts in
dependency order. Fresh logging-safe proof confirms the same healthy app image,
PostgreSQL/Valkey identities, retained volume and restart0; restricted backup;
unchanged product migration44/98 tables/88 policies/two hotels/all-table digest;
scratch absence; populated masked protected login; both262/263/review91/active7
snapshots; and sole loopback3000. Independent non-operating Tier-3 approval remains
pending, so Order266 database execution is still paused. A fresh independent
non-operating Tier-3 reviewer subsequently reproduced every safely repeatable live
assertion and approved Order268 at D698 without protected output or runtime mutation.
The sole-local prerequisite is restored; Order266 may now resume only in its separate
collision-proof proof environment while stable3000 remains untouched.

Order266 is independently APPROVED at D700. Its isolated PostgreSQL proof applies
migration0045 with exact98 tables/88 policies/referee11/11; focused correction8/0,
all named adjacent database suites, migration/schema/static gates and canonical
native standing846/0 are green. The proof corrected count-alias and pre-idempotency
cross-tenant behavior while retaining exact replay after later account closure. All
disposable proof resources were removed and stable3000 remains unchanged at
44/latest262/current263/review91/active7. A fresh non-implementing Tier-3 reviewer
personally reproduced the exact proof with no blocking finding; status refresh,
historical migration44 reconciliation and local promotion remain separate work.

Order269 is BUILT-UNREVIEWED at D702. The authenticated recorded snapshot now says
exact date2026-08-29/latest266/current269/review91/active7 while keeping the complete
phase vector and generated review coverage unchanged. Its Orders237–266 aggregate
remains built-unverified and records approved complete positive-tax correction while
partial/India/negative-tax correction, India GST decomposition, documents/IRP,
independent product review and Phase7 completion remain pending. Focused5/0 plus2
database skips, standing846/0 plus775 environment skips and static gates are green;
local visibility remains behind lineage reconciliation and guarded promotion.

Order270 is independently APPROVED at D705. Repository0044 is exact to retained
applied bytes and its later deterministic posting-ordinal delta is forward-only0046.
Fresh and historical1–44 upgrade proof reaches46 migrations/98 tables/88 policies,
preserves historical ledger binary bytes and product row counts, and reruns no-op;
referee11/11, strict fresh schema, migration39/0, directly affected finance/security,
standing848/0 plus775 skips and static gates are green. A fresh non-implementing
Tier-3 reviewer personally reproduced the proof with no finding. Stable3000 is
unchanged; a separate guarded promotion remains mandatory.

tax_assignment evaluation (percent/fixed/slab, compound, line-vs-document rounding)
from EXTENSIONS §2; India GST slab per room-night; document issue path: series →
gapless number → hash chain → document; IRP reporting adapter (sandbox), IRN + QR
stored on document; fiscal_submission log.
**DoD**: golden-file tax tests for IN slabs (999 / 1,001 / 7,500 / 7,501 boundaries) ·
KSA/AE flat VAT · document numbers gapless under 100 concurrent issues · IRP sandbox
round-trip stores IRN.

**Approved Order272 prerequisite:** exact SELECT-only India supplier GST registration
evidence is now bound to the frozen jurisdiction extension identity. Canonical
GSTIN/state/legal identity/address/pincode and a deterministic evidence hash resolve
without fallback or writes. Fresh PostgreSQL proof reaches47 migrations/99 tables/89
policies with referee11/11; fresh independent Tier-3 execution approved the exact
candidate. At that boundary, place-of-supply, CGST/SGST/IGST and IRP seller payload
remained later work.

**Built Order273 status bridge:** authenticated recorded status now reflects exact
latest272/current273/review91/active7 and the compact Orders237–272 milestone. Phase
states and review coverage are unchanged; guarded sole-local promotion is separate.

**Approved Order275 product slice:** project only the approved Order272 supplier
evidence into exact notified IRP 1.1 `SellerDtls`
(`Gstin`,`LglNm`,`TrdNm?`,`Addr1`,`Loc`,`Pin`,`Stcd`). Exact field limits,
GSTIN/state/PIN validation, null-only trade-name omission, fixed-order JSON,
SHA-256 payload identity, separately retained registration/evidence lineage, source
immutability and recursive freeze fail closed without trimming, truncation,
coercion or synthesis. This pure boundary creates no database, document, provider,
submission, API, HTTP or UI authority and decides no buyer, place of supply, supply
type, tax decomposition, item or value. Fresh independent Tier-3 execution approves
the exact immutable candidate under D-719 with no finding; Phase7 is not complete.

**Independently approved Order276 prerequisite:** one typed tenant/RLS Party GST-
registration root and exact read-only registration-id resolver now provide registered-
recipient candidate evidence only. Exact48-migration/100-table/90-policy PostgreSQL,
referee11/11, focused, hostile, standing and static proof are green. It never infers a
legal invoice buyer from reservation, account, Party display/profile/address or role
truth and creates no `BuyerDtls`, place-of-supply, decomposition, document or
submission authority. D-722 found no product defect and correctly withheld approval
for the stale canonical setup oracle. Order277 repaired only that exact oracle; fresh
independent execution at D-725 now approves the complete descendant at48 migrations/
100 tables/90 policies/referee11/11 with no remaining finding.

**Independently approved Order277 proof repair:** changed only the canonical `setup.sh` exact public-
table oracle/message from99 after migrations1–47 to committed truth100 after
migrations1–48. No product, migration, schema, test, referee, runtime or local change
is admitted. Fresh isolated canonical setup now exits0 at48 migrations/100 tables and
referee11/11; standing/static gates are green. Fresh independent Tier-3 execution at
D-725 approves the exact repair and corrected Order276 descendant with no finding.

**Independently approved Order278 product slice:** project only exact approved Order276 recipient
evidence into the notified IRP1.1 `BuyerDtls` identity/address fields. The wrapper
retains Party/registration/evidence lineage and deterministic bytes/hash. Official
schema lists buyer POS separately as `Pos`; this pure candidate projection cannot
invent it, select a legal invoice-window buyer or authorize tax/document/submission.
Intentional red0/1 preceded focused/adjacent22/0+10 database-only skips and standing
879/0+798 database-only skips; type/101-boundary/23-licence/audit0/diff are green.
Fresh independent Tier-3 execution at D-728 reproduces the complete proof with no
finding.

**Independently approved Order279 product slice:** resolve one exact read-only association between an
explicit folio window and explicit approved Order276 recipient registration, then
compose exact approved Order278 BuyerDtls bytes and deterministic association evidence.
Sibling windows remain distinct even when they share an account. Account Party,
reservation primary/booker Party, guest role, window name and folio number are never
buyer inference. No persistence, legal designation, `Pos`, tax, document or submission
authority is admitted. Intentional red0/1 preceded corrected fresh-PostgreSQL focused/
adjacent33/0, exact48 migrations/100 tables/90 policies/referee11/11 and standing
884/0+805 environment skips; type/102-boundary/23-licence/audit0/diff are green.
Fresh independent Tier-3 execution at D-731 reproduces the complete PostgreSQL,
referee, migration, standing and authority proof with no finding.

**Independently approved Order280 product slice:** add one exact tenant/RLS SELECT-only Indian
physical-property fiscal-location root and deterministic read-only resolver. This truth
is deliberately separate from supplier/recipient GST registration state and every
mutable org/property/profile display source. It is a future hotel-accommodation
place-of-supply prerequisite only and emits no `Pos`, supply type, classification, tax,
document or submission authority. Intentional red0/1 preceded focused12/0,
acceptance14/0, runtime-DML5/0, migration39/0, exact49 migrations/101 tables/91
policies/referee11/11 and standing889/0+815 environment skips; type/103-boundary/
23-licence/audit0/diff are green. Fresh independent Tier-3 execution at D-734
reproduces the complete proof with no finding.

**Admitted Order281 product slice:** add one exact tenant/RLS SELECT-only Indian GST
accommodation-classification assignment and deterministic read-only resolver. The
assignment is explicitly selected, equality-bound to the already frozen positive-tax
jurisdiction, and limited to the official launch SAC set `996311`, `996312`, `996313`,
`996321`, `996322`, `996329` with service flag `Y`. Commercial route, tax-code, USALI,
rate-plan, profile, space and unit truth cannot substitute. This is future item
evidence only: no `ItemList`, `Pos`, `SupTyp`, tax, document, submission, API, UI or
local authority. New schema/RLS/statutory evidence is Tier 3 and requires fresh
PostgreSQL/referee proof plus independent executable review under D-735.
Intentional red0/1 now precedes focused12/0, adjacent28/0, acceptance15/0,
runtime-DML5/0, migration39/0, exact50/102/92/schema/referee11/11 and standing894/0
plus 825 database-only skips; type/104-boundary/23-licence/audit0/diff are green under
D-736. Fresh non-implementing Tier-3 execution at D-737 independently reproduces the
complete focused, adjacent, migration, catalogue, schema, referee, standing and static
proof with no finding. Order281 is approved; this grants no later item, tax, document,
submission, local-promotion, Phase-7-complete or application-complete authority.

**Admitted Order282 product slice:** compose approved seller-registration, explicit
folio/buyer, physical-property location and accommodation-classification truth into one
exact read-only Indian lodging place-of-supply candidate. Under IGST Act section
12(3)(b), `pos` is sourced only from the immovable property's state; supplier,
recipient, guest, account, org/profile or mutable config never substitutes. The
candidate is deeply frozen, fixed-order, tenant-bound and deterministic, but grants no
intra/inter-state result, CGST/SGST/IGST decomposition, `SupTyp`, `ItemList`, item
values, document, submission, API, UI or local authority. No schema is added. Exact
composition proof, canonical referee and fresh independent Tier-3 execution are
mandatory under D-738.
Intentional red0/1 now precedes focused12/0, adjacent governed roots42/0 plus
eligibility6/0, acceptance15/0, runtime-DML5/0, migration39/0, exact50/102/92/schema/
referee11/11 and standing905/0 plus828 database-only skips; type/105-boundary/
23-licence/audit0/diff are green under D-739. Fresh non-implementing Tier-3 execution
at D-740 independently reproduces the full proof with no finding and approves exact
candidate `4047684`. This grants no intra/inter-state conclusion, decomposition,
`SupTyp`, item, document, submission, local-promotion, Phase-7-complete or
application-complete authority.

**Independently approved Order283 product slice:** purely compare exact approved property-bound
supplier-registration state evidence with exact approved property-derived lodging
`pos`. Return only `same_state_or_union_territory` or
`different_state_or_union_territory`, fixed source lineage, deterministic JSON and a
tenant-bound hash. This is not an intra/inter-State conclusion: same-code hotel
supplies to/by an SEZ remain inter-State under IGST sections7(5)(b)/8(2) and CBIC
Circular48/22/2018, while current truth has no bilateral SEZ evidence. Recipient state
never participates. No SQL/schema/lock/write, `SupTyp`, `IgstOnIntra`, levy route,
rate/amount, rounding/residual, item/document/submission/API/UI/local authority is
admitted. Intentional red, exhaustive36×36 hostile proof, exact unchanged PostgreSQL/
referee and fresh non-implementing Tier-3 execution are mandatory under D-741.
Intentional red0/1 preceded exact focused12/0(4,187 expectations), four approved-root
suites50/0, Order28212/0, SellerDtls9/0, eligibility7/0, acceptance15/0,
runtime-DML5/0, migration39/0, exact50 migrations/102 tables/92 RLS-enabled tenant
tables/92 policies/2 FORCE-RLS tables/schema/referee11/11 and standing916/0 plus831 database-only skips
(13,655 expectations;1,747 tests/310 files). Type/106-boundary/23-licence/audit0/
diff are green under D-742; disposable proof is removed and the sole local is
healthy and unchanged. Fresh non-implementing Tier-3 execution remains mandatory.
Fresh Tier-3 execution at exact candidate `1cea37f` returned CHANGES REQUIRED under
D-743 for one governance-proof wording defect only: the product and every executable
gate are green, but current records overstate FORCE-RLS coverage. The corrected
descendant must record 92 RLS-enabled tenant tables, 92 policies and 2 FORCE-RLS
tables, then receive fresh independent review.
The mutable proof claim is corrected exactly under D-744; no product, test, schema or
runtime byte changed. Order283 is again built-pending-review on the corrected
descendant and still requires fresh independent approval.
Fresh non-implementing Tier-3 review approves exact corrected candidate `2b4d2d8`
with no finding under D-745. Reviewer-personal law, ancestry, product-byte identity,
exact50/102/92/92/2 catalogue, schema/referee11/11, focused/adjacent/database/
standing/static/scope proof and stable-runtime recheck are green; disposable proof is
removed. Approval remains bounded to relationship evidence and grants none of the
forbidden supplier-location, supply-nature, levy, item, document, submission, local,
merge, deploy, Phase-7-complete or application-complete authority.

**Independently approved Order284 supplier service-location slice:** add one explicit SELECT-only
IGST section2(15)(a) assignment proving that the lodging supply is made from the
exact registered place represented by current approved Order272 registration/hash.
It returns frozen tenant-bound evidence only. It must not infer the establishment
from GSTIN/address/property/org/config, support section2(15)(b–d), classify SEZ or
supply nature, or emit levy, `SupTyp`, item, document, API/UI/local authority.
Intentional red, exact51/103/93/93/3 PostgreSQL/schema/referee, hostile zero-write
proof and fresh non-implementing Tier-3 execution are mandatory under D-746.
Intentional red0/1 preceded focused18/0(238), migration39/0(187), acceptance16/0,
runtime-DML5/0, exact51 migrations/103 public tables/93 RLS-enabled tenant tables/93
policies/3 FORCE-RLS tables/schema/referee11/11 and standing927/0 plus841 skips
(13,842 expectations;1,768 tests/312 files). Type/107-boundary/23-licence/audit0/
diff are green under D-747; disposable proof is removed and the sole stable local is
healthy/unchanged. Fresh non-implementing Tier-3 execution remains mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `9c222c4` with no
finding under D-748. Reviewer-personal official-law, ancestry/scope, no-inference,
exact51/103/93/93/3, schema/setup/referee11/11, focused/database/standing/static and
stable-runtime proof are green; disposable proof is removed. Approval remains
bounded to section2(15)(a) evidence and grants none of the forbidden downstream
authority.

**Built-pending-review Order285 recipient SEZ-status slice:** add one explicit SELECT-only status
root bound to exact current Order276 recipient registration/hash. Admit only official
active regular, SEZ-unit/Form-G or SEZ-developer/Form-B-or-C evidence as of an
explicit date; absence never means non-SEZ. This does not cover supplier-side SEZ,
authorized operations/zero rating, supply nature, levy, `SupTyp`, item, document,
API/UI/local authority. Intentional red, exact52/104/94/94/4 PostgreSQL/schema/
referee, hostile zero-write proof and fresh Tier-3 are mandatory under D-749.
The D-750 candidate passed intentional red0/1, focused16/0(301), migration39/0(182),
acceptance17/0(49), runtime-DML5/0(111), exact52/104/94/94/4 normalized schema and
referee11/11, plus standing936/0 with851 environment skips and all static gates.
Disposable proof is removed and the sole stable local remains healthy and unchanged.
Fresh non-implementing Tier-3 execution remains mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `8630639` with no
finding under D-751. Reviewer-personal official-law, no-inference, exact
52/104/94/94/4, schema/setup/referee11/11, focused/database/standing/static and
stable-runtime proof are green; disposable proof is removed. Approval remains
bounded to affirmative recipient registration/SEZ-status evidence and grants none
of the forbidden downstream authority.

**Built-pending-review Order286 supplier SEZ-status slice:** add one explicit SELECT-only status
root bound to the exact current Order272 supplier registration/hash reached through
approved Order284 service-location evidence. Admit only affirmative active regular,
SEZ-unit/Form-G or SEZ-developer/Form-B-or-C evidence at an explicit date; absence
never means non-SEZ. This does not cover Form-F2 renewals, bilateral supply nature,
authorized operations/zero rating, levy, `SupTyp`, item, document, API/UI/local
authority. Intentional red, exact53/105/95/95/5 PostgreSQL/schema/referee, hostile
zero-write proof and fresh Tier-3 are mandatory under D-752.
The D-753 candidate passed intentional red0/1, focused16/0(317), migration39/0(187),
acceptance18/0(52), runtime-DML5/0(112), exact53/105/95/95/5 normalized schema,
canonical setup and referee11/11, plus standing945/0 with861 environment skips and
all static gates. Disposable proof is removed and the sole stable local remains
healthy and unchanged. Fresh non-implementing Tier-3 execution remains mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `03d68cc` with no
finding under D-754. Reviewer-personal official-law/Form-F2 boundary, exact
53/105/95/95/5, schema/setup/referee11/11, focused/database/standing/static and
stable-runtime proof are green; disposable proof is removed. Approval remains
bounded to affirmative supplier registration/SEZ-status evidence and grants none of
the forbidden downstream authority.

**Built Order287 India accommodation supply-nature slice:** the pure exact composer
over complete approved Orders283–286 is built under D-757. Intentional red0/1
preceded focused12/0(398), including exhaustive18-way statutory precedence and
hostile lineage/date/shape/hash/zero-effect proof; standing957/0 plus861 skips
(14,668 assertions;1,818 tests/318 files), type/110-boundary/23-licence/audit0/diff
are green. No schema/runtime/dependency artifact changed, so approved-base exact
53/105/95/95/5 schema/referee proof is unchanged. Fresh Tier-3 review is mandatory;
no levy/decomposition, `SupTyp`, authorized operations/zero rating, item, document,
API/UI/local authority is granted.
Fresh non-implementing Tier-3 review approves exact candidate `4f25f8e` with no
finding under D-758. Reviewer-personal official-law, exhaustive18-way, adjacent,
standing/static, exact approved-base schema/referee and unchanged stable-local proof
are green. Approval remains bounded to pure accommodation supply-nature evidence.

**Built Order288 first-renewal SEZ-unit LoA continuity slice:** the exact tenant-
leading forced-RLS SELECT-only Form-F2 root and complete-Order286 resolver are built
under D-763. Intentional red0/1 preceded isolated focused10/0(227), migration39/0,
acceptance19/0, runtime-DML5/0, exact54/106/96/96/6 schema/setup/referee11/11,
standing967/0 plus863 skips(14,892;1,830 tests/320 files), type/111-boundary/23-
licence/audit0/diff green. It supports only the first directly contiguous five-year
or shorter issued renewal. Form-F1, later chains, AO/specified-officer/BLUT, GST
substitution, zero rating, tax, document/API/UI/local authority remain excluded.
Fresh Tier-3 is mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `d65c236` with no
finding under D-764. Reviewer-personal official-law, focused/database/migration/
schema/setup/referee, adjacent/standing/static and stable-preservation proof are
green. Approval remains bounded to first directly contiguous Form-F2 continuity.

## Phase 8 — Statutory registration + ZATCA

Statutory scheduler consuming check-in events; adapters: it-alloggiati (168-char),
pt-siba, in-form-c, hr-evisitor behind StatutoryAdapter port; ZATCA Phase 2:
UBL 2.1 + XAdES signing, PIH chain, TLV QR, sandbox clearance flow;
statutory_submission + receipts; failure alerting via Uptime-Kuma webhook.
**DoD**: Alloggiati record byte-exact vs fixture · ZATCA sandbox clears a chained
pair (PIH verified) · missing identity field blocks check-in for IT property only.

## Phase 9 — Distribution (direct OTA first)

channel + channel_map; inbound_message idempotent consume (booking.com + expedia
sandbox adapters behind one port); reservation delta → ARI push_cursor loop;
rate/availability push on relevant events; error queue + replay tool.
**DoD**: sandbox reservation lands as PMS reservation with correct folio · ARI push
converges after burst of 500 rate changes (cursor, no thundering herd) · duplicate
inbound message is a no-op.

## Phase 10 — PWA (seven surfaces, one codebase)

Front desk workbench (peek/drawer/workbench tiers, keyboard-first, deep links);
reports screen (v1 set incl. Security/Vehicles, server-rendered PDF); property setup
workbench with bulk room create (range+prefix+zero-pad OR pasted list); property
switcher preserving screen+date;
kiosk mode; HK mobile view; owner portal read surface; command palette; offline
front-desk with pre-leased hold pool + sync; auth surfaces per Grants.
**DoD**: check-in fully by keyboard · offline: create walk-in on leased hold, sync
resolves · Lighthouse PWA pass · owner sees only owner-scoped data (RLS + Grants test).
**Free wins at this phase:** **ALTCHA** (MIT, self-hosted, Argon2id proof-of-work) on
the public booking engine — kills card-testing bots, a real hospitality plague, with
no third-party call and no GDPR exposure · Web Push API
for staff notifications (HK task assigned, arrival alerts) — free, PWA-native,
works on installed iOS PWAs, replaces any paid push service.

## Phase 11 — Groups & Blocks

reservation_group kinds linked/block/share end-to-end; block_status_def deducts
config; allotment pickup/release/wash; rooming list bulk import; group billing
routing via automation.
**DoD**: pickup decrements allotment not house inventory until deduct status ·
wash releases at cutoff · rooming list of 200 commits in one idempotent batch.

## Phase 12 — UAE ASP + AR + migration tooling

FiscalDocumentProvider `provider_routed` implementation against chosen `ae-asp:<vendor>`
sandbox; AR module (ar_control accounts, ar_allocation, statements, aging);
migration importer (CSV mappings for parties/reservations/folios balances) +
dry-run report; go-live checklist generator.
**DoD**: PINT AE doc round-trips ASP sandbox · aging report ties to GL ·
dry-run import of 1k-reservation fixture reconciles to the rupee/fils.

## Parked (post-v1, triggers in Architecture v3 §13)

Marina/campground/coworking profiles · OR-Tools matching sidecar · ClickHouse ·
Peppol · payroll/inventory-procurement ERP edges · native apps (Tauri wrap exists) ·
multi-currency folio settlement (schema is ready: single-currency journals + kind
`fx` for gain/loss pairs; v1 settles in property currency, acquirer converts —
trigger: first tenant contractually needing cross-currency folios).

**Approved Order289 current supplier GST-registration-status slice:** one exact
tenant-leading forced-RLS SELECT-only snapshot and resolver for independently
changeable active GST Portal status/taxpayer type of approved Order272 supplier
registration reached through complete Order284 lineage at one explicit evidence
date. Order286 historical approval and Order288 Form-F2 continuity cannot substitute
for current GST status. The date is evidence time only; consumption awaits separately
approved service-supply/time-of-supply authority. D-765 requires intentional red,
exact55/107/97/97/7 schema/setup/referee, hostile zero-write proof and fresh Tier-3.
Effective renewed status, supply-nature V2, zero rating, levy, document/API/UI/local
authority remain separate. D-766 records intentional-red precedence, focused
`10/0`, acceptance `20/0`, runtime-DML `5/0`, migration `39/0`, exact
`55/107/97/97/7` schema/setup/referee `11/11`, standing `976/0` plus `865` skips and
all static gates green. Fresh non-implementing Tier-3 review approves exact candidate
`35ad434` with no finding under D-767 after personally rerunning every mandatory
database, migration, schema, referee, standing, static and stable-local proof.

**Approved Order290 accommodation service-provision-date evidence:** one exact
tenant-leading forced-RLS SELECT-only asserted service-date root bound to complete
approved Order252 reservation lineage and canonical Order240 room-revenue attribution.
It is only an input for later CGST section13 composition. D-768 forbids deriving it
from Order287 supply date, quote nights, reservation period, check-in/occupancy/
checkout, posting date or clocks; invoice/payment/time-of-supply, Order289 consumption,
tax/document/API/UI/local authority remain separate. Exact56/108/98/98/8 schema,
hostile non-substitution proof and referee11/11 are green under D-769. Fresh Tier3
review approves exact candidate `4476cc5` with no finding under D-770.

**Built-pending-review Order291 accommodation payment-receipt-date evidence:** add one exact
tenant-leading forced-RLS SELECT-only full-attribution payment-receipt root bound to
approved Order290/252/240 truth. Preserve supplier-books entry and supplier-bank
credit dates and require the stored receipt date to be their earlier date under CGST
section13 explanation(ii). D-771 forbids substituting payment, provider-receipt,
journal, document, folio, operational or clock timestamps and admits no partial/cash/
refund allocation, invoice/timeliness or time-of-supply result. Exact
`57/109/99/99/9` schema, hostile zero-write/non-substitution proof, referee `11/11`
and fresh Tier3 are mandatory. D-772 records focused8/0(105), acceptance22/0(63), runtime-DML5/0(116), migration39/0(187), exact57/109/99/99/9, setup/referee11/11, standing992/0 plus869 skips(15377), schema SHA `400a7da729b8fad3c0def0a22f0a8eda43a68021898ed495060c158ce7b81dbe`, and type/boundary/license/audit/diff green. D-773 records fresh non-implementing Tier3 approval of exact candidate `10e9adf` with no finding; approval remains limited to the full-attribution payment-receipt evidence input.

**Ready Order292 accommodation invoice-issue-date evidence:** following approved
Order291/D-773, add one exact tenant-leading forced-RLS SELECT-only full-attribution
external tax-invoice issue-date input bound to Order290/252/240 truth. Preserve only
invoice series/serial and issue date for later Rule47/section13 composition; do not
issue an invoice or decide validity, numbering, timeliness or time of supply. D-774
requires fresh intentional-red, exact `58/110/100/100/10` schema/setup/referee and
independent Tier3 review; no writer, rendering, IRP, API/UI/local or completion authority.
Builder D-775 proof is intentional red0/1(1), focused7/0(78), acceptance23/0(65),
runtime-DML5/0(117), migration39/0(187), exact schema58/110/100/100/10 with SHA
`227cba82339bc69d9c9263b854ea7954dc82a0dc16e19ca852304dc0d2eab19d`, migration SHA
`d2eaf70479a602ec82dc5abe73442475abb80ed8ec3f2ef3ec333b182c30dddf`, setup/referee
11/11, standing998/0 plus871 skips(15449;1869 tests/328 files), type/115-boundary/
23-licence/diff green. Independent review approves exact candidate `cc7d44b` with no
product finding under D-776; the reviewer-recorded duplicate three-line paragraph
was removed as nonblocking documentation cleanup. Approval remains limited to
invoice identity/issue-date evidence.

**Ready Order293 accommodation invoice-timeliness composer:** after approved
Order292/D-776, add one pure deterministic composer consuming approved Order290
service-date and Order292 invoice-date evidence plus affirmative governed ordinary-
Rule47 evidence. It returns only timely/late evidence using the inclusive fixed
30-calendar-day boundary; all exception regimes fail closed. No migration, writer,
regime inference, invoice validity/issuance, section13 result, tax/document/API/UI/
local authority. D-777 requires hostile proof and fresh independent Tier3 review.
Builder D-778 proof is intentional red0/1(1) before implementation, focused including
intentional11/0(124), adjacent40/0+3 skips(834), unchanged setup58/110/100/100 with
referee11/11, standing1009/0+871 skips(15573;1880 tests/330 files), typecheck,
boundaries116, licences23, audit0 and diff clean. No migration/schema change;
disposable proof resources were removed and stable local remains stopped by founder
authorization. Independent review of candidate `95e43a5` under D-779 is CHANGES
REQUIRED for two blockers: Date.UTC low-year/overflow arithmetic and incomplete
Order290/292 invoice identity/evidence rehash binding. Repair requires explicit
proleptic-Gregorian date arithmetic with overflow fail-closed behavior and inclusion
of invoice series/serial plus both predecessor evidence hashes in result/hash.
D-780 records refreshed REPAIRED-PENDING-REREVIEW proof: focused including
intentional15/0(146), adjacent44/0+3 skips(856), unchanged setup58/110/100/100/
referee11/11, standing1013/0+871 skips(15595;1884 tests/330 files),
typecheck/boundaries116/licences23/audit0/diff green. Repair uses explicit
proleptic-Gregorian arithmetic with no JavaScript Date, low-year/leap/century/
month/year regressions and overflow fail-closed, plus complete invoice
series/serial and invoice/service evidence hashes in result/hash. No migration/
schema change; fresh independent Tier3 re-review remains pending and no approval
is claimed.
# Order294 delivery note

Phase 7 includes the migration-free India GST ordinary accommodation time-of-supply
composer and its focused hostile/read-only proof.

## Order295 delivery note

Compose approved Order289 supplier GST registration status with approved Order294
ordinary accommodation time-of-supply evidence through one migration-free,
tenant-bound read. Require exact `statusAsOf === timeOfSupplyDate`, revalidate all
predecessor envelopes and hashes, and return only frozen
`active_at_time_of_supply` evidence. No validity interval, rate, levy, tax,
document, posting, submission, API, UI or writer authority is admitted.

## Order296 delivery note

Compose approved Order285 recipient registration/status with complete approved
Order294 ordinary accommodation time-of-supply evidence through one migration-free,
tenant-bound read. Require exact `statusAsOf === timeOfSupplyDate`, complete
predecessor-envelope/hash revalidation and tenant/GSTIN/address concealment. Return
only frozen `active_recipient_registration_at_time_of_supply` evidence. No buyer,
place-of-supply, supply-nature, rate, levy, tax, document, IRP, API or UI authority is
admitted.

**Built-pending-review Order297 supply-nature/registration time binding:** compose
complete approved Orders287, 295 and 296 into one pure migration-free exact-date
boundary. Recompute all predecessor envelopes and hashes; bind property,
reservation, registration, service-location, lineage and dates; return only frozen,
tenant-hidden `supply_nature_and_registrations_bound_at_time_of_supply`. No database,
writer, buyer/B2B, `Pos`, `SupTyp`, `IgstOnIntra`, rate, levy, tax, document, IRP,
API/UI or local authority. Intentional-red, exhaustive hostile proof and fresh
independent Tier-3 review remain mandatory under D-801.

**Ready Order298 effective accommodation rates:** supersede the quarantined launch
nil/5/18 India accommodation fixture for the explicit 2026 extension with sourced
12% through INR 7,500 per accommodation unit per day and 18% above. Reuse the
effective-dated extension/assignment/evaluator architecture; no migration, section14,
SEZ zero-rating, decomposition, document/IRP/API/UI/local authority. D-810 requires
intentional red, exact boundary proof, setup/referee preservation and fresh Tier3.

**Ready Order299 tax-extension effective-period evidence:** add one narrow
runtime-only PostgreSQL projection for the exact lower/upper `tstzrange` bounds of an
already-selected tenant-visible extension id, then bind those bounds into Order238's
frozen jurisdiction evidence. This closes only the documented temporal-evidence gap;
it does not map a property-local date to an instant, select by clock/latest, decide
applicability, calculate tax, decompose GST or authorize fiscal/UI work. D-817 requires
intentional red, hostile tenant/role/temp-shadow proof, setup/referee and fresh Tier3.

**Ready Order300 property-local business-day instant evidence:** bind the exact active
same-tenant property's database-owned IANA timezone and PostgreSQL-derived local-
midnight-to-next-local-calendar-midnight UTC bounds into Order238's frozen resolved and
unassigned evidence. Preserve canonical six-digit instants and prove DST 23/25-hour
days plus awkward offsets; never substitute JavaScript, a host clock or fixed-24-hour
math. This closes only the property-day instant-evidence gap. Extension-period
containment, overlap, start-instant, split-day, section14 and every other applicability/
legal rule remain explicitly forbidden for a later bounded order. D-820 requires
intentional red, hostile temporal/tenant proof, unchanged setup/referee and fresh Tier3.

**Ready Order301 property-day extension containment:** require the exact selected
extension `[from,to)` to contain the complete PostgreSQL-derived property-local day
before resolution. Equality and unbounded edges pass; partial overlap, start-only and
one-microsecond truncation fail closed across DST and awkward offsets. Correct only the
India 2026 fixture temporal lower instant to Kolkata civil midnight. No section14,
working-day calendar, old/new version pairing, tax calculation, fiscal/API/UI/local
authority. D-827 requires intentional red, hostile proof, setup/referee and fresh Tier3.

**Ready Order303 Notification15 accommodation-rate correction:** retain Order298 as
historical predecessor evidence and supersede its pre-change 2026/default India
lodging content under Notification15/2025, effective 22 September 2025, with 5%
without ITC through INR7500 and 18% with ITC above. No below-INR1000 exemption is
restored. Bind test fixture,
default production seed, evaluator and quote boundaries without adding schema,
historical version pairing, section14 composition, fiscal/API/UI or local authority.
D-833 requires intentional red, preservation gates and fresh Tier3 review.

**Built-pending-fresh-review Order304 India accommodation rate-version pair evidence:** select exact
caller-identified tenant-visible retired predecessor and active successor extensions,
replay both effective periods, and bind their adjacent Kolkata-midnight transition,
canonical 12%-to-5% lower-band/ITC delta, unchanged 18% upper band, contents and
official-source hashes into one frozen tenant-hidden result. No seed conversion,
resolver/retired-rate selection, section14 calculation, fiscal/API/UI/local authority.
D-836 requires intentional red, hostile/live zero-effect proof, preservation gates and
fresh Tier3 review.
D-837 records red-before-production, focused 9/0+2 live skips, live PostgreSQL 2/0
(19 assertions), standing 1077/0+885 skips (16425 assertions; 1962 tests/352 files),
typecheck/boundaries122/licences23/audit0/diff/schema green, and fresh 59-migration /
110-table / referee11/11 preservation. Fresh independent Tier-3 review D838 approves
exact candidate `bb746f202a53bedc997519262bcffda14db7025f` with no finding; the complete
review, mutation proof and cleanup are recorded in `handoff/reviews/304-india-gst-accommodation-rate-version-pair-independent.md`.
Disposable proof resources were removed and the founder local was untouched. Approval
is limited to this frozen evidence pair; no downstream authority is claimed.

**Ready Order305 India accommodation launch-history seed:** make fresh bootstrap and
the invariant fixture carry exact deterministic retired-v1/active-v2 global lodging
extensions with Order304-approved adjacent periods, rates and ITC flags. Seed replay
must be exact and every collision must roll back without repair; current active-only
resolution remains v2. No existing-database conversion, migration/schema, historical
stay selection, section14, tax/fiscal/API/UI/local authority. D-839 requires
intentional red, fresh live seed/replay/collision/resolver proof, preservation gates
and fresh Tier3 review.
D-840 records red0/1 before production; focused2/0+2 live skips(20), live2/0(72),
adjacent4/0+21 skips(562), existing seed integration10/0(63), standing1079/0+887
skips(16446;1966 tests/355 files), type/boundary122/licence23/audit0/diff/schema and
fresh59 migrations/110 tables/referee11/11 green. The exact disposable project was
removed and founder local untouched; fresh Tier3 approval remains pending.
