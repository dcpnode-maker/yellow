# Order 153 — Normalize resolved Question 147/148 status

**Status:** READY — governance-only normalization
**Phase:** 5
**Base:** `aff09155d68ad3f69cd0a119e24b79e7f876fc56`
**Scope:** Q147 and Q148 top-level Status lines, plus this order metadata

## Outcome

Record the existing authoritative resolutions in the two stale question headers,
including the canonical `## RESOLVED` markers required by `state.sh`, so ground-truth
status no longer counts Questions 147 and 148 as open.

## Authority

Question 147 is resolved by D-379/D-380 and the admitted Order 143 predecessor.
Question 148 is resolved by D-383 and the admitted Order 144 predecessor. This order
adds no decision and does not reinterpret or modify those records.

## Forbidden

No product, test, migration, schema, role, grant, policy, documentation, ledger,
review, decision, order lineage, or generated artifact changes. No merge, push,
deployment, or claim beyond status normalization.

## Proof

- Exact diff contains only this order and the two Q147/Q148 Status lines.
- Each question contains one concise canonical `## RESOLVED` marker with its existing
  decision reference.
- `git diff --check` is empty.
- `state.sh` no longer counts Q147 or Q148 as open.
