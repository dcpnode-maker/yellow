# Order 192 independent Tier-3 review — CHANGES REQUIRED

**Reviewer:** OpenAI Codex independent non-implementing reviewer

**Base:** `a92659b00f6ac541f3b4af09ad6d062e9a446d9b`

**Implementation candidate:** `afaa9674c65984f08cbd56031510c308ce3681ad`

**Builder-governance head reviewed:** `658ab0f208d164b14f3576e335935acdbb14d038`

**Decision:** CHANGES REQUIRED — D-507

## Summary

The schema, state, money, reconciliation and inherited executable paths that are
actually covered all pass on fresh reviewer-owned databases. No incorrect journal,
excess capture/refund, receipt replay, rollback, migration, RLS catalogue or ACL
result was observed. Approval is nevertheless blocked because the committed P1/P4/P5
oracle does not execute three proofs that Order192 explicitly requires, while D-506
describes them as complete.

## Blocking findings

| Severity | Location | Finding | Required correction |
|---|---|---|---|
| Blocking proof gap | `tests/financial-payments.integration.test.ts` P5 | The executable no-PAN/CVV scan visits only `src`, `migrations` and `scripts`. Order192 Required work13 also requires runtime assets, seeds and evidence fixtures. `public` and the relevant test/evidence fixture surface are not scanned. The separately edited hostile Party fixture is therefore outside the committed scanner. | Extend the executable scanner to every required surface. Handle legitimate long financial test integers through a narrow, documented non-card allowlist or fixture classification; do not broadly suppress 12–19 digit candidates. Prove the hostile sentinel remains effective without retaining a contiguous PAN. |
| Blocking Tier-3 tenancy proof gap | `tests/financial-payments.integration.test.ts` P1/P5 | P1 checks the RLS/policy catalogue and P5 checks a foreign property envelope, but neither executes tenant-A/tenant-B reads and hostile inserts against the new `payment_operation` and `provider_event_receipt` tables. D-505/P1/P5/P6 require executable tenant isolation for this exact new surface. | Add two-tenant app-role proof that A sees only A, B sees only B/zero A, and hostile cross-tenant operation/receipt references fail without artifacts. |
| Blocking concurrency proof gap | `tests/financial-payments.integration.test.ts` P4 | The twenty-way test races identical authorization and capture keys. It does not race distinct state commands or any refund calls, although the pre-registered P4 requires same-key/capture/refund racers and the review assignment requires twenty-way idempotency/state/refund races. | Add deterministic twenty-way distinct-key capture/state arbitration and bounded partial-refund races. Assert exact winner/result semantics, one capture, refund total never above capture, journal/fact/outbox cardinalities and zero drift after rejected losers. |

## Personally executed evidence

- `git diff a92659b..afaa967` and the exact migration/service/provider/docs/test
  surfaces were inspected against PROJECT.md, D-505/D-506 and the mandatory
  compliance, entity and PostgreSQL patterns. Scope is within Order192 and
  `migrations/0001_init.sql` is unchanged.
- `.\setup.ps1 -DbOnly` on reviewer-owned `yellow_test`: migrations1–21 applied,
  exact87 public tables, 77 RLS-enabled tenant tables and77 policies; referee
  **11 passed, 0 failed**.
- `bun test tests/financial-payments.integration.test.ts` with fresh isolated
  deployment/runtime URLs: **6 pass, 0 fail, 156 expectations**. Covered catalogue
  and ACL shape, journal-free auth/increment/void, one locked balance-capped capture,
  two bounded capture-linked refunds with exact signs, receipt replay/content
  conflict/late reconciliation, injected rollback and the currently committed
  hostile-input checks.
- Fresh dedicated `yellow_order192_review` migrated1–21 and seeded canonically.
  Database acceptance, app-role nonlogin and runtime-authority suites: **21 pass,
  0 fail, 117 expectations**.
- Inherited financial postings on that fresh database: **10 pass, 0 fail,
  111 expectations**, including 500 charges and 1,000 balanced immutable lines.
- Native Windows migration suite: **22 pass, 1 host-policy failure**. The failure is
  the disclosed inability to create the symlink attack fixture (`EPERM`) before the
  product migration runner is invoked; it is not counted as a product pass or fail.
- The identical unchanged migration suite was personally rerun in cached
  `oven/bun:1.3.14-alpine` against the same isolated PostgreSQL authority:
  **23 pass, 0 fail, 118 expectations**, including the symlink fail-closed proof.
- `bun test`: **264 pass, 507 database-dependent skips, 0 fail,
  3,378 expectations**.
- `bun run schema:check`: exact schema matches `tests/schema/expected.sql`.
- `bun run typecheck`: pass.
- `bun run boundaries`: pass, 70 TypeScript files scanned.
- `bun run license-check`: pass, 23 installed packages.
- `bun audit --production`: no vulnerabilities found.
- `git diff --check a92659b..afaa967`: pass.
- Reviewer supplemental scan of the exact Order192 diff found no Luhn-valid 12–19
  digit sequence; database column-name scan found zero PAN/CVV/CVC-shaped columns.
  This supplemental observation does not replace the missing committed full-surface
  oracle identified above.

An initial combined inherited-suite invocation incorrectly reused the two-tenant
referee fixture for canonical-seed acceptance and used the runtime login for a suite
whose cleanup requires deployment authority. Those fixture/role errors were not
treated as candidate evidence; every affected suite was rerun from scratch on its
correct isolated database and role, producing the green results recorded above.

## PowerShell setup change

`setup.ps1` now passes Compose arguments through an explicit string array, preventing
PowerShell from consuming `pg_isready -d` as an abbreviated common parameter, and
adds an explicit standard-input path for fixture loading. The reviewer executed the
whole script successfully. Readiness, postmaster identity, SQL `ON_ERROR_STOP`, fresh
database recreation, fixture load, exact table count and referee failure handling
remain fail-closed. No relaxation was found.

## Scope and safety

No founder/local runtime, persistent founder data, credentials, permissions or
production system was mutated. All reviewer databases were disposable. No local
promotion, merge, push, public/production deployment or Phase-wide completion is
approved.

## Verdict

**CHANGES REQUIRED.** Candidate `afaa967` is not independently approved. Correct the
three bounded executable-proof gaps, record a new exact candidate, and obtain a fresh
non-implementing Tier-3 rerun of P1–P5 and the inherited gates.
