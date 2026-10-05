# Order 251 — Canonical positive tax posting plan

**Status:** BUILT-UNREVIEWED-D652
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/positive-tax-posting-plan`
**Base:** `9a5f46e` (approved local Order250 descendant of built Order248/249)
**Risk tier:** 3 — pure fiscal/accounting semantics with zero write authority
**Owner:** Codex implementation; independent product review deferred by founder build-first direction

## Outcome

Derive one canonical, deeply frozen, account-agnostic positive tax posting plan from an
exact reparsed Order240 snapshot. The plan proves D-323 debit-positive/credit-negative
balance and carries enough lineage for a later governed router, while remaining a pure
value that cannot choose accounts or write financial/fiscal state.

## Fixed contract

Export `derivePositiveTaxPostingPlan(snapshot: unknown): PositiveTaxPostingPlanV1`.
The exact result contains schemaVersion1, quote/snapshot/currency identity, one state
(`route_ready` or `policy_blocked`), an ordered deduplicated blocker list, exact copied
revenue/tax lineage, ordered account-agnostic lines and `balanceMinor="0"`.

The exact ordered public fields are `schemaVersion`, `quoteHash`, `snapshotHash`,
`currency`, `state`, `blockers`, `revenueLine`, `taxLineage`, `lines` and
`balanceMinor`. `revenueLine` copies room line/group/input and base totals;
`taxLineage` copies every tax index/code/name/total including zero taxes.

Lines are fixed: guest receivable debit `+grandTotalMinor`, room revenue credit
`-baseTotalMinor`, then one tax-payable credit `-taxMinor` in canonical tax order.
Money remains canonical signed int64 decimal strings and is computed only with bigint;
the exact sum must be zero. Zero tax is valid and emits no tax line.

Line zero is `guest_receivable`/`debit`; line one is `room_revenue`/`credit`
and carries the room line/group. Positive taxes then emit `tax_payable`/`credit`
lines carrying their tax index/code/name; their plan indexes begin at two. Positive
amount strings have no plus sign, credits are negative and negative zero is forbidden.

The plan is `route_ready` only for line-rounded non-India truth. Document rounding adds
`document_tax_allocation_required`; country `IN` or any aggregate GST tax code adds
`india_place_of_supply_decomposition_required`. Blockers may coexist and cannot be
silently resolved, allocated or split.
Aggregate GST code detection is exact `^GST(?:_|$)` and blocker order is document
allocation first, India decomposition second.

## Exact scope

- new `src/contexts/tax-fiscal/posting-plan.ts` and export-only context index update;
- new intentional-red and pure focused tests under `tests/`;
- this order, Phase7/build/decision/ledger and narrow contracts documentation.

## Forbidden

No Tx/SQL/migration/database/fact/outbox/event; no account/tx-code selection; no
ChargeService/financial service; no folio/reservation/hold consumption; no journal,
posting_line or tax_detail write; no document/series/hash/submission/provider/IRP;
no negative/correction/transfer; no residual allocation or CGST/SGST/IGST/place-of-
supply invention; no HTTP/UI/seed/local/merge/deploy/Phase/app-complete claim.

## Pre-registered proof

- P0 intentional red: module/export absent.
- P1 hostile/tampered/noncanonical snapshots reject with no input mutation.
- P2 inclusive/exclusive exact bigint signs and zero balance at boundaries.
- P3 deterministic canonical deep-freeze and fresh-byte equivalence.
- P4 document-rounding and India blockers never route-ready or invent allocations.
- P5 zero-tax, compound, 64-tax and signed-int64 bounds use no Number money.
- P6 static zero-authority proof excludes transaction, SQL, events and financial writes.
- P7 focused adjacent and standing gates are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Pure exact balanced plan and blockers are executable.
- [x] Standing proof is transcribed.
- [x] Close built-unreviewed pending independent Tier-3 product review.

## Built evidence

Intentional red first failed 0/2 on the absent module/export. Focused P0-P6 is 8/8
with 80 assertions; adjacent evaluator/attribution/plan proof is 31/31 with 252
assertions. The standing suite is 832/832 with 727 expected environment skips and
8,473 assertions across 1,559 tests/282 files. Typecheck, 93 boundaries, 23-package
licence policy, zero-vulnerability audit and diff hygiene are green. Fresh migration40
setup reaches 95 tables/85 policies with referee11/11. The disposable proof project
is removed and the sole local remained untouched.
