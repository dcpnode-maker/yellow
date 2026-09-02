# Order 371 — Current post-carry setup catalogue oracle repair

**Status:** APPROVED-D1048 — exact candidate `8d96974`
**Phase:** 5 — Financials
**Branch:** `phase-5/current-post-carry-setup-catalogue-oracle-repair`
**Base:** exact independently approved Order 368/366/363/359/351 frontier `9a88152` / product candidate `5b9b9dd`
**Risk tier:** 3 — permanent referee catalogue oracle
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Repair the canonical `./setup.sh --db-only` catalogue assertion so it checks the
actual governed discrepancy-carry frontier: migrations 1–63 produce exactly 116
public base tables. Preserve every other setup, migration, seed, authority and
11/11 invariant-referee behavior byte-for-byte.

This is an oracle correction only. It creates no migration, table, policy, role,
permission, service, event, API, UI or runtime behavior.

## Activation prerequisites

Activation is forbidden until a fresh independent Tier-3 verdict approves the exact
Order 368/366/363/359/351 candidate and records the resulting commit frontier. Before
editing, re-read the live catalogue and prove exactly:

- 63 applied migrations;
- 116 public base tables;
- 106 tenant-RLS tables and policies;
- 15 FORCE-RLS tables; and
- 2 security-invoker views.

The current stale assertion is in `setup.sh`: it expects 115 public tables after
migrations 1–62 although migration 0063 is now in the canonical runner. Creation of
this draft is not activation authority and grants no edit before the prerequisite
verdict.

## Activation — D1046

Fresh independent D1043 approval binds the governed carry product candidate
`5b9b9dd3f18b3bdb8f9cfd6dc7fdeb69684888f3` and governance frontier `9a88152`.
Reviewer-personal official PostgreSQL 16.15 proof derives exactly 63 migrations, 116
public base tables, 106 tenant-RLS tables/policies, 15 FORCE-RLS tables and 2
security-invoker views, while migration, acceptance, authority, schema, standing and
referee gates are green. The only admitted production edit is therefore the exact
stale setup catalogue literal/text correction described below, preceded by an
intentional red against the unmodified script.

## Exact scope

- `setup.sh`, limited to the exact public-table and migration-range literals plus
  their matching success/error text;
- one permanent source/behavior oracle test only if none currently loads and checks
  these exact setup literals against the authoritative migration catalogue;
- this order, its review evidence, `DECISIONS.log` and `handoff/LEDGER.md`.

Any other file requires a recorded pre-edit amendment. `migrations/0001_init.sql`,
all other migrations, schema snapshots and product code are forbidden.

## Executable proof

1. On the exact approved activation frontier, prove the unmodified setup gate fails
   only because PostgreSQL returns 116 while the script requires 115.
2. Derive the expected public-base-table count and highest migration from the fresh
   live catalogue and canonical migration files; do not merely copy draft prose.
3. Change only `115→116` and `1-62→1-63` in the exact setup assertion/error/success
   strings required for coherence.
4. Run fresh `./setup.sh --db-only` and obtain exactly `11 passed, 0 failed of 11`.
5. Run migration 39/0, database acceptance 23/0, runtime authority, runtime DML,
   SECURITY DEFINER, exact schema, seeds, standing/static/licence/audit gates.
6. A fresh independent non-implementing Tier-3 reviewer personally derives the
   catalogue and executes setup/referee on the exact candidate before approval.

## Forbidden

- weakening/removing/dynamically bypassing the exact table-count assertion;
- changing any migration, schema object, ACL, policy, runtime, seed or invariant;
- Docker/local/`.yellow`/port3000 mutation, promotion, merge, push or deployment;
- Phase 5 or application completion claims.

## Definition of done

- [x] Activation records the exact approved post-Order368 frontier and catalogue.
- [x] Intentional red proves only the stale 115/1–62 setup oracle.
- [x] The exact minimal setup literals match 116/1–63 with all other bytes preserved.
- [x] Builder fresh setup/referee and complete preservation gates pass.
- [x] Fresh independent Tier-3 approval is recorded.

## Builder evidence — D1047

Exact candidate `8d969744a38370cab5637338305099261da04049` changes only the
two setup oracle/text lines and one permanent catalogue-derived test. Before the
setup edit, the corrected test is red 0/1 after deriving 63 migration files, highest
migration 63 and 116 `CREATE TABLE public.*` statements from the canonical expected
schema; it fails only because setup still requires 115/1–62. After the edit it passes
1/0 with five assertions.

A disposable, separately named proof stack on PostgreSQL port 5551 and Valkey port
6391 applies all 63 migrations to both development and referee databases, observes
`yellow_test tables: 116 after migrations 1-63`, and prints exactly **11 passed, 0
failed of 11**. Full standing is **1217/0** plus 946 expected database skips and
18,524 assertions across 400 files. Typecheck, 139 import boundaries, 23-package
licence policy, production audit zero and diff hygiene pass. The exact proof
containers, network, volume and D: worktree were removed; stable port3000, Docker
resources and protected `.yellow` were untouched. Fresh independent Tier-3 review
remains mandatory.

## Fresh Tier-3 approval — D1048

Fresh independent non-implementing Tier-3 `/root/order371_fresh_tier3` approves exact
product candidate `8d969744a38370cab5637338305099261da04049` at governance frontier
`17080f983ebe936c3fceabe18f00793143fc642b`. Reviewer-personal proof reproduces the
stale setup red only at 116-versus-115, restores the exact candidate, obtains focused
1/0 (5), fresh setup/referee 11/11 and official upstream PostgreSQL 16.15 truth
63/highest63/116/106/106/15/2. Migration39/0, acceptance23/0, runtime-DML5/0,
SECURITY-DEFINER3/0, seeds10/0+24/0, exact schema, standing1217/0+946 skips (18,524),
type/boundary/licence/audit/diff gates are green. Approval is limited to the setup
catalogue oracle repair and grants no migration, schema, runtime, local or downstream
authority.
