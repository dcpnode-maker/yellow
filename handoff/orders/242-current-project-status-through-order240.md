# Order 242 — Current project status through Order 240

**Status:** READY-D632
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/current-project-status-order240`
**Base:** `7d0adce` (built-unreviewed Order240)
**Risk tier:** 1 — founder-visible recorded-status truth only
**Owner:** Codex implementation; independent review deferred by founder build-first direction

## Outcome

Refresh the authenticated Project Status snapshot from the stale Order189/190 position
to the exact built Order240/current Order242 position without inflating review coverage
or changing product, database, credential or runtime behavior.

## Scope

- `src/project-status.ts`;
- `tests/founder-status.integration.test.ts`;
- this order, `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, CSS, client JavaScript, API shape, schema, migration, seed, credential,
Compose, runtime, local promotion, permission, dependency, merge or production change
is admitted.

## Required truth

1. `recordedAt` is `2026-08-28`; `latestBuiltOrder` is 240, `currentOrder` is
   242, `activePhase` is 7 and `phaseCount` remains 13.
2. `independentlyReviewedThroughOrder` remains exactly the generated contiguous 91;
   later approvals are named milestones and builder-only work is never called reviewed.
3. Preserve every existing recorded-work row through Order189. Append independently
   approved milestone Orders190, 191, 192, 193 and 195; exclude Order194, which has no
   built/approved outcome.
4. Append compact built-unverified milestone ranges at Order199 for Orders196–199,
   Order236 for Orders200–236 and Order240 for Orders237–240, each with explicit
   remaining review and no-completion boundaries.
5. Phase states are exactly reviewed 0–3, built-unverified 4–6, active 7 and planned
   8–12. Exactly one phase is active.
6. The existing authenticated endpoint remains the only rendering source and returns
   the exact deeply immutable snapshot without credentials or invented live truth.

## Proof

- exact intentional red for stale date/roadmap/range milestones/phase vector;
- `bun test tests/founder-status.integration.test.ts`;
- full suite, typecheck, boundaries, licence, audit, JavaScript and diff hygiene.

## Forbidden

- contiguous review coverage above 91;
- treating Orders199/236/240 or their ranges as independently approved;
- claiming Phase5, Phase6, Phase7 or application completion;
- local rebuild/promotion, database or credential mutation in this order.

This order may close only as built-unreviewed.
