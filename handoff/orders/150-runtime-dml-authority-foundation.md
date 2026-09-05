# Order 150 — Establish positive runtime DML authority

**Status:** IMPLEMENTING — D-415–D-419; stacked dependencies Orders 151–152 authorized
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/runtime-dml-authority-post127`
**Base:** `ebce025b496757f6b011c6b071a6fe9287840fc2` — approved Order-149 status tip stacked on closed Order 148
**Risk tier:** 3 — database grants, tenant authorization and immutable-record enforcement
**Owner:** Codex implementation; a non-implementing Tier-3 reviewer must personally execute P0–P4
**Finding:** `database-grants.runtime-role-direct-dml`, occurrence `occ_f0526a0906f1b0b5a72edf0c`

## Outcome

Deliver the first bounded tranche of the founder-selected positive-capability model:
replace inherited blanket `app_role` mutation authority with one exact machine-checked
table/column/function catalogue, revoke current zero-caller/global/tenantless/
immutable writes, and preserve only direct operations proven necessary by current
production commands.

This is blast-radius mitigation, not finding closure. Later orders must migrate each
retained protected lifecycle to bounded command-owned database capabilities before a
final reviewer may consider the occurrence discharged.

## Admission facts

- The preserved founder decision D-373 selected Option 2: positive ACL catalogue
  first, then bounded command capabilities and final direct-DML contraction. Its old
  Order 136 was DRAFT/BLOCKED on a pre-Order127 line and is evidence only.
- Orders 126 and 127 are independently approved; Order 148 integrated their exact
  line; Order 149 changes authenticated presentation only.
- Current migrations are exactly 0001–0015. This order reserves only
  `0016_runtime_dml_authority.sql` after mechanically proving the frontier.
- `yellow_runtime` is the only application credential, is non-owner/NOSUPERUSER/
  NOBYPASSRLS and is an exact member of NOLOGIN `app_role`; deploy/owner boundaries
  from D-407 remain immutable here.
- Q162/D-418 reserves Order 151 for the bounded financial row-lock capability needed
  by existing folio/posting callers; account/folio direct UPDATE stays absent.
- Q163–Q164/D-419 reserve Order 152 for exact inherited proof-fixture maintenance;
  none of those stale fixtures justify restoring runtime mutation.

## Scope

- `migrations/0016_runtime_dml_authority.sql`;
- `tests/runtime-dml-authority.integration.test.ts`;
- `tests/migrate.integration.test.ts`;
- `tests/database-acceptance.integration.test.ts`;
- `tests/schema/expected.sql`, mechanically regenerated only;
- `scripts/seed.ts` and `tests/seed.integration.test.ts`, only for the Q160/D-416
  deploy-owned global seed plus read-only app-role verification boundary;
- `scripts/run-phase-3-gate.ts` and `tests/phase-3-gate-runner.test.ts`, only for one
  unique Order-150 focused-suite mapping;
- `docs/SECURITY.md` and `docs/CONTRACTS.md`, only for the exact ACL catalogue and
  named residual command-capability debt;
- this order;
- `handoff/questions/160-order150-seed-authority-boundary.md` and
  `handoff/questions/161-order150-extension-type-residual.md`;
- additive D-415–D-417/ledger records and one independent Order-150 review.

No TypeScript production caller other than the exact scoped deployment seed, baseline/applied migration, protected referee,
table, policy, role, credential, function body, trigger, event, state machine,
dependency, Compose file, workflow or founder-status snapshot is in scope. A needed
caller or capability-function change stops this order and requires a new order.

## Required implementation

1. Machine-enumerate every effective `app_role` table, column, sequence and function
   mutation privilege at Base and commit an exact positive registry in the focused
   proof. No blanket/future-table mutation default or view mutation may remain.
2. Revoke runtime DML from global, tenantless, deploy/tool, immutable and zero-caller
   relations except the exact Q161/D-417 current `extension_type INSERT(type,
   json_schema)` residual. Preserve non-request relay/runtime functions from Order
   127 exactly.
3. Preserve constitutional boundaries: occupancy direct DML stays denied; R4
   revocations stay exact; `document` has no runtime mutation; `rate_price` permits
   only `UPDATE (superseded_by)`; insert-only relations receive no UPDATE/DELETE.
4. Preserve only operations and columns mechanically mapped to current production
   SQL. A grant cannot survive because a future feature might use it.
5. Emit a named residual inventory for every protected transition still using direct
   DML, to become the input of later command-capability orders.

## Pre-registered proof

### P0 — exact-Base red

On a fresh Base database using the real runtime→app-role transaction path, reproduce
and roll back: global tenant mutation, permission mutation consumed by login,
same-tenant immutable document mutation, non-`superseded_by` rate-price update, and
one no-caller/control-table insert. Also prove app_role NOLOGIN, foreign tenant RLS
invisibility, no raw-SQL HTTP surface and occupancy direct DML denial `42501`.

### P1 — positive catalogue

After v16 every P0 mutation fails with privilege denial and zero artifacts. Compare
effective table/column/sequence/function privileges to the committed registry; prove
no blanket or future mutation defaults, no view mutation, exact rate-price column
authority, and unchanged PUBLIC/deploy/owner/runtime-role boundaries.

### P2 — legitimate flows

Execute each retained mutation family through its real service/HTTP boundary where
one exists: login, extension-type registration, Party, inventory configuration, holds/blocks/projection,
reservation commit/lifecycle/segments/guests, rates/publication, folio/charge,
facts/outbox/idempotency and relay. Require exact rows/states/facts/events,
idempotency, rollback and tenant/property isolation.

### P3 — recurrence and residual debt

In disposable databases introduce one unauthorized grant and require exact catalogue
failure; create one new public table and prove it receives zero runtime DML by
default. The focused proof must fail if a retained mutation lacks a current caller
mapping or named future capability owner.

### P4 — cumulative proof

Run the focused suite; Orders 108/118/124/126/127 security proofs; all affected domain
suites; the complete isolated phase matrix with one unique mapping; complete
migration suite; database acceptance; live normalized schema; standing tests;
typecheck; 64 boundaries; frozen licences/audit/image pins/protected hashes; and a
separate fresh `./setup.sh --db-only` referee with exactly 11/11.

The independent reviewer must reproduce P0 on exact Base, inspect the complete
catalogue/caller map, execute P1–P4 on the exact candidate in separate infrastructure,
and record commands/results. Approval may call this mitigation only.

## Forbidden

- Editing `migrations/0001_init.sql`, any applied migration or `tests/run_invariants.py`.
- Blanket grants, future mutation defaults, speculative grants or full-table UPDATE
  where exact columns suffice.
- Breaking a legitimate flow and calling denial a security success.
- New SECURITY DEFINER capability, role/principal, credential, table/policy, route,
  event/state or production caller.
- Importing old Order136 or finance branches, closing the occurrence, deployment,
  credential disclosure, self-review or self-merge.

## Definition of done

- [ ] P0 exact-Base excessive authority is reproduced and rolled back.
- [ ] P1 exact positive catalogue replaces blanket mutation authority.
- [ ] P2 all retained current mutation families remain executable and isolated.
- [ ] P3 recurrence and named residual-debt checks pass.
- [ ] P4 complete cumulative proof and fresh referee pass.
- [ ] Independent Tier-3 review approves one immutable executable.
- [ ] Finding remains open with bounded follow-on command-capability orders.
