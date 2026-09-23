# Order 155 — Normalize seven resolved question statuses

**Status:** READY — governance-only normalization
**Phase:** 5
**Branch:** `phase-5/question-status-normalization`
**Base:** `3adcb3de8db3c60a4eaa21a455d49c9d8b8bffe5`
**Risk tier:** 1 — status metadata only

## Outcome

Add the canonical `## RESOLVED` markers recognized by `state.sh` to Questions 141,
142, 146, 149, 150, 160 and 161. Each marker cites only the resolution already
recorded in that question and its existing decision or bounded correction order.

## Authority

The founder's 2026-08-25 authorization covers all genuinely pending approvals. A
read-only audit found that none of these seven files contains pending product intent:
Questions 141 and 142 were isolated to Orders 122 and 125; Questions 146, 149, 150,
160 and 161 were resolved by D-371, D-390, D-394/D-404/D-407, D-416 and D-417.
This order adds no decision and does not reinterpret any ruling.

## Scope

- this order;
- `handoff/questions/141-order-118-inherited-founder-login-budget.md`;
- `handoff/questions/142-order-053-review-scope-fixture-drift.md`;
- `handoff/questions/146-order126-protected-referee-typed-parents.md`;
- `handoff/questions/149-order126-cancelled-parent-and-derived-proof-scope.md`;
- `handoff/questions/150-order127-runtime-authority-scope-stop.md`;
- `handoff/questions/160-order150-seed-authority-boundary.md`;
- `handoff/questions/161-order150-extension-type-residual.md`.

## Forbidden

No product, test, migration, schema, documentation, ledger, review, decision, prior
order, dependency, merge, push, deployment or runtime change. Do not alter the
substance of any question or resolution.

## Proof

- Base-to-candidate diff contains exactly this order and the seven named questions.
- Each question gains exactly one concise canonical `## RESOLVED` section citing its
  existing authority.
- `git diff --check` is empty and the worktree is clean after commit.
- `state.sh` reports no open questions.
