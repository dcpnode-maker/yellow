# Order 417 — Fresh independent Tier-3 pre-retirement review

**Verdict:** APPROVED FOR GUARDED RETIREMENT — D1242

**Reviewed candidate:** `ac8f496`

**Reviewed base:** `1bd605b`

**Reviewer:** `/root/order417_tier3_review`, fresh independent non-implementing Tier-3 reviewer

## Finding

No finding. The candidate removes the automatic `scripts/seed.ts` call from the retained
`yellow_dev` setup path, preserves the explicit deterministic seed and scenario generators,
and drops disposable `yellow_test` immediately after the referee. It changes no product,
migration, schema, authority, credential, runtime topology or retained hotel record.

## Reviewer-personal proof

- focused setup isolation: **1 passed, 0 failed (5 assertions)**;
- complete standing suite: **1,368 passed, 1,054 skipped, 0 failed (20,127 assertions)**;
- strict TypeScript, 152-file import boundaries, 23-package licence policy, dependency
  audit `{}` and diff whitespace: green;
- isolated official PostgreSQL **16.15** with SCRAM and `pg_stat_statements`: acceptance
  **23 passed, 0 failed (65 assertions)** after deliberate explicit deterministic seeding;
- exact migrations 1–73, 124 tables, 114 RLS tables, 114 policies, 23 forced-RLS
  tables, two security-invoker views and normalized schema snapshot: exact;
- a freshly recreated fixture database passed the referee **11 passed, 0 failed**, then
  `yellow_test` was dropped and confirmed absent;
- before deliberate acceptance seeding, isolated migrated `yellow_dev` held zero tenants,
  properties, parties, reservations, folios, journals and posting lines;
- static audit found no retained port 5442, volume or retained-container identity in tests
  or scripts; the canonical demo identity occurs only in explicit synthetic seed contracts.

An initial acceptance run against the intentionally unseeded database correctly failed only
its canonical explicit-seed expectation. An initial referee run inherited artifacts from an
earlier output-encoding interruption and failed 10/11; the database was destroyed and the
complete fixture/referee sequence restarted from zero before the valid 11/11 result.

## Exact guarded retirement inventory

1. `yellow_order311_clean_pgdata`: the sole retained populated runtime volume, mounted only
   by stopped `yellow-order311-postgres`; `yellow_dev` contains 1 tenant, 2 properties,
   8 parties, 6 reservations, 6 folios, 0 journals, 0 posting lines, 2 occupancies,
   75 facts and 22 outbox rows.
2. `yellow-order365-r3-5f2a9c_yellow-pgdata`: an orphan PostgreSQL-16 proof volume. Its
   `yellow_dev` is only 7,537,167 bytes and has no `public.tenant` relation. It carries no
   retained hotel dataset, but is an exact removable orphan rather than a second authority.
3. Exactly 15 custom-format dumps under `D:\Yellow\backups`, totaling **17,844,911 bytes**.
   Every dump was readable by PostgreSQL 16.15 `pg_restore`, contained 85–98 table-data
   entries, and independently emitted a populated tenant payload. The exact paths and SHA-256
   hashes were captured in reviewer output before any future deletion.

The preservation boundary is source, migrations, schema, invariant definitions, reusable
fixture/scenario generator code, repository history, research, orders/reviews, authentication
configuration and the single intended Docker stack topology. No external or production data,
credentials, repository evidence, application feature or container image is authorized for
deletion.

The disposable review stack, containers, volume and network were removed; port 55717 is
closed. The retained runtime volume, orphan volume and all 15 dumps remain untouched for the
separate guarded retirement operation. Approval does not close Order 417: post-retirement
empty-state, exact schema/referee and single-topology proof remain mandatory.
