# Order 248 — Authoritative quoted-tax cart-hold binding

**Status:** BUILT-UNREVIEWED-D646
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/quoted-tax-hold-binding`
**Base:** `cad6cee` (approved local Order247 descendant of built Order246/245)
**Risk tier:** 3 — inventory arbitration plus append-only financial-attribution binding
**Owner:** Codex implementation; independent high-risk review deferred by founder build-first direction

## Outcome

Create one governed internal command that authoritatively re-quotes an exact stay,
requires live bookability and complete calculated tax evidence, places the existing
ten-minute cart hold, persists the exact canonical positive tax-attribution snapshot,
and binds the two append-only identities in the same tenant transaction. The binding
proves which live quote evidence accompanied which temporary hold; it is neither a
reservation, a price guarantee, a posting nor a fiscal document.

## Fixed policy

- The server accepts exact quote inputs, the canonical 600-second cart-hold TTL, an idempotency key
  and an audit envelope. Tenant, property and actor must agree with the transaction.
- Before resolving, the command takes the same exact rate-plan publication advisory
  lock used by release publication. A fresh `RateQuoteService.resolve` result must be
  exact-property, exact-sellable, live `bookable=true`, `state=quoted`, and carry one
  calculated tax preview. Caller-supplied price, quote hash, snapshot or tax totals
  are forbidden.
- The Order240 snapshot is derived only from that live quote. The existing
  `HoldService.place` and Order244 persistence service remain the owners of occupancy,
  hold and snapshot creation. One new append-only binding root records their ids plus
  exact quote/snapshot identity through owner-mediated authority.
- The whole command, minimized `tax.attribution_bound` fact/outbox evidence and outer
  idempotent receipt commit atomically. Same request replays exactly; changed reuse,
  races, stale publication, unavailable inventory and incomplete tax fail closed.
- Hold expiry/release does not delete history. The binding grants no reservation
  commit, consumption, price promise, posting, invoice, tax-return or IRP authority.

## Exact scope

- this order, Phase-7 plan/build entries, `DECISIONS.log`, `handoff/LEDGER.md`;
- new forward migration `migrations/0040_quoted_tax_hold_binding.sql` plus exact
  schema/migration/acceptance/referee fixtures required by its new root and policy;
- new internal orchestration in `src/contexts/tax-fiscal/quoted-holds.ts` and
  export-only tax-fiscal context update;
- new intentional-red and focused real-PostgreSQL proof under `tests/`;
- narrow contract/domain/event/security documentation for the binding and event.

## Forbidden

- editing `migrations/0001_init.sql`;
- changing quote evaluation, publication, availability, hold/occupancy or Order244
  persistence ownership; caller price/tax/hash/snapshot authority;
- hold consumption, reservation/segment mutation, folio/journal/posting/tax-detail,
  correction/transfer, document/series/submission/provider/IRP behavior;
- HTTP, UI, seed, local-app replacement, second local, merge, public or production
  deployment, independent approval, Phase7 or application-complete claim.

## Pre-registered proof

- **P0 red:** migration, table, service/export and event contract are absent.
- **P1 shape/authority:** tenant-leading append-only root, composite references, RLS,
  owner capability and denied direct runtime/PUBLIC DML are exact.
- **P2 authoritative composition:** the command locks publication, re-quotes, requires
  live bookability and calculated tax, derives Order240 evidence, then creates the
  existing cart hold and Order244 record before the binding.
- **P3 hostile/tenant:** unknown/accessor/cyclic quote inputs, caller evidence,
  foreign tenant/property/actor, unquoted/unbookable/partial tax and stale release
  write nothing.
- **P4 idempotency/concurrency:** exact replay and racing same/different keys converge
  without duplicate hold, occupancy, attribution, binding, fact or event.
- **P5 lock/rollback:** publication-versus-command and identical snapshot races do not
  deadlock; injected failures roll back every created row and retry succeeds once.
- **P6 retention/containment:** expiry/release preserves binding history while
  reservation, segment, folio, journal, posting, tax detail, document and fiscal
  submission state remain byte/count unchanged.
- **P7 standing:** focused/adjacent/full tests, fresh migration/acceptance/referee,
  typecheck, boundaries, licence, audit, JavaScript and diff checks are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Governed live re-quote, cart hold, attribution and append-only binding are one
  executable transaction.
- [x] Fresh PostgreSQL and standing proof is transcribed.
- [x] Order closes only built-unreviewed pending independent Tier-3 product review.

## Built evidence

Intentional red preceded implementation. Fresh PostgreSQL 16.15 reaches migrations
1-40 with 95 tables and 85 RLS policies; the native referee is 11/11. Focused P0-P6
proof is 8/8 with 55 assertions, including direct-authority denial, exact atomic
composition, hostile/foreign no-write behavior, replay and contention convergence,
rollback/retry, and binding retention after hold release. The full suite is 824/824
with 727 environment-gated skips and 8,388 assertions across 1,551 tests/280 files.
Typecheck, 92 import boundaries, 23-package licence policy, zero-vulnerability audit,
schema migration/acceptance/drift proofs and diff hygiene are green. No stable-local,
HTTP, UI, reservation, posting, document or fiscal-submission authority changed.
