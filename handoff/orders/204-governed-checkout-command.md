# Order 204 — Governed checkout command

**Status:** READY-D551 — intentional red and implementation required
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-checkout-command`
**Base:** `9162fac` (built-unreviewed Order203)
**Risk tier:** 3 — reservation/segment transition, occupancy release and financial-readiness arbitration
**Owner:** Codex implementation; independent review deferred under founder build-first direction

## Outcome

An exactly authorized operator can deliberately check out one ready in-house/due-out
reservation. One transaction locks and revalidates the Order203 predicates, releases
the exact current segment occupancy only through the sanctioned inventory service,
trims and departs that segment, transitions the reservation to `checked_out`, and
records actor-bound replayable fact/outbox evidence. No financial truth is repaired or
mutated by checkout.

## Fixed command policy

- Exact input is tenant, property, reservation, idempotency key and a server-built
  `reservation.checked_out` audit envelope. Browser readiness, time, room, segment,
  folio, money and authority are never accepted.
- Legal reservation transitions are only `in_house -> checked_out` and
  `due_out -> checked_out`. Exactly one current `in_house` segment becomes `departed`.
- The command locks the reservation/segments, then the single canonical reservation
  guest account and every folio in deterministic order through
  `lock_financial_rows`; it revalidates the exact Order203 blocker policy under those
  locks. Every window must already be settled/closed at canonical zero.
- `ReservationOccupancyService.releaseForSegment` is the only occupancy mutation.
  Release happens while the parent segment is still in-house. The segment period ends
  at the server transaction timestamp when earlier than its booked end and is never
  lengthened; checkout before the period lower bound fails closed.
- Exact replay is byte-equivalent and a changed request conflicts. Occupancy release,
  segment/reservation states, idempotency, fact and outbox all commit or roll back
  together.
- Checkout deliberately does not mark the room dirty or create/link housekeeping
  work because no canonical atomic checkout consequence is recorded. Order202 owns
  configured departure sheet generation; a future explicit workflow may add a
  different consequence without weakening this command.

## Exact scope

- `handoff/orders/204-governed-checkout-command.md`
- new `src/contexts/stay-operations/checkout.ts`, minimal reuse in
  `src/contexts/stay-operations/checkout-readiness.ts`, and
  `src/contexts/stay-operations/index.ts`
- minimal composition in `src/app.ts`, `src/server.ts`, `src/http/operator.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/stay-checkout.intentional-red.test.ts`,
  `tests/stay-checkout.integration.test.ts`,
  `tests/operator-checkout-workbench.integration.test.ts`, and focused additions to
  `tests/review-seed.integration.test.ts`
- checkout-only sections in `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md`, `docs/UI-SPEC.md`; existing state/event vocabulary stays exact
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No migration, dependency, table, state or event vocabulary is admitted.
`migrations/0001_init.sql` and every migration remain byte-identical.

## Required work

1. Commit P0 intentional red before implementation.
2. Add `CheckoutService.checkout` with one tenant transaction, actor-bound
   `PostgresIdempotency`, deterministic reservation/segment/account/folio locks,
   server transaction time, exact readiness revalidation, sanctioned segment release,
   guarded state/period updates and atomic minimized evidence.
3. Add exact POST
   `/api/v1/properties/:property/reservations/:reservation/checkout` behind
   `stay-operations.checkout:commit`, the exact property grant, body `{}` and required
   `idempotency-key`. Malformed/foreign/concealed targets use bounded errors.
4. Extend the existing Departure workbench with a consequence confirmation and
   explicit **Check out guest** command. Preview enables guidance only; the server
   remains final authority. Retain the same retry key on transport retry and refresh
   reservation detail plus Today after success with all current stale/focus/theme
   protections.
5. Add one deterministic past-started checkout-ready fixture without changing the
   Order202/203 fixture bytes or active-date sheet cardinality. Reuse the existing
   Party/account/room/rate configuration, add only one reservation/segment/settled-zero
   folio plus sanctioned non-overlapping segment occupancy, and seed no command effect.

## Forbidden

- implicit settlement/closure, AR transfer, balance repair or any account/journal/
  posting/payment/approval/receivable mutation
- direct occupancy DML, caller time/readiness/money/segment/room/folio authority
- room-condition, housekeeping task/sheet, discrepancy, queue, message, key, travel,
  vehicle, document, tax, fiscal, statutory or business-day mutation
- new blocker vocabulary, migration, dependency, local promotion, second local,
  merge, push or public/production deployment

## Pre-registered proof

- **P0 red:** service, command route, workbench action and exact commit scope are absent.
- **P1 exact success:** both legal source statuses end checked-out, the current segment
  departs with server-owned non-lengthening period, exact occupancy is gone, existing
  folio/ledger bytes remain unchanged and minimized facts/events are exact.
- **P2 blockers:** every Order203 blocker is revalidated under locks; combined blockers
  retain fixed order and stale preview has no command authority.
- **P3 replay/concurrency:** exact replay, changed-key conflict and twenty contenders
  converge to one transition/evidence effect.
- **P4 races/rollback:** sanctioned financial commands and segment change/move races
  yield one coherent winner; every injected publication failure rolls back all state
  and the same key retries cleanly.
- **P5 hostile boundaries:** malformed/foreign tenant/property/actor, missing scope/
  grant, forged envelope/readiness and raw runtime status/occupancy mutation fail closed.
- **P6 operator/seed:** deterministic non-overlapping ready fixture/reseed, retained-key
  confirmation, stale guards, refreshed detail/Today, keyboard/responsive/reduced-motion/
  forced-colour/all-appearance behavior are green.
- **P7 standing:** fresh migrations1–27, acceptance/runtime-DML/definer/schema,
  type/boundary/licence/audit/JS/diff/full suite and referee11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Locks and revalidation make checkout atomic against financial/segment races.
- [ ] Occupancy release and status/period/evidence are exact and replayable.
- [ ] Human checkout action and deterministic ready fixture are usable.
- [ ] Result is recorded built-unreviewed without claiming room dirtying/housekeeping/Phase6/app completion.

