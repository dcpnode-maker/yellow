# Order 044 — Handoff state and ledger accuracy

**Phase:** 2 · Review-handoff hygiene
**Branch:** `phase-2/handoff-state-accuracy`
**Tier:** 2 — read-only governance reporting
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Make both state scripts tell a returning reviewer the true active phase, the true open
question set, and the explicitly unreviewed provenance of Orders 027–043.

## Scope

- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/orders/044-handoff-state-accuracy.md`
- `handoff/questions/048-order-044-referee-connection-isolation.md`
- `handoff/questions/048-ARCHITECT-RESPONSE.md`
- `state.sh`
- `state.ps1`

## Required behavior

1. Derive the displayed phase from the highest numeric `**Phase:**` declared by an
   order. A Phase-0 tree with no open orders says merged baseline; a later stack says
   it is pending independent review.
2. Preserve D-82 markers and additionally treat numbered architect-response files,
   plus questions with a matching numbered architect response, as closed for counts.
   Question 041 must remain open and every unmerged Order 019–044 must remain open.
3. Keep Bash and PowerShell output/count logic equivalent and preserve the PowerShell
   optional-Docker exit isolation from Order 041.
4. Append traceable BUILT-UNREVIEWED ledger events for Orders 027–043. Do not invent
   approval, review, merge, or deployment status.

## Forbidden

- Any application, Compose, migration, test, workflow, referee, dependency, RLS,
  tenant, occupancy, journal, fiscal, order-status marker, approval, or merge change.
- Closing Question 041, marking any Order 019–044 merged, or rewriting review history.

## Pre-registered proofs

- **P1:** the active Bash report says Phase 2, exactly one open question (041), and
  lists every unmerged order without calling any independently reviewed.
- **P2:** a temporary Phase-0 fixture transitions one question open → matching response
  closed → response removed/open, in both Bash and PowerShell, while a response file is
  never itself counted open.
- **P3:** PowerShell still returns zero after a normally completed report with an
  unavailable optional Docker probe.
- **P4:** diff scope is exactly seven files and the standing self-check remains green.

## Standing checks

Run P1–P3, then the standing self-check from the top. Refresh Graphify, commit, push,
and open a draft descendant PR. Do not approve or merge.
