# Order 148 — independent Tier-3 integration review

**Conclusion:** APPROVED
**Reviewer:** Codex, independent non-implementing Tier-3 reviewer
**Candidate:** `e6080ca6df7c6ea19dfd5ee294d4152af842abd6`
**Base:** `f26e3952cdc0091bab852b3c6b670b84a13cef7c`
**Target:** `952478d17bcebd67e696d5cb76eec37e89cabcf3`
**Date:** 2026-08-25

I did not implement Order 148 and did not reuse builder execution. I reviewed the
immutable candidate above in a fresh exclusive Compose project and found no scope,
provenance, ancestry, exclusion, product, migration, tenancy, runtime-authority,
security or proof defect.

## P0 — identity and hygiene

- `git ls-remote origin refs/heads/main` and the local remote-tracking ref both
  resolved to the admitted target exactly. `git merge-base --is-ancestor` proved
  target → Base → candidate. Target-to-Base is `0 behind / 111 ahead`; Base-to-head
  is `0 behind / 3 ahead`.
- The three Order-148 commits are linear, contain zero merge commits and use zero
  replacement refs. Base-to-candidate changes only `DECISIONS.log`,
  `handoff/LEDGER.md`, the Order-148 file, Q158 and Q159. Base-to-candidate
  `git diff --check` is empty.
- Target-to-Base changes exactly 132 paths. Its immutable Q158 hygiene manifest is
  exactly 53 findings across the eleven recorded Markdown governance paths. Parsing
  only `git diff --check` finding lines produced 53/11; candidate changes add none.

## P1 — provenance, hashes and exclusions

- Latest-owner computation over all 132 paths produced exactly 40 unique commits.
  Every owner mapped to its first containing approved checkpoint: Order 142 (2),
  Order 146 (5), Order 126 (5), or Order 127 (28); zero were unmapped. All four
  independent review artifacts are present.
- Exact ancestry is executable `833376bd61570b098855825fa991697fb3242218` →
  D-407 review `d4c1ace1502448606e7e71cc23b04f366d3beb13` → closure/Base
  `f26e3952cdc0091bab852b3c6b670b84a13cef7c` → candidate. D-407 changes only its
  review plus additive governance; closure changes only the Order-127 status and
  additive ledger.
- Protected SHA-256 values are exact: baseline
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
  `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture
  `bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`, migration
  0014 `706806ad3c041d506df1e90f75b19ed219baa3fedb8968471828657ab6c7493a`, and
  migration 0015 `cd201b7e0bc9a2fb538b32f69adb0900d7b2149f9cc82fd5e9a02056a573166a`.
- D-408/Order-147 and its `cafb5d3` evidence are not ancestors and no Order-147 path
  is present. Finance Orders/reviews 109–115, finance 0015, review-worktree paths,
  conflict markers and replacement ancestry are absent.

## P2 — reviewer-executed integration proof

Fresh project `yellow-o148-r-e6080ca` used private ports and volumes.

- `bun install --frozen-lockfile` made no changes. Typecheck passed; import boundaries
  passed for 64 TypeScript files; standing `bun test` passed 178, skipped 452
  database-gated cases, failed 0, with 2,049 assertions across 94 files. License
  policy passed for 23 packages, dependency audit found no vulnerabilities, image
  pins passed 4/4, and JWT secret security passed 5/5.
- `./setup.sh --db-only` applied migrations 0001–0015 to fresh dev/test databases and
  the protected app-never-started referee returned exactly `11 passed, 0 failed of
  11`. Live normalized schema matched `tests/schema/expected.sql`; deployment
  acceptance passed 6/6 with 13 assertions.
- Focused runtime authority passed 9/9 (63); extension 6/6 (25); relay 19/19 (130),
  including ordered/unpublished settlement and a 10,000-row P6 drain in 18.204s;
  isolated outbox 7/7 (24); and the real hold worker 6/6 (30).
- `bun run test:phase3-gate` passed all 20/20 suites on isolated databases, including
  financial postings, SECURITY DEFINER containment, app-role NOLOGIN, business-day
  seal authority, Order-129 parent sequencing and runtime authority.
- Native Windows migration execution passed 19/20 with 110 assertions; the sole stop
  was the inherited host `EPERM` while creating the symlink at
  `tests/migrate.integration.test.ts:1064`, before the product assertion. The
  identical complete suite under WSL/Linux passed 20/20 with 112 assertions,
  including the invalid-file fail-closed case.

All exclusive Order-148 containers, volume, network and project-specific images were
removed after proof. Approval is limited to this integration candidate. It does not
close the order, push, open a PR, merge, deploy, import Order 147 or finance work, or
claim wider Cyber closure.
