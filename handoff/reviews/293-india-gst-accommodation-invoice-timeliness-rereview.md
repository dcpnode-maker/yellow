# Order 293 independent Tier-3 re-review — India GST accommodation invoice timeliness

**Verdict:** CHANGES REQUIRED
**Reviewer:** OpenAI Codex independent re-review agent `/root/order293_rereview`
**Candidate:** `321820cb293d5a6a8ad9d412e862557d1ab6ecac`
**Base:** `b5b2d452f2ab87b8eca7c710fcc5eef0176cb0cd`
**Prior reviewed candidate:** `95e43a5ffd780dacc7e200ec7f6e35ebff58499a`
**Branch:** `phase-7/india-gst-accommodation-invoice-timeliness`
**Reviewed:** 2026-08-30

## Independence and governing material

I did not implement Order 293 and am distinct from the first reviewer. I reviewed the
exact repaired candidate in a clean detached worktree. Before review work I read
`PROJECT.md`, `AGENTS.md`, ran `./state.sh`, and read the complete
`yellow-compliance-rules`, `yellow-entity-patterns`, and
`yellow-postgres-patterns` skills. I also read the full Yellow constitution and
architecture, the Phase-7 plan/build/roadmap material, Order 293, D-777 through
D-780, the first Order-293 review, the independently approved Order-290 and
Order-292 contracts/reviews, and the relevant Order-240/252 lineage.

Both the approved base and the first reviewed candidate are ancestors of the exact
candidate. The base-to-candidate diff contains 14 declared files and no migration or
schema snapshot change. Base and candidate have identical blobs for
`migrations/0001_init.sql`, `package.json`, `bun.lock`,
`docker-compose.yml`, and `tests/schema/expected.sql`.

## Current official statutory check

I personally inspected current official CBIC material:

- CBIC's CGST Act page, sections 13(2) and 31(2):
  <https://cbic-gst.gov.in/hindi/CGST-bill-e.html>. Section 31(2) requires a
  taxable-service invoice before or after service within the prescribed period.
  Section 13(2)(a) uses the invoice date only when that timing requirement is met;
  section 13(2)(b) instead uses service provision when it is not. Payment comparison
  and the section 13(2)(c) fallback are separate rules.
- CBIC's official CGST Rules PDF, rule 47:
  <https://cbic-gst.gov.in/pdf/amended-01012022-CGST-Rules-2017-Part-A.pdf>, and
  the currently served invoice-rules page:
  <https://cbic-gst.gov.in/gst-invoice-rules.html>. The ordinary taxable-service
  period is 30 days. The 45-day financial-sector rule and the listed distinct-person
  exception are separate.

This supports only the order's bounded, affirmatively selected ordinary-regime
timeliness result. It does not authorize exception inference or a section-13
time-of-supply result. The candidate's inclusive day-30 policy is consistent with
that bounded contract.

## Findings

### 1. Blocking: complete predecessor attribution is still absent from the public result and hash

The date-arithmetic part of D-779 is repaired, and the query now selects and
cross-checks the complete stored row lineage. The other D-779 blocker is not closed.

At
`src/contexts/tax-fiscal/india-gst-accommodation-invoice-timeliness.ts:32-51`
and `:292-316`, the fixed public result and the object hashed by `evidenceHash`
contain snapshot IDs, dates, Rule-47 evidence, series/serial, the two external
source-evidence SHA values, amount and currency. They do not contain:

- `reservationId`;
- the complete approved eight-field `reservationLineage`:
  `lineageId`, `holdBindingId`, `attributionId`, `reservationId`,
  `segmentId`, `originQuoteHash`, `snapshotHash`, and `currency`;
- the approved attribution identity:
  `originKind: rate_quote`, `lineId: room`, and
  `revenueGroup: room_revenue`;
- the complete Order-292/290 predecessor envelopes, including
  `coverageScope`, the invoice and service source/legal-rule identities, and
  their reconstructed canonical predecessor evidence.

The SELECT at line 378 fetches the raw fields and `build` validates many equality
relationships, but validation is not output/hash binding. The public hash is computed
only from `{ tenantId, ...evidence }`, and `evidence` omits the fields above.
The focused exact-key assertion at
`tests/india-gst-accommodation-invoice-timeliness.test.ts:101` codifies that
incomplete public shape.

This violates Order 293's exact requirements to re-resolve and rehash complete
approved Order-290/292 lineage and return complete attribution, and D-779's explicit
requirement that complete lineage be present in the result/evidence hash.

Required repair: reconstruct the approved nested predecessor evidence from the
selected row, return and hash at least the complete eight-field reservation lineage,
the three-field attribution identity and reservation identity, and bind the complete
Order-290/292 evidence envelope (including coverage/source/legal identity) in fixed
order. Focused hostile proof must assert the complete public shape and show each
lineage/attribution field is present and independently hash-bound, rather than merely
query-validated. If exact reconstructed predecessor `evidenceHash` values are
returned, compute them from the approved canonical structures rather than trusting a
new stored value.

### 2. Mandatory diff gate is not green

`git diff --check b5b2d452f2ab87b8eca7c710fcc5eef0176cb0cd
321820cb293d5a6a8ad9d412e862557d1ab6ecac` exits 2. It reports trailing whitespace
on lines 3-7 of
`handoff/reviews/293-india-gst-accommodation-invoice-timeliness.md`, the first
review record added between the base and repaired candidate. This is not a product
logic defect, but D-780's claimed green diff gate is not reproducible for the exact
base-to-candidate range. Remove those five trailing spaces and rerun the exact gate.

## D-779 date repair verification

The repaired implementation contains no JavaScript `Date`, `Date.UTC`, or
`Date.now`. It validates exact proleptic-Gregorian dates in years 0001 through
9999, applies the divisible-by-4 / century / divisible-by-400 rule explicitly,
increments 30 calendar days without timezone conversion, and fails closed when the
result would exceed year 9999.

Reviewer-executed focused proof passed `15/0` with `146` expectations, including
0001, 0043, 0099, 0100, leap year 2000, non-leap century 1900, month and year
rollovers, day 30, day 31, before-service invoices, and upper-bound overflow.
The actual seeded PostgreSQL resolver additionally returned
`0043-06-01 + 30 = 0043-07-01`, closing the executable low-year defect reported by
the first review.

## Reviewer-executed proof

Every result below was personally executed against the exact candidate; no
builder-transcribed output was accepted as review proof.

| Proof | Reviewer result |
|---|---:|
| Focused Order-293 intentional/hostile/boundary suite | `15 pass / 0 fail / 146 expectations` |
| Adjacent Order-290/291/292/293 suite | `44 pass / 0 fail / 3 expected DB skips / 611 expectations` |
| Live predecessor Order-290/291/292 RLS/ACL suites | `22 pass / 0 fail / 338 expectations` |
| Canonical isolated `./setup.sh --db-only` referee | `11 passed / 0 failed of 11` |
| Fresh PostgreSQL 16.15 deployment acceptance | `23 pass / 0 fail / 65 expectations` |
| Runtime DML authority | `5 pass / 0 fail / 117 expectations` |
| Migration runner against dedicated admin database | `39 pass / 0 fail / 187 expectations` |
| Normalized schema against `tests/schema/expected.sql` | exact match |
| Normalized schema SHA-256 | `227cba82339bc69d9c9263b854ea7954dc82a0dc16e19ca852304dc0d2eab19d` |
| Exact catalogue | `58 migrations / 110 tables / 100 RLS / 100 policies / 10 FORCE RLS` |
| Full standing suite | `1013 pass / 0 fail / 871 expected skips / 15,595 expectations`; `1,884 tests / 330 files` |
| TypeScript / boundaries / licences / audit | green; `116` TypeScript files / `23` packages / zero vulnerabilities |
| Ancestry, declared scope, no migration/schema diff, protected blobs | green |
| Exact base-to-candidate `git diff --check` | **failed** as Finding 2 |

The actual seeded resolver ran as `yellow_runtime` under transaction-local
`app_role` and tenant context against complete Order-240→252→290→292 evidence.
It returned:

- service `2043-06-01`, invoice `2043-07-01`, deadline `2043-07-01`:
  `timely` (day 30);
- service `2043-06-02`, invoice `2043-07-03`, deadline `2043-07-02`:
  `late` (day 31);
- service `2043-06-03`, invoice `2043-06-02`, deadline `2043-07-03`:
  `timely` (before service);
- service `0043-06-01`, invoice `0043-07-01`, deadline `0043-07-01`:
  `timely` (low year).

The same live proof concealed tenant-A evidence under tenant-B context with
`IndiaGstAccommodationInvoiceTimelinessNotFoundError`. Counts before and after
resolver execution were identical: four attributions, four hold bindings, four
reservation lineages, four service roots, four invoice roots, 20 facts, 32 outbox
rows, and zero journals, postings or documents. On the same selected identities,
changing invoice series, invoice serial, invoice evidence SHA, or service evidence
SHA independently changed `evidenceHash`; restoring each value restored the
original hash. These results prove the repaired fields that are present are
live-query-bound, but they do not cure Finding 1's omitted complete lineage.

## Harness and cleanup

Direct detached Docker containers were unexpectedly destroyed immediately by the
host. Docker event capture confirmed that behavior. I therefore held an unrelated,
unlabelled, exact `postgres:16.15-alpine` container in the foreground for the
authoritative 23/0 acceptance, migration, schema and live resolver proof. An
independent WSL PostgreSQL 16.15 cluster was used only as a fallback check; its
distro-suffixed version string made the acceptance harness report 22/1, so it was
not used as the authoritative acceptance result.

After proof, I stopped and removed the exact foreground container and its anonymous
storage, stopped the private WSL server, removed its exact data directory, closed
ports 5596/5597, stopped event capture, and removed generated authority files,
dependencies and the temporary live-proof script. There are no matching reviewer
containers, volumes, networks, WSL processes or data directories. The unrelated
pre-existing Order-175 app/PostgreSQL/Valkey containers remain exited; stable local
remains stopped.

I made no product, test, migration, schema, governance, merge, promotion, deployment
or local-runtime change. This review record is the only retained re-review edit and
is intentionally uncommitted because the candidate is not approved.

## Verdict

Exact repaired candidate
`321820cb293d5a6a8ad9d412e862557d1ab6ecac` is **CHANGES REQUIRED**.
D-779's JavaScript-date blocker is closed, but its complete-predecessor-lineage
result/hash blocker remains open, and the exact diff gate is also non-green. No
approval, merge, promotion, deployment, Phase-7 completion or application-complete
authority is granted. A corrected exact candidate requires fresh independent
Tier-3 review.
