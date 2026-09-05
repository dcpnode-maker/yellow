# Order 360 — Order353 persisted valuation authority repair

**Status:** APPROVED-D1044 — fresh independent Tier-3 statutory proof complete
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/order353-persisted-valuation-authority-repair`
**Base:** exact withheld implementation `15a1a06` / governance `1adc277`
**Risk tier:** 3 — statutory taxable-value authority
**Owner:** Codex repair implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Make Order353 genuinely server-authoritative without changing D1005 tax policy. In
one tenant transaction, replay Order341 and read exactly one persisted current
ordinary-final Order350 valuation head plus its complete ordered room-night rows.
Calculate only from those database-derived facts.

## Exact contract

The public service input retains only tenant/property/reservation/folio scope and the
bounded Order341 replay input. Remove caller-supplied valuation result, room-night
values and quoted-result authority. PostgreSQL selects the unique scope-matching head
for which no successor supersedes it; requires `ordinary_final`, INR, a positive
transaction value, matching fresh Order341 evidence hash and a dense ordered positive
room-night set whose sum equals the persisted total. More than one/no head, gaps,
duplicates, manual/null values, stale/superseded evidence or any scope/hash mismatch
fails closed. The query is read-only, tenant-RLS-contained and occurs in the supplied
transaction snapshot.

## Exact scope

- Order353 service, context export/types and focused tests;
- one bounded fresh-PostgreSQL Order360 authority/lineage/tenant/zero-write suite;
- only directly affected Order353 governance and review evidence.

No migration/schema/permission/write/route/UI/posting/document/IRP/manual/correction
change is authorized; catalogue remains the current exact `63/116/106/15/2`.

## Required proof

1. Reproduce the parent forged-value acceptance, then prove caller values/hashes are
   absent from the repaired API and cannot influence results.
2. Fresh PostgreSQL proves current ordinary head and dense room-night derivation;
   missing/duplicate/forked/superseded/manual/null/zero/negative/gapped/reordered,
   foreign tenant/property/reservation/folio and Order341-hash mismatch fail closed.
3. Below/at/above every slab, all three component families, unequal fractional and
   exact-half cases, bigint boundaries/overflow, deterministic order, recursive
   immutability and no aggregate residual remain green.
4. Pre/post table and database write counters are identical; no fact/outbox or fiscal
   artifact is created. Exact catalogue, migration/acceptance/authority/seed,
   ancestor/standing/static/schema and referee `11/11` pass.
5. A different fresh non-implementing Tier-3 reviewer personally approves.

## Forbidden

No caller-derived taxable value, valuation disposition/generation/hash, room-night
amount or fresh-replay result; no weaker “shape validation”; no new current-head
cache/view/table; no local/deploy/merge/`.yellow`/port3000 change.
