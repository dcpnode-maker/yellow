# Order 252 — Quoted-tax reservation lineage

**Status:** APPROVED-D656
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/quoted-tax-reservation-lineage`
**Base:** `7857655` (built-unreviewed Order251 descendant)
**Risk tier:** 3 — reservation/occupancy and fiscal-lineage integrity
**Owner:** Codex implementation; independent Tier-3 execution required before approval

## Outcome

When the existing reservation command successfully consumes an exact cart hold that
already has Order248 quoted-tax binding evidence, append one immutable tenant/property
lineage edge from that binding to the newly created reservation and first segment in
the same transaction. Ordinary unquoted holds and direct reservations remain exact.

This closes only the authoritative hold-to-reservation/segment identity gap. It does
not choose a folio, account, transaction code or tax route and cannot post money.

## Fixed contract

Migration `0041_quoted_tax_reservation_lineage.sql` adds one append-only
`tax_attribution_reservation_binding` root and one owner-mediated capability. The
capability returns zero rows when the consumed hold has no quoted-tax binding. When a
binding exists it requires the exact consumed hold, reserved reservation, booked
segment, property, currency, sellable unit and half-open period to agree, then returns
one immutable receipt. Exact replay converges and divergent reuse fails closed.

`ReservationCommitService.commitHeld` invokes the capability only after existing
inventory acquisition has transferred the hold claim to the exact inserted segment
and matched frozen preparation. A created edge appends minimized
`tax.attribution_reservation_bound` fact/outbox evidence in the same transaction.
Injected failure rolls reservation, segment, occupancy transfer, lineage and evidence
back together. The public reservation response remains unchanged.

## Exact scope

- `migrations/0041_quoted_tax_reservation_lineage.sql`;
- generated `tests/schema/expected.sql` and migration acceptance manifest;
- `src/contexts/reservations/commit.ts` only for the exact optional lineage call and
  same-transaction minimized evidence;
- new focused real-PostgreSQL lineage integration proof and narrow affected reservation
  regression proof;
- exact derived `setup.sh` migration/table oracle and the Order081 split deploy/runtime
  reservation-commit harness correction admitted by Question177/D-654;
- this order, Phase7/build/decision/ledger and narrow contract documentation.

## Forbidden

No direct reservation path change; no hold placement or quote calculation change; no
folio/account/transaction-code/tax-route choice; no journal, posting line, tax detail,
business-day, document, number, hash, submission, provider or IRP write; no India or
document-rounding policy; no caller price/hash/snapshot/account/date; no HTTP/UI/seed,
local promotion, credential, second local, merge, public/production deploy, Phase7 or
application-complete claim.

## Pre-registered proof

- P0 intentional red: migration/table/capability and lineage effect are absent.
- P1 unquoted held and direct reservations remain byte-compatible with zero lineage.
- P2 exact quoted hold consumption appends one exact edge plus one fact/outbox pair.
- P3 foreign/mismatched property, currency, hold, reservation, segment, unit, period,
  actor and tenant fail closed without concealed cross-tenant truth.
- P4 replay/race/divergent reuse cannot duplicate or rebind lineage.
- P5 injected failures atomically roll back reservation, segment, occupancy transfer,
  lineage, fact, outbox and idempotency state.
- P6 ACL/RLS proof grants app read plus exact governed capability only; no table DML.
- P7 focused, adjacent, standing, schema, migration, referee and static gates are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact same-transaction lineage and zero-unquoted behavior are executable.
- [x] Fresh migration/schema/referee and standing proof are transcribed.
- [x] Independent Tier-3 review records approval or findings before approval claim.

## Scope correction

Question177/D-654 admits only `setup.sh` and
`tests/reservation-commit.integration.test.ts` as derived executable-proof surfaces.
It does not widen product or runtime behavior.

## Closure

D-655 records the completed builder proof: focused lineage **7/7**, affected
reservation-parent **7/7**, split-authority reservation-commit **5/5**, complete
standing **833 pass / 736 environment skips / 0 fail**, typecheck, 93 import
boundaries, 23 dependency licences, audit zero and diff hygiene. Fresh PostgreSQL
migrations 1–41 expose exactly 96 public tables and 86 tenant RLS policies with the
invariant referee **11/11**.

D-656 records independent Tier-3 approval in
`handoff/reviews/252-quoted-tax-reservation-lineage.md`. Approval is bounded to the
immutable quoted-tax hold-to-reservation/first-segment lineage and does not approve
folio/account routing, posting, fiscal documents, India/IRP policy, local promotion,
merge, public deployment, Phase7 completion or application completion.
