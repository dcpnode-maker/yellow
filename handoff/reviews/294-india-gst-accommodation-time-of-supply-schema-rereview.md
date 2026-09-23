## conclusion

**APPROVED.** Fresh independent Tier-3 live schema rereview of exact repaired
candidate `f77aba35ab4832e080063f0422d7edcd77a08ed9` against approved base
`809928fca3a7893441c67a876f5c48529a8c9585` finds the D-788 schema blocker
repaired. I did not implement Order 294 or any prior Order-294 review. In a clean
detached worktree I read PROJECT.md, AGENTS.md and state, all three Yellow
compliance/entity/PostgreSQL skills, Orders 290–294 and their approval records, the
two prior Order-294 review records, D-784 through D-789, and the official CBIC
material before personally executing the proof below.

## evidence

CBIC's CGST Act text makes the ordinary section 13(2)(a) result the earlier of a
timely invoice and payment receipt, and section 13(2)(b) the earlier of service
provision and payment receipt; its Explanation (ii) defines receipt as the earlier
of the supplier-books entry and bank credit. CBIC Rule 47 specifies the ordinary
30-day service-invoice period. The candidate correctly preserves the intentionally
bounded ordinary path and fails closed outside it. Sources:
<https://cbic-gst.gov.in/hindi/CGST-bill-e.html> and
<https://cbic-gst.gov.in/gst-invoice-rules.html>.

The new one-read projection no longer names `service.amount_minor`. It obtains the
canonical amount solely by reparsing the joined Order-240 attribution snapshot and
requires it to equal both the actual Order-291 payment amount and Order-292 invoice
amount. I personally executed the real resolver through
`Database.withTenantTransaction` as `yellow_runtime`/`app_role` against a fresh
PostgreSQL 16.15 database with four independently seeded complete
Order-240→252→290→291→292 chains. It accepted books-earlier, bank-earlier and equal
payment-date evidence; day 30 selected section 13(2)(a), and day 31 selected section
13(2)(b). Replays returned byte-equivalent evidence hashes, outputs were recursively
frozen and tenant-hidden, tenant B received only the not-found result, and the
before/after counts for journals, posting lines, documents, facts and outbox were
identical.

## files_and_lines

- `src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts:7,43-44,68`
  defines the real row contract, compares only payment/invoice stored amounts with
  canonical attribution grand total, and projects no service amount column.
- `src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts:48-49`
  retains the inclusive Rule-47 30-calendar-day boundary and the two bounded CGST
  section-13 candidate selections.
- `tests/india-gst-accommodation-time-of-supply.test.ts:37,48,74`
  covers all payment-date orderings, candidate branches, and permanently forbids the
  obsolete projection token.
- `migrations/0056_india_gst_accommodation_service_provision_date.sql:4-19`
  confirms the service root has no amount column; the candidate is now consistent
  with that approved schema.

## tests_or_checks

- Reviewer-personal isolated `./setup.sh --db-only`: 58 migrations, 110 public
  tables and `11 passed, 0 failed of 11`.
- Reviewer-personal live PostgreSQL 16.15 resolver proof: 1 pass, 0 fail; four full
  seeded predecessor chains prove books-earlier, bank-earlier, equal, day-30/day-31,
  complete output/hash, tenant concealment and zero effects.
- Focused Orders 290–294 suite: 44 pass, 0 fail, 3 expected database skips, 597
  expectations.
- Typecheck, 117-file import-boundary check, 23-package licence policy, exact-base
  diff check and protected-file identity check: green.
- Candidate ancestry and declared migration-free scope checked; no migration,
  baseline schema, dependency, Compose or schema-mirror blob changed.

## risks

Approval is strictly limited to the read-only, full-attribution ordinary Rule-47
section-13(2)(a)/(b) evidence composer. It does not decide applicability of exception
regimes, invoice validity/issuance, tax decomposition, posting, documents, IRP,
submission, local promotion, merge, deployment or Phase completion. As with every
time-of-supply computation, later work must remain independently reviewed when it
adds statutory regimes or authority.

## recommended_parent_action

Record this fresh Tier-3 approval for exact `f77aba3`; it clears the D-788/D-789
schema rereview gate for Order 294 only. Any merge or later downstream fiscal work
remains separately governed and reviewed.
