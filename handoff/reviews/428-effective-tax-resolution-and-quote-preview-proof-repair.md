# Order 428 — Effective tax resolution and quote-preview proof repair

**Status:** BUILT-AWAITING-DIFFERENT-FRESH-TIER3 — D1291
**Candidate:** working-tree Order428 proof-repair candidate
**Reviewer:** unassigned; must be a fresh non-implementing Tier-3 reviewer
**This document:** builder handoff evidence, not a self-review or approval

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
