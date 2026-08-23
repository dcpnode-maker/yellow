# Order 095 — Atomic reservation guest and share allocation

**Phase:** 4 — Reservations

**Tier:** 3 — reservation aggregate mutation, exact share allocation and tenant isolation

**Branch:** `phase-4/reservation-guest-share-command`

**Base:** independently approved Order 094 at `22e4264`

**Written by:** Codex primary implementation owner

**Date:** 2026-08-24

**Status:** P0 RED READY · production service absent

## Goal

Add one authorized reservation-domain command that atomically replaces the complete
non-primary guest list and optional rate-share allocation for an existing reservation.
The command preserves the primary guest, validates every party and percentage, serializes
concurrent edits, and writes the existing `reservation.modified` fact and outbox event in
the same tenant transaction.

## Natural-Solution Test

The existing `reservation_guest` entity already models reservation-scoped party
occurrences with `primary`, `accompanying`, and `sharer` roles plus `share_pct`. Order 094
independently proved its exact runtime privileges and RLS boundary. The existing
`reservation.modified` evidence contract, `PostgresIdempotency`, `fact_log`, and outbox
provide the remaining primitives. No table, column, state, event, permission, Party
variant, financial record, or parallel guest store is required.

## Scope — files Codex may create or change

- `src/contexts/reservations/guests.ts`
- `src/contexts/reservations/index.ts`
- `tests/reservation-guests.integration.test.ts`
- `src/project-status.ts` only after all builder proof is green
- `tests/founder-status.integration.test.ts` only for the exact Order 095 snapshot
- `handoff/orders/095-reservation-guest-share-command.md`
- `handoff/PHASE-4-PLAN.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/questions/` only if an assertion or undocumented product ambiguity stops work
- the independent review record for this order

## Contracts to honour

- `PROJECT.md` invariants 2, 3, 4, 5, 6 and 9
- `docs/YELLOW-CONSTITUTION.md` guest identity, auditable commands and tenant boundaries
- `docs/ARCHITECTURE-V1.md` domain-command, transaction and authorization boundaries
- `docs/CONTRACTS.md` §§1, 3 and 4
- `docs/EVENTS.md` existing `reservation.modified {diff}` event
- `docs/STATE-MACHINES.md` §1; this command changes no reservation state
- `yellow-entity-patterns` existing-entity and Party-role rules
- `yellow-postgres-patterns` transaction-local RLS, outbox and bounded-query rules
- D-277, D-294–D-297 and historical Question 132

## Required work

1. Add `ReservationGuestService.replace()` as the only new public reservation surface.
   Require an exact reservation UUID, 8–200-character visible-ASCII idempotency key,
   `reservation.modified` audit envelope and a bounded list of at most 99 non-primary
   guest entries. Each entry contains a unique party UUID and role `accompanying` or
   `sharer`; callers never supply tenant, primary role, status, property or authority data.
2. Represent percentages at the API/domain boundary only as canonical two-decimal strings
   matching `0.01` through `100.00`. Parse them to integer basis points for validation and
   pass the original canonical strings to PostgreSQL `numeric(5,2)`; never use JavaScript
   floating-point arithmetic.
3. Accompanying guests require `sharePct: null`. With no sharers, the primary share must be
   null. With one or more sharers, a positive primary share is mandatory and primary plus
   every sharer must total exactly `100.00` (10,000 basis points). This makes the whole
   allocation explicit and prevents partial or ambiguous splits.
4. Inside `PostgresIdempotency`, lock the exact tenant/property reservation `FOR UPDATE`.
   Permit only active operational statuses `reserved`, `due_in`, `in_house`, and `due_out`.
   Require its `primary_party` and exactly one matching primary guest row. Validate every
   requested party is distinct, active and in the same tenant through RLS.
5. Update only the preserved primary row's `share_pct`; upsert the requested non-primary
   rows; delete only absent non-primary rows; and return a frozen deterministic full guest
   list with primary first and remaining rows ordered by party id. Never delete or change
   the primary role/party. The reservation row lock serializes concurrent replacements.
6. If before and after are identical, return an exact successful no-op without fact or
   event. Otherwise append one existing `reservation.modified` fact and outbox event whose
   diff contains exact deterministic before/after guest allocations. Bind actor, property,
   reservation and the entire normalized allocation into the idempotency request.
7. Exact replay is byte-equivalent. Changed-key reuse conflicts. Invalid shares, duplicate
   parties, primary duplication, inactive/foreign parties, foreign property/tenant,
   missing or terminal reservation, missing/corrupt primary membership, concurrent stale
   replacement and publisher failure persist no partial guest/fact/event/idempotency state.
8. After focused proof, run the full standing gate, exact schema check, deployment
   acceptance and a fresh app-never-started 11/11 referee. Obtain independent
   non-implementing review because this mutates tenant reservation state.

## Forbidden

- Any migration, schema snapshot, table, column, function, trigger, RLS, grant or seed edit
- Any reservation state/status transition or new fact/event name
- Any HTTP, UI, AI, alert, waitlist, profile merge, Party deletion or identity-erasure API
- Any account, folio, journal, posting, charge, payment, tax, fiscal or statutory behavior
- Deleting/replacing the primary guest; accepting caller-supplied `primary` role
- Floating-point share math, noncanonical decimal strings, implicit remainder allocation,
  negative/zero shares, totals other than exactly 100.00 when sharing is active
- Owner-role application SQL, session-scoped tenant context, RLS bypass, direct outbox/fact
  writes outside the existing kernel surfaces, or unbounded guest input
- Editing `migrations/0001_init.sql`, any applied migration, `tests/run_invariants.py`,
  package/lock files, Compose, CI, or files outside Scope
- Self-review, self-merge, or claiming builder proof as independent approval

## Pre-registered proof

### P0 — intentional red

Commit this order and a focused database proof before production code exists. The first
focused run must fail only because `ReservationGuestService` is absent from the public
reservation context.

Observed before production code: `bun test tests/reservation-guests.integration.test.ts`
returned **0 pass, 1 fail, 1 import error** because the public reservation context did
not export `ReservationGuestConflictError`/`ReservationGuestService`. No database setup
or assertion executed.

### P1 — exact replacement and shares

Create one reserved reservation with its primary guest. Add accompanying and sharer rows
with an exact primary/sharer 100.00 split, then replace them with a different exact list.
Assert primary identity survives, absent rows are deleted, retained rows update, ordering
is deterministic, and one exact fact/event records each actual before/after change.

### P2 — replay, no-op and concurrency

Exact retry is byte-equivalent with no additional evidence; a new-key exact no-op emits no
evidence; changed-key reuse conflicts. Twenty concurrent different replacements serialize,
leave one complete requested allocation (never a mixed list), and each committed change has
one complete fact/event pair.

### P3 — fail-closed boundaries

Reject malformed UUID/key/role/share strings, wrong totals, duplicate/primary/inactive or
foreign parties, foreign property/tenant, terminal or missing reservation, and missing or
duplicate primary membership. Compare guest, fact, outbox and idempotency snapshots; every
rejection is mutation-free and reveals no foreign data.

### P4 — publication rollback

Inject failure on the final `reservation.modified` publication after primary update,
upserts, deletes and fact creation. The transaction restores every guest and evidence row;
the same idempotency key succeeds once with the real publisher.

### P5 — standing and independent gate

From the top: frozen install; native state; typecheck; 58-file-or-later boundaries; complete
default suite; fresh focused P1–P4; licence and vulnerability audit; exact schema;
deployment acceptance; protected hashes; fresh isolated db-only referee at 11/11. A
non-implementing reviewer personally executes the focused proof and returns APPROVED.

## Definition of done

- [x] Order written before production code.
- [x] P0 missing-service red committed before implementation.
- [ ] P1–P4 pass on fresh PostgreSQL.
- [ ] Public context exports only the bounded typed command and errors.
- [ ] Project status honestly reports Order 095 with Phase 4 still active.
- [ ] Standing, schema, deployment and referee gates pass.
- [ ] Independent non-implementing reviewer approves personally executed proof.
- [ ] Scope is exact and pre-existing untracked user material remains untouched.
