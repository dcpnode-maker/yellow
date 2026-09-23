# Order 427 — Fresh independent Tier-3 foundational tax proof reconciliation

**Verdict:** PARTIAL APPROVAL / CHANGES REQUIRED — D1288

**Reviewed coordination head:** `01a802684d933f5d6d7f832d28ab57eabc053f5f`

**Reviewer:** `/root/order427_tax_review`, fresh independent non-implementing Tier-3

## Disposition

Order237 is independently approved and closed. Orders238 and239 remain unapproved
because mandatory authority guards are not all load-bearing and current PostgreSQL
proof is unavailable. Order413's header is reconciled only to its exact existing
candidate `48670fd`, fresh D1230 approval and matching ledger record; this review does
not expand or rerun Order413 authority.

## Exact ancestry and restored identities

- Order237 product/test entered at `e764ed2`; the evaluator has no later product
  change. Current blobs are evaluator `cceee428dca17b7bc5d63fb98807dadb12840a2d`
  and test `8da2095dfad95c3663afb5a9b0a19505c56103d9`.
- Order238 entered at `537f2c1`; approved descendant Orders299–301 add exact extension
  effective-period and property-day containment. Current blobs are resolver
  `c98a0454b30a92ef57da9eb9a14cab5e871265b7` and test
  `797acc3b12cebf5bd5f32add82ad3420768effe8`.
- Order239 entered at `d6e52dc`; its quote product has no later product change. Current
  blobs are quote `eb75f9a738dcb30d15fc79ff647e69579a852dae` and test
  `af20351ebd0ecca7298c715762358e92e99852bd`.
- Every reviewer mutation was restored before the next one and all three final product
  blobs match the identities above. No reviewer product/test mutation remains.

## Reviewer-executed calculations and mutations

The clean focused set passes **31/0**, with six expected PostgreSQL skips and 133
assertions. It proves India positive room-night boundaries 1/100000/100100/750000/
750100 minor units, exact tax total 182523 over base 1700201, per-night 5%/18%
selection, UAE 5% inclusive extraction 10500→10000+500 and KSA 15% extraction
11500→10000+1500. It also proves exact bigint money, line/document rounding,
compounding, hostile content, recursive freezing and currency disagreement.

Reviewer mutations produced these results:

- changing the evaluator slab comparison from inclusive to exclusive turns the
  evaluator/quote suites red **20/3**, catching India boundaries and compounded-slab
  behavior;
- removing the quote currency guard turns Order239 red **7/1**;
- changing `> 366` to `>= 366` leaves Order239 falsely green **8/0**;
- removing resolver property and business-date result matching leaves Order239
  falsely green **8/0**;
- removing the explicit non-null package-evidence attribution guard leaves Order239
  falsely green **8/0**, because the bundled fixtures are rejected by later amount
  guards;
- removing Order238's stored assignment/business-date containment checks leaves its
  permanent pure suite falsely green **8/0** with six database skips.

The last four outcomes violate Order427's load-bearing requirement. They do not show
that the restored production behavior is currently wrong; they show that its claimed
permanent protection is insufficient.

## PostgreSQL and complete gates

The Windows PostgreSQL17 service was already running on port5432. Using the approved
`.yellow/runtime-database-authority.env` without exposing its contents, the mandatory
Order238 database suite failed before fixture setup with PostgreSQL `28P01` password
authentication failure for `yellow_deploy` (**0 pass, 2 harness failures**). No
credential, role, database, fixture, Docker, WSL or local app was changed or started.
Therefore the six PostgreSQL cases remain unproved now and Order238 cannot close.

- Adjacent quote/rate/offer composition: **33 pass, 57 expected database skips, 0
  fail**, 138 assertions.
- Standing repository: **1,453 pass, 1,054 expected database skips, 0 fail**, 20,638
  assertions across 2,507 tests / 462 files.
- Strict TypeScript, 159 import boundaries, 23 dependency licences, production audit
  zero, four JavaScript syntax checks and container image pins **4/0 (7)** are green.
- Diff hygiene is green. No schema, migration, runtime, local, provider, document,
  submission, deployment, merge or push authority is granted.

## Required repair

Add isolated permanent tests proving exact 366 acceptance/367 refusal, mismatched
resolver property and business date, package-evidence refusal independent of package
amount fields, and stored assignment containment independent of SQL filtering. Then
restore authenticated current PostgreSQL execution for all six Order238 database
cases and obtain a different fresh independent Tier-3 rereview of Orders238/239.
