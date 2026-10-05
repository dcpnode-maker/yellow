# Order 372 typed discrepancy-date fail-closed repair — fresh Tier-3 review

**Disposition:** APPROVE

**Reviewer:** `/root/order372_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact product candidate:** `c640c5cc7431c8b1a410c4146ad07dd57d61f03c`

**Exact governance frontier reviewed:** `e56d7709038f35757bbd01cd0087960c35a9b73f`

## Scope and candidate identity

The candidate's parent-to-candidate diff changes only the existing readiness service and
its PostgreSQL integration proof. Production adds one target-property-guarded,
null-safe typed-date mismatch arm to `unknown_discrepancy`; it does not change the
single CTE statement, decoder, result vocabulary or public surface. The proof replaces
the finite zero-write table list with every catalogue-derived tenant-bearing public
relation and byte-stable row content. Candidate-to-frontier changes are governance only.
No migration, schema, role, ACL, policy, event, carry, API, UI or local-runtime byte changed.

## Reviewer-executed mutation and hostility proof

A checksum-verified official upstream PostgreSQL 16.15 source build backed fresh isolated
review databases. In a detached disposable candidate worktree, removing only the new
typed-date mismatch predicate made the exact named case fail **0/1**: the expected
`unknownAttribution=1` was actually `0`. Byte-restoring the candidate made the complete
readiness proof pass **7/0 (52 assertions)**.

The permanent proof obtains SQLSTATE **23502** from a real null
`outbox.business_date`, proves the canonical target date blocks once, a wrong typed date
is unknown/fail-closed, a forged payload date is irrelevant, a missing event is unknown,
one statement is recorded, output is deeply frozen, the publication race is coherent,
and every catalogue-derived tenant-bearing relation is byte-stable across the read.

I also personally ran a reviewer-only disposable PostgreSQL matrix for duplicate creation
events, a wrong event property, a wrong room/property association, a same-aggregate event
in another tenant, resolved truth and an entirely foreign-tenant discrepancy. The first
four fail closed as unknown; resolved truth is absent from blockers; and foreign-tenant
truth is silent. That matrix passed **1/0 (8 assertions)** and was removed without entering
the product candidate.

## Fresh full gates

The reviewer personally obtained:

- Order349/352 unit preservation and approved Order351/359 carry preservation:
  **18/0 (1,843 assertions)**;
- migration integration: **39/0 (187)**;
- exact-version seeded database acceptance: **23/0 (65)**;
- runtime DML authority: **5/0 (120)**;
- SECURITY DEFINER containment: **3/0 (192)**;
- deterministic seed: **10/0 (63)**; review seed: **24/0 (111)**;
- schema normalizer: **4/0 (19)** and an official 16.15 native dump byte-exact to
  `tests/schema/expected.sql`;
- live catalogue: 63 migrations/highest 63, 116 public base tables, 106 tenant-RLS
  tables and policies, 15 FORCE-RLS tables, two security-invoker views, and actual
  `outbox.business_date NOT NULL`;
- setup catalogue oracle: **1/0 (5)**; the exact fresh DB-only setup sequence applied
  migrations 1-63, produced 116 public tables, loaded the canonical fixture, and a
  separately created referee database passed **11/11**;
- standing: **1,217/0**, 946 expected database skips and **18,524 assertions** across
  400 files; and
- typecheck, 139-file import boundaries, 23-package licence policy, production audit
  with zero vulnerabilities, candidate diff hygiene and governance-only frontier
  identity: green.

The host Docker API stayed non-responsive, so the literal Compose wrapper was not used.
This is a harness condition, not candidate evidence: the reviewer executed every DB-only
setup step directly against the checksum-verified exact upstream server, including a
fresh separate referee database. Earlier attempts with missing host ICU/readline metadata,
too-short disposable role passwords, an unseeded acceptance database, and incorrect test
URL/environment selection all failed before usable proof and were corrected; none is a
candidate finding.

## Boundary and decision

No stable named resource, port 3000 or canonical `.yellow` file was inspected, changed,
started, stopped, restarted, replaced or promoted. Only reviewer-named disposable source,
cluster, databases and detached worktree were used.

Order372 is **APPROVED** at exact product candidate
`c640c5cc7431c8b1a410c4146ad07dd57d61f03c` and governance frontier
`e56d7709038f35757bbd01cd0087960c35a9b73f`. Approval is bounded to the read-only
typed discrepancy-date fail-closed repair and its proof. It grants no
`discrepancy.carried`, seal, write, schema, local-promotion, deployment, merge,
Phase-5/7 or application-completion authority.
