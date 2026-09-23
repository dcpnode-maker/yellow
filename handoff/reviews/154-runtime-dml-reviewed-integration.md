# Independent review — Order 154 reviewed runtime-DML integration

**Verdict:** APPROVED
**Reviewed executable:** `647ae907515f2e81e362beeff83ee97bc7101dc2`
**Base:** `aff09155d68ad3f69cd0a119e24b79e7f876fc56`
**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer
**Date:** 2026-08-25

## Independence and scope

I did not implement Orders 151–154. I read `PROJECT.md`, ran `./state.sh`, read
Order 154 and D-415 through D-419, and applied the repository compliance and
PostgreSQL review rules before executing this proof. No stopped Order-151 result or
builder result is counted here.

The candidate is an exact descendant of Base (`0` behind, `15` ahead), and
`git diff --check` is empty. Base-to-executable changes exactly 32 paths. A blob-level
comparison of every inherited path against the named Order-151, independently
approved Order-152, and Order-153 inputs found `0` mismatches; only the additive
Order-154 record and combined ledger are integration-owned. All three named input
heads are ancestors. The worktree was clean before review evidence.

Commands included:

```text
git rev-list --left-right --count aff0915...HEAD
git diff --name-status aff0915..HEAD
git diff --check aff0915..HEAD
git merge-base --is-ancestor <each-input> HEAD
git rev-parse <input>:<path> HEAD:<path>
```

Protected SHA-256 values independently matched the approved line: immutable baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, and fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

## P0 — exact Base exploit

I created a detached exact-Base worktree and two fresh migration-0016 databases.
With distinct deployment and runtime DSNs, the first canonical financial operation
in each affected suite failed exactly as pre-registered:

- account/folio opening: SQLSTATE `42501`, `permission denied for table account`;
- charge posting: SQLSTATE `42501`, `permission denied for table folio`.

Both databases and the detached worktree were removed before candidate proof.

## P1–P3 — focused authority and finance proof

Each suite used its own freshly recreated database with migrations 0001–0017:

| Suite | Result | Assertions |
|---|---:|---:|
| financial row-lock authority | 4/4 | 23 |
| financial folios | 12/12 | 90 |
| financial postings | 10/10 | 111 |
| runtime-DML authority | 5/5 | 66 |
| SECURITY DEFINER containment | 3/3 | 24 |

The proof executed exact function ownership/search path/ACLs, tenant/cardinality and
folio-linkage rejection, real blocking, unrelated-row freedom, rollback release,
`pg_temp` shadow resistance, opposite-order convergence, financial replay,
publication rollback, numbering reuse, seal races, tenant isolation, and the
500-charge/1,000-line stress case.

I also queried table privileges and attempted the affected runtime operations after
transaction-local tenant context and `SET LOCAL ROLE app_role`. Table-level
INSERT/UPDATE/DELETE were false for `api_idempotency`, `app_user`, `sellable_unit`,
and `task`. Sellable-unit UPDATE, app-user/task INSERT, idempotency all-column INSERT,
unauthorized-column UPDATE, and DELETE each returned exact SQLSTATE `42501`.

## Order-152 proof-maintenance union

All eight reviewed suites ran again on eight separately named fresh databases:

| Suite | Result | Assertions |
|---|---:|---:|
| fact log | 4/4 | 16 |
| idempotency | 6/6 | 44 |
| Party profiles | 8/8 | 119 |
| outbox | 7/7 | 24 |
| relay | 19/19 | 130 |
| reservation parent-before-occupancy | 7/7 | 45 |
| reservation lifecycle | 6/6 | 65 |
| reservation segment changes | 7/7 | 115 |
| **Total** | **64/64** | **558** |

The corrected stale-state fixture, observation ownership, exact idempotency-column
oracle, relay rollback entity binding, both required Party indexes and index-backed
plan all executed. Tenant, rollback, ordering, crash/retry, settlement/tamper,
parent-sequencing, concurrency and the 10,000-row relay backlog assertions remained
green.

## P4 — cumulative executable proof

On exclusive Compose project `yellow-o154-review-647ae90`, with private ports,
volume, deploy/runtime credentials and no app container:

- complete isolated phase runner: **22/22 suites passed** from freshly recreated
  databases;
- native Linux/WSL migration suite: **22/22**, 116 assertions, including executable
  invalid-file/symlink coverage;
- fresh deployment acceptance: **6/6**, 13 assertions;
- live normalized schema: exact match to `tests/schema/expected.sql`;
- fresh `./setup.sh --db-only` referee: **11 passed, 0 failed of 11**;
- standing `bun test`: **179 passed, 464 skipped, 0 failed**, 2,114 assertions across
  96 files;
- typecheck: pass; import boundaries: 64 TypeScript files, pass;
- licence policy: 23 packages, pass; `bun audit`: no vulnerabilities;
- image pins and JWT-secret security: **9/9**, 26 assertions.

The first WSL command sourced a Windows CRLF credential literally and failed
authentication before the migration suite initialized; a second quoting attempt did
the same. Both were discarded as reviewer harness errors. The final in-memory CRLF
normalization ran the complete 22/22 suite without changing the credential file.

During initial disposable-Base cleanup, Windows followed a reviewer-created
`node_modules` junction and removed the shared untracked dependency directory. The
coordinator restored it with the frozen lockfile. I stopped the active focused loop,
did not count it, created no further junctions, and restarted all five focused suites
from fresh databases. No tracked blob changed, and all subsequent gates ran against
the restored exact dependency tree.

## Verdict boundary

Order 154 is approved at exact executable
`647ae907515f2e81e362beeff83ee97bc7101dc2`. This approves only the reviewed union of
the bounded Order-151 financial lock capability, Order-152 proof corrections, and
Order-153 governance normalization. It does not merge, push, deploy, close remaining
runtime authority debt, or claim Cyber-wide completion.
