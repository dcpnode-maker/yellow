# Order 371 — Current post-carry setup catalogue oracle repair

**Status:** DRAFT — activate only after Order 368's fresh verdict
**Phase:** 5 — Financials
**Branch:** `phase-5/current-post-carry-setup-catalogue-oracle-repair`
**Base:** activation must bind the exact independently approved Order 368/366/363/359/351 frontier
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

- [ ] Activation records the exact approved post-Order368 frontier and catalogue.
- [ ] Intentional red proves only the stale 115/1–62 setup oracle.
- [ ] The exact minimal setup literals match 116/1–63 with all other bytes preserved.
- [ ] Fresh setup/referee and complete preservation gates pass.
- [ ] Fresh independent Tier-3 approval is recorded.
