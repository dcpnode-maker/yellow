# Independent review — Order 104 balanced charge posting

**Result:** APPROVED

**Reviewed executable tip:** `4c2720ce2820003450321ab3f4fc33908b566000`

**Approved base:** `85cc5e7585c3031cceec32e5b511cc06ecbf735d`

**Pull request:** #75

**Reviewer:** independent non-implementing Codex Tier-3 reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 104 and found no remaining implementation or
scope defect. Approval covers the exact executable tree at `4c2720c`, including the
two corrections requested after the earlier review: seal-first serialization now
uses the real `seal_business_day` boundary through transaction-local tenant authority,
and the 500-charge stress proof requires the route-scoped revenue total to equal the
exact negative guest total rather than a permissive inequality.

The exact delta stays within the amended order: migration 0010, one strict financial
command, its focused proof and project accounting surfaces, plus the existing
cumulative database runner and its contract test solely to make P1–P5 independently
triggerable. It does not edit the immutable baseline or referee and adds no tax,
payment, deposit, settlement, transfer, correction, trust, fiscal, cashier, AR,
day-roll, HTTP, UI, worker or automation behavior.

Migration 0010 closes tenant/property/date/currency/account/folio reference gaps with
tenant-leading candidate keys and composite foreign keys. `tx_code_route` has exact
tenant/property/currency/code identity, coherent optional account references, tenant
RLS and app-role SELECT-only authority. The replacement day-open trigger locks the
exact day `FOR SHARE`; `seal_business_day` verifies transaction-local tenant authority.
The executed proof confirms both lock directions and no partial artifact after a
sealed-day conflict.

`ChargeService.postCharge` accepts canonical bigint decimal-string money, derives all
accounting authority from PostgreSQL, and posts exactly guest/folio `+amount` and
configured revenue `-amount`. Quantity is descriptive fixed-scale metadata and is
never multiplied into money. Journal, immutable lines, minimized fact/outbox evidence
and durable idempotency commit or roll back together. Exact replay returns the same
journal; changed content conflicts.

## Reviewer-executed evidence

The reviewer created an isolated native PostgreSQL 16.15 cluster bound only to
loopback from an exact archive of `4c2720c`, installed dependencies from the lockfile,
and personally executed:

- fresh migrations 0001–0010 and Order 104 P1–P5 — **10 passed, 0 failed, 110
  assertions**. This included exact ACL/constraint guards, signs/routing/date/currency,
  replay/conflict and twenty-way same-key convergence, rollback after real outbox
  insertion, both real seal races, hostile input/configuration/RLS boundaries, and
  **500 charges / 1,000 immutable lines** with exact route-scoped revenue `-125250`
  followed by replay without drift;
- a separate app-never-started fresh database — exact **85 public tables** and the
  canonical referee at **11 passed, 0 failed of 11**;
- separate deployment acceptance — **4 passed, 0 failed, 10 assertions** — and a
  normalized `pg_dump` byte-match to `tests/schema/expected.sql`;
- repository standing — **138 passed, 0 failed, 1,732 assertions** — plus typecheck,
  62-file import boundaries, 23-package licence policy, `bun audit` with no known
  vulnerabilities, and `git diff --check`.

The reviewer also personally triggered attempt 2 of GitHub run `32696809132` for the
exact PR head. Database job `97341132927` passed the 14/14 isolated cumulative suites,
including Order 104 at 10/10 with 110 assertions, migration integration at 14/14 with
82 assertions, deployment, exact schema, health, referee 11/11 and destructive cleanup.
The checkout was GitHub's synthetic PR merge of `4c2720c` into `85cc5e7`; its tree was
verified byte-equivalent to the reviewed head. Quality, Windows state and container
smoke were green as well.

The builder's first cumulative run remains disclosed: inherited Order 069 P8 took
17,245 ms against its unchanged 15,000 ms ceiling on the Windows host. No threshold or
production behavior was changed. Both hosted exact-SHA attempts passed the unchanged
ceiling, so this is retained as host-variance provenance rather than an Order 104 defect.

Local reviewer migration execution had two harness-only Windows limitations before
relevant assertions (trust authentication could not induce the auth-redaction case and
symlink creation returned EPERM). The reviewer-triggered pinned-Linux job independently
passed migration 14/14, so neither limitation is misrepresented as local proof.

Protected migration 0001 SHA-256 remains
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`; the referee
SHA-256 remains
`3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
All disposable reviewer databases and PostgreSQL infrastructure were removed; founder
infrastructure was untouched.

Approval is exclusive to Order 104's untaxed two-line revenue-charge foundation,
migration 0010 and its documentation/proof. It does not represent completion of the
financial phase or approval of tax allocation, nightly charging, statements,
corrections, payments, settlement, trust, fiscal documents, cashier, AR, day roll,
route authoring or any operator/API surface.

## Exclusive Order 104 discharge

- 104
