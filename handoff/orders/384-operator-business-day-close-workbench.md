# Order 384 — Operator business-day close workbench

**Status:** ACTIVE-RESUMED-D1119
**Phase:** 5 — Financials operator delivery
**Branch:** `phase-5/operator-business-day-close-workbench`
**Base:** exact independently approved Phase-5 domain tip `f681b3cc03325b9bf6fb4e5c92bbcc3b22011129`
**Risk tier:** 3 — tenant-scoped financial close and discrepancy-carry lineage

Expose one authoritative read-only operator workbench over the already approved
business-day close-readiness and discrepancy-carry truth. This order creates no new
financial authority: it lets an authorized operator select an existing unsealed
business day, see its exact readiness result, and see only safely attributable carry
candidates. Seal and carry commands remain separate later orders.

The founder's D1066 actor policies remain authoritative and were reconfirmed before
activation: an active authenticated same-tenant property-scoped actor holding
`business_day.seal` seals directly, while future tax-evidence recording uses the
authenticated property-scoped fiscal actor. This read-only workbench neither invokes
nor changes either policy.

## Exact scope

- new `src/contexts/financials/business-day-close-workbench.ts`;
- loader-only extraction in
  `src/contexts/financials/business-day-close-readiness.ts` when required to preserve
  one caller-owned tenant transaction;
- `src/contexts/financials/index.ts`;
- `src/http/operator.ts`, `src/app.ts`, `src/server.ts` only for exact service
  construction/injection;
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`;
- focused domain, PostgreSQL, operator HTTP and browser-behaviour tests named for this
  workbench, including intentional red;
- `docs/CONTRACTS.md`, `docs/UI-SPEC.md`;
- this order, its independent review, `DECISIONS.log`, `handoff/LEDGER.md`.

No migration, schema snapshot, seed, dependency, runtime worker, local image/database,
`.yellow`, trust-posting, carry command, seal command, tax/fiscal result, deploy, merge
or push is admitted.

## Contract

`BusinessDayCloseWorkbenchService.read` accepts exact server-derived tenant, property,
actor and persisted business date for standalone callers. HTTP uses the corresponding
transaction-aware loader on the existing middleware-owned `Tx`; it never opens a nested
transaction. Exactly one composed PostgreSQL statement and one snapshot produce one
deeply frozen bounded result containing:

- tenant, property, selected business date and PostgreSQL capture instant;
- the greatest currently unsealed property business date;
- every unsealed backlog day ordered by business date, with only date/opened-at/current;
- the existing exact close-readiness shape for the selected day, byte-semantics intact;
- minimized ordinary-reported discrepancy carry candidates for a non-current selected
  source day when a later open target exists.

Candidate lineage must be exact, unique, same tenant/property/day and ordinary
`discrepancy.reported`; already carried source or target discrepancies are excluded.
Missing, duplicate, mixed, foreign, ambiguous or incoherent lineage fails the complete
read closed. No payload, approval material, hashes, guest, payment, journal, fiscal or
other sensitive evidence is returned. The current open day has no carry candidates.
Missing/foreign/inactive actor or property and absent/sealed selected dates are
indistinguishable unavailable results. The read performs zero writes and derives no
date or authority from browser/server wall clocks.

At most 366 unsealed days and 500 eligible carry candidates are returned. Each
population is queried as `MAX + 1`; 367 days or 501 candidates makes the entire result
unavailable with no partial list or silent truncation. Missing-lineage discrepancy work
is detected only through the already-approved readiness attribution/unknown semantics;
no date is inferred from timestamps or clocks.

The route is
`GET /api/v1/properties/:property/business-days/:businessDate/close-workbench` through
the existing tenant context and `financials.business-days:read`; GET has no
idempotency key. The human route is `/p/:property/day-close?date=YYYY-MM-DD` with a
backlog selector, readiness tiles/reasons/outbox lag, minimized carry-candidate list,
refresh and stale-response suppression. It exposes no seal/carry action or decorative
disabled substitute.

## Executable proof

1. Intentional red precedes production source.
2. Fresh PostgreSQL proves actor/property/day containment, complete unsealed backlog,
   sealed exclusion, DB-only current selection, exact readiness preservation including
   blockers/unknown and strict five-minute lag boundary, and every hostile carry-lineage
   exclusion/fail-closed case.
3. One coherent snapshot under concurrency and zero writes are proven; the response is
   deeply immutable and contains none of the forbidden data.
4. Operator proof covers permission, unavailable equivalence, validation, canonical
   envelope/correlation, deep link, refresh/stale-response behavior, keyboard/focus,
   responsive layouts and all approved appearance modes.
5. Focused, standing, type, boundary, licence, audit, diff, database acceptance and
   fresh referee 11/11 gates pass as applicable.
6. A fresh independent non-implementing Tier-3 reviewer personally executes the
   hostile PostgreSQL and operator proof before approval.

## Definition of done

- [ ] Intentional red recorded before implementation.
- [ ] Exact bounded authoritative read and operator workbench implemented.
- [ ] Builder gates green with no local/runtime mutation.
- [ ] Fresh independent Tier-3 approval recorded.

## Prerequisite hold — D1114

Read-only contract audit proved that the named
`financials.business-days:read` permission does not exist. Order385 must add and
independently approve only that least-privilege catalogue/ordinary-review-role
permission before HTTP/UI production wiring resumes. Domain and operator intentional
reds were recorded; unapproved WIP remains uncommitted.

The audit also proved that the operator middleware already owns the tenant transaction,
default READ COMMITTED multi-statement reads do not satisfy the promised coherent
snapshot, and an unlimited historical backlog cannot also be a bounded response.
Questions182–184 are approved under D1119: the fail-closed limits are 366 open days and
500 candidates, and `src/server.ts` is admitted only for exact dependency wiring. The
implementation must compose one SQL statement on the middleware-owned transaction; it
must not open a nested service transaction or weaken snapshot semantics.
