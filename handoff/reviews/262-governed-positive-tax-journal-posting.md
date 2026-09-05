# Review 262 — Governed positive-tax journal posting

**Reviewer:** independent non-implementing Codex Tier-3 reviewer (`/root/order262_independent_review`)
**Decision:** APPROVED
**Date:** 2026-08-29
**Reviewed commit:** `648935d9fef1e2498e0abfb070e547aac516b094`
**Reviewed base:** `dff2302`
**Authority:** Order262 / D-678 / D-679 only

## Verdict and findings

APPROVED. No blocking Order262 product finding.

The exact commit implements only the governed, already-quoted, already-reserved,
primary-folio-eligible, explicitly routed, positive line-rounded non-India posting
path. The caller supplies identity, idempotency and the fixed audit envelope only.
The service derives and rechecks lineage, folio, accounts, transaction codes, routes,
amounts, currency and property-local business date before creating one balanced
charge journal. The root guest line alone carries canonical minimized tax evidence;
all credit lines retain null `tax_detail`. One immutable journal binding, one
`journal.posted` fact/outbox pair, one `tax.attribution_posted` fact/outbox pair and
the idempotency receipt commit atomically.

Document rounding and India/aggregate-GST truth remain ordered policy blockers and
write nothing. Negative tax, correction/reversal, fiscal documents, numbering/hash
chains, IRP/provider work, payments, settlement, transfer, HTTP/UI, local promotion,
merge, deployment, Phase7 completion and application completion remain outside this
approval.

One nonblocking historical-test note was reproduced. On an otherwise clean
migration-44 database, `tests/financial-postings.integration.test.ts` passed all nine
ordinary-charge behavioral cases, including 500 charges / 1,000 balanced immutable
lines with zero drift, but its old P1 table-count assertion still expects 87 rather
than the canonical 98 tables. Result: **9 passed, 1 failed, 102 assertions**. The
failure is the literal stale count at line 194; it is not an Order262 behavioral or
schema defect. Fresh acceptance, live catalog and exact schema-snapshot proof below
all independently establish 98 as the current required count.

## Production diff inspection

- `git status --short` was empty; branch and head were exactly
  `phase-7/positive-tax-journal-posting` / `648935d9fef1e2498e0abfb070e547aac516b094`.
- `git diff --name-status dff2302..648935d` was confined to the 17 files admitted by
  Order262. `git diff --check dff2302..648935d` passed.
- Migration0044 SHA-256 is exactly
  `c678ef9bf25e5da20298a9dada22ef5f0af7b441cb4f17659ded96c628e6ac86`.
- `tax_attribution_journal_binding` starts with `tenant_id`, has tenant-leading
  primary/unique/index shapes, exact tenant/property/lineage/account/folio/journal
  composite foreign keys, canonical hash/currency/date checks and transaction-local
  tenant RLS using `current_setting('app.tenant_id', true)`.
- `app_role` has SELECT only on the binding table and no binding mutation. It has no
  `posting_line.tax_detail` INSERT or UPDATE authority. `yellow_runtime`, PUBLIC and
  direct app mutation remain denied.
- Both new functions are `yellow_owner`-owned SECURITY DEFINER capabilities with
  `search_path=pg_catalog, public, pg_temp`. Direct runtime and PUBLIC execution are
  denied. Each requires the exact `yellow_runtime` session, `app_role` current role,
  owner execution identity and matching transaction-local tenant context.
- The lock capability accepts only 2–66 distinct non-null guest/revenue/tax-payable
  account ids, locks every open account in global UUID order, then locks the exact
  open primary folio. Missing, duplicate, wrong-role, closed or foreign targets fail
  closed.
- The binding capability serializes by immutable lineage, revalidates the canonical
  snapshot, non-India/line-rounding policy, complete route set, primary folio, charge
  header, open business day and complete null-tax credit-line set. It proves sequence
  1 is absent, inserts that guest root once, then appends the binding. It performs no
  posting-line UPDATE or DELETE.
- The TypeScript service performs read-only policy discovery before idempotency,
  repeats discovery inside the callback, sorts/deduplicates every financial account,
  invokes the bounded lock, requires byte-equivalent locking resolution, locks and
  rechecks the property-local business day, and performs a final route comparison
  before the journal write.
- Same-key replay uses the durable receipt. Different keys converge through the
  immutable lineage binding. Policy changes, route/account/folio/day races and any
  publication failure abort the transaction rather than leaving a pending receipt or
  partial journal/evidence set.

## Personally executed isolated proof

All successful database proof used only:

- Compose project `yellow262-tier3-review-829a`;
- app/PostgreSQL/Valkey host ports `32162` / `55462` / `64862`;
- volume `yellow262-tier3-review-829a_yellow-pgdata`;
- exact branch worktree named above.

For every successful setup invocation, the non-secret isolation exports were made
inside the same WSL bash process. Both the wrapper and `setup.sh` printed the exact
unique project and ports before Compose. Protected authority values were sourced
inside the process and were never printed or placed in the review record.

Reviewer-executed results:

- `./setup.sh --db-only`: migration0044 applied, **98 public tables**, **88 RLS
  policies**, and invariant referee **11 passed, 0 failed of 11**. The isolated setup
  was repeated during the independent proof and remained 11/11.
- `bun test tests/positive-tax-posting.integration.test.ts` with deploy/runtime split:
  **9 passed, 0 failed, 70 assertions**.
- Order251/256/259 adjacent plan, folio and semantic-route proof:
  **21 passed, 0 failed, 242 assertions**.
- `bun test tests/database-acceptance.integration.test.ts`:
  **11 passed, 0 failed, 26 assertions**.
- `bun test tests/migrate.integration.test.ts`:
  **38 passed, 0 failed, 169 assertions**.
- `bun test tests/schema-drift.test.ts`:
  **4 passed, 0 failed, 19 assertions**.
- Live `pg_dump --schema-only --no-owner --no-comments`, normalized by the production
  schema functions and compared byte-for-byte with `tests/schema/expected.sql`:
  **exact match**.
- Final direct disposable catalog: **98 tables | 88 policies | 44 migration rows |
  exactly one version-44 row**.
- Clean migration-44 correction proof:
  **9 passed, 0 failed, 53 assertions**.
- Clean migration-44 folio-statement proof:
  **12 passed, 0 failed, 48 assertions**.
- Standing repository suite: **841 passed, 0 failed, 765 environment skips, 8,515
  assertions across 1,606 tests in 289 files**.
- `bun x tsc --noEmit`: pass.
- `bun run boundaries`: pass, **96 TypeScript files scanned**.
- licence policy: pass, **23 installed packages**.
- dependency audit: **no vulnerabilities found**.
- `git diff --check dff2302..648935d`: pass.

The focused proof personally exercised exact one-tax balance and root-only evidence;
zero/multiple taxes and shared liability accounts; every registered policy blocker
with no idempotency or domain write; hostile caller/actor/tenant/property/route
authority; twenty-way same-key replay; twelve different-key lineage convergence;
failure after real outbox insertion and exact retry; account, folio, route and
business-day races; shared-account and ordinary-charge contention without SQLSTATE
40P01; exact RLS/ACL/definer path; forged app-role taxed-line denial; cross-tenant
binding invisibility; binding UPDATE denial; and taxed correction rejection with
byte-exact zero effects.

## Stable migration0044 disclosure assessment

The builder disclosed that an earlier setup shell inherited the stable Compose
identity and appended migration0044 to stable `yellow_dev`. Static inspection confirms
migration0044 is forward-only additive DDL: it adds two identity constraints, one
append-only table, indexes, RLS/policy, two bounded functions and exact ACLs. It has no
product-row INSERT/UPDATE/DELETE, seed, app-image, cache or local-status operation.
The append nevertheless changed stable schema and means any later guarded local
reconciliation must treat migration44 as already applied rather than attempt an
unreviewed rollback or duplicate application. This review did not query or mutate the
stable database to re-prove the builder's disclosed row-level claim.

Before reviewer setup, a read-only container listing showed the stable app,
PostgreSQL and Valkey ids `d23532f1782a`, `b0a92182a16a` and `ae62afc8df69` healthy on
ports 3000, 5442 and 6389. The review then caught a separate harness isolation
incident: PowerShell-only environment assignments did not cross into WSL, so one
`setup.sh --db-only` attempt printed the stable fallback identity and issued Compose
start operations for the stable PostgreSQL/Valkey containers. It stopped immediately
at the required-authority check before provisioning, migration, seed, SQL, referee or
app operations. The incident was reported to the coordination owner immediately; no
further stable command was executed. Continuation used only in-process WSL exports
and required `setup.sh` itself to print the unique identity before Compose.

A later focused attempt run after its WSL process had exited produced **1 pass / 2
connection-closed failures** because that disposable WSL Docker daemon had stopped;
it created no domain effects. The valid focused proof reran setup and all nine tests
inside one continuous isolated process and is the 9/0 result recorded above.

## Cleanup and repository containment

Cleanup first resolved exactly **2 containers and 1 volume** carrying the disposable
project label. `docker compose down -v --remove-orphans` ran only with
`COMPOSE_PROJECT_NAME=yellow262-tier3-review-829a` and the unique ports exported in the
same WSL process. Final label queries returned **0 containers, 0 volumes and 0
networks** for that project. The exact temporary Bun link and review logs were also
removed.

Apart from this review record, the reviewer changed no repository file and performed
no Git mutation.
