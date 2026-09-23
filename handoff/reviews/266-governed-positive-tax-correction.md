# Review 266 — Governed positive-tax journal correction

**Reviewer:** independent non-implementing Codex Tier-3 reviewer (`/root/order266_independent_review`)
**Decision:** APPROVED
**Date:** 2026-08-29
**Reviewed commit:** `f0bc28bbd0f80154a292a90f29e906f06d789305`
**Comparison base:** `252254b404e9c61b4765c2a9b3c1e0bcb7cba896`
**Authority:** Order266 / D-691 through D-699 only

## Verdict

Order266 is approved. I did not implement this change. I inspected the exact
`252254b..f0bc28b` diff and personally executed the Tier-3 proof against the exact
candidate in a collision-proof disposable WSL/Compose environment. No blocking
finding remains.

The implementation creates one immutable corrective journal whose non-root lines
are the exact full sign-negation of the original positive-tax journal, leaves the
original untouched, preserves governed posting lineage and derives its root line in
the database. It correctly denies unauthorized corrections after business-day seal,
allows the bounded authorized path, guards tenant context before idempotency, replays
an already-completed request after later account closure, and resolves the historical
positive-tax alias without creating a parallel ledger or mutable repair path.

## Exact candidate and migration evidence

- Candidate: detached exact `f0bc28bbd0f80154a292a90f29e906f06d789305` in
  `D:\Yellow\codex-reviews\order266-tier3-f0bc28b`.
- Isolated Compose project: `yellow266-review-f0bc28b`, with PostgreSQL on 56266,
  Valkey on 61266 and the unused app allocation on 31266. The stable Compose project
  and port 3000 were never targeted.
- `./setup.sh --db-only` applied migration 0045 and finished `11 passed, 0 failed of
  11`. A direct catalog read then proved migration version 45, exactly 98 public
  tables and 88 RLS policies.
- The migration ledger row is exactly
  `45|0045_governed_positive_tax_correction.sql|aec7f04eaa0536568adf68d51d7e2fa3ff578cd043b3079c080a680d6e210dba`.
  The active migration file independently hashes to that same SHA-256 value.
- Active file SHA-256 values were:
  - migration 0045:
    `aec7f04eaa0536568adf68d51d7e2fa3ff578cd043b3079c080a680d6e210dba`;
  - correction service:
    `fb6cf0ca8253d9bc6b2800e9f3560020223d90af24b45313591062ed340e32b1`;
  - focused correction proof:
    `ba25292348523005430f80d045f17a1a8653398e203c6a4e1bbf2ff95ef19cce`.

The setup summary still says “after migrations 1-44”; this is stale display text in
the pre-existing referee output, not a schema failure. The migration ledger and
schema checks independently prove 0045 is applied and exact.

## Reviewer-executed commands and results

Protected environment files were sourced without printing their contents. Database
URLs were constructed only inside the reviewer shell and are intentionally omitted
from this record.

```text
COMPOSE_PROJECT_NAME=yellow266-review-f0bc28b \
  YELLOW_APP_PORT=31266 YELLOW_POSTGRES_PORT=56266 YELLOW_VALKEY_PORT=61266 \
  ./setup.sh --db-only
=> 11 passed, 0 failed of 11

bun test tests/positive-tax-correction.test.ts
=> 8 passed, 0 failed

bun test tests/positive-tax-posting.test.ts
=> 9 passed, 0 failed

bun test tests/posting-plan.test.ts
=> 6 passed, 0 failed

bun test tests/folio-posting-eligibility.test.ts
=> 6 passed, 0 failed

bun test tests/semantic-route.test.ts
=> 9 passed, 0 failed

bun test tests/financial-corrections.test.ts
=> 9 passed, 0 failed

bun test tests/financial-statements.test.ts
=> 12 passed, 0 failed

bun test tests/db-acceptance.test.ts
=> 11 passed, 0 failed

bun test tests/runtime-dml.test.ts
=> 5 passed, 0 failed

bun test tests/security-definer-containment.test.ts
=> 3 passed, 0 failed

bun test tests/migrations.test.ts
=> 39 passed, 0 failed

bun test tests/schema-drift.test.ts
=> 4 passed, 0 failed

bun run schema:check
=> exact schema match

bun test
=> 846 passed, 0 failed, 775 skipped; 1621 tests across 291 files

bun run typecheck
=> passed

bun run check:boundaries
=> passed across 97 TypeScript files

bun run check:licenses
=> passed across 23 installed packages

bun audit
=> no vulnerabilities

git diff --check 252254b..f0bc28b
=> passed
```

The migration test was run against a disposable administrative database endpoint,
not protected `yellow_dev`. The schema check used the required deploy role and
explicit schema database name. Earlier invocations with an intentionally protected
database or incomplete shell environment were discarded as harness setup errors;
the corrected reviewer-owned invocations above are green.

## Financial, tenancy and concurrency findings

The focused proof personally established all of the following:

- every non-root correction line exactly reverses the corresponding original line,
  including account, folio, tax component, posting-plan component, currency and
  quantity/amount signs;
- the original journal and lines remain byte-stable and immutable, the new journal
  balances, and the original plus correction sums to zero;
- the correction retains the governed original/posting-plan/folio lineage, uses the
  canonical positive-tax route and records the bounded correction fact plus both
  outbox events atomically;
- the narrow transaction-local tenant-context query runs before idempotency, so a
  cross-tenant request is rejected as not found rather than leaking an idempotency
  result or conflict;
- same-key replay returns the exact prior result, including after the original
  revenue account is later closed, while a changed canonical request under the same
  key conflicts;
- 20 concurrent contenders produce one committed correction and 19 deterministic
  conflicts, with no duplicate fact, journal or outbox publication;
- a forced publication failure rolls back the complete transaction, after which a
  retry succeeds once without residue;
- account, folio, route-binding and business-day sealing races are serialized by the
  documented sorted row/advisory/date locks;
- unauthorized post-seal correction is denied with zero mutation, while the explicit
  server-derived authority path succeeds;
- hostile shapes, missing originals, foreign actors and cross-tenant originals make
  zero mutation; raw table DML remains denied and RLS remains effective;
- the owner-only `SECURITY DEFINER` functions have fixed
  `pg_catalog, public, pg_temp` search paths, verify caller and transaction-local
  tenant context, validate the bounded header/root contract, and do not expose a
  generic journal-write capability;
- the 10,000-line adjacent financial-statement proof remains green, covering the
  high-volume reconstruction boundary.

The migration adds no mutable edit/delete route and no alternative ledger. Its
insert-only correction fact, journal, lines and outbox records remain under the
existing RLS, ACL, immutability and fiscal-chain model.

## Intentional-red reconstruction

I created a second disposable worktree at exact base
`252254b404e9c61b4765c2a9b3c1e0bcb7cba896`, restored only the candidate's intentional
red test, and ran it there:

```text
bun test tests/positive-tax-correction.intentional-red.test.ts
=> 0 passed, 3 failed; exit 1
```

The exact base lacks both migration 0045 and the correction service, so the test
fails for the intended missing-capability reasons. This proves the candidate proof
does not pass vacuously against its comparison base.

## Stable-local non-mutation and cleanup

Read-only before/after observations showed the sole stable local unchanged:

- app `b084c60b9fe615f4aed9197dd71e7d77ddfdeb88e5a42496b039f55ef06f2c2f`,
  healthy, restart count 0, started `2026-08-29T02:59:38.249766167Z`;
- PostgreSQL
  `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12`,
  healthy, restart count 0, started `2026-08-29T02:59:30.103272572Z`;
- Valkey `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa`,
  healthy, restart count 0, started `2026-08-29T02:59:30.442755852Z`;
- stable database remained at migration 44 with 98 public tables, 88 RLS policies
  and two properties; this review did not promote migration 0045 to it;
- root and health remained HTTP200, port 3000 was the sole app port, and ports 3002
  and 3188 remained closed;
- observed resource use was low risk: app 2.75% CPU / 81.79 MiB, PostgreSQL 0.40% /
  99.24 MiB, Valkey 0.24% / 4.895 MiB.

The isolated Compose project was removed with its containers, volume and network.
Both disposable D-drive worktrees and their dependency junctions were removed, and
the authoritative `node_modules` remained present. No candidate was promoted, no
stable service was restarted or replaced, and no credential was printed.

## Approval boundary

This approval makes Order266 eligible for the primary owner's governance closure and
next authorized integration step. It does not merge or push the branch, promote the
stable local, deploy publicly, or claim Phase 7 or the application complete. Apart
from this review record, this reviewer changed no authoritative repository file.
