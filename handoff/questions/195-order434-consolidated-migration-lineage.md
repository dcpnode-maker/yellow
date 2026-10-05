# Question195 — Native completion after the consolidated release

Status: RESOLVED by the implementation coordinator under Orders434/438/439.

The reviewed operational branch at791e416 assigns migration0075 to containment
of the rejected legacy invoice capability. Development checkpoint7249b27 adds
seven concurrency cases after that release's6a7cd8a cutoff. Local integration
96b808d preserves both histories and all three test files unchanged. It is not a
main merge, a modification of PR82, or acceptance of the combined revision.

Order439's explicit reservation supersedes Order434's original numbering:

- Preserve production migrations0001–0075 byte-for-byte.
- Assemble evidence as0076_india_native_fiscal_source_evidence.sql from the exact
  historical draft0075 bytes. Preserve its source text and historical comments.
- Assemble completion as0077_india_native_fiscal_source_completion.sql in order:
  accounting, preparation, statutory, completion. Preserve the four fragment
  bodies and append only the exact five approved app_role entry grants (Q192 four
  plus Q193 approval-options helper). Helpers and legacy issuance remain private.
- Before runner promotion, build this full candidate in an isolated temporary
  migration directory; production discovery remains at75 until derived catalogue
  changes are ready. Temporary proof directories are not another application copy.
- Use the existing admitted tests/migrate.integration.test.ts for mandatory,
  separately configured75→76→77, intermediate76 denial, actual77 rollback,
  checksum/no-op and fresh77 equivalence proof. Do not weaken existing cases.
- A fresh native PostgreSQL16.15 test cluster is required after the recorded disk
  check. The old synthetic cluster has a different historical75 ledger and cannot
  prove this production upgrade. Stop it after observing no other sessions;
  preserve its data. Never run new migrations against the retained hotel database.

The existing scope now names canonical0076/0077 instead of0075/0076. Admit
setup.ps1 beside setup.sh for exact derived catalogue messages, and
docs/PROJECT-STATUS.md for the actual active development task and release boundary.
Catalogue derivation and the full independent acceptance remain required. No new
policy, provider activation, broad grants, main merge or local refresh is admitted.

The integrated status suite hardcodes a Unix URL pathname and Bash process on
Windows. Under Order438's matching status-test scope, admit
tests/project-status.test.ts for fileURLToPath and platform-native state adapter
invocation. Preserve metadata, real-order and invalid-metadata rejection checks;
do not invoke WSL or omit Windows assertions to make the full suite green.

Canonical77 promotion also requires the exact runtime readiness frontier in
src/kernel/build-info.ts and its tests/build-readiness.test.ts and
tests/build-readiness.integration.test.ts. Admit only77 frontier reconciliation
and fail-closed predecessor assertions; do not weaken role/readiness checks.
Admit tests/native-fiscal-release-containment.integration.test.ts to preserve its
explicit historical fresh75/74-to75 fixtures while separately verifying current77
continues to deny legacy issuance. Current discovery must not silently convert a
historical containment proof into native issue-success evidence.
Order438 also admits state.ps1's UTF-8 metadata reading/output for its actual
Windows5.1 invocation; tests must assert real output without repairing mojibake.

The canonical 77 candidate must also retain a usable release path. Admit only the
matching frontier and mandatory-proof wiring in `.github/workflows/ci.yml`,
`.github/workflows/release.yml`, `scripts/local-review.sh`,
`tests/release-workflow.test.ts` and `docs/RELEASE.md`. Preserve main-only publication,
exact-SHA identity, independent integration and the absence of an approved cloud
serving target. Do not run the retained local launcher as part of this order.

For CI's migration-equivalence proof, the existing migration test may invoke the
real PostgreSQL 16.15 `pg_dump` inside the pinned Compose postgres service when an
explicit Compose-dump flag is supplied. Otherwise require the existing absolute
native binary path. The transports are mutually exclusive and must check client
version; both use the same complete normalized dump, checksum and ledger assertions.
No fabricated database response, authentication wrapper or weaker oracle is allowed.
Native issuance suites must execute with mandatory flags in isolated CI databases;
the dependency-free suite's skips are never their substitute.
