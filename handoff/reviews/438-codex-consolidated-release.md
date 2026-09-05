# Review 438 — consolidated release, build identity and local review

**Order:** 438 with Question 194 and Order 439 containment dependency
**Reviewed by:** Codex `/root/pr_ancestry_audit`, independent of the release implementation
**Date:** 2026-09-05
**Candidate:** `f8743a662cfa13cb235ace4bbed525ca2d06c3cb`
**Candidate tree:** `a0c9e1aff97c2ad38f7c49a521f736d57b0a5123`
**Verdict:** CHANGES REQUIRED — EXACT-CANDIDATE CI FAILED

## Scope and source binding

This review covers the release surface in `Dockerfile`, `docker-compose.yml`,
`setup.ps1`, `src/kernel/build-info.ts`, `src/kernel/index.ts`, `src/app.ts`,
`src/server.ts`, `scripts/local-review.sh`, `docs/RELEASE.md`, the CI and release
workflows, and their build/readiness/release tests. It does not review the
reviewer's own consolidation manifest, approve Order 434, claim a cloud deployment,
or act as the independent fiscal acceptance for Order 439.

The local ref had not moved when the candidate was frozen. Before writing this
receipt, the reviewer proved that there were no unstaged tracked differences and
that `git write-tree` returned the exact supplied/API-verified candidate tree
`a0c9e1aff97c2ad38f7c49a521f736d57b0a5123`. The local proof below is therefore
bound to the content of candidate `f8743a662cfa13cb235ace4bbed525ca2d06c3cb`,
not to a later moving working tree.

## Findings resolved before the frozen candidate

1. **Runtime readiness could accept an owner session that assumed the runtime
   role.** The first version checked only `current_user = 'yellow_runtime'`. A
   privileged deployment connection could use `SET ROLE yellow_runtime`, satisfy
   that effective-role check and report ready while retaining an elevated
   `session_user`. The final `assertRuntimeReleaseReadiness` requires both
   `session_user` and `current_user` to equal `yellow_runtime`. Its required real
   PostgreSQL test accepts the direct runtime login and rejects both the deployment
   login and a deployment session after `SET LOCAL ROLE yellow_runtime`. This now
   matches the project's established connection-settlement authority contract.

2. **The supported local launcher initially selected a tools image without its
   source dependencies.** `scripts/local-review.sh` runs
   `bun scripts/seed-review.ts` in the Compose `seed` service, while that script
   imports `../src/...`; the initial `database-tools` target copied no `src/` and
   would fail before the promised review app started. The final target copies
   `src/`, retains the required scripts and migrations, and runs as the nonroot
   `bun` user. The focused release test guards both the source copy and user.

The two source findings above were resolved before the frozen candidate. The first
exact-candidate CI then exposed two additional harness defects, recorded below.

## Security and release observations

- `/health` remains the exact dependency-free `200 {"status":"ok"}` contract.
  `/ready` is non-cacheable, requires an exact lowercase 40-character build
  revision and a configured target, and returns generic failure reasons without
  exposing caught database details.
- Operator readiness proves the direct constrained database identity, core
  catalogue, exact native-fiscal function presence and the Order 439 denial of
  issue capability to PUBLIC, `app_role` and `yellow_runtime`. The separate
  synthetic provider reports its distinct target and is documented as a local
  facility, not a production provider receipt.
- Release publication is admitted only for a successful `CI` workflow caused by a
  push to `main` in this repository. It requires exact successful job names
  `windows-state`, `quality`, `container-smoke`, `database` and `local-review`,
  checks out the triggering SHA detached with persisted credentials disabled,
  validates the exact lowercase SHA and clean checkout, and publishes only
  SHA-addressed amd64 runtime/migration images plus registry digests. No pull
  request, dispatch or cloud-deployment path is present. External actions and
  base/service images are pinned.
- The local launcher binds ports to loopback, refuses a dirty checkout before
  generating credentials, creates ignored random credentials, validates exact
  file ownership/shape and mode 600, proves the embedded revision, readiness and
  a real local login, and preserves the PostgreSQL volume on stop. Documentation
  identifies the data as synthetic and warns against pointing the launcher at a
  volume containing hotel data.
- Release documentation states that no approved cloud host, DNS, TLS ingress,
  production credential or deployment exists. The workflow publishes registry
  artifacts only, so it does not fabricate cloud progress.

## Personally executed proof

On the exact staged candidate tree, using Bun 1.3.14:

```text
bun test tests/build-readiness.test.ts tests/build-readiness.integration.test.ts tests/release-workflow.test.ts
6 passed, 5 database-dependent skips, 0 failed, 55 assertions

bun run typecheck
passed

bun run boundaries
Import boundaries OK: 168 TypeScript files scanned

bash -n scripts/local-review.sh
passed; executable mode 755 confirmed

YAML parse: .github/workflows/ci.yml, .github/workflows/release.yml, docker-compose.yml
passed

git diff --check --cached
passed
```

The reviewer also exercised the launcher's dirty-checkout fail-fast path with
stubbed external commands: it exited 1 with the intended refusal and did not create
`.env.local-review`.

Docker, a usable PostgreSQL server and PowerShell are unavailable in this reviewer
executor. Accordingly, the five database-dependent readiness cases, image build,
full local launcher and native Windows execution are reported as unexecuted here,
not converted into a pass. Candidate CI is required to execute those environments.

## Pending exact-candidate gate

### First exact-candidate CI — failed

[CI run 33985891320](https://github.com/dcpnode-maker/yellow/actions/runs/33985891320)
executed candidate `f8743a662cfa13cb235ace4bbed525ca2d06c3cb`. The reviewer
independently read the job states and failure logs:

- `quality`, `windows-state` and `container-smoke` passed.
- `local-review` failed after its successful 11/11 referee because the launcher
  invoked the review seed without first loading the canonical launch seed:
  `Canonical launch seed is absent; run bun run db:seed first`. The supported
  launcher must execute the canonical seed before `seed-review` and prove the
  complete path on a clean runner.
- `database` failed the new combined compatibility step: 82 tests passed and two
  failed. The Order 367 and Order 400 suites both own a fresh-fixture insert for
  `extension_type(type=tax_jurisdiction)`, but the shared database had already
  received that row from `scripts/seed.ts`. These stateful suites require isolated,
  migrated-but-unseeded databases; the other compatibility suites require isolated
  copies of the canonical seeded baseline. Combining every file on one seeded
  database is not valid compatibility evidence. PostgreSQL `too many clients`
  entries in the complete job log occurred during earlier successful stress tests,
  before this compatibility step, and are not attributed to these two failures.

This failed run is evidence that the release gate rejects an incomplete build. It
is not approval. Any repair changes the candidate SHA/tree and requires a new
diff-bound review plus a fresh successful five-job run.

### Required green rerun

Final approval remains pending until a repaired exact candidate is frozen and all
five required jobs are successful. The receipt must then record its SHA/tree, run identity and database
transcript, including the required direct-runtime/deploy/role-assumption readiness
cases and the 11/11 referee. Until that evidence exists, this review authorizes no
merge, image-success claim, local refresh or cloud deployment.
