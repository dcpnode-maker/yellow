# Independent review — Order 117 local-login abuse controls

**Verdict:** APPROVED  
**Risk tier:** 3  
**Reviewer:** independent non-implementing OpenAI Codex security reviewer  
**Implementation reviewed:** `6fa77448fe65ea775ceb280410b85a96d63c3933`  
**Required red parent:** `9fc39e31a6aa3d2c7d406ac4946a123ae2554434`  
**Order:** `handoff/orders/117-local-login-abuse-controls.md`

This approval is exact-SHA and exclusive to `auth.unbounded-local-login`
(`occ_53a4e9f042a7a3534d9830fb`). It does not approve a branch name, a later
commit, integration, deployment, public exposure, a multi-process limiter, or any
sibling Cyber finding.

## Findings

No Order-117 implementation or scope finding.

The reviewed runtime constructs one `LocalLoginGuard` for its one reachable local-login
service. Each syntactically valid attempt consumes the normalized account and authoritative
peer-source budgets before database lookup or password work. Real, wrong-password and
dummy nonexistent-account verification all pass through the same four-slot, zero-queue
semaphore, and the slot is released in `finally`. No password, hash, token, request, body,
response or account-existence bit is retained by the guard.

The implementation uses exact source capacity 5/refill 20 per 60 seconds, account capacity
3/refill 8 per 15 minutes, and failure backoff 1/2/4/8/16/32/60 seconds. Success clears only
the failure/backoff fields. Token credit remains spent. Retry values are ceiling-rounded
integers clamped to 1–900 seconds.

State is bounded to 4,096 source and 8,192 account entries. Maps are insertion-ordered LRU;
every touch moves one entry to the tail, reclamation inspects at most 64 oldest entries, and
admission fails closed while the oldest live entry is not reclaimable. No timer, sleep,
promise waiter, dependency, table, migration, credential lockout or forwarded-header trust
was added.

Only `server.requestIP(request)` supplies a runtime source. Invalid or missing peer metadata
becomes shared `unknown`; `Forwarded`, `X-Forwarded-For` and `X-Real-IP` never enter the
authority path. The exact 401 body remains generic; every 401/429 is `no-store`, and every
limiter cause shares one 429 problem shape.

The reviewed range changes only Order-117-scoped files. D-91 JWT claims/TTL, Order-116
secret rejection, Argon2id parameters, database identity lookup, tenant/property grants,
request-body ceiling and loopback/public-binding gates remain unchanged.

## Reviewer-executed evidence

All execution used detached worktrees and the unique Compose project
`yellow-review117-volta` on app/PostgreSQL/Valkey ports `4271/5771/6671`. The live `yellow`
project and builder branch were not changed.

### P0 — exact parent red

Detached parent at `9fc39e31a6aa3d2c7d406ac4946a123ae2554434`:

```text
bun test tests/local-login-abuse.test.ts
```

Result: `0 pass, 1 fail, 1 error`. The test module could not import
`LocalLoginLimitedError` because the parent intentionally contains the preregistered proof
but no guard/export. This is the expected before-production red, not a later test mutation.

### P1/P2 — budgets, backoff, concurrency and bounded state

Exact implementation SHA:

```text
bun test tests/local-login-abuse.test.ts
```

Result: `10 pass, 0 fail, 78 assertions`.

The reviewer additionally executed an independent inline edge harness against the exact
module. It proved strict rejection of zero, negative, fractional and unsafe entry caps;
fractional clock rejection; monotonic behavior across a clock rollback; live-cap fail
closed without growth; expired-oldest deterministic reclamation; invalid-key admission
without state growth; and 1–900 clamping for negative, NaN and infinite retry inputs.
Result: `edge-challenge-pass`.

Direct source inspection confirmed token-credit math uses one credit millisecond per elapsed
monotonic millisecond: source cost `60,000/20 = 3,000` and account cost
`900,000/8 = 112,500`, with maximum credit equal to exact capacity times cost. The fifth
concurrent verification returns immediately, executes no callback, exposes zero waiters,
and thrown verification releases its slot.

### P3 — authoritative source and indistinguishable HTTP outcomes

The focused suite started a real Bun listener and showed the same TCP peer remained
`ipv4:127.0.0.1` despite forged forwarding headers; direct `app.handle` used `unknown`.

The exact app image was then built with a fresh 48-byte CSPRNG signing secret and a seeded
dummy hotel. Sanitized real-HTTP evidence showed:

- health 200; valid login 200 with `Bearer` and 900-second expiry;
- the returned token successfully accessed `/api/v1/me/properties` with 200;
- wrong existing and nonexistent identities returned byte-equivalent generic 401 problems
  after correlation removal, both `no-store`;
- after an isolated app restart, both identities returned the same immediate 429/backoff
  problem and exact `Retry-After: 1` after their first indistinguishable 401;
- a bounded ten-request burst with ten different forged forwarding values returned four
  401s then six 429s, proving forged headers created no new source budgets; all six 429
  problem bodies were identical, all retries were within 1–900, and every response was
  `no-store`.

Malformed/semantically invalid inputs remain outside the rolling account/source buckets as
the order specifies, but their dummy Argon2 work remains inside the same four-slot zero-queue
cap. This local single-process control is not represented as public-edge denial-of-service
protection.

### P4 — real database and Order-116 regression

Fresh isolated PostgreSQL applied migrations `0001`–`0011`. Against the exact required
environment variables:

```text
$env:YELLOW_OPERATOR_WORKBENCH_URL='postgres://yellow:yellow@127.0.0.1:5771/yellow_dev'
$env:YELLOW_REQUIRE_OPERATOR_WORKBENCH='1'
$env:YELLOW_AUTH_URL='postgres://yellow:yellow@127.0.0.1:5771/yellow_test'
$env:YELLOW_REQUIRE_AUTH='1'
bun test tests/operator-workbench.integration.test.ts tests/auth.integration.test.ts
```

Result: `11 pass, 0 fail, 120 assertions`. This personally exercised real Argon2id records,
valid token issuance, uniform wrong/missing credential failures, exact throttling and
recovery, rejected-connection reuse, bearer/scope/property authorization, and tenant A/B
isolation.

```text
bun test tests/jwt-runtime-secret-security.test.ts tests/token.test.ts
```

Result: all fourteen Order-116/JWT tests passed. Repository-known keys remain rejected,
fresh independent keys work, the exact D-91 claim contract remains fixed, and tampered,
unsigned, wrong-algorithm, wrong-audience and expired tokens remain rejected.

### P5 — standing and repository integrity

```text
bun test
bun run typecheck
bun run boundaries
```

Results: `163 pass, 395 skip, 0 fail, 1,917 assertions`; TypeScript clean; import
boundaries clean with `64 TypeScript files scanned`.

The Windows dependency junction made the checker in the detached worktree report zero
packages. That was not accepted as evidence. The reviewer independently SHA-256-compared
`scripts/license-check.ts`, `package.json` and `bun.lock` between the exact worktree and the
installed root tree; all three were byte-identical, then ran the unchanged checker over the
real installed tree:

```text
bun run license-check
bun audit
```

Results: licence policy passed for `23 installed package(s)`; `No vulnerabilities found`.

```text
$env:COMPOSE_PROJECT_NAME='yellow-review117-volta'
$env:YELLOW_SCHEMA_DATABASE='yellow_dev'
bun run schema:check
```

Result: exact match to `tests/schema/expected.sql`.

```text
./setup.ps1 -DbOnly
```

Result: eleven migrations, 85 public tables, RLS `75/75`, and canonical referee
`11 passed, 0 failed of 11`.

Protected SHA-256 values exactly match `handoff/GATE-3-MANIFEST.md`:

- `migrations/0001_init.sql` —
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
- `tests/run_invariants.py` —
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`

`git diff --check 9fc39e3..6fa7744` passed. The builder worktree was clean at the exact SHA
before this reviewer-authored record.

## Disclosed reviewer precondition corrections

These runs are not counted as green evidence:

1. WSL `state.sh` startup was denied by this review sandbox; repository state was instead
   verified with Git plus the required constitution/order/architecture/decision sources.
2. The first combined database command supplied generic `DATABASE_URL`, so the two suites
   correctly skipped their database blocks. It was discarded and rerun with their exact
   `YELLOW_OPERATOR_WORKBENCH_URL`/`YELLOW_AUTH_URL` requirements, producing 11/11 green.
3. The first schema command supplied `DATABASE_URL`; the script correctly required
   `YELLOW_SCHEMA_DATABASE`. The discarded run was replaced by the exact green command.
4. The first junction-backed licence command saw zero packages. Only the byte-identity
   comparison plus the 23-package installed-tree result is accepted.
5. An initial runtime expectation placed the 429 one attempt too early: that third account
   attempt correctly consumed the account's last token and returned 401; its immediate
   fourth attempt returned the expected 429. The fresh-restart equivalence and bounded-burst
   challenges above then proved the exact intended boundary.

## Residual scope — thirteen Cyber findings remain open

This review closes only `auth.unbounded-local-login`. Order 108 and Order 116 previously
closed only temporary-schema definer shadowing and the repository-known JWT key. Remaining:

1. `database.caller-controlled-rls-tenant` — high — `occ_48ef46aabb565be569c6e79d`
2. `database-grants.runtime-role-direct-dml` — medium — `occ_f0526a0906f1b0b5a72edf0c`
3. `database.occupancy-caller-tenant` — high — `occ_2f4ca8c2e6f1d7352ba849c8`
4. `database.public-destructive-maintenance` — high — `occ_0c5b4cfc4934049849c99d8f`
5. `database.runtime-bootstrap-superuser` — high — `occ_235bd4dcea3d48cd3f611759`
6. `supply-chain.unpinned-project-mcp` — medium — `occ_f2201362eef2a3df87abf1b3`
7. `actorless-api-idempotency` — low — `occ_2160f7211ebce346c54b759e`
8. `unbounded-external-rate-intent-requests` — medium — `occ_227ec2963a84e30663d4d7db`
9. `regular-expression.unbounded-extension-schema` — low — `occ_623ba52de928bfe323127e66`
10. `supply-chain.mutable-container-tags` — low — `occ_b05bc911e6d4fb6de7b6382e`
11. `broken-property-authorization.party-search` — low — `occ_ba3b2f7be81a2793ac34384a`
12. `authorization.party-duplicate-oracle` — low — `occ_a18c087af2ee0041e610dc85`
13. `privacy.reservation-notes-durable-events` — low — `occ_0f9a3b20577c0bf2f247d392`

The app-side limiter remains deliberately per process. Any additional process receives its
own bounded budget; shared/public limiting and trusted-proxy topology remain later policy.

## Conclusion

Order 117 is **APPROVED** at exact SHA
`6fa77448fe65ea775ceb280410b85a96d63c3933`. No implementation, commit, push, merge,
integration or deployment action was taken.
