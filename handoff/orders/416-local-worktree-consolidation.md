# Order 416 — Local worktree consolidation

## Objective

Consolidate verified clean Yellow checkouts into the canonical repository while preserving every unique commit as a branch and leaving active or dirty worktrees untouched.

## Scope

- Git worktree metadata and verified clean linked worktree directories.
- Local archival branches for otherwise detached review commits.
- Read-only Docker/runtime inventory; no application, database, image, or volume deletion.

## Gates

- Every removed worktree is clean.
- Every removed worktree HEAD remains reachable from a local branch.
- The canonical repository, active Order 415 worktree, and all dirty/evidence worktrees remain.
- Exactly one GitHub remote remains configured.

## MERGED

Merged into the active workspace by order 416 execution (local continuity prep branch)
by removing the clean `yellow-order432-rate-pricing` worktree after preserving:

- Its clean status (`git status --short` returned none).
- Its branch anchor (`phase-7/order437-main-sync`) and commit reachability.
- Canonical repository and active dirty worktree (`yellow-order175-folio-responsive-containment`) unchanged.

This was validated by:

- `git worktree list --porcelain`
- `git status --short --branch` in `yellow-order432-rate-pricing` (before removal) and `yellow`
- `git branch --contains 6c38e2dd5ba15b71109c2e8ff463c02b9ea1f974`

