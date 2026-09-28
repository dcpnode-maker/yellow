# Order 117 — Local-login abuse and Argon2 work controls

**Phase:** 5 security correction  
**Branch:** `phase-5/local-login-abuse-controls`  
**Base:** exact independently approved Order 116 implementation SHA `f15e142803fe9bf6859176e7e4334419a8202bd6`
**Risk tier:** 3 — unauthenticated credential boundary and memory-hard work  
**Owner:** Codex implementation; independent non-implementing reviewer required  
**Cyber finding:** `auth.unbounded-local-login` / `occ_53a4e9f042a7a3534d9830fb`  
**Status:** APPROVED at exact implementation SHA `6fa77448fe65ea775ceb280410b85a96d63c3933`; integration pending

## Outcome

One reachable Yellow process bounds online credential guesses, distinct-account spray,
Argon2 concurrency and limiter memory without revealing whether an account exists.
Local loopback remains zero-configuration. Forwarded client-address headers are ignored.

This is explicitly a single-process control. Multi-process/public deployment requires a
later shared limiter and an approved trusted-proxy topology; this order never claims it.

## Natural-Solution Test

The login pool does not bound password work because Argon2 runs after its database
connection is released. A bounded in-process guard at the existing login service is the
smallest natural control for Yellow's current one-process local workbench: two token
buckets, capped failure backoff, a zero-queue semaphore and bounded state. PostgreSQL
rows, Valkey authority, a new dependency or trusting attacker headers would add worse
state or new attack surfaces before the multi-process trigger exists.

## Scope

- `src/contexts/identity/login-guard.ts`, `local-login.ts`, and identity public exports
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts` only for authoritative peer-key
  plumbing and exact 429/no-store response behavior
- `tests/local-login-abuse.test.ts`, focused additions to
  `tests/operator-workbench.integration.test.ts`
- `docs/LOCAL-REVIEW.md`, `docs/SECURITY.md`, `docs/research/CAPABILITY-MATRIX.md`
- project status only after every product/runtime proof is green
- this order, `handoff/LEDGER.md`, `DECISIONS.log`, `handoff/questions/`, and the
  independent review record

## Required work

1. Add one injected-clock `LocalLoginGuard`; it stores no password, hash, token, raw
   request/body or response. Use monotonic time for refill/expiry and strict integer
   configuration validation. Production defaults are fixed in source, not caller JSON.
2. Source bucket: capacity 5 and refill 20 tokens per 60 seconds. Account bucket:
   capacity 3 and refill 8 tokens per 15 minutes. The account key is the same normalized
   tenant slug plus NUL plus normalized email for both real and nonexistent accounts.
   Every syntactically valid attempt, successful or not, consumes both budgets.
3. Failed authentication starts exact backoff 1, 2, 4, 8, 16, 32 then 60 seconds,
   capped at 60. A successful authentication clears only failure count/backoff; it does
   not refill rolling source/account budgets. Backoff never sleeps or occupies a hash
   slot. A budget/backoff denial returns a generic 429 and truthful integer
   `Retry-After` bounded to 1–900 seconds.
4. Permit at most four concurrent password verifications process-wide and queue zero.
   When all four slots are occupied, deny generic 429 immediately. Real, wrong-password
   and dummy nonexistent-account verification all use the same semaphore and release in
   `finally`; database lookup never holds the slot.
5. Cap live source entries at 4,096 and account entries at 8,192. Reclaim expired entries
   with bounded work and deterministic least-recently-used eviction. If a new key cannot
   be admitted safely, fail closed with 429 rather than grow memory or bypass control.
6. The real server adapter derives a canonical source key only from Bun's connection
   peer metadata. It never reads `Forwarded`, `X-Forwarded-For`, `X-Real-IP` or body
   fields. In direct `app.handle`/missing-metadata cases use the shared key `unknown`,
   which is restrictive but cannot bypass limits.
7. Preserve the exact generic invalid-credential 401 response when no guard fires.
   Every 401/429 includes `Cache-Control: no-store`; every 429 has the same problem shape
   regardless of source/account/concurrency cause and never carries entered identifiers.
8. Keep existing input/body bounds, Argon2id parameters, JWT issuance, database identity
   lookup, tenant/property grants and local workbench gates unchanged. Document that each
   additional process currently receives its own bounded budget.

## Forbidden

- New table/migration/dependency, Valkey as auth authority, unbounded queue/map/timer,
  sleeping while holding a slot, storing credentials or account-existence state
- Trusting proxy/forwarded headers, accepting source address from the body, a plain
  trust-proxy boolean, or silently claiming a shared/multi-process control
- Different errors/timing policy for real vs missing accounts, CAPTCHA, lockout email,
  JWT/session/password changes or another Cyber finding
- UI redesign, paid/external service, public exposure change, self-review or self-merge

## Pre-registered proof

### P0 — intentional red

An always-on focused test launches five controlled concurrent verifications and requires
at most four active with zero waiters; it also requires exact account/source/backoff and
bounded-state behavior. It fails before production code because `LocalLoginGuard` is
absent. Commit red before implementation.

### P1 — exact budgets and indistinguishable outcomes

Injected-time tests prove exact capacities/refills/backoff/retry seconds. Existing and
nonexistent accounts consume identical budgets and preserve the same 401/429 bodies and
headers. Success clears only backoff; neither budget silently resets.

### P2 — concurrency and bounded memory

A controlled hash barrier proves active verifications never exceed four, the fifth gets
immediate 429 with no queued promise, all paths release in `finally`, and unbounded
distinct keys never exceed 4,096/8,192 entries or bypass on admission pressure.

### P3 — authoritative source boundary

Real server tests prove peer metadata separates sources; missing/invalid metadata shares
`unknown`; forged forwarded headers never alter the key or regain attempts. Source spray,
account spray and composed denial return exact no-store 429 behavior.

### P4 — login regression and runtime

Fresh migrated/review-seeded PostgreSQL proves valid login/token issuance, uniform wrong
and nonexistent 401s, exact throttling and recovery. Workbench-disabled health remains
database-free; enabled loopback behavior and Order 116 fresh-secret requirements remain.

### P5 — standing and independent review

Typecheck, boundaries, default tests, licences, audit, exact schema, protected hashes and
pristine referee 11/11 pass. A non-implementing Tier-3 reviewer personally runs P1–P4,
inspects the zero-queue/state bounds, and records the single-process limitation.

## Definition of done

- [x] Order 116 is independently approved before P0.
- [x] Intentional red precedes production code.
- [x] Source/account/backoff/concurrency/state bounds are exact and executable.
- [x] Account existence and forwarded headers cannot alter observable authority.
- [x] Single-process limitation remains explicit.
- [x] Standing/referee gates and independent review approve the exact implementation SHA.
