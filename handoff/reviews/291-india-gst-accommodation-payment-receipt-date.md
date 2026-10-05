# Order 291 independent Tier-3 review — India GST accommodation payment-receipt date

**Verdict:** APPROVED  
**Reviewer:** OpenAI Codex independent review agent `/root/order291_review`  
**Candidate:** `10e9adf1f66d043f69604cce2b31758b8a191fc1`  
**Base:** `31dd963`  
**Branch:** `phase-7/india-gst-accommodation-payment-receipt-date`  
**Reviewed:** 2026-08-30

## Independence and scope

I did not implement Order 291. I read `PROJECT.md`, `AGENTS.md`, ran `./state.sh`,
and read the complete `yellow-compliance-rules`, `yellow-entity-patterns`, and
`yellow-postgres-patterns` skills before reviewing the candidate. I also read Order
291, D-771/D-772, the approved Order 290 contract and review, and the relevant Order
252 and Order 240 contracts.

I reviewed exact candidate `10e9adf` in a detached worktree. The approved Order 290
candidate `4476cc59342de6a0faba7069612fef25afb02426` is an ancestor. The exact
base-to-candidate diff contains 19 files, all within the order's declared migration,
resolver, export, tests, schema mirror, setup oracle, documentation and governance
scope. `git diff --check 31dd963..10e9adf` is clean. The immutable
`migrations/0001_init.sql`, `package.json`, `bun.lock`, and `docker-compose.yml` have
identical blobs at base and candidate. The candidate worktree was clean before this
review record.

## Current primary-source statutory check

I inspected the current consolidated official India Code copy of the *Central Goods
and Services Tax Act, 2017*:

- section 13(2) and its Explanation on page 26 of the current consolidated Act:
  <https://www.indiacode.nic.in/indiacode/bitstream/123456789/15689/1/A2017-12.pdf>;
- CBIC's official Act presentation of section 13:
  <https://cbic-gst.gov.in/hindi/CGST-bill-e.html>;
- CBIC's official service-invoice rule:
  <https://cbic-gst.gov.in/gst-invoice-rules.html>.

The consolidated India Code text includes amendments effective through 2025 and
still defines section 13(2) payment receipt, for clauses (a) and (b), as the earlier
of entry in the supplier's books and credit to the supplier's bank account.
Explanation (i) separately limits supply to the extent covered by invoice or payment.
That supports retaining both source dates and their earlier date, and supports this
candidate's narrow full-attribution-only admission while partial payment allocation
remains unresolved. The sources do not support substituting payment creation,
provider-webhook receipt, settlement, journal, business-day, reservation,
operational, or clock timestamps. They also do not support deciding time of supply
without the separate invoice-timeliness branch. The candidate preserves those
boundaries.

## Schema and resolver inspection

Migration 0057 adds exactly the declared 12-column tenant-leading root. Its primary
key, unique tenant/service root, exact tenant/service foreign key, positive bigint
amount, uppercase currency, full-attribution literal, finite dates, database
`LEAST` check, exact source/legal literals, and lowercase SHA-256 constraint are
present. RLS is enabled and forced. `app_role` receives SELECT only; `PUBLIC`,
`yellow_runtime`, and `app_role` have no table mutation authority. No runtime writer,
ingestion command, bank/provider lookup, attestation workflow, event, or financial
effect is added.

The resolver accepts only the exact accessor/proxy/symbol-free six-key input and
performs one equality-only read under the transaction-local tenant context. It joins
the exact Order 290 service root to the complete Order 252 reservation lineage and
Order 240 attribution root, reparses the canonical attribution, and rechecks tenant,
property, reservation, service/payment roots, every lineage id/hash, room revenue
origin, full grand total, currency, both source dates, statutory earlier date,
source, evidence hashes, and legal literals. Missing, duplicate, malformed, mixed,
partial, stale, or substituted evidence fails closed. The result is fixed-order,
recursively frozen, tenant-hidden, and carries a tenant-bound deterministic evidence
hash.

Migration 0057 SHA-256 is
`12108a774929f7541090c628d28972b313498d51cd84b0d3a9ccd6b541d25117`.

## Reviewer-executed proof

All successful database proof used isolated PostgreSQL 16.15 resources. Credentials
were loaded from the approved local runtime-authority file and were never printed.
I personally executed every gate; builder-transcribed results were not used as
approval evidence.

| Proof | Reviewer result |
|---|---:|
| Focused Order 291 hostile + live PostgreSQL suite | `8 pass / 0 fail / 105 expectations` |
| Fresh deployment database acceptance | `22 pass / 0 fail / 63 expectations` |
| Runtime DML authority | `5 pass / 0 fail / 116 expectations` |
| Migration runner | `39 pass / 0 fail / 187 expectations` |
| Normalized `pg_dump` versus `tests/schema/expected.sql` | exact match |
| Normalized schema SHA-256 | `400a7da729b8fad3c0def0a22f0a8eda43a68021898ed495060c158ce7b81dbe` |
| Exact catalogue | `57 migrations / 109 tables / 99 RLS / 99 policies / 9 FORCE RLS` |
| Canonical `./setup.sh --db-only` referee | `11 passed / 0 failed of 11` |
| Full standing suite | `992 pass / 0 fail / 869 database-only skips / 15,377 expectations`; `1,861 tests / 326 files` |
| TypeScript | `tsc --noEmit` green |
| Context boundaries | `114 TypeScript files scanned` green |
| Dependency licence policy | `23 installed packages` green |
| Dependency audit | no vulnerabilities |
| Candidate ancestry, scope, protected blobs, status and whitespace | green |

I also built a fresh `yellow_golden` database through migration 57, loaded the
canonical fixture, seeded a real Order 240 canonical room/revenue attribution, Order
252 hold-to-reservation/first-segment lineage, Order 290 service-provision root, and
Order 291 payment-receipt root, then invoked the actual six-key resolver as
`yellow_runtime` with `SET LOCAL ROLE app_role` and a transaction-local tenant
context. It returned:

- payment root `00000000-0000-0000-0000-000000291011`;
- supplier-books date `2043-06-21`;
- supplier-bank and receipt date `2043-06-19`;
- full amount `10500 INR`;
- lineage `00000000-0000-0000-0000-000000291006`;
- evidence hash
  `2ddca8996602c3bb8d5ebad469a3c1e0f636476924e97113a286bf5dce3f6fed`.

The result and every nested object were frozen, and tenant identity was absent from
the returned value. This exercises the real query, runtime ACL, forced RLS, tenant
context, complete lineage, hostile attribution parser, amount/currency equality,
both statutory dates, and evidence hash together.

## Reviewer-harness observations

The canonical setup/referee completed successfully, after which an external cleanup
process removed its disposable Compose project. A focused invocation begun after
that removal completed the six pure tests but received `ERR_POSTGRES_CONNECTION_CLOSED`
in the live test. I discarded it and reran against a retained direct PostgreSQL
container; the clean run passed `8/0`.

The first direct-container acceptance attempt used PostgreSQL 16.15 without the
repository-required `shared_preload_libraries=pg_stat_statements`. All 21 remaining
acceptance cases passed, while the platform-preload assertion correctly failed. I
recreated the reviewer container with the exact repository preload settings and the
clean acceptance run passed `22/0`. A migration attempt pointed at protected
`yellow_dev`; the harness correctly refused before the suite. The required
`postgres` admin-database rerun passed `39/0`.

For the manually seeded golden path, my first reviewer script cast a Bun string
parameter directly to `jsonb`; Bun encoded it as a JSON string and the existing
attribution outer-identity check rejected it with SQLSTATE `23514`. The transaction
rolled back. Correcting the reviewer harness to the repository's `::text::jsonb`
boundary produced the successful golden result above. These were transparent
reviewer-infrastructure/configuration failures, not candidate assertion failures;
only clean completed reruns count as approval evidence.

The repository state reported the local application and its services down at review
start. I performed no local promotion, app replacement, deployment, governance
approval, or merge action.

## Findings and verdict

No blocking, high, medium, or low-severity product finding remains. Exact candidate
`10e9adf1f66d043f69604cce2b31758b8a191fc1` is **APPROVED** only for Order 291's
externally evidenced full-attribution payment-receipt-date input. This approval does
not approve payment allocation, invoice or receipt-voucher issuance, invoice
timeliness, a section 13 time-of-supply result, tax calculation, posting, documents,
API/UI/local promotion, governance status, merge, deployment, Phase 7 completion, or
application completion.
