# Order 179 — Current founder Project status

**Status:** APPROVED — D-460
**Phase:** 5 · founder-visible status truth
**Branch:** `phase-5/current-project-status`
**Base:** `88415d2` (independently approved Order178)
**Risk tier:** 1 — authenticated recorded-status presentation only
**Owner:** Codex implementation; independent status review

## Outcome

Make the existing authenticated Project status surface truthfully reflect the current
approved build lineage through Order178 instead of the stale Order163/164 snapshot.
Keep the contiguous independent-review metric at its separately derived value and
distinguish offline scenario foundations from imported application data.

## Scope

- `src/project-status.ts`;
- `tests/founder-status.integration.test.ts`;
- this order, additive D-459, `handoff/LEDGER.md`, and one independent review.

No HTML, CSS, client JavaScript, API, schema, migration, seed, fixture, generated
review coverage, credential, Compose, runtime, route, permission, dependency, local
promotion, merge, push or deployment change is in scope.

## Required truth

1. `latestBuiltOrder` is 178 and `currentOrder` is 179.
2. The recorded-work list preserves existing entries and adds only actual approved
   Orders 165, 166, 168, 169, 170, 171, 173, 174, 175, 176, 177 and 178 with their
   exact bounded approval meaning.
3. `independentlyReviewedThroughOrder` remains generated from the review-coverage
   artifact and is not inflated above 91 by later non-contiguous approvals.
4. Order178 says explicitly that its India/Canada scenario foundations are offline
   deterministic UAT inputs and have not been imported into the application.
5. Phase states remain truthful: 0–3 reviewed, 4 built-unverified, 5 active and 6–12
   planned. No phase-wide completion or production deployment is claimed.

## Proof

- focused snapshot contract and exact recorded-work tests;
- existing authenticated status API/UI tests remain green without presentation edits;
- standing tests, typecheck, boundaries, licences, audit and gzip remain green;
- independent reviewer verifies exact D-455/D-458 evidence and served status JSON from
  a single disposable stack without promoting it to port 3000.

## Definition of done

- [x] Project status is current through approved Order178 and names Order179 active.
- [x] Contiguous review coverage remains truthful at 91.
- [x] Offline scenario data is not represented as imported or live.
- [x] Builder gates pass.
- [x] Independent review approves the immutable candidate before local promotion.
