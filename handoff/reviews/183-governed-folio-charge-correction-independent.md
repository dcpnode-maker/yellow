# Order 183 — independent Tier-3 financial review

**Conclusion:** APPROVED
**Exact candidate:** `25f11dfd7de3b54cc202edc491568c52809c0ba3`
**Product lineage:** financial implementation through `6e93ab6`; inherited operator
appearance product through `f50d09d`; proof-fixture repairs `5c01522` and `25f11df`
**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer
**Reviewed:** 2026-08-26

## Scope and isolation

The reviewer read `PROJECT.md`, ran `state.sh`, read Phase 5, Order183, D-467,
D-468, D-469, D-470 and D-473, inspected the migration, correction service,
statement query, HTTP boundary, runtime authority and SECURITY DEFINER surface, and
personally executed the pre-registered financial proofs. Review used one uniquely
named PostgreSQL-only Compose project on loopback port 55483. No app or Valkey was
started; the sole `:3000` app and its approved database were not read or mutated.
The ephemeral review container, network and volume were verified by exact Compose
project label and removed after proof.

## Reviewer-executed evidence

- Fresh PostgreSQL 16.15 applied migrations 0001 through 0019; a second migration
  invocation was an exact no-op. Database acceptance: 6 passed, 0 failed. Schema
  dump matched `tests/schema/expected.sql` exactly.
- `tests/financial-corrections.integration.test.ts`: 9 passed, 0 failed. This
  reproduced bounded day-lock and reversal-header ACL/hostile-input denial; direct,
  cross-property, cross-currency, forged-actor and foreign-tenant rejection; exact
  original journal/posting hash preservation; exact contra lines and zero balance;
  replay/change conflict; a 20-way race with one winner and nineteen governed
  conflicts; concurrent account-freeze re-read with zero artifacts; publisher
  rollback followed by exact retry; sealed-day normal-authority denial and explicit
  post-seal-authority success; and journal UPDATE/DELETE denial with SQLSTATE 42501.
- `tests/financial-statements.integration.test.ts`: 10 passed, 0 failed, including
  both reversal directions, server-derived eligibility, tenant/property/folio
  boundaries, keyset continuity and the bounded 10,000-line proof.
- `tests/runtime-dml-authority.integration.test.ts`: 5 passed, 0 failed.
  `tests/security-definer-containment.integration.test.ts`: 3 passed, 0 failed.
- `tests/operator-folio-workbench.integration.test.ts` with mandatory live database:
  16 passed, 0 failed. The authenticated route proved exact scopes and property
  grants, canonical open-day correction, replay/change conflict, forged body/header
  denial with zero mutation, and distinct authorized post-seal success.
- A separately created, freshly migrated and fixture-seeded 85-table referee database
  produced `RESULT: 11 passed, 0 failed of 11`, including its 50-thread occupancy
  race, journal balance, sealed-day, gapless numbering and table/view RLS proofs.
- `tsc --noEmit`, 67-file import boundaries, 23-package licence policy,
  production dependency audit, and `git diff --check` all passed at the exact tip.

## Review findings and resolution

The first authenticated HTTP execution correctly returned 503 because the test
fixture had not wired `ChargeCorrectionService`; after fixture-only commit `5c01522`,
the complete workflow passed but the last evidence assertion read an unquoted
camel-case SQL alias. Fixture-only commit `25f11df` quoted that alias. The reviewer
independently reran the entire HTTP suite at the final tip and obtained 16/0. These
were proof-fixture defects, not product or financial-authority defects, but approval
was withheld until both were repaired and executed green.

Two discarded setup attempts are not counted as evidence: the schema CLI was first
called without its required paired database-name/deploy-URL environment, and the
Windows `python3` alias plus bundled Python lacked `psycopg2`. The final referee used
the installed Python 3.13 runtime with `psycopg2` 2.9.12 and passed 11/11.

## Verdict

No remaining financial, concurrency, tenancy, immutable-history, authorization,
migration, runtime-DML or SECURITY DEFINER finding remains. Exact candidate
`25f11dfd7de3b54cc202edc491568c52809c0ba3` satisfies Order183's mandatory
independent Tier-3 gate. This approval does not promote the sole local, merge, push,
bind publicly, deploy to production, or claim Phase-5/Phase-wide completion.
