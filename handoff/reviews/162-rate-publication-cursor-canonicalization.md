# Independent review — Order 162 rate-publication cursor canonicalization

**Verdict:** APPROVED
**Reviewed executable:** `e1a97279bab4dfbe22846ff2ec8ac61f5a8d6984`
**Exact Base:** `6a5aa6ba778cf35e2075465163bb83b02fb3fe32`
**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer
**Date:** 2026-08-26

## Scope and contract

I did not implement Order162. I read `PROJECT.md`, ran `./state.sh`, read Order162 and
D-429, and applied the repository PostgreSQL review rules. The admission-to-candidate
diff is clean and contains exactly two implementation paths:

- `src/contexts/rates/publication.ts`;
- `tests/rate-publication.integration.test.ts`.

The production change is exactly one expression: the already validated cursor `Date`
is converted with `toISOString()` at its sole SQL binding, before the unchanged
explicit `timestamptz` cast. Encoder, decoder, unsigned policy, exact cursor fields,
base64url validation, canonical millisecond timestamp validation, lowercase UUID
validation, tuple predicate, descending `(created_at,id)` order, `limit + 1`, null
terminal cursor, query shape, schema, index, routes, permissions, state and events are
unchanged.

## Byte-identical Base red and candidate green

I created a disposable detached worktree at exact Base, replaced only its test oracle
with the candidate oracle and compared SHA-256. Both test files were byte-identical:

`4f34d463a90ce04eb9bfa710c349eb6621218bd4ef10ac38a04340ad8ec48136`.

Each focused run used a freshly migrated and normally seeded database on an exclusive
PostgreSQL 16.15 container, with Bun 1.3.14:

- exact Base, prepared mode: **1/1**, 26 assertions;
- exact Base, `prepare:false`: the first page succeeded and page two failed exactly at
  the cursor timestamp binding with PostgreSQL SQLSTATE `22007`, receiving Bun's
  noncanonical `Sun Aug 23 2026 ...` Date string;
- candidate parity mode: **1/1**, 33 assertions. Prepared and unprepared modes returned
  identical page-one/page-two IDs, the combined three tied-timestamp rows were exactly
  descending, unique and complete, and page two was terminal with a null cursor.

The same candidate oracle rejected noncanonical base64 text, ISO text without canonical
milliseconds, an extra JSON key, uppercase UUID and invalid UUID. It accepted a
structurally valid unsigned cursor with alternate coordinates and returned the expected
page, preserving rather than strengthening the existing unsigned contract.

## Focused, cumulative and static proof

The complete candidate publication file passed under the pinned Linux Bun 1.3.14 image:
**11/11**, 99 assertions. Its unchanged P8 250-to-500-cell bound completed in 9.02
seconds. The isolated phase runner then passed **22/22** suites with a fresh database per
suite, including publication **11/11**, universal rate builder **11/11**, quote,
financial, security-definer, runtime authority and reservation-parent proofs.

Standing and security gates on exact candidate:

- `bun test`: **181 passed, 465 skipped, 0 failed**, 2,138 assertions across 98 files;
- JWT, image pins, operator assets, security headers and token policy: **36/36**, 283
  assertions;
- `bun run typecheck`: pass; import boundaries: 64 TypeScript files;
- licence policy: 23 packages; `bun audit`: no vulnerabilities;
- live schema: exact match to `tests/schema/expected.sql`;
- fresh database acceptance: **6/6**, 13 assertions;
- fresh app-never-started `./setup.sh --db-only`: referee **11 passed, 0 failed**.

Protected SHA-256 values matched: immutable baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, and fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

## Discarded preconditions and cleanup

The full publication file on Windows passed the cursor and nine other cases but its
unchanged P8 wall-clock guard measured 15.48 seconds; an isolated Windows retry measured
15.50 seconds. Neither run is counted green. Under the pinned production Linux Bun
image, the identical isolated P8 passed in 7.58 seconds and the complete file passed as
recorded above. A first schema command omitted a Compose-required runtime password and
stopped before `pg_dump`; the correctly configured rerun matched exactly.

The exclusive containers, network, PostgreSQL volume, Linux dependency volume,
generated authority file and disposable Base worktree were removed. The active local
Order161 application and retained rollback resources were not mutated.

## Verdict boundary

Order162 is approved only at executable
`e1a97279bab4dfbe22846ff2ec8ac61f5a8d6984`. This approval does not merge, push,
deploy, alter the unsigned cursor contract, update the local app or claim broader
Phase 5 completion.
