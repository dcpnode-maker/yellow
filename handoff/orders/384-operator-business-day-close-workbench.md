# Order 384 — Operator business-day close workbench

**Status:** REVIEW-WITHHELD-D1131 — ordinary operator entry cannot load the persisted backlog
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

- [x] Intentional red recorded before implementation.
- [x] Exact bounded authoritative read and operator workbench implemented.
- [x] Builder gates green with no local/runtime mutation.
- [ ] Fresh independent Tier-3 approval recorded.

## Fresh independent review — D1121

Approval is withheld. On a fresh official PostgreSQL 16.15 cluster, a reviewer
personally reproduced a fail-closed violation: an unresolved ordinary source
discrepancy linked to a forged carry row with deliberately noncanonical but
well-shaped 64-character hashes returned a successful workbench with zero carry
candidates and zero unknown attribution. The complete read was required to be
unavailable. See `handoff/reviews/384-operator-business-day-close-workbench.md`.

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

## Builder evidence — D1120

Both domain and operator intentional reds preceded production source (0/1 each).
Official Windows PostgreSQL16.15 applies migrations1–66 and passes the new workbench
suite 5/0 (15 assertions): the one composed statement parses and executes; active actor,
tenant, exact property, selected unsealed day and persisted current-day containment;
ordinary/duplicate/missing lineage; current-day empty candidates; exact real 366/367
day and 500/501 candidate boundaries; and zero business-day writes. Existing readiness
proof additionally passes six semantic cases including typed blockers/unknown and the
strict 299999/300000ms boundary; its statement-statistics case was not claimed from the
builder's server because preload was absent and must run in fresh review.

Focused combined domain/operator proof passes 14/0 (78 assertions), full operator proof
passes 504/0 with 117 expected database skips (5,651 assertions), and standing passes
1,241/0 with 968 expected skips (18,692 assertions). Typecheck, JavaScript syntax,
141-file boundaries, 23-package licence policy, zero-vulnerability audit and diff
hygiene pass. The operator uses `context.tx` directly; no `src/server.ts` change was
needed despite its approved allowance. CONTRACTS/UI-SPEC record exact bounds, privacy,
snapshot and accessible stale-safe read-only behavior. The disposable PG16 root was
removed and port55484 is closed. Stable local and `.yellow` remain untouched. Fresh
independent Tier-3 review is mandatory; builder evidence is not approval.

## Complete fresh independent restart — D1131

Approval remains withheld after the separately approved D1121/D1124/D1127 repairs.
The complete fresh Tier-3 restart proved the database, carry-lineage, permission,
HTTP, static and standing gates green, but an executable operator-entry probe found
that the ordinary **Day close** navigation path is unusable. Navigation pushes
`/p/{property}/day-close` without a date, the only date selector begins disabled,
and `loadDayCloseWorkbench` returns before its only server request when the route has
no date. The selector is populated only after that impossible first successful
request. A manually crafted `?date=YYYY-MM-DD` URL works, but the visible operator
entry cannot discover or select the authoritative persisted backlog. See the D1131
section of `handoff/reviews/384-operator-business-day-close-workbench.md`.
