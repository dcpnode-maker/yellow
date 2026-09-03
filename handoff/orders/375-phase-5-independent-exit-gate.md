# Order 375 — Phase-5 independent exit gate

**Status:** ACTIVE-FULL-REREVIEW-AFTER-SETUP-D1097
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

## Final full restart authority — D1079

Order377 is independently approved at D1078 after fresh complete trust/payment
17/0(1,407) on exact migration64 truth. Order375 again restarts from item1 under a
new distinct reviewer at exact tip `4ce9732`; neither D1070 nor D1075 partial output
is reused as the exit verdict.

## Final-rereview finding — D1080

The new distinct Tier3 reviewer restarted at exact activation `c9e225d` and frozen
product frontier `4ce9732` on a fresh Windows-native PostgreSQL17 cluster. Migrations
1–64 applied; the complete first two financial batches passed 53/0(362) and
58/0(1,701). The day-close batch then reproduced a stale strict catalogue assertion:
`tests/business-day-discrepancy-carry.integration.test.ts:908` expects 63 migration
rows while the exact frontier returns 64; its 116-table, 106-RLS, 15-force and 2-view
values remain exact. Order375 cannot repair or waive this red. Remaining gates stop
unclaimed; a bounded oracle repair and another distinct from-item1 review are
mandatory. Phase5 remains unapproved.

## Full restart after carry-oracle approval — D1084

Order378 is independently approved and closed at D1083 after a fresh complete carry
proof of 16/0 (1,891 assertions) on exact catalogue `64/116/106/106/15/2`. Order375
therefore restarts again from item1 at exact approved tip
`c84ab29f46541c58770b3a671f82b28e2bacf633` under a new distinct non-implementing
Tier3 reviewer. No partial result from D1070, D1075 or D1080 is reused as the exit
verdict. Every reviewer-personal proof item above remains mandatory.

## Full restart after app-role-oracle approval — D1089

Order379 is independently approved and closed at D1088 after fresh app-role
containment proof 5/0 (25 assertions) on exact catalogue `64/116/106/106/15/2`.
Order375 restarts from item1 at exact approved tip
`ac87eea22268d80d8d73727908ff042b7ee7cda1` under another distinct non-implementing
Tier3 reviewer. No previous partial output is reused as the exit verdict; every
reviewer-personal proof item remains mandatory.

## Full restart after setup-oracle approval — D1097

Order381 is independently approved and closed at D1096 after the complete focused
setup catalogue proof passes on derived `64/64/116` truth. Order375 restarts from
item1 at exact approved tip `578ea1e3e6edf13e47bcc65fc28760c90ff9413f`
under another distinct non-implementing Tier3 reviewer. No prior partial output is
reused; every reviewer-personal proof item remains mandatory.

## Post-carry full-rereview finding — D1085

The fresh distinct Tier3 reviewer restarted from item1 at exact activation
`94431ca2c30761f093fdcb3d20b631c0408b1c3c` and approved product ancestry
`c84ab29f46541c58770b3a671f82b28e2bacf633`. A fresh native PG17 frontier applied
migrations 1–64 and returned exact `64/116/106/106/15/2`. Complete financial,
payment/trust/cashier/journey and day-close batches passed before the authority batch
reproduced one deterministic stale strict oracle:
`tests/app-role-nonlogin.integration.test.ts:232` expects `89/79/79` tables/RLS/
policies while live migration64 truth is `116/106/106`. Order375 cannot repair or
waive this red. Remaining standing/static/acceptance/referee completion is unclaimed;
a bounded oracle repair and another distinct full restart are mandatory. Phase5 and
the separately unwired operator API/UI/status/local remain unapproved.

## Final full-rereview finding — D1090

The fresh distinct Tier3 reviewer restarted from item1 at exact activation
`7b0864fbcb466cd7260a7ae188318c0e8ea17e85` and approved product ancestry
`ac87eea22268d80d8d73727908ff042b7ee7cda1`. Fresh native PostgreSQL17 applied
migrations1–64 and exact catalogue `64/116/106/106/15/2`. Complete financial57/0
(362 assertions), payment/trust/cashier/journey55/0 (1,636), day-close56/0 (2,191)
and authority/catalogue17/0 (374) proofs pass. The full standing suite then reproduces
one stale permanent oracle: `tests/setup-current-catalogue-oracle.test.ts:15` derives
migration count/highest `64/64` but expects `63/63`; standing is1,224 pass,956 expected
skips,1 fail (18,606 assertions). Order375 cannot repair or waive this red. Remaining
static/acceptance/referee completion is unclaimed; a bounded repair and another
distinct full restart are mandatory. Phase5 and the four unwired operator services
remain unapproved.
