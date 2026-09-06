# Question203 — Authenticated fiscal request/retry integration

**Status:** IMPLEMENTED; independent bounded local proof passes; exact CI pending.
**Date:** 2026-09-06. **Owner:** Codex coordinator.

Q201's canonical persistence and Tx commands pass exact827be467 Linux CI34008495909.
Connect both request and retry to the existing authenticated operator application,
keeping production unavailable by default. This is a complete HTTP persistence
boundary, not live provider transport or a newly granted operator privilege.

## Exact editable scope

```text
handoff/questions/203-fiscal-submission-http-integration.md
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/reviews/440-fiscal-submission-lifecycle.md
src/contexts/tax-fiscal/fiscal-submission-adapter-availability.ts
src/contexts/tax-fiscal/index.ts
src/http/operator.ts
src/app.ts
src/server.ts
tests/fiscal-submission-adapter-availability.test.ts
tests/operator-fiscal-submission.intentional-red.test.ts
tests/operator-fiscal-submission.integration.test.ts
tests/fixtures/order440-fiscal-submission-http.ts
tests/operator-business-day-seal.integration.test.ts (coordinator-only exact composition expectation)
tests/operator-reservation-travel.integration.test.ts (coordinator-only exact composition expectation)
.github/workflows/ci.yml (coordinator-only required HTTP proof addition)
docs/CONTRACTS.md
docs/PROJECT-STATUS.md
BUILD-PLAN.md
handoff/ROADMAP.md
DECISIONS.log
handoff/LEDGER.md
D:\Yellow\temp (uniquely named Q203 synthetic proof files only)
127.0.0.1:55503 / yellow_order440_q203_* (new disposable proof databases only)
```

No migration, applied SQL, schema, seed, dependency, existing command, private
worker/repository, runtime flag, global role or retained database changes. Clone
only the verified pristine77 template and apply canonical78 to a newly named
proof database; never run fresh historical migrations against the retained cluster.
No WSL/Docker, new cluster, worktree or local app replacement. Root owns shared
governance/CI; the bounded builder owns only the seven production/unit source paths
and the new HTTP fixture/integration proof. No conflicting file edits.

## Contracts and safety

POST `/api/v1/properties/:property/fiscal-submissions` accepts exactly
`{documentId, providerExtensionId}`. POST
`/api/v1/properties/:property/fiscal-submissions/:submission/retry` accepts exactly
`{providerExtensionId}`. Both require JSON, no query parameters and a visible-ASCII
8–200-character `Idempotency-Key`. Reuse existing correlation-header rules.
Tenant and actor derive solely from verified signed session context; route property
is freshly checked using existing property grants. The canonical SQL operation
separately enforces active actor status in the same transaction. Require exact
`tax-fiscal.submissions:request` or `tax-fiscal.submissions:retry` JWT scope.
Migration78's same-transaction authorization remains authoritative on every replay.
No new default role assignments are made; synthetic tests may grant exact fixture
permissions in their isolated database.

Expose a narrow identity-only adapter directory through the tax-fiscal index;
never import the private worker/registry from commands or HTTP. Validate and freeze
exact provider key/extension-id/version entries, rejecting duplicate identities,
proxies/accessors/surplus/function-bearing values. Identity configuration alone
does not prove provider authentication. The server supplies an EMPTY directory,
so neither a seeded provider extension nor caller `verified` flags enable effects.
A future authenticated adapter must supply this projection through separately
reviewed composition; no production transport functions or credentials are added.

Use `FiscalSubmissionService` once on middleware-owned `context.tx`; do not call
the Database-owning Q201 command inside another tenant transaction. Resolve adapter
availability before mutation. Retry's provider selector is untrusted and cannot
change stored identity: revalidate the exact returned receipt against tenant,
property, document/submission and all three selected adapter fields before returning.
Every failed service Result, malformed receipt, identity mismatch or exception must
THROW through the tenant callback to roll back. Only the existing outer HTTP failure
handler returns a sanitized error after rollback/failed commit. No HTTP success may
escape a failed commit. Input/auth failures must cause no fiscal writes.

Return a minimized frozen snapshot: submission/document/attempt IDs, attempt/retry
counts, status/disposition/sequence, provider key/id/version and replay flag. Omit
tenant/actor IDs, source/wire hashes or bytes, claim token, raw SQL/provider response,
credentials and internal errors. Follow existing201/replay and correlation headers;
401 unauthenticated,403 scope/property denial,400 input,503 unavailable/integrity.
These endpoints enqueue durable intent only; no provider function or worker runs.

## Executable acceptance

Permanent red precedes implementation. Unit tests cover immutable directory and
hostile input. Real signed-token -> resolver -> middleware -> HTTP -> canonical78
proof covers unauthenticated/default403, empty-directory503, exact request/replay,
explicit known-not-sent retry/replay, property/tenant/actor revocation, foreign IDs,
invalid/surplus fields, directory/receipt mismatch rollback, late outbox failure,
transaction settlement and sanitized responses. All other-tenant and financial
rows remain unchanged; no provider calls occur. Actual production entrypoints,
not a success-shaped stub alone, must pass. Require the proof without a silent
environment skip in CI. Root verifies combined changes; a non-implementer personally
executes the high-risk proof. No complete Order440/Phase7, local promotion, provider
registration, transport availability or cloud deployment claim follows.

## Bounded independent execution — 2026-09-06

Builder fiscal_command_integration implements only the listed production/fixture
paths. Root did not implement those paths and personally inspected and executed
the frozen candidate: three files/13tests pass,125assertions,18.62s. This comprises
five genuine signed-session PostgreSQL cases and eight identity/target-safety/
transaction-closure/workflow checks; the commit-failure injection is a deliberate
connection double, not an actual database process failure. The genuine late-outbox
constraint failure rolls back actual fiscal writes. Root found and had the builder
correct nonexistent-UUID-only negatives to existing other-tenant property, document
and submission records; both tenants' delivery and four financial-table snapshots
remain unchanged after exact sanitized denials.

Root separately confirms canonical78 checksum65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6,
zero injected constraints and zero other sessions in disposable
yellow_order440_q203_90601 on55503. The retained77 template and local app are
untouched. Integration test worktree SHA256 is
491c86a7b9bc5b317c2b369803bb7ce8726c3fdc1a90c0ddb9c703a0e40278f1.
Independent fiscal_integration_map separately executes root's CI gate test1/1(12),
validates YAML and preserves the ARM job. Full standing/exact-head CI and final
integration still apply; no provider credential, worker or live service is activated.

## Combined-standing regression admission

The first full standing run has1633pass/1234explicit DBskips/2fail(22058assertions).
Root reproduces both failures in isolation9pass/2fail: existing Order389 seal and
Order212 travel tests pin the complete old OperatorHttpApi constructor tail ending
at ownerTrustExpenses. Q203 adds one final fiscal dependency object without moving
or changing any existing argument. Admit only those two exact expected strings,
preserving every existing positional argument and adding the exact new object
bindings. Do not weaken route counts, body parsing, middleware, service, authority,
failure or behavioral assertions; no product source change is needed. Root owns
these two bounded test updates; a non-implementer reruns their complete suites.

## Completed local acceptance after reboot

The incomplete pre-reboot rerun has no result and is not counted. Root's new
full standing run exits0:1635pass,1234explicit database skips,0fail,
22058assertions,2869tests/496files,101.53s. Its persistent output is
`D:\Yellow\temp\q203-standing-20260906T115125.log`.
Root typecheck,176-file boundaries,23-package licence policy and diff checks pass.

Fresh non-implementer `/root/fiscal_http_acceptance` personally executes all three
Q203 files after retained PostgreSQL recovery:13pass/0fail/125assertions,12.58s,
including all five genuine database cases. It separately executes both complete
seal/travel suites11pass/0fail/75assertions,310ms, and verifies78migrations,
zero residual injected constraints and zero other proof-database sessions.
No blocking finding remains in the bounded HTTP persistence integration.
Production adapters remain empty and the exact-head combined CI condition remains.
