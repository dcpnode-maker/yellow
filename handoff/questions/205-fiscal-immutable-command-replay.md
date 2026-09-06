# Question205 — Immutable fiscal request/retry receipts

**Status:** ADMITTED repair under Order440; PR87 merge withheld pending repair,
independent real-database proof and exact-source CI.
**Date:** 2026-09-06. **Owner:** Codex coordinator.

## Evidence and decision

Independent fiscal_http_acceptance reproduced original request and first retry keys
returning attempt3/retry2/sequence7 after later progress, instead of their original
attempt1/sequence1 and attempt2/sequence4 receipts. Canonical78 and PR87 cb9a87f
contain this defect. Earlier passing tests and bounded approvals did not cover
late replay and do not authorize merge. See review440's blocking PR87 finding.

CONTRACTS section1 and D-443/D-444 already require byte-identical successful HTTP
JSON/status on exact replay. Replay metadata belongs in Idempotency-Replayed,
not a changed body. No founder policy choice is needed to restore that contract.

Reuse the existing append-only fiscal_submission_history row for each command's
receipt. No second store, table, financial entry, backfill or altered history.
Forward migration79 adds an owner-private history-to-receipt projection and
replaces only request/retry replay branches to read their matching immutable row.
Keep fresh authorization, semantic conflict hashes, advisory/row locks, atomic
history/fact/outbox writes, all first effects and runtime claim/reconcile unchanged.
Internal receipts retain replayed metadata for the HTTP header; the HTTP body's
existing replayed field remains false on both initial success and exact replay.
Existing authorized history supports keys recorded before the migration too.

Applied1–78 must remain byte-identical. Q204 runtime migration is explicitly
renumbered to80 before creation; this keeps the corrective79 independently
reviewable and avoids mixing active runtime implementation into PR87's repair.

## Exact editable scope

```text
handoff/questions/205-fiscal-immutable-command-replay.md
handoff/questions/204-supervised-fiscal-delivery-runtime.md (prospective80 frontier)
handoff/questions/203-fiscal-submission-http-integration.md (superseded approval)
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/reviews/440-fiscal-submission-lifecycle.md
migrations/0079_fiscal_immutable_command_receipts.sql
src/http/operator.ts (fiscal receipt body only; Q204 health edits preserved)
tests/fiscal-submission-immutable-replay.integration.test.ts
tests/fiscal-replay-workflow.test.ts
tests/fixtures/order440-fiscal-immutable-replay.ts
tests/operator-fiscal-submission.integration.test.ts (exact canonical-body oracle)
tests/fiscal-submission-delivery-runtime.integration.test.ts (prospective80/type annotations)
tests/schema/expected.sql
tests/migrate.integration.test.ts
tests/fiscal-submission-durability.integration.test.ts (pin historical77-to78 prefix only)
src/kernel/build-info.ts
scripts/local-review.sh
.github/workflows/ci.yml
.github/workflows/release.yml
tests/build-readiness.test.ts
tests/free-host-arm64.test.ts
tests/release-workflow.test.ts
tests/native-fiscal-release-containment.integration.test.ts
tests/india-irp-issued-wire-candidate.integration.test.ts
tests/database-acceptance.integration.test.ts
tests/runtime-database-authority.integration.test.ts
tests/app-role-nonlogin.integration.test.ts
tests/setup-current-catalogue-oracle.test.ts
setup.sh
setup.ps1
docs/CONTRACTS.md
docs/PROJECT-STATUS.md
docs/SCHEMA-GUIDE.md
BUILD-PLAN.md
handoff/ROADMAP.md
DECISIONS.log
handoff/LEDGER.md
127.0.0.1:55503 / yellow_order440_q205_* (new isolated proof databases only)
D:\Yellow\temp (uniquely named Q205 proof artifacts only)
```

Current-frontier files are admitted only for79 acceptance, not broad rewrites.
Preserve all historical77→78 hash/upgrade evidence. No public role grants, provider
call, secret output, retained database migration, Docker/WSL/cluster/app restart,
worktree, dependency, spending or live activation. Verify pristine77 template before
cloning; create one exact isolated target, apply canonical78, capture actual red,
then apply forward79. Leave the founder's main77 source and data unchanged.

## Acceptance

Prove exact original HTTP bytes/status and replay-only header immediately, after
claim, multiple known-not-sent/retry transitions, and terminal accepted/rejected
outcomes. Both original request and every distinct retry key must reproduce their
own receipts. Preserve first canonical response shape, changing only the erroneous
replay metadata representation. Authorization revocation and changed semantic input
still deny; concurrent replay creates zero additional head/history/fact/outbox or
financial changes. A pre79 command receipt must survive upgrade without backfill.
Verify owner-only helper ACLs, fixed search path, unchanged applied hashes and exact
schema. Root implements; a different agent personally runs the high-risk proof.
PR87 cannot merge solely because its older tests or CI pass.
