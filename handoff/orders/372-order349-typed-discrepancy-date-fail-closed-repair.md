# Order 372 — Order349 typed discrepancy-date fail-closed repair

**Status:** BUILT-PENDING-FRESH-TIER3-D1050
**Phase:** 5 — Financials
**Branch:** `phase-5/order349-typed-discrepancy-date-fail-closed-repair`
**Base:** exact approved Order371 governance frontier `bb925c8` / product candidate `8d96974`, carrying approved Orders349/352 and 368/366/363/359/351
**Risk tier:** 3 — tenant-scoped financial close-readiness evidence
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Make the existing Order349 read-only business-day close-readiness snapshot fail closed
when an unresolved discrepancy has exactly one otherwise canonical typed
`discrepancy.reported` event whose typed `business_date` differs from the target day.
Preserve correct ordinary discrepancy blocking, payload irrelevance,
result shape, reason vocabulary/order, one-statement snapshot and zero-write behavior.

This repair does not recognize `discrepancy.carried`; that remains Order355. It adds
no write, schema, migration, event, permission, API or UI.

## Defect and activation prerequisites

The current SQL counts a discrepancy as safe only when `event_date` equals the target
day, but its `unknown_discrepancy` predicate checks event multiplicity/property and
omits typed event-date mismatch. Consequently such a row can disappear from both
the blocker and unknown counts. The existing hostile test forges only payload date
while leaving the typed date correct, so it cannot detect the defect.

Activation is forbidden until Orders 368 and 371 have fresh approval. Re-read the
actual Order349/352 query and tests at that frontier and record an intentional red in
which a wrong typed event date must yield unknown/fail-closed. Creation of
this draft grants no implementation authority.

## Activation and contract correction — D1049

D1048 independently approves Order371 at exact governance `bb925c8` / product
candidate `8d96974`; all prerequisites are now approved and the unchanged catalogue
is 63 migrations, 116 public base tables, 106 tenant-RLS policies, 15 FORCE-RLS
tables and 2 security-invoker views.

Pre-activation catalogue inspection proves `outbox.business_date` is `NOT NULL` in
both the immutable baseline and canonical expected schema. One canonical event with
a null typed date therefore cannot be inserted; missing-event `event_date` is already
caught by `event_count<>1`. Temporarily weakening schema to manufacture that case
would violate scope and the constitution. The executable red is corrected to the
real wrong-typed-date disappearance, while the natural predicate remains null-safe
with `IS DISTINCT FROM` and permanent proof asserts the database non-null constraint.
The existing readiness integration file may also replace its hard-coded zero-write
census with a catalogue-derived tenant-bearing relation snapshot; this is proof-only
within the already listed file and adds no authority.

## Exact scope

- `src/contexts/financials/business-day-close-readiness.ts`;
- `tests/business-day-close-readiness.integration.test.ts`;
- directly affected wording in `docs/CONTRACTS.md` only if clarification is needed;
- this order, its review evidence, `DECISIONS.log` and `handoff/LEDGER.md`.

No unit-test, context-export, migration, schema snapshot, carry implementation,
Phase-plan or UI file is expected. Any additional file requires a recorded pre-edit
scope amendment.

## Executable proof

1. Intentional red: exact ordinary lineage remains one blocker; one wrong typed date
   currently disappears instead of producing unknown/fail-closed. Prove separately
   that PostgreSQL rejects a null typed outbox date.
2. Add the natural typed-date null-safe mismatch condition to the existing unknown
   predicate without changing the single CTE statement or public decoder/result.
3. Prove correct typed target date blocks once; wrong typed dates are unknown;
   missing events remain unknown and forged payload dates never change classification.
4. Prove missing/duplicate/foreign event, wrong property/room/tenant/date and resolved
   discrepancy behavior remains fail-closed and cross-tenant silent.
5. Prove one transaction, one snapshot statement, deeply frozen output, concurrency
   behavior and catalogue-derived zero writes.
6. Run focused readiness, Order349/352 preservation, Order351 carry preservation,
   fresh setup/referee 11/11, complete standing/static/schema/authority gates.
7. A fresh independent non-implementing Tier-3 reviewer personally executes the
   typed-date hostility, tenant containment, concurrency and zero-write proof.

## Forbidden

- recognizing `discrepancy.carried` or changing the carry schema/service/event;
- any discrepancy, business-day, approval, fact, outbox, journal or posting write;
- payload-derived authority, caller clocks/hashes, new reason/state/result field;
- migration/schema/ACL/policy/API/UI/local/`.yellow`/Docker/port3000 changes;
- merge, push, deployment or Phase/application completion claim.

## Definition of done

- [x] Activation records exact prerequisite approvals, frontier and unchanged catalogue.
- [x] Intentional red isolates wrong typed report-date disappearance and catalogue proof rejects null.
- [x] Wrong typed date fails closed while canonical ordinary lineage and payload hostility remain green.
- [x] One-statement, zero-write, standing/static and fresh referee gates pass.
- [ ] Fresh independent Tier-3 approval is recorded before Order355 activation.

## Builder evidence — D1050

Exact product candidate `c640c5cc7431c8b1a410c4146ad07dd57d61f03c` adds only
the target-property-guarded, null-safe typed-date mismatch predicate and permanent
proof in the existing readiness integration file. Before the production edit, fresh
PostgreSQL 16.15 returned `unknownAttribution=0` for the wrong typed date and the
new named case failed exactly once; ordinary lineage remained green. After repair:

- readiness integration passes 7/0 with 52 assertions, including actual SQLSTATE
  23502 for a null outbox business date, one recorded readiness statement, the
  publication race and byte-stable snapshots of every catalogue-derived public
  tenant-bearing relation;
- Order349/352 unit preservation plus approved Order351/359 carry preservation pass
  18/0 with 1,843 assertions;
- standing passes 1,217/0 with 946 expected database skips and 18,524 assertions;
- typecheck, 139-file import boundaries, 23-package licence policy, production audit
  zero and diff hygiene pass; and
- a separately created, migrated and fixture-loaded referee database passes 11/11.

The packaged fallback server exposes the distro-suffixed version string instead of
the exact source-build string required by acceptance, and Docker's API was
non-responsive, so builder acceptance/setup output is not offered as approval proof.
Fresh independent Tier-3 must personally use the exact required environment and run
the complete executable matrix. Stable port 3000 remained read-only and returned
`200 {"status":"ok"}`; no `.yellow` or stable named resource was changed.
