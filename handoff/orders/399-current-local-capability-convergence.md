# Order 399 — Current local capability convergence

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D1169
**Phase:** 7 — founder-review runtime reflection prerequisite
**Base:** exact approved runtime source `d1f6f45`, retained migration-68 local
**Risk tier:** 3 — local authorization reconciliation for financial workspaces

Reconcile only the canonical local review roles that predate migrations 0060–0068 so
the already approved business-day and owner-trust workspaces can be exercised in the
sole founder-review local without reseeding, replacing hotel data or weakening the
product authorization boundary.

## Exact scope

- add one narrowly guarded, idempotent local-review permission reconciliation script,
  one package command, focused upgrade-compatibility proof and a bounded recovery note;
- require exact singleton canonical tenant, users and role identities plus the existing
  exact two-property role assignments before mutation; ambiguity or drift fails closed;
- catalogue only missing `financials.trust:post` and
  `financials.trust:approve-negative` with their canonical descriptions;
- grant the ordinary `Local Availability Reviewer` only
  `financials.trust:post`, `financials.business-days:read`, `business_day.seal`,
  `financials.business-days:seal` and the existing carry-maker permission;
- grant `Local Post-Seal Financial Approver` only the approved checker/read subset,
  including `financials.trust:post`, `financials.trust:approve-negative`,
  `financials.business-days:read` and the existing discrepancy-carry checker;
- explicitly prove the specialized checker has neither seal permission nor the
  discrepancy-carry maker permission; preserve every unrelated permission and grant;
- execute one transaction against the sole local only after the protected Order398
  backup, record exact before/after row identities, prove a zero-change rerun, then
  obtain a fresh login token and verify both properties' bounded workspaces;
- record rollback rows and fresh non-operating Tier-3 review before Order398 may close.

## Exact file allowlist

- `scripts/reconcile-local-review-permissions.ts`
- `package.json`
- `tests/local-review-permission-reconciliation.integration.test.ts`
- `docs/LOCAL-REVIEW.md`
- this order, its review, `handoff/LEDGER.md`, `DECISIONS.log`

## Forbidden

No broad review seed, credential read/print/rotation, hotel/financial/fiscal fact
mutation, new product capability, global migration, schema/RLS change, second UI local,
second persistent database, port/public/deploy/merge/push action or phase-completion
claim. Existing JWTs remain stale by design and must not be rewritten; fresh login is
required. No permission or role outside the exact named guarded set may change.

## Required proof

Intentional red must reproduce a migration-59-era local upgraded through 0068 without
reseeding. The focused proof must establish exact identity guards, missing-catalogue
repair, exact maker/checker grants and exclusions, unrelated-row preservation,
transactional failure, idempotent zero-change rerun and fresh-token scope behavior.
Runtime proof must show the original 403 scope gap, fresh login success, both-property
containment, authorized close-workbench handling (200 where configured or bounded 404
where the identity-gate property intentionally has no business day), owner-trust GET
success, unchanged two-hotel/scenario truth and one healthy loopback-3000 app. A fresh
independent reviewer that neither authored nor ran the reconciliation must personally
verify database and runtime postconditions.
