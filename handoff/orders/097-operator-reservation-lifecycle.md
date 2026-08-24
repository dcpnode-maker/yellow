# Order 097 — Operator reservation lifecycle workbench

**Phase:** 4  
**Branch:** `phase-4/operator-reservation-lifecycle`  
**Base:** `a5c8c90`  
**Risk tier:** 3 — reservation state transitions and occupancy release/reclaim  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Expose the independently approved Order 085 modify/cancel/reinstate commands through
strict property-scoped HTTP and the existing Reservations workbench. An operator finds a
reservation by exact confirmation number, edits only the six approved mutable metadata
fields, cancels with an exact reason and optional already-approved waiver id, or reinstates
through PostgreSQL occupancy re-arbitration. No adapter or browser owns lifecycle truth.

## Natural-Solution Test

The natural solution is one lifecycle query plus the existing three lifecycle commands,
one distinct read/write permission pair, strict same-origin routes and one progressively
disclosed workbench panel. It reuses the approved state registry, occupancy service,
PostgresIdempotency, facts and outbox. It does not duplicate transition rules, create an
HTTP-specific mutation, read current hotel policy as booking evidence or invent a
cancellation-approval workflow.

## Scope

- `src/contexts/reservations/lifecycle.ts`
- `src/contexts/reservations/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `scripts/seed-review.ts`
- `tests/operator-reservation-lifecycle.integration.test.ts`
- `tests/operator-assets-security.test.ts`
- `tests/review-seed.integration.test.ts` only for exact scope expectations
- `src/project-status.ts` and `tests/founder-status.integration.test.ts` only after green
- this order, `handoff/PHASE-4-PLAN.md`, `DECISIONS.log`, `handoff/LEDGER.md`,
  `handoff/questions/`, and the independent review record

## Required work

1. Add a read-only `ReservationLifecycleService.findByConfirmation` query. It accepts only
   server-derived tenant/property and one canonical visible confirmation number, returns
   reservation id, confirmation, exact status, the six mutable metadata fields and
   server-derived action eligibility, and performs no write. Terminal history remains
   inspectable.
2. Add review-seed permissions `reservations.lifecycle:read` and
   `reservations.lifecycle:write`. Keep them distinct from booking creation and guest
   authority; reuse hierarchical property grants.
3. Add strict routes:
   - `GET /api/v1/properties/:property/reservations?confirmationNo=...`
   - `PATCH /api/v1/properties/:property/reservations/:reservation`
   - `POST /api/v1/properties/:property/reservations/:reservation/cancel`
   - `POST /api/v1/properties/:property/reservations/:reservation/reinstate`
4. PATCH accepts only exact `expected` and `changes` objects over notes, ETA, ETD,
   market/source/origin. Cancel accepts only reason plus optional UUID approval id;
   reinstate accepts an empty object. Mutation routes require `Idempotency-Key`; tenant,
   actor, property, request id and audit operation are server-owned.
5. Map lifecycle validation/not-found/conflict/approval-required failures to stable generic
   400/404/409 HTTP without leaking policy internals. The optional approval id is accepted
   only as a reference for the domain command to bind; this order does not create or decide
   approvals.
6. Wire one runtime lifecycle service using the existing event bus, idempotency and
   reservation occupancy service. Adapter code performs no SQL or occupancy/state mutation.
7. Extend the Reservations tab with a separate exact-confirmation lifecycle panel, honest
   current state, optimistic metadata form, explicit cancel reason/optional approved waiver
   id and conditional reinstate action. Use visible labels, fieldsets, 44px controls, live
   status, deterministic focus after state changes, responsive layout, safe text APIs and no
   browser persistence or client transition authority.
8. Preserve the guest/share editor and every previously approved route byte-for-behavior.

## Forbidden

- Any migration, schema/RLS/grant change, new state/event, approval kind or seed fixture
- Editing `migrations/0001_init.sql`, another migration, `tests/run_invariants.py`, package
  or lock files, Compose/CI, Party, financial, tax, journal, payment or fiscal surfaces
- Current-policy cancellation decisions, client-supplied policy/penalty/time/tenant/actor,
  a fake zero penalty journal, direct occupancy SQL, transition duplication or browser
  action eligibility
- Creating/approving a waiver in this order, self-approval, accepting an unbound approval,
  or implying every cancellation is free
- Reusing booking or guest scopes; merging lifecycle read/write authority
- `innerHTML`, token or reservation persistence, external assets, floats for money/share,
  inaccessible icon-only or hover-only controls
- Any file outside Scope, self-review, self-merge or claiming Phase 4/app completion

## Pre-registered proof

### P0 — intentional red

Commit this order and a focused proof using the planned lifecycle query/routes before
production changes. It fails only because those public surfaces are absent.

### P1 — lookup and metadata modification

Read scope returns exact current metadata and server action eligibility without writes.
Write scope PATCH changes only named fields with exact before/after evidence; replay is
byte-equivalent and stale expected data conflicts without mutation.

### P2 — cancellation and approval boundary

A frozen zero-penalty booking cancels through HTTP and releases exact occupancy. A
penalty/legacy booking returns approval-required until an exact different-operator approved
waiver is supplied; absent, self, rejected, mismatched, reused and foreign approvals write
nothing.

### P3 — reinstatement, races and rollback

Reinstate reclaims original occupancy; a competitor or concurrent caller yields one winner.
Injected publication failure at every command rolls state, segment, occupancy, fact, outbox
and idempotency back; same-key real-bus retry succeeds.

### P4 — strict authority and UX

Missing/invalid auth, scope, property grant, foreign tenant, malformed/duplicate query/path/
body/key and forbidden fields return stable generic errors without artifacts. Static/runtime
browser canaries prove labelled responsive metadata/cancel/reinstate controls, conditional
server-derived actions, 44px targets, focus/status behavior, safe hostile text and no browser
authority or persistence.

### P5 — standing and independent gate

Typecheck, boundaries, standing, review seed, schema, deployment, protected hashes and a
fresh app-never-started referee pass. A non-implementing reviewer personally executes
P1–P4 against fresh PostgreSQL and approves.

## Definition of done

- [x] Order exists before production code.
- [x] Intentional P0 red is committed before implementation.
- [x] Lifecycle read/write permissions and strict routes pass.
- [x] Modify/cancel/reinstate converge on approved domain commands.
- [x] Approval-required and occupancy rollback boundaries pass.
- [x] Workbench is accessible, responsive and server-authoritative.
- [x] Standing/schema/deployment/referee gates pass.
- [x] Independent reviewer approves executed proof.
- [x] Scope is exact; user-owned untracked material remains untouched.

Builder evidence: focused adapter/assets passed 10/10 and 102 assertions; the approved
domain lifecycle battery passed 5/5 and 62 assertions; standing passed 124/0 and 1,590
assertions; review seed 11/11; deployment 4/4; schema and protected hashes exact; licences
and dependency audit clean; pristine 84-table referee 11/11. This is not independent
approval.
