# Q270 — bounded release-proof efficiency

Status: source repair independently accepted by root, 13 September 2026.
Order460 release integration; preserve Order472 and frozen445/471.
Receiving HEAD:63338ed312f925bddd951665189196e3615a51b9.

## Evidence and purpose

Exact CI34743363237 attempt2 quality103687842576 timed out the Order442
PowerShell AST case at5000.51ms and Order130 provenance at5000.02ms.
The same assertions pass isolated on this native host:1/0 in754.50ms and
1/0 with4 explicit database skips in56.57ms. No failed assertion or child
stderr establishes a product defect. Runner contention is a hypothesis, not
a proven cause; these isolated passes do not replace exact-source CI.

Remove unnecessary cross-platform/process-startup dependencies, retaining
every safety predicate and the existing time limits. No unchanged CI retry.

## Exact implementation ownership

Builder /root/q258_runtime_cutover owns only:

- .github/workflows/ci.yml — add one required Windows-state step for the full
  existing native-review-resume suite after frozen dependency installation.
  No continue-on-error, job-condition relaxation, timeout change or unrelated
  Linux/database/ARM64/container/state command modification.
- tests/native-review-resume.test.ts — explicitly classify the seven existing
  Windows-native helper tests as Windows-only; keep all test bodies/assertions
  and deadlines. A required-proof opt-in must fail on a non-Windows host so
  misrouting cannot produce a green required job made only of skips.
- tests/referee-typed-parent-fixtures.integration.test.ts — replace only P3's
  Git child read with the immutable exact P0 fixture below. Retain original
  full-referee SHA256, migration0001 pin, projection and race-contract checks,
  all actual database proof and its opt-in/skip distinctions. No referee edit.
- tests/fixtures/order130/referee-p0.txt — the exact LF original referee from
  P0 commit97209531aaa7babaa5f6f3013b3e9b2c633d5284, verified against existing
  SHA2563228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1.
  This small immutable provenance fixture is not another application copy.
- tests/ci-proof-routing.test.ts — focused regression for required Windows
  wiring, unmodified proof bodies and in-process original-parent provenance;
  reject missing routing, incorrect host/required flag and altered protected
  fixture/regions. Do not import database-enabled tests just to inspect them.

Root owns this question, the Order460 scope append, its release checklist and
review record, docs/PROJECT-STATUS.md, DECISIONS.log and handoff/LEDGER.md.

All edits use apply_patch. The builder records genuine RED/green results and
exact final hashes; root independently inspects and personally executes proof,
including separate read-only comparison with the actual P0 Git object.
No production, applied migration, protected referee, existing runtime helper,
credentials, database, process owner, WSL/Docker/state script, dependency install,
cleanup, index/ref, commit, push, merge or workflow dispatch mutation is admitted.

## Release sequence

1. Accept this narrow repair from executed source/Windows/provenance proof.
2. Freeze an exact source inclusion list for accepted Order472 plus this repair.
   Shared app/operator files also contain paused445 work: whole-file staging
   is not an accepted release. Preserve those bytes and frozen471 in place.
3. Reuse the existing reversible validation artifact/dependency junction.
   Record exact selected hunks and prove the resulting isolated candidate,
   not merely the mixed working directory. No new checkout or private index.
4. Publication, full exact-source CI/referee, and91-to92 live integration each
   require their existing separate root admission and evidence. Old41415/91
   remains the sole local until a version-correct safe cutover is proved.

The [release checklist](../reviews/460-release-checklist-20260913.md) records
what is complete and what remains. This is not Phase7/14/whole-app closure.

## Executed source acceptance

Builder q258_runtime_cutover froze exactly five admitted files. Root inspected
their full diff/routing guard and personally ran the required native suite,
routing guard and original-parent proof together:9pass/4explicit database skips/
0fail/48 assertions in4.42s. This actually executes the seven native cases;
the four DB skips do not constitute referee/database proof. Strict types,
202 boundaries and diff checks pass. Root independently reads the actual
P0 Git blob and verifies the fixture is byte-equal,12,469 bytes, LF-only,
SHA2563228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1.
Review460 records exact final hashes, commands and preserved failures.
Fresh isolated-candidate standing/publication/remote CI remain pending.
