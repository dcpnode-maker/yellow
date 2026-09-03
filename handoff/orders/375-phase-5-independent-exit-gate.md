# Order 375 — Phase-5 independent exit gate

**Status:** CHANGES-REQUIRED-D1075
**Phase:** 5 — Financials
**Branch:** `phase-5/exit-gate`
**Base:** exact independently approved Order356 tip
`c164056e1b17735f7f9527065271a99750e5839d`
**Risk tier:** 3 — aggregate immutable-money and business-day closure review
**Owner:** Codex coordination; fresh non-implementing Tier-3 reviewer executes proof

## Outcome

Independently execute the complete already-built Phase-5 v1 contract at the exact
approved frontier and decide the phase exit. This order adds no product behavior.
Any reproducible failure withholds approval and opens a separately scoped repair;
the reviewer does not repair its own finding.

The approved ancestry is the account/folio foundation, balanced posting, statements,
correction and multi-window transfer, token-only payments and hosted deposits,
settlement/cashier/receivable paths, composed financial journey, owner-trust negative
guard, property-local day roll, complete close readiness, discrepancy carry lineage
and the audited exact-property one-way seal through D1068. Later real PSP settlement,
refund/chargeback expansion, tax/fiscal issue, checkout, full AR, trust payouts and FX
are not silently imported into Phase 5.

## Exact scope

- this order and `handoff/reviews/375-phase-5-independent-exit-gate.md`;
- approval-status-only wording in `BUILD-PLAN.md`, `handoff/PHASE-5-PLAN.md` and
  `handoff/ROADMAP.md` after executable approval;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No source, test, migration, schema, permission, seed, dependency, HTTP/UI, local,
Docker or `.yellow` change is admitted. `migrations/0001_init.sql` remains immutable.
Founder-status reconciliation and single-local promotion are separate orders because
recorded source truth, browser availability and runtime deployment are distinct facts.

## Reviewer-personal proof

1. Prove exact approved ancestry and map every Phase-5 DoD item to its owning product,
   test and independent approval; stale intermediate headings cannot substitute for
   recorded decisions.
2. On a fresh disposable PostgreSQL frontier apply migrations 1–64 and prove exact
   catalogue `64/116/106/106/15/2`, schema, RLS, runtime DML and definer containment.
3. Execute the real account/folio/window → balanced charge → immutable correction or
   transfer → token capture or receivable exact-zero → settle/close journeys, including
   approval and concurrency hostility, one effect and canonical balances.
4. Execute payment/deposit and cashier hostility: token-only evidence, replay/races,
   blind counts, exact over/short approval and no hidden balancing.
5. Execute owner-trust hostility: derived balance, different-user one-use negative
   approval, and self/foreign/stale/raw-DML zero-write rejection.
6. Execute day roll → complete readiness/carry lineage → direct exact-property audited
   seal, including unknown/fail-closed attribution, strict lag, legacy/direct-DML
   containment, unpublished-writer serialization, same/distinct-key races, atomic
   fact/event/replay/rollback, sealed ordinary-post denial and correction preservation.
7. Prove unbalanced journal rejection at commit, 500 charges/1,000 posting lines with
   zero drift, originals byte-immutable, and hostile tenant/property/actor/role/pg_temp
   attacks with zero unauthorized effect.
8. Run the full standing, type, boundary, licence, audit, schema/acceptance/authority
   and fresh referee `11 passed, 0 failed of 11` gates. Preserve the stable local and
   remove all newly created disposable resources.

## Forbidden

- product/test/migration/schema/scope/seed/dependency fixes inside this review order;
- real PSP, refund/chargeback, fiscal/invoice/tax, checkout/account/reservation closure,
  full AR invoices/allocation/aging/statements, trust payouts/splits, FX or new policy;
- UI/status/local refresh, second local, deployment, merge, push or application-complete
  claim;
- self-review, pasted implementer output, skipped database proof or waiving a failed
  invariant/referee assertion.

## Definition of done

- [x] Exact D1068 frontier and complete approved Phase-5 ancestry are bound.
- [ ] Every documented Phase-5 v1 DoD item has reviewer-personal executable evidence.
- [ ] Fresh database catalogue, hostile authority, concurrency and immutable-money
      preservation gates pass.
- [ ] Standing/static/schema/referee gates pass without waiver.
- [ ] A fresh non-implementing Tier-3 reviewer records an exact verdict and teardown.
- [ ] Only after approval, authoritative plans state Phase 5 reviewed while separately
      naming unwired UI/status/local work truthfully.

## Full restart authority — D1074

Order376 is independently approved and closed at D1073 after fresh posting10/0(111)
on the exact catalogue. Order375 therefore restarts from item1 under a different fresh
non-implementing Tier3 reviewer at exact tip
`91fbe1facba34a3edac24e0a08bf974e267da44c`; no D1070 partial output is reused as the
exit verdict.

## Full-rereview finding — D1075

The distinct fresh Tier3 reviewer restarted at activation
`dd09ac24e776398dfb452365f07d2a10e26bcd00` and product frontier
`91fbe1facba34a3edac24e0a08bf974e267da44c`. Fresh native PG17 applied all 64
migrations. The first financial batch passed 53/0, including the complete folio,
posting, statement, correction and multi-window transfer proofs. The next batch
found two deterministic stale catalogue assertions:

- `tests/financial-owner-trust.integration.test.ts:50` expects `115` tables and
  `105` policies; the required fresh frontier returns `116` and `106`;
- `tests/financial-payments.integration.test.ts:243` expects `89/79/79`
  tables/RLS/policies; the required fresh frontier returns `116/106/106`.

The payment failure reproduced in isolation. The trust failure reproduced on a
second newly migrated 64-migration database, excluding fixture residue. Functional
cases completed before the stop were green, but this review cannot repair or waive
either red. Remaining aggregate/static/referee proof was stopped. A separate bounded
oracle-repair order and another distinct full rereview are mandatory; Phase5 remains
unapproved.
