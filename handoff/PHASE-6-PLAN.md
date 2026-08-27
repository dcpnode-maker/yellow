# Phase 6 — Stay operations and housekeeping

**Status:** active; Order 200 is built-unreviewed, not Phase completion  
**Entry point:** built-unreviewed Phase-5 composition through Order 199  
**Current order:** `200-governed-arrival-readiness-checkin.md`

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

## Subsequent bounded slices

1. Housekeeping condition commands and inspection identity, then task-sheet generation
   from configured cadence.
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
