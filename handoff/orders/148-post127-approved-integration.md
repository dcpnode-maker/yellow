# Order 148 — Integrate the approved post-127 line

**Status:** APPROVED — D-412; PR #78 open against unchanged admitted target
**Phase:** 5 · delivery control
**Branch:** `phase-5/post127-approved-integration`
**Base:** `f26e3952cdc0091bab852b3c6b670b84a13cef7c` — closed Order-127
metadata head; exact independently approved product executable
`833376bd61570b098855825fa991697fb3242218`
**PR target:** freshly fetched `origin/main`
`952478d17bcebd67e696d5cb76eec37e89cabcf3`
**Risk tier:** 3 — composition includes occupancy, tenant/RLS, authentication,
SECURITY DEFINER, fiscal and runtime-database authority
**Owner:** Codex coordination; an independent non-implementing Tier-3 reviewer must
personally execute the proof before push or PR creation

## Outcome

Carry the already reviewed post-127 line to one exact, independently reviewed PR
candidate without replay, rebase, product change or hidden ancestry substitution. The
order proves provenance and integration behavior; it does not implement a feature.

## Admission facts

- A fresh read-only fetch on 2026-08-25 leaves `origin/main` exact at
  `952478d17bcebd67e696d5cb76eec37e89cabcf3`.
- That remote target is an ancestor of Base. Base is 111 commits ahead and zero
  commits behind it.
- Order 127 is approved by D-407 at exact executable `833376bd...`; review commit
  `d4c1ace` and closure commit `f26e395` change governance only.
- Order-147 presentation approval D-408 belongs to its separate approved status
  branch and is deliberately not imported. D-409 is the next decision on this
  product-integration line; the numbering gap is explicit, not missing evidence.
- Target-to-Base `git diff --check` has an immutable inherited manifest of 53
  Markdown trailing-space findings across 11 already reviewed governance paths.
  Q158/D-410 permits no rewrite; Base-to-candidate hygiene must be exact and empty.
- Finance activation and any workbench approval-status upgrade remain separate future
  orders. Neither may be smuggled into this integration candidate.

## Scope

- this order;
- `handoff/questions/158-order148-diff-hygiene-boundary.md`;
- `handoff/questions/159-order148-question-eof-hygiene.md`;
- additive D-409 and the Order-148 ledger records;
- `handoff/reviews/148-post127-approved-integration.md` only when written by the
  independent reviewer; and
- additive independent-review decision/ledger metadata after proof.

No existing product, migration, schema, test, script, dependency, lockfile, Compose,
workflow, documentation, question, prior order, prior review or protected file may
change under this order.

## Required proof

### P0 — exact integration identity

Fetch the PR target read-only and require its exact SHA before proof. Prove target is
an ancestor of the candidate, the candidate is zero commits behind, and no merge,
rebase, cherry-pick, graft or replacement ancestry was introduced by this order.
Prove Base-to-candidate changes only the Scope paths above and passes `git diff
--check`. Separately prove the target-to-Base inherited manifest is exactly 53
findings across the 11 Q158 paths, with no candidate-created addition.

### P1 — provenance and exclusions

Mechanically map every target-to-Base changed path to its latest owning commit and
approved evidence. Require exact protected hashes, migration 0014/0015 checksums,
D-407 executable/review/closure ancestry, zero unresolved conflict markers and zero
unexpected path. Explicitly prove that the separate D-408/Order-147 branch, stale
Orders 109–115, legacy Order-127 branch, review worktrees and draft finance artifacts
are absent.

### P2 — executable integration

On one immutable candidate, run frozen install, typecheck, 64-file boundaries,
standing tests, licence policy, dependency audit, image pins, JWT secret proof,
normalized live schema, database acceptance, full migration suite with the documented
Windows-symlink/Linux distinction, the 20-suite isolated phase matrix, Order-127
runtime/relay/outbox/hold/extension proofs, protected hashes, and fresh
`./setup.sh --db-only` with exactly `11 passed, 0 failed of 11`.

### P3 — independent review and delivery

An independent non-implementing Tier-3 reviewer personally executes P0–P2 on the
exact candidate and records commands, results, findings and cleanup. Only after that
approval may Codex push this branch and open one PR targeting the exact fetched
`origin/main`, including the referee output. Codex never merges its own PR.

## Forbidden

- Product, migration, schema, test, script, dependency, lockfile, Compose, workflow,
  documentation, prior-governance or status-snapshot edits.
- Rebase, merge, cherry-pick, squash, ancestry replacement, force-push, target change
  or importing any parallel worktree/branch.
- Starting finance implementation or the post-D407 founder-status upgrade before this
  integration review closes.
- Reusing Order-127 builder or reviewer output as Order-148 independent proof.
- Sharing credentials, printing URLs/passwords, touching the live Order-147 database,
  deployment, production mutation, self-review, self-merge or Cyber-wide closure.

## Definition of done

- [x] Exact approved Base and freshly fetched target are recorded; ancestry is
      target-ancestor, 111 ahead, zero behind.
- [x] P0 exact identity and Scope-only candidate pass.
- [x] P1 complete latest-owner/protected/exclusion map passes.
- [x] P2 complete executable integration proof passes on one immutable candidate.
- [x] Independent Tier-3 review approves that exact candidate.
- [x] Branch is pushed and one PR is opened against the unchanged target with referee
      evidence; no merge or deployment occurs.
