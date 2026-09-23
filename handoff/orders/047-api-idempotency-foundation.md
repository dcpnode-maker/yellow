# Order 047 — Durable API idempotency foundation

**Phase:** 2 · Production command transport foundation
**Branch:** `phase-2/api-idempotency-foundation`
**Tier:** 3 — tenant-scoped mutation/retry semantics and a new RLS table
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Implement the missing durable, tenant-scoped 24-hour idempotency primitive required by
`docs/CONTRACTS.md` before the operator workbench exposes inventory mutations. Exact
retries return the original committed response without running the command again;
changed-request key reuse conflicts; the claim and business mutation are atomic.

## Scope

- `DECISIONS.log`
- `docs/ARCHITECTURE-V1.md`
- `docs/CONTRACTS.md`
- `handoff/LEDGER.md`
- `handoff/orders/047-api-idempotency-foundation.md`
- `handoff/questions/050-ARCHITECT-RESPONSE.md`
- `handoff/questions/050-order-047-proof-column-name.md`
- `handoff/questions/051-ARCHITECT-RESPONSE.md`
- `handoff/questions/051-order-047-schema-snapshot-path.md`
- `handoff/questions/052-ARCHITECT-RESPONSE.md`
- `handoff/questions/052-order-047-acceptance-ledger.md`
- `migrations/0004_api_idempotency.sql`
- `tests/schema/expected.sql`
- `setup.ps1`
- `setup.sh`
- `src/kernel/idempotency.ts`
- `src/kernel/index.ts`
- `state.ps1`
- `state.sh`
- `tests/database-acceptance.integration.test.ts`
- `tests/idempotency.integration.test.ts`

## Required behavior

1. Add `api_idempotency` as an app-role tenant table keyed by tenant, stable operation,
   and SHA-256 key hash. Never persist the caller's raw key.
2. Store canonical request hash, exact successful JSON response/status, creation,
   completion, and exact 24-hour expiry. Enable RLS using transaction-local tenant
   context and grant only required access.
3. Export a kernel primitive that validates keys/JSON, recursively sorts object keys,
   hashes the request, and borrows the caller's existing `Tx`; it never opens or commits
   a transaction.
4. First execution claims, runs once, and stores the outcome atomically. Exact retry
   reports `replayed=true`; changed request raises a typed conflict; concurrent exact
   calls serialize to one callback.
5. Callback error rolls the claim back with the command. Expired keys can be reclaimed.
   No cleanup worker is introduced.
6. Update exact table accounting to 84 = 80 baseline + two consumer tables +
   `api_idempotency` + `schema_migration`; regenerate the schema snapshot.
7. Document and record the design without approval, merge, or review claims.

## Forbidden

- Editing existing migrations or `tests/run_invariants.py`.
- Inventory, occupancy, holds, OOO/OOS, restrictions, rates, journal, fiscal, tenant
  middleware, login, operator route/UI, seed, or hosting behavior.
- Raw-key storage, process-memory-only dedupe, separate idempotency transactions,
  swallowed failures, overrides, self-review, approval, or merge.

## Pre-registered proofs

- **P0:** complete proof file fails before migration/primitive exist; preserve red output.
- **P1:** first call atomically commits one fact and completed hashed-key record with exact
  response and 24-hour expiry; raw key is absent.
- **P2:** sequential replay is exact and twenty concurrent calls run one callback.
- **P3:** changed request conflicts without callback; invalid keys/non-JSON inputs or
  outputs persist nothing.
- **P4:** callback failure leaves no claim/business row; retry succeeds; expired changed
  request is reclaimed once.
- **P5:** same key is independent across tenants; app-role RLS blocks forged tenant data.
- **P6:** exact columns, constraints, RLS, grants and expiry index; prior protected files
  byte-identical; fresh table count/snapshot exact at 84.
- **P7:** typecheck, boundaries, all tests, license, audit, schema drift, and fresh
  db-only referee remain green at 11/11.

## Standing checks

Run P1–P6 on a fresh isolated database, then the full self-check from the top. Refresh
Graphify, commit `[codex]`, push, and open a draft stacked PR. Do not approve or merge.
Question 050 authorizes only changing P3's nonexistent `id` projection to `key_hash`,
then restarting the entire proof file.
Question 051 corrects the nonexistent snapshot path to the generator's canonical
`tests/schema/expected.sql` before that file is regenerated.
Question 052 adds only the exact 0004 ledger row to fresh-deployment acceptance and
requires every proof to restart from the top.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
