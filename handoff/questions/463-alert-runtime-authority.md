# Order463 — runtime permission and route findings

2026-09-09, raised before widening source scope. Independent reviewer found that
migration0016 revoked alert mutations and no later migration restored them. The
new service cannot work as app_role at frontier90. Its proof also incorrectly
used one URL for deploy fixtures and runtime transactions. The UI's unpublished
colon-suffix action disagreed with the application's slash action convention.

Root technical resolution, within standing implementation authority: admit one
forward-only column ACL migration and the exact privilege-catalogue tests under
Order463; keep all serving/recovery databases unchanged. Use the existing slash
action convention consistently in the new UI/contract/tests. Split deploy and
runtime proof connections, restrict them to an explicitly isolated native target,
and retain synthetic evidence instead of deleting append-only rows. No founder
business-policy decision is involved. Independent real DB proof remains required.

Publication coherence finding: the current source still advertises migration90.
Root admits src/kernel/build-info.ts and tests/build-readiness.test.ts to advance
the current source frontier to91 and verify exact alert INSERT-column/UPDATE-active
authority at readiness. Preserve every existing fiscal/tenant readiness check.
This does not change the frozen Order460 revision/frontier90 runtime or its tests.
Other current-release oracle paths must first be inventoried before scope expansion.

The read-only inventory identified current-release frontier checks below. Admit
only their90→91 migration-count/expected-frontier changes, retaining129 tables /
119 tenant tables /119 policies /28 forced tables and every partial-frontier test:
scripts/local-review.sh; .github/workflows/ci.yml; setup.sh; setup.ps1;
tests/release-workflow.test.ts; tests/free-host-arm64.test.ts;
tests/setup-current-catalogue-oracle.test.ts;
tests/database-acceptance.integration.test.ts;
tests/fiscal-retry-readiness.integration.test.ts;
tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts;
tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts.
No shell/setup/deploy execution is authorized by these source corrections. Preserve
frozen and historical launchers. Historical published frontier statements remain
unchanged; current-source descriptions may explicitly distinguish unpublished91.

Additional inspected current-only oracle: tests/migrate.integration.test.ts full
PROJECT_MIGRATIONS aggregate beginning near2840 must append0091 to the expected
applied list and advance its full ledger/no-op discovered count90→91. Its explicit
historical Order453 89→90 test at1379–1463 is unchanged. Admit only those three
current-frontier expectation changes.

Release metadata companion: .github/workflows/release.yml MIGRATION_FRONTIER
and its exact tests/release-workflow.test.ts assertion are current release91,
not historical90 evidence. Admit those two literals together, no job/action change.
