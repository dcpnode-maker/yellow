# PR-FIX-009 - Verify PR97's own frozen dependencies on the proof drive

Founder authority: repair existing public PRs; preserve the live app/database and
all unrelated working files. PR97's source candidate is PR-FIX-008, combining
d708ff29e2e44df74a5c1a12e58a8cf656b14c8d and
3503b0c01f336637d2583963c17b792f6ad59efe.

## Scope

- This order, its paired question and one repair receipt.
- Exact byte copies of this candidate's committed `package.json` and `bun.lock`
  to the newly owned `E:/YellowProofRecovery-0929/pr97-dependencies` directory.
- A frozen Bun install there, with lifecycle scripts disabled; subprocess-only
  cache/TEMP/TMP on E. No change to either dependency manifest or lockfile.
- Recoverably move only this worktree's existing regular, non-reparse
  `node_modules` to the previously absent
  `E:/YellowProofRecovery-0929/pr97-node_modules-before-install` path. It is the
  owned PR93 proof install, not the PR97 dependency set.
- A worktree-local `node_modules` junction to that exact E-drive frozen install;
  validate the literal source, target and all parent directories before moving.
- Types, boundaries, dependency gates, finite standing/browser checks and native
  state/referee proof using only the candidate and owned isolated resources.

No production promotion, live restart, broad cleanup, new dependency version,
licence-policy exception, gate disablement or automatic model-code application.
The lockfile includes `tslib@2.8.1` (0BSD). If its actual frozen licence check
fails, retain that failure, record a question for founder policy approval and
continue only independent permitted checks. Do not alter package metadata or
self-clear the licence gate.

## Acceptance

Byte/hash equality for both copied public manifests; frozen install; protected
migrations identical to PR97; actual frozen licence/audit results; executable
tests and isolated 11/0 referee. Invariant-adjacent integration still needs
independent reviewer-executed acceptance. Parent proof is not that approval.
