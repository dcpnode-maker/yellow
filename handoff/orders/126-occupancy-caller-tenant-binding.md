# Order 126 — Bind occupancy SECURITY DEFINER callers to tenant authority

**Status:** RESUMED / READY
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/occupancy-caller-tenant-binding-approved-final`
**Base:** `3e387eb6139621354cd7bc5e87370aee0f312b92` — independently approved
Order-146 metadata frontier; exact composed executable
`483d4f15375c2d5e963ad75d6b8daacd0971070b`
**Risk tier:** 3 — tenancy, RLS/SECURITY DEFINER, occupancy choke point and forward
migration
**Finding:** sealed Cyber scan `e2a116cd-6e6d-4c8d-a741-9fa5c9f33fbb`,
`database.occupancy-caller-tenant`, occurrence
`occ_2f4ca8c2e6f1d7352ba849c8`
**Owner:** Codex implementation; independent non-implementing Tier-3 review required

## Final approved-frontier resumption — D-389

Question 147 is resolved by independently approved Order 143: `changeDeparture`
updates its exact parent before reacquisition and `moveRoom` inserts its exact parent
before acquisition, transaction-locally. Question 148 is resolved without weakening
strict validation by independently approved Order 144's production lifecycle parent
restore, independently approved Order 145's two test-only typed-parent fixtures, and
independently approved Order 146's provenance-preserving integration of those disjoint
prerequisites. D-388 approves the exact Order-146 executable and corrected metadata
frontier used here.

D-377's exclusions remain binding. This order imports no draft finance Orders
109–115, Order 127 artifact, historical Order-126 ancestry or excluded governance.
The obsolete draft D-382 is deliberately absent. The approved Base ends at
`0013_revoke_app_role_business_day_seal.sql`; `0014` is the next unused migration
number. If another 0014 appears before integration, stop and re-admit.

Prior Order-126 worktrees remain untouched. Strict source evidence is the exact
executable `b96101f55d05eced75d0ed6fe2a432251f810580` and its blocker/evidence head
`712477702fc0ba9043359f0b51088b448b64cbab`; earlier content provenance includes
four-file port `1ac7e5c1066a936206189648899fff9c069d75fe` and Question-147 evidence
`094262548b025910b1495c3c14379e9cb6f294b2`. No ancestry merge, rebase or cherry-pick
is authorized. Only the four exact final blobs from `b96101f` may be ported with
`apply_patch` after this admission is committed.

The earlier draft order recorded stale segment-test provenance `ab34030c...` for the
nine-line OOO fixture. The authoritative final `b96101f` tree blob is instead
`e4f8640f43b1466a9fa02e551eac6fc2757bcaca`; its diff from this approved Base's
Order-143 composite test is exactly nine added lines and zero deletions, so it
preserves the approved Order-143 compatibility.

## Canonical finding and boundary

`public.record_occupancy(p_tenant, p_space, p_period, p_slot, p_slot_kind,
p_exclusive)` and `public.release_occupancy(p_tenant, p_slot)` execute with owner
rights while accepting caller-selected tenant/resource UUIDs. Direct app-role DML is
already denied, but app role can execute both functions. The choke point must bind
compatibility parameters to transaction-local tenant authority and authoritative typed
parents before any occupancy mutation.

This order does not solve the separate runtime-owner/DSN finding, create a generic SQL
sandbox or database principal, authorize ordinary callers to bypass RLS, or discharge
any sibling Cyber occurrence.

## Required implementation

Add one forward migration that replaces only the existing `record_occupancy` and
`release_occupancy` bodies, retaining signatures and the app-role EXECUTE contract.

1. Both functions derive the established tenant from transaction-local
   `app.tenant_id`. For effective `app_role`, missing context or `p_tenant` mismatch
   fails exact SQLSTATE `42501` before mutation. `p_tenant` is an assertion, never
   authority. The deployment-owner maintenance path remains outside app role and is
   still constrained by typed parents.
2. `record_occupancy` rejects empty/unbounded periods, invalid slot kinds,
   inactive/foreign spaces and all parent mismatches before either claim branch. An
   active hold must match its sellable mapping; a segment must match its reservation,
   property, sellable mapping and period; an OOO slot must match one nonempty `ooo`
   row on the exact space/period. Existing advisory locking, positional allocation and
   exclusion-constraint truth remain unchanged.
3. `release_occupancy` captures affected rows under the derived tenant, validates each
   typed parent and allowed live transition, and deletes exactly those rows. Foreign,
   unknown, wrong-kind or stale parents must not return misleading zero or partial
   success. Legitimate callers retain exact release-count semantics.
4. Preserve approved Orders 108, 118, 124, 129, 130 and 143–146: qualified safe
   function bodies/search paths, app-role NOLOGIN, day-seal ACL, all parent-first
   sequencing, production lifecycle restore, corrected strict fixtures, protected
   referee/fixture, direct-DML denial, claim exclusion and every unrelated body/ACL
   byte-for-byte.

## Exact allowed paths and immutable source manifest

Implementation may change only:

- `migrations/0014_bind_occupancy_caller_tenant.sql`;
- `tests/occupancy-caller-tenant.integration.test.ts`;
- `tests/availability-projection.integration.test.ts`; and
- `tests/reservation-segment-changes.integration.test.ts`.

Governance may change only:

- `handoff/orders/126-occupancy-caller-tenant-binding.md`;
- `handoff/reviews/126-occupancy-caller-tenant-binding.md` when written by the
  independent reviewer; and
- additive Order-126 entries in `DECISIONS.log` and `handoff/LEDGER.md`.

The exact authorized final blobs from `b96101f` are:

```text
83fd6d4f4e99db52dc5670a2741dfa4455867d13  migrations/0014_bind_occupancy_caller_tenant.sql
a0bc6670169a5e4dc0aa17af6a666bdd36c23b53  tests/occupancy-caller-tenant.integration.test.ts
e3c849d938770f4e2a19d2c8f62963080d93026a  tests/availability-projection.integration.test.ts
e4f8640f43b1466a9fa02e551eac6fc2757bcaca  tests/reservation-segment-changes.integration.test.ts
```

Every other path is forbidden, especially `src/contexts/reservations/segments.ts`,
`src/contexts/reservations/lifecycle.ts`, the two Order-145 fixture tests,
`migrations/0001_init.sql`, protected referee/fixture files, normal TypeScript callers,
other migrations, finance/Order-127 artifacts, runtime wiring, API/UI/worker/event/
table/role additions, overloads, owner/app/GUC bypasses and status inflation.

## Pre-registered proof

### P0 — exact-approved-base hostile red

Against exact Base before 0014, on a fresh isolated database use `app_role` under
tenant A's transaction-local context. Prove hostile record and release naming tenant B
mutate tenant B occupancy. Preserve inherited direct-DML `42501`, PUBLIC denial, safe
function paths and app-role NOLOGIN.

### P1 — tenant and typed-parent green

After 0014, repeat P0 and require exact `42501` with zero source or victim mutation.
Exercise missing/mismatched authority, foreign/inactive space/property,
unknown/wrong-kind/stale parent and empty/unbounded period. No caller parameter or
unvalidated setting may create authority.

### P2 — legitimate behavior, rollback and concurrency

Run focused, availability-projection and composite approved Order-143 segment suites
on fresh databases. Exercise typed parents, legitimate record/release, mixed-mode
exclusion, a 50-client exclusive race with exactly one winner and 40-client positional
race with exactly six winners. Re-run the formerly blocked Question-148 lifecycle and
fixture suites plus affected reservation commit, HTTP, holds and inventory/OOO suites
without assertion weakening.

### P3 — least-authority migration shape

Prove exact version-14 ledger/checksum; unchanged baseline and approved 0011–0013;
unchanged protected referee/fixture hashes; no new table, role, membership, password,
overload, PUBLIC execute or app-role DML grant; and function/ACL/schema deltas limited
to the two authorized bodies.

### P4 — cumulative acceptance and independent review

Run current phase matrix, unchanged migration suite, deployment acceptance, exact
schema, standing, typecheck, boundaries, frozen licence/audit, protected hashes and an
app-never-started 85-table referee with exactly `11 passed, 0 failed of 11`. Use only
disposable `yellow_o126f_*` databases except the unchanged migration suite's own
test-generated `yellow_migrate_*` prefix. Remove every disposable database without
stopping or reconfiguring the shared stack.

A non-implementing Tier-3 reviewer must personally reproduce P0–P4 on one immutable
executable, inspect signatures/bodies/ACLs, and issue APPROVE or REJECT. Builder output
is not review evidence.

## Definition of done

- [x] Orders 129, 130, 142 and 143 are independently approved and present in the
      approved ancestry.
- [x] Questions 147 and 148 are resolved by independently approved Orders 143–146
      without a validation bypass.
- [x] D-377 exclusions remain exact; obsolete D-382 is absent; 0014 is next.
- [ ] P0 is freshly reproduced on exact approved Base.
- [ ] P1–P4 pass on one immutable executable SHA.
- [ ] Independent non-implementing Tier-3 review approves that exact SHA.
- [ ] Only `occ_2f4ca8c2e6f1d7352ba849c8` is then eligible for discharge; every sibling
      finding remains outside scope.
