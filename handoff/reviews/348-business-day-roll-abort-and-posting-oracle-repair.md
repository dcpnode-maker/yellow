# Orders 348 and 347 fresh independent Tier-3 review

**Disposition:** APPROVE

**Reviewer:** `/root/order348_347_fresh_tier3`, fresh independent non-implementing
OpenAI Codex Tier-3 reviewer

**Exact reviewed candidate:** `91a1838` (implementation `d75ca9f`)

## Findings

No finding. The Order348 implementation is exactly the bounded D986 repair: it
threads the existing signal into `drainOnce`, checks it before discovery and before
each scope, adds permanent cancellation coverage, and changes the strict financial
table-count oracle from 87 to 111. It does not interrupt an in-flight scope, classify
abort as failure, change posting behavior, or alter migration0061/schema/authority.

## Fresh executable evidence

I personally reproduced both parent failures from exact `5862299` in a detached
reviewer worktree. Running the candidate's permanent worker regressions against that
parent produced **3 pass / 2 fail**: a pre-aborted drain discovered and wrote one
scope, and abort during FIRST still invoked SECOND. The parent's financial-postings
suite against exact current catalogue truth produced **9 pass / 1 fail** solely at
the strict expected 87 versus actual 111 assertion; all functional posting tests,
including the 500-charge stress proof, passed.

On exact candidate `91a1838`, I used a reviewer-owned loopback/tmpfs PostgreSQL
**16.15** container with `pg_stat_statements` preloaded. Fresh migrations1-61 produced
exact **61 migrations / 111 public base tables / 101 policies / 10 FORCE-RLS tables /
2 views**. Migration0061's applied SHA-256 is
`50cf8593ac385b74fbe61da9d28f0ecf59b78297c7aff46ad073f34409efc34f`, and a direct
normalized fresh schema dump exactly matches `tests/schema/expected.sql`.

- corrected business-day roll plus worker: **11/0, 46 assertions**; this covers
  PostgreSQL/property-timezone date derivation, opposite-midnight and DST oracles,
  older open/sealed/multiple-unsealed backlog, exact rerun, 20 contenders, atomic
  late-publisher rollback/retry, hostile tenant/property/kind/timezone/input, direct
  DML denial, bounded deterministic discovery, pre-discovery abort, abort between
  scopes, in-flight completion, no later scope/cycle/failure, ordinary drain and
  failure isolation;
- financial-postings: **10/0, 111 assertions**, including exact 111 equality,
  500 charges/1,000 balanced immutable lines, tenant, seal, replay and rollback;
- database acceptance **23/0, 65**; runtime authority **10/0, 88**; runtime DML
  **5/0, 118**; SECURITY DEFINER containment **3/0, 174**; business-day seal **3/0,
  6**; migration runner **39/0, 187**;
- standing suite **1,195 pass / 905 expected database skips / 0 fail / 18,421
  assertions**; TypeScript, 134-file boundaries, 23-package licences, dependency
  audit zero, ancestry, protected baseline, scope and diff hygiene pass;
- a separate fresh referee database with migrations1-61 and the canonical fixture
  produced **11 passed / 0 failed of 11**.

My first disposable database omitted the required preload and acceptance correctly
failed 22/1. I removed it, rebuilt with the production-required preload, and reran
the complete affected proof 23/0; this was a reviewer-fixture error, not a candidate
finding. All reviewer-owned resources were removed. `.yellow`, credentials, the
stable local runtime and port3000 were not mutated.

## Boundary

**APPROVE** Orders348 and347 at exact candidate `91a1838`. This approval is bounded
to cancellation containment, the strict posting oracle repair and automatic
property-local current-day roll. It grants no business-day seal/readiness/carry,
historical catch-up, UI/local promotion, merge, push, deployment, Phase5 or
application-completion authority.
