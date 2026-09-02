# Order 357 fresh independent Tier-3 review

**Disposition:** WITHHOLD

**Reviewer:** `/root/order355_carry_readiness_contract`, fresh independent
non-implementing OpenAI Codex Tier-3 reviewer

**Exact reviewed candidate:** governance `4888831`, implementation `9070222`

## Finding

### P1 — required runtime-database authority catalogue gate is stale and red

`tests/runtime-database-authority.integration.test.ts` still requires the pre-Order350
catalogue `{ tables: 111, enabled: 101, forced: 10, policies: 101 }`. Fresh PostgreSQL
after migrations1–62 correctly returns `{ tables: 115, enabled: 105, forced: 14,
policies: 105 }`, so the required runtime authority suite finishes **9 pass / 1 fail,
88 assertions**. Order357 explicitly admits exact affected runtime oracles and requires
the runtime gate. Commit `9070222` updates the database-acceptance and migration
catalogue assertions but does not update this retained runtime-database authority
oracle. The candidate is therefore not reviewable as green and cannot close
Orders357/354/350.

This is a proof-oracle repair only: the observed database catalogue is the contracted
`62/115/105/14/2`, and the separately executed runtime-DML authority suite is green.
The required repair must change only the stale exact runtime catalogue expectation,
retain every role/membership/ownership/capability assertion, rerun the complete gates
below, and receive a different fresh Tier-3 rereview.

## Fresh executable evidence

I personally reproduced D1007 against exact parent `62a5870`: the parent
migration0062 lacks `ar.valid_until > transaction_timestamp()`, and the focused
expiry oracle reports the forever-approved buyer-override defect. I also removed the
expiry predicate from the candidate SQL in memory without editing the worktree; the
same oracle failed, killing the mutant.

On exact candidate `4888831`/`9070222`, a reviewer-owned isolated PostgreSQL **16.15**
stack with `pg_stat_statements` preloaded produced:

- focused service/validator/allocator proof **9/0, 21 assertions**;
- fresh PostgreSQL valuation proof **4/0, 49 assertions**, including exact expiry
  below/at/above boundaries, future decision, reuse, changed buyer/request, all eleven
  manual reasons, correction fork, real initial/correction races, rollback with zero
  artifacts, canonical two-generation facts/outbox/head, and direct UPDATE/DELETE
  denial;
- exact catalogue **62 migrations / 115 public tables / 105 RLS policies / 14
  FORCE-RLS tables / 2 security-invoker views**;
- migration runner **39/0, 187 assertions**; database acceptance **23/0, 65**;
  runtime-DML **5/0, 118**; SECURITY DEFINER **3/0, 174**; deterministic seed
  **10/0, 63**; review seed **24/0, 111**;
- runtime-database authority **9/1, 88**, failing only the stale exact catalogue
  expectation described above;
- standing suite **1,210 pass / 919 expected database skips / 0 fail / 18,494
  assertions**; TypeScript, 137-file import boundaries, 23-package licence policy and
  dependency audit zero all pass; and
- a separate fresh `yellow_test` database with migrations1–62 and the canonical
  fixture produced referee **11 passed / 0 failed of 11**.

The first acceptance attempt ran after the focused hostile suite and correctly found
the reviewer's temporary Order350 tenants. I rebuilt the exact disposable stack,
then acceptance passed 23/0 against the clean canonical seed. The repository schema
check invoked through the pinned Alpine PostgreSQL image differed only in the
`pg_dump` provenance header (`16.15` Alpine versus committed Debian
`16.15-1.pgdg13+2`); the exact catalogue, migration, acceptance and referee proofs
above independently passed. Neither fixture issue is treated as a candidate finding
or used to excuse the retained runtime gate failure.

## Boundary

**WITHHOLD** Order357 at exact governance `4888831` / implementation `9070222`.
The production expiry repair and focused hostile matrix pass, but the required
runtime-database authority gate is red. This review grants no Order350/354 approval,
tax-money, posting, journal, document, IRP, API/UI/local, merge, push, deployment,
Phase7 or application-completion authority.
