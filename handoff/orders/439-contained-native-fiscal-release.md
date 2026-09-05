# Order 439 — Contain unapproved native fiscal issuance before integration

Status: ACTIVE — companion to Order438.

## Evidence and authority

Independent source review of PR80 found migration0074 grants app_role the legacy
commit_india_native_fiscal_invoice function while Order430 remains CHANGES REQUIRED.
Order434's replacement draft SQL is outside the migration runner. The founder's
2026-09-05 consolidation directive authorizes correcting this release blocker.

## Scope

- Add migrations/0075_contain_unapproved_native_fiscal_issuance.sql: revoke EXECUTE
  of the exact legacy issue capability from PUBLIC, app_role and yellow_runtime.
  Preserve all issued documents, series, rows and existing operational capabilities.
- Keep migrations0001–0074 byte-identical. Keep Order434 SQL inactive. Reserve76/77
  for its future evidence/completion migration assembly; existing draft filenames
  remain historical until the assembly order deliberately renames them.
- Update tests/schema/expected.sql, tests/migrate.integration.test.ts,
  tests/database-acceptance.integration.test.ts, tests/setup-current-catalogue-oracle.test.ts,
  tests/india-native-fiscal-issuance.integration.test.ts and new
  tests/native-fiscal-release-containment.integration.test.ts only as needed to
  distinguish historical74 issuance evidence from current75 containment acceptance.
- Update setup.sh/setup.ps1 exact migration/catalogue messages through Order438.
- Append DECISIONS.log, handoff/LEDGER.md, handoff/orders/434-native-fiscal-source-completion.md;
  add handoff/reviews/439-contained-native-fiscal-release.md and relevant release status.

## Acceptance

Independent non-implementer personally verifies exact/default-aware runtime ACL
denial, fresh75 migration,74→75 upgrade, no-op/checksum behavior, normalized schema,
125 public tables (unchanged) and clean real PostgreSQL11/11 invariants. Existing
folio, payment, correction, transfer, approval, seal and tax compatibility tests
must continue to pass. No re-grants to manufacture old native success results.

This makes an operational release eligible for review; it does not complete
Order434, authorize invoice activation or waive full Phase7 acceptance.
