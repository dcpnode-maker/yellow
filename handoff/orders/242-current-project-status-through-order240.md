# Order 242 — Current project status through Order 240

**Status:** BUILT-UNREVIEWED-D633
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

No HTML, CSS, client JavaScript, endpoint or field-structure, schema, migration, seed,
credential, Compose, runtime, local promotion, permission, dependency, merge or
production change is admitted. Only the recorded snapshot values and the additive
`built_unverified` recorded-work state literal change.

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
5. Phase states are exactly reviewed 0–3, built-unverified 4, active 5–7 and planned
   8–12. `roadmap.activePhase` remains 7 as the currently advancing phase while the
   unfinished Phase5 and Phase6 plans remain honestly active.
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

This order closes only as built-unreviewed.

## Built evidence

The intentional stale-snapshot proof failed before implementation. The focused
founder-status proof is green at 5/5 plus 2 expected database skips with 81
assertions. The standing suite is green at 820/820 plus 708 environment skips with
8,365 assertions across 1,528 tests/276 files. Strict typecheck, 90 import
boundaries, 23 dependency licences, zero-vulnerability audit, all four tracked
JavaScript syntax checks and diff hygiene are green. The change is confined to the
recorded snapshot, its exact proof and this order's governance files; review coverage
remains 91 and no local runtime was changed by Order242.
