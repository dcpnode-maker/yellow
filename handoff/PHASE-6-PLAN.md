# Phase 6 — Stay operations and housekeeping

**Status:** active; Orders 200–201 are built-unreviewed
**Entry point:** built-unreviewed Phase-5 composition through Order 199
**Current order:** `202-governed-housekeeping-task-sheet-generation-v1.md`

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

## Subsequent bounded slices

1. Governed checkout command composed with settled folios or exact AR authority; no
   implicit balance repair and every readiness predicate is locked and revalidated.
2. Discrepancy, queue and service-message workflows only after their sleep/skip/person,
   queue-linkage and resolution semantics are recorded explicitly.
3. Arrival travel/vehicle/parking capture; any parking occupancy must use the existing
   occupancy choke point.
4. Optional key-provider port only after provider ownership, credential and recovery
   policy are fixed.

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
