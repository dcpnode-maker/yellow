# Order 347 fresh independent Tier-3 review

**Disposition:** WITHHOLD

**Reviewer:** `/root/order347_fresh_tier3`, fresh independent non-implementing
OpenAI Codex Tier-3 reviewer

**Exact reviewed candidate:** `5862299d3f744f1bc7a3d1961dd13451b05f1f15`

## Findings

### P1 — abort during work still executes a later scope

`BusinessDayRollWorker.run()` passes no abort signal into `drainOnce()`, and
`drainOnce()` does not inspect cancellation between scopes. A reviewer-owned
executable test supplied two due properties, paused the first command, aborted the
worker, released the first command, and required that no later property be invoked.
The exact candidate failed in 6.59 ms: actual calls were `[FIRST, SECOND]`, not
`[FIRST]`. A stopped worker can therefore perform a later financial-date write after
shutdown begins. This directly violates Order347 P6's prompt-abort-during-work and
no-later-write requirements. The production implementation must check the signal
before every scope (and keep the bounded lifecycle/failure semantics), with a
permanent executable regression. No implementation repair was made in this review.

### P2 — mandatory financial-postings permanent regression is stale and red

Order347 P7 explicitly requires the existing financial posting regression. Fresh
execution of `tests/financial-postings.integration.test.ts` produced **9 pass / 1
fail / 102 assertions**. Every functional P2–P5 posting, replay, rollback, seal,
tenant and 500-charge proof passed. The strict P1 catalogue assertion at line 194
still requires exactly **87** public base tables; the current approved and freshly
migrated catalogue is exactly **111**. The candidate therefore cannot satisfy its
own mandatory P7 gate. Repair only that exact stale integer under a separately
bounded oracle order; retain strict equality and rerun the complete regression. No
test repair was made in this review.

## Fresh executable evidence

I used repository-pinned PostgreSQL **16.15** in reviewer-owned container
`yellow-order347-review-pg`, loopback port59647 and tmpfs storage. I did not use
Compose, `.yellow`, port3000 or the stable local runtime.

- lineage: approved base `282fd22` is an ancestor; intentional red `2c6bfc7`, D984
  correction and implementation commits are present; exact candidate is `5862299`;
- migration0061 bytes SHA-256
  `50cf8593ac385b74fbe61da9d28f0ecf59b78297c7aff46ad073f34409efc34f`, exactly
  matching `schema_migration` version61;
- fresh migrations **61**, exact **111 tables / 101 policies / 10 FORCE-RLS / 2
  views**, and normalized direct fresh schema dump exact;
- both new functions are owned by `yellow_owner`, fixed-search-path and SECURITY
  DEFINER; write is app-only, discovery runtime-only, and PUBLIC is denied;
- focused PostgreSQL roll and worker: **9/0, 42 assertions** — property timezone and
  opposite-midnight/DST oracles, older open/sealed/unsealed backlog independence,
  today rerun, 20 contenders, atomic event failure rollback/retry, hostile tenant /
  property / kind / timezone / caller shape, direct-DML denial and bounded discovery;
- acceptance **23/0, 65** after canonical seed; runtime authority **10/0, 88**;
  runtime DML **5/0, 118**; SECURITY DEFINER containment **3/0, 174**;
  migration runner **39/0, 187**; business-day seal **3/0, 6**;
- standing suite **1,193 pass / 905 expected database skips / 0 fail / 18,417
  assertions**; TypeScript, 134-file boundaries, 23-package licences, audit zero,
  ancestry, protected baseline and diff hygiene pass;
- fresh isolated invariant database with migrations1–61 plus the canonical fixture:
  **11 passed / 0 failed of 11**.

The first acceptance invocation revealed the missing canonical seed;
it was seeded and rerun 23/0. The first referee invocation similarly lacked
`seed_fixture.sql`; a separate fresh database was migrated, loaded with the canonical
fixture and produced 11/11. These were reviewer-fixture errors, not candidate
findings. The abort proof file was reviewer-owned and removed after execution.

## Boundary

**WITHHOLD** approval of exact candidate `5862299d3f744f1bc7a3d1961dd13451b05f1f15`.
The PostgreSQL current-day product path, authority and permanent catalogue remain
green, but both findings are mandatory Order347 gates. This review grants no seal,
catch-up, readiness/carry, UI/local, merge, push, deployment, Phase5 or application
completion authority.
