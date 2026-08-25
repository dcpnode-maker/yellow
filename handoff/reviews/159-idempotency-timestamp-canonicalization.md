# Independent review — Order 159 idempotency timestamp canonicalization

**Verdict:** APPROVED
**Reviewed executable:** `ba3adf2d987a5b133676cb3af65ab43da4cef9df`
**Base:** `f2c436b9b5181eb00795956aff847537df638030`
**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer
**Date:** 2026-08-25

## Independence and scope

I did not implement Order 159. I read `PROJECT.md`, ran `./state.sh`, read Order159
and D-426, and applied the repository PostgreSQL review rules. No builder output or
stopped-candidate result is counted.

The candidate is an exact Base descendant (`0` behind, `3` ahead). Base-to-candidate
scope is exactly the admitted five paths: D-426, ledger, order, shared idempotency
source and its focused test. `git diff --check` is empty. The correction after stopped
candidate `d8a01f9` changes only the in-scope order and removes its one extra EOF blank
line. The worktree was clean before evidence was written.

The implementation changes only the shared primitive: one validated clock result is
converted to UTC ISO once for the claim/completion instant, its exact 24-hour expiry
is converted once, and all three binds carry explicit `timestamptz` casts. The only
focused-test change selects the production-equivalent unprepared runtime pool. No
schema, migration, retention, hash, domain, HTTP or UI path changed.

## Exact pinned-Linux red/green

I created a detached exact-Base worktree and fresh exclusive PostgreSQL 16.15 cluster,
built the repository's digest-pinned `oven/bun:1.3.14-alpine` runtime target, confirmed
`bun --version` was `1.3.14`, and applied the candidate's `prepare:false` oracle to
the exact Base source. The first claim failed before its callback with PostgreSQL
SQLSTATE `22007`:

```text
invalid input syntax for type timestamp with time zone:
"Wed Jan 02 2030 03:04:05 GMT+0000 (Coordinated Universal Time)"
```

Deploy-side probes then returned exactly zero idempotency, fact, outbox and Party
artifacts. The same pinned runtime and unprepared path against the candidate passed
the complete focused suite **6/6**, 44 assertions. It proved exact persisted
created/completed instants, 86,400,000 ms retention, hashed identity, replay/conflict,
expired reclaim, 20-way one-execution contention, rollback and tenant/RLS isolation.

An initial exact-Base invocation using the inherited prepared test pool passed and was
discarded because it did not exercise the production pool; this is the proof blind
spot corrected by the candidate test. An earlier read-only-bind container failed to
start before Bun execution and was also discarded. Neither is counted as red or green.
The Base cluster, image and worktree were removed before candidate proof.

## Real shared consumers and served journey

On separate fresh migration-only databases inside the same pinned Bun 1.3.14 Linux
runtime:

- operator Party HTTP suite: **8/8**, 151 assertions;
- second direct idempotency consumer, operator inventory: **6/6**, 44 assertions.

The suites preserved exact replay, changed-request conflict, publication rollback,
authority denial, audit/outbox behavior and domain validation. A first combined run
was discarded during setup because it was pointed at the invariant referee database,
whose fixture intentionally conflicts with the launch seed; no domain assertion ran.
Both suites were restarted from zero on their correct migration-only databases.

I independently compared the port-3002 preview's
`/app/src/kernel/idempotency.ts` SHA-256 to the immutable candidate; both were
`5846ed4e12a6130a27e1c56f38e64d96540b5dde74b142d5b34cd983c916d03a`, and its
health endpoint returned OK. I then started my own isolated pinned candidate service
on port 3093 and executed authenticated login → empty Party search → Party create →
search. HTTP statuses were `200/200/201/200`, `idempotency-replayed=false`, the new
Party was returned by search, server logs contained zero error lines, and durable
Party/fact/outbox/idempotency counts were exactly `1/1/1/1`. Its durable claim had
`created_at = completed_at`, exact `86,400,000` ms retention and response status 201.

## Cumulative proof

On exclusive project `yellow-o159-review-ba3`, private ports and private credentials,
with ports 3000/3001/3002 preserved:

- fresh canonical `./setup.sh --db-only`: **11 passed, 0 failed of 11**;
- standing `bun test`: **181 passed, 464 skipped, 0 failed**, 2,138 assertions across
  97 files;
- runtime database authority: **9/9**, 63 assertions;
- JWT, image pins, operator assets, security headers and token gates: **36/36**, 283
  assertions;
- deployment acceptance: **6/6**, 13 assertions;
- live normalized schema: exact match to `tests/schema/expected.sql`;
- typecheck, 64-file boundaries, 23-package licence policy and `bun audit`: pass.

Protected SHA-256 values matched: immutable baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, and fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

All exclusive reviewer containers, databases, volumes, images and the Base worktree
were removed. The pre-existing preview and ports 3000/3001 were not replaced or
mutated, its pre-existing ignored authority file was preserved, and no review password
was retained.

## Verdict boundary

Order 159 is approved only at executable
`ba3adf2d987a5b133676cb3af65ab43da4cef9df`. This does not merge, push, deploy,
approve Order158, close unrelated findings, or claim wider Cyber completion.
