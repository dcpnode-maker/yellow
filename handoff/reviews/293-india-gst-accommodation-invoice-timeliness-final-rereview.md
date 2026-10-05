# Order 293 independent Tier-3 final re-review — India GST accommodation invoice timeliness

**Verdict:** APPROVED

**Reviewer:** OpenAI Codex independent final re-review agent `/root/order293_final_review`

**Candidate:** `89e6bdcd32233fe7eb6d21c752831d31f75a2e71`

**Base:** `b5b2d452f2ab87b8eca7c710fcc5eef0176cb0cd`

**Prior reviewed candidates:** `95e43a5ffd780dacc7e200ec7f6e35ebff58499a`, `321820cb293d5a6a8ad9d412e862557d1ab6ecac`

**Branch:** `phase-7/india-gst-accommodation-invoice-timeliness`

**Reviewed:** 2026-08-30

## Independence, governing material and exact scope

I did not implement Order 293 and did not rely on builder-transcribed proof. I reviewed
the exact candidate in a clean detached worktree and personally executed every proof
used for this verdict. Before review work I read `PROJECT.md`, `AGENTS.md`, ran
`./state.sh`, and read the complete `yellow-compliance-rules`,
`yellow-entity-patterns`, and `yellow-postgres-patterns` skills. I also read the
current Phase-7 build/plan/roadmap material, Order 293, D-777 through D-782, both
prior Order-293 review records, the approved Order-290/292 contracts and their
Order-240/252 lineage, `handoff/ROSTER.md`, and `docs/WORKFLOW.md`.

The approved base is an ancestor of the candidate. The exact 15-file
base-to-candidate diff is limited to the declared resolver/export and focused tests,
contract/domain/security and phase/build/roadmap documentation, Order 293, decisions,
ledger, and the two predecessor review records. `git diff --check` is clean. There is
no migration or schema-snapshot change. Base and candidate have identical blobs for
`migrations/0001_init.sql`, `package.json`, `bun.lock`, `docker-compose.yml`, and
`tests/schema/expected.sql`.

## Current official statutory check

I personally checked the official CBIC material served on 2026-08-30:

- <https://cbic-gst.gov.in/hindi/CGST-bill-e.html> states in section 31(2) that a
  registered taxable-service supplier issues before or after provision but within
  the prescribed period. Section 13(2) separately branches on whether that period
  was met and also compares against payment evidence; it is downstream authority
  that this order correctly does not claim.
- <https://cbic-gst.gov.in/gst-invoice-rules.html> and the official consolidated
  rules PDF
  <https://cbic-gst.gov.in/pdf/01062021-CGST-Rules-2017-Part-A-Rules.pdf> state the
  ordinary Rule-47 service-invoice period as 30 days from supply, while separately
  preserving the 45-day financial-sector regime and the listed distinct-person
  books/quarter regime.

That supports only the candidate's bounded day-30-inclusive ordinary-regime
`timely`/`late` evidence after affirmative governed ordinary-regime input. It does
not support exception inference or a section-13 time-of-supply result; the candidate
correctly fails every unsupported regime closed and claims neither authority.

## Source and lineage findings

No blocking or nonblocking product finding remains.

- The repaired calendar helper uses explicit proleptic-Gregorian date-only
  arithmetic, accepts canonical years 0001–9999, handles leap/century/month/year
  rollover, and fails closed when the 30-day result would exceed year 9999. There is
  no JavaScript `Date` or clock dependency.
- The exact equality-bound SELECT resolves the Order-292 invoice root, Order-290
  service root, complete Order-252 reservation lineage, and canonical Order-240
  attribution under transaction-local tenant context. Stored source/legal/coverage,
  identity, amount and currency conflicts fail closed.
- The fixed public evidence and tenant-bound digest contain invoice and service root
  ids, property and reservation identity, all eight reservation-lineage fields, the
  canonical three-field attribution identity, both dates and deadline, ordinary
  regime/source/legal evidence, invoice series/serial, complete coverage/source/legal
  envelopes, both governed source hashes, result, amount and currency. The tenant is
  bound but not disclosed. The result and both nested objects are recursively frozen.

## Reviewer-personal executable proof

| Proof | Result |
|---|---:|
| Focused Order-293 intentional/final/hostile suite | `16 pass / 0 fail / 162 expectations` |
| Additional independent complete public/nested/tenant digest challenge | `1 pass / 0 fail / 38 expectations` |
| Live Order-290/292/293 adjacent RLS/ACL and hostile suite | `30 pass / 0 fail / 402 expectations` |
| Fresh PostgreSQL 16.15 deployment acceptance | `23 pass / 0 fail / 65 expectations` |
| Runtime DML authority | `5 pass / 0 fail / 117 expectations` |
| Migration runner | `39 pass / 0 fail / 187 expectations` |
| Canonical isolated `./setup.sh --db-only` referee | `11 passed / 0 failed of 11` |
| Exact catalogue | `58 migrations / 110 tables / 100 RLS / 100 policies / 10 FORCE RLS` |
| Normalized schema against `tests/schema/expected.sql` | exact match |
| Normalized schema SHA-256 | `227cba82339bc69d9c9263b854ea7954dc82a0dc16e19ca852304dc0d2eab19d` |
| Full pristine standing suite | `1014 pass / 0 fail / 871 expected skips / 15,611 expectations`; `1,885 tests / 330 files` |
| TypeScript / boundaries / licences / audit | green; `116` TypeScript files / `23` packages / zero vulnerabilities |
| Ancestry, exact diff, scope, protected blobs and no-migration gate | green |

The command surfaces I personally executed are recorded below. Credential-bearing
database URLs are intentionally represented by their variable names rather than
copied into the repository.

```text
git merge-base --is-ancestor b5b2d452f2ab87b8eca7c710fcc5eef0176cb0cd 89e6bdcd32233fe7eb6d21c752831d31f75a2e71
git diff --check b5b2d452f2ab87b8eca7c710fcc5eef0176cb0cd..89e6bdcd32233fe7eb6d21c752831d31f75a2e71
bun install --frozen-lockfile
bun test tests/india-gst-accommodation-invoice-timeliness.test.ts tests/india-gst-accommodation-invoice-timeliness.intentional-red.test.ts
bun test tests/india-gst-accommodation-service-provision-date.integration.test.ts tests/india-gst-accommodation-invoice-issue-date.integration.test.ts tests/india-gst-accommodation-invoice-timeliness.test.ts
COMPOSE_PROJECT_NAME=yellow-order293-finalreview-r3 ./setup.sh --db-only
YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1 YELLOW_DEPLOY_DATABASE_URL=<redacted> bun test tests/database-acceptance.integration.test.ts
YELLOW_REQUIRE_RUNTIME_DML=1 YELLOW_RUNTIME_DML_URL=<redacted> YELLOW_RUNTIME_DATABASE_URL=<redacted> bun test tests/runtime-dml-authority.integration.test.ts
YELLOW_REQUIRE_MIGRATION_DB=1 YELLOW_DEPLOY_DATABASE_URL=<redacted> YELLOW_RUNTIME_DATABASE_URL=<redacted> bun test tests/migrate.integration.test.ts
bun test
bun run typecheck
bun run boundaries
bun run license-check
bun audit
```

I also executed two temporary reviewer-only Bun tests: one independently reproduced
and challenged every public, nested and concealed-tenant hash input; the other built
and resolved the live Order-240→252→290→292→293 chain. Both were deleted before the
pristine standing suite and are not candidate artifacts.

The actual candidate resolver ran as `yellow_runtime` through the repository tenant
transaction boundary against a fresh PostgreSQL 16.15 database containing real
Order-240→252→290→292 lineage. It returned:

- service `2043-06-01`, invoice `2043-07-01`, deadline `2043-07-01`: `timely`;
- service `2043-06-02`, invoice `2043-07-03`, deadline `2043-07-02`: `late`;
- service `2043-06-03`, invoice `2043-06-02`, deadline `2043-07-03`: `timely`;
- service `0043-06-01`, invoice `0043-07-01`, deadline `0043-07-01`: `timely`.

For every case I personally resolved the approved Order-290 and Order-292 outputs,
compared their complete reservation/attribution/source/legal/identity/amount/currency
envelopes with the candidate result, and independently reproduced the candidate's
tenant-bound SHA-256. A foreign tenant received
`IndiaGstAccommodationInvoiceTimelinessNotFoundError`. Before/after counts were
byte-equivalent: one lineage, four service roots, four invoice roots, five facts,
eight outbox rows, and zero journals, postings or documents.

The additional hostile digest proof independently changed each of the 26 public
fields, all eight nested lineage fields, all three attribution fields, and the
concealed tenant; every mutation changed the digest. The permanent suite separately
proves malformed and coherent lineage substitutions fail closed, source/legal/
coverage/amount/currency conflicts reject, and both predecessor source hashes plus
invoice identity are output/hash-bound.

## Harness observations and cleanup

The first direct acceptance invocation was deliberately discarded after it reported
`22/1`: the freshly migrated database had not yet received the acceptance harness's
required canonical demo seed. After the exact canonical seed, the same fresh
PostgreSQL 16.15 database passed `23/0`. One initial disposable authority attempt
also rejected a too-short generated review password before product proof; I dropped
and recreated only that disposable database, then provisioned exact valid authority
and applied all 58 migrations. Neither precondition observation is a product finding.

The host automatically removed the uniquely named Compose resources immediately
after the canonical setup completed. I therefore held one unlabelled exact
`postgres:16.15-alpine` foreground container with tmpfs storage for the additional
live proof. It was stopped and removed with `--rm`. At the final Docker check there
were zero reviewer containers, volumes or networks; the only three pre-existing
Order-175 app/PostgreSQL/Valkey containers remained exited. Docker Desktop and every
WSL distribution are stopped. Original Docker runtime directories were restored,
review-created runtime sockets were removed from a verified workspace staging path,
and generated authority, dependencies, and temporary proof scripts were deleted.
The detached worktree was clean before this review record was added.

I made no product, test, migration, schema, governance, stable-container, merge,
promotion, deployment or local-application change. This review record is the sole
retained edit.

## Verdict

Exact candidate `89e6bdcd32233fe7eb6d21c752831d31f75a2e71` is **APPROVED** for the
bounded Order-293 ordinary Rule-47 accommodation invoice-timeliness evidence
contract. D-779's calendar/output blocker and D-781's complete predecessor-envelope/
diff blockers are closed. Approval grants eligibility for integration by someone
other than the author; it grants no invoice validity/issuance, exception-regime
selection, section-13 result, tax/document/IRP/API/UI/local promotion, merge,
deployment, Phase-7 completion or application-complete authority.
