# Order 486 independent review — current-date colleague scenario

**Reviewer:** Codex independent reviewer (non-implementing)  
**Date:** 2026-09-20  
**Verdict:** **Changes required — do not run the provisioner against a database.**

## Proof executed

No database, provisioner, migration, seed, application, or tunnel command was run.

From `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`:

```text
bunx tsc --noEmit
# exit 0

bun test tests/colleague-current-date-scenario.test.ts
# 2 pass, 0 fail, 10 expectations
```

Static inspection confirms that the script establishes one transaction, uses
`set_config('app.tenant_id', ..., true)`, takes an advisory transaction lock, and
uses `record_occupancy()` rather than direct `space_occupancy` DML. The identities
are invented, tagged `synthetic` and `contact_free`, and no contact point, payment
instrument, payment, or document data is created. Property-local date formatting uses
`Intl.DateTimeFormat(...).formatToParts()` for `Asia/Kolkata`, avoiding locale-order
ambiguity. The declared lane mixture is 24 rooms, 5 arrivals, 3 departures, 7
in-house, 4 future and 2 historical reservations; the OOO room is not one of the
assigned reservation rooms.

## Blocking findings

1. **P0 — inventory/OOO events and audit facts are missing.** Lines 238–242 insert
   `ooo_oos` and call `record_occupancy()` directly, but emit neither the required
   `ooo.opened` nor `occupancy.recorded` outbox events and record no OOO fact. The
   existing `OperationalBlockService` explicitly records the fact and publishes both
   events; the availability projection consumer consumes exactly those events. This
   violates the project outbox invariant and makes sellability/projection proof
   incomplete. The same gap exists for new unit types, spaces and sellable units:
   the provisioner writes them directly without the `unit_type.created`,
   `space.created`, or `sellable_unit.created` events required to bootstrap a derived
   availability projection.

2. **P1 — replay acceptance is not sufficient for an idempotent current-date
   scenario.** Lines 131–143 validate only six reservation/room counts. A corrupted
   or partial existing property with those counts can be accepted even if it lacks the
   BAR rate plan, unit mappings, guest links, occupancy rows, OOO block, cashier
   drawer, conditions/tasks, role grant, facts or outbox records. It also does not
   bind the existing scenario's generated stay periods to the requested
   property-local business date. A rerun on a later date returns the new date while
   retaining stale prior-date reservation periods/statuses. The provisioner must either
   validate the complete deterministic target including date anchors and all required
   audit/event/occupancy evidence, or fail safely on a date mismatch; it must not
   silently call that state a current-date replay.

3. **P1 — focused test coverage is only textual.** The two current tests prove string
   presence and constants, not tenant isolation, actual exclusive occupancy claims,
   emitted outbox/fact records, current-date lane query results, OOO projection
   behavior, role scope, or replay integrity. Order 486 explicitly requires those
   independent database proofs before a run can be approved.

## Required remediation before re-review

Use the existing governed inventory/OOO and audit/event patterns (or an explicitly
authorized seed-safe equivalent) inside the same tenant transaction; emit the required
facts and outbox events atomically with state. Strengthen deterministic replay checks
to cover every required object and current-date anchor, fail on mismatch, and add a
disposable-database integration proof for tenant isolation, occupancy, events/facts,
OOO projection, role scope and the six lane counts. A new independent reviewer must
then execute that proof.

## Remediation re-review — 2026-09-20

**Verdict remains: Changes required — database execution is still not approved.**

The remediation resolves the earlier missing-event P0 **in static inspection**:
the script now writes facts and outbox rows in the enclosing transaction for
`unit_type.created`, `space.created`, `sellable_unit.created`, `ooo.opened`, and
each `occupancy.recorded`; the period values are `tstzrange` strings, which is the
shape required by `AvailabilityProjectionConsumer.propertyPeriodEnvelope`. The
property configuration includes the requested business date, and the replay branch
now validates broader counts for inventory, lanes, grant, occupancy, OOO, drawer,
conditions, tasks, facts and events. The focused static test increased to 18
expectations and passes; `bunx tsc --noEmit` also exits 0. No database command was
run in this re-review.

However, two material review findings remain:

1. **P0 — occupancy event aggregate identity is wrong.** `auditScenarioWrite`
uses its `entityId` for both the fact entity and outbox `aggregate_id`. The occupancy
calls pass the reservation id (or OOO block id) as that entity id while declaring
`aggregate_type = 'space_occupancy'`. Existing governed writers publish the returned
occupancy id as the `space_occupancy` aggregate id. The scenario must pass
`occupancyId` / `oooOccupancyId` as the occupancy event aggregate identity (and use a
consistent audit entity shape) so consumers and audit correlation do not see a
misidentified aggregate.

2. **P1 — proof and replay validation are still count-based rather than complete.**
The wider replay query does not prove 24 `sellable_unit_space` mappings, deterministic
reservation confirmations/segments/guest links, exact segment date anchors, exact
role actor/role scope, or the required event types and payload identities. The fact
count is tenant-wide by scenario payload rather than property-bound. The focused test
continues to be a source-text test; it does not instantiate an
`AvailabilityProjectionConsumer`, assert the emitted payload contract, prove tenant
isolation, or query the six current-date lanes after provision/replay. Order 486's
required independent tenant, occupancy, event/audit, OOO projection and lane-count
proof therefore remains missing.

Correct those issues and provide a disposable-database integration test that executes
the provisioner, drains the projection consumer, proves the expected lane and OOO
state, proves a second tenant cannot see it, then confirms same-date replay succeeds
and different-date replay fails without mutation. A fresh independent reviewer must
run that proof before any non-disposable database execution.

## Disposable database proof re-review — 2026-09-20

**Verdict remains: Changes required — do not use this provisioner against the public
database.** The reviewer used only the named disposable database
`yellow_colleague_proof` in container `yellow-public-demo-postgres-1`, through
`BEGIN READ ONLY` transactions. No public database, provisioner, seed, migration, or
write command was run.

### Independent evidence

`bunx tsc --noEmit` exited 0. `bun test
tests/colleague-current-date-scenario.test.ts` returned 2 pass, 0 fail, 20
expectations.

The read-only disposable query found:

- property-local date configuration equals the current `Asia/Kolkata` date;
- 24 rooms; 5 due-ins; 3 due-outs; 7 in-house; 20 occupancy claims; and one OOO;
- 20 `occupancy.recorded` events, with every event's `aggregate_id` equal to its
  payload `occupancy_id` and to an actual occupancy row;
- 52 inventory creation events (4 unit types, 24 spaces, 24 sellable units), one
  `ooo.opened` event, and one OOO occupancy event;
- 130 total scenario facts and 130 property outbox events.

The exact event and fact-type distributions were identical, confirming the scenario
writer records one fact alongside each emitted event.

### Remaining blockers found by the independent proof

1. **P0 — the two checked-out reservations have no audit/event record.** The property
contains 21 reservations but only 19 `reservation.scenario_seeded` facts/outbox events.
Current source places both the reservation audit call and occupancy audit call inside
`if (stay.status !== "checked_out")`. Historical reservations correctly need no active
occupancy claim, but their reservation creation is still a state change which must be
audited and emitted. Move `reservation.scenario_seeded` outside that condition; leave
only the occupancy creation/event inside it. Update the expected fact/event counts and
prove all 21 reservation events.

2. **P1 — tenant isolation and replay were not independently executable under the
provided proof target.** The disposable database has no second tenant. Its
`yellow_runtime` role has no direct `SELECT` grant on the scenario tables, so a direct
RLS read attempt correctly stopped with permission denied before it could test row
visibility. The final stored counts show no duplicate rows, but they do not prove that
an independently invoked same-date replay succeeded without writes or that a
different-date replay failed atomically. Supply a disposable two-tenant harness and
an approved application/read surface (or a purpose-built RLS test role) plus an
integration test that performs both replay cases.

Once the missing historical reservation events and executable two-tenant/replay proof
are supplied, an independent reviewer can re-run the disposable proof. No production
or public-database scenario provision is approved by this record.

## Historical-reservation remediation re-check — 2026-09-20

**P0 resolved in the disposable proof target.** The source now writes
`reservation.scenario_seeded` before the checked-out occupancy guard, while preserving
the intended no-active-occupancy behavior for historical stays. The reviewer again
used only `yellow_colleague_proof` and `BEGIN READ ONLY` queries.

Independent results: 21 reservations, 20 active claims, 132 property outbox events,
21 reservation events, 20 occupancy events, one `ooo.opened` event, and 42 combined
reservation/occupancy/OOO facts. Every occupancy event had an aggregate id equal to
its payload occupancy id and to a persisted occupancy claim. `bunx tsc --noEmit`
exited 0 and the focused test returned 2 pass, 0 fail, 20 expectations.

The approval blocker is now only the still-unexecuted independent validation surface:
the provided disposable database has one tenant and no direct runtime-role table read
grant, so it cannot demonstrate cross-tenant denial; final counts alone cannot prove
an independently executed same-date replay or a different-date rejection with no
mutation. Provide a disposable two-tenant integration harness that exercises an
approved tenant-scoped read surface and invokes both replay cases. Until then, the
scenario is not approved for the public database.

## Two-tenant/replay integration re-review — 2026-09-20

**Verdict: Changes required — integration behavior passes, but cleanup is unsafe and
the public database remains unapproved.** The reviewer personally executed the
database-enabled focused test twice, with a random short-lived executor role and only
against `yellow_colleague_proof`. Both executions returned 4 pass, 0 fail, 26
expectations. This independently proves same-date replay, changed-date rejection with
unchanged counts, and the intended non-login RLS role behavior for source versus
second-tenant contexts.

### P0 cleanup failure

The test's cleanup does **not** drop its generated `colleague_rls_*` role. A
read-only before/after role-count check was 7 before the second independent execution
and 8 after it. The test grants `SELECT` on `cash_drawer` and
`cash_drawer_denomination` to that role, then catches and ignores `DROP ROLE` failure
without first revoking those object privileges. PostgreSQL consequently retains the
NOLOGIN role and its grants, despite the green test result. This is a cluster-wide
security/configuration leak, even though the role itself is non-login and the target
database is disposable.

Repair the test cleanup to revoke both table grants, revoke membership, drop the role,
and assert in the test that the role and temporary tenant are absent afterwards. Clean
up the already orphaned disposable proof roles under an explicitly scoped maintenance
step. Re-run the integration test and prove a stable before/after role count before
requesting another independent approval.

## Cleanup remediation final re-review — 2026-09-20

**Approved for Order 486's synthetic colleague-scenario scope.** The reviewer
personally ran the database-enabled proof only against
`yellow_colleague_proof`; no public database/runtime, public tunnel, migration, or
production seed was touched.

The current test cleanup revokes `SELECT` on both exact proof tables, revokes the
temporary role membership, drops the role, deletes the temporary tenant, and asserts
both are absent. `bunx tsc --noEmit` exited 0. The full focused proof returned:

```text
4 pass, 0 fail, 27 expectations
```

It independently exercised same-date replay, changed-date rejection with unchanged
counts, and a non-login, non-bypass-RLS role reading the drawer only in the source
tenant and seeing zero rows in the second tenant. An exact-match proof-role count was
0 before and 0 after the independent execution. The earlier orphaned disposable roles
had already been removed by the scoped maintenance step and the current run created no
new residual role or tenant.

This approval is limited to the deterministic, contact-free synthetic scenario in the
disposable/public-review environment. It does not authorize real guest data, external
provider/OTA activity, financial postings, credentials, or any production customer
database operation.
