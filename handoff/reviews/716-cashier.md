# Order716 independent review — isolated database proof, frontend pending

Reviewer: Codex independent agent `/root/review709`; I did not implement the planned cashier UI or Finance integration.

I read Order716, the Yellow entity/compliance/PostgreSQL rules, and inspected `scripts/order716-cashier-proof.ps1` and `tests/financial-cashier-sessions.integration.test.ts` before running either. The helper checks exact existing container/loopback/source identity, creates a fresh named database, restores schema only, verifies zero tenants and migration rows, authenticates distinct deploy/runtime roles, sets `YELLOW_REQUIRE_FINANCIAL_CASHIER=1`, and runs the suite only against that proof database. No new role/grant, live data copy, or serving-database fixture is involved.

I personally executed `.\scripts\order716-cashier-proof.ps1`. It created and retained `yellow_order716_proof_20260925123645_2932`. The exact database/role/zero-tenant preflight and distinct-role authentication passed. `tests/financial-cashier-sessions.integration.test.ts` ran **6 pass, 0 fail, 29 expect() calls, no skips**. It includes the exact-count/discrepancy economics without journal/payment/document artifacts and twenty-way open/count/close idempotency races. A post-run read-only check of the proof database returned `yellow_order716_proof_20260925123645_2932|yellow_deploy|0|0` for database, role, tenant rows and migration rows. The proof database is retained.

This is only preliminary backend proof. No new UI/HTTP integration verdict, full type/boundary result, browser check, cash drawer operation in the live hotel, or release is claimed.

## Independent Order716 candidate re-review — 2026-09-25

Reviewer: Codex independent agent `/root/guest_contract709`; I did not implement the
cashier client/workbench or Finance integration.

I inspected the active React client/workbench, parent integration, focused tests,
and canonical idempotency path. I personally reran:

- `bun test tests/order716-cash-drawer-client.test.ts tests/order716-cash-drawer-workbench.test.tsx tests/order716-finance-integration.test.ts` — **21 pass, 0 fail, 165 assertions**.
- `bun run typecheck` — passed (`tsc --noEmit` and frontend TypeScript project).
- `bun run boundaries` — passed, **208 TypeScript files**.
- `scripts/order716-cashier-proof.ps1` had already been personally executed against
  the fresh isolated, schema-only database `yellow_order716_proof_20260925141551_5428`:
  exact identity/deploy/runtime-role and zero-tenant/migration checks passed;
  `tests/financial-cashier-sessions.integration.test.ts` reported **6 pass, 0 fail,
  29 assertions, no skips**. The database is retained. Since the current revision
  changed only frontend client/UI/tests and the cashier backend/idempotency source
  is unchanged, this canonical proof remains applicable; no live drawer/session
  mutation was performed.

Review found one recoverability gap in the pre-fix candidate: backend request hashes
include `actorId` (`src/contexts/financials/cashiers.ts:976–986, 1060–1072,
1122–1133`), and `PostgresIdempotency` conflicts on same tenant/operation/key with
a different request hash (`src/kernel/idempotency.ts:123–166`). A changed operator
therefore cannot execute a second command, but the prior UI could retain a locked
attempt without making the actor mismatch clear. The implementation reviewer added
memory-only exact bearer binding at the initial POST boundary, denies changed-token
retry/readback while retaining the same attempt/key/lease, and has behavioral tests
for changed operator, accepted-receipt readback, and remount. The focused tests above
pass with that change. The bearer is absent from UI state/messages; the original
operator must return to reconcile. This is intentionally fail-closed on any bearer
rotation, even for a refreshed credential from the same human, because the UI has no
separately verified stable actor identity.

Verdict: implementation and isolated canonical proof are accepted for root’s
remaining local-only empty-state/refresh/layout browser QA. This does not claim
deployment, real drawer/session operation, or public exposure.
