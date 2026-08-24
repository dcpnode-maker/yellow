# Order 096 — Operator reservation guest/share workbench

**Phase:** 4 — Reservations

**Tier:** 3 — authenticated tenant mutation, permission catalogue and operator adapter

**Branch:** `phase-4/operator-reservation-guests`

**Base:** independently approved Order 095 at `80a1992`

**Written by:** Codex primary implementation owner

**Date:** 2026-08-24

**Status:** ORDER WRITTEN · P0 NOT YET RECORDED

## Outcome

Let authorized hotel staff find one reservation by its exact confirmation number, inspect
the server-owned primary and current guest/share allocation, and replace accompanying
guests and sharers through Order 095's atomic command. Add one accessible operator
Reservations workspace using the existing same-origin HTML/CSS/JavaScript shell.

## Natural-Solution Test

Order 095 already owns mutation, locking, exact shares, idempotency, facts and outbox.
The existing operator API owns authentication, hierarchical property grants, generic
errors and same-origin assets. The dynamic permission catalogue already accepts bounded
permission rows through the idempotent review seed. This order composes those surfaces;
it needs no table, migration, state, event, identity store, financial allocation or
alternate command.

## UX direction

Yellow's existing warm operator design system remains authoritative. The optional local
UI search database was unavailable because no Python runtime is installed, so the skill's
built-in priorities apply: visible labels, inline errors, keyboard operation, 44px targets,
live loading/success feedback, mobile-first reflow, no hover-only behavior, reduced-motion
compatibility and no browser claim of database authority. Do not introduce a second visual
system or external font/icon/network dependency.

## Scope

- `src/contexts/reservations/guests.ts`
- `src/contexts/reservations/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `scripts/seed-review.ts`
- `tests/operator-reservation-guests.integration.test.ts`
- `tests/operator-assets-security.test.ts`
- `tests/review-seed.integration.test.ts` only for exact permission expectations
- `src/project-status.ts` and `tests/founder-status.integration.test.ts` only after green proof
- `handoff/orders/096-operator-reservation-guests.md`
- `handoff/PHASE-4-PLAN.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/questions/` if a proof or undocumented product ambiguity stops work
- the independent Order 096 review record

## Required work

1. Add distinct dynamic permissions `reservations.guests:read` and
   `reservations.guests:write` to the idempotent local-review seed. Do not reuse booking
   creation authority or broaden any existing role implicitly. Exact seed replay and
   divergent-content failure remain unchanged.
2. Extend `ReservationGuestService` with a read-only exact-confirmation lookup. Require a
   canonical nonblank confirmation string of at most 120 visible characters and explicit
   tenant/property arguments from authenticated context. Query one RLS-visible reservation
   and its guests, return reservation id/confirmation/status/primary party and a frozen
   deterministic allocation, and reveal no foreign existence. The read writes nothing and
   may inspect terminal reservations; Order 095 remains the sole edit-status authority.
3. Add operator routes:
   - `GET /api/v1/properties/:property/reservation-guests?confirmationNo=...`
   - `PUT /api/v1/properties/:property/reservations/:reservation/guests`
   Each checks its exact read/write scope and hierarchical property grant before invoking
   the domain. PUT accepts only `{primarySharePct, guests}` with exact nested keys, requires
   the standard `Idempotency-Key`, creates the server-owned `reservation.modified` envelope,
   and exposes replay via the existing response header. Domain errors map to stable generic
   400/404/409 responses without party or tenant leakage.
4. Wire one `ReservationGuestService` from the existing database/event/idempotency
   dependencies in `server.ts`; no adapter writes SQL or duplicates command logic.
5. Add a Reservations tab/workspace to the existing operator shell. Staff enter an exact
   confirmation number, load the reservation, see the immutable primary row and status,
   add/remove non-primary rows, choose accompanying/sharer role, and enter canonical share
   strings. The browser may calculate integer-basis-point guidance and disable submit for
   obvious invalidity, but the response from PostgreSQL remains authoritative.
6. Dynamic rows use visible labels, field-associated error/help text, keyboard-operable
   add/remove controls, minimum 44px targets, `aria-live` status, focus transfer after add
   and removal, no innerHTML/user-content interpolation, and responsive single-column
   layout without horizontal scrolling. Loading, empty, saved, replayed and server-rejected
   states are explicit.
7. Pre-register and prove strict JSON/query/path handling, auth/scope/property isolation,
   exact lookup, successful replacement, replay/conflict, foreign tenant/property and
   publisher rollback through the full HTTP path. Static asset proof rejects token storage,
   unsafe HTML sinks, floating share math and UI-only guest mutation.
8. Run frozen install, native state, typecheck, boundaries, default and focused database
   suites, review-seed proof, asset-security/accessibility checks, licence/audit, exact
   schema, deployment acceptance, protected hashes and fresh app-never-started referee
   11/11. Obtain independent non-implementing review before proceeding.

## Forbidden

- Any migration, schema/RLS/grant change, new table/column/function/trigger or seed fixture
- A new reservation state/event, a second guest mutation, direct adapter DML, owner-role SQL
- Reusing `reservations.booking:write` as guest read/write authority; merging read and write
  permission; accepting tenant/actor/property/primary role from the request body
- Party creation/merge/anonymisation/deletion, profile editing, document/identity handling
- Folio/account/journal/posting/payment/tax/fiscal allocation or claims that `share_pct`
  posts money
- Client-side floats, implicit share remainder, browser-authoritative validation, local or
  session storage of tokens/guest data, innerHTML, external assets, inaccessible icon-only
  controls, hover-only interactions or removed focus indicators
- Editing applied migrations, `tests/run_invariants.py`, package/lock files, Compose/CI or
  any file outside Scope
- Self-review, self-merge or claiming UI presence as end-to-end completion

## Pre-registered proof

### P0 — intentional red

Commit this order and a focused proof importing/using the planned lookup and operator
routes before implementation. It must fail only because the public lookup/routes do not
exist; no production edit precedes this proof.

### P1 — authorized lookup and replace

An exact read-scoped token finds one property reservation and deterministic guests without
writes. A write-scoped token replaces the allocation through HTTP, preserves primary,
returns exact string shares, one fact/event and replay header, and exact retry is
byte-equivalent.

### P2 — strict authority and hostile inputs

Missing/invalid auth, missing read/write scope, wrong property grant, foreign tenant,
malformed/duplicate query/path/body keys, primary role, bad decimals/totals, absent or
terminal edit targets and changed-key reuse return stable 400/401/403/404/409 responses
and persist no allocation/evidence/idempotency mutation.

### P3 — rollback and adapter convergence

Injected final event failure through the HTTP route leaves guest/fact/outbox/idempotency
snapshots exact; the same key succeeds with the real bus. Spy operations prove the adapter
calls only the injected domain lookup/replace surfaces with server-derived tenant, actor,
property, request id and operation.

### P4 — workbench UX and security

Static and runtime DOM checks prove the Reservations tab, labelled confirmation lookup,
immutable primary presentation, dynamic accompanying/sharer fields, associated guidance,
44px controls, live status, responsive layout, reduced motion, safe text rendering and no
token/guest persistence or alternate mutation. Hostile text remains text.

### P5 — standing and independent gate

All standing, focused, review-seed, schema, deployment, protected-hash and fresh referee
proofs pass. A non-implementing reviewer personally executes P1–P4 on fresh isolated
PostgreSQL and returns APPROVED.

## Definition of done

- [x] Order exists before production code.
- [x] Intentional P0 red is committed before implementation.
- [x] Exact read/write permissions and property-scoped routes pass.
- [x] Workbench is accessible, responsive and server-authoritative.
- [x] P1–P4 pass, including rollback and hostile boundaries.
- [x] Standing/schema/deployment/referee gates pass.
- [x] Independent reviewer approves executed proof.
- [x] Scope is exact; user-owned untracked material remains untouched.

Independent review first rejected `ca6d38b`, then approved corrected tip `d9ad13b` after
executing reviewer-owned BigInt and dynamic-focus canaries plus every required database
gate. See `handoff/reviews/096-operator-reservation-guests.md` for exact evidence.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
