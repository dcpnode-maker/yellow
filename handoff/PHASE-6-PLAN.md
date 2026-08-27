# Phase 6 — Stay operations and housekeeping

**Status:** active; Orders 200–201 are built-unreviewed
**Entry point:** built-unreviewed Phase-5 composition through Order 199
**Current order:** next bounded housekeeping task-sheet generation slice is prepared but not yet opened

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

## Subsequent bounded slices

1. Task-sheet generation from configured cadence after the bounded Order-201
   housekeeping condition/inspection lifecycle.
2. Discrepancy, queue and service-message workflows with explicit state and audit.
3. Arrival travel/vehicle/parking capture; any parking occupancy must use the existing
   occupancy choke point.
4. Governed departure readiness and checkout composed with settled folios or exact AR
   authority; no implicit balance repair.
5. Optional key-provider port only after provider ownership, credential and recovery
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
