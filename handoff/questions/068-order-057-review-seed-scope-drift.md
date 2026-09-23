# Question 068 — Inherited review-seed scope assertion drift

## Trigger

Order 057's inherited P7 sequence stopped in `review-seed.integration.test.ts` at 4 pass /
1 fail. The seeded login correctly returned the established 15-scope operator role, while
the Order 046 assertion still expected the 9-scope role that existed before Orders 053–055
added blocks, policy and holds. Order 055 already proves the exact 15-scope string.

The stale file is not listed in Order 057 Scope, so it cannot be corrected silently.

## Requested correction

May Order 057 add `tests/review-seed.integration.test.ts` to Scope and replace only P5's
old exact 9-scope string with the established exact 15-scope string?

Keep exact equality (no subset assertion), change no seeder/product code, recreate the
database, and restart the full inherited review-seed/workbench/availability/operational-
block-availability sequence.

## Status

ANSWERED by the temporary architect in `068-ARCHITECT-RESPONSE.md`; independent review
remains debt.
