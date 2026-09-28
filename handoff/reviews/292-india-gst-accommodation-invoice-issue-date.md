# Order 292 independent Tier-3 review — India GST accommodation invoice issue date

**Verdict:** APPROVED
**Reviewer:** OpenAI Codex independent review agent `/root/order292_review`
**Candidate:** `cc7d44b0975fdc1e365be68173f391674c3c09db`
**Base:** `1037f9d`
**Branch:** `phase-7/india-gst-accommodation-invoice-issue-date`
**Reviewed:** 2026-08-30

## Independence and scope

I did not implement Order 292. I reviewed the exact candidate in a detached
worktree and did not modify product or test files. Before review I read
`PROJECT.md`, `AGENTS.md`, ran `./state.sh`, and read the complete
`yellow-compliance-rules`, `yellow-entity-patterns`, and
`yellow-postgres-patterns` skills. I also read Order 292, D-774/D-775, the approved
Order 290 and Order 252 contracts/reviews, the relevant Order 240 contract, and the
approved Order 291 lineage immediately preceding this candidate.

The approved base `1037f9d` is an ancestor of exact candidate `cc7d44b`. Its 19-file
base-to-candidate diff stays within the order's declared migration, resolver/export,
tests, schema mirror, setup oracle, contract/domain/security documentation, and
build/roadmap/order/decision/ledger scope. The protected
`migrations/0001_init.sql`, `package.json`, `bun.lock`, and `docker-compose.yml`
blobs are identical at base and candidate. Their candidate SHA-256 values are,
respectively, `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`,
`6f3a7640d485c88acc8c001c19c364be6a66ff656b96035a81fb9a5c9201ef07`,
`16b1eb40baf0797fca6d8b57f4d0eba021525413f860f73e90838135217ffd1b`,
and `8f9877bbdedcee5a7b721d7fd2059b4470b91436edf7b6d1807faca7c917c933`.

The implementation adds only one 12-column tenant-leading, forced-RLS,
SELECT-only invoice-issue evidence root and one exact eight-key resolver. It adds
no writer, ingestion command, invoice issuance/numbering authority, validity or
timeliness decision, time-of-supply composition, clock/latest substitution,
document/folio/journal/payment/operational derivation, API, UI, IRP, posting,
submission, or local-promotion surface.

## Current official statutory check

I personally inspected the official CBIC material currently served on 2026-08-30:

- CBIC's official presentation of the *Central Goods and Services Tax Act, 2017*,
  section 13(2): <https://cbic-gst.gov.in/hindi/CGST-bill-e.html>. Section 13(2)(a)
  uses invoice issue date only when the invoice is issued within the section 31(2)
  prescribed period, section 13(2)(b) instead uses provision of service when it is
  not, both compare the applicable date with payment receipt, and section 13(2)(c)
  is a separate recipient-books fallback. The Explanation applies invoice/payment
  only to the extent it covers the supply.
- The same official Act page, section 31(2), requires a registered taxable-service
  supplier to issue the tax invoice before or after service provision but within
  the prescribed period.
- CBIC's official CGST Rules PDF currently available at
  <https://cbic-gst.gov.in/pdf/amended-01012022-CGST-Rules-2017-Part-A.pdf>, rule
  46(b)-(c), requires a financial-year-unique consecutive serial number not
  exceeding 16 characters, in one or multiple series using the listed characters,
  and the invoice issue date.
- The same PDF, rule 47, and CBIC's currently served official invoice-rules page
  <https://cbic-gst.gov.in/gst-invoice-rules.html> prescribe 30 days from supply
  for the ordinary taxable-service case, 45 days for the listed financial-service
  suppliers, and the separate distinct-person exception for the listed classes.

Those sources support retaining exact supplier-invoice identity/date as a separate
input for later rule-47 regime/timeliness and section-13 composition. They do not
support relabelling a generic document or operational timestamp. Rule 46's
16-character legal requirement is deliberately not enforced by this evidence-only
slice: the order explicitly allows bounded raw external series/serial evidence
without deciding invoice validity. Therefore the migration's wider raw-input bound
does not claim legal compliance; a later authorized validity/timeliness decision
must apply rule 46/47 rather than treating this root as proof of validity.

## Schema and resolver inspection

Migration 0058 contains exactly the declared 12 columns, tenant-leading primary
key, unique tenant/service root, unique tenant series/serial identity, and exact
tenant/service foreign key. It enforces positive amount, uppercase currency,
full-attribution coverage, non-empty bounded series/serial, finite date, exact
source/legal literals, and lowercase SHA-256. RLS is enabled and forced. `app_role`
has SELECT only; `PUBLIC`, `yellow_runtime`, and `app_role` have no mutation
authority. Migration SHA-256 is
`d2eaf70479a602ec82dc5abe73442475abb80ed8ec3f2ef3ec333b182c30dddf`.

The resolver rejects non-plain objects, proxies, accessors, symbols, missing keys,
and surplus keys before SQL. Its single equality-only query binds every supplied
key and joins the exact Order 290 service root through the complete Order 252/240
lineage. It reparses the canonical Order 240 snapshot and rechecks rate-quote,
room/room-revenue, full grand total, currency, all lineage identities/hashes,
invoice identity/date/source/hash/legal, property, reservation, and tenant context.
Missing, duplicate, malformed, mixed, partial, stale, amount/currency-mismatched, or
substituted evidence fails closed. The returned evidence is tenant-hidden,
deterministically hashed, and recursively frozen.

## Reviewer-executed proof

All successful database proof used isolated PostgreSQL 16.15 resources. Credentials
came from the approved local runtime-authority file and were never printed. I
personally executed every approval gate; builder-transcribed output was not used as
review evidence.

| Proof | Reviewer result |
|---|---:|
| Focused Order 292 hostile + live forced-RLS/ACL suite | `7 pass / 0 fail / 78 expectations` |
| Fresh deployment database acceptance | `23 pass / 0 fail / 65 expectations` |
| Runtime DML authority | `5 pass / 0 fail / 117 expectations` |
| Migration runner | `39 pass / 0 fail / 187 expectations` |
| Normalized `pg_dump` versus `tests/schema/expected.sql` | exact match |
| Normalized schema SHA-256 | `227cba82339bc69d9c9263b854ea7954dc82a0dc16e19ca852304dc0d2eab19d` |
| Exact catalogue | `58 migrations / 110 tables / 100 RLS / 100 policies / 10 FORCE RLS` |
| Canonical `./setup.sh --db-only` invariant referee | `11 passed / 0 failed of 11` |
| Full standing suite | `998 pass / 0 fail / 871 database-only skips / 15,449 expectations`; `1,869 tests / 328 files` |
| TypeScript | `tsc --noEmit` green |
| Context boundaries | `115 TypeScript files scanned` green |
| Dependency licence policy | `23 installed packages` green |
| Dependency audit | `bun audit`: no vulnerabilities |
| Candidate ancestry, declared scope and protected blobs | green |

I also seeded three real, complete Order 240 attribution → Order 252 reservation
lineage → Order 290 service roots → Order 292 invoice roots in the reviewer database,
then invoked the actual resolver as `yellow_runtime`, with `SET LOCAL ROLE app_role`
and transaction-local tenant context. Every call supplied exactly eight keys and
used service date `2043-06-20`:

| Relation | Invoice issue date | Resolver evidence hash |
|---|---|---|
| before service | `2043-06-19` | `3f086c220a7464b635db0920bc355f91e5a1929ded15fb9cf18940590d717687` |
| equal to service | `2043-06-20` | `8de6dbdaf933389ea9cf65d80d02d582a6455e0d0a280ad16a1dcb8043110432` |
| after service | `2043-06-21` | `8868b4d412c4dd0e3ea0f60820809db5b9950d23c7be5ae6d39c1eb64de0e5a3` |

Each result preserved the exact supplied invoice date without a timeliness decision,
returned `10500 INR`, hid tenant identity, froze the result and nested service
evidence, and reproduced byte-for-byte on a second resolver call. This exercises
the real query, runtime ACL, forced RLS, tenant context, complete lineage, canonical
snapshot parser, amount/currency equality, and deterministic evidence hash together.

## Reviewer-harness observations

The first non-login-shell canonical setup invocation could not see Bun and stopped
before touching Docker; the unchanged canonical script rerun through the configured
login shell completed successfully. An external cleanup mechanism removed that
Compose project after the successful referee, so all later live proof used a retained
direct container. A first direct-container acceptance run used the Debian-flavoured
16.15 image and correctly disagreed only on the repository's exact server-version
string; recreation with the repository-pinned Alpine digest produced the clean
acceptance result above.

The first standing/static attempt occurred before dependencies were installed in
the new detached worktree; `bun install --frozen-lockfile` restored the exact locked
23-package tree and the complete reruns passed. `bun pm audit` is not a supported Bun
1.3.14 spelling; the repository-required `bun audit` passed. The first manual seed
attempt cast a Bun string directly to `jsonb`, which PostgreSQL correctly rejected
under the pre-existing canonical attribution constraint and rolled back. Reusing the
repository's `::text::jsonb` boundary produced the successful seeded proof above.
These were reviewer environment/harness defects, not candidate assertion failures;
only clean completed reruns count as approval evidence.

The builder-only diff `a6ff9d4..cc7d44b` passes `git diff --check`. The full admitted
range `1037f9d..cc7d44b` reports four trailing-space lines in the Order 292 header;
they are intentional Markdown hard line breaks rather than product whitespace.

After proof I removed exact direct reviewer container
`503dd812e5ad8f02234efaa8297e196aa5841277543a12afae7b21e949b7ae0a`
and its anonymous volume, verified zero matching Order 292 reviewer containers,
networks, or volumes remained, and removed the generated authority file, reviewer
scripts, `.yellow` directory, and installed dependency tree. I performed no stable
local promotion, app replacement, deployment, governance approval, merge, or branch
integration.

## Findings and verdict

No blocking, high, medium, or low-severity product finding remains. One nonblocking
governance-document hygiene finding is recorded: candidate `cc7d44b` duplicates the
three preceding Order 292 boundary lines in `BUILD-PLAN.md` immediately before the
D-775 builder-proof paragraph. The repetition is byte-local, adds no authority,
does not contradict the order, and does not affect executable proof; it should be
removed in a later authorized documentation cleanup rather than changing this exact
reviewed product candidate.

Exact candidate `cc7d44b0975fdc1e365be68173f391674c3c09db` is **APPROVED** only for
Order 292's externally evidenced, full-attribution supplier tax-invoice identity and
issue-date input. This approval does not approve invoice validity, numbering,
issuance, rendering, rule-47 regime or timeliness, section-13 time of supply,
payment allocation, tax calculation, posting, documents, IRP, API/UI, stable-local
promotion, governance status, merge, deployment, Phase 7 completion, or application
completion.
