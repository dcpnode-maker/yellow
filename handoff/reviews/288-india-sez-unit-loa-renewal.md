# Order 288 — Independent Tier-3 review

**Verdict:** **APPROVED — no finding**

**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order287_review`)

**Reviewed commit:** `d65c236b53b29f4ab6066fbd0a4c605717af6a62`

**Reviewed base:** `39219a8e90c26a1754386ef4d484cf76805b5913` (independently approved Order287 descendant)

**Reviewed range:** `39219a8..d65c236`

**Date:** 2026-08-29

## Independence, required reads and exact scope

I implemented none of Order288. Before reviewing it I completely read `PROJECT.md`,
`AGENTS.md`, `handoff/ROSTER.md`, `docs/WORKFLOW.md`, Order288 and the mandatory
`yellow-compliance-rules`, `yellow-entity-patterns` and `yellow-postgres-patterns`
skills, and ran `./state.sh`. I personally inspected D-759 through D-763, including
D-760 and D-761's exact migration-test scope corrections and D-762's canonical-setup
clarification, plus the approved Order286/287 source and review lineage.

The worktree was clean and `HEAD` was exactly
`d65c236b53b29f4ab6066fbd0a4c605717af6a62` before this authorized review record.
`39219a8e90c26a1754386ef4d484cf76805b5913` is the exact merge base and a strict
ancestor. The range contains the one `[codex] Build Order 288 SEZ unit LoA renewal`
commit. Its nineteen changed paths are exactly the admitted migration, schema and
catalogue assertions, setup count/diagnostic, resolver/export, focused tests,
documents and governance evidence. There is no dependency, compose, initial-
migration or unrelated product change. `git diff --check`, `git show --check`,
ancestry, changed-path and protected-artifact checks passed.

The following protected blobs are byte-identical at base and candidate:

| Artifact | Exact Git blob at base and candidate |
| --- | --- |
| `migrations/0001_init.sql` | `dce210b2c911efb63a49a4e58778d88084073494` |
| `package.json` | `9b96d8c2df06ec373877c3d19e7f82f04796045e` |
| `bun.lock` | `56434f7e2432edb381612135568d3a1a0b8d274b` |
| `docker-compose.yml` | `5e811f80432c3f5939ff69202ad8ab792a7514d2` |

## Reviewer-personal official-law audit

I checked official primary material rather than relying on builder notes:

- The Ministry of Commerce and Industry's official 2018 Gazette
  [SEZ Rules amendment, G.S.R. 909(E)](https://sezindia.gov.in/sites/default/files/sez_rules_amendments/SEZ%20Rules%20amnedment.pdf)
  inserts Rule 19(6A). Sub-rule (1) makes **Form F1** the unit's application to the
  Development Commissioner. Sub-rule (2) says a non-compliant unit's Letter of
  Approval shall not be considered for renewal. Sub-rule (3) says the Development
  Commissioner may renew the Letter of Approval for **five years or a shorter
  period** in **Form F2**.
- The same official notification prints Form F1 with the Rule 19(6A)(1) application
  legend. It separately prints Form F2 with the Rule 19(6A)(3) legend, the
  Development Commissioner's office heading, and the operative statement that the
  LoA validity is extended. The implementation therefore correctly accepts only an
  exact issued F2 record; an F1, requested duration or application fact is not
  authority.
- I checked the Ministry's current
  [SEZ Rules and amendments index](https://sezindia.gov.in/sez-rules-and-amendments)
  and its current official
  [compiled SEZ Rules book](https://sezindia.gov.in/sites/default/files/sez_rules_amendments/SEZ%20Rules-EPCES%20Book-rotated_1_11zon%20(3).pdf),
  which continues to carry Forms F1 and F2. I found no later amendment reversing
  this F1/F2 distinction or the five-year-or-shorter discretion.
- The official consolidated Rules material also keeps cancellation/non-compliance
  as separate governed action rather than something that follows merely from a date
  or missing application. The candidate consequently requires explicit exact
  `in_force` Development Commissioner evidence at the requested status date and
  does not infer current status, cancellation or revival.

The exact direct-contiguous **first** F2 lane is a deliberate bounded product
contract, not a claim that the Rules erase later renewals. It safely rejects gaps,
overlaps and second/later chains until those distinct authorities receive their own
order and proof.

## Schema, source, chronology and containment audit

Migration `0054_india_sez_unit_loa_renewal.sql` has SHA-256
`54a65ae32acfc5e232037129685a7c7edfb950aa66b54d4ea053c7acf11bb717`.
It adds exactly the declared fifteen-column root with tenant-leading identity,
unique and composite status foreign key, canonical references and lowercase
SHA-256 evidence, a finite non-empty canonical `[from,toExclusive)` range, fixed
status/source/rule literals, issue/status/range chronology, forced RLS and
`app_role` SELECT only. Live catalogue inspection proved owner `yellow_owner`, RLS
and FORCE RLS enabled, two tenant-leading indexes, SELECT granted and INSERT,
UPDATE, DELETE and TRUNCATE denied.

The resolver's seven-key input is exact plain, symbol-free, accessor-free and
proxy-free. It fully resolves Order286 and reconstructs and rehashes the complete
frozen Form-G status result, including every minimized child hash; it does not trust
a carried hash. Supplier, property, reservation, service-location, SEZ status and
renewal identities are equality-bound. The SQL equality-selects only the requested
tenant/id/status/status-date row with fixed status/source/rule and contains no
latest/nearest ordering, limit or server clock.

The original LoA reference and evidence hash must equal approved upstream Form-G
evidence. The structured original issue date is correctly bound by the complete F2
document hash rather than falsely compared to an Order286 field that does not
exist. Original LoA issue, F2 issue, explicit status date and both finite validity
ranges are checked in order. The renewal lower bound must equal the original Form-G
exclusive upper bound exactly. Thus the lower boundary succeeds, the upper boundary
is excluded, and stale, future-issued, gap, overlap and later-chain evidence fails
closed.

The exact fixed-order result, canonical JSON, tenant-bound root hash and recursive
freeze are deterministic and replay-stable. Caller/source bytes remain unchanged.
Static and executable inspection found no F1 authority, Form-F2 authoring, generic
approval writer, authorized-operations interpretation, specified-officer or BLUT
authority, GST-current-status substitution, zero rating/refund, `SEZWP`/`SEZWOP`,
levy/rate/amount/decomposition, `SupTyp`/`IgstOnIntra`, item/invoice/document,
journal/posting, network/HTTP/UI or downstream fiscal authority.

## Reviewer-personal executable proof

I created one reviewer-owned PostgreSQL 16.15 container on loopback port `5598`,
with isolated reviewer-only roles and databases. I did not reuse builder results or
credentials and never connected that proof lane to the stable app. At exact
`d65c236` I personally executed:

- focused live-PostgreSQL Order288 proof → **10 passed / 0 failed / 227
  expectations**. This covers golden five-year and shorter F2 instruments, exact
  lower/upper boundaries, direct-first-only continuity, chronology, every stale,
  malformed and hostile identity/hash/range/status/source/rule mix, full Order286
  rehash, freeze/replay/source immutability and zero-effect containment;
- migration proof → **39 passed / 0 failed / 187 expectations**;
- database acceptance → **19 passed / 0 failed / 55 expectations**;
- runtime DML authority → **5 passed / 0 failed / 113 expectations**;
- direct catalogue and normalized-schema proof → exactly **54 migrations / 106
  public tables / 96 RLS-enabled tenant tables / 96 tenant-isolation policies / 6
  FORCE-RLS tables**, and `pg_dump` normalization matched
  `tests/schema/expected.sql` byte-for-byte;
- `./setup.sh --db-only` and the separately executed Python referee → each **11
  passed / 0 failed of 11**. The referee independently confirmed 96/96/96, no
  runtime-schema drift and security-invoker view invariants;
- adjacent Orders284–288 suites → **46 passed / 28 expected database-lifecycle
  skips / 0 failed / 1,198 expectations**, including the complete Order286 rehash
  and Order287's eighteen relationship × supplier × recipient combinations;
- standing `bun test` → **967 passed / 863 expected environment skips / 0 failed /
  14,892 expectations; 1,830 tests across 320 files**;
- `bun run typecheck` → exit 0; `bun run boundaries` → **111 TypeScript files**,
  pass; `bun run license-check` → **23 installed packages**, pass; `bun audit` →
  **no vulnerabilities**; `git diff --check`, `git show --check`, direct forbidden-
  source scans, exact ancestry/scope/blob/hash checks and clean-tree checks → pass.

The historical Order285/286 database tests include their deliberately frozen
pre-0054 catalogue totals. Against the current full-chain database those two old
cutoff assertions correctly observe the newer 54/106 catalogue, while all their
product cases pass. I therefore executed the adjacent lineage lane in its intended
environment-isolated mode and separately proved the current catalogue through the
dedicated migration, acceptance, DML, schema, setup and referee lanes above. No test
was removed, relaxed or represented as candidate failure.

Before cleanup the disposable container was exactly
`d47923c07102fef8bc4af771a38ffe972928334836bf93cfd38beb71c9bc52e2`,
image `postgres:16.15-alpine`, running with restart count zero. No
`yellow_migrate_%` database remained. I then removed only the exact disposable
container `yellow-order288-tier3-pg` and volume
`yellow-order288-tier3-pgdata`; post-cleanup exact-name counts were zero.

## Stable-local preservation and bounded approval

The stable services have the same exact identities, start timestamps, zero restart
counts and healthy states before and after review:

| Stable service | Exact container id | Start timestamp | Restarts | Health |
| --- | --- | --- | ---: | --- |
| app | `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf` | `2026-08-29T06:37:36.392830169Z` | 0 | healthy |
| PostgreSQL | `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12` | `2026-08-29T02:59:30.103272572Z` | 0 | healthy |
| Valkey | `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa` | `2026-08-29T02:59:30.442755852Z` | 0 | healthy |

Port `3000` remained bound only to the exact stable app and `/health` remained HTTP
200 with `{"status":"ok"}`. I did not query or mutate the stable database, restart
or replace any stable service, promote, merge, deploy or push anything.

No statutory-instrument, schema, RLS/ACL, chronology, direct-first-only, lineage,
hash, deterministic-shape, zero-effect, scope or executable-proof finding remains.
Approval is limited to the exact first directly contiguous issued-Form-F2 continuity
evidence at `d65c236`. It grants no F1 authority, second/later renewal, authorized-
operations/zero-rating/refund, BLUT, GST-current-status substitution, levy/rate/
amount/decomposition, `SupTyp`, `IgstOnIntra`, item, posting/correction, invoice/
document/number/hash-chain, provider/submission, API/HTTP/UI, local promotion,
merge, deployment, Phase-7 completion or application-complete authority. Apart from
this review record, I changed no repository file.
