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

Order 235 is ready as the governed room-discrepancy slice. One authorized deliberate
room observation is compared in PostgreSQL with coherent current segment and exact
exclusive occupancy truth, producing only sleep, skip or person discrepancy evidence;
matching truth produces nothing. It reuses the existing discrepancy primitive and
event, keeps raw DML denied, permits one unresolved row per room, and explicitly
defers resolution, queue/message linkage, shared/positional semantics and all source
condition/task/reservation/occupancy/financial mutation.
Focused `13/13`, adjacent `104/104`, standing `741/0`, static/exact-schema gates and a
fresh referee `11/11` are green; independent product review remains deferred.

## Phase 7 — Tax engine + India IRP

tax_assignment evaluation (percent/fixed/slab, compound, line-vs-document rounding)
from EXTENSIONS §2; India GST slab per room-night; document issue path: series →
gapless number → hash chain → document; IRP reporting adapter (sandbox), IRN + QR
stored on document; fiscal_submission log.
**DoD**: golden-file tax tests for IN slabs (999 / 1,001 / 7,500 / 7,501 boundaries) ·
KSA/AE flat VAT · document numbers gapless under 100 concurrent issues · IRP sandbox
round-trip stores IRN.

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
