# Order 293 independent Tier-3 review — India GST accommodation invoice timeliness

**Verdict:** CHANGES REQUIRED
**Reviewer:** OpenAI Codex independent review agent `/root/order293_review`
**Candidate:** `95e43a5ffd780dacc7e200ec7f6e35ebff58499a`
**Base:** `b5b2d452f2ab87b8eca7c710fcc5eef0176cb0cd`
**Branch:** `phase-7/india-gst-accommodation-invoice-timeliness`
**Reviewed:** 2026-08-30

## Independence, governing material and scope

I did not implement Order 293. I created a clean detached worktree at the exact
candidate, read `PROJECT.md`, `AGENTS.md`, ran `./state.sh`, and read the complete
`yellow-compliance-rules`, `yellow-entity-patterns`, and `yellow-postgres-patterns`
skills before review work. I also read the Phase-7 build material, Order 293,
D-777/D-778, the approved Order 290 and Order 292 contracts and independent reviews,
and the relevant Order 240/252 lineage.

The exact base is an ancestor of the candidate. The 13-file base-to-candidate diff is
inside the order's declared resolver/export, focused tests, contract/domain/security
documentation, phase/build/roadmap, order, decision and ledger scope. `git diff
--check b5b2d45..95e43a5` is clean. There is no migration or schema-snapshot diff.
The candidate and base have identical blobs for `migrations/0001_init.sql`,
`package.json`, `bun.lock`, `docker-compose.yml`, and `tests/schema/expected.sql`.

## Current official statutory check

I personally inspected the official CBIC material currently served on 2026-08-30:

- CBIC's official CGST Act page, section 13(2):
  <https://cbic-gst.gov.in/hindi/CGST-bill-e.html>. Clause (a) uses invoice issue
  date only when the invoice is issued within the section 31(2) prescribed period;
  clause (b) uses service provision when it is not; both separately compare the
  applicable date with payment receipt, and clause (c) is a separate fallback.
- The same official page, section 31(2), requires a registered taxable-service
  supplier to issue the tax invoice before or after provision but within the
  prescribed period. Section 31(5) separately governs continuous supplies.
- CBIC's official CGST Rules PDF:
  <https://cbic-gst.gov.in/pdf/amended-01012022-CGST-Rules-2017-Part-A.pdf>, rule
  47, and CBIC's currently served invoice-rules page:
  <https://cbic-gst.gov.in/gst-invoice-rules.html>. The ordinary taxable-service
  period is 30 days from supply. The rule separately gives 45 days to the listed
  financial-service suppliers and a books/quarter exception to listed distinct-
  person supplies.

Those sources support a bounded ordinary-regime timeliness result only after
affirmative ordinary-regime evidence. They do not authorize exception inference or
a section-13 time-of-supply result. The candidate's fixed day-30-inclusive policy
matches Order 293; the findings below are implementation/contract failures, not a
new legal-policy decision.

## Blocking findings

### 1. Accepted dates can produce a false statutory deadline

`src/contexts/tax-fiscal/india-gst-accommodation-invoice-timeliness.ts:117-152`
accepts canonical years `0001` through `9999`, then computes the deadline through
`new Date(Date.UTC(year, month - 1, day + days))`. JavaScript's legacy `Date.UTC`
handling maps years 0–99 into 1900–1999. It also permits the 30-day addition to
escape the accepted four-digit year domain.

The defect is executable, not hypothetical. Against a fresh PostgreSQL 16.15
database containing complete Order 240 → 252 → 290 → 292 lineage, the real resolver
ran as `yellow_runtime`, under `SET LOCAL ROLE app_role` and transaction-local tenant
context. Stored service date `0043-06-01` and invoice date `0043-07-01` returned
`deadlineDate='1943-07-01'` and `result='timely'`; the required date-only deadline is
`0043-07-01`. Direct boundary challenge also produced `0001-01-01 → 1901-01-31`,
`0099-12-15 → 2000-01-14`, and `9999-12-31 → 10000-01-30`.

This violates Order 293's exact `serviceProvisionDate + 30 calendar days` contract
and can issue a materially false statutory evidence hash. Replace the helper with
explicit proleptic-Gregorian date-only arithmetic (or narrow and enforce the legal
input domain), fail closed on overflow, and add hostile resolver proof for years
0001/0099/0100, leap and century boundaries, month/year rollover and the upper
boundary.

### 2. The result does not rehash the complete approved Order-290/292 evidence

Order 293 and D-777 require the composer to re-resolve and rehash the complete
approved Order 290 and Order 292 lineage, require exact amount/currency/identity
coherence, and return complete attribution. Approved Order 292 identity includes
`invoiceSeries`, `invoiceSerial`, `invoiceIssueEvidenceSha256`, and the nested Order
290 service evidence with reservation lineage and attribution.

The candidate's `ROW_KEYS`, SELECT, result and tenant-bound hash omit
`invoice_series` and `invoice_serial` entirely. Although it selects the service and
invoice source-evidence SHA values, it only checks that they look like lowercase
SHA-256 strings; neither value, the complete reservation lineage, nor the approved
attribution identity is present in the returned evidence or its hash. Consequently
the composer cannot reproduce or bind either approved predecessor evidence hash and
does not deliver the documented complete identity/provenance rehash. A snapshot UUID
reference alone is not the content rehash required by the order.

Rebuild the exact predecessor evidence from the complete selected row (sharing the
approved canonicalizers if useful), validate the full stored invoice identity, and
bind the predecessor evidence hashes/complete lineage into the fixed-order result
hash. Hostile proof must show that series, serial, predecessor source-evidence hashes,
and each complete lineage field cannot be omitted, substituted, or changed without
rejection or a correspondingly changed canonical evidence hash.

## Reviewer-executed proof

Every approval-relevant command was personally executed in the detached candidate;
builder-transcribed output was not used as review evidence.

| Proof | Reviewer result |
|---|---:|
| Focused Order 293 exact-shape/hostile/non-substitution suite | `11 pass / 0 fail / 124 expectations` |
| Broader Order240/290/291/292/293 adjacent suite with live predecessor ACL/RLS | `45 pass / 0 fail / 8 expected skips / 613 expectations` |
| Dedicated live Order252 lineage dependency | `7 pass / 0 fail / 24 expectations` |
| Fresh correctly configured deployment acceptance | `23 pass / 0 fail / 65 expectations` |
| Runtime DML authority | `5 pass / 0 fail / 117 expectations` |
| Migration runner | `39 pass / 0 fail / 187 expectations` |
| Canonical `./setup.sh --db-only` referee | `11 passed / 0 failed of 11` |
| Normalized schema against `tests/schema/expected.sql` | exact match |
| Normalized schema SHA-256 | `227cba82339bc69d9c9263b854ea7954dc82a0dc16e19ca852304dc0d2eab19d` |
| Exact catalogue | `58 migrations / 110 tables / 100 RLS / 100 policies / 10 FORCE RLS` |
| Full standing suite, clean rerun | `1009 pass / 0 fail / 871 expected skips / 15,573 expectations`; `1,880 tests / 330 files` |
| TypeScript / boundaries / licences / audit | green; `116` TypeScript files / `23` packages / zero vulnerabilities |
| Diff, ancestry, declared scope and protected blobs | green |

The actual seeded runtime resolver otherwise returned the expected ordinary-regime
results: day 30 `timely` with deadline `2043-07-01`, day 31 `late` with deadline
`2043-07-02`, and a before-service invoice `timely` with deadline `2043-07-03`.
The same proof returned `IndiaGstAccommodationInvoiceTimelinessNotFoundError` under a
foreign tenant context. Before/after counts were byte-equivalent across attribution,
hold binding, reservation lineage, service roots, invoice roots, facts, outbox,
journals, postings and documents: one attribution, one hold binding, one lineage,
four service roots, four invoice roots, and zero effect rows throughout.

The actual resolver query executed successfully against the exact catalogue, proving
that it references no nonexistent columns. The schema dump and exact base/candidate
blob comparison prove that Order 293 adds no migration or schema change.

## Harness observations and cleanup

One auxiliary acceptance attempt was intentionally discarded after I pointed it at
the seeded hostile-proof database and started that direct container without the
repository's `pg_stat_statements` preload flag; it failed only those two harness
preconditions. A fresh correctly configured Alpine 16.15 container, exact migrations
and canonical seed then passed all `23/0` acceptance checks. The first standing run
had one Windows `EBUSY` failure while deleting a Chromium temporary directory; the
isolated test passed `4/0`, the complete clean rerun passed `1009/0`, and the leftover
directory was removed.

After proof I removed both exact reviewer containers, their tmpfs data, the generated
authority directory, installed dependency tree and the browser temporary directory.
There are zero Order-293 reviewer containers, volumes or networks, and no matching
running Yellow service. The unrelated pre-existing Order-175 Compose project remains
exited. Stable local remains stopped. I performed no product/test/governance edit,
promotion, merge, deployment or local-runtime change.

## Verdict

Exact candidate `95e43a5ffd780dacc7e200ec7f6e35ebff58499a` is **CHANGES REQUIRED**.
No approval, merge, promotion, deployment, Phase-7 completion or application-complete
authority is granted. A corrected candidate needs fresh independent Tier-3 review and
reviewer-executed proof of both findings.
