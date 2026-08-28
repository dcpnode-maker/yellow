# Order 254 — Reconcile Order252 migration lineage forward-only

**Status:** APPROVED-D661
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/reconcile-order252-migration-lineage`
**Base:** `2f58a6f` (built Order253 descendant of approved Order252)
**Risk tier:** 3 — immutable migration lineage and governed function authority
**Owner:** Codex implementation; independent Tier-3 execution required before approval

## Outcome

Make repository migration history exact to the already-applied sole-local history
without changing the migration ledger, then carry the reviewed Order252 no-binding
compatibility correction in a new forward-only migration. Fresh databases and the
retained local database must converge to one exact final schema and behavior.

## Fixed incident truth

During Order252 proof setup, the retained local PostgreSQL service was recreated over
its retained volume and an earlier draft of migration0041 was applied before the
final compatibility correction was committed. The live ledger correctly records
SHA-256 `96795066ed0ae795044a56c7fbef33087e8c7fa94647b22482ee6b48ed06f171`.
The exact historical bytes were recovered by swapping the authority-check and
binding-lookup blocks in the committed file; the recovered candidate matches that
64-character digest exactly and its live function body.

## Exact scope

- restore `migrations/0041_quoted_tax_reservation_lineage.sql` byte-for-byte to the
  applied historical checksum above;
- add `migrations/0042_quoted_tax_reservation_no_binding_compatibility.sql` as the
  forward-only replacement of only `link_tax_attribution_reservation`, moving the
  no-binding zero-row return before product authority checks while preserving owner,
  signature, ACL, search path and all bound-path behavior;
- exact migration ledger/acceptance, focused lineage/regression proof,
  `tests/schema/expected.sql` and `setup.sh` migration42/96 oracle;
- this order, decision, ledger, Phase7/build/roadmap and narrow contract evidence.

## Forbidden

No migration-ledger checksum rewrite/override/ignore; no table/data/credential/seed,
reservation/public-response, folio/routing/posting/document/India-policy, HTTP/UI,
dependency, local mutation/promotion, second local, merge, public/production deploy,
Phase7 or application-complete change.

## Required proof

1. Recovered migration0041 exact SHA-256 is `96795066…f171`; migration0042 has its
   own exact committed checksum and applies once.
2. Fresh migrations1–42 yield exactly 96 public tables, 86 tenant RLS policies and
   referee 11/11 with exact generated schema and migration ledger.
3. Existing historical-0041 database accepts the production runner and applies only
   migration0042; rerun is a no-op and prior ledger rows remain byte-exact.
4. Unquoted held/direct reservation compatibility, exact quoted lineage,
   replay/rollback/tenant/ACL containment and affected regressions stay green.
5. Independent Tier-3 reviewer personally executes the forward-upgrade and fresh
   proof before approval.

## Definition of done

- [x] Historical bytes and target digest are independently reproduced.
- [x] Fresh and forward-upgrade paths converge to the exact final schema.
- [x] Standing/static/referee gates are green.
- [x] Independent Tier-3 review records approval or findings.

## Closure

D-660 records restored migration0041 SHA-256 `96795066…f171`, forward-only
migration0042 SHA-256 `dd2622f…c098`, fresh 1–42 at 96 tables/86 policies/referee
11/11, historical 41→42 applying exactly one file then no-op, exact final schema,
affected reservation **19/19**, standing **833 pass / 736 environment skips / 0
fail**, and green static gates.

D-661 records independent Tier-3 approval in
`handoff/reviews/254-reconcile-order252-migration-lineage.md`. Approval covers only
the forward-only lineage reconciliation; local promotion remains a separate order.
