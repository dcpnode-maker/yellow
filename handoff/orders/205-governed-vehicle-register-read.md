# Order 205 — Governed vehicle-register read

**Status:** READY-D553 — intentional red and implementation required
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-vehicle-register-read`
**Base:** `c4dc25e` (built-unreviewed Order204)
**Risk tier:** 2 — read-only tenant/property association and operator disclosure boundary
**Owner:** Codex implementation; independent product review deferred under founder build-first direction

## Outcome

An exactly authorized operator can open one human Vehicle Register, page deterministic
property-scoped rows, and search one literal registration plate. The read returns only
the adopted register fields, fails closed on inconsistent associations, never exposes
notes or parking truth, and performs no write or inferred onsite-state calculation.

## Fixed read policy

- Exact route is `GET /api/v1/properties/:property/vehicles` behind
  `stay-operations.vehicles:read` and the exact property grant.
- Query accepts only optional `registration`, `cursor`, and `limit`. Registration is
  literal case-sensitive equality; no trimming, normalization, wildcard or fuzzy
  matching is invented. Limit is 1–100. Cursor is an opaque canonical encoding of
  `(reg_no,id)`; OFFSET is forbidden.
- Ordering is `(reg_no,id)`. The response returns vehicle id, registration, nullable
  make/model/colour/driver name/reservation id/party id/entered at/exited at, plus the
  next opaque cursor. It never returns notes or parking-space data.
- A linked reservation or party must belong to the same tenant, and a linked
  reservation must belong to the exact property. Any inconsistent association fails
  the complete read closed without exposing a foreign identifier.
- Entered/exited timestamps are reported literally. The service does not infer an
  `onsite` state, parking assignment, security decision or occupancy.
- Repeated reads are mutation-free and byte-equivalent for unchanged truth.

## Exact scope

- `handoff/orders/205-governed-vehicle-register-read.md`
- new `src/contexts/stay-operations/vehicles.ts` and exact exports in
  `src/contexts/stay-operations/index.ts`
- minimal composition in `src/app.ts`, `src/server.ts`, `src/http/operator.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- new `tests/stay-vehicle-register.intentional-red.test.ts`,
  `tests/stay-vehicle-register.integration.test.ts`,
  `tests/operator-vehicle-register.integration.test.ts`, and focused additions to
  `tests/review-seed.integration.test.ts`
- vehicle-read-only sections in `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md`, `docs/UI-SPEC.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No migration, dependency, table, state, event or write authority is admitted.
`migrations/0001_init.sql` and every migration remain byte-identical.

## Required work

1. Commit P0 intentional red before implementation.
2. Add a read-only `VehicleRegisterService.list` using one tenant transaction,
   deterministic keyset pagination, exact literal lookup and hostile-association
   fail-close checks.
3. Add the exact no-store GET route and server-derived authorization. Malformed,
   foreign and concealed targets use bounded errors.
4. Add a deep-linkable Vehicle Register workbench with literal plate search, paging,
   loading/error/empty/retry states, stale-request protection, keyboard/focus support,
   responsive containment, reduced motion, forced colours and every current
   appearance.
5. Add two deterministic distinguishable vehicle rows to the review seed without
   parking assignment, notes or inferred lifecycle effects; exact reseed is a no-op.

## Forbidden

- vehicle create/edit/delete, entry/exit command, plate normalization or uniqueness
  rule, travel write, parking assignment, occupancy call, discrepancy/queue/message,
  task, key, document, tax, fiscal, statutory or business-day mutation
- notes or parking-space disclosure, inferred onsite state, wildcard/fuzzy search,
  OFFSET pagination, browser persistence or background polling
- new permission semantics outside the exact read scope, migration, dependency,
  local promotion, second local, merge, push or public/production deployment

## Pre-registered proof

- **P0 red:** service, exact route, read scope and workbench are absent.
- **P1 exact read:** deterministic list, literal exact registration lookup, nullable
  adopted fields, bounds and canonical keyset cursor are exact.
- **P2 boundaries:** tenant/property isolation, malformed cursor/query and hostile
  linked reservation/party associations fail closed without foreign identifiers.
- **P3 minimization/no-write:** notes/parking are absent, timestamps are literal,
  repeated reads are byte-equivalent and all mutable/insert-only truth is unchanged.
- **P4 operator:** no-store API authority plus deep-link/search/paging/empty/error/retry,
  stale guards, focus, keyboard, responsive/reduced-motion/forced-colour/appearance
  behavior are green.
- **P5 seed:** two deterministic distinguishable rows and exact no-op reseed with no
  parking, notes, occupancy, command, fact or outbox effects.
- **P6 standing:** fresh migrations1–27, acceptance/runtime-DML/definer/schema,
  type/boundary/licence/audit/JS/diff/full suite and referee11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Vehicle read and literal lookup are deterministic, minimized and mutation-free.
- [ ] Human register/search/paging flow is usable across current appearances.
- [ ] Seed/reseed and hostile association proofs are green.
- [ ] Result is recorded built-unreviewed without claiming vehicle writes, parking,
  discrepancy, Phase6 or app completion.
