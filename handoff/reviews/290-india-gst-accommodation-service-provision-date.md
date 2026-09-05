# Order 290 independent Tier-3 review — India GST accommodation service provision date

**Verdict:** APPROVED  
**Reviewer:** OpenAI Codex independent review agent `/root/order290_review`  
**Candidate:** `4476cc59342de6a0faba7069612fef25afb02426`  
**Base:** `8f5c600`  
**Branch:** `phase-7/india-gst-accommodation-service-provision-date`  
**Reviewed:** 2026-08-30

## Independence and scope

I did not implement Order 290. I read `PROJECT.md`, `AGENTS.md`, ran `./state.sh`,
and read the complete `yellow-compliance-rules`, `yellow-entity-patterns`, and
`yellow-postgres-patterns` skills before inspecting or executing the candidate. I
reviewed the exact base-to-candidate diff, Order 290, D-768, D-769, and every changed
file. All 19 changed files are within the order's declared migration, resolver,
tests, schema mirror, documentation, build-plan, decision, ledger, order, and review
scope. `git diff --check 8f5c600..4476cc5` is clean. The immutable
`migrations/0001_init.sql`, `package.json`, `bun.lock`, and `docker-compose.yml` have
identical blobs at base and candidate. The worktree was clean before this review
record.

The implementation adds one 15-column tenant-leading, forced-RLS, SELECT-only
service-provision-date evidence root and one exact five-key equality resolver. Its
ten-column composite lineage FK binds the root to the approved Order 252/240 chain.
The candidate does not add a writer, clock/latest lookup, date derivation, invoice or
payment fact, time-of-supply decision, tax calculation, posting, document, API, UI,
or local-promotion authority.

## Primary-source statutory check

I inspected these official primary sources:

- India Code, current consolidated *Central Goods and Services Tax Act, 2017*,
  section 13(2), page 26:
  <https://www.indiacode.nic.in/indiacode/bitstream/123456789/15689/1/A2017-12.pdf>.
  It distinguishes the invoice/payment rule in section 13(2)(a), the date of
  provision of service/payment rule when the invoice is not issued within the
  prescribed period in section 13(2)(b), and the recipient-books fallback in
  section 13(2)(c).
- The same official Act, section 31(2), page 42, requires a taxable-service invoice
  before or after provision of service but within the prescribed period.
- CBIC, official invoice rules, rule 2:
  <https://cbic-gst.gov.in/gst-invoice-rules.html>. It prescribes thirty days from
  the date of supply of service for the ordinary service-invoice case, subject to
  the listed special exceptions.

These sources support preserving a separately governed provision-date fact for
later statutory composition. They do not support deriving that date from a room
night, reservation interval, operational event, posting time, current clock, or
another nearby date, and they do not support deciding section 13 time of supply
without the separately governed invoice and payment facts. The candidate keeps
those boundaries intact.

## Schema and resolver inspection

The migration adds exactly the declared 15-column root, tenant-leading primary key,
ten-column lineage foreign key, constrained date/source/evidence shape, forced RLS,
and `app_role` SELECT-only authority. The resolver accepts exactly five identity
keys, requires exact equality, follows the full tenant-bound lineage join, reparses
the approved Order 240 immutable snapshot, requires the bound rate quote, room, and
room-revenue lineage, and returns frozen evidence including its deterministic hash.
It neither writes nor substitutes a newer, operational, reservation, posting, or
clock-derived date.

Migration SHA-256:
`920b98c03e65e7ed968b2fe277f6f9d67185be125a68aec3123b9ad0b8f27658`.

## Reviewer-executed proof

All database proof used isolated PostgreSQL 16.15 resources and isolated ports.
Credentials came from the approved local runtime-authority files and were never
printed. I personally ran every gate; implementer-pasted results were not used as
approval evidence.

| Proof | Reviewer result |
|---|---:|
| Focused Order 290 hostile + live PostgreSQL suite | `10 pass / 0 fail / 178 expectations` |
| Fresh deployment database acceptance on canonical `yellow_dev` | `21 pass / 0 fail / 61 expectations` |
| Runtime DML authority under `yellow_runtime` | `5 pass / 0 fail / 115 expectations` |
| Migration runner | `39 pass / 0 fail / 187 expectations` |
| Normalized `pg_dump` versus `tests/schema/expected.sql` | exact match |
| Normalized schema SHA-256 | `15955a37996c71d9eb7a12401fa075205eac93a0fa3168d271b02c1b9e00cea8` |
| Exact catalogue | `56 migrations / 108 tables / 98 RLS / 98 policies / 8 FORCE RLS` |
| Canonical setup/invariant referee | `11 passed / 0 failed of 11` |
| Full standing suite | `985 pass / 0 fail / 867 database-only skips / 15,278 expectations`; `1,852 tests / 324 files` |
| TypeScript | `tsc --noEmit` green |
| Context boundaries | `113 TypeScript files scanned` green |
| Dependency licence policy | `23 installed packages` green |
| Dependency audit | no vulnerabilities |
| Candidate ancestry, scope, protected blobs, status and whitespace | green |

I also seeded the exact Order 240 snapshot, Order 252 lineage, and Order 290 root in
a freshly migrated reviewer database, switched to `app_role` with an explicit tenant
context, and executed the actual resolver source. It returned only the exact bound
row with provision date `2043-06-17`, lineage identifier
`00000000-0000-0000-0000-000000029006`, and evidence hash
`c22b343b59e25b0696b84c87da0895aad0f7aed0e728d11062b2018fb87605f3`.
That live execution confirms the source query, ACL, RLS context, lineage validation,
snapshot reparse, and deterministic evidence path together.

## Reviewer-harness observations

An external single-local cleanup mechanism removed two compose-labelled disposable
review projects while proof was running, producing PostgreSQL `57P03` shutdown
responses in those interrupted invocations. The coordination owner confirmed it did
not remove the reviewer resources. I therefore reran the affected gates sequentially
against a retained, direct PostgreSQL 16.15 reviewer container on port `5570`.
The clean foreground reruns above all passed. The first database-acceptance attempt
also targeted `yellow_test`, whose intentional two-tenant invariant fixture cannot
satisfy the acceptance suite's canonical one-demo-tenant assertion; the required
canonical `yellow_dev` rerun passed `21/0`. These were isolated harness lifecycle and
targeting observations, not candidate assertion failures, and only clean completed
runs count as approval evidence.

After proof I stopped and removed the exact direct reviewer container
`0a5436217cbee6a27cfffab4a41d28ca2c202c0254a7f9c4b9ebea56fe95ea20`
(`yellow-tier3-migration-fast`) and verified zero matching reviewer containers and
zero matching reviewer volumes remained.

## Stable-local preservation

Before and after reviewer cleanup, the sole stable local retained the same container
identities and start timestamps, remained healthy, and stayed at restart count zero:

- app `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf`,
  port `3000`, healthy, restart count `0`;
- PostgreSQL `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12`,
  port `5545`, healthy, restart count `0`;
- Valkey `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa`,
  port `6485`, healthy, restart count `0`;
- `GET http://127.0.0.1:3000/health` returned `200 {"status":"ok"}`.

Order 290 was not promoted to or exercised against the stable local.

## Findings and verdict

No blocking, high, medium, or low-severity product finding remains. The exact
candidate `4476cc59342de6a0faba7069612fef25afb02426` is **APPROVED** for Order 290.
