# Order 428 — Effective tax resolution and quote-preview proof repair

**Status:** PRODUCT-PROOF-APPROVED; CLOSURE-WITHHELD-PENDING-SAFE-CLEANUP — D1292
**Candidate:** `635912c` over independently approved base `6971589`
**Reviewer:** `/root/order428_tier3`, fresh non-implementing Tier-3 reviewer
**This document:** builder handoff followed by the independent disposition below

## Candidate scope

The candidate changes only the three admitted proof files, their expressly scoped
governance records, and this handoff. No product source, migration, schema, role, RLS,
runtime/local application, `.yellow`, provider, document or Phase authority changed.
The isolated probes found no product defect, so both admitted product files remain
byte-exact.

## Load-bearing proof supplied by the builder

- Exact 366 attributable room nights return a calculated preview; 367 is unavailable.
  Changing only `> 366` to `>= 366` in `src/contexts/rates/quote.ts` makes the named
  exact-366 test red.
- Separate forged resolver results differ only in property or business date, pass all
  earlier result-shape checks, and require the exact `RateQuoteConflictError` scope
  message. Removing only the matching property or date guard makes only its named
  probe red.
- A coherent zero-value package retains zero package amount, included allocation,
  extra amount and count, but present package evidence returns exact
  `unsupported_attribution`. Removing only the package-evidence guard makes its named
  probe red.
- A query-selected assignment row whose stored bounds exclude the requested business
  date requires the exact resolver containment `Error` message. Removing only the
  normalize-result containment guard makes that named probe red.
- After every one of those five source mutations, the source was restored byte-exact;
  focused proof restored to `27 pass, 6 expected database skips, 0 fail` (141
  expectations). Composition is `52 pass, 18 expected database skips, 0 fail` (202
  expectations).

## Disposable database evidence

One fresh native PostgreSQL 17.2 cluster on port 55491 was initialized outside the
repository, applied all 73 migrations, and used SCRAM credentials. `yellow_runtime`
was verified `NOSUPERUSER` and `NOBYPASSRLS`; the test transaction set the tenant with
transaction-local context. With resolution explicitly required, the entire resolver
suite including all six previously skipped PostgreSQL cases passed `15 pass, 0 fail`
(80 expectations). The isolated fixture registered `tax_jurisdiction` in
`extension_type` only when absent and deleted only that row when it had created it.
The server stopped; its port closed; cluster data and all generated credential files
were removed. Docker, WSL, a second Yellow application, stable local and `.yellow`
were not used.

## Builder gates

- Focused Order428 files: `27 pass, 6 expected database skips, 0 fail` (141
  expectations).
- Tax/quote composition: `52 pass, 18 expected database skips, 0 fail` (202
  expectations).
- Typecheck: pass. Import boundaries: pass (159 TypeScript files).
- Unchanged-schema static checks: `5 pass, 0 fail` (25 expectations).
- Standing: `1,458 pass, 1,054 expected environment skips, 0 fail` (20,651
  expectations across 2,512 tests/462 files).
- Diff hygiene: pass. No migration or schema file changed.

## Required independent disposition

The reviewer must personally create a fresh disposable native PostgreSQL environment,
authenticate a non-bypass runtime role, set transaction-local tenant context, run the
six database cases, and remove the temporary resources. The reviewer must personally
repeat each of the five named production-only mutations and verify the named test is
red with its exact class/message before restoring the source. Record commands, actual
results, restoration evidence and any finding in a separate reviewer disposition;
only then may Orders238 and 239 be approved or remain withheld.

## D1292 independent Tier-3 disposition

The repaired Order238/239 product proof is independently **approved**. I personally
removed each production guard separately and ran only its named probe: changing
`> 366` to `>= 366`, removing the property-result guard, removing the business-date
result guard, removing the non-null package-evidence guard, and removing stored
assignment containment each made its exact class/message oracle red. The property and
date probes rejected their own sentinel `Error` rather than counting it as the required
`RateQuoteConflictError`; the containment probe compared the exact guard-specific
message. After every mutation, both product files were restored byte-exact to
candidate `635912c`.

I created one disposable native PostgreSQL 16.15 cluster at the exact isolated path
`E:\yellow\temp\order428-tier3-review` on port 55493 and applied all 73 migrations.
An actual SCRAM login returned `yellow_runtime|yellow_runtime|f|f` for session user,
current user, superuser and bypass-RLS attributes. In that runtime session,
`set_config('app.tenant_id', ..., true)` and the immediately read transaction-local
tenant value matched. All Order238 cases then passed **15/0** with **81 assertions**,
including the six PostgreSQL cases that skip without explicit database authority.
The same isolated cluster's fresh reset database passed the unchanged referee
**11/11** and a direct PostgreSQL schema dump matched `tests/schema/expected.sql`.

Reviewer-restored proof is focused **27/0 plus six expected database skips** (141
assertions) and standing **1,458/0 plus 1,054 expected environment skips** (20,651
assertions across 2,512 tests/462 files). The concurrent composition run had one
five-second timing-only failure; its exact P4 case passed alone **1/0**, and the full
focused set then passed again. Strict TypeScript, 159 import boundaries, 23-package
licence policy, audit zero, container-image pins **4/0** (7 assertions), schema static
**4/0** (19 assertions), scope, protected-source identity and diff hygiene pass. No
product source, migration, role, schema, stable local, Docker, WSL or `.yellow` state
changed.

The PostgreSQL server is stopped and port 55493 is closed. However, tool policy
rejected PowerShell recursive removal. Windows cross-shell safety forbids switching
to a different shell after PowerShell enumeration, so the stopped exact directory
and generated credentials remain intact at the path above: **78,769,906 bytes** at
final measurement. Because Order428 explicitly requires removal, I withhold order
closure and Orders238/239 status promotion until the primary coordinator completes
that exact same-shell cleanup and records it. This is cleanup debt only; no product
or proof finding remains.
