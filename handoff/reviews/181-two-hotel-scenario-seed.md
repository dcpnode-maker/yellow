# Order 181 — independent Tier-3 review

**Decision:** APPROVED — D-464  
**Reviewer:** independent non-implementing OpenAI Codex  
**Exact candidate:** `d7553761d21ae9b73b8de8b92b5d7cae43695a4a`  
**Admission:** `6e4bac338657e888230a99563703a63732b2c9ae`

## Scope and source

`git diff --name-status 6e4bac3..d755376` contains only the admitted
`package.json`, new `scripts/seed-scenario-review.ts`, and new
`tests/scenario-review-seed.integration.test.ts`. `git diff --check` is clean.
The correction from rejected intermediate `b98af0f` is exactly one test timeout
change from 300,000 to 600,000 milliseconds; no assertion or product behavior
changed. The manifest hashes are exact and the seeder uses the existing inventory,
rate, Party, reservation-commit/lifecycle, folio, charge, occupancy, fact, outbox and
idempotency primitives. No migration, schema, route, UI or dependency changed.

## Reviewer-executed proof

On a newly created app-never-started PostgreSQL 16 database, after canonical
authority provisioning, 18 migrations, launch seed and review identity seed:

- `YELLOW_REQUIRE_SCENARIO_REVIEW=1 bun test tests/scenario-review-seed.integration.test.ts`
  passed **2/2**, **0 failed**, **9 assertions**; the full fresh materialisation,
  exact replay and drift rejection completed in **436,502 ms**.
- Exact database proof returned 2 scenario properties, 4 operator/approver grants,
  10 unit types, 80 spaces, 80 sellable units, 16 rate plans, 80 current prices,
  2,192 reservations (1,936 cancelled and 256 reserved), and 256 live occupancy
  claims. There were zero overlapping live claim pairs.
- Reservation evidence was exactly 4,128 facts and 4,128 outbox events; the five
  governed operations held 4,178 idempotency rows. Exact replay separately completed
  in 10.968 seconds without cardinality change; canonical property-name drift was
  rejected and restoration replayed cleanly.
- Financial proof returned 24 journals and 48 posting lines, zero unbalanced
  journals, zero cross-currency lines, and null tax detail on every line. Payment,
  document, scenario group/block and channel tables remained zero.
- With `SET LOCAL ROLE app_role`, the Yellow tenant saw both scenario properties and
  a foreign tenant saw zero. `app_role` had no direct insert/update/delete privilege
  on occupancy and no update/delete privilege on protected journal, posting, fact or
  outbox rows. A direct occupancy insert failed with exact SQLSTATE **42501**.
- A disposable served app with a reviewer-issued ephemeral token returned HTTP 200
  from `/api/v1/me/properties` with Harbourlight, Riverstone and Yellow Demo; the
  Harbourlight reservation board returned a bounded 10 rows plus cursor, reservation
  detail returned one reserved stay with its folio, and the CAD folio statement
  returned its one governed ROOM line.

## Gates

- standing suite: **232 passed, 481 skipped, 0 failed, 2,834 assertions**;
- TypeScript strict typecheck: pass;
- import boundaries: **66 files**, pass;
- dependency licences: **23 packages**, pass;
- `bun audit`: no vulnerabilities;
- live schema dump: exact expected snapshot;
- fresh referee: **11 passed, 0 failed of 11**, including concurrency, direct-DML,
  balance, sealed-day, numbering, table-RLS and security-invoker view-RLS proofs.

## Discarded harness preconditions and cleanup

The first WSL wrapper attempt lacked Bun and performed no database work. Intermediate
`b98af0f` reproducibly timed out at 300,003.90 ms and was not approved; `d755376`
corrected only that proof ceiling and was reviewed from a fresh database. One referee
attempt reused an already-mutated referee database and was discarded; a fresh
database rerun passed 11/11. One fresh-migration attempt encountered the expected
active disposable runtime-session guard; the disposable app was stopped and the
fresh proof reran cleanly. Initial HTTP 404s occurred with the operator workbench
feature disabled; the same disposable image was recreated with the documented flag
and all reads passed.

All `yellow-order181-review` containers, databases, network, volume and locally built
image were removed. Ports 3131/5671/6611 are unbound. The sole
`yellow-local-current` project and stable port 3000 remained running and untouched.

Approval is limited to the deterministic local-review seed. It does not authorize
active-local application, tax/fiscal policy, payment, documents, group/block or OTA
semantics, unsupported lifecycle states, merge, push, public bind, production deploy
or Phase-wide completion.
