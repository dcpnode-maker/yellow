# Order 429 — India IRP fiscal-action readiness

**Verdict:** INDEPENDENTLY APPROVED AND CLOSED — D1300  
**Candidate:** `a91400b` over admitted Order429 head `ff6dd3c`  
**Reviewer:** `/root/order429_tier3`, fresh non-implementing Tier-3 reviewer

## Scope and design inspection

The committed diff contains only the Order429 service/export, its focused proof,
the D1297 canonical-JSONB compatibility repair and admitted governance paths. No
migration, table, permission, RLS policy, API, UI, seed, provider or local-runtime
path changed. The service reruns approved Order413 on the caller's existing tenant
transaction and composes approved Order426 only from `{tenantId, source}`. Its sole
public action state remains false readiness, no permitted actions and the exact
document-origin, legal-number-format and series-binding blockers.

D1297 is value- and authority-preserving. Before reconstruction, Order412 validates
the exact tax-detail key set, every root/nested identity, value, amount, currency,
component topology, balanced posting topology, account role and current semantic
route binding. Reconstruction then copies only those already validated values into
the existing canonical key order before recursive freeze and source hashing; it does
not change a query, guard, field, error, write path or authority.

## Reviewer-executed database proof

I initialized one separate native PostgreSQL 16.15 cluster at
`D:\Yellow\temp\order429-tier3-review` on port 55495 with SCRAM authentication.
Fresh review databases independently applied all 73 migrations. An actual runtime
login returned `yellow_runtime|yellow_runtime|f|f|t` for session user, current user,
superuser, bypass-RLS and login state; transaction-local `set_config` immediately
read back the same tenant id.

- Real Order413→426→429 integration: **7 pass, 0 fail, 292 assertions**. It covers
  5/12/18 percent, every component family, multiple nights, zero tax, current,
  absent, mixed, stale, reversed and hostile ancestry, replay, deep freeze, tenant
  concealment, exact false readiness/blockers and unchanged
  document/series/fact/outbox/idempotency census.
- D1297 Order412 live source proof on another fresh database: **6 pass, 0 fail,
  204 assertions**. It covers PostgreSQL JSONB canonical reconstruction, mutation
  safety, replay, RLS concealment, posting topology/account roles and stale/reversed
  rejection.
- Native `pg_dump --schema-only --no-owner --no-comments`, normalized by the
  repository normalizer, matched `tests/schema/expected.sql` byte-for-byte:
  **891,689 bytes**, SHA-256
  `dc47520e6da64a9bcdf7fd70e653caf4da921a22dd4dec5f9ee833b2d7dee945`.
- A separately reset, migrated and canonical-fixture-loaded referee database had
  **124 public tables** and passed the unchanged battery **11/11**.

## Reviewer mutation sensitivity

I swapped only the first two readiness blockers. The permanent hostile probe became
red **0/1**, reporting spawned exit 10 instead of 0. After restoration it passed
**1/0**.

I then replaced only D1297's canonical journal-line reconstruction with the original
raw PostgreSQL JSONB line and ran the live source proof on a fresh 73-migration
database. The canonical test became red **5 pass, 1 fail** and showed the exact
database key order instead of the required contract order. Both product files were
restored byte-exact to candidate `a91400b`:

- readiness source SHA-256
  `29D3ABA4D3C4AEB8D33C42517741D8FE6186FF3973B7BADE37A5770D1D785C00`;
- fiscal-source SHA-256
  `C7584D190F640916C929F32D66FD07232771EA078355CED17EF1B31A7AD0A0FA`.

## Restored standing gates and cleanup

- Focused permanent proof: **34 pass, 19 expected database skips, 0 fail**
  (74 assertions); configured live database cases are recorded above.
- Standing: **1,462 pass, 1,059 expected environment skips, 0 fail**
  (20,658 assertions across 2,521 tests/466 files).
- Strict TypeScript: pass. Import boundaries: **160 files**. Licence policy:
  **23 packages**. Dependency audit: **0 vulnerabilities**. Diff hygiene: pass.
- Candidate source/diff restoration: pass; only protected untracked `.yellow/`
  remained and was not touched.

The PostgreSQL server was stopped, port 55495 was verified closed, and the exact
168,999,966-byte review cluster directory was removed in the same verified
PowerShell context. Docker, WSL, the stable local application and `.yellow/` were
not used or changed.

Order429 is independently approved and closed. This approval is only the read-only
policy-neutral readiness boundary. It grants no document-origin choice, legal number
format, series allocation/advance, `DocDtls`, document issue/import/hash chain,
provider submission, IRN/QR, API/UI/local, Phase7 or application-completion authority.
