# PR-FIX-001 — Repair all six open Yellow pull requests

## Authority and objective

Founder request, 2026-09-29: fix all pull requests. Inventory is PR86, PR92,
PR93, PR94, PR96 and PR97 in dcpnode-maker/yellow. Fix concrete review/check
failures and reconcile their existing bases without merging a PR into main.

## Scope

- Isolated repair checkout only; ordinary non-force updates of the six existing
  PR head refs, preserving their parents and historical evidence.
- PR86: merge its current main base, retaining both versions of the conflicting
  docs/PROJECT-STATUS.md as clearly dated historical/current records.
- PR92: verify green checks and review debt; keep draft status unless acceptance
  is established. No gratuitous application changes.
- PR93: reconcile the existing PR92 base in the fourteen conflict paths reported
  by merge-tree; preserve catalog/map isolation, source provenance, normalization,
  antimeridian and rendered-browser proofs. Verify the five posted review fixes.
- PR94: reconcile main in its fifteen conflict paths. Preserve main's already
  reviewed tax-fiscal implementation/exports/tests rather than revive the stale,
  unscoped fiscal replacements; continuity tooling and its tests may be repaired.
- PR96: inherit PR94 repairs, then correct continuity context generation,
  symlink-test cleanup and personal-path disclosure in docs/PROJECT-STATUS.md,
  tools/build-continuity/{start.py,continuity.py,test_continuity.py}; preserve its
  four founder-context documents and Order417 with explicit historical labels.
- PR97: repair CodeQL findings in tests/{operator-folio-separate-charges-label.
  intentional-red.test.ts,order609-reservation-create-edit.browser.test.ts,
  order610-reservation-transitions.browser.test.ts,yellow-departure-coordination.
  browser.test.ts}, plus a bounded tests/helpers/cdp-invoke.ts and regression test.
  Advance only current migration assertions in setup.{sh,ps1}, tests/{setup-current-
  catalogue-oracle.test.ts,migrate.integration.test.ts,database-acceptance.
  integration.test.ts,india-gst-accommodation-quoted-rate-applicability-recording.
  integration.test.ts}; reconcile schema/expected.sql only against actual0100
  migration behavior. No applied migration edit. Base reconciliation requires
  path-by-path evidence; no blanket ours/theirs conflict resolution.
- Current migration100 readiness metadata and its coupled proof are included:
  src/kernel/build-info.ts, scripts/local-review.sh, tests/build-readiness.test.ts
  and tests/build-readiness.integration.test.ts. This explicit scope amendment
  follows the reproduced99-versus100 failure; historical99 ledger entries stay.
- Align the current database acceptance version with the already pinned
  PostgreSQL18.6 image. Add a static regression binding that exact assertion to
  the Docker image. This is test-only: no server, volume, role or data mutation.
- Reproduced PR97 browser failures admit the conditional timeline hook repair
  in frontend/yellow/src/workspaces/ReservationWorkspace.tsx and its
  tests/order611-operational-timeline.test.ts regression. Correct stale synthetic
  reservation-response fixtures in the already scoped browser suites to include
  the existing exact server action shape. No production authority/parser change.
- This order, handoff/reviews/PR-FIX-001.md, scoped ledger records and explanatory
  PR comments/bodies/review-thread replies reflecting verified repairs.

## Exclusions and gates

No root/other dirty checkout changes, existing staged work, live hotel data,
provider/key/account changes, weakening tests/security checks, forced pushes,
self-merge, unrelated model/worker activation or invented independent acceptance.
High-risk behavioral changes require nonimplementing reviewer-executed proof.
Configured reviewer availability is not assumed. Missing review remains explicit.

Run regression/type/boundary gates on repaired candidates; inspect exact-source
GitHub checks. Current100 assertions must retain historical migration boundaries.
CDP input data must travel as arguments, never executable-source interpolation.

## Status

IN PROGRESS. Six PRs inventoried; five conflicts and PR97 CodeQL failure verified.
Original working trees are preserved; no PR has been merged.
