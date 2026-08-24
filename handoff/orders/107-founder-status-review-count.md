# Order 107 — Founder-status review-count accuracy

**Phase:** 5 governance/visibility correction; no financial capability change  
**Branch:** `phase-5/founder-status-review-count`  
**Base:** `725fb11`  
**Risk tier:** 1 — recorded-status presentation and exact asset proof  
**Owner:** Codex

## Outcome

Correct the founder-status Review coverage card so its headline displays the recorded
independent-review boundary, not the separate Gate-3 debt count. With the current
committed snapshot the card must say `91 orders`, its accessible progress must say 91
of the latest built order, and the supporting sentence must disclose both the exact
review boundary and zero Gate-3 manifest debt.

## Natural-Solution Test

The authenticated status response already returns both correct values:
`independentlyReviewedThroughOrder = 91` and `gate3Debt = 0`. The browser binds the
headline labelled “Review coverage” to the wrong field. The natural repair is one
field-binding correction plus a source regression assertion; no API, database, review
document, coverage derivation or subjective percentage is required.

## Scope

- `src/http/operator/index.html`
- `src/http/operator/operator.js`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, and `DECISIONS.log`

## Required work

1. Rename the misleading `status-debt` DOM binding to `status-reviewed` and render
   `${snapshot.review.independentlyReviewedThroughOrder} orders` in its headline.
2. Keep Gate-3 debt visible in the supporting copy as a separate named value. Never
   present debt as completed review, and never present a progress percentage without
   its exact numerator/denominator.
3. Keep the progress element's value equal to
   `independentlyReviewedThroughOrder` and max equal to `latestBuiltOrder`.
4. Add an exact asset regression proof that fails on the current wrong binding and
   proves the review headline cannot read `gate3Debt`.
5. Advance the recorded build/current order to 107 while retaining the conservative
   generated independent-review boundary of 91. Order 106 is artifact preservation;
   Order 107 is this routine correction. Neither receives fabricated independent review.
6. Rebuild/restart the local operator app and verify the authenticated status response
   and rendered source contract. Report the corrected value to the founder in chat.

## Forbidden

- Editing review evidence or hardcoding a false review boundary
- Treating routine builder proof as independent approval
- Changing the status API shape, auth, scopes, database, schema, migrations or domains
- Subjective completion percentages, fabricated CI/worker liveness, or prototype data
- Adding Cyber/security findings to the workbench; those are reported in chat as asked
- Touching user-owned `.agents/`, `.codex/hooks.json` or `handoff/chat-archive/`

## Pre-registered proof

### P0 — intentional red

The focused asset proof requires a `statusReviewed` binding sourced from
`independentlyReviewedThroughOrder`, rejects a review headline sourced from
`gate3Debt`, and fails on the current implementation before production assets change.

### P1 — exact rendering contract

The focused founder-status suite proves the snapshot stays exact and assets render the
reviewed count, progress numerator and Gate-3 debt as distinct semantics.

### P2 — standing and local runtime

Typecheck, boundaries, standing tests and the 11/11 referee remain green. The rebuilt
local app returns HTTP 200 and an authenticated snapshot with latest/current 107,
review boundary 91 and Gate-3 debt zero.

## Definition of done

- [x] Order exists before implementation.
- [x] Intentional asset proof is committed red before production assets change.
- [x] Review headline uses independent-review coverage, not debt.
- [x] Debt remains separately and accurately labelled.
- [x] Snapshot reports Order 107 without changing review truth.
- [x] Focused, standing and referee gates are green.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
