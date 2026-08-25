# Order 126 — Bind occupancy SECURITY DEFINER callers to tenant authority

**Status:** BUILT-UNREVIEWED — independent Tier-3 review required
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

## Static-review correction stop — Question 149

Executable `9c1284a1e6e22ff9b7d94450ffe8c626f52b8d41` is stopped and is not
review-ready. Migration 0014 still admits a same-tenant `cancelled` reservation segment
even though approved Order 144 now restores the exact parent to `booked` before claim;
the focused proof lacks the required cancelled-parent `P0003`/zero-mutation canary.
In addition, exact schema and acceptance cannot pass because the derived
`tests/schema/expected.sql` mirror and complete migration ledger in
`tests/database-acceptance.integration.test.ts` both end before 0014 and are outside
this admission's exact paths.

Question 149 records the evidence. D-390 adds exactly those two derived-proof paths in
a governance-first correction while retaining the current availability and composite
segment fixtures as immutable necessary strict-parent compatibility. No stopped result
may be promoted to final builder evidence, and P0–P4 must restart after the amendment.

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
- `tests/availability-projection.integration.test.ts`;
- `tests/reservation-segment-changes.integration.test.ts`;
- `tests/schema/expected.sql`; and
- `tests/database-acceptance.integration.test.ts`.

Governance may change only:

- `handoff/orders/126-occupancy-caller-tenant-binding.md`;
- `handoff/reviews/126-occupancy-caller-tenant-binding.md` when written by the
  independent reviewer; and
- `handoff/questions/149-order126-cancelled-parent-and-derived-proof-scope.md`; and
- additive Order-126 entries in `DECISIONS.log` and `handoff/LEDGER.md`.

The exact authorized final blobs from `b96101f` are:

```text
83fd6d4f4e99db52dc5670a2741dfa4455867d13  migrations/0014_bind_occupancy_caller_tenant.sql
a0bc6670169a5e4dc0aa17af6a666bdd36c23b53  tests/occupancy-caller-tenant.integration.test.ts
e3c849d938770f4e2a19d2c8f62963080d93026a  tests/availability-projection.integration.test.ts
e4f8640f43b1466a9fa02e551eac6fc2757bcaca  tests/reservation-segment-changes.integration.test.ts
```

D-390 retains `e3c849d...` and `e4f8640...` byte-exactly: the approved-Base versions
fabricate hold/segment and OOO slots without typed parents and fail strict 0014. The
correction may edit only migration 0014, its focused test, the schema mirror and the
acceptance manifest. Derived-path parents are:

```text
04db66de80c8437bf0760b943f8eed6950dbf5a9  tests/schema/expected.sql
67e70b5fdf52a94069562bc74c0e3c25a1ca1157  tests/database-acceptance.integration.test.ts
```

The schema mirror must be generated from a fresh database migrated through the final
corrected 0014, with change limited to the existing record/release bodies. Acceptance
may append only version 14, its exact filename and final corrected raw SHA-256. Final
corrected blobs are recorded only after those mechanical proofs pass.

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

## Corrected immutable builder evidence

The corrected candidate is one immutable executable. No result from stopped
`9c1284a1e6e22ff9b7d94450ffe8c626f52b8d41` is reused:

```text
approved Base             3e387eb6139621354cd7bc5e87370aee0f312b92
D-390 / Question-149      dd2a0dea396e56d00155d3e0c2f2ca5b752354e7
cancelled-parent red      a6df5e22361c0df287f4aa55809c27ce7e9b457b
corrected executable      16b48bdfb559dcc9ce0a417a427f3cc5b5d6b1fb
path-audit correction     e263c6dd6366139386fa58498be9702ac4a476d5
migration raw SHA-256     706806ad3c041d506df1e90f75b19ed219baa3fedb8968471828657ab6c7493a
```

On an exact approved-Base database through 0013, app-role tenant-A context naming
tenant B reproduced hostile record/release mutation: the hostile count changed 0→1
and the victim count 1→0. Direct DML remained `42501`, PUBLIC EXECUTE remained absent,
`app_role` remained NOLOGIN and both function paths remained safe. The database and
detached worktree were removed before corrected proof.

Fresh serial proof on `16b48bdf...` passed:

```text
strict tenant/typed-parent focused          7/7, including cancelled P0003/zero mutation
50-client exclusive race                    exactly one winner, 223 ms
40-client positional race                   exactly six winners, 322 ms
availability projection                     6/6, 45 assertions
Order-143 composite segment changes         7/7, 115 assertions
Order-144 lifecycle                         6/6, 65 assertions
Order-145 blocks / containment              7/7 + 3/3, 43 + 22 assertions
reservation commit / HTTP                   5/5 + 5/5, 106 + 61 assertions
Order-129 initial parents                   7/7, 45 assertions
fixture-seeded holds / inventory            9/9 + 6/6, 32 + 30 assertions
unique-prefix cumulative matrix             19/19
native-WSL unchanged migration suite        17/17, 95 assertions
fresh deployment acceptance                 6/6, 13 assertions
fresh normalized schema                     exact
app-never-started referee                    11/11, 85 tables / 75 RLS tables
standing                                    174 pass / 429 skip / 0 fail, 1,983 assertions
typecheck / 64-file boundaries              PASS / PASS
licences / audit / image pins               23 / no vulnerabilities / exact digests
```

The unchanged Windows migration run passed 16/17 with 93 assertions; only the known
symlink-creation `EPERM` failed before assertions. The complete unchanged suite then
passed 17/17 under native WSL. `setup.sh --db-only` was not invoked because it
hard-codes recreation of `yellow_dev`/`yellow_test` and starts Compose, contrary to the
coordinator's unique-prefix and no-reconfiguration constraints. Its exact database
core was instead reproduced on fresh `yellow_o126f_referee_final`: migrations through
0014, canonical fixture, normalized schema and the standalone referee all passed,
including `11 passed, 0 failed of 11`.

The final Base-to-head allowlist is exactly the six implementation paths plus the
order, Question 149 and additive decision/ledger governance. The final implementation
blobs are:

```text
a9cee230b9ae339e21c87a6f917c39c28ff909ef  migrations/0014_bind_occupancy_caller_tenant.sql
fb557f8db1105a9689450ba6971ae56749850012  tests/occupancy-caller-tenant.integration.test.ts
e3c849d938770f4e2a19d2c8f62963080d93026a  tests/availability-projection.integration.test.ts
e4f8640f43b1466a9fa02e551eac6fc2757bcaca  tests/reservation-segment-changes.integration.test.ts
3137c9048713f295fa3aac314fa835b497093fd0  tests/schema/expected.sql
188e4146b6751acc01643d03279571841ec455b5  tests/database-acceptance.integration.test.ts
```

The acceptance diff is exactly one five-line v14 object. Removing the two authorized
function sections makes the schema snapshot byte-identical to Base. Migration 0014
contains exactly the two replacement functions, zero prohibited DDL/grants, zero
`cancelled` predicates and two exact `booked`/`in_house` predicates. Order-144/145
overlay blobs and protected files are byte-identical to Base. Protected SHA-256 values
remain:

```text
fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923  migrations/0001_init.sql
bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62  tests/seed_fixture.sql
2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d  tests/run_invariants.py
```

Final PostgreSQL inspection found zero `yellow_o126f_*` and zero `yellow_migrate_*`
databases. The shared PostgreSQL/Valkey services remain healthy and unmodified; no app
container was started. This builder evidence is not independent review and does not
authorize merge, push, deployment or Cyber closure.

## Definition of done

- [x] Orders 129, 130, 142 and 143 are independently approved and present in the
      approved ancestry.
- [x] Questions 147 and 148 are resolved by independently approved Orders 143–146
      without a validation bypass.
- [x] D-377 exclusions remain exact; obsolete D-382 is absent; 0014 is next.
- [x] Question 149 is resolved by D-390's exact two-path, governance-first amendment;
      the cancelled-parent correction and complete fresh proof remain pending.
- [x] P0 is freshly reproduced on exact approved Base.
- [x] Builder P1–P4 pass on immutable executable
      `16b48bdfb559dcc9ce0a417a427f3cc5b5d6b1fb`.
- [ ] Independent non-implementing Tier-3 review approves that exact SHA.
- [ ] Only `occ_2f4ca8c2e6f1d7352ba849c8` is then eligible for discharge; every sibling
      finding remains outside scope.
