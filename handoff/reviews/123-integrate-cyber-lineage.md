# Independent Tier-3 review — Order 123 Cyber lineage integration

**Verdict:** APPROVED
**Risk tier:** 3
**Reviewer:** independent non-implementing OpenAI Codex reviewer
**Exact executable reviewed:** `be279bb09536c6b122575f275cd11e09161e057e`
**Builder metadata parent:** `1a5baf4066c3851e40aee38813abef15cc2bdfd3`
**Review branch:** `codex/review-order-123-cyber-integration`

This exact-SHA approval covers only the provenance-preserving integration authorized
by Order 123. It does not re-review or broaden the exclusive finding closure of any
source order, close one of the nine remaining sealed Cyber findings, integrate the
review commit into a canonical branch, push, deploy, or claim live status.

## Findings

No implementation, integration, scope, provenance, security, database, or status
finding.

`git diff --check ec4c563..be279bb` reports trailing spaces only in imported source
metadata `handoff/orders/120-pin-container-images.md` and
`handoff/reviews/119-remove-floating-project-mcp.md`. Those exact source blobs are
retained as reviewed evidence; no executable, migration, configuration, validator,
or reconciliation file has a whitespace finding.

## Exact provenance and scope

The reviewer checked the immutable source commits directly with `git rev-parse
<commit>:<path>` and compared their Git blob ids to the exact Order-123 executable.

- Order 118 exact reviewed executable
  `b6a1319f571ea0cb079f75cedf06edf35548a1d2`: contracts, security documentation,
  migration `0012_app_role_nonlogin.sql`, the focused role proof, migration proof,
  and deployment acceptance proof are blob-identical. The migration blob is
  `b44757121cb97d7e3b4f98446507d2329ec72b71`.
- Order 119 exact approved executable
  `7ba93e4cfe88648e2f3b8bd8fe2edd93e7fdfdc1`: `.mcp.json`,
  `.codex/config.toml`, both tooling documents, and the fail-closed static proof are
  blob-identical. The JSON empty-config blob is `da39e4ffafe816be90259a3f68b763a3f71b93ed`;
  the TOML blob is `81e1e459cbbcfd7bc198bea007096508564dc2d8`.
- Order 120 exact approved executable
  `0ca144b9eb7ad3dcc13c1cac5931c89560e13448`: Dockerfile, Compose file, static
  validator, and focused proof are blob-identical. Dockerfile and Compose blobs are
  `ee76bfaf201766634b62db9bd9645d63d5731e9d` and
  `a270065f74d218df1b4b01c3b97b64687bafef6f`.
- Order 121 exact reviewed executable
  `bc27020e8c3f26e9cc68658cab00a2f9ac1929ed`: `src/http/operator.ts` and its
  actor-bound proof are blob-identical at
  `5e7cd2f5b3a2cabbb76dde83d5ece09751849618` and
  `df85acb60df65543a9e07b1d66d01175497f35bc`.
- Order 125 exact verified implementation
  `8fb42bb3c1e99c7bcee45d8b7bfd7fab908e0290`: the complete Order-053 proof file is
  blob-identical at `225c332319c33bb49e812d70d72a0575131509a3`.
- Order 122's founder-status fixture lifecycle remains exact. Its proof file differs
  from `8bdd977a7db7449117c4c94ff9d8782223525b50` only in the two expressly authorized
  Order-123 snapshot assertions, changing built/current order `108` to `123`; no
  login service, guard, credential, request, database, or authentication assertion
  changes.

The exact integration range `ec4c563..be279bb` contains only admitted source-order
artifacts/evidence and the Order-123-authorized reconciliation. Direct inspection of
that reconciliation found exactly one added seventeenth database mapping for the
unchanged Order-121 test, its mirrored runner assertion/title/count, project-status
built/current `118` to `123`, and the two founder-status assertions above. No
Order-069 product or proof file changed. Metadata head `1a5baf4` differs from exact
executable `be279bb` only in `DECISIONS.log`, `handoff/LEDGER.md`, and the Order-123
record.

Protected SHA-256 values remain exact:

- `migrations/0001_init.sql` —
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
- `tests/run_invariants.py` —
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`

## Reviewer-executed proof

All mutable execution used uniquely named disposable review resources. The live
`yellow`, `phase-c`, Order-118, and every unrelated project/worktree were not changed.
No MCP server was installed, resolved, or launched.

### Current-line matrix and Windows timing assessment

The first complete Windows invocation started from suite one on a fresh isolated
PostgreSQL 16.15 cluster. Rate-models and rate-targeting passed; rate-publication's
first ten cases passed; inherited Order-069 P8 then measured `17.646s` against its
`15s` host ceiling. This result is not represented as green. It independently
corroborates the builder's disclosed `17.98s` Windows result and demonstrates the
same host-sensitive timing class, not a hidden integration result. Order 123 changes
no Order-069 implementation or test blob.

The reviewer destroyed and recreated only the disposable review cluster, created a
native WSL detached worktree at exact metadata head, installed the frozen lockfile,
and restarted the exact runner from suite one. Order-069 P8 passed in `10.745s`, and
the runner finished:

```text
[phase3-gate] 17/17 suites passed with isolated databases
```

This included financial postings `10/10` with 500 balanced charges,
SECURITY DEFINER containment `3/3`, Order 118 `5/5` with 25 assertions, and Order
121 `5/5` with 54 assertions.

### Focused integration and fixture proofs

- integration/static proofs: `13/13`, 145 assertions — exact 17-suite mapping,
  filesystem-only container-pin validation, and mirrored empty/fail-closed MCP
  configuration;
- Order 119: `3/3`, 7 assertions; Order 120: `4/4`, 7 assertions;
- Order 122 founder status inside the isolated matrix: `7/7`, 82 assertions;
- Order 117 limiter regression: `10/10`, 78 assertions;
- Order 053 on a separately recreated/migrated database: `7/7`, 42 assertions,
  including the exact approved 27-scope P7/P8 fixture;
- final standing: `171 pass`, `406 skip`, `0 fail`, `1,965 assertions`;
- TypeScript clean; import boundaries clean with `64 TypeScript files scanned`;
- frozen installation and licence policy: 23 packages; dependency audit: no
  vulnerabilities;
- a dedicated fresh migrated database matched `tests/schema/expected.sql` exactly.

### Pristine referee and runtime health

A separate pristine Compose project `yellow-review123-referee` applied migrations
0001-0012 to new development and test databases, retained 85 public tables, RLS and
view isolation, and returned:

```text
RESULT: 11 passed, 0 failed of 11
```

The same isolated project then built the exact digest-pinned Dockerfile and started
the app, PostgreSQL, and Valkey. All three containers were healthy; app health was
exact `200 {"status":"ok"}`; PostgreSQL retained 85 public tables; and Windows
`state.ps1` reported the same isolated project and all three services up. Container
inspection retained the exact PostgreSQL and Valkey digest references. BuildKit
resolved the pinned Bun OCI index to its local Linux/AMD64 platform manifest
`sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0`,
consistent with the approved Order-120 provenance record.

## Cleanup and conclusion

Only the reviewer's disposable native worktree, databases, containers, networks,
volumes, and locally built review image are cleanup targets. The review branch and
its metadata commit are the review deliverable.

Order 123 is **APPROVED** at exact executable SHA
`be279bb09536c6b122575f275cd11e09161e057e`, with metadata parent
`1a5baf4066c3851e40aee38813abef15cc2bdfd3`. No executable file, canonical branch,
remote, deployment, or live project was changed.
