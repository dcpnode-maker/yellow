# Independent review — Order 160 local-review booking journey authority

**Verdict:** APPROVED
**Reviewed executable:** `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`
**Exact admitted Base:** `6f91eb69318ed7435bbac1aa29f986194d34c726`
**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer
**Date:** 2026-08-25

## Independence and scope

I did not implement Order 160. I read `PROJECT.md`, ran `./state.sh`, read Order160
and D-427, and applied the repository PostgreSQL and compliance review rules. No
builder output or stopped-candidate result is counted.

The admitted-Base-to-candidate diff contains exactly the twelve declared executable
paths: `scripts/seed-review.ts`, `docs/LOCAL-REVIEW.md`, the new journey proof and the
nine inherited exact-role assertions. `git diff --check` is empty. No production
role, route, domain, migration, schema, state, event, operator asset, dependency or
financial path changed. The worktree was clean before review evidence was written.

The implementation adds only the existing `reservations.booking:write` permission
to the deterministic local-review role, between rate-pricing and reservation-guest
permissions. Exact role and JWT oracles now require twenty-eight unique sorted
permissions. Both deterministic local identities retain the same one property-scoped
role; no wildcard or production-role authority was added.

## Exact Base denial and candidate success

I created a detached worktree at exact admitted Base `6f91eb6`, applied only the
candidate journey oracle as an untracked proof file, and recomputed both oracle
SHA-256 values. They were byte-identical:

`f396f964a1081c341e9c9bbdbfb154b41d2003a650feea98c6f7660f3431fb28`.

Each mode used a separately created exclusive PostgreSQL 16.15 cluster, distinct
deployment/runtime credentials and DSNs, unprepared runtime pools, and a fresh normal
plus review seed.

- exact Base `base-denied`: **1/1**, 32 assertions. Party creation/search, complete
  offer selection and hold placement/replay succeeded; reservation commit returned
  exact scope-missing 403, created zero reservation and reservation-idempotency
  artifacts, and preserved the active hold plus its one occupancy claim;
- candidate `candidate-success`: **1/1**, 61 assertions. The same journey returned
  201, replayed byte-identically, rejected changed same-key content with 409, and
  returned the reservation confirmation through the real HTTP composition.

The candidate proof used the server-returned sellable unit, rate-plan id and stay. A
scope-stripped token was denied before mutation. A separately persisted user with the
same booking scope but a real grant to a different property saw only that property and
was denied against the seeded property. Both denials left the active hold, occupancy
and reservation counts byte-equivalent.

The successful commit produced exactly one reservation, one booked segment, one
primary guest and one consumed hold; zero hold claims and one segment claim for the
exact half-open two-night period. Correlation-scoped outbox order was exact:

- Party: `party.created`;
- hold: `hold.created`, `occupancy.recorded`;
- commit: `hold.consumed`, `occupancy.released`, `occupancy.recorded`,
  `reservation.confirmed`.

The corresponding four facts were each singular. The three durable idempotency rows
were each singular, status 201, response-complete, claim/completion at the same
instant, retained exactly 86,400 seconds, and carried 64-hex key/request hashes plus
the expected response body. Raw keys, name, email, phone and WhatsApp values were
absent from idempotency, fact and outbox serialization; Party HTTP evidence exposed
only masked contact hints. Account, folio, journal, posting, payment instrument,
payment, document series, document and fiscal-submission counts were unchanged, and
the reservation had no folio.

## Focused and cumulative proof

I recreated a database before every focused file. The nine inherited exact-role files
plus the Party suite passed **70/70** with **550 assertions**:

- review seed 11/11; offline leases 6/6; holds 7/7;
- inventory 6/6; OOS policy 6/6; operational blocks 7/7;
- rate configuration 7/7; rate pricing 6/6; restrictions 6/6;
- Party profiles 8/8, including exact-role, authority and PII denial proofs.

The repository cumulative runner then recreated and removed its own database for
every mapped suite and passed **22/22 isolated suites**, including financial posting,
security-definer, app-role non-login, actor-bound idempotency, business-day seal,
reservation-parent occupancy, runtime database/DML authority and financial row-lock
proofs.

Standing and security gates on exact candidate:

- `bun test`: **181 passed, 465 skipped, 0 failed**, 2,138 assertions across 98 files;
- JWT, image pins, operator assets, security headers and token gates: **36/36**, 283
  assertions;
- fresh deployment acceptance: **6/6**, 13 assertions;
- live normalized schema: exact match to `tests/schema/expected.sql`;
- `bun run typecheck`, 64-file boundaries, 23-package licence policy and `bun audit`:
  pass/no vulnerabilities.

Protected SHA-256 values matched: immutable baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, and fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

Fresh app-never-started `./setup.sh --db-only` passed the invariant referee
**11 passed, 0 failed of 11** independently for both exact Base and candidate.

## Discarded preconditions and cleanup

One acceptance invocation was mistakenly pointed at the referee fixture database and
failed only its canonical-seed precondition; no product assertion from that run is
claimed. It was restarted on a freshly migrated and normally seeded database and
passed 6/6. Two schema-check attempts stopped before comparison because the required
schema database/Compose variables were absent or invalid; the correctly configured
fresh database then matched exactly.

Both exclusive Compose projects, containers, networks, PostgreSQL volumes and all
ephemeral proof databases were removed. The detached Base worktree and generated
review credentials were removed. Pre-existing Order147/159 workbench resources and
ports were not mutated.

## Verdict boundary

Order 160 is approved only at executable
`a4178ce4b3bdf1fd95b097439287802a1edb7f8c`. This approval does not merge, push,
deploy, widen reservation authority, approve public booking or payments, or claim
Phase 5/Cyber completion.
