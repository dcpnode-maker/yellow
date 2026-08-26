# Order 186 — Approved correction and four-skin local promotion

**Status:** APPROVED LOCALLY — D-485
**Phase:** 5 · founder human testing
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** `4c3b202` (independently approved Order183 governance over approved Order185)
**Risk tier:** 3 — reversible persistent-local migration and financial UAT operation
**Owner:** Codex operations; independent non-operating post-promotion reviewer

## Outcome

Promote the exact independently approved Order183 financial correction workflow and
Order185 four-skin product to the sole founder app at `http://127.0.0.1:3000`, while
preserving the existing three-property persistent database, credentials and one-local
topology.

## Scope

- one owner-restricted, timestamped and SHA-256-hashed PostgreSQL custom backup beneath
  `D:\Yellow\backups\order186\` before any persistent database mutation;
- migration 0019 only through the approved migration runner, followed by exact no-op
  replay, schema check and referee 11/11;
- exact approved review/scenario seed reruns only to install the already-reviewed
  correction and post-seal permissions without changing credentials or scenario truth;
- build one image from this governance-only descendant of exact approved candidate
  `25f11df`, retain the prior rollback image, and replace only
  `yellow-local-current-app-1` on loopback port 3000;
- authenticated three-property, four-skin, folio statement, open-day correction and
  authorized post-seal correction smoke proof with exact immutable/balance evidence;
- this order, additive D-482, ledger, operational evidence and independent review.

No product/test/schema design beyond already approved migration0019, credential value,
password reset, second app/local, port3002, public bind, scenario regeneration,
payment, settlement, invoice/document, tax/fiscal, folio transfer/window split,
merge, push or production deployment is in scope.

## Required operation and proof

1. Preflight proves the worktree is clean, product paths are byte-equivalent to exact
   approved candidate `25f11df`, only `yellow-local-current` runs, port3000 is
   loopback-only, port3002 is unbound, and health/database/Valkey are green.
2. Build the candidate image while the approved old app remains live. Record candidate
   and rollback image digests without printing environment or credential values.
3. Create and owner-restrict a custom-format database backup; record SHA-256, byte size
   and `pg_restore --list` readability without printing catalogue contents or secrets.
4. Stop only the one app for the guarded cutover. Apply migration0019 through the
   runner; exact replay is a no-op. Run schema drift, database acceptance and fresh
   referee 11/11 before starting the candidate. Any failure restarts the retained old
   app; the backup and persistent volumes remain untouched.
5. Rerun the approved canonical review seed with protected authority. Run the scenario
   seeder's separately committed authority phase to install the exact approver-role
   grants. If later founder CRUD makes the scenario replay non-canonical, its data phase
   must fail closed; preserve that founder state and prove no scenario row was rewritten
   or regenerated. Credentials remain unchanged and permission additions are exact.
6. Start exactly one candidate app at loopback3000 over the same PostgreSQL and Valkey.
   Port3002 stays unbound. Prove health, login, three-property switcher and exact served
   four-theme assets.
7. Through authenticated HTTP, create one new governed open-day charge and correction
   in a founder-UAT folio, prove the original is byte-unchanged and the new adjustment
   exactly negates it. Prove exact post-seal role grants locally, but do not seal a
   persistent current business day for demonstration; D-481's independently executed
   fresh-database denial/approver-success is the authoritative post-seal proof. Preserve
   all resulting immutable audit/outbox/idempotency evidence.
8. Independent reviewer verifies the exact image, backup, migration ledger/schema,
   topology, UI assets, authenticated journeys, immutable ledger evidence and rollback
   image. The sole local stays running only after approval.

## Definition of done

- [x] Owner-restricted readable backup and retained rollback image are recorded.
- [x] Migration0019, exact replay, schema and referee 11/11 pass on the persistent local.
- [x] The sole loopback3000 app serves the approved four-skin correction candidate.
- [x] Authenticated three-property and open correction UAT plus exact post-seal grants
      pass without
      mutating original financial history.
- [x] Independent non-operating review approves the exact local operation.
