# Order 283 corrected candidate — independent Tier-3 review

**Verdict:** **APPROVED — no finding**

**Reviewer:** fresh non-implementing Codex Tier-3 reviewer (`/root/order283_corrected_tier3_review`)

**Corrected candidate:** `2b4d2d85669c53461ff3c682e6e1bd3bc9c39175`

**Original product candidate:** `1cea37f5230685775932a48bbdaeee9adcaf9712`

**Base:** `b257949be4f779a2c889181e7b2c70533cff2840`

**Product range:** `b257949be4f779a2c889181e7b2c70533cff2840..1cea37f5230685775932a48bbdaeee9adcaf9712`

**Correction range:** `1cea37f5230685775932a48bbdaeee9adcaf9712..2b4d2d85669c53461ff3c682e6e1bd3bc9c39175`

**Complete reviewed range:** `b257949be4f779a2c889181e7b2c70533cff2840..2b4d2d85669c53461ff3c682e6e1bd3bc9c39175`
**Date:** 2026-08-29

## Independence, required reads and exact candidate

I implemented none of Order283 and did not participate in its correction. I am also
distinct from the first reviewer (`/root/order283_tier3_review`) whose recorded
verdict was `CHANGES REQUIRED`. Before inspecting or executing this corrected
candidate, I read `PROJECT.md`, `AGENTS.md`, ran `./state.sh`, and completely read
the `yellow-compliance-rules`, `yellow-entity-patterns` and
`yellow-postgres-patterns` skills, `handoff/ROSTER.md`, `docs/WORKFLOW.md`, Order283,
the current Phase-7 material, D-741 through D-744, and the first review.

The worktree was clean and `HEAD` was exactly
`2b4d2d85669c53461ff3c682e6e1bd3bc9c39175` before this authorized review record
was created. I personally ran ancestry, range, scope and whitespace checks. Both
`b257949... -> 1cea37f...` and `1cea37f... -> 2b4d2d8...` are strict ancestor
relationships, and each merge base equals its expected older endpoint. The linear
history is:

```text
2b4d2d8 Correct Order283 RLS proof wording
45b0af2 Record Order283 review finding
1cea37f Build Order283 registered-state comparison evidence
10c6320 Admit Order283
```

The product range contains exactly the thirteen declared files: the new pure value
module, its bounded-context export, two focused tests, three product documents and
six Order283/governance records. The correction range contains only
`BUILD-PLAN.md`, `DECISIONS.log`, `handoff/LEDGER.md`,
`handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`, Order283 and the first review. It
contains no source, test, product documentation, migration, schema, seed, dependency,
application composition or runtime byte.

The following commands were green:

```text
git merge-base --is-ancestor b257949... 1cea37f...
git merge-base --is-ancestor 1cea37f... 2b4d2d8...
git diff --name-status b257949...1cea37f...
git diff --name-status 1cea37f...2b4d2d8...
git diff --check b257949...2b4d2d8...
git show --check 2b4d2d8
```

## Product-byte identity and governance correction

I compared the original and corrected candidates directly. `git diff --exit-code
1cea37f...2b4d2d8... -- src tests docs` exited 0. Their exact tree identities are
also equal:

| Tree | `1cea37f...` | `2b4d2d8...` |
| --- | --- | --- |
| `src` | `64860f446f48ad115c0563d2a3d073dbf8b30e52` | `64860f446f48ad115c0563d2a3d073dbf8b30e52` |
| `tests` | `8a4a6f2259aeca0d1155af9b4dd2607ac190b908` | `8a4a6f2259aeca0d1155af9b4dd2607ac190b908` |
| `docs` | `e8be3982d5fb02c8498d79ebde7bc8449ef7f884` | `e8be3982d5fb02c8498d79ebde7bc8449ef7f884` |

Thus the source, tests and product-facing documentation reviewed here are byte-for-
byte the already-reviewed product candidate; the descendant changes only the review
and governance proof.

The correction is append-only where required and exact where mutable:

- the first `CHANGES REQUIRED` review remains intact;
- D-742's historical builder text remains byte-preserved rather than silently
  rewritten;
- D-743 records the independent finding and D-744 appends the correction;
- `DECISIONS.log` and `handoff/LEDGER.md` each change by exactly two additions and
  zero deletions from the original product candidate;
- mutable Order283/build/phase/roadmap proof now says exactly **92 RLS-enabled tenant
  tables / 92 policies / 2 FORCE-RLS tables**;
- the two FORCE-RLS tables are correctly named `property_fiscal_location` and
  `india_gst_item_classification`.

I independently searched migrations and the normalized schema: `FORCE ROW LEVEL
SECURITY` exists only for those two tables. The corrected durable record therefore
accurately distinguishes RLS enablement, policy count and FORCE RLS. No governance
finding remains.

## Reviewer-personal official-source audit

I personally checked the current official materials rather than relying on the
builder's summary:

- CBIC's official [Integrated Goods and Services Tax Act](https://cbic-gst.gov.in/hindi/IGST-bill-e.html):
  section 2(15) selects the legally relevant supplier establishment; section 7(3)
  uses supplier location versus place of supply for the ordinary inter-State services
  comparison; section 8(2) covers the ordinary same-State/UT case subject to section
  12 and excludes supplies to/by SEZs; section 7(5)(b) makes supplies to/by an SEZ
  developer or unit inter-State; and section 12(3)(b) puts hotel lodging at the
  immovable property's location.
- CBIC [Circular 48/22/2018-GST](https://cbic-gst.gov.in/pdf/Circular_48-22-2018-GST.pdf):
  the specific SEZ rule controls, including short-term accommodation supplied to an
  SEZ developer/unit, even when the ordinary location comparison is same-State/UT.
- The GST Council's official Notification 60/2020 substituted
  [FORM GST INV-01 / schema version 1.1](https://gstcouncil.gov.in/sites/default/files/2024-05/notfctn-60-central-tax-hindi-2020.pdf)
  and the GSTN-authorized IRIS IRP
  [notified schema](https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/)
  and [validation rules](https://einvoice6.gst.gov.in/content/validation-rules-for-e-invoicing-that-you-must-take-care-to-avoid-errors/):
  supplier state, mandatory place-of-supply `Pos`, recipient state, `SupTyp`, and the
  separate same-State IGST exception (`IgstOnIntra`) are distinct concepts; SEZ
  supply types are explicit.

The official audit confirms Order283's containment: equality of approved supplier
registration-state evidence and property-derived `pos` is a relationship fact only.
It does not determine intra/inter-State character, choose the supplier establishment,
apply SEZ or other exceptions, select `SupTyp`/`IgstOnIntra`, or authorize tax
decomposition. Recipient state is lineage evidence, not the comparison operand.

## Source, lineage and authority containment

I read the complete source and both complete Order283 test files. The function accepts
only the exact plain three-key input `{tenantId,supplier,placeOfSupply}`. The complete
Order272 supplier evidence and Order282 place-of-supply evidence, including nested
objects, must be exact and recursively frozen. It independently recomputes supplier
evidence JSON/hash and the Order282 fixed-order candidate JSON/hash, verifies tenant,
property, registration and jurisdiction lineage, and rejects malformed, cross-mixed,
thawed or surplus evidence fail-closed.

The only relationship expression is `supplier.stateCode === placeOfSupply.pos`.
Recipient state is neither substituted nor used as a fallback. The fixed-order result
is recursively frozen and tenant-bound, replay is deterministic, and rejection does
not mutate or disclose foreign evidence.

Manual and executable scans found no `Tx`, SQL, DML, lock, database/kernel import,
service resolver, fact/outbox/event, journal, posting, document, submission,
idempotency, network or runtime authority. The source contains no intra/inter-State
classification, CGST/SGST/UTGST/IGST decomposition, levy route/rate/amount,
`SupTyp`, `IgstOnIntra`, reverse charge, item list or document field. Product source,
tests and documentation consistently describe evidence only.

## Fresh reviewer-executed PostgreSQL-only proof

I did not reuse implementer or first-reviewer test output. I created fresh Compose
project `yellow-review283-corrected-fresh` on verified-unused host port `5595` using
only the pinned PostgreSQL 16.15 service. I did not start another app or Valkey and
did not touch stable port `3000`. Fresh disposable deploy/runtime/extension authority
roles and fresh `yellow_dev` and `yellow_test` databases were provisioned; migrations
1 through 50 were applied and the canonical deployment seed/invariant fixture loaded
into their respective targets.

With per-run disposable database selectors/DSNs, I personally executed these command
families and obtained these final results:

```text
bun test tests/india-gst-accommodation-registered-state-comparison.intentional-red.test.ts \
  tests/india-gst-accommodation-registered-state-comparison.test.ts
=> 12 passed / 0 failed / 4,187 expectations / 2 files

bun test <Order272/279/280/281 approved intentional-current and integration roots>
=> 50 passed / 0 failed / 551 expectations / 8 files

bun test tests/india-gst-accommodation-place-of-supply.intentional-red.test.ts \
  tests/india-gst-accommodation-place-of-supply.integration.test.ts
=> 12 passed / 0 failed / 353 expectations

bun test tests/india-irp-seller-details.intentional-red.test.ts \
  tests/india-irp-seller-details.test.ts
=> 9 passed / 0 failed / 111 expectations

bun test tests/positive-tax-folio-eligibility.intentional-red.test.ts \
  tests/positive-tax-folio-eligibility.integration.test.ts
=> 7 passed / 0 failed / 48 expectations

bun test tests/database-acceptance.integration.test.ts
=> 15 passed / 0 failed / 42 expectations

bun test tests/runtime-dml-authority.integration.test.ts
=> 5 passed / 0 failed / 109 expectations

bun test tests/migrate.integration.test.ts
=> 39 passed / 0 failed / 186 expectations
```

The exhaustive matrix produced exactly 36 same-code diagonal and 1,260 different-code
off-diagonal results, preserving leading-zero state/UT codes. Recipient-state changes
altered lineage/hash evidence but never the relationship. Real PostgreSQL composition
proved supplier `27`, recipient `29`, property `pos` `36` yields only
`different_state_or_union_territory`, with exact replay, deep freeze and zero source
or effect writes.

Reviewer-personal catalogue queries returned exactly:

```text
50 migrations
102 public tables
92 RLS-enabled tenant tables
92 tenant-isolation policies
2 FORCE-RLS tables: india_gst_item_classification, property_fiscal_location
```

`YELLOW_SCHEMA_DATABASE=yellow_test bun run schema:check` reported exact normalized
schema equality. The protected PostgreSQL referee, executed with Bash Python 3.12 and
psycopg2 2.9.12, reported **11 passed, 0 failed of 11**, including exact tenant-table,
RLS, policy and two-view `security_invoker` accounting.

The remaining candidate gates were also personally executed:

```text
bun test
=> 916 passed / 831 database-or-environment skips / 0 failed
   13,655 expectations; 1,747 tests across 310 files

bun run typecheck
=> exit 0

bun run boundaries
=> Import boundaries OK; 106 TypeScript files scanned

bun run license-check
=> dependency license policy passed for 23 installed packages

bun audit
=> no vulnerabilities found
```

Standing, static forbidden-authority scans, scope, ancestry, normalized-schema,
referee and diff/whitespace gates are all green.

Runner notes: an initial schema invocation omitted the required explicit schema
database selector and stopped before asserting product behavior; the corrected
invocation above passed. Linux/WSL Bun could not load the Windows-installed native
TypeScript package, so the canonical standing suite was rerun unchanged with native
Windows Bun and passed exactly as recorded. The approved-root integration files alone
produced 42/0; adding their four intentional-current canaries produced the required
eight-file 50/0 gate. These were runner/target corrections, not product failures.

## Cleanup and stable-runtime proof

Before teardown, the disposable project contained exactly one PostgreSQL service,
all three expected authority roles, and no `yellow_migrate_%` child database. I ran
the exact project teardown with volumes and orphan removal. Post-cleanup counts are
**0 containers / 0 networks / 0 volumes** for
`yellow-review283-corrected-fresh`.

I captured the stable runtime before this proof and again after cleanup. Exact full
container identities, start timestamps, health and restart counts are unchanged:

| Stable service | Exact container id | Start timestamp | Restarts | Health |
| --- | --- | --- | ---: | --- |
| app | `92cffafb93515a73e6cc9ccd623481d857afb8d9c14d8c4366eeaa5e1acc1abf` | `2026-08-29T06:37:36.392830169Z` | 0 | healthy |
| PostgreSQL | `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12` | `2026-08-29T02:59:30.103272572Z` | 0 | healthy |
| Valkey | `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa` | `2026-08-29T02:59:30.442755852Z` | 0 | healthy |

Stable `http://127.0.0.1:3000/health` remains exact HTTP **200** with body
`{"status":"ok"}`; port `3002` has zero listeners. I did not restart, mutate,
promote or replace the stable app, PostgreSQL or Valkey.

## Bounded approval

This approval is limited to exact corrected candidate
`2b4d2d85669c53461ff3c682e6e1bd3bc9c39175` and the Order283 registered-state/
property-place-of-supply relationship evidence in the ranges above. It does not
approve intra/inter-State classification; supplier-establishment selection; SEZ,
B2C, export, deemed-export or other exception handling; `SupTyp` or `IgstOnIntra`;
levy route/rate/amount or tax decomposition; item, document, submission, API, UI,
runtime promotion, merge, deployment, Phase-7 completion or application completion.

No product, legal-containment, executable-proof, governance-correction, cleanup or
stable-runtime finding remains. The corrected candidate is **APPROVED**.
