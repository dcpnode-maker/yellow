# Order 375 — Phase-5 independent exit gate

**Verdict:** APPROVED-CLOSED-D1112

**Activation reviewed:** `3b5ded47a117d08346ced8a6ecd2477da6e6753b`

**Frozen approved product tip:** `1f9ecf67ccbc9434e5257eafca049e1f15f5a309`

**Reviewer:** `/root/order375_pg16_final_exit`, fresh distinct non-implementing Tier 3

**Date:** 2026-09-03

## Ancestry and scope

The approved Phase-5 lineage maps the account/folio foundation (Orders103–105),
definer containment (108), immutable correction and multi-window routing (183/188),
token payment and hosted deposits (192/193), settlement/cashier/receivable/composed
journey (196–199), owner-trust negative guard (344), business-day roll (347/382),
readiness/carry lineage (349/352/355) and audited seal (356) to permanent tests and
recorded independent approvals. The activation differs from approved product tip only
in Order375/decision/ledger restart governance. Product source, tests, migrations,
schema, seed, dependencies, protected referee, UI/status/local and `.yellow` are
unchanged by this review.

## Fresh PostgreSQL and complete domain proof

Official Windows PostgreSQL 16.15 ran in a fresh SCRAM cluster with
`pg_stat_statements` preloaded. Migrations 1–65 applied and live catalogue was exactly
`65 migrations / 116 public tables / 106 RLS tables / 106 policies / 15 forced-RLS
tables / 2 security-invoker views`.

Every mapped Phase-5 suite was executed personally from the beginning:

- folios 12/0 (90), postings 10/0 (111), statements 12/0 (48), corrections 9/0
  (53), transfers 8/0 (47), row-lock authority 4/0 (23), plus the additional-window
  structural gate 1/0 (17);
- payments 10/0 (1,376), hosted deposits 10/0 (56), settlement 8/0 (49), cashier
  7/0 (34), receivable 11/0 (50), composed financial journey 7/0 (62), and owner
  trust 7/0 (33);
- day-roll plus worker 11/0 (55), a second complete roll execution 6/0 (34), close
  readiness 12/0 (102), discrepancy carry 16/0 (1,891), and audited/legacy seal
  18/0 (156);
- app-role, runtime authority/DML, extension registrar, SECURITY DEFINER and setup
  aggregation 30/0 (466).

The evidence includes 500 charges and 1,000 posting lines with zero drift and
byte-immutable originals; exact balances and linked corrections/transfers; token-only
payments; exact over/short and one-use different-user approvals; two complete repeated
twenty-contender day-roll executions; same/distinct-key carry and seal races;
unpublished-writer serialization; atomic fact/outbox/idempotency rollback and replay;
sealed ordinary-post denial with correction preservation; and hostile tenant,
property, actor, role, direct-DML and `pg_temp` attempts with zero unauthorized effect.

## Permanent and repository gates

- migration regression: **39/0 (187 assertions)**, including SCRAM wrong-password
  SQLSTATE `28P01`;
- a separate canonical-seed database: **23/0 (65 assertions)**;
- normalized PostgreSQL16.15 schema: byte-identical SHA-256
  `a5efaaae5ad3d2315cf2fc62a7dd2352e3992b9643f91784ca70994d1f89e8a9`;
- standing: **1,225/0**, 956 expected database skips, **18,611 assertions** across
  402 files;
- typecheck, 140-file import boundaries, 23-package licence policy, zero-vulnerability
  audit, diff hygiene and exact product-tip scope: green;
- a newly created, migrated and fixture-loaded referee database: **11/11**.

One initial database was discarded after reviewer configuration pointed the transfer
suite at the deployment role and ran fixture-heavy files in parallel. Those failures
were harness-caused, that server/root was destroyed, and none of its results were
used. The accepted review restarted from item 1 on a new cluster and ran fixture-heavy
suites sequentially with the governed runtime role.

## Boundaries and residual truth

The accepted PostgreSQL server was stopped, its port refused connections, the exact
disposable root was removed, and no WSL crash path was created. Docker, port 3000,
the stable local, `.yellow`, deploy, merge and push surfaces were untouched.

Phase 5's documented domain contract is independently reviewed. The application is
not complete: `TrustAccountingService`, `BusinessDayCloseReadinessService`,
`BusinessDayDiscrepancyCarryService` and `BusinessDaySealService` remain unwired in
the operator API/UI/status/local app. Their delivery remains separately governed.
