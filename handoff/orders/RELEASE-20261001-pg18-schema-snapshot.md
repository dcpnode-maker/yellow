# RELEASE-20261001 — pinned PostgreSQL 18 schema snapshot

Basis: f610a9264840cbbf8d4ea05b29852889e0115e6f, tree f810a9d36276a8891b55209fcc5d3d22a9d19451.
Laptop remains source/controller/final integrator. Cloud owns this bounded CI repair.

## Verified failure and diagnostic gate

Official CI 36827406928 passed five platform jobs, all preceding fiscal and
compatibility proofs, migrations 100, seed and deployment acceptance 24/0/75.
The unchanged schema check then rejected line 6: expected PostgreSQL 16.15,
actual pinned PostgreSQL 18.6. Its original failed receipt remains preserved.

Full comparison, not header-only suppression, accounts for every difference:
two version headers, one transaction_timeout setting and 239 nondefault named
NOT NULL clauses on 25 tables. Diagnostic-only back-projection matches all other
parent bytes. Catalog evidence maps all 239 validated single-column constraints.
All function, ACL, RLS, policy, index and other object blocks are byte-identical.
The implementation copies the entire exact fresh canonical PG18 dump. It does
not strip those names, settings or headers from the production drift checker.

## Exhaustive scope

- tests/schema/expected.sql: exact normalized schema from fresh canonical
  migrations 1–100 on the already pinned PostgreSQL 18.6 image.
- This order, handoff/questions/RELEASE-20261001-pg18-schema-snapshot.md,
  handoff/reviews/RELEASE-20261001-pg18-schema-snapshot.md.
- Append-only DECISIONS.log and handoff/LEDGER.md.

No helper, normalizer, schema-check script, test, referee, migration, product or
CI changes. Parent PG16 snapshot remains in immutable Git and recovery archives.
If another path becomes necessary, record an explicit scope amendment before
editing. No new migration number, business data or credential transfer, laptop
overwrite, assertion/deadline waiver, paid fallback, self-merge or deployment.

## Independent executable proof

A non-implementer personally reproduces the unchanged baseline CLI failure on
a second fresh canonical100 target, then requires two unchanged CLI captures to
match the candidate byte-for-byte. Validate all100 ledger filenames/checksums,
130 public tables, 120 RLS tables and both views' security-invoker setting.
Temporarily change the fixture for NOT NULL, RLS, ACL, column, index and function
body drift: all six unchanged CLI checks must reject; restore exact candidate
bytes after each and prove the final CLI green. Complete current deployment,
review-fixture and runtime CI proofs locally, plus unchanged setup.sh --db-only
11/11, types, boundaries and default standing. Use absent, created-only scratch
targets; verify exact owned app pause/restore, retained synthetic schema/data and
cluster-role preservation. Source publication is bounded approval; successor CI,
dirty laptop integration, secure hosting and business-data restore remain gates.
