# Order 340 — India GST section 14 six-case rate-version selection

**Status:** BUILT-PENDING-FRESH-TIER3-REVIEW-D955
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-section14-rate-selection`
**Base:** `0961648` (independently approved Order339 governance head)
**Risk tier:** 3 — statutory time-of-supply and old/new rate-version conclusion;
fresh independent executable review mandatory

## Outcome

Compose approved governed service, invoice and payment roots with the approved
accommodation rate-version pair and Section14 payment-proviso evidence. Implement
exactly the six CGST Act section14 cases, derive the statutory time-of-supply date and
select only the exact predecessor or successor rate-version identity.

No separate normalized-payment artifact is admitted. Normalization is private to this
composer: Order291 supplies governed books/bank dates, Order302 supplies the safe
ordinary branch, and approved Order339 supplies the calendar-governed branch.

## Exact contract

- expose one transaction-bound resolver under the tax-fiscal boundary. Accept only an
  exact plain accessor/proxy/symbol-free input containing tenant/property/reservation,
  complete Order304 pair plus supplied Order307 result, exact Order290/291/292 root
  inputs plus supplied results, and one discriminated Section14 payment-evidence union;
- rerun Order307; resolve Orders290,291 and292 through the same tenant transaction;
  require every supplied result deeply frozen and insertion-byte equal to fresh truth;
- equality-bind tenant/property/reservation, reservation/attribution lineage, service
  root, full-attribution amount/currency and invoice/payment evidence;
- derive supplier books/bank dates only from revalidated Order291. Rerun Order302 from
  those dates and the derived rate-change date. The safe union requires the safe state
  and equality with Order291 ordinary receipt. The calendar union reruns Order338 and
  Order339 from complete ancestry and uses only Order339's governed receipt date;
- classify service, invoice and effective payment dates strictly before or strictly
  after rate change. Equality and every non-enumerated/all-before/all-after arrangement
  fail closed; no default seventh case exists;
- implement exactly: supply before + invoice/payment after → earlier(invoice,payment),
  successor; supply/invoice before + payment after → invoice, predecessor; supply/
  payment before + invoice after → payment, predecessor; supply after + invoice before
  + payment after → payment, successor; supply after + invoice/payment before → earlier
  (invoice,payment), predecessor; supply/invoice after + payment before → invoice,
  successor;
- return recursively frozen tenant-hidden dates, case, selected time-of-supply,
  predecessor/successor side, selected version id/version/content hash/effective bounds,
  complete predecessor hashes, legal rule and tenant-bound final hash. Return no rate.

## Scope

- this order and bounded decisions/roadmap/phase-plan/build-plan/ledger/review evidence;
- new `src/contexts/tax-fiscal/india-gst-section14-rate-selection.ts` and bounded index
  value/type/error exports;
- focused intentional-red, six-case, hostile, replay, transaction and mutation proof;
- bounded `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md` additions.

## Forbidden boundary

No migration/schema/seed/writer/ingestion/network/clock/latest/nearest/calendar
inference/API/UI/local operation. No caller normalized payment date; no Order294
ordinary Section13 authority; no equality-date policy/default/seventh case. No numeric
rate copy/evaluation, component schedule, value, amount, rounding/allocation, stay
splitting, registration/place-of-supply/levy change, posting, journal, correction,
fiscal document, IRP/submission, merge, deploy, Phase/application-complete claim.

## Pre-registered proof

- **P0 intentional red:** resolver/module/export is absent before production.
- **P1 six cases:** both earlier-of directions and all six cases select the expected
  date and version; equality, all-before/all-after and case swaps fail.
- **P2 governed payment:** safe/calendar branches derive only from Order291 books/bank;
  ordinary-always, bank-always, fourth-day `>=`, missing coverage and omitted Order291
  equality mutants fail.
- **P3 complete replay:** ignoring any Order290/291/292/302/307/338/339 supplied result,
  hash-only comparison or mixed tenant/lineage/amount/currency/snapshot truth fails.
- **P4 rate selection:** reversed version sides, service-date selection and replacing
  either earlier-of with a fixed operand fail.
- **P5 evidence/containment:** complete predecessor/tenant hashing, freeze, concealment
  and absence of numeric-rate/amount/downstream authority pass.
- **P6 preservation:** focused/adjacent/standing/static gates remain green without
  migration, database mutation, runtime or local change.

## Definition of done

- [x] Intentional red precedes production.
- [x] Exact six-case, branch, replay and hostile proof passes.
- [x] Standing/static preservation gates pass.
- [ ] Fresh non-implementing Tier3 reviewer personally executes mutants and approves.

## Built evidence — D955

- Intentional red failed `0/1` before the module/export existed.
- Exact implementation `67cd364` plus permanent-proof hardening `a218c8d` passes the
  six cases, both operand directions for both earlier-of cases, all three equality
  positions, all-before/all-after rejection, safe/calendar normalization, complete
  Order307/290/291/292/302/338/339 replay, three-root same-transaction access, hostile
  shape/freeze/tenant checks, exact selected-version identity and complete hash proof.
- Focused Order340 passes `6/0` with 70 assertions. Focused dependencies pass `32/0`
  with 310 assertions. Standing passes `1176/0` with 890 expected database skips,
  17,763 assertions and 2,066 tests across 382 files. Typecheck, 131-file boundaries,
  23-package licence policy, zero-vulnerability audit and diff hygiene pass.
- No migration, database mutation, runtime, Docker, credential or stable-local artifact
  changed. Fresh non-implementing Tier3 executable review remains mandatory.
