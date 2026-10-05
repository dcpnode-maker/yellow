# Order 355 — Order349 carried-discrepancy lineage readiness

**Status:** APPROVED-D1060
**Phase:** 5 — Financials
**Branch:** `phase-5/order349-carried-discrepancy-lineage-readiness`
**Base:** exact approved D1051 frontier `2a78dfa`; product ancestry includes approved Order349/352, Order351/359/363/366/368, Order371 and Order372 candidate `c640c5c`
**Risk tier:** 3 — tenant-scoped financial close evidence and immutable discrepancy lineage
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Extend only Order349's immutable read-only business-day close-readiness snapshot so
that one unresolved target discrepancy created by the governed Order351 transition is
safely attributable through exactly one canonical `discrepancy.carried` event plus
exactly one immutable `business_day_discrepancy_carry` link. Preserve the existing
`discrepancy.reported` creation path for ordinary discrepancies and preserve all
unknown/fail-closed behavior when either lineage is absent, duplicated, mixed,
foreign, inconsistent or ambiguous.

This order does not create, consume, repair or reinterpret a carry. It does not seal,
reopen or roll either day. It adds no write path, schema object, migration,
permission, event, fact, approval, API or UI.

## Authority and prerequisites

D990 requires the governed carry to create one linked unresolved current-day
discrepancy and one canonical `discrepancy.carried` event. Order349 deliberately
recognizes only exactly one canonical `discrepancy.reported` event. Order351 records
the resulting activation gap and forbids emitting a second report event or weakening
readiness attribution. This order is the exact separately reviewed follow-on.

Activation is forbidden until all of the following are true and recorded against an
exact commit frontier:

- Order349, including Order352's PostgreSQL/fixture/proof repair, has fresh independent
  Tier-3 approval and is closed;
- Order351 has landed with its exact migration, immutable carry-link schema,
  constraints, canonical event and fresh independent Tier-3 approval;
- the actual post-Order351 catalogue, table/column/constraint names, event shape,
  readiness implementation and focused tests are re-read rather than inferred from
  draft contracts; and
- activation amends this draft with the exact base commit, exact catalogue and exact
  implementation/test/document file list if they differ from the names below.

Creation of this draft grants no implementation authority. No intentional red or
production edit may begin before activation records those prerequisites.

## Activation — D1052

D1051 independently approves Order372 at exact governance frontier `2a78dfa` and
product candidate `c640c5c`; D1043 independently approves the complete governed-carry
ancestry. Fresh executable truth remains 63 sequential migrations, 116 public base
tables, 106 tenant-RLS policies, 15 FORCE-RLS tables and two security-invoker views.
All activation prerequisites are satisfied and no founder-policy question remains.

Re-reading migration0063 and the current readiness/carry proofs establishes that
outbox exposes no typed carry hashes. The read model must therefore recompute the
canonical state/request hashes from immutable typed relational/link values using the
exact migration0063 formula; payload JSON remains wholly irrelevant. To reuse the
real governed request/approval/carry transition and avoid a duplicate fixture, the
exact product/test scope is corrected to:

- `src/contexts/financials/business-day-close-readiness.ts`;
- `tests/business-day-discrepancy-carry.integration.test.ts`;
- directly affected readiness-only wording in `docs/CONTRACTS.md` and
  `docs/STATE-MACHINES.md` only if clarification is required; and
- this order, its review, `DECISIONS.log`, `handoff/LEDGER.md`, and directly affected
  Phase tracker wording only after executable proof.

The existing readiness integration/unit files are preservation gates, not expected
edit scope. Intentional red must execute the real carry and prove the current target
is unknown solely because carried lineage is unrecognized. No schema/write/API/UI/
local/seal authority is admitted. Any additional product/test file requires a
recorded pre-edit scope amendment.

## Exact read-only lineage contract

An unresolved discrepancy blocks the exact target readiness snapshot only when its
creation is safely attributable by exactly one of these mutually exclusive paths:

1. **Ordinary report lineage:** the unchanged Order349 rule requiring exactly one
   canonical same-tenant `discrepancy.reported` event for the exact discrepancy,
   property and business date, plus the same-tenant room/property relationship.
2. **Governed carry lineage:** exactly one same-tenant
   `business_day_discrepancy_carry` row whose `target_discrepancy_id` is the exact
   unresolved discrepancy, whose target tenant/property/date/room values match the
   target discrepancy, room, target business day and snapshot, and exactly one
   canonical same-tenant `discrepancy.carried` outbox event with
   `aggregate_type='discrepancy'`, the exact target discrepancy id, exact typed
   property and exact typed target `business_date`.

The carried path additionally requires complete source-to-target containment from the
immutable link: exact source discrepancy, distinct source and target discrepancy ids,
exact source and target business dates, exact property and room, and the persisted
canonical discrepancy-state and request SHA-256 values required by Order351. The read
model byte-validates the persisted lowercase hashes and their required equality to
the canonical carried-event evidence only where Order351 exposes those values as
typed link/event fields; payload JSON is never parsed or trusted to supply or repair
tenant, property, date, room, source, target, status or hash authority.

Exactly one creation lineage is required. A target with both `discrepancy.reported`
and `discrepancy.carried`, multiple matching events, multiple links, an event without
its link, a link without its event, or any mismatched tenant/property/date/room/
source/target/hash evidence is unknown and fails closed. Foreign evidence is never
counted, disclosed or allowed to complete local lineage. Resolved discrepancies
remain excluded under Order349's existing rule.

The externally visible result shape, reason vocabulary, reason ordering, blocker
count semantics, strict outbox-age threshold, actor/tenant/property/day containment,
single-CTE/single-transaction snapshot, immutability and zero-write behavior remain
unchanged. A safely attributed carried target contributes to the existing
`unresolvedDiscrepancies` count and `unresolved_discrepancy` reason; this order adds no
new readiness state, override, authorization token or seal promise.

## Natural solution and exact scope

Extend the existing Order349 PostgreSQL CTE/decoder only enough to admit the governed
carried lineage as the second mutually exclusive creation path, using the immutable
Order351 link and typed outbox columns. Keep one statement inside the existing tenant
transaction and preserve the exact PostgreSQL-authored timestamp. No new database
object or direct authority is needed.

Provisional implementation scope, to be made exact at activation:

- `src/contexts/financials/business-day-close-readiness.ts`;
- `tests/business-day-close-readiness.test.ts` only if the decoder/query contract
  requires a bounded carried-lineage case;
- `tests/business-day-close-readiness.integration.test.ts` for the complete hostile
  PostgreSQL lineage matrix;
- directly affected readiness-only wording in `docs/CONTRACTS.md`,
  `docs/STATE-MACHINES.md`, `BUILD-PLAN.md`, `handoff/PHASE-5-PLAN.md` and
  `handoff/ROADMAP.md`;
- this order, its bounded review evidence, `DECISIONS.log` and `handoff/LEDGER.md`.

No context export is expected because the public Order349 contract does not change.
Any required file outside the activated exact list, or any need to alter Order351's
schema/event/carry behavior, requires a recorded pre-edit scope amendment or question.

## Exact executable proof

### P0 — frontier and intentional red

On the exact approved post-Order351 frontier, prove an ordinary unresolved reported
discrepancy is classified exactly as Order349 requires, while a valid carried target
is unknown/fail-closed solely because readiness does not yet recognize its canonical
carry link/event. Record the focused intentional red before production edits and
prove no other expectation is red.

### P1 — canonical carried target

Using fresh PostgreSQL at the activated catalogue, execute the real Order351 carry
transition, then read readiness for the exact target property/day. Prove one
unresolved carried target with exactly one immutable link and exactly one canonical
event contributes exactly one existing discrepancy blocker, with unchanged result
shape and deterministic reason order. Prove the source day, other property and other
date do not acquire the target blocker.

### P2 — exactly-one and mutual-exclusion hostility

Independently prove unknown/fail-closed for missing event, missing link, duplicate
event, duplicate/aliased link where hostile setup can bypass normal constraints,
both reported and carried creation events, wrong aggregate type/id, resolved target,
and unsupported lineage vocabulary. Constraint-rejected hostile fixtures count as
proof of prevention only when the retained read-path ambiguity cases are also
executed.

### P3 — containment and hashes

Vary tenant, property, target date, room, source discrepancy, target discrepancy,
source date, target date, request hash and discrepancy-state hash one at a time.
Every mismatch is unknown/fail-closed with no cross-tenant disclosure. Prove exact
same UUIDs in another tenant, foreign room/property/day rows, reversed source/target,
same source/target, stale source linkage, forged event payload fields and forged
payload hashes cannot complete lineage. Typed link/event values alone are authority;
payload JSON remains irrelevant.

### P4 — preservation, coherence and zero writes

Re-execute the complete Order349/352 tenant/actor, due-in/out, cashier, ordinary
discrepancy, strict 4m59.999/exact-five-minute/future lag, interface-unknown,
payload-hostility, decoder, one-statement and concurrency matrix unchanged. Prove one
tenant transaction and one snapshot statement, immutable deeply frozen output and
zero changes to business days, discrepancies, carry links, approvals, facts, outbox,
idempotency, journals, postings or any other table. A concurrent carry or resolution
may affect only a subsequent read and never turns the earlier snapshot into seal
authority.

### P5 — permanent gates and independent review

Run focused readiness and Order351 carry regressions; affected business-day,
discrepancy, outbox, migration/schema/database-acceptance/runtime-authority/
runtime-DML/SECURITY-DEFINER gates; typecheck, boundaries, licences, audit, the full
standing suite and fresh `./setup.sh --db-only` referee `11/11`. Assert the exact
activated catalogue is unchanged by this order. A fresh independent non-implementing
Tier-3 reviewer must personally execute the canonical carried-target, exactly-one,
mutual-exclusion, tenant/property/date/room/source-target/hash hostility,
payload-irrelevance, concurrency and zero-write proofs on the exact candidate and
record commands and results before approval.

## Forbidden

- migration, schema/table/view/function/column/index/constraint/policy/role,
  permission, capability or catalogue change;
- any discrepancy, carry-link, approval, fact, outbox, idempotency, business-day,
  journal, posting, payment, fiscal, statutory or channel write;
- carry request/approval/consumption, ordinary discrepancy resolution, seal, reopen,
  roll, forced close or readiness override;
- treating a carry event without its immutable link, a link without its canonical
  event, duplicate or mixed creation lineage, payload JSON, caller hashes, clocks,
  current timezone, cache or projection as authority;
- HTTP/API/operator/UI/dashboard, local seed/status/promotion, Docker, `.yellow`,
  stable port3000, merge, push, deployment or Phase5/application completion claim;
- weakening Order349/352/351 assertions, fail-closed behavior, exact catalogue,
  standing/static gates or referee oracles.

## Definition of done

- [x] Activation records exact approved Order349/352 and Order351 ancestry,
      catalogue and scope before intentional red or implementation.
- [x] Intentional red proves only the valid carried-target recognition gap. At exact
      activated frontier `f986e52`, the real governed carry suite passes its eleven
      existing cases and fails only the new target-readiness assertion: expected one
      unresolved discrepancy, received zero (`11 pass / 1 fail`, 1,784 assertions).
- [x] Exactly one canonical carried event plus exactly one immutable carry link admits
      one existing unresolved-discrepancy blocker with no public result-shape change.
- [x] Exactly-one lineage and tenant/property/date/room/source-target/hash containment
      are executable; missing, duplicate, mixed, foreign or mismatched evidence stays
      unknown/fail-closed with zero payload authority.
- [x] Complete Order349/352 and Order351 preservation, zero-write, static, standing
      and fresh referee gates pass with the activated catalogue unchanged.
- [x] Fresh independent non-implementing Tier-3 approval and reviewer-run proof are
      recorded before closure.

## Final closure — D1060

Fresh independent non-implementing Tier-3 `/root/order373_fresh_tier3` separately
audited this order's complete P0–P5 contract after the D1055 repair. On exact combined
product `c988e8885aabc0eb9063e12a54543e4767cedb1c` and governance `1629f9f`, the
reviewer-personal 27-case readiness/carry matrix, isolated D1055 exploit, full hostile
source-event matrix, load-bearing repair mutation, official PostgreSQL 16.15 gates,
catalogue/schema proofs, standing/static gates and separate referee cover every
Order355 completion requirement. The permanent matrix includes both persisted hash
mismatch families, exact-one/mutual-exclusion hostility, tenant/property/date/room/
source-target containment, payload irrelevance, snapshot/concurrency preservation and
catalogue-derived zero writes. No additional product or local proof was required.

Order355 is therefore approved and closed. Exact evidence and the requirement-by-
requirement coverage map are recorded in
`handoff/reviews/355-order349-carried-discrepancy-lineage-readiness-final-closure.md`.
This closure adds no seal, carry mutation, schema, API, UI, local, deployment, merge,
Phase-5 or application-completion authority.

Historical review D1055 withheld the original exact candidate. A reviewer-only fresh PostgreSQL
case moved the carry link's source date to a third existing same-property day and
recomputed the canonical request hash; readiness incorrectly returned one known
unresolved blocker instead of fail-closed unknown attribution because the query does
not bind source property/date to the source discrepancy's canonical typed
`discrepancy.reported` event. See
`handoff/reviews/355-order349-carried-discrepancy-lineage-readiness.md`. Product and
permanent test candidate bytes remained unchanged; it required the separately scoped
Order373 repair and different fresh Tier-3 approval now completed by D1059/D1060.

Creation of this draft grants no implementation authority. Completion would extend
only read-only readiness attribution for the exact governed carried-target lineage;
it would grant no carry, seal, write, UI, local or Phase5 completion authority.

## Builder evidence — D1054

Exact product candidate `40eed2b7d4a32a114121023688b9561a052b5c8d` recomputes the
migration0063 state/request hashes from typed source/link truth and admits only one
mutually exclusive link/event pair. The real carry/readiness preservation matrix is
26/0 with 1,968 assertions; its hostile case covers missing link/event, duplicate and
mixed events, wrong aggregate/property/date/actor/request/time, room/property/date/
source-target/link-time/hash mismatches, resolved targets, forged payload irrelevance,
source/other-property silence and catalogue-derived byte-stable zero writes. Standing
is 1,217/0 with 948 expected database skips and 18,524 assertions. Typecheck, 139-file
boundaries, 23-package licence policy, runtime-DML 5/0, SECURITY-DEFINER 3/0 and a
fresh 63-migration/116-table referee database 11/11 pass; live catalogue remains
63/116/106/106/15/2. The inherited distro server makes the authentication-redaction
migration harness green only 38/39 because its deploy role is trusted and reports a
distro-suffixed version; this is not approval proof and the fresh exact-environment
Tier-3 reviewer must rerun every permanent gate. Stable port3000 and `.yellow` were
untouched.
