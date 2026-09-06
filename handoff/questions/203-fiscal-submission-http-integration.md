# Question203 — Authenticated fiscal request/retry integration

**Status:** ADMITTED implementation under Order440; independent Tier3 required.
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
is freshly checked using existing active-actor/property grants. Require exact
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
