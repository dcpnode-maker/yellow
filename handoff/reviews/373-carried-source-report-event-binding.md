# Order 373 carried-source canonical report-event binding — fresh Tier-3 review

**Disposition:** APPROVE

**Reviewer:** `/root/order373_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact product candidate:** `c988e8885aabc0eb9063e12a54543e4767cedb1c`

**Exact governance frontier reviewed:** `6f053803219fb476ead55d763d75dfb4d4816eab`

## Scope and candidate identity

The candidate parent-to-product diff changes only the Order373 readiness service and
its existing real carry integration proof: 34 added lines across two scoped files.
Production adds a lateral, payload-independent count of canonical same-tenant
`discrepancy.reported` source events and requires exactly one event whose typed property
and business date equal the immutable carry link. The public result, reason vocabulary,
single-statement read, carry transition, schema, events, roles, writes, API and UI do
not change. Product source SHA-256 is
`62d53852ad3c40ebdfb7955ed0e503e719f6ddd68e4bbe9c5fec7b58f6334f6e`;
proof SHA-256 is
`91fbe7bcb333708110ef46ae2b0e14112c1260c4ccb1b31404b103f7741f5bea`.

## Reviewer-executed exploit, hostility and mutation proof

On a fresh isolated PostgreSQL 16.15 database with migrations 1–63, the combined
Order349/352 readiness and Order351/359 carry suites passed **27/0 (1,989
assertions)**. The permanent D1055 third-existing-source-day exploit passed alone
**1/0**: changing the immutable link's source date and recomputing the exact migration
0063 request hash remains unknown rather than an admitted blocker. The full
missing/duplicate/wrong aggregate/id/property/date and payload-irrelevance matrix passed
alone **1/0 (86 assertions)**. Its first isolated default-timeout attempt crossed five
seconds under host contention; the unchanged matrix passed with a review-only 20-second
ceiling, after the complete focused suite had already passed under its permanent default.

Removing only `source_report.event_date=carry.source_business_date` made the exact D1055
case fail **0/1**: expected unresolved zero, received one. Restoring the candidate byte
made the same case pass **1/0** and restored the exact Git blob `41a1d480...` and source
SHA-256 above. This independently proves the new date equality is load-bearing.

## Fresh full gates

The reviewer checksum-verified the official PostgreSQL 16.15 source tarball, built a
minimal persistent upstream server and personally obtained:

- migration integration **39/0 (187)**;
- exact-version seeded acceptance **23/0 (65)**;
- runtime-DML authority **5/0 (120)** and SECURITY-DEFINER containment **3/0 (192)**;
- deterministic seed **10/0 (63)** and review seed **24/0 (111)**;
- schema normalizer/setup oracle **5/0 (24)** plus a native upstream dump byte-exact
  to `tests/schema/expected.sql`;
- live catalogue `63/63/116/106/106/15/2` for migration count/highest migration,
  public tables, RLS tenant tables, policies, FORCE-RLS tables and invoker views;
- a separately created, migrated and fixture-loaded referee database: **11/11**;
- clean standing suite **1,217/0**, 949 expected database skips and **18,524
  assertions** across 400 files; and
- typecheck, 139-file boundaries, 23-package licence policy, production audit with
  zero vulnerabilities, exact diff hygiene and candidate-byte restoration: green.

An earlier standing attempt during the persistent PostgreSQL compile was 1,215/2 with
one visual harness failure and one five-second Order239 timeout; both unchanged tests
passed alone, and the uncontended complete rerun was 1,217/0. Ubuntu's packaged server
reported a vendor-suffixed version and was deliberately rejected as exact acceptance
proof. The official build initially needed the baseline's btree_gist, ltree and pg_trgm
extensions plus explicit OpenSSL linkage for pgcrypto; these disposable harness issues
were repaired before any relied-upon gate. A WSL reset erased an earlier `/tmp` build,
so the relied-upon checksum-verified build was repeated on persistent reviewer storage.

The host again generated large WSL diagnostics and exhausted C during review. Those
diagnostics were moved, not deleted, to the founder-authorized E storage. A failed patch
attempt at zero free bytes briefly produced an empty working file; it was immediately
restored from the exact product commit and checksum-verified before the recorded mutation
or any later gate. No product candidate byte remained changed.

## Boundary and decision

No stable app, named local database/container, port 3000, canonical `.yellow` authority,
deployment or promotion was changed or used as proof. Reviewer clusters and databases
used only ports 55473/55474. The persistent upstream build and moved diagnostics remain
outside the repository for founder-controlled storage; no diagnostics were deleted.

Order373 is **APPROVED** at exact product
`c988e8885aabc0eb9063e12a54543e4767cedb1c` and governance
`6f053803219fb476ead55d763d75dfb4d4816eab`. This approval repairs only D1055's
carried-source canonical report-event binding defect and satisfies the different-fresh
Tier-3 requirement. It grants no seal, carry mutation, schema, API, UI, local promotion,
deployment, merge, Phase-5/7 or application-completion authority.
