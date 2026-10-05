# Question201 — Canonical durable fiscal submission integration

**Status:** ADMITTED implementation; independent Tier3 execution required before release.
**Order:**440-fiscal-submission-lifecycle. **Date:**2026-09-06.

D1383 and Q199 proved the complete private draft independently. Promote that
foundation through the actual migration runner, current catalogue and CI, plus
transaction-safe application request/retry commands. This continues the founder's
instruction to finish outstanding work; no new commercial provider or fiscal
policy is selected. Host recovery/UI handoff do not block this work.

## Architecture and exact boundaries

Canonical78 is `migrations/0078_fiscal_submission_durability.sql`. Copy the frozen
Q199 draft byte-exactly (including its historical draft comment), SHA256
`65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6`.
The admission and runner make it canonical; do not edit the retained draft or any
applied1–77 migration. New current catalogue is78migrations/128public tables/
118RLS tables/118policies/27FORCE-RLS tables/13permissions, with2views and no
default permission grants. Verify actual counts, not just expected constants.

Preserve Q199's existing head, single immutable receipt history, source/wire
identity, owner-only helpers, runtime-only claim/reconcile, tenant/property actor
authorization, bounded explicit retries and unknown-delivery lookup. No changed
business-day blockers or invented legacy backfill. No new dependency or runtime.

Expose only a tenant-Tx request/retry service and its result/input types through
the tax-fiscal index. Separate this service from the raw runtime-pool repository
without changing SQL semantics. Application commands snapshot/validate inputs
before choosing tenant context and use `Database.withTenantTransaction`. Every
failed repository Result, invalid returned receipt, thrown operation or commit
failure aborts the transaction; return sanitized typed failure only after rollback.
No failed Result may be returned inside the transaction callback and committed.
No claim/reconcile pool or provider registry is exported to an HTTP caller.

No HTTP/server/provider activation or local refresh in this admission. The stable
loopback preview remains exact merged-mainb5ef708/migration77. A later route/worker
admission must bind verified session actor/tenant/property and registered adapter
availability before any live effect. JSON verification flags are not authentication.

## Exact editable scope

```text
handoff/questions/201-canonical-fiscal-submission-integration.md
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/reviews/440-fiscal-submission-lifecycle.md
migrations/0078_fiscal_submission_durability.sql
src/contexts/tax-fiscal/fiscal-submission-repository.ts
src/contexts/tax-fiscal/index.ts
src/commands/request-india-fiscal-submission.ts
src/commands/retry-india-fiscal-submission.ts
tests/fiscal-submission-commands.test.ts
tests/fiscal-submission-durability.integration.test.ts
tests/migrate.integration.test.ts
tests/database-acceptance.integration.test.ts
tests/financial-postings.integration.test.ts
tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
tests/india-irp-issued-wire-candidate.integration.test.ts
tests/app-role-nonlogin.integration.test.ts
tests/runtime-database-authority.integration.test.ts
tests/positive-tax-correction.integration.test.ts
tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts
tests/native-fiscal-release-containment.integration.test.ts
tests/schema/expected.sql
tests/setup-current-catalogue-oracle.test.ts
tests/build-readiness.test.ts
tests/build-readiness.integration.test.ts
tests/release-workflow.test.ts
tests/operator-appearance-geometry.test.ts
setup.sh
setup.ps1
src/kernel/build-info.ts
scripts/local-review.sh
.github/workflows/ci.yml
.github/workflows/release.yml
docs/CONTRACTS.md
docs/PROJECT-STATUS.md
docs/SCHEMA-GUIDE.md
BUILD-PLAN.md
handoff/ROADMAP.md
DECISIONS.log
handoff/LEDGER.md
D:\Yellow\temp (uniquely named Q201 synthetic proof files/directories only)
127.0.0.1:55503 / yellow_order440_* (new disposable proof databases only)
127.0.0.1:55513 / one new D:\Yellow\temp\yellow-order440-q201-* native proof cluster
```

The existing runner auto-discovers78 and needs no widening of its authority.
The integration census also includes the financial-postings suite's current-full
table count; admit that single 127-to-128 assertion update after mapper discovery.
The final full-tree scan found the quoted-applicability current census and the
issued-wire fixture frontier guard; admit only their exact current78 catalogue
updates, preserving the existing statutory and immutability assertions.
Root reproduced a Windows EBUSY race opening Chromium's DevToolsActivePort in
the unchanged Order195 geometry proof. Admit only bounded startup-read handling
and deterministic tests in that test harness: retry EBUSY/ENOENT inside the
existing loop, propagate other failures, preserve all geometry assertions and
the existing30-second test timeout. No UI product change or skip is authorized.
Current-full catalogue assertions advance; historical Order43475→77 checks and
recorded main77 evidence remain unchanged. Regenerate expected schema from a
pristine actual78 database with the canonical normalization, not hand-written DDL.
Use native Windows Bun/PG16.15, existing dependencies and D:temp; no WSL/Docker
launch, new worktree or changes to retained/template/preview databases or roles.

Fresh replay cannot share the retained preview cluster: migration12 correctly
rejects active runtime sessions anywhere in that cluster. Admit one bounded
temporary native PostgreSQL16.15 cluster on D: at loopback55513 for full fresh
replay/readiness proof. Use existing binaries, synthetic credentials, no Docker/
WSL or real hotel data. Stop and remove only that newly created, resolved proof
directory after verification; do not interrupt the preview or another cluster.

## Required executable evidence

- Preserve1–77 bytes/checksums and the frozen draft; prove exact77→78 upgrade with
  real legacy row retention, injected late migration rollback, correct ledger,
  no-op and altered-applied-byte rejection. Fresh78 and upgraded78 schema agree.
- Existing17 real durability cases run through canonical migration, including
  real native-issued invoices,100 claims, all four atomic-operation failures,
  exact wire preservation, permission/RLS denials, lease/replay/terminal/retry
  guards, immutable financial census, history retention and both seal races.
- Request/retry command tests prove successful commit, failed Result and malformed
  receipt rollback, commit failure, pre-Tx invalid input, session settlement and
  unchanged other-tenant/financial records. Production command is exercised on
  genuine database fixtures, not only a mocked repository.
- CI must require the canonical durability proof on a clean separately provisioned
  prefix77 database; no successful skip. Latest acceptance, schema drift,
  native compatibility, release readiness and invariant referee11/11 remain gates.
- Root runs relevant tests/types/boundaries; non-implementer personally reruns
  high-risk proof before release. No complete Order440/Phase7 or provider claim.
