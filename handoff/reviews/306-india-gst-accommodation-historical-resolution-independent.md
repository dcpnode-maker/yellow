# Order 306 — independent Tier-3 review

**Verdict:** APPROVED-D844
**Reviewer:** fresh non-implementing OpenAI Codex Tier-3 reviewer
**Candidate:** `1d14b36a4b5433a58dcfa31461e0946f22c42de0`
**Approved base:** `1fca2ce3711a5742a1c63c98056369e8a010c6e9`
**Date:** 2026-08-31

## Independence, scope and statutory boundary

I implemented none of Order 306. The approved base is an ancestor of the exact
candidate and the 15-path candidate range is confined to the declared resolver,
tests, documentation and governance record. It contains no migration, schema, grant,
RLS, seed, extension lifecycle or current-resolver change. Protected
`migrations/0001_init.sql` and `tests/run_invariants.py` hashes exactly match the
candidate tree.

The resolver preserves the governed historical pair rather than calculating a tax:
the retired predecessor is 12% with ITC through INR 7,500 and 18% with ITC above; the
active successor is 5% without ITC through INR 7,500 and 18% with ITC above. It
retains the exact Order304/305 Kolkata boundary
`2025-09-21T18:30:00.000000Z`, including source-hash evidence, and deliberately does
not produce a tax amount, levy decomposition, invoice or IRP output. This matches the
mandatory India-GST compliance boundary for per-room-night slab evidence.

## Reviewer-executed proof

- Clean focused and adjacent tests passed **27/0**, **538 assertions**. The direct
  Order306 focused/intentional-red tests passed **9/0**, **206 assertions**.
- I performed and then exactly restored disposable source mutations. Weakening either
  lower or upper whole-day containment, changing the fixed predecessor UUID, allowing
  the wrong predecessor status or version, changing governed content or an official
  source hash, changing the assignment key, serializing the tenant, and returning a
  constant evidence hash each made the permanent proof red. These prove the required
  containment, deterministic identity/status/version/content/source, assignment,
  tenant-concealment and hash-sensitive claims are test-sensitive.
- On a reviewer-owned direct `127.0.0.1:5442` disposable PostgreSQL database, the
  live Order306 proof passed **3/0**, **30 assertions**. It established transaction-
  local `app.tenant_id` plus `app_role`, v1 before and v2 at/after the local Kolkata
  cutover, repeated read equality and zero effects, foreign-property concealment,
  PostgreSQL-derived 23/25-hour and Kathmandu-offset envelopes, and cross-cutover
  rejection.
- A separate fresh migration-only fixture database applied **59 migrations** and
  reported **110 public tables, 100 RLS tables, 100 policies and 10 FORCE RLS tables**.
  The canonical referee personally passed **11 passed, 0 failed of 11**.
- Full standing passed **1088/0 with 890 expected skips**, **16,652 assertions** over
  1,978 tests. Typecheck, 123-file import boundaries, 23-package licence policy,
  zero-vulnerability audit, ancestry, exact candidate restoration and whitespace/diff
  checks passed.

## Schema and cleanup note

The candidate does not modify migrations, the expected schema snapshot or the referee.
The schema-normalizer suite passed **4/0 (19 assertions)** and the fresh catalogue
matches the currently governed 59/110/100/100/10 shape. The repository's textual
schema command requires `pg_dump` through Docker; no local `pg_dump` exists and Docker
CLI was explicitly unsuitable, so a fresh normalized dump is not claimed. This is not
a candidate schema delta.

All `yellow_order306*` reviewer databases were force-dropped (`0` remaining). No
founder-local database, port, application, credentials or files were changed.

## Verdict

Exact candidate `1d14b36a4b5433a58dcfa31461e0946f22c42de0` is **APPROVED-D844** with
no finding. Approval is limited to frozen, tenant-hidden historical India-GST lodging
version evidence. It grants no installed-data conversion, rate/tax calculation,
section 14 calendar logic, posting, fiscal document/IRP, API/UI, local promotion,
merge, deployment, Phase-complete or application-complete authority.
