## conclusion

**CHANGES REQUIRED.** Fresh independent Tier-3 final re-review of exact repaired
candidate `39fd5a5f13ce89895f3ec4da8837637d3b5f6901` against approved base
`809928fca3a7893441c67a876f5c48529a8c9585` found a blocking live-schema/query
mismatch. I did not implement or previously review this repair. I reviewed it in a
clean detached worktree, read `PROJECT.md`, `AGENTS.md`, ran `./state.sh`, read all
three Yellow compliance/entity/PostgreSQL skills, Orders 290-294 and their approved
reviews, the prior Order-294 review, D-784 through D-787, and the official CBIC
section 13(2) and Rule 47 material before personally executing the proof below.

The D-786 payment-ordering defect itself is repaired: mock-level proof accepts
books-earlier, bank-earlier and equal source dates while retaining the statutory
earlier-of invariant. The candidate nevertheless cannot execute its one required
read on the approved PostgreSQL schema, so it is not eligible for approval, merge,
promotion or deployment.

## evidence

CBIC's official CGST Act presentation states that ordinary section 13(2)(a) selects
the earlier of timely invoice issue and payment receipt, section 13(2)(b) selects
the earlier of service provision and payment receipt when the invoice is not timely,
and Explanation (ii) defines payment receipt as the earlier of entry in the
supplier's books and credit to the supplier's bank account:
<https://cbic-gst.gov.in/hindi/CGST-bill-e.html>. CBIC's official invoice-rules page
prescribes 30 days from supply for the ordinary Rule-47 service case while preserving
the separate 45-day and distinct-person exceptions:
<https://cbic-gst.gov.in/gst-invoice-rules.html>. The repaired pure cases correctly
exercise both payment source orderings, equality, day 30/day 31, both statutory
branches and invoice/payment/service/equal candidate selection.

The live candidate fails before any row can be resolved. The independently approved
Order-290 table has exactly 15 columns and no `amount_minor`. Candidate line 68
nevertheless selects `service.amount_minor::text AS service_amount`. Against a fresh
PostgreSQL 16.15 database migrated through 0058, an actual
`yellow_runtime`/`app_role` transaction returned PostgreSQL `42703`:
`column service.amount_minor does not exist`.

I then seeded a valid complete Order-240 attribution / Order-252 reservation lineage /
Order-290 service / Order-291 payment / Order-292 invoice chain. The payment evidence
used books `2043-06-16`, bank and receipt `2043-06-15` (the D-786 bank-earlier case),
service `2043-06-01`, and invoice `2043-07-01` (inclusive day 30). The actual candidate
resolver failed with the same `42703`. Before/after counts were identical: one
lineage, service, payment and invoice row; zero journals, posting lines, documents,
facts and outbox rows. Thus zero effects are proven for the failure, but live branch,
candidate, complete predecessor output/hash and tenant-concealment success cannot be
proven because the only production query is invalid.

The exact base/candidate diff is otherwise clean and scoped. The protected
`migrations/0001_init.sql`, `package.json`, `bun.lock`, `docker-compose.yml` and
`tests/schema/expected.sql` blobs are identical. The repair removes only the invalid
ordering guard, adds both orderings/equality coverage, removes the prior whitespace,
and appends D-786/D-787 evidence.

## files_and_lines

- `src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts:68` selects
  nonexistent `service.amount_minor`; every real resolver call fails at SQL parse.
- `migrations/0056_india_gst_accommodation_service_provision_date.sql:4` defines the
  approved Order-290 service root; its complete column list at lines 5-19 contains
  currency/date/source/evidence/lineage but no amount column.
- `tests/india-gst-accommodation-time-of-supply.test.ts:24` fabricates
  `service_amount: "10500"` in the mocked row, so the focused suite cannot detect the
  schema mismatch. Its fake `Tx` never asks PostgreSQL to parse the candidate SELECT.

## tests_or_checks

- Official primary-source check: CBIC section 13(2)/Explanation and Rule 47 support
  the bounded ordinary branch and the repaired payment ordering.
- Focused Order-294 intentional/hostile suite: `10 pass / 0 fail / 120 expectations`.
- Adjacent Orders 290-294 pure suite: `43 pass / 0 fail / 3 expected database skips /
  595 expectations`.
- Fresh PostgreSQL 16.15 predecessor RLS/ACL/zero-write suites: `22 pass / 0 fail /
  338 expectations`.
- Actual unseeded and valid seeded Order-294 runtime resolver calls: both failed with
  PostgreSQL `42703`, `column service.amount_minor does not exist`; seeded failure
  left every measured table count unchanged.
- Canonical isolated `./setup.sh --db-only`: 58 migrations, 110 public tables and
  `11 passed / 0 failed of 11`.
- Full standing suite: `1024 pass / 0 fail / 871 expected skips / 15,731
  expectations`; `1,895 tests / 332 files`.
- TypeScript, `117`-file context boundaries, `23`-package licence policy and
  dependency audit: green, zero vulnerabilities.
- Ancestry, declared scope, protected blobs and
  `git diff --check 809928f..39fd5a5`: green.
- The private direct PostgreSQL container used tmpfs and the repository-pinned
  `postgres:16.15-alpine` digest. It and all review Compose resources, volumes,
  networks, generated authority and dependencies were removed. The pre-existing
  Order-175 app/PostgreSQL/Valkey trio retained exact identities and remains exited.

## risks

This is a total runtime failure, not an edge-case statutory disagreement: every
otherwise valid Order-294 request reaches an invalid column reference before RLS can
return a row or the composer can select a branch. The green focused suite is a false
positive because its synthetic row contains a field no approved predecessor can
produce. No time-of-supply result is returned, and live success claims for complete
predecessor output/hash, tenant concealment and candidate selection remain unproven.

## recommended_parent_action

Do not approve, merge, promote or deploy `39fd5a5`. Return Order 294 to the
implementer to remove the nonexistent service amount reference and compare the real
Order-291 and Order-292 amounts against the grand total reparsed from the canonical
Order-240 attribution. Add a permanent live Order-294 PostgreSQL test that seeds the
complete approved chain and invokes the real service through
`Database.withTenantTransaction` as `yellow_runtime`/`app_role`; it must cover
books-earlier, bank-earlier and equal payment evidence, day 30/day 31, every
invoice/payment/service/equal candidate selection, independently reproduced complete
output/hash, tenant-B concealment and byte-equivalent zero effects. Rerun focused,
live, setup/referee, standing/static/diff gates and request a fresh independent
Tier-3 review.
