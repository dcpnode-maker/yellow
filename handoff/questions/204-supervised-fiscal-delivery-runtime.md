# Question204 — Supervised fiscal delivery runtime

**Status:** ADMITTED technical implementation under Order440; independent execution
and exact-source CI remain mandatory before integration.
**Date:** 2026-09-06. **Owner:** Codex coordinator.
**Predecessor:** Q203 at cb9a87ff5e94b47a9172f7e0f919c4df0e6f2ef5 passes all six
CI34017067690 jobs and independent HTTP acceptance. PR87 is separate integration.

## Complete outcome and natural solution

Connect the existing durable submission head/history and claim/transport/reconcile
worker to a recoverable, supervised runtime. Reuse fiscal_submission, its durable
history, the existing runtime-login capabilities, and the provider port. No second
queue, balance, document, broker, model, dependency or microservice is introduced.

Discovery alone is not completion. Acceptance includes bounded fair discovery,
adapter availability before claim, actual claim/transport/reconciliation, durable
lookup cadence, timeout/shutdown behavior, server lifecycle and genuine PostgreSQL
proof. A fake provider or manually supplied submission ID is not a production
runtime. Real provider authentication and a live authorized sandbox remain the next
provider-integration obligation, not something a flag or test adapter can assert.

## Exact editable scope

```text
handoff/questions/204-supervised-fiscal-delivery-runtime.md
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/reviews/440-fiscal-submission-lifecycle.md
handoff/reviews/440-fiscal-delivery-runtime.md (separate non-implementing Q204 review)
migrations/0080_fiscal_submission_delivery_runtime.sql
tests/schema/expected.sql
src/contexts/tax-fiscal/fiscal-provider.ts
src/contexts/tax-fiscal/fiscal-submission-worker.ts
src/contexts/tax-fiscal/fiscal-submission-repository.ts
src/contexts/tax-fiscal/fiscal-submission-delivery-runtime.ts
src/contexts/tax-fiscal/index.ts
src/workers/postgres-due-fiscal-submissions.ts
src/runtime/server-lifecycle.ts
src/server.ts
src/project-status.ts
src/http/operator.ts (fiscal runtime health/status only; existing HTTP contract unchanged)
src/kernel/build-info.ts
scripts/local-review.sh (current frontier only; fiscal enablement remains off)
.github/workflows/ci.yml
.github/workflows/release.yml
tests/fiscal-submission-worker.test.ts
tests/fiscal-submission-delivery-runtime.test.ts
tests/fiscal-submission-delivery-runtime.integration.test.ts
tests/fixtures/order440-fiscal-delivery-runtime.ts
tests/server-lifecycle.test.ts
tests/server-fiscal-runtime.test.ts
tests/arrival-pickup-task-worker-wiring.integration.test.ts (shared supervision/signal/logging oracle only)
tests/reservation-arrival-roll-worker-wiring.integration.test.ts (shared supervision/signal/logging oracle only)
tests/reservation-departure-roll-worker-wiring.integration.test.ts (shared supervision/signal/logging oracle only)
tests/fiscal-submission-commands.test.ts (admitted context export surface only; snapshot helpers remain private)
tests/founder-status.integration.test.ts (exact seventh worker status field only; existing access/privacy assertions unchanged)
tests/operator-fiscal-submission.intentional-red.test.ts (default-off shared registry composition only)
tests/operator-app-bar-responsive-containment.intentional-red.test.ts (bounded DevTools port-file EBUSY/ENOENT startup handling only; geometry unchanged)
tests/fiscal-submission-durability.integration.test.ts
tests/fiscal-submission-immutable-replay.integration.test.ts (preserve exact historical79 upgrade prefix)
tests/fiscal-replay-workflow.test.ts (assert required current80 delivery/process gates)
tests/operator-fiscal-submission.integration.test.ts
tests/india-irp-issued-wire-candidate.integration.test.ts
tests/migrate.integration.test.ts
tests/database-acceptance.integration.test.ts
tests/runtime-database-authority.integration.test.ts
tests/app-role-nonlogin.integration.test.ts
tests/build-readiness.test.ts
tests/build-readiness.integration.test.ts
tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts (current80 catalogue count only)
tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts (current80 catalogue count only)
tests/free-host-arm64.test.ts
tests/release-workflow.test.ts
tests/native-fiscal-release-containment.integration.test.ts
tests/setup-current-catalogue-oracle.test.ts
setup.sh (current catalogue oracle only)
setup.ps1 (current catalogue oracle only)
docs/CONTRACTS.md
docs/STATE-MACHINES.md
docs/PROJECT-STATUS.md
docs/SCHEMA-GUIDE.md
BUILD-PLAN.md
handoff/ROADMAP.md
DECISIONS.log
handoff/LEDGER.md
127.0.0.1:55503 / yellow_order440_q204_* (new isolated proof databases only)
D:\Yellow\temp (new uniquely named Q204 proof files only)
```

Q205 inserts corrective migration79 before this runtime migration80. Immutable
migrations1–79, the retained77 template, existing proof databases and
the main77 founder preview are unchanged. No seed or default permission change,
secret/public credential, real provider call, Docker/WSL startup, new cluster,
worktree, dependency install or local app replacement. Prove the pristine77
template before cloning; apply78/79/80 only to a new isolated target. Historical
77-to-78 acceptance/hash evidence is preserved, not bulk rewritten to79.
Root owns governance, migration/schema and release/CI integration; a bounded
builder owns only its explicitly assigned production/unit-test subset.

The first complete current80 standing run passes1,655 with1,259 explicit database
skips and fails6 assertions. Before changing those assertions, this amendment
admits the five historical test files above plus the already scoped release workflow
test. Their old inline failure-log, private worker export, empty standalone identity
directory and current79 step-name expectations conflict with the explicitly admitted
shared lifecycle/current80 composition. Preserve workbench-only exact opt-ins,
fixed sanitized logging, common cancellation, private raw snapshot helpers, an empty
production registration and pre-listen refusal. No business code or permission is
changed to accommodate these assertions; original failure evidence is retained.

The next complete run passes1,661 with1,263 explicit database skips, but Order330's
fresh Chromium640px profile raises EBUSY reading DevToolsActivePort before its
geometry assertions. The exact unchanged rerun passes1/1(4). This recurring Windows
file-publication race is admitted for a permanent bounded startup correction in the
single test file above: retry only EBUSY/ENOENT inside the existing800-attempt loop,
rethrow other I/O failures, and add deterministic helper regressions. Preserve every
viewport/DSF/overflow/label/rail assertion, process ownership and timeout; no UI edit,
test skip, blanket retry or broad browser cleanup.

## Runtime-only discovery and claim rules

After publication at a4a1346, CI34043209976 passes five jobs but its database job
stops at the older founder-status exact workers equality (7 pass, 1 fail). The
production status correctly adds fiscalSubmissionDelivery=disabled. Before editing
that assertion, this amendment admits only its response type and exact expected
seventh field in founder-status.integration.test.ts. Keep all six older worker
states, exact whole-object equality and tenant/access/privacy checks. No production
state or permission change is needed; the later skipped database gates must execute
in new exact-source CI.

The next exact-head CI34043585965 passes founder status but stops at two older
runtime-authority expectations of fourteen runtime capabilities. The already scoped
runtime-database-authority.integration.test.ts must require all fifteen exact
signatures, preserve the fourteen existing search-path-only configurations, and
require the new discovery function's exact UTC/ISO configuration and five-field
result shape. Add its direct app-role denial and invalid-limit/paired-cursor probes
without weakening universal PUBLIC/app denials or runtime ownership/grants.
Independent read-only catalogue evidence from the existing80 proof database fixes
the exact DateStyle=ISO,YMD spelling. No production SQL, role or permission change.
The adjacent already-scoped database-acceptance test likewise must enumerate this
fifth fiscal capability and the exact valid/ready tenant-leading partial cursor
index. Existing historical named-subset runtime-DML tests are not global counts
and remain unchanged. Schema/permissions/RLS totals are unchanged by migration80.

Migration80 adds a narrow
`runtime_due_india_fiscal_submissions(integer, uuid, uuid)` capability returning
tenant_id, submission_id, provider_key, provider_extension_id and
provider_extension_version, plus a tenant-leading partial (tenant_id,id) cursor
index over existing pending/submitted durable heads. Keep the existing queue index;
no table or stored business value is added. No payload, financial/guest fields,
token or secret is exposed.
Require direct session_user yellow_runtime, role none, function owner yellow_owner,
and empty app.tenant_id. Fix search_path and revoke PUBLIC/app_role execution;
do not grant runtime table SELECT or DML. Validate limit1–500 and paired nullable
cursor UUIDs. Return a bounded lexicographic (tenant_id,id) keyset page; the caller
wraps after the end and advances across every returned row, even unavailable
adapters, so low keys cannot starve later work.

Only active tenants, delivery_version1, pending/send or due submitted/lookup are
discoverable. Exclude legacy, terminal and explicit-retry-required rows. Recheck
active tenant in the existing claim function to close the discovery-to-claim race.
Do not change the three-argument claim signature or claim/receipt bindings.

Use database time and identical due predicates in discovery and claim. An
unreconciled claim (response IS NULL) becomes lookup-eligible when its lease expires.
A reconciled pending/timeout/duplicate response becomes eligible15 seconds after
claim_expires_at. This is a technical minimum lookup cadence, not a fiscal business
policy, automatic resubmission or a claim about a provider's quota. No new column or
table is needed. Preserve immutable history and existing atomic outbox effects.

## Delivery, bounds and lifecycle

Reserve an exact registered adapter lane before claim; an unavailable or quarantined
lane must not consume a claim/attempt. Revalidate returned claim identity against
the reserved provider key/extension/version. Derive HTTP identity-only availability
from the same immutable registration snapshot; no independent configuration list.

Extend the provider port with an explicit AbortSignal/deadline contract. The transport
deadline must be strictly shorter than the claim lease with reconciliation margin.
Before publication, provider-integration inspection identifies a restart gap: lookup
receives only internal UUIDs and a digest, which cannot identify a government invoice.
The already scoped port/worker now must supply a detached copy of the original
issued wire bytes to lookup as well as submit. A stateless adapter can derive the
provider's documented lookup key from those immutable bytes without a submit cache
or second store. Preserve the existing payload hash and binding; add unit red/green
and actual fresh-worker PostgreSQL recovery proof with no previous in-memory submit.
This does not invent provider-specific authentication or enable external transport.
Timeout or shutdown after submit begins means unknown delivery, never known-not-sent;
lookup cancellation preserves lookup. Reconcile through the existing repository.
Ignore late results and retain lane quarantine until an abort-ignoring original
promise actually settles. Bound registered lanes and concurrent in-flight calls:
Promise.race alone must not leak unlimited unresolved transports.
Bound database statement/lock waits without losing transaction settlement and
pool-failure protections. Do not hold a database lock across provider transport.

One process lifecycle owns shutdown: stop intake, abort waits/transport, permit a
bounded reconciliation drain, then close owned pools. Repeated signals are
idempotent. Existing six loops receive the same shutdown signal; their business
behavior and configuration remain unchanged. Track actual disabled/running/failed
state, not just an environment flag. No payload, SQL error, credential or raw
provider response appears in logs or status.

Fiscal runtime defaults off and creates no fiscal pools or discovery activity when
off. Enabled with zero genuinely registered adapters must fail before listening.
The production registration snapshot stays empty until a reviewed real provider
adapter exists; no demo fallback, external JSON verified flag or account credential
is invented. Tests may use clearly isolated adapters without claiming certification.

## Executable acceptance

Intentional red precedes implementation. Personally executed independent proof must
cover genuine two-tenant discovery/denial, wrong role/context, minimal result shape,
cursor bounds/wrap/fairness, active-tenant race, database-clock cadence, lease/crash
recovery, unavailable-adapter zero mutation, competing runtimes with one submit,
unknown-to-lookup without resend, explicit-retry preservation, transaction rollback,
deadline/abort/late-result quarantine bounds, and idempotent bounded shutdown.
Assert unchanged document/series/journal/postings and complete delivery history.

Prove actual HTTP request -> discovery -> worker -> reconciliation using PostgreSQL
and an isolated deterministic protocol test adapter; do not substitute a service
double for this path. Also prove disabled default, enabled-without-registration
pre-listen failure, fresh/upgrade80 equivalence, exact schema/ACL, current readiness,
standing/type/boundary/licence checks and canonical referee11/11. Existing Windows
Bun crash-prone readiness suite must not be re-run just to reproduce a known crash;
actual Linux process lifecycle proof is required in CI. No complete Phase7 or
production transport claim follows from provider-neutral runtime acceptance.
