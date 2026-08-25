# Order 164 — Post-163 approved integration and truthful founder status

**Status:** READY — integration prerequisite for the reservation desk
**Phase:** 5 · founder usability
**Branch:** `phase-5/post163-approved-integration-status`
**Base:** `2b02e25931747891fc0ee1bff45e11b49433d689`
**Risk tier:** 2 — approved-lineage integration and presentation metadata
**Owner:** Codex implementation; independent non-implementing review before local replacement

## Outcome

Reconcile the independently approved Order162 product correction with the independently
approved Order163 local-login handoff, then make the founder status surface accurately
describe the integrated frontier. This is the mandatory clean base for the next
reservation-desk UI order; it does not itself claim that the reservation UX is complete.

## Scope

- exact cherry-pick of Order162 executable `e1a97279bab4dfbe22846ff2ec8ac61f5a8d6984`;
- exact cherry-pick of Order162 review evidence `493e5d0619a68bd597227ffbb6fd65292a31abf6`;
- `src/project-status.ts`;
- `tests/founder-status.integration.test.ts`;
- this order, one additive decision, `handoff/LEDGER.md`, and one additive review.

No other source, UI asset, route, service, migration, schema, permission, credential,
container definition, domain behavior, test oracle or local runtime is in scope. If
another path is required, stop and write a question.

## Required behavior

1. Preserve the exact approved Order162 product and review commits while retaining all
   Order163 operational evidence and founder-login handoff history.
2. Report `recordedAt` as `2026-08-26`, latest built order `163`, current order `164`,
   Phase 5 active, thirteen phases total, and contiguous independent review coverage
   through Order091 only. Do not imply phase-wide or deployment approval.
3. Record Orders 156, 160, 161, 162 and 163 as independently approved and Order164 as
   proof in progress, using historical wording that does not become false after later
   local promotion.
4. Preserve all existing phase states: 0–3 reviewed, 4 built-unverified, 5 active and
   6–12 planned.

## Proof

- exact ancestry/diff proof for the two approved lineages and their immutable commits;
- focused founder-status suite, standing tests, typecheck, boundaries, licences and
  clean audit;
- fresh app-never-started `./setup.sh --db-only` referee with exactly 11/11;
- independent non-implementing review of the immutable candidate.

## Forbidden

- Reimplementing or modifying Order162 behavior, altering Order163 credentials/runtime,
  presenting Order164 as a reservation-UX deliverable, merging, pushing, deploying,
  self-review or self-merge.

## Definition of done

- [ ] Both approved lineages are present without semantic conflict.
- [ ] The founder status is truthful and focused/full gates pass.
- [ ] An independent reviewer approves one immutable candidate.
