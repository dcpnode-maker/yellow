# Independent review — Order 170 extension registrar approved integration

**Verdict:** APPROVED
**Reviewed candidate:** `8988089f96dd110810d78ac0839228ffb9406dc9`
**Product executable:** `b18aa577d4b1d21e7510054ae76fcd4549d82499`
**Admitted Base:** `b859517d858b77e4bbc64eea4d7d17d38913b2bb`
**Approved product source:** Order156 executable `f8d546a1cbf189a1b0a728b6e9b6d0424ae64c60`
**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer
**Date:** 2026-08-26

## Independence, admission and composition

I did not implement Order170 or Order156. I read `PROJECT.md`, ran `./state.sh`,
read Order170 and D-437/D-438, and applied the Yellow PostgreSQL and compliance
review rules. The immutable candidate is a clean descendant of admitted Order170
Base `b859517`; Base-to-candidate `git diff --check` is empty and the candidate
changes only the 25 authorized product paths plus additive Order170 governance.

The approved Order156 product oracle has exactly 25 non-governance paths. Twenty
candidate blobs are byte-identical to executable `f8d546a`; five are mechanical
current-lineage integrations. Direct inspection proved those five retain only the
newer approved reservation behavior around the exact registrar delta:

- `docs/CONTRACTS.md` retains the bounded reservation board/detail contract;
- `docs/LOCAL-REVIEW.md` retains the founder booking/UI walkthrough;
- `scripts/seed-review.ts` and its test retain `reservations.booking:write` while
  making the non-registrar pool unprepared;
- `src/server.ts` retains `ReservationBoardService` and `ReservationDetailService`
  while adding the validated registrar DSN and max-two unprepared registrar pool.

No old Order156 ancestry or excluded Order109–115 finance governance is imported.
Migration 0018 is the sole new migration; existing migrations, `bun.lock`,
`package.json`, the protected referee and fixture are byte-identical to Base.

## P0 — exact-Base bypass

On a detached exact `cb88b66` worktree and fresh isolated 17-migration database, I
connected genuinely as `yellow_runtime`, set the tenant transaction-locally and used
`SET LOCAL ROLE app_role`. The session/role oracle was true/true. A direct global
`extension_type` insert affected one row while the visible fact count stayed zero;
the row existed inside the transaction. `ROLLBACK` left exact row/fact counts zero.
The detached worktree, database, volume, network and authority file were removed.

## P1–P3 — candidate authority, behavior and catalogue

Fresh canonical candidate setup applied migrations 0001–0018 and returned **11
passed, 0 failed of 11** with the application never started. On a separate fresh
database, the Order156 capability suite passed **6/6** and proved direct runtime DML
SQLSTATE `42501`, exact principal/function authority, wrong tenant/property/principal
denial, bounded input, rollback, hostile `pg_temp`, concurrent replay/divergence and
dirty-backend settlement/reuse.

My independent catalogue query proved exact registrar LOGIN, NOINHERIT, connection
limit four, no superuser/createdb/createrole/replication/BYPASSRLS, zero memberships,
owned relations and owned functions, public-schema USAGE without CREATE, and no
generic table DML. The exact six-argument function is volatile SECURITY DEFINER,
owned by `yellow_owner`, with `search_path=pg_catalog, public, pg_temp`; only the
registrar can execute it, while PUBLIC, `app_role` and `yellow_runtime` cannot.

Personally executed affected proofs:

- registrar capability: **6/6**, 17 assertions;
- runtime database authority: **10/10**, 79 assertions, followed by exact credential
  reprovisioning because that disposable proof intentionally rotates role secrets;
- real seeded extension service/HTTP: **6/6**, 25 assertions, preserving
  403/201/200/409/422, tenant isolation, audit and compatibility behavior;
- runtime-DML recurrence: **5/5**, 66 assertions;
- SECURITY DEFINER containment: **3/3**, 29 assertions;
- current-lineage real unprepared reservation board/detail HTTP: **5/5**, 28
  assertions, preserving UUID detail, board and legacy confirmation compatibility.

The complete isolated phase runner passed **23/23 suites**, including the registrar,
runtime authority, 500-charge/1,000-line zero-drift financial proof and all inherited
reservation/rate/security prerequisites. Native Linux migration execution passed
**23/23**, 113 assertions. Deployment acceptance passed **6/6**, 13 assertions, and
the live normalized schema exactly matched `tests/schema/expected.sql`. Migration
0018 SHA-256 is
`77e80f10c1c148fe79dcf71c546afe87fbdf97ac7f320644f5e550c88d409fc3`.

## P4 — standing gates and secret non-retention

- frozen install: 23 packages, no changes;
- standing tests: **199 passed, 479 skipped, 0 failed**, 2,402 assertions across 103
  files;
- typecheck and 66-file boundaries: pass;
- licences: 23 packages; audit: no vulnerabilities; image pins: exact;
- focused JWT/assets/headers/token security: **33/33**, 289 assertions;
- protected SHA-256: baseline
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
  `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture
  `bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`;
- final founder listeners remained exact loopback ports 3000/3002 with unchanged
  owning process 4352; neither app/container was restarted or mutated.

The reviewer authority file had exactly the three expected pairwise-distinct
64-character values, was ignored/untracked, and after the native Windows ACL path had
one protected owner-only FullControl rule. Secret-value non-retention checks found
zero tracked-file matches, zero reviewer-container-log matches and zero residual
process-environment entries. Compose wiring exposed registrar authority only to the
application service; migrate, seed, review-seed and tools had zero registrar DSN.
All reviewer containers, databases, volumes, networks, the detached Base worktree and
both reviewer authority files were removed.

## Disclosed reviewer harness incidents

No stopped or malformed invocation is counted as evidence. Two Base SQL launcher
attempts stopped before SQL because of quoting and missing Compose interpolation; the
third exact invocation produced P0 above. One mistakenly combined Bun invocation ran
four database files concurrently against one database while the runtime-authority
proof rotated the cluster-global registrar credential; its 19 pass/5 fail output was
discarded. Two isolated extension attempts then used a migration-only database that
lacked the suite's canonical tenant/property fixtures and returned the expected
downstream 400 shape; the seeded restart passed 6/6. Acceptance was first pointed at
the referee fixture and passed 5/6 before the canonical-demo assertion stopped; the
correct `yellow_dev` restart passed 6/6. Two schema commands stopped before assertion
until both required environment inputs were supplied; the final live check matched.

The native Windows setup path tightened the authority ACL correctly, then hit its
inherited bounded readiness failure because the pre-Order156 variadic PowerShell
wrapper drops the `-d` argument to `pg_isready`. This is the exact inherited issue
disclosed in the independent Order156 approval; it is not called green. The canonical
`setup.sh --db-only` referee independently passed 11/11 on this candidate.

## Verdict boundary

Order170 is approved at exact candidate `8988089f96dd110810d78ac0839228ffb9406dc9`
with no finding. This approves only the registrar product composition onto the
Order169 lineage. It does not close Order150's other command-capability debt, approve
extension publication/status transitions, import excluded finance work, promote the
local app, merge, push, deploy or claim Phase-wide completion.
