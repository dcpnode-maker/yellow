# Order 277 — Reconcile the Order276 canonical setup table-count oracle

**Status:** APPROVED-D725
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/order276-setup-oracle`
**Base:** `fcdec1f` (Order276 CHANGES-REQUIRED evidence descendant)
**Risk tier:** 3 — mandatory Tier-3 gate reconciliation; fresh independent execution mandatory
**Owner:** Codex implementation

## Outcome

Make the canonical isolated `./setup.sh --db-only` gate recognize exact committed
migration truth after Order276: 48 migrations and 100 public tables, followed by the
unchanged 11/11 invariant referee. This repairs proof orchestration only; it changes no
product, migration, schema, data, authority, runtime or local application.

## Exact scope

- `setup.sh` exact public-table count and adjacent human-readable message only;
- Question178, this order, BUILD-PLAN/Phase7/ROADMAP, decision and ledger;
- later Order277 build and independent review evidence.

## Forbidden

No migration/schema/snapshot/referee/test/product/source/dependency/setup sequencing/
credential/port/provision/seed/database/runtime/local/status/UI/API change; no count
range or lower-bound weakening; no Order276 approval before fresh independent Tier-3
execution; no merge/public deploy/Phase7/application-complete claim.

## Pre-registered proof

1. D-722 reviewer-personal canonical red is the intentional pre-change proof: the
   command applies1–48/reaches100 then exits1 on exact stale99-after1–47 text.
2. Diff proves only both exact setup literals change to100/1–48.
3. Fresh isolated `./setup.sh --db-only` exits0, records exact48/100 and prints
   `11 passed, 0 failed of 11` without starting an app.
4. Standing test/type/boundary/licence/audit/diff gates remain green.
5. Reviewer and coordinator disposable proof is removed; sole local3000 is untouched.
6. Fresh non-implementing Tier-3 reviewer personally executes the complete proof and
   records whether Order276 may be approved.

## Definition of done

- [x] Exact two-literal setup correction is committed.
- [x] Fresh canonical setup/referee and standing/static proof are green.
- [x] Fresh independent Tier-3 approval of the corrected Order276 descendant is recorded.
