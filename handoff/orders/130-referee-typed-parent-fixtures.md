# Order 130 — Make the protected referee use authoritative occupancy parents

**Status:** APPROVED — exact executable `f7867cd7fa8aad0e38893575cad6158ba171d0a4`
**Phase:** 5 · Cyber prerequisite for Order 126
**Tier:** 3 — protected invariant referee and occupancy proof harness
**Branch:** `phase-5/referee-typed-parent-fixtures`
**Approved immutable base:** `972d0cfef0b7e4b8499065f70eea3226aeacb187`
(`9a6ef73e5e39c8594dda4e56fe5e405aebaa0b90` executable)
**Question:** `handoff/questions/146-order126-protected-referee-typed-parents.md`

## Purpose

Strict Order 126 requires every `segment` occupancy claim, including owner-executed
maintenance/test calls, to have an exact same-tenant reservation and reservation-segment
parent. The protected referee currently invents a segment UUID immediately before each
claim. Its TC-12 races therefore cannot reach the exclusion/capacity arbiter once the
strict validator is installed.

If Question 146 selects its recommended option 1, this order modernizes only the
architect fixture and referee harness so TC-12 exercises the real typed-parent contract
without weakening any race, choke-point or throughput assertion. It is a prerequisite,
not a Cyber finding fix. Order 126 remains the sole owner of the production validation
migration and cannot resume until this order is independently approved.

## Preconditions

1. A non-implementing Tier-3 reviewer approves Order 129's exact executable SHA
   `9a6ef73e5e39c8594dda4e56fe5e405aebaa0b90`, and its review metadata is adopted as
   this order's immutable base.
2. Question 146 explicitly authorizes option 1. The decision must reject an owner
   bypass and any weakening of the strict typed-parent contract.
3. Before implementation, record the approved base, decision and exact protected hashes.
   Until then, this file authorizes no source, fixture or referee edit.

These preconditions were satisfied before source work: Order 129 was independently
approved at metadata head `972d0cfef0b7e4b8499065f70eea3226aeacb187`, and D-371
records the founder's selection of Question 146 option 1. The frozen pre-change hashes
are `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`
for `tests/run_invariants.py`,
`21899943077e2bcdfe576271f610f90eea33a5d798f999970deae7d54e54358b`
for `tests/seed_fixture.sql`, and
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
for the immutable baseline migration.

## Scope

- `handoff/orders/130-referee-typed-parent-fixtures.md`
- `handoff/questions/146-order126-protected-referee-typed-parents.md`
- `tests/seed_fixture.sql`
- `tests/run_invariants.py`
- `tests/referee-typed-parent-fixtures.integration.test.ts` (new)
- `tests/PMS_QA_Test_Suite.md` only if its TC-12 setup contract must describe the
  authoritative parent preparation already executed by the referee
- `handoff/GATE-3-MANIFEST.md`
- `tests/founder-status.integration.test.ts` only for an existing exact protected-hash
  assertion that must move to the independently approved new referee hash
- `scripts/run-phase-3-gate.ts` only if registration of the new focused proof is
  required by the repository's current cumulative-runner contract
- `DECISIONS.log`, `handoff/LEDGER.md`, one Order-130 review record, and the founder
  status source/tests only after executable proof and independent review

No other file is in scope. A need outside this list stops the order and creates a new
question; it does not silently expand this order.

## Required implementation

1. Repair only the architect fixture data needed by the referee:
   - add one deterministic tenant-A guest party suitable for reservation ownership;
   - make the dorm unit type belong to the same property as the dorm space;
   - add active sellable-unit mappings for both the dorm's positional sale and its
     exclusive private sale, each with an unambiguous claim mode;
   - preserve the existing room-101 exclusive mapping, all tenant-B/RLS fixtures and
     all non-occupancy data semantics.
2. Replace fabricated TC-12 `segment` slots with transaction-local authoritative
   parents. For every claim attempt, the same connection and transaction must:
   - generate a unique reservation and segment identifier;
   - insert a reservation for the exact tenant/property/guest/currency;
   - insert a segment whose tenant, reservation, unit type, sellable unit and period
     exactly match the requested space mapping and claim mode;
   - call `record_occupancy` only after both parents exist;
   - add the matching primary `reservation_guest` relationship before a winning
     transaction commits, without making it a precondition invented by the occupancy
     validator;
   - commit parents and occupancy together for winners, and roll all of them back for
     conflicts or validation failures.
3. Keep the occupancy function as the sole writer. TC-12.4 must continue attempting a
   direct application-role insert and require exact SQLSTATE `42501`.
4. Preserve the original referee meanings and strengths exactly:
   - TC-12.1: 50 concurrent exclusive attempts on room 101, exactly one winner;
   - TC-12.2: one exclusive-private and six positional dorm attempts, never coexisting;
   - TC-12.3: 40 concurrent positional attempts for six beds, exactly six winners;
   - TC-12.5: the existing eight-by-fifty concurrent throughput attempt, with at least
     one committed claim and a valid positive elapsed interval;
   - all eleven top-level referee results and every non-occupancy assertion remain.
5. Cleanup must use the existing proven owner/referee authority, verify its preconditions,
   and remove committed TC-12 parents only where needed for isolation. It must not add
   application grants, maintenance APIs or a production escape hatch.
6. Update the protected referee hash and manifest only after the intentional change is
   independently approved. The immutable `migrations/0001_init.sql` hash never changes.

## Pre-registered proof

### P0 — Old protected referee is incompatible with strict typed-parent enforcement

Against an isolated fresh database at the approved Order-129 base, install a test-only
typed-parent guard equivalent to Order 126's exact parent requirements without changing
production migrations. Execute the byte-identical pre-Order-130 referee. It must fail
TC-12 because fabricated segment IDs have no reservation parents, with zero successful
typed segment claims. The run must still show that TC-12.4's direct-DML denial is not the
cause. Preserve the exact parent hash and output as red evidence.

### P1 — Updated referee reaches the real arbiter with valid parents

On a new isolated database with the same test-only guard, execute the updated referee.
It must print `11 passed, 0 failed of 11`. Independently query the committed TC-12 winner
rows and prove every segment occupancy has exactly one matching same-tenant reservation
segment and reservation with the exact property, sellable mapping and period.
The same executable query must prove that committed reservation/segment/primary-guest
counts equal the successful attempt count for each isolated race and that there are zero
orphan reservations, zero orphan segments, zero orphan guest relationships and zero
occupancies or parents from losing attempts.

### P2 — Race strength is unchanged

On separate fresh databases, the focused suite must execute these concrete negatives
against the test-only guard and require their exact outcomes:

- omitted reservation or omitted segment parent rejects with the guard's exact typed-
  parent SQLSTATE/message and commits no artifact;
- wrong tenant, property, sellable mapping, unit type or period rejects with that same
  fail-closed class and commits no artifact;
- a forced losing exclusive/capacity attempt leaves zero reservation, segment, guest and
  occupancy artifacts for its generated identifiers;
- the real unchanged arbiter yields exactly 1/50 room-exclusive winners and exactly 6/40
  dorm-positional winners, while private and positional dorm claims never coexist;
- bypassing the `record_occupancy` call cannot satisfy the parent-plus-occupancy success
  postcondition, and weakening the winner/count assertion makes a dedicated mutation
  fixture fail rather than silently pass;
- the existing eight-by-fifty workload executes, commits at least one valid full parent
  chain and reports a positive interval; TC-12.4 still returns exact `42501`.

### P3 — Non-occupancy referee behavior and protected provenance are preserved

Add a machine-executed diff allowlist that rejects every change to
`tests/run_invariants.py` outside: new deterministic fixture constants; `record()`;
TC-12.2's mode-specific sellable selection; TC-12.3's occupancy/parent cleanup; and
`burst()`. The header, imports, `check()`, `conn()`, TC-12.4 direct-DML denial, and every
byte from the `# R6 / TC-5.6` marker through EOF must match the approved parent exactly.
The allowed regions may change only for authoritative parent preparation, successful
guest linkage, rollback and verified cleanup; thread counts, periods, winner/count
assertions and workload sizes remain machine-asserted. Record the old and proposed new
SHA-256 hashes; the baseline migration hash remains exactly
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`.

### P4 — Full acceptance

Run the focused proof and every database-backed affected/cumulative suite from newly
created, independently named isolated databases; no suite may inherit rows from an
earlier proof. Then run the default standing tests, typecheck, import boundaries, frozen
licence check, dependency audit, exact schema drift and both platform state checks where
supported. Finally run `./setup.sh --db-only` from another pristine, app-never-started
isolated project and require the current table count plus exactly `11 passed, 0 failed of
11`. Dispose only the labelled Order-130 resources after recording their identities.

### P5 — Independent Tier-3 review

A non-implementing reviewer must personally reproduce P0, execute P1-P4 on the exact
executable SHA, inspect every referee/fixture change, recompute both protected hashes,
and issue APPROVE or REJECT for that SHA. Builder output is not review evidence. The
builder cannot merge, deploy, mark live or claim Question 146/Order 126 complete.

## Forbidden

- Any production migration, function, trigger, role, grant, RLS policy or application
  behavior change
- Any owner, superuser, BYPASSRLS, caller flag or GUC exception to typed-parent checks
- Direct writes to `space_occupancy` except the existing TC-12.4 denial attempt and
  owner cleanup already required by the protected referee
- Reducing thread counts, bed capacity, exact winner assertions, direct-DML SQLSTATE,
  throughput workload or the eleven-result acceptance threshold
- Deleting or weakening a non-occupancy referee assertion
- Editing `migrations/0001_init.sql`
- Using Order 126's unreviewed migration as this order's product implementation
- Self-review, self-merge, canonical integration, push, deployment or live-status claims

## Definition of done

- [x] Order 129 is independently approved and its metadata head is the recorded base.
- [x] Question 146 resolves to the fixture/referee-only option.
- [x] P0 reproduces the old-harness typed-parent incompatibility without product edits.
- [x] P1-P4 pass on one immutable executable SHA with exact evidence.
- [x] The protected hash/manifest update is explicit and independently recomputed after
      review; the manifest now records the approved post-change referee hash.
- [x] A non-implementing Tier-3 reviewer approves that exact SHA.
- [x] Only then may Order 126 rebase on this approval and resume its strict migration.

## Builder evidence — D-375

The exact pre-change/P0 red SHA is
`52e295544dc67af172e1050cc8ea56f5cf6e7889`, whose referee SHA-256 is
`3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
On isolated database `yellow_dev` in Compose project `yellow-order130-p0`, the
test-only exact typed-parent guard produced 8 passed / 3 failed: TC-12.1 had zero
winners, TC-12.3 had zero claims, TC-12.5 had zero commits, zero typed segment claims
persisted, and TC-12.4 separately passed exact `42501`.

The exact executable is `f7867cd7fa8aad0e38893575cad6158ba171d0a4`.
On a newly created `yellow_order130_p1` database, the focused guarded proof passed
5/5 with 58 assertions, including exact committed parent/guest/occupancy equality,
zero losing/orphan artifacts, every preregistered mismatch at exact `P0003`, a forced
`23P01` loser rollback, the bypass negative and protected mutation/allowlist checks.
The embedded referee passed 11/11 with 1/50 room winners, 6/40 dorm winners,
private/positional noncoexistence, positive eight-by-fifty throughput and exact
TC-12.4 `42501`.

The Windows cumulative matrix reproduced the inherited Order-069 P8 host-timing stop
at 15,531.84 ms against its 15-second ceiling and was not called green. A complete
native-WSL restart passed all 19/19 independently recreated suites; Order-069 P8
passed there in 9,464.55 ms. Migration integration passed 17/17 with 95 assertions,
fresh deployment acceptance 6/6 with 13, standing tests 172/0 with 1,981 assertions,
typecheck, 64-file boundaries, 23-package licences, dependency audit, exact schema,
both platform state checks and hashes passed. Finally, app-never-started Compose project
`yellow-order130-pristine` passed `./setup.sh --db-only` with 85 tables and exactly
11 passed, 0 failed of 11. Labelled projects `yellow-order130-p0` and
`yellow-order130-pristine`, their networks and volumes were removed; the live
`yellow-founder-workbench` was untouched and remained healthy.

The proposed referee SHA-256 is
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`;
the updated fixture SHA-256 is
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`;
the immutable baseline remains
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`.
Per required implementation item 6, the Gate-3 manifest remains on the old protected
hash until a non-implementing Tier-3 reviewer personally recomputes and approves this
exact executable. No review, Order-126 completion, merge, push, deployment, live or
Cyber-closure claim is made.

## Independent Tier-3 review — D-376

An independent non-implementing OpenAI Codex reviewer APPROVES exact executable
`f7867cd7fa8aad0e38893575cad6158ba171d0a4` with no implementation, scope, occupancy,
tenant-isolation, protected-file, or proof-strength finding. The authoritative record
is `handoff/reviews/130-referee-typed-parent-fixtures.md`.

The reviewer personally reproduced P0 at exact red
`52e295544dc67af172e1050cc8ea56f5cf6e7889`, then executed P1-P4 at the exact
executable. Reviewer-only transactional observation proved that the one cleaned
TC-12.2 mixed winner had exactly one same-tenant primary guest and that losing attempts
left no parent, guest, or occupancy artifact. Focused proof passed 5/5 with 58
assertions, the native-WSL cumulative matrix passed 19/19, migrations passed 17/17,
deployment acceptance passed 6/6, standing tests passed 172/0 with 1,981 assertions,
and every remaining required gate passed. A separate pristine, app-never-started
`./setup.sh --db-only` produced 85 tables and exactly 11 passed, 0 failed.

The reviewer independently recomputed referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`, and immutable
baseline `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`.
The manifest now records the approved referee hash. Order 126 may rebase and resume,
but still requires its own execution and independent Tier-3 review; no Order-126 or
Cyber finding closure, merge, push, deployment, or live status is implied.
