# PR-FIX-015 - Prove the actual PR97 frontier in CI

Founder authority: repair existing public PRs. PR97's release/setup/launcher already
require protected frontier100 and PostgreSQL18; CI's current readiness assertion
still requires91 and root tsc alone omits the React source.

## Scope

- `.github/workflows/ci.yml`: change only its current readiness expected frontier
  from91 to100 and add the existing frontend strict tsc to its typecheck step.
  Do not relabel explicitly historical frozen81/85 native fiscal fixtures.
- `tests/free-host-arm64.test.ts`, `tests/release-workflow.test.ts`: exact current
  CI frontier100 and both independent compiler invocations, with negative stale
  frontier/relaxed-health guards. No gate removal or conditional skip.
- This order, question and receipt; ignored finite proof outputs.

Migrations1-100, PG18 pins and runtime readiness source remain byte-identical.
Licence approval, isolated referee and independent review remain outstanding;
correcting CI is not authorization to waive them. No live promotion or own merge.
