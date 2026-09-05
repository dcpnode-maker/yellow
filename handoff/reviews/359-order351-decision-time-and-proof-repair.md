# Order 359 / Order 351 decision-time and proof repair — fresh Tier-3 review

**Disposition:** WITHHOLD

**Reviewer:** `/root/order359_review_fast`, fresh independent non-implementing Tier-3

**Exact repair inspected:** `986f4daae008a5e0e3c4372329979931c07c01eb`

**Exact governance inspected:** `d57b9fd2b87854fc5999d536e6742161f62a3f44`
**Repair parent:** `662e30d83362f079acd33690eb883f86259b3bfb`

## Isolation and provenance

Review execution used disposable detached worktree
`C:\Users\astha\AppData\Local\Temp\yellow-order359-fast-review` at exact governance
`d57b9fd`. The stable port 3000, canonical `.yellow`, and unrelated dirty worktrees
were excluded.

## Code inspection

- The production repair is exactly one migration-0063 predicate:
  `NOT (a.decided_at <= transaction_timestamp())`. It correctly rejects NULL,
  future, and non-comparable decision instants while retaining PostgreSQL transaction
  time as authority.
- Scope is five paths: migration 0063, permanent integration proof, focused source
  assertion, database-acceptance checksum, and expected schema.
- The committed eight-case suite overstates required coverage. Rollback injects only
  event-publication failure, not every transition/fact/event/deferred boundary. The
  twenty-contender case uses a fresh random idempotency key per call, so it is not a
  same-key race. Tenant/property/room/discrepancy/day/approval/actor/source/target and
  inactive-approver hostility is incomplete. Financial isolation checks four counts,
  not byte-identical journal/posting/folio/payment/document/tax/balance truth. Raw-DML
  proof attempts one carry insert and does not establish the full ACL/mutation or
  hostile `pg_temp` matrix.

These executable-proof gaps block Order359 required proof 2–4 and Order351 hostile
proof 3–8 despite the green cases below.

## Reviewer-executed gates

- Fresh PostgreSQL 16.15 migrations 1–63 applied successfully.
- Permanent hostile suite: **8 passed, 0 failed, 47 expectations**.
- Exact catalogue: **63 migrations / 116 public tables / 106 RLS tables / 15
  FORCE-RLS tables / 2 views**.
- Fresh referee: **11 passed, 0 failed of 11**.
- Bootstrap seed applied cleanly; review-seed **24/0 (111)**; runtime-DML **5/0
  (120)**; SECURITY-DEFINER **3/0 (192)**; focused source/contract **2/0 (11)**.
- TypeScript, 139 import-boundary files, 23-package licence policy, zero-vulnerability
  audit, diff hygiene, and expected live schema passed.
- Database acceptance: **23/0 (65)**.
- Standing suite with the required 30-second timeout: **1216/0**, 934 expected skips,
  18,514 expectations across 399 files. The inherited Order239 case exceeded the
  default five-second timeout but passed focused with the bounded timeout.
- Full migration integration did not finish in the review window and is not claimed
  green. Three fresh databases nevertheless applied migrations 1–63 successfully.

## Required repair

Order359/351 remains **WITHHELD**. Permanent proof must execute:

1. failure after every transition/fact/event/deferred-commit boundary plus clean retry;
2. true same-idempotency-key contention and distinct-key/two-approval races;
3. complete cross-authority, inactive-decider, and reuse hostility;
4. byte-identical financial and fiscal state before/after; and
5. complete raw mutation/ACL and hostile-`pg_temp` containment for this capability.

A different fresh non-implementing Tier-3 reviewer must rerun the repaired suite and
all required gates. No carry, readiness, seal, financial mutation, local, merge,
deployment, Phase-5, or application-completion authority follows from this review.
