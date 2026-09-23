# Order 162 — Rate publication cursor canonicalization

**Status:** READY — production-runtime pagination defect
**Phase:** 5
**Branch:** `phase-5/rate-publication-cursor-canonicalization`
**Base:** `6a5aa6ba778cf35e2075465163bb83b02fb3fe32`
**Risk tier:** 3 — rate-publication traversal completeness
**Owner:** Codex implementation; independent non-implementing Tier-3 review

## Outcome

Make rate-publication approval pagination behave identically under prepared test SQL
and the production-style Bun unprepared runtime. Canonicalize the already validated
cursor timestamp to UTC ISO at its sole SQL binding while preserving the existing
unsigned canonical cursor contract and exact tuple ordering.

## Scope

- `src/contexts/rates/publication.ts`;
- `tests/rate-publication.integration.test.ts`;
- this order, additive D-429, ledger and one additive independent review.

No schema, migration, route, state, event, permission, UI, runner, setup, dependency or
local-deployment path is in scope. If another implementation path is required, stop and
write a question.

## Required behavior and proof

1. Change only the decoded cursor timestamp SQL binding to
   `cursor.createdAt.toISOString()` with its existing explicit `timestamptz` cast.
   Do not change encoder, decoder, cursor fields, signature policy or ordering.
2. Preserve canonical base64url JSON cursor `{createdAt,id}`, descending
   `(created_at,id)` tuple ordering, limit behavior and null terminal cursor.
3. Using the existing three approved rows with tied timestamps and limit two, prove
   prepared and `prepare:false` runtime connections return identical page IDs; combined
   pages are exactly sorted with no duplicate or omission and page two is terminal.
4. Exact Base must reproduce the unprepared page-two timestamp failure while its
   prepared control passes. Candidate must pass both modes.
5. Malformed/noncanonical cursors remain fail-closed: noncanonical text, ISO without
   canonical millisecond form, extra key and uppercase/invalid UUID. A valid cursor with
   different coordinates is allowed because cursors are unsigned.

## Proof

- exact-Base prepared green/unprepared page-two red and candidate parity green on fresh
  real PostgreSQL;
- focused rate-publication suite plus rate builder/phase-3 coverage;
- standing tests, typecheck, boundaries, licences, audit, schema/runtime/security gates,
  protected hashes and fresh referee 11/11;
- independent non-implementing Tier-3 reviewer personally executes red/green and
  cumulative proof.

## Forbidden

- Cursor signing, schema/index/query-order changes, accepting noncanonical cursors,
  mock-only proof, UI/domain workaround, source widening, merge, push or deployment.

## Definition of done

- [ ] Exact Base fails only the unprepared page-two binding and candidate passes both.
- [ ] Prepared/unprepared page IDs and terminal behavior are identical and complete.
- [ ] Full gates and fresh referee pass; independent Tier-3 review approves.
