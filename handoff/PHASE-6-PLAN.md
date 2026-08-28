# Phase 6 — Stay operations and housekeeping

**Status:** active; Orders 200–222 are built-unreviewed
**Entry point:** built-unreviewed Phase-5 composition through Order 199
**Current order:** next bounded build-first slice pending

## Outcome

Phase 6 turns a reserved commercial intent into governed physical stay operations,
then coordinates housekeeping and departure without collapsing inventory, identity,
financial, statutory or key authority into one unsafe command.

## Built-unreviewed slice — Order 200

Order 200 owns one server-read due-in readiness result and one actor-bound,
idempotent `due_in -> in_house` command. Exact prerequisites are:

- one due-in reservation with exactly one current booked segment;
- one assigned sellable unit mapping to exactly one active physical room;
- one open primary folio window over an open property guest account;
- authoritative `unit_condition` clean or inspected;
- or, for dirty/pickup only, the exact same-property
  `stay-operations.checkin:dirty-room-override` grant plus a nonblank reason;
- when `org_node.config.statutory_adapter_key` is configured, one exact effective
  active tenant-owned `statutory_adapter` with a non-empty valid
  `required_identity_fields` declaration and at least one recorded
  `identity_document` for every reservation Party.

The read surface requires `stay-operations.checkin:read`; commit requires
`stay-operations.checkin:commit`. The browser never supplies readiness or authority. Successful
commit changes only the reservation and current segment to `in_house`, with one
same-transaction fact/outbox pair and durable replay. No Party or identity-document
data is returned.

The review seed provides three deterministic non-committed arrivals: clean and ready
and dirty and override-gated on the canonical review property, plus clean but
identity-evidence-gated on a deterministic sibling property whose config selects the
synthetic review statutory adapter. The canonical property config remains unchanged.
They carry open primary folios only as prerequisites and create no journal, posting,
payment, occupancy, document or check-in evidence.

## Built-unreviewed bounded slice — Order 201

Order 201 exposes one property housekeeping task board and only three adjacent actions
over existing `kind='housekeeping'`, `subject_type='space'` tasks:

- start `assigned -> in_progress`, preserving room condition;
- complete `in_progress -> done`, requiring dirty/pickup and atomically making it clean;
- independently authorized verify `done -> verified`, requiring clean and atomically
  making it inspected.

The exact scopes are `housekeeping.tasks:read`, `housekeeping.tasks:work` and the
distinct `housekeeping.tasks:inspect`. Commands bind expected task status, condition
and condition `updated_at`; the server derives actor/property/authority and commits
the task/condition state plus minimized facts/events atomically. Review seed fixtures
place an assigned-dirty task on room 103 and a done-clean task on room 201 without
transition evidence, sheets, occupancy or changes to the Order-200 arrivals.

This slice deliberately omits task creation, assignment, cancellation, reopen,
cadence, task sheets, credits, attendant allocation, discrepancies, queue, keys,
reservation/occupancy mutation, financials, business-day or statutory effects.

## Built-unreviewed bounded slice — Order 202

Order 202 adds property-scoped preview, current-sheet read and deliberate generation
under distinct `housekeeping.sheets:read` and `housekeeping.sheets:generate` grants.
The server owns actor, property, active staff attendant validation, effective
tenant-over-global profile truth, occupancy/current-segment selection and deterministic
sheet/task identities. V1 supports only `daily` in-house rooms and `on_departure`
rooms whose occupied segment ends on the exact property-local date. Weekly, custom,
missing, mixed or ambiguous cadence fails atomically.

The review seed reuses Avery Housekeeping and adds one isolated fixed-date in-house
segment plus sanctioned occupancy on otherwise unused daily hotel room 202 in pickup
condition. It exposes the date and exact ids but intentionally creates no sheet, task,
fact/outbox transition or financial/statutory effect. Generation creates one assigned
housekeeping task per distinct eligible room and atomic minimized evidence; it never
mutates source reservation, segment, occupancy or condition truth.

## Built-unreviewed bounded slice — Order 203

Order 203 adds one no-store, read-only departure snapshot and a human Departure
workbench under `stay-operations.checkout:read`. One tenant transaction and one SQL
snapshot derive the fixed ordered blockers from reservation state, the unique current
in-house segment, its one active physical room, the exact matching exclusive segment
occupancy, and every reservation folio window's canonical status and balance.

The deterministic review fixture reuses Order202's isolated in-house reservation and
adds only one open guest account plus one settled zero-balance folio. The workbench
shows exact evidence, explains each blocker and links to existing governed Folio
controls. Reads are deeply frozen, mutation-free and coherent across a real concurrent
settlement transition. No checkout action, occupancy release, settlement, account,
document, day, statutory, key or other mutation is introduced.

## Built-unreviewed bounded slice — Order 204

Order 204 adds the exact `stay-operations.checkout:commit` command and a deliberate
confirmed **Check out guest** action to the existing Departure workbench. One
actor-bound idempotent tenant transaction locks the reservation and segments, the
single canonical guest account and every folio in deterministic order, then
revalidates every Order203 blocker. Only `in_house` or `due_out` may become
`checked_out`, and exactly one current `in_house` segment becomes `departed`.

The command releases the exact matching occupancy only through
`ReservationOccupancyService.releaseForSegment`, trims the segment at server
transaction time without lengthening its booked period, and records minimized
fact/outbox evidence atomically. Exact replay is stable; stale financial/segment
truth, hostile authority and publication failure leave no partial mutation. The
deterministic fixture adds one separately settled-zero checkout-ready stay and no
command effect. Checkout never settles, closes, transfers or repairs a folio, changes
room condition or creates housekeeping work; Order202's departure-sheet workflow
remains separate.

## Built-unreviewed bounded slice — Order 205

Order 205 adds exact no-store read authority and one deep-linkable human Vehicle
Register under `stay-operations.vehicles:read`. One tenant transaction returns only
the adopted minimized register fields for the exact property, ordered by
`(reg_no,id)` with canonical keyset paging. Optional plate lookup is case-sensitive
literal equality: case, spaces and punctuation are never normalized or interpreted.

Linked reservations are re-proven against tenant and exact property, linked Parties
against tenant; one inconsistent association fails the complete read closed. The
deterministic review seed adds two distinguishable literal rows without notes,
parking assignment, occupancy, commands, facts, outbox or inferred lifecycle. The
operator workbench supports deliberate search, paging, empty/error/retry and stale
request protection across every current appearance. No create/edit/delete,
entry/exit command, parking truth, inferred onsite state, event or migration is
introduced.

## Built-unreviewed bounded slice — Order 206

Order 206 extends the existing reservation-board result and minimized operator
projection with one deeply frozen `arrivalTravel` value: recorded arrival mode,
carrier, service number, scheduled instant, pickup-requested truth and only whether
the recorded pickup-task link resolves in the same tenant and exact property.
Arrival data never changes the board's existing route, permission, filters,
`(created_at,id)` ordering, cursor or page bytes; hostile linked-task associations
fail the complete read closed without disclosing their identifiers.

Reservation-board rows/cards and Today due-in cards expose one accessible compact
Arrival/Pickup line with existing stale, focus, responsive, reduced-motion,
forced-colour and appearance protections. The review seed adds arrival rows to the
existing clean and dirty due-in examples and remains an exact no-op on reseed. No
departure travel, note, internal id, Party/contact or task state is returned, and no
travel write, pickup automation, task, event, occupancy or migration is introduced.

## Built-unreviewed bounded slice — Order 207

Order 207 extends the same reservation-board result with one separate deeply frozen
`departureTravel` value containing only recorded departure mode, carrier, service
number and scheduled instant. It preserves Order206 arrival truth and the board's
existing route, permission, filters, `(created_at,id)` ordering, cursor and bounded
page replacement.

Reservation-board rows/cards and Today due-out cards expose one accessible compact
Departure line with existing stale, focus, responsive, reduced-motion, forced-colour
and appearance protections. Today due-in remains arrival-only and in-house shows
neither travel line. The review seed adds exactly one departure row to the existing
checkout-ready due-out fixture and remains an exact no-op on reseed. No pickup/drop-off
meaning, pickup flag, note, internal id, Party/contact, task, vehicle, parking,
travel write, automation, event, occupancy or migration is introduced.

## Subsequent bounded slices

Order 209 is built-unreviewed as a UI-only routing slice from Today into the already governed
check-in and checkout readiness workbenches. Exact due-in and due-out lane/status
pairs receive presentation actions; in-house and mismatches receive none. The strict
deep-link query changes no server authority, readiness result or confirmation rule.

Order 210 is built-unreviewed as a UI-only integration of existing governed stay-segment
changes into canonical reservation detail. It reuses server action flags and exact
departure/move commands while adding current-detail identity, stale and focus guards;
it creates no new mutation authority or second workflow.

Order 211 is built-unreviewed as a UI-only integration of the existing governed reservation
guest allocation into canonical reservation detail. It reuses the one audited editor,
server-owned primary truth and exact PUT/idempotency while adding current-detail
identity, mutual-exclusion, stale and focus guards; it creates no new mutation
authority, Party identity or financial allocation.

Order 212 is built-unreviewed as the first governed travel write. One per-direction exact-property
command uses CAS and actor-bound idempotency to create or replace recorded arrival or
departure fields through a new owner capability while raw app-role travel DML stays
denied. A changed row emits minimized reservation.modified evidence; no-op emits none.
Linked pickup work blocks change. The reservation drawer hosts one stale-safe editor;
pickup automation, delete, notes, vehicle, parking, occupancy and financial effects
remain deferred.

Order 208 is built-unreviewed as the next bounded read-only slice: a canonical
active-room condition board inside the existing Housekeeping workbench. It reads exact
`unit_condition` truth with tenant/property containment, keyset paging and an optional
literal condition filter under existing read authority. It does not mutate condition
or task truth and does not infer readiness, occupancy, discrepancy or room service
status.

1. Discrepancy, queue and service-message workflows only after their sleep/skip/person,
   queue-linkage and resolution semantics are recorded explicitly.
2. Order212 owns travel capture; pickup-task automation, later vehicle writes and
   parking assignment remain subsequent, and parking occupancy must use the existing
   occupancy choke point.
3. Optional key-provider port only after provider ownership, credential and recovery
   policy are fixed.

Order 213 is built-unreviewed and owns only create-only arrival pickup automation. It consumes current
scheduled pickup-requested `reserved|due_in` truth into one existing-kind open
transport guest-request task, links it atomically and records `task.created` evidence.
It adds no generic automation catalogue claim, assignment, dispatch, cancellation,
task transition, post-link edit, vehicle/parking, occupancy, finance or statutory
effect. Canonical-detail task navigation remains a later read-only human slice.

Order 214 is built-unreviewed and owns only the first read-only human slice: canonical reservation detail
shows honest arrival pickup state from existing travel/link truth. It adds no task
identity, lifecycle, action, route, query, polling or mutation. Generic task detail
and navigation remain later work.

Order 215 is built-unreviewed and owns one reservation-scoped pickup-task detail endpoint and nested human
route under existing reservation read authority. It exposes minimized canonical task
state only and adds no generic task scope, cross-kind board, lifecycle mutation or
polling. Generic task navigation remains later work.

Order 216 is built-unreviewed and owns one exact read-only Vehicle Register detail endpoint and nested human
route under the existing Order205 authority. It exposes only the already-approved
minimized row, re-proves linked reservation/Party associations and adds no write,
parking/occupancy inference or action, polling, scope, migration or event.

Order 217 is built-unreviewed and owns one exact read-only housekeeping-task detail endpoint and nested human
route under the existing Order201 board read authority. It exposes only exact eligible
task/active-room/condition truth and adds no generic task API, lifecycle mutation,
notes/payload/assignee identity, inference, polling, scope, migration or event.

Order 218 is built-unreviewed as the UI-only composition from exact Order216 vehicle detail to the existing
canonical reservation detail. It admits one action only for a validated non-null
reservation association and adds no request, API, authority, mutation, parking
inference, polling, schema or event.

Order 219 is built-unreviewed as the UI-only composition from canonical reservation detail to the existing
governed check-in or checkout preparation route. It maps only the already-admitted
authoritative statuses, runs no command on navigation and adds no API, authority,
mutation, schema or event.

Order 220 is built-unreviewed as the exact human composition of Order217 task detail with the existing
Order201 governed transition. It adds no lifecycle meaning, command authority, schema,
migration or event and remains subject to server revalidation.

Order 221 is built-unreviewed as the UI-only composition of the exact Order202 generation response with
the existing Order217/220 governed task-detail journey. It retains only a current,
validated transient task receipt and adds no server authority, mutation, persistence,
schema, migration or event.

Order 222 is built-unreviewed and repairs the existing checkout-readiness Folio-control navigation so its
visible Back/Escape/history journey returns to the same authoritative departure
workbench rather than losing context or focusing hidden content. It changes no server,
financial, checkout, schema, migration or event authority.

Statutory field semantics, validation, submission and receipts remain Phase 8. Tax and
fiscal document work remains Phase 7. No country rule is hardcoded in Phase 6.

## Phase proof still required

- wrong state, assignment, mapping, folio, condition, adapter and identity evidence
  block without mutation;
- dirty override needs exact server-derived property authority and reason;
- replay and concurrent contenders converge to one transition/evidence effect;
- raw runtime DML and foreign tenant/property/actor paths fail closed;
- checkout with an unsettled balance blocks with an actionable result;
- seeded occupancy/cadence and divergence produce correct housekeeping sheets and
  discrepancies;
- standing database, authority, financial, reservation, occupancy, schema, type,
  boundary, licence, audit and referee gates pass;
- an independent non-implementing agent executes the high-risk proof before approval.

Until those slices and proofs land, Phase 6 remains active and unapproved.
