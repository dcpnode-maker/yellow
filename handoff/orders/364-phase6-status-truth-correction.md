# Order 364 — Phase-6 recorded-status truth correction

**Status:** ACTIVE-D1027
**Phase:** 6 — Stay operations and housekeeping (status-only correction)
**Branch:** `phase-6/status-truth-correction`
**Base:** current descendant head containing approved D974 ancestry
**Risk tier:** 1 — authenticated recorded-status wording only
**Owner:** Codex

## Outcome

Make the founder-visible recorded snapshot reflect the already-approved Phase-6 exit
gate under D974. This does not add functionality or claim current-head re-review.

## Exact scope

- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- this order and exact decision evidence

Change Order236 from `built_unverified` to `independently_approved`, name D974's
bounded Orders342–345 Phase-6 exit approval, and retain the exclusions for deferred
discrepancy resolution, queues/messages, later phases, merge and deployment. Change
only Phase6 from `active` to `reviewed`. Preserve Phase5 and Phase7 as active,
`activePhase: 7`, Phase4 built-unverified, review-through91, and Phases8–12 planned.

## Proof

Focused founder-status integration must assert the exact Phase vector and that only
Order199 remains `built_unverified`. Typecheck and diff hygiene must pass.

## Forbidden

No generated review coverage, endpoint/client/UI, product behavior, schema,
migration, seed, database, credentials, runtime/local promotion, Docker, `.yellow`,
merge, push, deployment, or Phase5/7/application completion claim.
